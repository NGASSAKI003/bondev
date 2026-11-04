/**
 * Progression « façon jeu » calculée uniquement à partir de données publiques
 * ou de l'utilisateur connecté. Aucun appel réseau, aucun stockage : tout est
 * déterministe et testable.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Niveaux
// ─────────────────────────────────────────────────────────────────────────────

export type LevelDefinition = {
  min: number
  name: string
  nameEn: string
}

/** Les mêmes seuils que la fonction SQL `public.level_for`. */
export const LEVELS: readonly LevelDefinition[] = [
  { min: 0, name: 'Étincelle', nameEn: 'Spark' },
  { min: 10, name: 'Explorateur', nameEn: 'Explorer' },
  { min: 30, name: 'Bâtisseur', nameEn: 'Builder' },
  { min: 70, name: 'Mentor', nameEn: 'Mentor' },
  { min: 150, name: 'Maître', nameEn: 'Master' },
  { min: 300, name: 'Légende', nameEn: 'Legend' },
]

export type LevelProgress = {
  totalEarned: number
  current: LevelDefinition
  next: LevelDefinition | null
  /** Points restants avant le niveau suivant. */
  remaining: number
  /** Progression dans le niveau courant, entre 0 et 100. */
  percent: number
}

export function levelFor(totalEarned: number): LevelProgress {
  const total = Number.isFinite(totalEarned)
    ? Math.max(0, Math.trunc(totalEarned))
    : 0

  let index = 0
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (total >= LEVELS[i].min) index = i
  }

  const current = LEVELS[index]
  const next = LEVELS[index + 1] ?? null
  const percent = next
    ? Math.min(
        100,
        Math.max(0, ((total - current.min) / (next.min - current.min)) * 100),
      )
    : 100

  return {
    totalEarned: total,
    current,
    next,
    remaining: next ? Math.max(0, next.min - total) : 0,
    percent,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Semaines UTC (lundi 00:00), comme date_trunc('week', now())
// ─────────────────────────────────────────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function startOfUtcWeek(date: Date): Date {
  const copy = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  // getUTCDay : 0 = dimanche, 1 = lundi. On recule jusqu'au lundi.
  const offset = (copy.getUTCDay() + 6) % 7
  copy.setUTCDate(copy.getUTCDate() - offset)
  return copy
}

/** Clé stable d'une semaine, par exemple « 2026-11-02 ». */
export function utcWeekKey(date: Date): string {
  return startOfUtcWeek(date).toISOString().slice(0, 10)
}

function weekIndex(date: Date): number {
  return Math.floor(startOfUtcWeek(date).getTime() / WEEK_MS)
}

function weekIndexFromValue(value: string): number | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return weekIndex(date)
}

// ─────────────────────────────────────────────────────────────────────────────
// Série et joker
// ─────────────────────────────────────────────────────────────────────────────

export type StreakProgress = {
  /** Semaines consécutives, joker compris. */
  current: number
  /** Meilleure série connue, joker compris. */
  best: number
  /** Nombre de semaines pardonnées dans la série courante. */
  jokersUsed: number
  activeThisWeek: boolean
}

type StreakTail = {
  count: number
  jokers: number
  lastGap: number | null
}

/**
 * Série qui se termine à une semaine active donnée.
 *
 * Règle du joker : une semaine manquée peut être pardonnée seulement si elle
 * est encadrée par deux semaines actives, et si aucune autre semaine pardonnée
 * ne se trouve à moins de 4 semaines. Autrement dit, deux semaines manquées ne
 * peuvent jamais partager une même fenêtre glissante de 4 semaines. Le choix
 * est déterministe : on part de la semaine active la plus récente et on
 * remonte le temps.
 */
function streakEndingAt(
  activeWeeks: ReadonlySet<number>,
  end: number,
  earliest: number,
): StreakTail {
  let count = 1
  let jokers = 0
  let lastGap: number | null = null
  let cursor = end - 1

  while (cursor >= earliest) {
    if (activeWeeks.has(cursor)) {
      count += 1
      cursor -= 1
      continue
    }

    // Le joker ne relie que deux semaines réellement actives. Une semaine
    // manquée en début ou en fin de série n'allonge donc pas la série.
    const canForgive =
      activeWeeks.has(cursor - 1) &&
      (lastGap === null || lastGap - cursor >= 4)

    if (!canForgive) break

    count += 1
    jokers += 1
    lastGap = cursor
    cursor -= 1
  }

  return { count, jokers, lastGap }
}

function weekIndexesFromDates(dates: readonly (Date | string)[]): Set<number> {
  const weeks = new Set<number>()
  for (const value of dates) {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) continue
    weeks.add(weekIndex(date))
  }
  return weeks
}

/**
 * Calcule la série courante et la meilleure série.
 *
 * La semaine en cours reste « en attente » tant qu'elle n'est pas terminée :
 * ne rien avoir fait le lundi ne casse pas la série. Un joker peut aussi
 * couvrir la semaine précédente si elle a été manquée.
 */
export function computeStreak(
  activeDates: readonly (Date | string)[],
  now: Date = new Date(),
  useJoker = true,
): StreakProgress {
  const activeWeeks = weekIndexesFromDates(activeDates)
  if (activeWeeks.size === 0) {
    return { current: 0, best: 0, jokersUsed: 0, activeThisWeek: false }
  }

  const currentWeek = weekIndex(now)
  const activeThisWeek = activeWeeks.has(currentWeek)
  const earliest = Math.min(...activeWeeks)

  let current = 0
  let jokersUsed = 0

  if (activeThisWeek) {
    const tail = streakEndingAt(activeWeeks, currentWeek, earliest)
    current = tail.count
    jokersUsed = tail.jokers
  } else if (activeWeeks.has(currentWeek - 1)) {
    const tail = streakEndingAt(activeWeeks, currentWeek - 1, earliest)
    current = tail.count
    jokersUsed = tail.jokers
  } else if (useJoker && activeWeeks.has(currentWeek - 2)) {
    const tail = streakEndingAt(activeWeeks, currentWeek - 2, earliest)
    const gap = currentWeek - 1
    const gapFits =
      tail.lastGap === null || gap - tail.lastGap >= 4
    if (gapFits) {
      current = tail.count + 1
      jokersUsed = tail.jokers + 1
    }
  }

  let best = 0
  for (const week of activeWeeks) {
    const tail = streakEndingAt(
      activeWeeks,
      week,
      earliest,
    )
    if (tail.count > best) best = tail.count
  }

  if (!useJoker) {
    // Sans joker, on ne garde que les semaines réellement actives.
    current = 0
    if (activeThisWeek) {
      let cursor = currentWeek
      while (activeWeeks.has(cursor)) {
        current += 1
        cursor -= 1
      }
    } else if (activeWeeks.has(currentWeek - 1)) {
      let cursor = currentWeek - 1
      while (activeWeeks.has(cursor)) {
        current += 1
        cursor -= 1
      }
    }
    jokersUsed = 0

    best = 0
    for (const week of activeWeeks) {
      let cursor = week
      let length = 0
      while (activeWeeks.has(cursor)) {
        length += 1
        cursor -= 1
      }
      if (length > best) best = length
    }
  }

  return { current, best, jokersUsed, activeThisWeek }
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

export type BadgeTier = 'bronze' | 'silver' | 'gold'
export type BadgeFamily = 'help' | 'share' | 'useful' | 'streak'

export const BADGE_TIERS: readonly BadgeTier[] = ['bronze', 'silver', 'gold']

/** Seuils bronze / argent / or. */
export const BADGE_THRESHOLDS: Record<
  BadgeFamily | 'specialty',
  readonly [number, number, number]
> = {
  help: [1, 5, 25],
  share: [1, 3, 5],
  useful: [1, 10, 50],
  streak: [4, 12, 52],
  specialty: [3, 10, 25],
}

export type TierBadgeProgress = {
  count: number
  /** Palier actuellement atteint, ou null avant le bronze. */
  tier: BadgeTier | null
  nextTier: BadgeTier | null
  currentThreshold: number
  nextThreshold: number | null
  /** Nombre d'actions restantes pour le prochain palier. */
  remaining: number
  /** Progression entre le palier actuel et le suivant (0 à 100). */
  percent: number
}

export function tierProgress(
  rawCount: number,
  thresholds: readonly [number, number, number],
): TierBadgeProgress {
  const count = Number.isFinite(rawCount)
    ? Math.max(0, Math.trunc(rawCount))
    : 0

  let tier: BadgeTier | null = null
  let currentThreshold = 0
  let nextTier: BadgeTier | null = BADGE_TIERS[0]
  let nextThreshold: number | null = thresholds[0]

  for (let i = 0; i < thresholds.length; i += 1) {
    if (count >= thresholds[i]) {
      tier = BADGE_TIERS[i]
      currentThreshold = thresholds[i]
      nextTier = BADGE_TIERS[i + 1] ?? null
      nextThreshold = thresholds[i + 1] ?? null
    } else {
      nextTier = BADGE_TIERS[i]
      nextThreshold = thresholds[i]
      break
    }
  }

  const percent =
    nextThreshold === null
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            ((count - currentThreshold) /
              (nextThreshold - currentThreshold)) *
              100,
          ),
        )

  return {
    count,
    tier,
    nextTier,
    currentThreshold,
    nextThreshold,
    remaining: nextThreshold === null ? 0 : Math.max(0, nextThreshold - count),
    percent,
  }
}

export type SpecialtyProgress = TierBadgeProgress & {
  technology: string
}

export type CommunityBadgeId = 'first_answer' | 'new_voice' | 'kind'

export type CommunityBadgeProgress = {
  id: CommunityBadgeId
  unlocked: boolean
  count: number
  target: number
  percent: number
}

export type ProgressBadges = {
  help: TierBadgeProgress
  share: TierBadgeProgress
  useful: TierBadgeProgress
  streak: TierBadgeProgress
  specialties: SpecialtyProgress[]
  community: CommunityBadgeProgress[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Quête et défi collectif
// ─────────────────────────────────────────────────────────────────────────────

export type QuestMissionId =
  | 'answer_beginner'
  | 'publish_project'
  | 'mark_useful'

export type QuestMissionProgress = {
  id: QuestMissionId
  done: boolean
}

export type QuestProgress = {
  missions: QuestMissionProgress[]
  completed: number
  total: number
  allDone: boolean
}

export const CHALLENGE_TARGET = 10

export type ChallengeProgress = {
  resolved: number
  target: number
  achieved: boolean
  /** L'utilisateur a fait au moins une action cette semaine. */
  activeThisWeek: boolean
  /** Badge virtuel « Défi de la semaine », jamais écrit en base. */
  badgeUnlocked: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrées et calcul complet
// ─────────────────────────────────────────────────────────────────────────────

export type ProgressAnswerInput = {
  createdAt: string
  /** Date de validation quand la réponse a été marquée utile. */
  validatedAt?: string
  isUseful: boolean
  beginnerOk: boolean
  technologies: string[]
}

export type ProgressQuestionInput = {
  updatedAt: string
  status: string
  validatedAnswerId: string | null
}

export type ProgressProjectInput = {
  createdAt: string
}

export type ProgressUseInput = {
  createdAt: string
}

export type ProgressChallengeInput = {
  week: string
  resolved: number
}

export type ProgressTotalsInput = {
  resolvedQuestions: number
  projects: number
  members: number
}

export type ProgressInput = {
  totalEarned: number
  answers: ProgressAnswerInput[]
  authoredQuestions: ProgressQuestionInput[]
  projects: ProgressProjectInput[]
  usesGiven: ProgressUseInput[]
  usesReceived: number
  challenge: ProgressChallengeInput
  totals: ProgressTotalsInput
}

export type ProgressSummary = {
  week: string
  level: LevelProgress
  streak: StreakProgress
  badges: ProgressBadges
  quest: QuestProgress
  challenge: ChallengeProgress
  totals: ProgressTotalsInput
  activeThisWeek: boolean
}

function occurredDuringWeek(value: string, currentWeek: number): boolean {
  const index = weekIndexFromValue(value)
  return index !== null && index === currentWeek
}

function specialtyBadges(answers: ProgressAnswerInput[]): SpecialtyProgress[] {
  const counts = new Map<string, { label: string; count: number }>()

  for (const answer of answers) {
    if (!answer.isUseful) continue
    const seenForAnswer = new Set<string>()
    for (const raw of answer.technologies) {
      const label = raw.trim()
      if (!label) continue
      const key = label.toLocaleLowerCase('fr')
      if (seenForAnswer.has(key)) continue
      seenForAnswer.add(key)
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { label, count: 1 })
    }
  }

  return [...counts.values()]
    .sort(
      (a, b) =>
        b.count - a.count || a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }),
    )
    .slice(0, 3)
    .map((entry) => ({
      technology: entry.label,
      ...tierProgress(entry.count, BADGE_THRESHOLDS.specialty),
    }))
}

export function buildProgress(
  input: ProgressInput,
  now: Date = new Date(),
): ProgressSummary {
  const currentWeek = weekIndex(now)
  const week = utcWeekKey(now)

  const activeDates: string[] = [
    ...input.answers.map((answer) =>
      answer.isUseful && answer.validatedAt
        ? answer.validatedAt
        : answer.createdAt,
    ),
    ...input.authoredQuestions
      .filter(
        (question) =>
          question.status === 'resolved' &&
          question.validatedAnswerId !== null,
      )
      .map((question) => question.updatedAt),
    ...input.projects.map((project) => project.createdAt),
    ...input.usesGiven.map((use) => use.createdAt),
  ]

  const streak = computeStreak(activeDates, now)

  const validatedAnswers = input.answers.filter((answer) => answer.isUseful)
  const beginnerAnswers = input.answers.filter((answer) => answer.beginnerOk)

  const challengeResolved =
    input.challenge.week === week
      ? Math.max(0, Math.trunc(input.challenge.resolved))
      : 0
  const challengeAchieved = challengeResolved >= CHALLENGE_TARGET

  const missions: QuestMissionProgress[] = [
    {
      id: 'answer_beginner',
      done: input.answers.some(
        (answer) =>
          answer.beginnerOk &&
          occurredDuringWeek(answer.createdAt, currentWeek),
      ),
    },
    {
      id: 'publish_project',
      done: input.projects.some((project) =>
        occurredDuringWeek(project.createdAt, currentWeek),
      ),
    },
    {
      id: 'mark_useful',
      done: input.usesGiven.some((use) =>
        occurredDuringWeek(use.createdAt, currentWeek),
      ),
    },
  ]
  const completed = missions.filter((mission) => mission.done).length

  const community: CommunityBadgeProgress[] = [
    {
      id: 'first_answer',
      unlocked: input.answers.length >= 1,
      count: input.answers.length,
      target: 1,
      percent: Math.min(100, input.answers.length * 100),
    },
    {
      id: 'new_voice',
      unlocked: beginnerAnswers.length >= 1,
      count: beginnerAnswers.length,
      target: 1,
      percent: Math.min(100, beginnerAnswers.length * 100),
    },
    {
      id: 'kind',
      unlocked: beginnerAnswers.length >= 3,
      count: beginnerAnswers.length,
      target: 3,
      percent: Math.min(100, (beginnerAnswers.length / 3) * 100),
    },
  ]

  return {
    week,
    level: levelFor(input.totalEarned),
    streak,
    badges: {
      help: tierProgress(validatedAnswers.length, BADGE_THRESHOLDS.help),
      share: tierProgress(input.projects.length, BADGE_THRESHOLDS.share),
      useful: tierProgress(input.usesReceived, BADGE_THRESHOLDS.useful),
      streak: tierProgress(streak.best, BADGE_THRESHOLDS.streak),
      specialties: specialtyBadges(input.answers),
      community,
    },
    quest: {
      missions,
      completed,
      total: missions.length,
      allDone: completed === missions.length,
    },
    challenge: {
      resolved: challengeResolved,
      target: CHALLENGE_TARGET,
      achieved: challengeAchieved,
      activeThisWeek: streak.activeThisWeek,
      badgeUnlocked: challengeAchieved && streak.activeThisWeek,
    },
    totals: {
      resolvedQuestions: Math.max(0, Math.trunc(input.totals.resolvedQuestions)),
      projects: Math.max(0, Math.trunc(input.totals.projects)),
      members: Math.max(0, Math.trunc(input.totals.members)),
    },
    activeThisWeek: streak.activeThisWeek,
  }
}
