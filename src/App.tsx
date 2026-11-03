import { LangToggle, useLang, type Lang } from './i18n'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  addAnswer,
  deleteAnswer,
  getMyLedger,
  getQuestion,
  isFreeQuestionAvailable,
  listProjects,
  listQuestionTechnologies,
  listQuestions,
  markProjectUsed,
  postQuestion,
  publishProject,
  toFrenchError,
  updateAnswer,
  updateMyProfile,
  validateAnswer,
  withdrawQuestion,
  type Answer,
  type LedgerEntry,
  type Project,
  type PublishedProject,
  type Question,
  type QuestionTab,
  type QuestionThread,
} from './lib/api'
import { useAuth } from './lib/auth'
import { formatDateTime, formatRelativeDate } from './lib/format'
import { fetchGithubRepo, GithubError, parseGithubRepoUrl, type GithubRepoPreview } from './lib/github'
import {
  formatTimeLeft,
  isHelpTier,
  pointsLabel,
  statusLabel,
  tierLabel,
  type HelpTier,
} from './lib/help'
import { normalizeSearchText, searchProjects } from './lib/search'

type Screen =
  | 'login'
  | 'home'
  | 'results'
  | 'project'
  | 'share'
  | 'help'
  | 'question'
  | 'add'
  | 'profile'
  | 'states'

type Level = { min: number; name: string; en: string }
const LEVELS: Level[] = [
  { min: 0, name: 'Étincelle', en: 'Spark' },
  { min: 10, name: 'Explorateur', en: 'Explorer' },
  { min: 30, name: 'Bâtisseur', en: 'Builder' },
  { min: 70, name: 'Mentor', en: 'Mentor' },
  { min: 150, name: 'Maître', en: 'Master' },
  { min: 300, name: 'Légende', en: 'Legend' },
]

function levelInfo(totalEarned: number) {
  let index = 0
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (totalEarned >= LEVELS[i].min) index = i
  }
  const current = LEVELS[index]
  const next = LEVELS[index + 1] ?? null
  const percent = next
    ? Math.min(
        100,
        Math.max(0, ((totalEarned - current.min) / (next.min - current.min)) * 100),
      )
    : 100
  return {
    current,
    next,
    percent,
    remaining: next ? Math.max(0, next.min - totalEarned) : 0,
  }
}

function initialsFor(name: string, pseudo: string): string {
  const source = (name.trim() || pseudo.trim()).replace(/\s+/g, ' ')
  const parts = source.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase() || '?'
}

function formatLedgerDate(value: string, lang: Lang): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
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

function githubErrorMessage(cause: unknown): string {
  if (cause instanceof GithubError) return cause.message
  return 'Impossible de récupérer ce dépôt pour le moment. Remplis les champs à la main.'
}

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const p: Record<string, ReactNode> = {
    home: (
      <>
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </>
    ),
    help: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
    ask: (
      <>
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    back: (
      <>
        <path d="m15 18-6-6 6-6" />
        <path d="M9 12h11" />
      </>
    ),
    github: (
      <>
        <path d="M15 22v-4a5 5 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.5 5.5 0 0 0 19.3 4 5 5 0 0 0 19.2.5S18 0 15 2a13 13 0 0 0-7 0C5 .1 3.8.5 3.8.5A5 5 0 0 0 3.7 4a5.5 5.5 0 0 0-1.5 3.8c0 5.4 3.5 6.6 6.8 7a5 5 0 0 0-1 3.5v4" />
        <path d="M8 19c-3 .9-3-1.5-4.2-2" />
      </>
    ),
    wifi: (
      <>
        <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
        <path d="m3 3 18 18" />
        <path d="M12 20h.01" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    code: (
      <>
        <path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
        <path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6" />
      </>
    ),
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
    ),
    external: (
      <>
        <path d="M15 3h6v6M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </>
    ),
    refresh: (
      <>
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v6h-6" />
      </>
    ),
    close: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    handshake: (
      <>
        <path d="m11 17 2 2a1 1 0 1 0 3-3" />
        <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
        <path d="m21 3 1 11h-2" />
        <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
        <path d="M3 4h8" />
      </>
    ),
    mail: (
      <>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: (
      <>
        <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />
      </>
    ),
  }
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {p[name]}
    </svg>
  )
}
function ThemeToggle() {
  const systemDark = () =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const [dark, setDark] = useState(
    () =>
      localStorage.getItem('bondev-theme') === 'dark' ||
      (!localStorage.getItem('bondev-theme') && systemDark()),
  )
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    localStorage.setItem('bondev-theme', dark ? 'dark' : 'light')
  }, [dark])
  return (
    <button
      className="theme-toggle"
      onClick={() => setDark(!dark)}
      aria-label={`Passer au thème ${dark ? 'clair' : 'sombre'}`}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
      <span>{dark ? 'Clair' : 'Sombre'}</span>
    </button>
  )
}
function Primary({
  children,
  onClick,
  icon,
  disabled = false,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  icon?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      className="primary"
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {icon && <Icon name={icon} />} {children}
    </button>
  )
}
function Header({
  title,
  back,
  logo = false,
}: {
  title?: string
  back?: () => void
  logo?: boolean
}) {
  const { stats } = useAuth()
  const lang = useLang()
  const balance = stats ? String(stats.balance) : '—'
  return (
    <header className="topbar">
      {back ? (
        <button className="iconbtn" onClick={back} aria-label="Retour">
          <Icon name="back" />
        </button>
      ) : (
        <span />
      )}
      {logo ? (
        <div className="brand">
          <img src="/assets/bondev-logo.png" alt="" />
          <b>Bondev</b>
        </div>
      ) : title ? (
        <h1>{title}</h1>
      ) : (
        <span />
      )}
      <div className="top-actions">
        <button
          className="points"
          aria-label={
            stats
              ? lang === 'en'
                ? `Balance: ${stats.balance} points`
                : `Solde : ${stats.balance} points`
              : lang === 'en'
                ? 'Points unavailable'
                : 'Points indisponibles'
          }
          title={
            stats
              ? undefined
              : lang === 'en'
                ? 'Points unavailable'
                : 'Points indisponibles'
          }
        >
          <b>{balance}</b>
          <span>pts</span>
        </button>
        <ThemeToggle />
      </div>
    </header>
  )
}
function PointsCard() {
  const { stats, statsLoading, statsError, refreshStats } = useAuth()
  const lang = useLang()
  const totalEarned = stats?.total_earned ?? 0
  const progress = levelInfo(totalEarned).percent
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
function AccountLangToggle({ compact = false }: { compact?: boolean }) {
  const { user, refreshProfile } = useAuth()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className={`lang-save ${compact ? 'compact' : ''}`}>
      <LangToggle
        onChange={(next) => {
          setError(null)
          if (!user) return
          updateMyProfile({ lang: next })
            .then(() => refreshProfile())
            .catch((cause: unknown) => setError(toFrenchError(cause)))
        }}
      />
      {error && (
        <small className="inline-error" role="status">
          {error}
        </small>
      )}
    </div>
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
            <span>
              ★ {project.stars} {lang === 'en' ? 'useful' : 'utiles'}
            </span>
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
  const { signInWithGitHub, signInWithGoogle, signInWithEmail } = useAuth()
  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<'github' | 'google' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleGitHub = async () => {
    setError(null)
    setBusy('github')
    const result = await signInWithGitHub()
    if (result.error) {
      setError(result.error)
      setBusy(null)
    }
  }

  const handleGoogle = async () => {
    setError(null)
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

  return (
    <main className="login">
      <div className="login-theme">
        <LangToggle />
        <ThemeToggle />
      </div>
      <section className="login-brand">
        <img
          src="/assets/bondev-logo.png"
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
        {error && (
          <p className="login-error" role="alert">
            {error}
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
function Filters({
  groups,
  activeCount,
  onReset,
}: {
  groups: {
    title: string
    options: string[]
    selected: string[]
    onToggle: (value: string) => void
  }[]
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
        <fieldset key={group.title}>
          <legend>{group.title}</legend>
          {group.options.length === 0 ? (
            <small className="filter-empty">Aucune option</small>
          ) : (
            group.options.map((option) => (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={group.selected.includes(option)}
                  onChange={() => group.onToggle(option)}
                />
                <span>{option}</span>
              </label>
            ))
          )}
        </fieldset>
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

  const availableTechnologies = useMemo(
    () => uniqueSorted((projects ?? []).flatMap((project) => project.technologies)),
    [projects],
  )
  const availableLicenses = useMemo(
    () => uniqueSorted((projects ?? []).map((project) => project.license)),
    [projects],
  )
  const availableContexts = useMemo(() => {
    const tags = (projects ?? []).flatMap((project) => project.tags)
    return AFRICAN_CONTEXT_TAGS.filter((context) =>
      tags.some((tag) => sameText(tag, context)),
    )
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
                options: availableTechnologies,
                selected: selectedTechnologies,
                onToggle: toggle(setSelectedTechnologies),
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
  const { user } = useAuth()
  const lang = useLang()
  const [busy, setBusy] = useState(false)
  const [used, setUsed] = useState(false)
  const [celebration, setCelebration] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const projectId = project?.id

  useEffect(() => {
    setUsed(false)
    setCelebration(false)
    setActionError(null)
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
    if (!canUse) return
    setBusy(true)
    setActionError(null)
    try {
      await markProjectUsed(project.id)
      setUsed(true)
      setCelebration(true)
      onUsed(project.id)
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
              <b>★ {project.stars}</b>
              <span>{lang === 'en' ? 'Useful' : 'Utiles'}</span>
            </div>
            <div>
              <Icon name="code" size={20} />
              <b>{project.license || '—'}</b>
              <span>Licence</span>
            </div>
          </div>

          <p className="usage-line">
            {lang === 'en' ? 'Used by' : 'Utilisé par'}{' '}
            <b>
              {project.stars} dev{project.stars === 1 ? '' : 's'}
            </b>
          </p>

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

function ShareProject({
  go,
  onPublished,
}: {
  go: (screen: Screen) => void
  onPublished: () => void
}) {
  const lang = useLang()
  const { refreshStats } = useAuth()
  const [repoUrl, setRepoUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [technologies, setTechnologies] = useState('')
  const [license, setLicense] = useState('')
  const [tags, setTags] = useState('')
  const [preview, setPreview] = useState<GithubRepoPreview | null>(null)
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [published, setPublished] = useState<PublishedProject | null>(null)

  const loadRepo = async (value: string) => {
    const ref = parseGithubRepoUrl(value)
    if (!ref) {
      setFetchError(
        'Lien GitHub invalide. Utilise le format https://github.com/pseudo/depot.',
      )
      setPreview(null)
      setFetchedUrl(null)
      return
    }

    setRepoUrl(ref.canonicalUrl)
    setFetching(true)
    setFetchError(null)
    try {
      const info = await fetchGithubRepo(ref.canonicalUrl)
      setPreview(info)
      setFetchedUrl(ref.canonicalUrl)
      setTitle(info.title)
      setDescription(info.description)
      setTechnologies(info.technologies.join(', '))
      setLicense(info.license)
      setTags(info.tags.join(', '))
    } catch (cause) {
      setPreview(null)
      setFetchedUrl(null)
      setFetchError(githubErrorMessage(cause))
    } finally {
      setFetching(false)
    }
  }

  const handleRepoChange = (value: string) => {
    setRepoUrl(value)
    setFetchError(null)
    if (fetchedUrl && value.trim() !== fetchedUrl) {
      setFetchedUrl(null)
      setPreview(null)
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').trim()
    const ref = parseGithubRepoUrl(pasted)
    if (!ref) return
    event.preventDefault()
    setRepoUrl(ref.canonicalUrl)
    void loadRepo(ref.canonicalUrl)
  }

  const handleBlur = () => {
    if (!repoUrl.trim() || fetchedUrl || fetching) return
    void loadRepo(repoUrl)
  }

  const splitList = (value: string): string[] =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPublishError(null)

    const ref = parseGithubRepoUrl(repoUrl)
    if (!ref) {
      setPublishError(
        'Lien GitHub invalide. Utilise le format https://github.com/pseudo/depot.',
      )
      return
    }

    setPublishing(true)
    try {
      const result = await publishProject({
        title,
        description,
        repoUrl: ref.canonicalUrl,
        license,
        technologies: splitList(technologies),
        tags: splitList(tags),
      })
      setPublished(result)
      await refreshStats().catch(() => undefined)
      onPublished()
    } catch (cause) {
      setPublishError(toFrenchError(cause))
    } finally {
      setPublishing(false)
    }
  }

  if (published) {
    return (
      <main className="screen centered">
        <div className="success">
          <Icon name="check" size={38} />
        </div>
        <h1>{lang === 'en' ? 'Project published!' : 'Projet publié !'}</h1>
        <p>
          {published.pointsEarned > 0
            ? lang === 'en'
              ? `Your project is now in the catalogue. You earned +${published.pointsEarned} points.`
              : `Ton projet est maintenant dans le catalogue. Tu gagnes +${published.pointsEarned} points.`
            : lang === 'en'
              ? 'Your project is now in the catalogue. You have already received the points for your first five publications.'
              : 'Ton projet est maintenant dans le catalogue. Tu as déjà reçu les points de tes 5 premières publications.'}
        </p>
        <Primary onClick={() => go('results')}>
          {lang === 'en' ? 'See the catalogue' : 'Voir le catalogue'}
        </Primary>
        <button className="textbtn" onClick={() => go('home')} type="button">
          {lang === 'en' ? 'Back home' : 'Retour à l’accueil'}
        </button>
      </main>
    )
  }

  return (
    <main className="screen">
      <Header
        title={lang === 'en' ? 'Share a project' : 'Partager un projet'}
        back={() => go('home')}
      />
      <form className="form share-form" onSubmit={handlePublish}>
        <p className="eyebrow">
          {lang === 'en' ? 'A public repository is enough' : 'Un dépôt public suffit'}
        </p>
        <h2>{lang === 'en' ? 'Present your project' : 'Présente ton projet'}</h2>

        <label>
          <span>{lang === 'en' ? 'GitHub link' : 'Lien GitHub'}</span>
          <div className="repo-row">
            <input
              className="text-input"
              value={repoUrl}
              onChange={(event) => handleRepoChange(event.target.value)}
              onPaste={handlePaste}
              onBlur={handleBlur}
              placeholder="https://github.com/ton-pseudo/ton-projet"
              autoComplete="url"
              inputMode="url"
            />
            <button
              className="secondary"
              type="button"
              onClick={() => void loadRepo(repoUrl)}
              disabled={fetching || !repoUrl.trim()}
            >
              <Icon name="github" size={18} />{' '}
              {fetching
                ? lang === 'en'
                  ? 'Loading…'
                  : 'Récupération…'
                : lang === 'en'
                  ? 'Fill from GitHub'
                  : 'Remplir depuis GitHub'}
            </button>
          </div>
          {fetchError && (
            <small className="inline-error repo-error" role="status">
              {fetchError}
            </small>
          )}
          {preview?.lastActivity && (
            <small className="github-note">
              {lang === 'en' ? 'GitHub last activity:' : 'Dernière activité sur GitHub :'}{' '}
              {formatRelativeDate(preview.lastActivity, lang)}
            </small>
          )}
        </label>

        <label>
          <span>{lang === 'en' ? 'Project title' : 'Titre du projet'}</span>
          <input
            className="text-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex. Gestion de stock pour petites boutiques"
            maxLength={200}
          />
        </label>

        <label>
          <span>{lang === 'en' ? 'Description' : 'Description'}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={
              lang === 'en'
                ? 'Explain what the project does and who it helps.'
                : 'Explique ce que fait le projet et à qui il sert.'
            }
            maxLength={5000}
          />
        </label>

        <label>
          <span>
            {lang === 'en'
              ? 'Technologies (comma-separated)'
              : 'Technologies (séparées par des virgules)'}
          </span>
          <input
            className="text-input"
            value={technologies}
            onChange={(event) => setTechnologies(event.target.value)}
            placeholder="React, Node.js, PostgreSQL"
          />
        </label>

        <label>
          <span>{lang === 'en' ? 'Licence' : 'Licence'}</span>
          <input
            className="text-input"
            value={license}
            onChange={(event) => setLicense(event.target.value)}
            placeholder="MIT, Apache-2.0, GPL-3.0…"
            maxLength={40}
          />
        </label>

        <label>
          <span>
            {lang === 'en'
              ? 'Tags (comma-separated)'
              : 'Tags (séparés par des virgules)'}
          </span>
          <input
            className="text-input"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Mobile Money, hors-ligne, SMS"
          />
        </label>

        <p className="form-note">
          {lang === 'en'
            ? 'The fields filled from GitHub stay editable.'
            : 'Les champs remplis depuis GitHub restent modifiables.'}
        </p>

        {publishError && (
          <p className="inline-error form-error" role="alert">
            {publishError}
          </p>
        )}

        <Primary type="submit" disabled={publishing}>
          {publishing
            ? lang === 'en'
              ? 'Publishing…'
              : 'Publication…'
            : lang === 'en'
              ? 'Publish project'
              : 'Publier le projet'}
        </Primary>
      </form>
    </main>
  )
}

const QUESTION_DRAFT_PREFIX = 'bondev-question-draft-v1'
const ANSWER_DRAFT_PREFIX = 'bondev-answer-draft-v1'

type QuestionDraft = {
  title: string
  body: string
  technologies: string
  tier: HelpTier
  githubUrl: string
  beginnerOk: boolean
}

type AnswerDraft = {
  body: string
  proofUrl: string
}

const EMPTY_QUESTION_DRAFT: QuestionDraft = {
  title: '',
  body: '',
  technologies: '',
  tier: 1,
  githubUrl: '',
  beginnerOk: false,
}

function readQuestionDraft(key: string): QuestionDraft {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return EMPTY_QUESTION_DRAFT
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return EMPTY_QUESTION_DRAFT
    const tier = Number(parsed.tier)
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      body: typeof parsed.body === 'string' ? parsed.body : '',
      technologies:
        typeof parsed.technologies === 'string' ? parsed.technologies : '',
      tier: isHelpTier(tier) ? tier : 1,
      githubUrl: typeof parsed.githubUrl === 'string' ? parsed.githubUrl : '',
      beginnerOk: parsed.beginnerOk === true,
    }
  } catch {
    return EMPTY_QUESTION_DRAFT
  }
}

function readAnswerDraft(key: string): AnswerDraft {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { body: '', proofUrl: '' }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { body: '', proofUrl: '' }
    return {
      body: typeof parsed.body === 'string' ? parsed.body : '',
      proofUrl: typeof parsed.proofUrl === 'string' ? parsed.proofUrl : '',
    }
  } catch {
    return { body: '', proofUrl: '' }
  }
}

function writeDraft(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Le brouillon est un confort : le formulaire reste utilisable sans lui. */
  }
}

function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* Rien à faire si le stockage local est indisponible. */
  }
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  return online
}

function answerCountLabel(count: number, lang: Lang): string {
  if (lang === 'en') {
    return `${count} ${count === 1 ? 'answer' : 'answers'}`
  }
  return `${count} ${count === 1 ? 'réponse' : 'réponses'}`
}

function HelpAvatar({
  author,
  size = 'normal',
}: {
  author: { pseudo: string; display_name: string; avatar_url: string }
  size?: 'normal' | 'small'
}) {
  const name = author.display_name.trim() || author.pseudo
  const avatar = author.avatar_url.startsWith('https://')
    ? author.avatar_url
    : ''
  return (
    <span className={`help-avatar ${size === 'small' ? 'small' : ''}`}>
      {avatar ? <img src={avatar} alt="" /> : initialsFor(name, author.pseudo)}
    </span>
  )
}

function QuestionSkeleton() {
  return (
    <article className="glass request question-card skeleton-question" aria-hidden="true">
      <span className="skeleton-line short" />
      <span className="skeleton-line wide" />
      <span className="skeleton-line" />
      <span className="skeleton-line short" />
    </article>
  )
}

function Help({ go, openQuestion }: { go: (s: Screen) => void; openQuestion: (id: string) => void }) {
  const lang = useLang()
  const { user } = useAuth()
  const userId = user?.id
  const [tab, setTab] = useState<QuestionTab>('open')
  const [beginnerOnly, setBeginnerOnly] = useState(false)
  const [technology, setTechnology] = useState('')
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [technologies, setTechnologies] = useState<string[]>([])
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setQuestions(null)
    setError(null)
    listQuestions({
      tab,
      beginnerOnly,
      technology: technology || undefined,
    })
      .then((list) => {
        if (active) setQuestions(list)
      })
      .catch((cause: unknown) => {
        if (active) {
          setQuestions([])
          setError(toFrenchError(cause))
        }
      })
    return () => {
      active = false
    }
  }, [tab, beginnerOnly, technology, userId, reload])

  useEffect(() => {
    let active = true
    listQuestionTechnologies()
      .then((list) => {
        if (active) setTechnologies(list)
      })
      .catch(() => {
        /* Le filtre technologie reste optionnel si la lecture échoue. */
      })
    return () => {
      active = false
    }
  }, [reload])

  const tabs: { id: QuestionTab; fr: string; en: string }[] = [
    { id: 'open', fr: 'Ouvertes', en: 'Open' },
    { id: 'resolved', fr: 'Résolues', en: 'Solved' },
    { id: 'mine', fr: 'Mes questions', en: 'My questions' },
  ]

  const emptyTitle =
    tab === 'mine'
      ? lang === 'en'
        ? 'You have not asked a question yet'
        : 'Tu n’as pas encore posé de question'
      : tab === 'resolved'
        ? lang === 'en'
          ? 'No solved questions yet'
          : 'Aucune question résolue pour le moment'
        : lang === 'en'
          ? 'No open questions right now'
          : 'Aucune question ouverte pour le moment'

  const emptyText =
    tab === 'mine'
      ? lang === 'en'
        ? 'Ask for help: the community can unblock you.'
        : 'Demande de l’aide : la communauté peut te débloquer.'
      : tab === 'resolved'
        ? lang === 'en'
          ? 'As soon as an answer is validated, it will appear here.'
          : 'Dès qu’une réponse est validée, elle apparaîtra ici.'
        : lang === 'en'
          ? 'Be the first to ask, or come back soon to help someone.'
          : 'Sois le premier à demander, ou reviens bientôt aider quelqu’un.'

  return (
    <main className="screen">
      <Header title="Entraide" />
      <div className="help-heading">
        <div>
          <p className="eyebrow">La communauté</p>
          <h2>{lang === 'en' ? 'Community questions' : 'Les questions de la communauté'}</h2>
        </div>
        <Primary onClick={() => go('add')} icon="plus">
          Poser ma question
        </Primary>
      </div>

      <div className="help-tabs" role="tablist" aria-label={lang === 'en' ? 'Question filters' : 'Filtres des questions'}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {lang === 'en' ? item.en : item.fr}
          </button>
        ))}
      </div>

      <div className="help-filters">
        <button
          type="button"
          className={`filter-chip ${beginnerOnly ? 'active' : ''}`}
          aria-pressed={beginnerOnly}
          onClick={() => setBeginnerOnly((value) => !value)}
        >
          {lang === 'en' ? 'Beginners welcome' : 'Débutant bienvenu'}
        </button>
        <label className="help-tech-select">
          <span>{lang === 'en' ? 'Technology' : 'Technologie'}</span>
          <select
            value={technology}
            onChange={(event) => setTechnology(event.target.value)}
          >
            <option value="">
              {lang === 'en' ? 'All technologies' : 'Toutes les technologies'}
            </option>
            {technologies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <section className="glass help-state" role="alert">
          <div>
            <Icon name="wifi" size={28} />
          </div>
          <h2>{lang === 'en' ? 'The questions are unavailable' : 'Les questions sont indisponibles'}</h2>
          <p>{error}</p>
          <button className="secondary help-retry" onClick={() => setReload((value) => value + 1)}>
            {lang === 'en' ? 'Try again' : 'Réessayer'}
          </button>
        </section>
      ) : questions === null ? (
        <section className="list question-list" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((item) => (
            <QuestionSkeleton key={item} />
          ))}
        </section>
      ) : questions.length === 0 ? (
        <section className="glass empty help-empty">
          <div>
            <Icon name="handshake" size={30} />
          </div>
          <h2>{emptyTitle}</h2>
          <p>{emptyText}</p>
          {tab === 'mine' && (
            <Primary onClick={() => go('add')} icon="plus">
              Poser ma question
            </Primary>
          )}
        </section>
      ) : (
        <section className="list question-list">
          {questions.map((question) => (
            <button
              className="glass request question-card"
              key={question.id}
              type="button"
              onClick={() => openQuestion(question.id)}
            >
              <div className="question-card-top">
                <span className={`status-pill ${question.status}`}>
                  {statusLabel(question.status, lang)}
                </span>
                <span className="tier-pill">
                  {tierLabel(question.tier, lang)} · {pointsLabel(question.tier, lang)}
                </span>
              </div>
              <div className="question-card-tags">
                {question.beginner_ok && (
                  <span className="mentor-tag">
                    {lang === 'en'
                      ? 'Beginners welcome · +1 mentor bonus'
                      : 'Débutant bienvenu · +1 bonus mentor'}
                  </span>
                )}
                {question.is_free && (
                  <span className="free-pill">
                    {lang === 'en' ? 'Free question' : 'Question gratuite'}
                  </span>
                )}
              </div>
              <h3>{question.title}</h3>
              <p>
                {question.technologies.slice(0, 3).join(' · ') ||
                  (lang === 'en' ? 'No technology specified' : 'Technologie non précisée')}
              </p>
              <div className="question-meta">
                <span>{answerCountLabel(question.answer_count, lang)}</span>
                {question.status === 'open' && (
                  <span>{formatTimeLeft(question.expires_at, lang)}</span>
                )}
                <span>@{question.author.pseudo}</span>
              </div>
              <span className="help-link">
                {lang === 'en' ? 'View question' : 'Voir la question'} <Icon name="arrow" size={18} />
              </span>
            </button>
          ))}
        </section>
      )}
    </main>
  )
}

function QuestionThread({
  questionId,
  back,
}: {
  questionId: string
  back: () => void
}) {
  const lang = useLang()
  const online = useOnline()
  const { user, refreshStats } = useAuth()
  const [thread, setThread] = useState<QuestionThread | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editProof, setEditProof] = useState('')
  const draftKey = user
    ? `${ANSWER_DRAFT_PREFIX}:${questionId}:${user.id}`
    : ''
  const [initialDraft] = useState<AnswerDraft>(() =>
    draftKey ? readAnswerDraft(draftKey) : { body: '', proofUrl: '' },
  )
  const [answerBody, setAnswerBody] = useState(initialDraft.body)
  const [answerProof, setAnswerProof] = useState(initialDraft.proofUrl)

  useEffect(() => {
    let active = true
    setError(null)
    getQuestion(questionId)
      .then((value) => {
        if (active) setThread(value)
      })
      .catch((cause: unknown) => {
        if (active) setError(toFrenchError(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [questionId, reload])

  useEffect(() => {
    if (!draftKey) return
    if (!answerBody.trim() && !answerProof.trim()) {
      clearDraft(draftKey)
      return
    }
    writeDraft(draftKey, { body: answerBody, proofUrl: answerProof })
  }, [draftKey, answerBody, answerProof])

  const question = thread?.question ?? null
  const answers = thread?.answers ?? []
  const isAuthor = Boolean(user && question && user.id === question.author_id)

  const refresh = () => setReload((value) => value + 1)

  const handleValidate = async (answer: Answer) => {
    if (!question || busy || !online) return
    const pseudo = answer.author.pseudo
    const amount = pointsLabel(question.tier, lang)
    const confirmation =
      lang === 'en'
        ? `This will give ${amount} to @${pseudo}. Continue?`
        : `Cela donnera ${amount} à @${pseudo}. Continuer ?`
    if (!window.confirm(confirmation)) return

    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await validateAnswer(answer.id)
      await refreshStats()
      setNotice(
        lang === 'en'
          ? `Thank you! ${amount} transferred to @${pseudo}.`
          : `Merci ! ${amount} transféré${question.tier > 1 ? 's' : ''} à @${pseudo}.`,
      )
      refresh()
    } catch (cause: unknown) {
      setActionError(toFrenchError(cause))
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = async () => {
    if (!question || busy || !online) return
    const refund = question.is_free
      ? lang === 'en'
        ? 'This free question will be withdrawn.'
        : 'Cette question gratuite sera retirée.'
      : lang === 'en'
        ? `${pointsLabel(question.tier, lang)} will be refunded to you.`
        : `${pointsLabel(question.tier, lang)} te seront remboursés.`
    const confirmation =
      lang === 'en'
        ? `Withdraw this question? ${refund}`
        : `Retirer cette question ? ${refund}`
    if (!window.confirm(confirmation)) return

    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await withdrawQuestion(question.id)
      await refreshStats()
      setNotice(
        question.is_free
          ? lang === 'en'
            ? 'Question withdrawn. No points were debited.'
            : 'Question retirée. Aucun point n’avait été débité.'
          : lang === 'en'
            ? `Question withdrawn. ${pointsLabel(question.tier, lang)} refunded to you.`
            : `Question retirée. ${pointsLabel(question.tier, lang)} te sont remboursés.`,
      )
      refresh()
    } catch (cause: unknown) {
      setActionError(toFrenchError(cause))
    } finally {
      setBusy(false)
    }
  }

  const submitAnswer = async (event: FormEvent) => {
    event.preventDefault()
    if (!question || busy || !online) return
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await addAnswer(question.id, answerBody, answerProof)
      if (draftKey) clearDraft(draftKey)
      setAnswerBody('')
      setAnswerProof('')
      setNotice(lang === 'en' ? 'Your answer has been sent.' : 'Ta réponse a bien été envoyée.')
      refresh()
    } catch (cause: unknown) {
      setActionError(toFrenchError(cause))
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (answer: Answer) => {
    setEditingId(answer.id)
    setEditBody(answer.body)
    setEditProof(answer.proof_url)
    setActionError(null)
    setNotice(null)
  }

  const saveEdit = async (event: FormEvent, answer: Answer) => {
    event.preventDefault()
    if (busy || !online) return
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await updateAnswer(answer.id, editBody, editProof)
      setEditingId(null)
      setNotice(lang === 'en' ? 'Your answer has been updated.' : 'Ta réponse a été modifiée.')
      refresh()
    } catch (cause: unknown) {
      setActionError(toFrenchError(cause))
    } finally {
      setBusy(false)
    }
  }

  const removeAnswer = async (answer: Answer) => {
    if (busy || !online) return
    const confirmation =
      lang === 'en'
        ? 'Delete this answer? This cannot be undone.'
        : 'Supprimer cette réponse ? Cette action est définitive.'
    if (!window.confirm(confirmation)) return
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await deleteAnswer(answer.id)
      if (editingId === answer.id) setEditingId(null)
      setNotice(lang === 'en' ? 'Your answer has been deleted.' : 'Ta réponse a été supprimée.')
      refresh()
    } catch (cause: unknown) {
      setActionError(toFrenchError(cause))
    } finally {
      setBusy(false)
    }
  }

  if (loading && !thread) {
    return (
      <main className="screen">
        <Header title="Entraide" back={back} />
        <section className="list question-list" aria-busy="true" aria-live="polite">
          <QuestionSkeleton />
          <QuestionSkeleton />
        </section>
      </main>
    )
  }

  if (error && !thread) {
    return (
      <main className="screen">
        <Header title="Entraide" back={back} />
        <section className="glass help-state" role="alert">
          <div>
            <Icon name="wifi" size={28} />
          </div>
          <h2>{lang === 'en' ? 'This question is unavailable' : 'Cette question est indisponible'}</h2>
          <p>{error}</p>
          <button className="secondary help-retry" onClick={() => setReload((value) => value + 1)}>
            {lang === 'en' ? 'Try again' : 'Réessayer'}
          </button>
        </section>
      </main>
    )
  }

  if (!question) {
    return (
      <main className="screen">
        <Header title="Entraide" back={back} />
        <section className="glass empty help-empty">
          <h2>{lang === 'en' ? 'Question not found' : 'Question introuvable'}</h2>
          <p>{lang === 'en' ? 'It may have been withdrawn or deleted.' : 'Elle a peut-être été retirée ou supprimée.'}</p>
        </section>
      </main>
    )
  }

  const validatedAnswer = answers.find((answer) => answer.is_useful) ?? null
  const canAnswer = Boolean(user) && !isAuthor && question.status === 'open'
  const showOfflineNote = !online

  return (
    <main className="screen">
      <Header title="Entraide" back={back} />

      <section className="glass question-detail thread-question">
        <div className="question-card-top">
          <span className={`status-pill ${question.status}`}>
            {statusLabel(question.status, lang)}
          </span>
          <span className="tier-pill">
            {tierLabel(question.tier, lang)} · {pointsLabel(question.tier, lang)}
          </span>
        </div>
        <div className="question-card-tags">
          {question.beginner_ok && (
            <span className="mentor-tag">
              {lang === 'en'
                ? 'Beginners welcome · +1 mentor bonus'
                : 'Débutant bienvenu · +1 bonus mentor'}
            </span>
          )}
          {question.is_free && (
            <span className="free-pill">
              {lang === 'en' ? 'Free question' : 'Question gratuite'}
            </span>
          )}
        </div>
        <h2>{question.title}</h2>
        <div className="author-line thread-author">
          <HelpAvatar author={question.author} />
          <p>
            <b>{question.author.display_name || question.author.pseudo}</b>
            <small>@{question.author.pseudo}</small>
          </p>
        </div>
        <div className="thread-body">{question.body}</div>
        {question.github_url.startsWith('https://') && (
          <a
            className="thread-github"
            href={question.github_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="github" size={18} />
            {lang === 'en' ? 'View the GitHub link' : 'Voir le lien GitHub'}
            <Icon name="external" size={15} />
          </a>
        )}
        <div className="question-meta thread-meta">
          <span>{answerCountLabel(question.answer_count, lang)}</span>
          {question.status === 'open' && (
            <span>{formatTimeLeft(question.expires_at, lang)}</span>
          )}
          <span>{question.technologies.join(' · ')}</span>
        </div>

        {question.status === 'expired' && (
          <div className="help-notice animated">
            {lang === 'en'
              ? 'This question has expired. Any held points were returned to its author, and new answers are closed.'
              : 'Cette question a expiré. Les points mis de côté ont été rendus à son auteur et les nouvelles réponses sont fermées.'}
          </div>
        )}
        {question.status === 'withdrawn' && (
          <div className="help-notice animated">
            {lang === 'en'
              ? 'This question was withdrawn by its author. New answers are closed.'
              : 'Cette question a été retirée par son auteur. Les nouvelles réponses sont fermées.'}
          </div>
        )}
        {question.status === 'resolved' && validatedAnswer && (
          <div className="help-notice success animated">
            {lang === 'en'
              ? `Solved by @${validatedAnswer.author.pseudo}. The validated answer is highlighted below.`
              : `Résolue grâce à @${validatedAnswer.author.pseudo}. La réponse validée est mise en avant ci-dessous.`}
          </div>
        )}

        {isAuthor && question.status === 'open' && (
          <div className="thread-actions">
            <button
              className="secondary withdraw-btn"
              type="button"
              disabled={busy || !online}
              onClick={() => void handleWithdraw()}
            >
              {busy
                ? lang === 'en'
                  ? 'Working…'
                  : 'Traitement…'
                : lang === 'en'
                  ? 'Withdraw my question'
                  : 'Retirer ma question'}
            </button>
          </div>
        )}
      </section>

      {notice && (
        <div className="glass thanks help-feedback" role="status">
          {notice}
        </div>
      )}
      {actionError && (
        <div className="inline-error form-error help-feedback" role="alert">
          {actionError}
        </div>
      )}

      <div className="answer-title thread-answer-title">
        <h3>{answerCountLabel(answers.length, lang)}</h3>
        <span>{lang === 'en' ? 'Validated answer first' : 'Réponse validée d’abord'}</span>
      </div>

      {answers.length === 0 ? (
        <p className="help-empty-line">
          {lang === 'en' ? 'No answers yet. Your help could unblock this question.' : 'Pas encore de réponse. Ton aide peut débloquer cette question.'}
        </p>
      ) : (
        <section className="thread-answers">
          {answers.map((answer) => {
            const ownAnswer = user?.id === answer.author_id
            const canValidate =
              isAuthor &&
              question.status === 'open' &&
              !answer.is_useful &&
              !ownAnswer
            return (
              <article
                className={`answer thread-answer ${answer.is_useful ? 'validated' : ''}`}
                key={answer.id}
              >
                <div className="answer-head">
                  <HelpAvatar author={answer.author} size="small" />
                  <b>{answer.author.display_name || answer.author.pseudo}</b>
                  <small>
                    @{answer.author.pseudo}
                    {answer.level ? ` · ${answer.level}` : ''}
                  </small>
                  {answer.is_useful && (
                    <em>{lang === 'en' ? 'Useful ✓' : 'Utile ✓'}</em>
                  )}
                </div>

                {editingId === answer.id ? (
                  <form className="answer-edit" onSubmit={(event) => void saveEdit(event, answer)}>
                    <textarea
                      className="text-input answer-textarea"
                      value={editBody}
                      maxLength={10000}
                      onChange={(event) => setEditBody(event.target.value)}
                      aria-label={lang === 'en' ? 'Edit your answer' : 'Modifier ta réponse'}
                    />
                    <input
                      className="text-input"
                      value={editProof}
                      placeholder={
                        lang === 'en'
                          ? 'Proof: GitHub link (optional)'
                          : 'Preuve : lien GitHub (facultatif)'
                      }
                      onChange={(event) => setEditProof(event.target.value)}
                    />
                    <div className="answer-actions">
                      <button
                        className="secondary small-action"
                        type="submit"
                        disabled={busy || !online || !editBody.trim()}
                      >
                        {lang === 'en' ? 'Save' : 'Enregistrer'}
                      </button>
                      <button
                        className="ghost small-action"
                        type="button"
                        onClick={() => setEditingId(null)}
                      >
                        {lang === 'en' ? 'Cancel' : 'Annuler'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="answer-body">{answer.body}</p>
                    {answer.proof_url.startsWith('https://') && (
                      <a
                        className="proof-link"
                        href={answer.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="github" size={16} />
                        {lang === 'en' ? 'View proof' : 'Voir la preuve'}
                      </a>
                    )}
                  </>
                )}

                <div className="answer-actions">
                  {canValidate && (
                    <button
                      className="secondary small-action useful-action"
                      type="button"
                      disabled={busy || !online}
                      onClick={() => void handleValidate(answer)}
                    >
                      {lang === 'en' ? 'Useful ✓' : 'Utile ✓'}
                    </button>
                  )}
                  {ownAnswer && !answer.is_useful && editingId !== answer.id && (
                    <>
                      <button
                        className="ghost small-action"
                        type="button"
                        disabled={busy || !online}
                        onClick={() => startEdit(answer)}
                      >
                        {lang === 'en' ? 'Edit' : 'Modifier'}
                      </button>
                      <button
                        className="ghost small-action"
                        type="button"
                        disabled={busy || !online}
                        onClick={() => void removeAnswer(answer)}
                      >
                        {lang === 'en' ? 'Delete' : 'Supprimer'}
                      </button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}

      {showOfflineNote && (
        <p className="help-offline-note" role="status">
          <Icon name="wifi" size={16} />
          {lang === 'en'
            ? 'Offline: sending is disabled. Your drafts stay on this device.'
            : 'Hors-ligne : les envois sont désactivés. Tes brouillons restent sur cet appareil.'}
        </p>
      )}

      {!user && (
        <section className="glass help-state signin-invite">
          <h2>{lang === 'en' ? 'Sign in to answer' : 'Connecte-toi pour répondre'}</h2>
          <p>
            {lang === 'en'
              ? 'You can read the conversation now. Sign in when you want to help.'
              : 'Tu peux lire la conversation maintenant. Connecte-toi quand tu veux aider.'}
          </p>
        </section>
      )}

      {canAnswer && (
        <form className="glass answer-form" onSubmit={(event) => void submitAnswer(event)}>
          <h3>{lang === 'en' ? 'Your answer' : 'Ta réponse'}</h3>
          <textarea
            className="text-input answer-textarea"
            value={answerBody}
            maxLength={10000}
            placeholder={
              lang === 'en'
                ? 'Explain the fix simply, step by step…'
                : 'Explique la solution simplement, étape par étape…'
            }
            onChange={(event) => setAnswerBody(event.target.value)}
            aria-label={lang === 'en' ? 'Your answer' : 'Ta réponse'}
          />
          <input
            className="text-input"
            value={answerProof}
            placeholder={
              lang === 'en'
                ? 'Proof: GitHub link (optional)'
                : 'Preuve : lien GitHub (facultatif)'
            }
            onChange={(event) => setAnswerProof(event.target.value)}
          />
          <p className="form-note">
            {lang === 'en'
              ? 'Your draft is saved on this device.'
              : 'Ton brouillon est enregistré sur cet appareil.'}
          </p>
          <Primary type="submit" disabled={busy || !online || !answerBody.trim()}>
            {busy
              ? lang === 'en'
                ? 'Sending…'
                : 'Envoi…'
              : lang === 'en'
                ? 'Send my answer'
                : 'Envoyer ma réponse'}
          </Primary>
          {!online && (
            <p className="form-note offline-reason">
              {lang === 'en'
                ? 'Sending is disabled while you are offline.'
                : 'L’envoi est désactivé tant que tu es hors-ligne.'}
            </p>
          )}
        </form>
      )}

      {isAuthor && question.status === 'open' && (
        <p className="form-note owner-note">
          {lang === 'en'
            ? 'This is your question: choose the answer that helped you most.'
            : 'C’est ta question : choisis la réponse qui t’a le plus aidé.'}
        </p>
      )}
    </main>
  )
}

function Add({
  go,
  onPosted,
}: {
  go: (s: Screen) => void
  onPosted: (questionId: string) => void
}) {
  const lang = useLang()
  const online = useOnline()
  const { user, stats, refreshStats } = useAuth()
  const userId = user?.id ?? 'anon'
  const draftKey = `${QUESTION_DRAFT_PREFIX}:${userId}`
  const [draft, setDraft] = useState<QuestionDraft>(() => readQuestionDraft(draftKey))
  const [freeAvailable, setFreeAvailable] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setFreeAvailable(null)
    isFreeQuestionAvailable()
      .then((value) => {
        if (active) setFreeAvailable(value)
      })
      .catch(() => {
        if (active) setFreeAvailable(false)
      })
    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    const empty =
      !draft.title.trim() &&
      !draft.body.trim() &&
      !draft.technologies.trim() &&
      !draft.githubUrl.trim() &&
      !draft.beginnerOk &&
      draft.tier === 1
    if (empty) {
      clearDraft(draftKey)
      return
    }
    writeDraft(draftKey, draft)
  }, [draft, draftKey])

  const balance = stats?.balance ?? 0
  const balanceKnown = Boolean(stats)
  const canAfford = balanceKnown && balance >= draft.tier
  const freeTier = draft.tier === 1
  const canUseFree = !canAfford && freeTier && freeAvailable === true
  const canPost = canAfford || canUseFree
  const balanceAfter = canAfford ? balance - draft.tier : canUseFree ? balance : null

  const updateDraft = (changes: Partial<QuestionDraft>) => {
    setDraft((current) => ({ ...current, ...changes }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting || !online || !canPost) return
    setSubmitting(true)
    setError(null)
    try {
      const questionId = await postQuestion({
        title: draft.title,
        body: draft.body,
        technologies: draft.technologies.split(','),
        tier: draft.tier,
        githubUrl: draft.githubUrl,
        beginnerOk: draft.beginnerOk,
      })
      clearDraft(draftKey)
      await refreshStats()
      onPosted(questionId)
    } catch (cause: unknown) {
      setError(toFrenchError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  const tierHints: Record<HelpTier, { fr: string; en: string }> = {
    1: { fr: 'Pour une petite question rapide', en: 'For a small quick question' },
    3: { fr: 'Pour un vrai blocage', en: 'For a real blocker' },
    6: { fr: 'Pour un problème complexe', en: 'For a complex problem' },
  }

  return (
    <main className="screen">
      <Header title="Demander de l’aide" back={() => go('help')} />
      <form className="form help-ask-form" onSubmit={(event) => void handleSubmit(event)}>
        <p className="eyebrow">Explique simplement</p>
        <h2>Où es-tu bloqué ?</h2>

        <label>
          <span>{lang === 'en' ? 'Question title' : 'Titre de la question'}</span>
          <input
            className="text-input"
            value={draft.title}
            maxLength={300}
            placeholder={
              lang === 'en'
                ? 'E.g. My Mobile Money payment returns an error'
                : 'Ex. Mon paiement Mobile Money affiche une erreur'
            }
            onChange={(event) => updateDraft({ title: event.target.value })}
          />
        </label>

        <label>
          <span>{lang === 'en' ? 'Description' : 'Description'}</span>
          <textarea
            value={draft.body}
            maxLength={10000}
            placeholder={
              lang === 'en'
                ? 'What did you try? What error do you see?'
                : 'Qu’as-tu essayé ? Quel message d’erreur vois-tu ?'
            }
            onChange={(event) => updateDraft({ body: event.target.value })}
          />
        </label>

        <label>
          <span>{lang === 'en' ? 'Technology' : 'Technologie'}</span>
          <input
            className="text-input"
            value={draft.technologies}
            placeholder="React, Node.js, PostgreSQL"
            onChange={(event) => updateDraft({ technologies: event.target.value })}
          />
        </label>
        <p className="form-note">
          {lang === 'en' ? 'Separate technologies with commas.' : 'Sépare les technologies par des virgules.'}
        </p>

        <fieldset className="tier-fieldset">
          <legend>{lang === 'en' ? 'Choose your help level' : 'Choisis ton palier d’aide'}</legend>
          <div className="tier-options" role="radiogroup">
            {([1, 3, 6] as HelpTier[]).map((tier) => (
              <button
                key={tier}
                type="button"
                role="radio"
                aria-checked={draft.tier === tier}
                className={`glass tier-option ${draft.tier === tier ? 'active' : ''}`}
                onClick={() => updateDraft({ tier })}
              >
                <span>
                  <b>{tierLabel(tier, lang)}</b>
                  <small>{tierHints[tier][lang]}</small>
                </span>
                <strong>{pointsLabel(tier, lang)}</strong>
              </button>
            ))}
          </div>
          <p className="form-note tier-note">
            {lang === 'en'
              ? 'A question stays open for 7 days. Points are set aside and refunded if nobody helps.'
              : 'Une question reste ouverte 7 jours. Les points sont mis de côté et rendus si personne ne t’aide.'}
          </p>
        </fieldset>

        <label>
          <span>{lang === 'en' ? 'GitHub link (optional)' : 'Lien GitHub (facultatif)'}</span>
          <input
            className="text-input"
            value={draft.githubUrl}
            placeholder="https://github.com/ton-pseudo/ton-projet"
            onChange={(event) => updateDraft({ githubUrl: event.target.value })}
          />
        </label>

        <label className="check-line">
          <input
            type="checkbox"
            checked={draft.beginnerOk}
            onChange={(event) => updateDraft({ beginnerOk: event.target.checked })}
          />
          <span>
            <b>{lang === 'en' ? 'Beginners welcome' : 'Débutant bienvenu'}</b>
            <small>
              {lang === 'en'
                ? 'A beginner can answer and earn a mentor bonus.'
                : 'Un débutant peut répondre et gagner un bonus mentor.'}
            </small>
          </span>
        </label>

        <div className={`balance-after ${canPost ? '' : 'muted'}`}>
          <span>{lang === 'en' ? 'Your balance after posting' : 'Ton solde après publication'}</span>
          <b>
            {!balanceKnown
              ? '—'
              : balanceAfter === null
                ? lang === 'en'
                  ? 'Not enough points'
                  : 'Solde insuffisant'
                : `${balanceAfter} ${lang === 'en' ? 'pts' : 'points'}`}
          </b>
          {canUseFree && (
            <small>
              {lang === 'en'
                ? 'Free question: no points are deducted.'
                : 'Question gratuite : aucun point n’est déduit.'}
            </small>
          )}
        </div>

        {balanceKnown && !canAfford && freeTier && freeAvailable === true && (
          <div className="glass free-question-card">
            <Icon name="star" size={22} />
            <div>
              <h3>{lang === 'en' ? 'Free question available' : 'Question gratuite disponible'}</h3>
              <p>
                {lang === 'en'
                  ? '1 left this week. It covers the Quick help level (1 point).'
                  : '1 restante cette semaine. Elle couvre le palier Coup de pouce (1 point).'}
              </p>
            </div>
          </div>
        )}

        {balanceKnown && !canAfford && !freeTier && freeAvailable === true && (
          <div className="glass free-question-card">
            <Icon name="star" size={22} />
            <div>
              <h3>{lang === 'en' ? 'Your free question is still available' : 'Ta question gratuite est encore disponible'}</h3>
              <p>
                {lang === 'en'
                  ? 'It only covers the Quick help level (1 point). Choose it to post for free.'
                  : 'Elle couvre seulement le palier Coup de pouce (1 point). Choisis-le pour publier gratuitement.'}
              </p>
              <button
                className="ghost small-action"
                type="button"
                onClick={() => updateDraft({ tier: 1 })}
              >
                {lang === 'en' ? 'Choose Quick help (1 point)' : 'Choisir Coup de pouce (1 point)'}
              </button>
            </div>
          </div>
        )}

        {balanceKnown && !canAfford && freeAvailable === false && (
          <section className="glass earn help-earn">
            <h3>{lang === 'en' ? 'Earn points in 2 minutes' : 'Gagne des points en 2 minutes'}</h3>
            <p>
              {lang === 'en'
                ? 'Your free question is already used this week. Two quick ways to earn points:'
                : 'Ta question gratuite est déjà utilisée cette semaine. Deux façons rapides de gagner des points :'}
            </p>
            <button type="button" onClick={() => go('help')}>
              {lang === 'en' ? 'Answer a beginner question' : 'Répondre à une question débutant'}
              <Icon name="arrow" size={18} />
            </button>
            <button type="button" onClick={() => go('share')}>
              {lang === 'en' ? 'Share a project' : 'Partager un projet'}
              <Icon name="arrow" size={18} />
            </button>
          </section>
        )}

        {balanceKnown && !canAfford && freeAvailable === null && (
          <p className="form-note">
            {lang === 'en'
              ? 'Checking whether your free question is available…'
              : 'Vérification de ta question gratuite…'}
          </p>
        )}

        {!online && (
          <p className="help-offline-note" role="status">
            <Icon name="wifi" size={16} />
            {lang === 'en'
              ? 'Offline: posting is disabled. Your draft stays on this device.'
              : 'Hors-ligne : la publication est désactivée. Ton brouillon reste sur cet appareil.'}
          </p>
        )}

        {error && (
          <p className="inline-error form-error" role="alert">
            {error}
          </p>
        )}

        <Primary
          type="submit"
          disabled={submitting || !online || !balanceKnown || !canPost}
        >
          {submitting
            ? lang === 'en'
              ? 'Publishing…'
              : 'Publication…'
            : canUseFree
              ? lang === 'en'
                ? 'Ask my free question (1 left this week)'
                : 'Poser ma question gratuite (1 restante cette semaine)'
              : !canPost && balanceKnown
                ? lang === 'en'
                  ? 'Not enough points'
                  : 'Solde insuffisant'
                : lang === 'en'
                  ? 'Publish my question'
                  : 'Publier ma question'}
        </Primary>

        <p className="form-note">
          {lang === 'en'
            ? 'Your draft is saved on this device and removed after publishing.'
            : 'Ton brouillon est enregistré sur cet appareil et effacé après publication.'}
        </p>
      </form>
    </main>
  )
}

function Profile() {
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
  const totalEarned = stats?.total_earned ?? 0
  const info = levelInfo(totalEarned)

  const progressLabel = stats
    ? info.next
      ? lang === 'en'
        ? `${info.remaining} more points to reach ${info.next.en}`
        : `Encore ${info.remaining} points pour le niveau ${info.next.name}`
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
              <b className="stats-level">{stats?.level ?? '—'}</b>
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
          <section className="section profile">
            <h2>Spécialités</h2>
            <div className="specialties">
              {[
                ['Mobile Money', '86%'],
                ['React', '72%'],
                ['Node.js', '64%'],
              ].map((x) => (
                <div key={x[0]}>
                  <span>{x[0]}</span>
                  <i>
                    <b style={{ width: x[1] }} />
                  </i>
                </div>
              ))}
            </div>
            <h2>Mes badges</h2>
            <div className="badges">
              <div>
                <Icon name="trophy" />
                <span>Première réponse</span>
              </div>
              <div>
                <Icon name="code" />
                <span>Nouvelle voix</span>
              </div>
              <div>
                <Icon name="handshake" />
                <span>Bienveillant</span>
              </div>
            </div>
            <div className="impact">
              <div>
                <b>17 h</b>
                <span>d’aide données</span>
              </div>
              <div>
                <b>6</b>
                <span>projets partagés</span>
              </div>
            </div>
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
        <img src="/assets/bondev-logo.png" alt="Bondev" />
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
      <img src="/assets/bondev-logo.png" alt="" />
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

  const userId = session?.user.id
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
              {activeScreen === 'profile' && <Profile />}{' '}
              {activeScreen === 'states' && <States go={go} />}
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
          </>
        )}
      </div>
    </div>
  )
}
