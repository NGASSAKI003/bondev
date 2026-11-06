import { LangToggle, useLang, type Lang } from './i18n'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  getProgress,
  listProjects,
  markProjectUsed,
  toFrenchError,
  type ProgressResult,
  type Project,
} from './lib/api'
import { useAuth } from './lib/auth'
import {
  BADGE_FAMILY_META,
  COMMUNITY_META,
  QUEST_META,
  familyLabel,
  tierName,
} from './lib/badgeMeta'
import {
  PROGRESS_EVENT,
  notifyProgressChanged,
  type ProgressEventDetail,
} from './lib/events'
import { formatDateTime, formatRelativeDate } from './lib/format'
import { GUEST_USED_EXPLANATION } from './lib/guest'
import {
  levelFor,
  type BadgeFamily,
  type BadgeTier,
  type CommunityBadgeId,
  type LevelDefinition,
  type ProgressSummary,
} from './lib/progress'
import { normalizeSearchText, searchProjects } from './lib/search'
import { GuestBanner } from './components/GuestBanner'
import {
  AccountLangToggle,
  Header,
  Icon,
  Primary,
  ScreenSkeleton,
  ThemeToggle,
  initialsFor,
} from './components/ui'
import type { Screen } from './screens/types'

const ShareProject = lazy(() =>
  import('./screens/ShareProjectScreen').then((module) => ({
    default: module.ShareProject,
  })),
)
const Help = lazy(() =>
  import('./screens/EntraideScreen').then((module) => ({
    default: module.Help,
  })),
)
const QuestionThread = lazy(() =>
  import('./screens/EntraideScreen').then((module) => ({
    default: module.QuestionThread,
  })),
)
const Add = lazy(() =>
  import('./screens/EntraideScreen').then((module) => ({
    default: module.Add,
  })),
)
const Profile = lazy(() =>
  import('./screens/ProfileScreen').then((module) => ({
    default: module.Profile,
  })),
)
const HowItWorks = lazy(() =>
  import('./screens/HowItWorksScreen').then((module) => ({
    default: module.HowItWorks,
  })),
)

const DATA_SAVER_KEY = 'bondev-data-saver'
const TUTORIAL_KEY_PREFIX = 'bondev-tutorial'
const SEEN_KEY_PREFIX = 'bondev-progress-seen'

type Celebration =
  | { key: string; kind: 'level'; level: LevelDefinition }
  | { key: string; kind: 'badge'; family: BadgeFamily; tier: BadgeTier }
  | {
      key: string
      kind: 'specialty'
      technology: string
      tier: BadgeTier
    }
  | { key: string; kind: 'community'; id: CommunityBadgeId }
  | { key: string; kind: 'quest' }
  | { key: string; kind: 'challenge' }
  | { key: string; kind: 'validated' }

function milestonesFor(progress: ProgressSummary): Celebration[] {
  const items: Celebration[] = [
    {
      key: `level:${progress.level.current.min}`,
      kind: 'level',
      level: progress.level.current,
    },
  ]

  const families: BadgeFamily[] = ['help', 'share', 'useful', 'streak']
  for (const family of families) {
    const badge = progress.badges[family]
    if (badge.tier) {
      items.push({
        key: `badge:${family}:${badge.tier}`,
        kind: 'badge',
        family,
        tier: badge.tier,
      })
    }
  }

  for (const specialty of progress.badges.specialties) {
    if (!specialty.tier) continue
    items.push({
      key: `specialty:${specialty.technology.toLocaleLowerCase('fr')}:${specialty.tier}`,
      kind: 'specialty',
      technology: specialty.technology,
      tier: specialty.tier,
    })
  }

  for (const badge of progress.badges.community) {
    if (badge.unlocked) {
      items.push({
        key: `community:${badge.id}`,
        kind: 'community',
        id: badge.id,
      })
    }
  }

  if (progress.quest.allDone) {
    items.push({ key: `quest:${progress.week}`, kind: 'quest' })
  }
  if (progress.challenge.badgeUnlocked) {
    items.push({ key: `challenge:${progress.week}`, kind: 'challenge' })
  }

  return items
}

function navigatorSaveData(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection
  return connection?.saveData === true
}

function defaultDataSaver(): boolean {
  try {
    const saved = localStorage.getItem(DATA_SAVER_KEY)
    if (saved === 'on') return true
    if (saved === 'off') return false
  } catch {
    // localStorage indisponible : on garde le choix du navigateur.
  }
  return navigatorSaveData()
}

function tutorialKey(userId: string): string {
  return `${TUTORIAL_KEY_PREFIX}:${userId}`
}

function tutorialDone(userId: string): boolean {
  try {
    return localStorage.getItem(tutorialKey(userId)) === 'done'
  } catch {
    return true
  }
}

function finishTutorialFor(userId: string): void {
  try {
    localStorage.setItem(tutorialKey(userId), 'done')
  } catch {
    // Le tutoriel ne doit jamais bloquer l'application.
  }
}

function seenKey(userId: string): string {
  return `${SEEN_KEY_PREFIX}:${userId}`
}

function readSeenMilestones(userId: string): string[] | null {
  try {
    const stored = localStorage.getItem(seenKey(userId))
    if (!stored) return null
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return null
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return null
  }
}

function writeSeenMilestones(userId: string, keys: string[]): void {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify(keys))
  } catch {
    // Pas de célébration persistante si le stockage est bloqué.
  }
}


const EXAMPLE_PREFIX = '[Exemple]'

function splitProjectTitle(title: string): { label: string; isExample: boolean } {
  const trimmed = title.trim()
  if (trimmed.startsWith(EXAMPLE_PREFIX)) {
    return {
      label: trimmed.slice(EXAMPLE_PREFIX.length).trim(),
      isExample: true,
    }
  }
  return { label: trimmed, isExample: false }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' }),
  )
}

/** « 14 675 » devient « 14,7 k » (ou « 14.7k » en anglais). */
function formatCompactCount(value: number, lang: Lang): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value < 1000) return String(Math.trunc(value))
  const divisor = value >= 1_000_000 ? 1_000_000 : 1000
  const rounded = Math.round((value / divisor) * 10) / 10
  const number = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', lang === 'fr' ? ',' : '.')
  const suffix =
    divisor === 1_000_000
      ? lang === 'fr'
        ? ' M'
        : 'M'
      : lang === 'fr'
        ? ' k'
        : 'k'
  return `${number}${suffix}`
}

function sameText(a: string, b: string): boolean {
  return normalizeSearchText(a) === normalizeSearchText(b)
}

const AFRICAN_CONTEXT_TAGS = [
  'Mobile Money',
  'USSD',
  'hors-ligne',
  'faible connexion',
  'SMS',
  'agriculture',
  'comptabilité',
  'devises',
  'paiement',
]

const PROJECT_CACHE_KEY = 'bondev-projects-cache-v1'

type ProjectCache = {
  savedAt: number
  projects: Project[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isCachedProject(value: unknown): value is Project {
  if (!isRecord(value) || !isRecord(value.author)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.author_id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.repo_url === 'string' &&
    typeof value.license === 'string' &&
    isStringArray(value.technologies) &&
    isStringArray(value.tags) &&
    typeof value.stars === 'number' &&
    typeof value.github_stars === 'number' &&
    typeof value.last_activity === 'string' &&
    typeof value.created_at === 'string' &&
    typeof value.author.id === 'string' &&
    typeof value.author.pseudo === 'string' &&
    typeof value.author.display_name === 'string' &&
    typeof value.author.avatar_url === 'string'
  )
}

function readProjectCache(): ProjectCache | null {
  try {
    const raw = localStorage.getItem(PROJECT_CACHE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed) ||
      typeof parsed.savedAt !== 'number' ||
      !Array.isArray(parsed.projects) ||
      !parsed.projects.every(isCachedProject)
    ) {
      return null
    }
    return { savedAt: parsed.savedAt, projects: parsed.projects }
  } catch {
    return null
  }
}

function saveProjectCache(projects: Project[], savedAt: number): void {
  try {
    localStorage.setItem(
      PROJECT_CACHE_KEY,
      JSON.stringify({ savedAt, projects }),
    )
  } catch {
    /* Le cache est un confort : l’application continue sans lui. */
  }
}


function PointsCard() {
  const { stats, statsLoading, statsError, refreshStats } = useAuth()
  const lang = useLang()
  const totalEarned = stats?.total_earned ?? 0
  const progress = levelFor(totalEarned).percent
  return (
    <section className="glass points-card">
      <div className="section-title">
        <h2>Mes points</h2>
        <span>{stats?.level ?? '—'}</span>
      </div>
      <strong>
        {stats ? stats.balance : '—'} <small>points disponibles</small>
      </strong>
      <div className="level">
        <i
          style={{
            background: `linear-gradient(90deg,#1ea7ff ${progress}%,#ffffff12 ${progress}%)`,
          }}
        />
        <span>
          {stats
            ? `${stats.total_earned} ${
                lang === 'en' ? 'earned in total' : 'gagnés au total'
              }`
            : statsLoading
              ? 'Chargement…'
              : 'Points indisponibles'}
        </span>
      </div>
      {statsError && (
        <button className="link-btn" onClick={() => void refreshStats()}>
          Réessayer
        </button>
      )}
    </section>
  )
}
function Rising() {
  return (
    <section className="glass rising">
      <div className="section-title">
        <h2>Étoiles montantes</h2>
        <span>Cette semaine</span>
      </div>
      {[
        ['FM', 'Fatou M.', '+5 points'],
        ['KA', 'Koffi A.', '+4 points'],
        ['NA', 'Nadia A.', '+3 points'],
      ].map((p, i) => (
        <div className="rising-person" key={p[1]}>
          <i>{p[0]}</i>
          <p>
            <b>{p[1]}</b>
            <span>{p[2]} cette semaine</span>
          </p>
          <em>{i + 1}</em>
        </div>
      ))}
    </section>
  )
}
function WeekCard({
  progress,
  loading,
  error,
  fromCache,
  savedAt,
  onRetry,
  onHow,
}: {
  progress: ProgressSummary | null
  loading: boolean
  error: string | null
  fromCache: boolean
  savedAt: number | null
  onRetry: () => void
  onHow: () => void
}) {
  const lang = useLang()
  const streak = progress?.streak
  return (
    <section className="glass week-card" aria-labelledby="week-title">
      <div className="week-head">
        <div>
          <span className="week-flame" aria-hidden="true">
            <Icon name="flame" size={19} />
          </span>
          <div>
            <b id="week-title">
              {lang === 'en' ? 'Your week' : 'Ta semaine'}
            </b>
            <small>
              {progress
                ? lang === 'en'
                  ? `${progress.streak.current} week${progress.streak.current > 1 ? 's' : ''} in a row`
                  : `${progress.streak.current} semaine${progress.streak.current > 1 ? 's' : ''} d’affilée`
                : lang === 'en'
                  ? 'Progress'
                  : 'Progression'}
            </small>
          </div>
        </div>
        <button className="link-btn" type="button" onClick={onHow}>
          {lang === 'en' ? 'How it works' : 'Comment ça marche'}
        </button>
      </div>

      {loading && !progress ? (
        <p className="week-state" role="status">
          {lang === 'en' ? 'Loading your progress…' : 'Chargement de ta progression…'}
        </p>
      ) : progress ? (
        <>
          <div className="week-streak">
            <span className={progress.activeThisWeek ? 'active' : ''}>
              <Icon name="flame" size={24} />
            </span>
            <p>
              <b>{progress.streak.current}</b>
              <small>
                {lang === 'en'
                  ? progress.streak.current === 1
                    ? 'consecutive week'
                    : 'consecutive weeks'
                  : progress.streak.current === 1
                    ? 'semaine consécutive'
                    : 'semaines consécutives'}
              </small>
            </p>
            <em>
              {lang === 'en'
                ? `Best: ${progress.streak.best}`
                : `Record : ${progress.streak.best}`}
            </em>
          </div>
          <ul className="week-quest">
            {progress.quest.missions.map((mission) => {
              const meta = QUEST_META[mission.id]
              return (
                <li key={mission.id} className={mission.done ? 'done' : ''}>
                  <span aria-hidden="true">
                    {mission.done && <Icon name="check" size={13} />}
                  </span>
                  <small>{meta.label[lang]}</small>
                </li>
              )
            })}
          </ul>
          <p className="week-joker">
            {progress.streak.jokersUsed > 0
              ? lang === 'en'
                ? `${progress.streak.jokersUsed} joker${progress.streak.jokersUsed > 1 ? 's' : ''} used in this streak.`
                : `${progress.streak.jokersUsed} joker${progress.streak.jokersUsed > 1 ? 's' : ''} utilisé${progress.streak.jokersUsed > 1 ? 's' : ''} dans cette série.`
              : lang === 'en'
                ? 'A joker forgives 1 missed week out of 4.'
                : 'Un joker pardonne 1 semaine manquée sur 4.'}
          </p>
          {fromCache && savedAt && (
            <small className="cache-date">
              {lang === 'en' ? 'Last update: ' : 'Dernière mise à jour : '}
              {formatDateTime(savedAt, lang)}
            </small>
          )}
        </>
      ) : (
        <div className="week-state" role="status">
          <p>{error ?? (lang === 'en' ? 'Progress unavailable' : 'Progression indisponible')}</p>
          <button className="link-btn" type="button" onClick={onRetry}>
            {lang === 'en' ? 'Try again' : 'Réessayer'}
          </button>
        </div>
      )}
    </section>
  )
}

function ImpactStrip({
  totals,
  loading,
}: {
  totals: ProgressSummary['totals'] | null
  loading: boolean
}) {
  const lang = useLang()
  const number = (value: number) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR').format(value)
  const plural = (count: number | undefined, one: string, many: string) =>
    count === 1 ? one : many
  const items = [
    {
      icon: 'check',
      value: totals?.resolvedQuestions,
      label: lang === 'en'
        ? plural(totals?.resolvedQuestions, 'question solved', 'questions solved')
        : plural(totals?.resolvedQuestions, 'question résolue', 'questions résolues'),
    },
    {
      icon: 'code',
      value: totals?.projects,
      label: lang === 'en'
        ? plural(totals?.projects, 'project shared', 'projects shared')
        : plural(totals?.projects, 'projet partagé', 'projets partagés'),
    },
    {
      icon: 'handshake',
      value: totals?.members,
      label: lang === 'en'
        ? plural(totals?.members, 'member', 'members')
        : plural(totals?.members, 'membre', 'membres'),
    },
  ]
  return (
    <section
      className="impact-strip"
      aria-label={lang === 'en' ? 'Community impact' : 'Impact de la communauté'}
      aria-live="polite"
      aria-busy={loading}
    >
      {items.map((item) => (
        <div key={item.label}>
          <span aria-hidden="true">
            <Icon name={item.icon} size={17} />
          </span>
          <b>{item.value === undefined ? '—' : number(item.value)}</b>
          <small>{item.label}</small>
        </div>
      ))}
    </section>
  )
}

function ProjectCard({
  project,
  compact = false,
  open,
  why,
}: {
  project: Project
  compact?: boolean
  open: () => void
  why?: string
}) {
  const lang = useLang()
  const { label, isExample } = splitProjectTitle(project.title)
  const technologies = project.technologies.slice(0, 2).join(' · ')
  const relativeDate = formatRelativeDate(project.last_activity, lang)
  const license =
    project.license || (lang === 'en' ? 'No licence' : 'Licence non précisée')
  const usage =
    project.stars > 0
      ? `★ ${project.stars} ${
          lang === 'en'
            ? 'useful'
            : project.stars === 1
              ? 'utile'
              : 'utiles'
        }`
      : lang === 'en'
        ? 'Not used on Bondev yet'
        : 'Pas encore utilisé sur Bondev'
  const githubStars =
    project.github_stars > 0
      ? `${formatCompactCount(project.github_stars, lang)} ${
          lang === 'en' ? 'on GitHub' : 'sur GitHub'
        }`
      : ''

  return (
    <article className={`glass project ${compact ? 'compact' : ''}`}>
      <div className="project-icon">
        <Icon name="code" />
      </div>
      <div className="project-body">
        <div className="project-heading">
          <h3>{label}</h3>
          {isExample && (
            <span className="badge-example">
              {lang === 'en' ? 'Example' : 'Exemple'}
            </span>
          )}
        </div>
        <p>
          {project.description ||
            (lang === 'en' ? 'No description yet.' : 'Pas encore de description.')}
        </p>
        {why && (
          <p className="why">
            <b>Pourquoi ce projet :</b> {why}
          </p>
        )}
        {!compact && (
          <div className="meta">
            {technologies && <span>{technologies}</span>}
            <span>{license}</span>
            {relativeDate && <span>{relativeDate}</span>}
            <span className={project.stars > 0 ? undefined : 'usage-empty'}>
              {usage}
            </span>
            {githubStars && (
              <span className="github-stars">
                <Icon name="github" size={12} /> {githubStars}
              </span>
            )}
          </div>
        )}
      </div>
      {compact ? (
        <button
          className="arrow"
          onClick={open}
          aria-label={lang === 'en' ? 'View project' : 'Voir le projet'}
        >
          <Icon name="arrow" />
        </button>
      ) : (
        <button className="secondary" onClick={open}>
          {lang === 'en' ? 'View project' : 'Voir le projet'}{' '}
          <Icon name="arrow" size={18} />
        </button>
      )}
    </article>
  )
}

function ProjectSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`glass project skeleton-project ${compact ? 'compact' : ''}`}
      aria-hidden="true"
    >
      <div className="project-icon skeleton-block" />
      <div className="project-body">
        <i className="skeleton-line wide" />
        <i className="skeleton-line" />
        <i className="skeleton-line short" />
      </div>
      {compact && <span className="skeleton-dot" />}
    </div>
  )
}

function CacheNotice({
  savedAt,
  error,
  onRetry,
}: {
  savedAt: number | null
  error: string | null
  onRetry: () => void
}) {
  const lang = useLang()
  return (
    <div className="glass cache-note" role="status">
      <Icon name="wifi" />
      <div>
        <b>
          {lang === 'en' ? 'Last update:' : 'Dernière mise à jour :'}{' '}
          {savedAt ? formatDateTime(savedAt, lang) : '—'}
        </b>
        <span>
          {error ||
            (lang === 'en'
              ? 'The catalogue is shown from this device.'
              : 'Le catalogue est affiché depuis cet appareil.')}
        </span>
      </div>
      <button className="link-btn" onClick={onRetry} type="button">
        {lang === 'en' ? 'Try again' : 'Réessayer'}
      </button>
    </div>
  )
}

function CatalogueError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const lang = useLang()
  return (
    <section className="glass empty catalogue-error" role="status">
      <div>
        <Icon name="wifi" size={30} />
      </div>
      <h2>
        {lang === 'en' ? 'The catalogue is unavailable' : 'Le catalogue est indisponible'}
      </h2>
      <p>{message}</p>
      <button className="secondary catalogue-retry" onClick={onRetry}>
        <Icon name="refresh" size={18} />{' '}
        {lang === 'en' ? 'Try again' : 'Réessayer'}
      </button>
    </section>
  )
}
function Login() {
  const {
    signInWithGitHub,
    signInWithGoogle,
    signInWithEmail,
    signInAnonymously,
    authNotice,
    setAuthNotice,
  } = useAuth()
  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<
    'github' | 'google' | 'email' | 'guest' | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleGitHub = async () => {
    setError(null)
    setAuthNotice(null)
    setBusy('github')
    const result = await signInWithGitHub()
    if (result.error) {
      setError(result.error)
      setBusy(null)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setAuthNotice(null)
    setBusy('google')
    const result = await signInWithGoogle()
    if (result.error) {
      setError(result.error)
      setBusy(null)
    }
  }

  const handleEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setAuthNotice(null)
    setBusy('email')
    const result = await signInWithEmail(email)
    if (result.error) {
      setError(result.error)
      setBusy(null)
      return
    }
    setBusy(null)
    setSent(true)
  }

  const handleGuest = async () => {
    setError(null)
    setAuthNotice(null)
    setBusy('guest')
    const result = await signInAnonymously()
    if (result.error) {
      setError(result.error)
      setBusy(null)
    }
  }

  return (
    <main className="login">
      <div className="login-theme">
        <LangToggle />
        <ThemeToggle />
      </div>
      <section className="login-brand">
        <img
          src="/assets/bondev-logo-192.webp"
          srcSet="/assets/bondev-logo-192.webp 192w, /assets/bondev-logo-384.webp 384w"
          sizes="164px"
          width={192}
          height={192}
          alt="Logo Bondev, deux personnes qui s'entraident"
        />
        <h1>Bondev</h1>
        <p>Ensemble, on va plus loin</p>
      </section>
      <section className="login-actions">
        <Primary
          onClick={() => void handleGitHub()}
          icon="github"
          disabled={busy !== null}
        >
          Continuer avec GitHub
        </Primary>
        {import.meta.env.VITE_ENABLE_GOOGLE === 'true' && (
          <button
            className="google-btn"
            onClick={() => void handleGoogle()}
            disabled={busy !== null}
            type="button"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.4 14.4a7.2 7.2 0 0 1 0-4.8V6.5H1.4a12 12 0 0 0 0 11z"
              />
              <path
                fill="#EA4335"
                d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
              />
            </svg>
            Continuer avec Google
          </button>
        )}
        {sent ? (
          <div className="login-success" role="status">
            <Icon name="mail" size={30} />
            <b>Vérifie ta boîte mail</b>
            <p>Le lien peut prendre une minute. Pense à vérifier tes spams.</p>
            <button
              className="textbtn"
              onClick={() => {
                setSent(false)
                setError(null)
              }}
              type="button"
            >
              Utiliser une autre adresse
            </button>
          </div>
        ) : emailOpen ? (
          <form className="email-form" onSubmit={handleEmail}>
            <label className="email-label" htmlFor="login-email">
              Ton adresse email
            </label>
            <input
              id="login-email"
              className="text-input"
              type="email"
              autoComplete="email"
              required
              placeholder="ton@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy !== null}
            />
            <button
              className="email-btn"
              type="submit"
              disabled={busy !== null}
            >
              <Icon name="mail" />
              {busy === 'email' ? 'Envoi…' : 'Envoyer le lien'}
            </button>
            <p className="email-hint">
              Envoie un lien de connexion à ton adresse email.
            </p>
          </form>
        ) : (
          <button
            className="email-btn"
            onClick={() => {
              setEmailOpen(true)
              setError(null)
            }}
            disabled={busy !== null}
            type="button"
          >
            <Icon name="mail" />
            Utiliser mon email
          </button>
        )}
        <button
          className="email-btn guest-login-btn"
          onClick={() => void handleGuest()}
          disabled={busy !== null}
          type="button"
        >
          <Icon name="user" />
          Essayer sans compte
        </button>
        {(error || authNotice) && (
          <p className="login-error" role="alert">
            {error ?? authNotice}
          </p>
        )}
        {!sent && <small>Trouve. Partage. Avance.</small>}
      </section>
    </main>
  )
}
function Home({
  go,
  projects,
  loading,
  error,
  fromCache,
  savedAt,
  onRetry,
  onSearch,
  openProject,
  progress,
  progressLoading,
  progressError,
  progressFromCache,
  progressSavedAt,
  onProgressRetry,
  onHow,
}: {
  go: (s: Screen) => void
  projects: Project[] | null
  loading: boolean
  error: string | null
  fromCache: boolean
  savedAt: number | null
  onRetry: () => void
  onSearch: (query: string) => void
  openProject: (project: Project, from: Screen) => void
  progress: ProgressSummary | null
  progressLoading: boolean
  progressError: string | null
  progressFromCache: boolean
  progressSavedAt: number | null
  onProgressRetry: () => void
  onHow: () => void
}) {
  const { profile } = useAuth()
  const lang = useLang()
  const [draft, setDraft] = useState('')
  const greetingName =
    profile?.display_name.trim() ||
    profile?.pseudo ||
    (lang === 'en' ? 'developer' : 'développeur')
  const recent = projects?.slice(0, 3) ?? []
  const suggestions = [
    'Mobile Money',
    'Gestion de stock',
    'Fonctionne hors-ligne',
  ]

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSearch(draft.trim())
  }

  return (
    <main className="screen">
      <Header logo />
      <div className="home-layout">
        <div className="home-main">
          <section className="hero">
            <p className="eyebrow">
              {lang === 'en' ? 'Hello' : 'Bonjour'}, {greetingName}
            </p>
            <h1>
              Que veux-tu <span>construire ?</span>
            </h1>
            <form className="searchbox search-form" onSubmit={submit}>
              <Icon name="search" />
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Décris ton besoin : ex. gérer le stock d’une boutique"
                aria-label={
                  lang === 'en'
                    ? 'Search the project catalogue'
                    : 'Rechercher dans le catalogue'
                }
              />
              <kbd>Ctrl + K</kbd>
              <button
                type="submit"
                className="search-submit"
                aria-label={lang === 'en' ? 'Search' : 'Rechercher'}
              >
                <Icon name="arrow" size={18} />
              </button>
            </form>
            <p className="smart">
              ✦ Recherche intelligente : décris ton besoin avec tes mots
            </p>
            <div className="chips-wrap">
              <div className="chips">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => onSearch(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <WeekCard
            progress={progress}
            loading={progressLoading}
            error={progressError}
            fromCache={progressFromCache}
            savedAt={progressSavedAt}
            onRetry={onProgressRetry}
            onHow={onHow}
          />
          <ImpactStrip
            totals={progress?.totals ?? null}
            loading={progressLoading}
          />
          <div className="tablet-cards">
            <PointsCard />
            <Rising />
          </div>
          {fromCache && projects && (
            <CacheNotice savedAt={savedAt} error={error} onRetry={onRetry} />
          )}
          <section className="section">
            <div className="section-title">
              <h2>Projets récents</h2>
              <button onClick={() => onSearch('')} type="button">
                Tout voir
              </button>
            </div>
            {loading && !projects ? (
              <div className="list project-grid">
                {[0, 1, 2].map((item) => (
                  <ProjectSkeleton key={item} compact />
                ))}
              </div>
            ) : recent.length > 0 ? (
              <div className="list project-grid">
                {recent.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    compact
                    open={() => openProject(project, 'home')}
                  />
                ))}
              </div>
            ) : error && !projects ? (
              <CatalogueError message={error} onRetry={onRetry} />
            ) : (
              <section className="glass empty catalogue-empty">
                <div>
                  <Icon name="code" size={30} />
                </div>
                <h2>
                  {lang === 'en'
                    ? 'No projects yet'
                    : 'Aucun projet pour le moment'}
                </h2>
                <p>
                  {lang === 'en'
                    ? 'Share the first project with the community.'
                    : 'Partage le premier projet avec la communauté.'}
                </p>
                <button className="secondary" onClick={() => go('share')}>
                  {lang === 'en' ? 'Share a project' : 'Partager un projet'}
                </button>
              </section>
            )}
          </section>
        </div>
        <aside className="home-aside">
          <PointsCard />
          <Rising />
        </aside>
      </div>
    </main>
  )
}
type FilterOption = {
  value: string
  /** Nombre de projets qui utilisent cette option, quand c'est pertinent. */
  count?: number
}

type FilterGroup = {
  title: string
  options: FilterOption[]
  selected: string[]
  onToggle: (value: string) => void
  /** Nombre d'options visibles avant le bouton « Voir plus ». */
  limit?: number
}

function FilterGroupSection({ group }: { group: FilterGroup }) {
  const [expanded, setExpanded] = useState(false)
  const limit = group.limit ?? group.options.length
  const hasMore = group.options.length > limit
  const visibleOptions =
    hasMore && !expanded
      ? group.options.filter(
          (option, index) =>
            index < limit || group.selected.includes(option.value),
        )
      : group.options

  return (
    <fieldset>
      <legend>{group.title}</legend>
      {group.options.length === 0 ? (
        <small className="filter-empty">Aucune option</small>
      ) : (
        visibleOptions.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={group.selected.includes(option.value)}
              onChange={() => group.onToggle(option.value)}
            />
            <span>{option.value}</span>
            {typeof option.count === 'number' && (
              <small className="filter-count">{option.count}</small>
            )}
          </label>
        ))
      )}
      {hasMore && (
        <button
          className="link-btn filter-more"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? 'Voir moins' : 'Voir plus'}
        </button>
      )}
    </fieldset>
  )
}

function Filters({
  groups,
  activeCount,
  onReset,
}: {
  groups: FilterGroup[]
  activeCount: number
  onReset: () => void
}) {
  return (
    <aside className="glass filters">
      <div className="filter-heading">
        <h2>Filtres</h2>
        {activeCount > 0 && (
          <button className="link-btn" onClick={onReset} type="button">
            Réinitialiser
          </button>
        )}
      </div>
      {groups.map((group) => (
        <FilterGroupSection key={group.title} group={group} />
      ))}
    </aside>
  )
}
function Results({
  go,
  query,
  setQuery,
  projects,
  loading,
  error,
  fromCache,
  savedAt,
  onRetry,
  openProject,
}: {
  go: (s: Screen) => void
  query: string
  setQuery: (value: string) => void
  projects: Project[] | null
  loading: boolean
  error: string | null
  fromCache: boolean
  savedAt: number | null
  onRetry: () => void
  openProject: (project: Project, from: Screen) => void
}) {
  const lang = useLang()
  const [filters, setFilters] = useState(false)
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([])
  const [selectedLicenses, setSelectedLicenses] = useState<string[]>([])
  const [selectedContexts, setSelectedContexts] = useState<string[]>([])

  /**
   * Les technologies sont regroupées sans tenir compte de la casse, puis
   * classées par nombre de projets. Seules les 12 premières sont visibles
   * tant que l'utilisateur n'a pas cliqué sur « Voir plus ».
   */
  const technologyOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, { value: string; count: number }>()
    for (const project of projects ?? []) {
      const seen = new Set<string>()
      for (const raw of project.technologies) {
        const value = raw.trim()
        if (!value) continue
        const key = normalizeSearchText(value)
        if (!key || seen.has(key)) continue
        seen.add(key)
        const existing = counts.get(key)
        if (existing) existing.count += 1
        else counts.set(key, { value, count: 1 })
      }
    }
    return [...counts.values()]
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.value.localeCompare(b.value, 'fr', { sensitivity: 'base' }),
      )
      .map(({ value, count }) => ({ value, count }))
  }, [projects])
  const availableLicenses = useMemo(
    () =>
      uniqueSorted((projects ?? []).map((project) => project.license)).map(
        (value) => ({ value }),
      ),
    [projects],
  )
  const availableContexts = useMemo(() => {
    const tags = (projects ?? []).flatMap((project) => project.tags)
    return AFRICAN_CONTEXT_TAGS.filter((context) =>
      tags.some((tag) => sameText(tag, context)),
    ).map((value) => ({ value }))
  }, [projects])

  const outcome = useMemo(
    () => searchProjects(projects ?? [], query),
    [projects, query],
  )

  const visible = useMemo(
    () =>
      outcome.results.filter(({ project }) => {
        const technologyOk =
          selectedTechnologies.length === 0 ||
          selectedTechnologies.some((technology) =>
            project.technologies.some((item) => sameText(item, technology)),
          )
        const licenseOk =
          selectedLicenses.length === 0 ||
          selectedLicenses.some((license) =>
            sameText(project.license, license),
          )
        const contextOk =
          selectedContexts.length === 0 ||
          selectedContexts.some((context) =>
            project.tags.some((tag) => sameText(tag, context)),
          )
        return technologyOk && licenseOk && contextOk
      }),
    [outcome.results, selectedTechnologies, selectedLicenses, selectedContexts],
  )

  const activeFilterCount =
    selectedTechnologies.length +
    selectedLicenses.length +
    selectedContexts.length

  const toggle = (
    setter: (updater: (current: string[]) => string[]) => void,
  ) => (value: string) => {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    )
  }

  const resetFilters = () => {
    setSelectedTechnologies([])
    setSelectedLicenses([])
    setSelectedContexts([])
  }

  const count = visible.length
  const title =
    loading && !projects
      ? lang === 'en'
        ? 'Catalogue'
        : 'Catalogue'
      : lang === 'en'
        ? `${count} project${count === 1 ? '' : 's'} found`
        : `${count} projet${count === 1 ? '' : 's'} trouvé${count === 1 ? '' : 's'}`

  const understood = lang === 'en' ? outcome.understoodEn : outcome.understood

  return (
    <main className="screen">
      <Header title={title} back={() => go('home')} />
      <form
        className="query glass"
        onSubmit={(event) => event.preventDefault()}
      >
        <Icon name="search" size={20} />
        <input
          id="catalogue-search"
          className="query-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Décris ton besoin : ex. gérer le stock d’une boutique"
          aria-label={
            lang === 'en'
              ? 'Search the project catalogue'
              : 'Rechercher dans le catalogue'
          }
        />
        {query && (
          <button
            className="query-clear"
            onClick={() => setQuery('')}
            type="button"
            aria-label={lang === 'en' ? 'Clear search' : 'Effacer la recherche'}
          >
            <Icon name="close" size={16} />
          </button>
        )}
        <button
          className="filter-trigger"
          onClick={() => setFilters(true)}
          type="button"
        >
          {lang === 'en' ? 'Filters' : 'Filtres'}
          {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </form>
      {query.trim() && understood && (
        <section className="glass understood">
          <b>✦ Bondev a compris :</b> {understood}
        </section>
      )}
      {fromCache && projects && (
        <CacheNotice savedAt={savedAt} error={error} onRetry={onRetry} />
      )}
      <div className="results-layout">
        <div className={`filter-panel ${filters ? 'open' : ''}`}>
          <button
            className="filter-close"
            onClick={() => setFilters(false)}
            type="button"
          >
            {lang === 'en' ? 'Close' : 'Fermer'}
          </button>
          <Filters
            groups={[
              {
                title: 'Technologie',
                options: technologyOptions,
                selected: selectedTechnologies,
                onToggle: toggle(setSelectedTechnologies),
                limit: 12,
              },
              {
                title: 'Licence',
                options: availableLicenses,
                selected: selectedLicenses,
                onToggle: toggle(setSelectedLicenses),
              },
              {
                title: 'Contexte africain',
                options: availableContexts,
                selected: selectedContexts,
                onToggle: toggle(setSelectedContexts),
              },
            ]}
            activeCount={activeFilterCount}
            onReset={resetFilters}
          />
        </div>
        <div>
          {loading && !projects ? (
            <div className="list results" aria-busy="true">
              {[0, 1, 2, 3].map((item) => (
                <ProjectSkeleton key={item} />
              ))}
            </div>
          ) : !projects && error ? (
            <CatalogueError message={error} onRetry={onRetry} />
          ) : visible.length > 0 ? (
            <div className="list results">
              {visible.map((result) => (
                <ProjectCard
                  key={result.project.id}
                  project={result.project}
                  why={lang === 'en' ? result.whyEn : result.why}
                  open={() => openProject(result.project, 'results')}
                />
              ))}
            </div>
          ) : outcome.results.length > 0 && activeFilterCount > 0 ? (
            <section className="glass empty results-empty">
              <div>
                <Icon name="search" size={30} />
              </div>
              <h2>
                {lang === 'en'
                  ? 'No projects match these filters'
                  : 'Aucun projet ne correspond à ces filtres'}
              </h2>
              <p>
                {lang === 'en'
                  ? 'Remove a filter or try another combination.'
                  : 'Retire un filtre ou essaie une autre combinaison.'}
              </p>
              <button className="secondary" onClick={resetFilters}>
                {lang === 'en' ? 'Reset filters' : 'Réinitialiser les filtres'}
              </button>
            </section>
          ) : (
            <section className="glass empty results-empty">
              <div>
                <Icon name="search" size={30} />
              </div>
              <h2>
                {lang === 'en'
                  ? 'Nothing matches yet'
                  : 'Rien ne correspond pour l’instant'}
              </h2>
              <p>
                {lang === 'en'
                  ? 'Try simpler words, or ask a developer for help.'
                  : 'Essaie des mots plus simples, ou demande de l’aide à un développeur.'}
              </p>
            </section>
          )}
          {projects && (
            <p className="catalog-note">
              {lang === 'en'
                ? 'Results chosen from the catalogue projects.'
                : 'Résultats choisis parmi les projets du catalogue.'}
            </p>
          )}
          <section className="glass help-cta">
            <div className="help-icon">
              <Icon name="handshake" size={30} />
            </div>
            <div>
              <h2>{lang === 'en' ? 'Nothing fits?' : 'Rien ne convient ?'}</h2>
              <p>
                {lang === 'en'
                  ? 'A developer can help you.'
                  : 'Un développeur peut t’aider.'}
              </p>
            </div>
            <Primary onClick={() => go('add')}>
              {lang === 'en' ? 'Ask for help' : 'Demander de l’aide'}
            </Primary>
          </section>
        </div>
      </div>
    </main>
  )
}
function ProjectDetail({
  project,
  loading,
  error,
  back,
  onRetry,
  onUsed,
}: {
  project: Project | null
  loading: boolean
  error: string | null
  back: () => void
  onRetry: () => void
  onUsed: (projectId: string) => void
}) {
  const { user, isGuest } = useAuth()
  const lang = useLang()
  const [busy, setBusy] = useState(false)
  const [used, setUsed] = useState(false)
  const [celebration, setCelebration] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [guestNotice, setGuestNotice] = useState(false)
  const projectId = project?.id

  useEffect(() => {
    setUsed(false)
    setCelebration(false)
    setActionError(null)
    setGuestNotice(false)
  }, [projectId])

  useEffect(() => {
    if (!celebration) return
    const timer = window.setTimeout(() => setCelebration(false), 5000)
    return () => window.clearTimeout(timer)
  }, [celebration])

  if (!project) {
    return (
      <main className="screen">
        <Header title="Projet" back={back} />
        {loading ? (
          <ProjectSkeleton />
        ) : error ? (
          <CatalogueError message={error} onRetry={onRetry} />
        ) : (
          <section className="glass empty catalogue-empty">
            <div>
              <Icon name="search" size={30} />
            </div>
            <h2>
              {lang === 'en' ? 'Project not found' : 'Projet introuvable'}
            </h2>
            <p>
              {lang === 'en'
                ? 'It may have been removed from the catalogue.'
                : 'Il a peut-être été retiré du catalogue.'}
            </p>
            <button className="secondary" onClick={back}>
              {lang === 'en' ? 'Back to results' : 'Retour aux résultats'}
            </button>
          </section>
        )}
      </main>
    )
  }

  const { label, isExample } = splitProjectTitle(project.title)
  const authorName =
    project.author.display_name.trim() ||
    project.author.pseudo ||
    (lang === 'en' ? 'Bondev developer' : 'Développeur Bondev')
  const authorPseudo = project.author.pseudo
  const avatar = project.author.avatar_url.startsWith('https://')
    ? project.author.avatar_url
    : ''
  const isOwner = user?.id === project.author_id
  const connected = Boolean(user)
  const relativeDate = formatRelativeDate(project.last_activity, lang)
  const canUse = connected && !isOwner && !used && !busy
  const repoLink = project.repo_url.startsWith('https://')
    ? project.repo_url
    : ''

  const handleUsed = async () => {
    if (isGuest) {
      // Le bouton reste visible : on explique la règle sans appeler l'API.
      setGuestNotice(true)
      return
    }
    if (!canUse) return
    setBusy(true)
    setActionError(null)
    try {
      await markProjectUsed(project.id)
      setUsed(true)
      setCelebration(true)
      onUsed(project.id)
      notifyProgressChanged()
    } catch (cause) {
      const message = toFrenchError(cause)
      setActionError(message)
      if (message === 'Tu as déjà marqué ce projet comme utile.') {
        setUsed(true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen project-screen">
      <Header title="Projet" back={back} />
      <article className="project-detail">
        <section className="glass project-hero-card">
          <div className="project-icon project-icon-large">
            <Icon name="code" size={28} />
          </div>
          <div>
            <div className="project-heading">
              <h1>{label}</h1>
              {isExample && (
                <span className="badge-example">
                  {lang === 'en' ? 'Example' : 'Exemple'}
                </span>
              )}
            </div>
            <div className="author-line compact-author">
              <span>
                {avatar ? (
                  <img src={avatar} alt="" />
                ) : (
                  initialsFor(authorName, authorPseudo)
                )}
              </span>
              <p>
                <b>{authorName}</b>
                <small>{authorPseudo ? `@${authorPseudo}` : ''}</small>
              </p>
            </div>
          </div>
        </section>

        <section className="glass project-info">
          <p className="project-description">
            {project.description ||
              (lang === 'en' ? 'No description yet.' : 'Pas encore de description.')}
          </p>

          {project.technologies.length > 0 && (
            <div className="tag-list" aria-label="Technologies">
              {project.technologies.map((technology) => (
                <span key={technology}>{technology}</span>
              ))}
            </div>
          )}

          {project.tags.length > 0 && (
            <div className="tag-list tags" aria-label="Tags">
              {project.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          )}

          <div className="project-facts">
            <div>
              <Icon name="clock" size={20} />
              <b>{relativeDate || '—'}</b>
              <span>Dernière activité</span>
            </div>
            <div>
              <Icon name="star" size={20} />
              <b>{project.stars > 0 ? `★ ${project.stars}` : '—'}</b>
              <span>{lang === 'en' ? 'Useful on Bondev' : 'Utiles sur Bondev'}</span>
            </div>
            <div>
              <Icon name="code" size={20} />
              <b>{project.license || '—'}</b>
              <span>Licence</span>
            </div>
          </div>

          <p className="usage-line">
            {project.stars > 0 ? (
              <>
                {lang === 'en' ? 'Used by' : 'Utilisé par'}{' '}
                <b>
                  {project.stars} dev{project.stars === 1 ? '' : 's'}
                </b>
              </>
            ) : lang === 'en' ? (
              'Not used on Bondev yet'
            ) : (
              'Pas encore utilisé sur Bondev'
            )}
          </p>
          {project.github_stars > 0 && (
            <p className="github-stars-line">
              <Icon name="github" size={16} />{' '}
              <b>{formatCompactCount(project.github_stars, lang)}</b>{' '}
              {lang === 'en' ? 'on GitHub' : 'sur GitHub'}
            </p>
          )}

          <div className="project-actions">
            {repoLink && (
              <a
                className="primary repo-link"
                href={repoLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="github" size={20} />{' '}
                {lang === 'en' ? 'View repository' : 'Voir le dépôt'}
              </a>
            )}
            <button
              className="secondary served-btn"
              onClick={() => void handleUsed()}
              disabled={!canUse}
              type="button"
            >
              <Icon name="check" size={18} />{' '}
              {busy
                ? lang === 'en'
                  ? 'Saving…'
                  : 'Enregistrement…'
                : used
                  ? lang === 'en'
                    ? 'Already marked ✓'
                    : 'Déjà marqué ✓'
                  : lang === 'en'
                    ? 'This helped me ✓'
                    : 'Ça m’a servi ✓'}
            </button>
          </div>

          {isGuest && guestNotice && (
            <p className="disabled-reason guest-reason" role="status">
              {GUEST_USED_EXPLANATION}
            </p>
          )}
          {!connected && (
            <p className="disabled-reason">
              {lang === 'en'
                ? 'Sign in to say that this project helped you.'
                : 'Connecte-toi pour dire que ce projet t’a servi.'}
            </p>
          )}
          {isOwner && (
            <p className="disabled-reason">
              {lang === 'en'
                ? 'This is your project: another developer must mark it as useful.'
                : 'C’est ton projet : seul un autre développeur peut le marquer comme utile.'}
            </p>
          )}
          {used && !isOwner && (
            <p className="disabled-reason success-reason">
              {lang === 'en'
                ? 'Thanks! Your click has already been counted.'
                : 'Merci ! Ton clic a déjà été compté.'}
            </p>
          )}
          {actionError && (
            <p className="inline-error" role="alert">
              {actionError}
            </p>
          )}
          {celebration && (
            <div className="glass celebration" role="status">
              <span aria-hidden="true">✦</span>
              <div>
                <b>{lang === 'en' ? 'Thank you!' : 'Merci !'}</b>
                <p>
                  {lang === 'en'
                    ? `Your click helps ${authorName} and moves the project forward.`
                    : `Ton clic aide ${authorName} et fait avancer le projet.`}
                </p>
              </div>
            </div>
          )}
        </section>
      </article>
    </main>
  )
}




function celebrationContent(
  item: Celebration,
  lang: Lang,
): { title: string; body: string; icon: string } {
  if (item.kind === 'level') {
    return {
      icon: 'trophy',
      title: lang === 'en' ? 'New level!' : 'Nouveau niveau !',
      body:
        lang === 'en'
          ? `You are now ${item.level.nameEn}.`
          : `Tu es maintenant ${item.level.name}.`,
    }
  }
  if (item.kind === 'badge') {
    return {
      icon: BADGE_FAMILY_META[item.family].icon,
      title:
        lang === 'en'
          ? `${tierName(item.tier, lang)} badge unlocked`
          : `Badge ${tierName(item.tier, lang)} débloqué`,
      body: familyLabel(item.family, lang),
    }
  }
  if (item.kind === 'specialty') {
    return {
      icon: 'code',
      title: `Expert ${item.technology}`,
      body:
        lang === 'en'
          ? `${tierName(item.tier, lang)} specialty unlocked.`
          : `Spécialité ${tierName(item.tier, lang)} débloquée.`,
    }
  }
  if (item.kind === 'community') {
    return {
      icon: COMMUNITY_META[item.id].icon,
      title: COMMUNITY_META[item.id].title[lang],
      body: COMMUNITY_META[item.id].description[lang],
    }
  }
  if (item.kind === 'quest') {
    return {
      icon: 'target',
      title: lang === 'en' ? 'Quest complete!' : 'Quête terminée !',
      body:
        lang === 'en'
          ? 'All three missions are done for this week.'
          : 'Les trois missions de la semaine sont faites.',
    }
  }
  if (item.kind === 'validated') {
    return {
      icon: 'check',
      title: lang === 'en' ? 'Answer validated!' : 'Réponse validée !',
      body:
        lang === 'en'
          ? 'The held points were sent and your progress has been updated.'
          : 'Les points mis de côté ont été envoyés et ta progression est à jour.',
    }
  }
  return {
    icon: 'flame',
    title:
      lang === 'en' ? 'Weekly challenge won!' : 'Défi de la semaine réussi !',
    body:
      lang === 'en'
        ? 'The community solved 10 questions this week.'
        : 'La communauté a résolu 10 questions cette semaine.',
  }
}

function CelebrationToast({
  item,
  onClose,
}: {
  item: Celebration
  onClose: () => void
}) {
  const lang = useLang()
  const content = celebrationContent(item, lang)

  useEffect(() => {
    const timer = window.setTimeout(onClose, 6000)
    return () => window.clearTimeout(timer)
  }, [item.key, onClose])

  return (
    <div className="celebration-layer" role="status" aria-live="polite">
      <section className="celebration-toast">
        <span className="celebration-icon" aria-hidden="true">
          <Icon name={content.icon} size={26} />
        </span>
        <div>
          <b>{content.title}</b>
          <p>{content.body}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={lang === 'en' ? 'Close' : 'Fermer'}
        >
          <Icon name="close" size={16} />
        </button>
      </section>
    </div>
  )
}

function Tutorial({ onDone }: { onDone: () => void }) {
  const lang = useLang()
  const [step, setStep] = useState(0)
  const steps = [
    {
      icon: 'flame',
      title: lang === 'en' ? 'Progress at your pace' : 'Progresse à ton rythme',
      body:
        lang === 'en'
          ? 'Your level depends on the points you have earned since you joined. It never goes down, even when you spend points.'
          : 'Ton niveau dépend des points gagnés depuis ton arrivée. Il ne baisse jamais, même quand tu dépenses des points.',
    },
    {
      icon: 'handshake',
      title: lang === 'en' ? 'Build your streak' : 'Construis ta série',
      body:
        lang === 'en'
          ? 'One useful action per week keeps your streak alive: an answer, a validated answer, a project or a “This helped me”. A joker can forgive one missed week.'
          : 'Une action utile par semaine garde ta série : une réponse, une validation, un projet ou un « Ça m’a servi ». Un joker peut pardonner une semaine manquée.',
    },
    {
      icon: 'target',
      title: lang === 'en' ? 'Quests and badges' : 'Quêtes et badges',
      body:
        lang === 'en'
          ? 'Complete three missions each week, help the community solve 10 questions, and unlock bronze, silver and gold badges.'
          : 'Accomplis trois missions chaque semaine, aide la communauté à résoudre 10 questions et débloque des badges bronze, argent et or.',
    },
  ]
  const current = steps[step]
  const last = step === steps.length - 1

  const finish = () => onDone()

  return (
    <div
      className="tutorial-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <section className="tutorial-card">
        <div className="tutorial-top">
          <span>
            {step + 1} / {steps.length}
          </span>
          <button type="button" className="link-btn" onClick={finish}>
            {lang === 'en' ? 'Skip' : 'Passer'}
          </button>
        </div>
        <span className="tutorial-icon" aria-hidden="true">
          <Icon name={current.icon} size={34} />
        </span>
        <h2 id="tutorial-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="tutorial-dots" aria-hidden="true">
          {steps.map((item, index) => (
            <i key={item.title} className={index === step ? 'active' : ''} />
          ))}
        </div>
        <div className="tutorial-actions">
          {step > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setStep((value) => value - 1)}
            >
              {lang === 'en' ? 'Back' : 'Retour'}
            </button>
          )}
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (last) finish()
              else setStep((value) => value + 1)
            }}
          >
            {last
              ? lang === 'en'
                ? 'Start'
                : 'C’est parti'
              : lang === 'en'
                ? 'Next'
                : 'Suivant'}
          </button>
        </div>
      </section>
    </div>
  )
}


function States({ go }: { go: (s: Screen) => void }) {
  return (
    <main className="screen">
      <Header title="États" back={() => go('profile')} />
      <section className="states">
        <div className="offline">
          <Icon name="wifi" />
          <span>
            <b>Hors-ligne</b> · Tes demandes partiront dès que le réseau
            revient.
          </span>
        </div>
        <div className="glass empty">
          <div>
            <Icon name="check" size={32} />
          </div>
          <h2>Tout est calme</h2>
          <p>
            Aucune demande pour le moment.
            <br />
            Reviens bientôt pour aider.
          </p>
        </div>
      </section>
    </main>
  )
}
function Nav({
  active,
  go,
  onAdd,
  pinned,
  setPinned,
}: {
  active: Screen
  go: (s: Screen) => void
  onAdd: () => void
  pinned: boolean
  setPinned: (v: boolean) => void
}) {
  const [peek, setPeek] = useState(false)
  const timer = useRef<number>(0)
  const pick = (f: () => void) => () => {
    if (window.innerWidth < 1025) setPinned(false)
    setPeek(false)
    f()
  }
  const items: [Screen, string, string][] = [
    ['home', 'home', 'Accueil'],
    ['help', 'handshake', 'Entraide'],
    ['add', 'plus', 'Ajouter'],
    ['profile', 'user', 'Profil'],
    ['how', 'book', 'Règles'],
  ]
  return (
    <nav
      className={`nav ${peek ? 'peek' : ''}`}
      aria-label="Navigation principale"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') {
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setPeek(true), 90)
        }
      }}
      onPointerLeave={() => {
        window.clearTimeout(timer.current)
        setPeek(false)
      }}
    >
      <div className="nav-logo">
        <img
          src="/assets/bondev-logo-96.webp"
          srcSet="/assets/bondev-logo-48.webp 48w, /assets/bondev-logo-96.webp 96w"
          sizes="48px"
          width={96}
          height={96}
          alt="Bondev"
        />
        <b>Bondev</b>
      </div>
      {items.map((x) => (
        <button
          key={x[0]}
          className={
            active === x[0] ||
            ((active === 'results' || active === 'project') && x[0] === 'home') ||
            (active === 'question' && x[0] === 'help') ||
            (active === 'share' && x[0] === 'add')
              ? 'active'
              : ''
          }
          onClick={pick(() => (x[0] === 'add' ? onAdd() : go(x[0])))}
        >
          <span className={x[0] === 'add' ? 'add' : ''}>
            <Icon name={x[1]} />
          </span>
          <small>{x[2]}</small>
        </button>
      ))}
      <PointsCard />
      <button className="states-link" onClick={() => go('states')}>
        Voir les états
      </button>
      <AccountLangToggle compact />
      <button
        className="nav-toggle"
        onClick={() => setPinned(!pinned)}
        aria-expanded={pinned}
        aria-label={pinned ? 'Réduire le menu' : 'Garder le menu ouvert'}
      >
        <span>
          <Icon name="menu" />
        </span>
        <i className="nav-chev">
          <Icon name="arrow" size={18} />
        </i>
      </button>
    </nav>
  )
}
function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true" aria-live="polite">
      <img
        src="/assets/bondev-logo-192.webp"
        width={192}
        height={192}
        alt=""
      />
      <div className="spinner" aria-hidden="true" />
      <p>Chargement de ta session…</p>
    </main>
  )
}
export default function App() {
  const { session, loading, profileError } = useAuth()
  const [screen, setScreen] = useState<Screen>('login')
  const [sheet, setSheet] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeSheet = (after?: () => void) => {
    setClosing(true)
    window.setTimeout(() => {
      setSheet(false)
      setClosing(false)
      after?.()
    }, 280)
  }
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [projectsFromCache, setProjectsFromCache] = useState(false)
  const [projectsSavedAt, setProjectsSavedAt] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  )
  const [detailFrom, setDetailFrom] = useState<Screen>('results')
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null,
  )
  const [progressResult, setProgressResult] = useState<ProgressResult | null>(
    null,
  )
  const [progressUserId, setProgressUserId] = useState<string | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressError, setProgressError] = useState<string | null>(null)
  const progressRequest = useRef(0)
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const [tutorial, setTutorial] = useState(false)
  const [dataSaver, setDataSaver] = useState(defaultDataSaver)

  const userId = session?.user.id

  const loadProgress = useCallback(async () => {
    if (!userId) return
    const request = progressRequest.current + 1
    progressRequest.current = request
    setProgressLoading(true)
    setProgressError(null)
    try {
      const result = await getProgress()
      if (request !== progressRequest.current) return
      setProgressResult(result)
      setProgressUserId(userId)
    } catch (cause) {
      if (request !== progressRequest.current) return
      setProgressError(toFrenchError(cause))
    } finally {
      if (request === progressRequest.current) setProgressLoading(false)
    }
  }, [userId])

  useEffect(() => {
    progressRequest.current += 1
    setCelebrations([])
    setProgressResult(null)
    setProgressUserId(null)
    setProgressError(null)
    if (!userId) {
      setProgressLoading(false)
      return
    }
    setProgressLoading(true)
    void loadProgress()
  }, [userId, loadProgress])

  useEffect(() => {
    if (!userId) return
    let timer = 0
    const refresh = (event: Event) => {
      if (
        event instanceof CustomEvent &&
        (event.detail as ProgressEventDetail | undefined)?.celebration ===
          'validated'
      ) {
        setCelebrations((queue) => [
          ...queue,
          { key: `validated:${Date.now()}`, kind: 'validated' },
        ])
      }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void loadProgress(), 350)
    }
    window.addEventListener(PROGRESS_EVENT, refresh)
    window.addEventListener('online', refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(PROGRESS_EVENT, refresh)
      window.removeEventListener('online', refresh)
    }
  }, [userId, loadProgress])

  useEffect(() => {
    if (!userId || !progressResult || progressUserId !== userId) return
    const milestones = milestonesFor(progressResult.progress)
    const currentKeys = milestones.map((milestone) => milestone.key)
    const seen = readSeenMilestones(userId)

    if (seen === null) {
      // Premier chargement : on enregistre l'état de départ sans célébrer.
      writeSeenMilestones(userId, currentKeys)
      return
    }

    const seenSet = new Set(seen)
    const fresh = milestones.filter((milestone) => !seenSet.has(milestone.key))
    writeSeenMilestones(userId, [
      ...seen,
      ...currentKeys.filter((key) => !seenSet.has(key)),
    ])
    if (fresh.length > 0) {
      setCelebrations((queue) => [...queue, ...fresh])
    }
  }, [userId, progressResult, progressUserId])

  useEffect(() => {
    if (!userId) {
      setTutorial(false)
      return
    }
    setTutorial(!tutorialDone(userId))
  }, [userId])

  useEffect(() => {
    document.documentElement.dataset.saver = dataSaver ? 'on' : 'off'
    try {
      localStorage.setItem(DATA_SAVER_KEY, dataSaver ? 'on' : 'off')
    } catch {
      // Le choix reste actif pour la session même si le stockage est bloqué.
    }
  }, [dataSaver])

  const dismissCelebration = useCallback(() => {
    setCelebrations((queue) => queue.slice(1))
  }, [])

  const completeTutorial = () => {
    if (userId) finishTutorialFor(userId)
    setTutorial(false)
  }

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    setProjectsError(null)
    try {
      const list = await listProjects()
      const savedAt = Date.now()
      setProjects(list)
      setProjectsSavedAt(savedAt)
      setProjectsFromCache(false)
      saveProjectCache(list, savedAt)
    } catch (cause) {
      const cached = readProjectCache()
      if (cached) {
        setProjects(cached.projects)
        setProjectsSavedAt(cached.savedAt)
        setProjectsFromCache(true)
      }
      setProjectsError(toFrenchError(cause))
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setProjects(null)
      setProjectsSavedAt(null)
      setProjectsFromCache(false)
      return
    }
    const cached = readProjectCache()
    if (cached) {
      setProjects(cached.projects)
      setProjectsSavedAt(cached.savedAt)
      setProjectsFromCache(true)
    }
    void loadProjects()
  }, [userId, loadProjects])

  useEffect(() => {
    if (!userId) return
    const refresh = () => void loadProjects()
    const showCachedList = () => {
      const cached = readProjectCache()
      if (!cached) return
      setProjects(cached.projects)
      setProjectsSavedAt(cached.savedAt)
      setProjectsFromCache(true)
    }
    window.addEventListener('online', refresh)
    window.addEventListener('offline', showCachedList)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', showCachedList)
    }
  }, [userId, loadProjects])

  useEffect(() => {
    if (!userId) return
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setScreen('results')
        window.setTimeout(() => {
          document.getElementById('catalogue-search')?.focus()
        }, 80)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [userId])
  const [net, setNet] = useState<'offline' | 'online' | null>(
    navigator.onLine ? null : 'offline',
  )
  const [netOut, setNetOut] = useState(false)
  useEffect(() => {
    let t1 = 0,
      t2 = 0
    const clear = () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
    const off = () => {
      clear()
      setNetOut(false)
      setNet('offline')
    }
    const on = () => {
      clear()
      setNetOut(false)
      setNet('online')
      t1 = window.setTimeout(() => setNetOut(true), 2400)
      t2 = window.setTimeout(() => {
        setNet(null)
        setNetOut(false)
      }, 2750)
    }
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
      clear()
    }
  }, [])
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem('bondev-nav') === 'open'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('bondev-nav', pinned ? 'open' : 'closed')
    } catch {}
  }, [pinned])
  useEffect(() => {
    if (!loading && !session) {
      setScreen('login')
      setSheet(false)
      setSelectedProjectId(null)
      setSelectedQuestionId(null)
    }
  }, [loading, session])
  const go = (s: Screen) => {
    setScreen(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openResults = (value: string) => {
    setQuery(value)
    setScreen('results')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openProject = (project: Project, from: Screen) => {
    setSelectedProjectId(project.id)
    setDetailFrom(from)
    setScreen('project')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openQuestion = (questionId: string) => {
    setSelectedQuestionId(questionId)
    setScreen('question')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleProjectUsed = (projectId: string) => {
    if (!projects) return
    const updated = projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            stars: project.stars + 1,
            last_activity: new Date().toISOString(),
          }
        : project,
    )
    setProjects(updated)
    saveProjectCache(updated, projectsSavedAt ?? Date.now())
  }
  const retryProjects = () => void loadProjects()
  const selectedProject =
    projects?.find((project) => project.id === selectedProjectId) ?? null
  const signedIn = Boolean(session)
  const activeScreen: Screen = signedIn
    ? screen === 'login'
      ? 'home'
      : screen
    : 'login'
  return (
    <div className="shell">
      <div
        className="phone"
        data-nav={
          signedIn && !loading ? (pinned ? 'open' : 'closed') : 'none'
        }
      >
        {net && (
          <div
            key={net}
            className={`net-pill ${net} ${netOut ? 'out' : ''}`}
            role="status"
          >
            <i className="net-dot" />
            <span>{net === 'offline' ? 'Hors-ligne' : 'En ligne'}</span>
          </div>
        )}
        {loading ? (
          <LoadingScreen />
        ) : !signedIn ? (
          <Login />
        ) : (
          <>
            <div className="content">
              {profileError && activeScreen !== 'profile' && (
                <div className="app-notice" role="status">
                  {profileError}
                </div>
              )}
              {(activeScreen === 'home' || activeScreen === 'profile') && (
                <GuestBanner />
              )}
              <Suspense fallback={<ScreenSkeleton />}>
                {activeScreen === 'home' && (
                  <Home
                    go={go}
                    projects={projects}
                    loading={projectsLoading}
                    error={projectsError}
                    fromCache={projectsFromCache}
                    savedAt={projectsSavedAt}
                    onRetry={retryProjects}
                    onSearch={openResults}
                    openProject={openProject}
                    progress={progressResult?.progress ?? null}
                    progressLoading={progressLoading}
                    progressError={progressError}
                    progressFromCache={progressResult?.fromCache ?? false}
                    progressSavedAt={progressResult?.savedAt ?? null}
                    onProgressRetry={() => void loadProgress()}
                    onHow={() => go('how')}
                  />
                )}{' '}
                {activeScreen === 'results' && (
                  <Results
                    go={go}
                    query={query}
                    setQuery={setQuery}
                    projects={projects}
                    loading={projectsLoading}
                    error={projectsError}
                    fromCache={projectsFromCache}
                    savedAt={projectsSavedAt}
                    onRetry={retryProjects}
                    openProject={openProject}
                  />
                )}{' '}
                {activeScreen === 'project' && (
                  <ProjectDetail
                    project={selectedProject}
                    loading={projectsLoading}
                    error={projectsError}
                    back={() => go(detailFrom)}
                    onRetry={retryProjects}
                    onUsed={handleProjectUsed}
                  />
                )}{' '}
                {activeScreen === 'share' && (
                  <ShareProject go={go} onPublished={retryProjects} />
                )}{' '}
                {activeScreen === 'help' && (
                  <Help go={go} openQuestion={openQuestion} />
                )}{' '}
                {activeScreen === 'question' &&
                  (selectedQuestionId ? (
                    <QuestionThread
                      key={`${selectedQuestionId}:${userId ?? 'anon'}`}
                      questionId={selectedQuestionId}
                      back={() => go('help')}
                    />
                  ) : (
                    <Help go={go} openQuestion={openQuestion} />
                  ))}{' '}
                {activeScreen === 'add' && (
                  <Add
                    key={userId ?? 'anon'}
                    go={go}
                    onPosted={openQuestion}
                  />
                )}{' '}
                {activeScreen === 'profile' && (
                  <Profile
                    go={go}
                    progressResult={progressResult}
                    progressLoading={progressLoading}
                    progressError={progressError}
                    onRefreshProgress={() => void loadProgress()}
                    dataSaver={dataSaver}
                    onDataSaverChange={setDataSaver}
                  />
                )}{' '}
                {activeScreen === 'how' && (
                  <HowItWorks back={() => go('profile')} />
                )}{' '}
                {activeScreen === 'states' && <States go={go} />}
              </Suspense>
            </div>
            <Nav
              active={activeScreen}
              go={go}
              onAdd={() => setSheet(true)}
              pinned={pinned}
              setPinned={setPinned}
            />
            {sheet && (
              <div
                className={`sheet-backdrop ${closing ? 'out' : ''}`}
                onClick={() => closeSheet()}
              >
                <section
                  className="add-sheet"
                  onClick={(e) => e.stopPropagation()}
                >
                  <i />
                  <h2>Que veux-tu ajouter ?</h2>
                  <button onClick={() => closeSheet(() => go('add'))}>
                    <span>
                      <Icon name="ask" />
                    </span>
                    <p>
                      <b>Poser une question</b>
                      <small>Demande un coup de main</small>
                    </p>
                    <Icon name="arrow" />
                  </button>
                  <button
                    onClick={() =>
                      closeSheet(() => go('share'))
                    }
                  >
                    <span>
                      <Icon name="code" />
                    </span>
                    <p>
                      <b>Partager un projet</b>
                      <small>Aide la communauté à avancer</small>
                    </p>
                    <Icon name="arrow" />
                  </button>
                </section>
              </div>
            )}
            {celebrations[0] && (
              <CelebrationToast
                key={celebrations[0].key}
                item={celebrations[0]}
                onClose={dismissCelebration}
              />
            )}
            {tutorial && <Tutorial onDone={completeTutorial} />}
          </>
        )}
      </div>
    </div>
  )
}
