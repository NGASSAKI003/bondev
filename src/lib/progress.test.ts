import { describe, expect, it } from 'vitest'
import {
  BADGE_THRESHOLDS,
  CHALLENGE_TARGET,
  buildProgress,
  computeStreak,
  levelFor,
  startOfUtcWeek,
  tierProgress,
  utcWeekKey,
  type ProgressInput,
} from './progress'

const NOW = new Date('2026-11-04T12:00:00.000Z')

function emptyInput(overrides: Partial<ProgressInput> = {}): ProgressInput {
  return {
    totalEarned: 0,
    answers: [],
    authoredQuestions: [],
    projects: [],
    usesGiven: [],
    usesReceived: 0,
    challenge: { week: utcWeekKey(NOW), resolved: 0 },
    totals: { resolvedQuestions: 0, projects: 0, members: 0 },
    ...overrides,
  }
}

function usefulAnswer(
  createdAt: string,
  technologies: string[] = [],
  beginnerOk = false,
) {
  return { createdAt, isUseful: true, beginnerOk, technologies }
}

describe('niveaux', () => {
  it('suit exactement les seuils de la base', () => {
    expect(levelFor(0).current.name).toBe('Étincelle')
    expect(levelFor(9).current.name).toBe('Étincelle')
    expect(levelFor(9).next?.name).toBe('Explorateur')
    expect(levelFor(9).remaining).toBe(1)

    expect(levelFor(10).current.name).toBe('Explorateur')
    expect(levelFor(10).remaining).toBe(20)
    expect(levelFor(30).current.name).toBe('Bâtisseur')
    expect(levelFor(70).current.name).toBe('Mentor')
    expect(levelFor(150).current.name).toBe('Maître')
    expect(levelFor(299).current.name).toBe('Maître')
    expect(levelFor(299).next?.name).toBe('Légende')
    expect(levelFor(299).remaining).toBe(1)
  })

  it('termine la progression à la Légende', () => {
    const legend = levelFor(300)
    expect(legend.current.name).toBe('Légende')
    expect(legend.next).toBeNull()
    expect(legend.remaining).toBe(0)
    expect(legend.percent).toBe(100)
    expect(levelFor(1000).percent).toBe(100)
  })

  it('calcule une barre entre le niveau courant et le suivant', () => {
    expect(levelFor(15).percent).toBe(25)
    expect(levelFor(20).percent).toBe(50)
    expect(levelFor(25).percent).toBe(75)
  })
})

describe('semaines UTC', () => {
  it('commence le lundi à 00:00 UTC, même un dimanche soir', () => {
    expect(startOfUtcWeek(new Date('2026-11-04T23:30:00.000Z')).toISOString()).toBe(
      '2026-11-02T00:00:00.000Z',
    )
    expect(startOfUtcWeek(new Date('2026-11-08T23:59:59.000Z')).toISOString()).toBe(
      '2026-11-02T00:00:00.000Z',
    )
    expect(startOfUtcWeek(new Date('2026-11-02T00:00:00.000Z')).toISOString()).toBe(
      '2026-11-02T00:00:00.000Z',
    )
  })

  it('produit une clé de semaine stable', () => {
    expect(utcWeekKey(new Date('2026-11-04T12:00:00.000Z'))).toBe('2026-11-02')
    expect(utcWeekKey(new Date('2026-10-26T00:00:00.000Z'))).toBe('2026-10-26')
  })
})

describe('série hebdomadaire', () => {
  it('compte les semaines consécutives sans joker', () => {
    const streak = computeStreak(
      ['2026-10-19T10:00:00.000Z', '2026-11-02T10:00:00.000Z'],
      NOW,
      false,
    )
    expect(streak.current).toBe(1)
    expect(streak.best).toBe(1)
    expect(streak.jokersUsed).toBe(0)
    expect(streak.activeThisWeek).toBe(true)
  })

  it('pardonne une semaine manquée avec le joker', () => {
    const streak = computeStreak(
      ['2026-10-19T10:00:00.000Z', '2026-11-02T10:00:00.000Z'],
      NOW,
    )
    expect(streak.current).toBe(3)
    expect(streak.best).toBe(3)
    expect(streak.jokersUsed).toBe(1)
  })

  it('ne pardonne pas deux semaines manquées dans la même fenêtre de 4', () => {
    const streak = computeStreak(
      ['2026-10-12T10:00:00.000Z', '2026-11-02T10:00:00.000Z'],
      NOW,
    )
    expect(streak.current).toBe(1)
    expect(streak.jokersUsed).toBe(0)
  })

  it('laisse la semaine en cours en attente', () => {
    const streak = computeStreak(['2026-10-26T10:00:00.000Z'], NOW)
    expect(streak.current).toBe(1)
    expect(streak.activeThisWeek).toBe(false)
  })

  it('peut utiliser le joker sur la semaine précédente', () => {
    const streak = computeStreak(['2026-10-19T10:00:00.000Z'], NOW)
    expect(streak.current).toBe(2)
    expect(streak.jokersUsed).toBe(1)
  })

  it('compte une réponse validée à la semaine de validation', () => {
    const answer = {
      createdAt: '2026-10-12T10:00:00.000Z',
      validatedAt: '2026-11-02T10:00:00.000Z',
      isUseful: true,
      beginnerOk: false,
      technologies: [],
    }
    const withValidation = buildProgress(
      emptyInput({ answers: [answer] }),
      NOW,
    )
    expect(withValidation.streak.activeThisWeek).toBe(true)
    expect(withValidation.streak.current).toBe(1)

    const withoutValidationDate = buildProgress(
      emptyInput({
        answers: [{ ...answer, validatedAt: undefined }],
      }),
      NOW,
    )
    expect(withoutValidationDate.streak.activeThisWeek).toBe(false)
  })

  it('retient la meilleure série passée', () => {
    const streak = computeStreak(
      [
        '2026-09-07T10:00:00.000Z',
        '2026-09-14T10:00:00.000Z',
        '2026-09-21T10:00:00.000Z',
        '2026-09-28T10:00:00.000Z',
        '2026-11-02T10:00:00.000Z',
      ],
      NOW,
    )
    expect(streak.best).toBe(4)
    expect(streak.current).toBe(1)
  })
})

describe('paliers de badges', () => {
  it('calcule le palier atteint et la progression vers le suivant', () => {
    const bronze = tierProgress(2, BADGE_THRESHOLDS.help)
    expect(bronze.tier).toBe('bronze')
    expect(bronze.nextTier).toBe('silver')
    expect(bronze.nextThreshold).toBe(5)
    expect(bronze.remaining).toBe(3)
    expect(bronze.percent).toBe(25)

    const silver = tierProgress(5, BADGE_THRESHOLDS.help)
    expect(silver.tier).toBe('silver')
    expect(silver.nextTier).toBe('gold')
    expect(silver.remaining).toBe(20)

    const gold = tierProgress(25, BADGE_THRESHOLDS.help)
    expect(gold.tier).toBe('gold')
    expect(gold.nextTier).toBeNull()
    expect(gold.remaining).toBe(0)
    expect(gold.percent).toBe(100)
  })

  it('groupe les badges Entraide, Partage, Utilité et Série', () => {
    const answers = Array.from({ length: 5 }, (_, index) =>
      usefulAnswer(`2026-0${index + 1}-12T10:00:00.000Z`, ['React']),
    )
    const progress = buildProgress(
      emptyInput({
        answers,
        projects: [
          { createdAt: '2026-09-07T10:00:00.000Z' },
          { createdAt: '2026-09-14T10:00:00.000Z' },
          { createdAt: '2026-09-21T10:00:00.000Z' },
        ],
        usesReceived: 10,
      }),
      NOW,
    )

    expect(progress.badges.help.tier).toBe('silver')
    expect(progress.badges.share.tier).toBe('silver')
    expect(progress.badges.useful.tier).toBe('silver')
    expect(progress.badges.specialties[0]?.technology).toBe('React')
    expect(progress.badges.specialties[0]?.tier).toBe('bronze')
  })

  it('garde au maximum trois spécialités, les plus pratiquées', () => {
    const answers = [
      ...Array.from({ length: 10 }, () =>
        usefulAnswer('2026-09-07T10:00:00.000Z', ['Node.js']),
      ),
      ...Array.from({ length: 4 }, () =>
        usefulAnswer('2026-09-14T10:00:00.000Z', ['Python']),
      ),
      ...Array.from({ length: 3 }, () =>
        usefulAnswer('2026-09-21T10:00:00.000Z', ['React']),
      ),
      usefulAnswer('2026-09-28T10:00:00.000Z', ['Vue']),
    ]
    const specialties = buildProgress(emptyInput({ answers }), NOW).badges
      .specialties

    expect(specialties).toHaveLength(3)
    expect(specialties.map((item) => item.technology)).toEqual([
      'Node.js',
      'Python',
      'React',
    ])
    expect(specialties[0].tier).toBe('silver')
    expect(specialties[1].tier).toBe('bronze')
    expect(specialties[2].tier).toBe('bronze')
  })

  it('débloque les badges Communauté dans le bon ordre', () => {
    const first = buildProgress(
      emptyInput({
        answers: [usefulAnswer('2026-09-07T10:00:00.000Z', [], false)],
      }),
      NOW,
    ).badges.community
    expect(first.find((badge) => badge.id === 'first_answer')?.unlocked).toBe(
      true,
    )
    expect(first.find((badge) => badge.id === 'new_voice')?.unlocked).toBe(false)
    expect(first.find((badge) => badge.id === 'kind')?.unlocked).toBe(false)

    const beginner = buildProgress(
      emptyInput({
        answers: [
          usefulAnswer('2026-09-07T10:00:00.000Z', [], true),
          usefulAnswer('2026-09-14T10:00:00.000Z', [], true),
          usefulAnswer('2026-09-21T10:00:00.000Z', [], true),
        ],
      }),
      NOW,
    ).badges.community
    expect(beginner.find((badge) => badge.id === 'new_voice')?.unlocked).toBe(
      true,
    )
    expect(beginner.find((badge) => badge.id === 'kind')?.unlocked).toBe(true)
  })
})

describe('quête de la semaine', () => {
  it('valide chaque mission avec une action de la semaine', () => {
    const progress = buildProgress(
      emptyInput({
        answers: [
          usefulAnswer('2026-11-03T10:00:00.000Z', ['React'], true),
        ],
        projects: [{ createdAt: '2026-11-02T10:00:00.000Z' }],
        usesGiven: [{ createdAt: '2026-11-04T08:00:00.000Z' }],
      }),
      NOW,
    )

    expect(progress.quest.missions.map((mission) => mission.done)).toEqual([
      true,
      true,
      true,
    ])
    expect(progress.quest.completed).toBe(3)
    expect(progress.quest.allDone).toBe(true)
  })

  it('ignore les actions des semaines précédentes', () => {
    const progress = buildProgress(
      emptyInput({
        answers: [
          usefulAnswer('2026-10-26T10:00:00.000Z', ['React'], true),
        ],
        projects: [{ createdAt: '2026-10-25T10:00:00.000Z' }],
        usesGiven: [{ createdAt: '2026-10-26T08:00:00.000Z' }],
      }),
      NOW,
    )

    expect(progress.quest.missions.map((mission) => mission.done)).toEqual([
      false,
      false,
      false,
    ])
    expect(progress.quest.allDone).toBe(false)
  })
})

describe('défi collectif', () => {
  it('est atteint avec 10 questions résolues et un utilisateur actif', () => {
    const progress = buildProgress(
      emptyInput({
        answers: [
          usefulAnswer('2026-11-03T10:00:00.000Z', ['React'], false),
        ],
        challenge: { week: utcWeekKey(NOW), resolved: CHALLENGE_TARGET },
      }),
      NOW,
    )

    expect(progress.challenge.achieved).toBe(true)
    expect(progress.challenge.badgeUnlocked).toBe(true)
  })

  it('n’est pas atteint à 9 questions', () => {
    const progress = buildProgress(
      emptyInput({
        challenge: { week: utcWeekKey(NOW), resolved: CHALLENGE_TARGET - 1 },
      }),
      NOW,
    )
    expect(progress.challenge.achieved).toBe(false)
    expect(progress.challenge.badgeUnlocked).toBe(false)
  })

  it('exige une action personnelle pour donner le badge', () => {
    const progress = buildProgress(
      emptyInput({
        challenge: { week: utcWeekKey(NOW), resolved: CHALLENGE_TARGET },
      }),
      NOW,
    )
    expect(progress.challenge.achieved).toBe(true)
    expect(progress.challenge.activeThisWeek).toBe(false)
    expect(progress.challenge.badgeUnlocked).toBe(false)
  })

  it('ignore un compteur mis en cache lors d’une autre semaine', () => {
    const progress = buildProgress(
      emptyInput({
        challenge: { week: '2026-10-26', resolved: CHALLENGE_TARGET },
      }),
      NOW,
    )
    expect(progress.challenge.resolved).toBe(0)
    expect(progress.challenge.achieved).toBe(false)
  })
})
