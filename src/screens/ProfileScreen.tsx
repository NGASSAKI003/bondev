import { useEffect, useState } from 'react'
import { useLang } from '../i18n'
import {
  getMyLedger,
  toFrenchError,
  type LedgerEntry,
  type ProgressResult,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import {
  BADGE_FAMILY_META,
  COMMUNITY_META,
  QUEST_META,
  familyLabel,
  questLabel,
  tierName,
  unitFor,
} from '../lib/badgeMeta'
import { formatDateTime, formatLedgerDate } from '../lib/format'
import {
  CHALLENGE_TARGET,
  levelFor,
  type BadgeFamily,
  type CommunityBadgeProgress,
  type ProgressSummary,
  type SpecialtyProgress,
  type TierBadgeProgress,
} from '../lib/progress'
import { AccountLangToggle, Header, Icon, initialsFor } from '../components/ui'
import type { Screen } from './types'

function BadgeFamilyCard({
  family,
  badge,
}: {
  family: BadgeFamily
  badge: TierBadgeProgress
}) {
  const lang = useLang()
  const meta = BADGE_FAMILY_META[family]
  const currentTier = badge.tier
    ? tierName(badge.tier, lang)
    : lang === 'en'
      ? 'No tier yet'
      : 'Aucun palier'
  const countLabel = `${badge.count} ${unitFor(family, badge.count, lang)}`
  const nextLabel = badge.nextTier
    ? lang === 'en'
      ? `${badge.remaining} more ${unitFor(family, badge.remaining, lang)} for ${tierName(badge.nextTier, lang)}`
      : `${badge.remaining} ${unitFor(family, badge.remaining, lang)} de plus pour le palier ${tierName(badge.nextTier, lang)}`
    : lang === 'en'
      ? 'Highest tier reached'
      : 'Palier maximal atteint'
  const aria =
    lang === 'en'
      ? `${familyLabel(family, lang)} badge: ${currentTier}. ${countLabel}. ${nextLabel}`
      : `Badge ${familyLabel(family, lang)} : ${currentTier}. ${countLabel}. ${nextLabel}`

  return (
    <article
      className={`badge-family tier-${badge.tier ?? 'none'}`}
      aria-label={aria}
    >
      <div className="badge-family-head">
        <span className="badge-medal" aria-hidden="true">
          <Icon name={meta.icon} size={20} />
        </span>
        <div>
          <b>{meta.label[lang]}</b>
          <small>{currentTier}</small>
        </div>
        <strong>{badge.count}</strong>
      </div>
      <div
        className="badge-bar"
        role="img"
        aria-label={
          lang === 'en'
            ? `${Math.round(badge.percent)}% towards the next tier`
            : `${Math.round(badge.percent)} % vers le palier suivant`
        }
      >
        <span style={{ width: `${badge.percent}%` }} />
      </div>
      <small className="badge-next">{nextLabel}</small>
    </article>
  )
}

function SpecialtyBadgeCard({ badge }: { badge: SpecialtyProgress }) {
  const lang = useLang()
  const currentTier = badge.tier
    ? tierName(badge.tier, lang)
    : lang === 'en'
      ? 'No tier yet'
      : 'Aucun palier'
  const countLabel = `${badge.count} ${
    badge.count === 1
      ? lang === 'en'
        ? 'validated answer'
        : 'réponse validée'
      : lang === 'en'
        ? 'validated answers'
        : 'réponses validées'
  }`
  const nextLabel = badge.nextTier
    ? lang === 'en'
      ? `${badge.remaining} more for ${tierName(badge.nextTier, lang)}`
      : `${badge.remaining} de plus pour le palier ${tierName(badge.nextTier, lang)}`
    : lang === 'en'
      ? 'Highest tier reached'
      : 'Palier maximal atteint'

  return (
    <article
      className={`specialty-badge tier-${badge.tier ?? 'none'}`}
      aria-label={`Expert ${badge.technology} — ${currentTier}, ${countLabel}`}
    >
      <div className="specialty-badge-head">
        <span aria-hidden="true">
          <Icon name="code" size={18} />
        </span>
        <div>
          <b>Expert {badge.technology}</b>
          <small>
            {currentTier} · {countLabel}
          </small>
        </div>
      </div>
      <div className="badge-bar" aria-hidden="true">
        <span style={{ width: `${badge.percent}%` }} />
      </div>
      <small className="badge-next">{nextLabel}</small>
    </article>
  )
}

function CommunityBadgeTile({ badge }: { badge: CommunityBadgeProgress }) {
  const lang = useLang()
  const meta = COMMUNITY_META[badge.id]
  const state =
    badge.unlocked
      ? lang === 'en'
        ? 'Unlocked'
        : 'Débloqué'
      : lang === 'en'
        ? 'Locked'
        : 'À débloquer'
  return (
    <article
      className={`community-badge ${badge.unlocked ? 'unlocked' : ''}`}
      aria-label={`${meta.title[lang]} — ${state}. ${meta.description[lang]}`}
    >
      <span aria-hidden="true">
        <Icon name={badge.unlocked ? meta.icon : 'lock'} size={19} />
      </span>
      <div>
        <b>{meta.title[lang]}</b>
        <small>{meta.description[lang]}</small>
      </div>
      <em>
        {badge.id === 'kind'
          ? `${badge.count} / ${badge.target}`
          : badge.unlocked
            ? '✓'
            : '—'}
      </em>
    </article>
  )
}

function QuestChecklist({ quest }: { quest: ProgressSummary['quest'] }) {
  const lang = useLang()
  return (
    <ul className="quest-list">
      {quest.missions.map((mission) => (
        <li key={mission.id} className={mission.done ? 'done' : ''}>
          <span className="quest-check" aria-hidden="true">
            {mission.done && <Icon name="check" size={14} />}
          </span>
          <span>
            <Icon name={QUEST_META[mission.id].icon} size={18} />
            <small>{questLabel(mission.id, lang)}</small>
          </span>
          <em>
            {mission.done
              ? lang === 'en'
                ? 'Done'
                : 'Fait'
              : lang === 'en'
                ? 'To do'
                : 'À faire'}
          </em>
        </li>
      ))}
    </ul>
  )
}

function ChallengePanel({
  challenge,
}: {
  challenge: ProgressSummary['challenge']
}) {
  const lang = useLang()
  const target = challenge.target || CHALLENGE_TARGET
  const percent = Math.min(
    100,
    (challenge.resolved / Math.max(1, target)) * 100,
  )
  const remaining = Math.max(0, target - challenge.resolved)
  const message = challenge.achieved
    ? challenge.badgeUnlocked
      ? lang === 'en'
        ? 'Goal reached! The “Challenge of the week” badge is unlocked.'
        : 'Objectif atteint ! Le badge « Défi de la semaine » est débloqué.'
      : lang === 'en'
        ? 'The community reached the goal. Take one action this week to unlock the badge.'
        : 'La communauté a atteint l’objectif. Fais une action cette semaine pour débloquer le badge.'
    : lang === 'en'
      ? `${remaining} more question${remaining > 1 ? 's' : ''} to solve this week.`
      : `${remaining} question${remaining > 1 ? 's' : ''} encore à résoudre cette semaine.`

  return (
    <section className="glass challenge-panel">
      <div className="challenge-head">
        <span aria-hidden="true">
          <Icon name="target" size={21} />
        </span>
        <div>
          <b>{lang === 'en' ? 'Weekly challenge' : 'Défi de la semaine'}</b>
          <small>
            {lang === 'en'
              ? 'The whole community'
              : 'Toute la communauté'}
          </small>
        </div>
      </div>
      <div className="challenge-score">
        <b>
          {challenge.resolved} / {target}
        </b>
        <span>
          {lang === 'en' ? 'questions solved' : 'questions résolues'}
        </span>
      </div>
      <div
        className="challenge-bar"
        role="img"
        aria-label={
          lang === 'en'
            ? `${challenge.resolved} out of ${target} questions solved`
            : `${challenge.resolved} questions résolues sur ${target}`
        }
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p>{message}</p>
    </section>
  )
}

export function Profile({
  go,
  progressResult,
  progressLoading,
  progressError,
  onRefreshProgress,
  dataSaver,
  onDataSaverChange,
}: {
  go: (s: Screen) => void
  progressResult: ProgressResult | null
  progressLoading: boolean
  progressError: string | null
  onRefreshProgress: () => void
  dataSaver: boolean
  onDataSaverChange: (value: boolean) => void
}) {
  const {
    user,
    profile,
    profileError,
    stats,
    statsLoading,
    statsError,
    signOut,
    refreshProfile,
    refreshStats,
  } = useAuth()
  const lang = useLang()
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [ledgerReload, setLedgerReload] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const userId = user?.id

  useEffect(() => {
    if (!userId) {
      setLedger([])
      return
    }
    let active = true
    setLedger(null)
    setLedgerError(null)
    getMyLedger(20)
      .then((entries) => {
        if (active) setLedger(entries)
      })
      .catch((cause: unknown) => {
        if (active) setLedgerError(toFrenchError(cause))
      })
    return () => {
      active = false
    }
  }, [userId, ledgerReload])

  const displayName = profile?.display_name.trim() || profile?.pseudo || ''
  const pseudo = profile?.pseudo ?? ''
  const avatar = profile?.avatar_url.startsWith('https://')
    ? profile.avatar_url
    : ''
  const initials = initialsFor(displayName, pseudo)
  const progress = progressResult?.progress ?? null
  const totalEarned = progress?.level.totalEarned ?? stats?.total_earned ?? 0
  const info = progress?.level ?? levelFor(totalEarned)
  const fromCache = progressResult?.fromCache ?? false
  const savedAt = progressResult?.savedAt ?? null
  const levelName =
    lang === 'en' ? info.current.nameEn : info.current.name

  const progressLabel = progress || stats
    ? info.next
      ? lang === 'en'
        ? `${info.remaining} more points to become ${info.next.nameEn}`
        : `Encore ${info.remaining} points pour devenir ${info.next.name}`
      : lang === 'en'
        ? 'Highest level reached'
        : 'Niveau maximal atteint'
    : statsLoading
      ? lang === 'en'
        ? 'Loading…'
        : 'Chargement…'
      : (statsError ?? (lang === 'en' ? 'Points unavailable' : 'Points indisponibles'))

  const handleSignOut = async () => {
    setActionError(null)
    setSigningOut(true)
    const result = await signOut()
    if (result.error) {
      setActionError(result.error)
      setSigningOut(false)
    }
  }

  const families: BadgeFamily[] = ['help', 'share', 'useful', 'streak']
  const plural = (count: number, one: string, many: string) =>
    count === 1 ? one : many

  return (
    <main className="screen">
      <Header title="Mon profil" />
      <div className="profile-layout">
        <div>
          {profileError && (
            <div className="glass profile-notice" role="status">
              <p>{profileError}</p>
              <button className="link-btn" onClick={() => void refreshProfile()}>
                Réessayer
              </button>
            </div>
          )}
          {progressError && (
            <div className="glass profile-notice" role="status">
              <p>{progressError}</p>
              <button className="link-btn" onClick={onRefreshProgress}>
                Réessayer
              </button>
            </div>
          )}
          <section className="profile-head">
            <div className="avatar">
              {avatar ? <img src={avatar} alt="" /> : initials}
              <i />
            </div>
            <div>
              <h1>{displayName || 'Profil indisponible'}</h1>
              <p>{pseudo ? `@${pseudo}` : profileError ?? ''}</p>
            </div>
          </section>
          <section className="glass stats">
            <div>
              <b>{stats ? stats.balance : '—'}</b>
              <span>Solde</span>
            </div>
            <div>
              <b>{stats ? stats.total_earned : '—'}</b>
              <span>Total gagné</span>
            </div>
            <div>
              <b className="stats-level">{levelName || '—'}</b>
              <span>Niveau</span>
            </div>
            <i>
              <span style={{ width: `${info.percent}%` }} />
            </i>
            <small>{progressLabel}</small>
          </section>
          {statsError && (
            <button
              className="link-btn stats-retry"
              onClick={() => void refreshStats()}
            >
              Réessayer
            </button>
          )}

          {progressLoading && !progress ? (
            <section className="glass progress-loading" role="status">
              {lang === 'en'
                ? 'Loading your progress…'
                : 'Chargement de ta progression…'}
            </section>
          ) : progress ? (
            <>
              <section className="glass streak-panel">
                <div className="streak-head">
                  <span className="streak-flame" aria-hidden="true">
                    <Icon name="flame" size={27} />
                  </span>
                  <div>
                    <b>{progress.streak.current}</b>
                    <span>
                      {lang === 'en'
                        ? progress.streak.current === 1
                          ? 'consecutive week'
                          : 'consecutive weeks'
                        : progress.streak.current === 1
                          ? 'semaine d’affilée'
                          : 'semaines d’affilée'}
                    </span>
                  </div>
                  <em className={progress.activeThisWeek ? 'active' : ''}>
                    {progress.activeThisWeek
                      ? lang === 'en'
                        ? 'This week counts'
                        : 'Cette semaine compte'
                      : lang === 'en'
                        ? 'Your turn this week'
                        : 'À toi de jouer cette semaine'}
                  </em>
                </div>
                <p>
                  {progress.streak.current > 0
                    ? lang === 'en'
                      ? `Your best streak: ${progress.streak.best} week${progress.streak.best > 1 ? 's' : ''}.`
                      : `Ta meilleure série : ${progress.streak.best} semaine${progress.streak.best > 1 ? 's' : ''}.`
                    : lang === 'en'
                      ? 'One useful action this week starts your streak.'
                      : 'Une action utile cette semaine lance ta série.'}
                </p>
                <small>
                  {progress.streak.jokersUsed > 0
                    ? lang === 'en'
                      ? `${progress.streak.jokersUsed} joker${progress.streak.jokersUsed > 1 ? 's' : ''} used. A joker forgives one missed week out of four.`
                      : `${progress.streak.jokersUsed} joker${progress.streak.jokersUsed > 1 ? 's' : ''} utilisé${progress.streak.jokersUsed > 1 ? 's' : ''}. Un joker pardonne une semaine manquée sur quatre.`
                    : lang === 'en'
                      ? 'A joker forgives one missed week out of four.'
                      : 'Un joker pardonne une semaine manquée sur quatre.'}
                </small>
                {fromCache && savedAt && (
                  <small className="cache-date">
                    {lang === 'en' ? 'Last update: ' : 'Dernière mise à jour : '}
                    {formatDateTime(savedAt, lang)}
                  </small>
                )}
              </section>

              <section className="glass quest-panel">
                <div className="section-title">
                  <h2>{lang === 'en' ? 'Weekly quest' : 'Quête de la semaine'}</h2>
                  <span>
                    {progress.quest.completed} / {progress.quest.total}
                  </span>
                </div>
                <QuestChecklist quest={progress.quest} />
                {progress.quest.allDone && (
                  <p className="quest-success">
                    {lang === 'en'
                      ? 'Quest complete! All three missions are done.'
                      : 'Quête terminée ! Les trois missions sont faites.'}
                  </p>
                )}
              </section>

              <ChallengePanel challenge={progress.challenge} />

              <section className="section profile">
                <h2>{lang === 'en' ? 'My badges' : 'Mes badges'}</h2>
                <div className="badge-families">
                  {families.map((family) => (
                    <BadgeFamilyCard
                      key={family}
                      family={family}
                      badge={progress.badges[family]}
                    />
                  ))}
                </div>

                <h2>Spécialités</h2>
                {progress.badges.specialties.length > 0 ? (
                  <div className="specialty-grid">
                    {progress.badges.specialties.map((badge) => (
                      <SpecialtyBadgeCard
                        key={badge.technology}
                        badge={badge}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="progress-hint">
                    {lang === 'en'
                      ? 'Answer questions in a technology to become an “Expert <technology>”.'
                      : 'Réponds à des questions d’une technologie pour devenir « Expert <techno> ».'}
                  </p>
                )}

                <h2>Communauté</h2>
                <div className="community-grid">
                  {progress.badges.community.map((badge) => (
                    <CommunityBadgeTile key={badge.id} badge={badge} />
                  ))}
                </div>

                <div className="impact impact-three">
                  <div>
                    <b>{progress.totals.resolvedQuestions}</b>
                    <span>
                      {lang === 'en'
                        ? plural(
                            progress.totals.resolvedQuestions,
                            'question solved',
                            'questions solved',
                          )
                        : plural(
                            progress.totals.resolvedQuestions,
                            'question résolue',
                            'questions résolues',
                          )}
                    </span>
                  </div>
                  <div>
                    <b>{progress.totals.projects}</b>
                    <span>
                      {lang === 'en'
                        ? plural(
                            progress.totals.projects,
                            'project shared',
                            'projects shared',
                          )
                        : plural(
                            progress.totals.projects,
                            'projet partagé',
                            'projets partagés',
                          )}
                    </span>
                  </div>
                  <div>
                    <b>{progress.totals.members}</b>
                    <span>
                      {lang === 'en'
                        ? plural(progress.totals.members, 'member', 'members')
                        : plural(progress.totals.members, 'membre', 'membres')}
                    </span>
                  </div>
                </div>

                <button
                  className="secondary profile-how"
                  onClick={() => go('how')}
                  type="button"
                >
                  <Icon name="book" size={18} />{' '}
                  {lang === 'en' ? 'How it works' : 'Comment ça marche'}
                </button>
              </section>
            </>
          ) : null}

          <section className="glass saver-row">
            <div>
              <b>{lang === 'en' ? 'Data saver' : 'Économie de données'}</b>
              <small>
                {lang === 'en'
                  ? 'Turns off animations and blur, and lightens shadows.'
                  : 'Coupe les animations et le flou, et allège les ombres.'}
              </small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dataSaver}
              aria-label={
                lang === 'en' ? 'Data saver' : 'Économie de données'
              }
              className={`switch ${dataSaver ? 'on' : ''}`}
              onClick={() => onDataSaverChange(!dataSaver)}
            >
              <span aria-hidden="true" />
            </button>
          </section>
          <section className="glass lang-row">
            <span>Langue</span>
            <AccountLangToggle />
          </section>
          <button
            className="secondary logout"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            type="button"
          >
            {signingOut ? 'Déconnexion…' : 'Se déconnecter'}
          </button>
          {actionError && (
            <p className="inline-error" role="alert">
              {actionError}
            </p>
          )}
        </div>
        <section className="profile-history">
          <h2>Historique des points</h2>
          <div className="glass history">
            {ledgerError ? (
              <p className="history-state error" role="status">
                {ledgerError}
                <button
                  className="link-btn"
                  onClick={() => setLedgerReload((value) => value + 1)}
                >
                  Réessayer
                </button>
              </p>
            ) : ledger === null ? (
              <p className="history-state">Chargement de l’historique…</p>
            ) : ledger.length === 0 ? (
              <p className="history-state">Aucun mouvement pour le moment.</p>
            ) : (
              ledger.map((entry) => {
                const negative = entry.delta < 0
                const deltaLabel =
                  entry.delta > 0
                    ? `+${entry.delta}`
                    : entry.delta < 0
                      ? `−${Math.abs(entry.delta)}`
                      : '0'
                return (
                  <div key={entry.id}>
                    <i className={negative ? 'minus' : ''}>
                      {entry.delta > 0 ? '+' : entry.delta < 0 ? '−' : '•'}
                    </i>
                    <p>
                      <b>{entry.reasonLabel}</b>
                      <small>{formatLedgerDate(entry.created_at, lang)}</small>
                    </p>
                    <strong>{deltaLabel}</strong>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
