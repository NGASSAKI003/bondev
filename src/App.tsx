import { LangToggle, useLang, type Lang } from './i18n'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  getMyLedger,
  toFrenchError,
  updateMyProfile,
  type LedgerEntry,
} from './lib/api'
import { useAuth } from './lib/auth'

type Screen =
  | 'login'
  | 'home'
  | 'results'
  | 'help'
  | 'add'
  | 'profile'
  | 'states'
const projects = [
  [
    'Gestion de stock pour petites boutiques',
    'Suivre les produits, les ventes et les alertes de stock.',
    'React · Node.js',
    'MIT',
    'Il y a 2 jours',
  ],
  [
    'Intégration Mobile Money MTN et Airtel',
    'Accepter facilement les paiements sur le web.',
    'Node.js · API',
    'Apache 2.0',
    'Il y a 5 jours',
  ],
  [
    'Formulaires qui marchent sans connexion',
    'Enregistrer les réponses, même sans réseau.',
    'JavaScript · PWA',
    'MIT',
    'Il y a 1 semaine',
  ],
]
const requests = [
  ['Erreur lors du paiement Mobile Money', 'Node.js', 'Urgent', '2'],
  ['Comment héberger mon API Node ?', 'Node.js', 'Cette semaine', '1'],
]

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
function Project({
  p,
  compact = false,
  open,
  why,
}: {
  p: string[]
  compact?: boolean
  open: () => void
  why?: string
}) {
  return (
    <article className={`glass project ${compact ? 'compact' : ''}`}>
      <div className="project-icon">
        <Icon name="code" />
      </div>
      <div>
        <h3>{p[0]}</h3>
        <p>{p[1]}</p>
        {why && (
          <p className="why">
            <b>Pourquoi ce projet :</b> {why}
          </p>
        )}
        {!compact && (
          <div className="meta">
            <span>{p[2]}</span>
            <span>{p[3]}</span>
            <span>{p[4]}</span>
          </div>
        )}
      </div>
      {compact ? (
        <button className="arrow" onClick={open} aria-label="Voir le projet">
          <Icon name="arrow" />
        </button>
      ) : (
        <button className="secondary" onClick={open}>
          Voir le projet <Icon name="arrow" size={18} />
        </button>
      )}
    </article>
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
function Home({ go }: { go: (s: Screen) => void }) {
  const { profile } = useAuth()
  const lang = useLang()
  const greetingName =
    profile?.display_name.trim() ||
    profile?.pseudo ||
    (lang === 'en' ? 'developer' : 'développeur')
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
            <button className="searchbox" onClick={() => go('results')}>
              <Icon name="search" />
              <span>Décris ton besoin : ex. gérer le stock d’une boutique</span>
              <kbd>Ctrl + K</kbd>
            </button>
            <p className="smart">
              ✦ Recherche intelligente : décris ton besoin avec tes mots
            </p>
            <div className="chips-wrap">
              <div className="chips">
                {[
                  'Mobile Money',
                  'Gestion de stock',
                  'Fonctionne hors-ligne',
                ].map((x) => (
                  <button key={x} onClick={() => go('results')}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <div className="tablet-cards">
            <PointsCard />
            <Rising />
          </div>
          <section className="section">
            <div className="section-title">
              <h2>Projets récents</h2>
              <button onClick={() => go('results')}>Tout voir</button>
            </div>
            <div className="list project-grid">
              {projects.map((p) => (
                <Project key={p[0]} p={p} compact open={() => go('results')} />
              ))}
            </div>
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
function Filters() {
  const groups: [string, string[]][] = [
    ['Technologie', ['React', 'Node.js', 'JavaScript']],
    ['Licence', ['MIT', 'Apache 2.0']],
    [
      'Contexte africain',
      ['Mobile Money', 'USSD', 'Hors-ligne', 'Faible connexion'],
    ],
    ['Langue', ['Français', 'Anglais']],
  ]
  return (
    <aside className="glass filters">
      <h2>Filtres</h2>
      {groups.map((g) => (
        <fieldset key={g[0]}>
          <legend>{g[0]}</legend>
          {g[1].map((x) => (
            <label key={x}>
              <input type="checkbox" />
              <span>{x}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </aside>
  )
}
function Results({ go }: { go: (s: Screen) => void }) {
  const [filters, setFilters] = useState(false)
  return (
    <main className="screen">
      <Header title="3 projets trouvés" back={() => go('home')} />
      <div className="query glass">
        <Icon name="search" />
        <span>Mobile Money</span>
        <button className="filter-trigger" onClick={() => setFilters(true)}>
          Filtres
        </button>
        <button onClick={() => go('home')}>Modifier</button>
      </div>
      <section className="glass understood">
        <b>✦ Bondev a compris :</b> tu cherches une solution pour accepter des
        paiements Mobile Money (MTN, Airtel) sur le web.
      </section>
      <div className="results-layout">
        <div className={`filter-panel ${filters ? 'open' : ''}`}>
          <button className="filter-close" onClick={() => setFilters(false)}>
            Fermer
          </button>
          <Filters />
        </div>
        <div>
          <div className="list results">
            {projects.map((p, i) => (
              <Project
                key={p[0]}
                p={p}
                why={
                  [
                    'Le paiement Mobile Money fait partie de ses fonctions.',
                    'Il gère MTN et Airtel avec une licence libre.',
                    'Il marche aussi quand la connexion est faible.',
                  ][i]
                }
                open={() =>
                  alert(`${p[0]}\n\nProjet open source prêt à explorer.`)
                }
              />
            ))}
          </div>
          <p className="catalog-note">
            Résultats choisis parmi les projets du catalogue.
          </p>
          <section className="glass help-cta">
            <div className="help-icon">
              <Icon name="handshake" size={30} />
            </div>
            <div>
              <h2>Rien ne convient ?</h2>
              <p>Un développeur peut t’aider.</p>
            </div>
            <Primary onClick={() => go('add')}>Demander de l’aide</Primary>
          </section>
        </div>
      </div>
    </main>
  )
}
function Help({ go }: { go: (s: Screen) => void }) {
  const [detail, setDetail] = useState(false)
  const [thanks, setThanks] = useState(false)
  return (
    <main className="screen">
      <Header title="Entraide" />
      <div className="help-heading">
        <div>
          <p className="eyebrow">La communauté</p>
          <h2>Questions ouvertes</h2>
        </div>
        <Primary onClick={() => go('add')} icon="plus">
          Poser ma question
        </Primary>
      </div>
      <div className={`help-layout ${detail ? 'show-detail' : ''}`}>
        <section className="list question-list">
          {requests.map((r, i) => (
            <button
              className="glass request"
              key={r[0]}
              onClick={() => setDetail(true)}
            >
              <div className="request-top">
                <span className={r[2] === 'Urgent' ? 'hot' : ''}>{r[2]}</span>
                <b>+{r[3]} pts</b>
              </div>
              {i === 0 && (
                <div className="mentor-tag">
                  Débutant bienvenu · +1 bonus mentor
                </div>
              )}
              <h3>{r[0]}</h3>
              <p>{r[1]} · Niveau 2</p>
              <span className="help-link">
                Voir la question <Icon name="arrow" size={18} />
              </span>
            </button>
          ))}
        </section>
        <section className="glass question-detail">
          <button className="detail-back" onClick={() => setDetail(false)}>
            <Icon name="back" /> Retour aux questions
          </button>
          <div className="mentor-tag">Débutant bienvenu · +1 bonus mentor</div>
          <h2>Erreur lors du paiement Mobile Money</h2>
          <p>
            Mon appel API retourne une erreur après la validation du numéro.
            Comment trouver ce qui bloque ?
          </p>
          <div className="author-line">
            <span>AD</span>
            <p>
              <b>Amadou D.</b>
              <small>Niveau 2</small>
            </p>
          </div>
          <div className="answer-title">
            <h3>2 réponses</h3>
            <span>Triées par Utile ✓</span>
          </div>
          <article className="answer">
            <div>
              <b>Fatou M.</b>
              <small>Niveau 3</small>
              <em>Utile ✓</em>
            </div>
            <p>
              Vérifie d’abord le format international du numéro, puis journalise
              le code reçu par l’API.
            </p>
          </article>
          <article className="answer">
            <div>
              <b>Koffi A.</b>
              <small>Niveau 1</small>
            </div>
            <p>
              Le mode test utilise parfois un numéro différent de celui de
              production.
            </p>
            <button className="secondary" onClick={() => setThanks(true)}>
              Utile ✓
            </button>
          </article>
          {thanks && (
            <div className="glass thanks" role="status">
              Merci ! 1 point a été transféré à Koffi.
            </div>
          )}
          <input
            className="text-input"
            placeholder="Preuve : lien GitHub (issue, pull request), facultatif"
          />
          <Primary onClick={() => alert('Réponse ouverte')}>
            Répondre simplement
          </Primary>
        </section>
      </div>
    </main>
  )
}
function Add({ go }: { go: (s: Screen) => void }) {
  const [sent, setSent] = useState(false)
  if (sent)
    return (
      <main className="screen centered">
        <div className="success">
          <Icon name="check" size={38} />
        </div>
        <h1>Question envoyée</h1>
        <p>La communauté va bientôt te répondre.</p>
        <Primary onClick={() => go('help')}>Voir les demandes</Primary>
      </main>
    )
  return (
    <main className="screen">
      <Header title="Demander de l’aide" back={() => go('help')} />
      <section className="form">
        <p className="eyebrow">Explique simplement</p>
        <h2>Où es-tu bloqué ?</h2>
        <label>
          <span>Ta question</span>
          <textarea placeholder="Ex. Mon paiement Mobile Money affiche une erreur…" />
        </label>
        <label>
          <span>Lien GitHub de ton projet (facultatif)</span>
          <input
            className="text-input"
            placeholder="https://github.com/ton-pseudo/ton-projet"
          />
        </label>
        <label>
          <span>Technologie</span>
          <button className="select">
            Choisir <Icon name="chevron" />
          </button>
        </label>
        <div className="glass kindness">
          <Icon name="handshake" />
          <div>
            <h3>Pas de souci</h3>
            <p>Tu peux quand même demander de l’aide.</p>
          </div>
        </div>
        <p className="hold-note">
          Les points offerts sont mis de côté et donnés à la personne qui t’aide
          quand tu valides sa réponse. Si personne ne t’aide en 7 jours, ils te
          sont rendus.
        </p>
        <Primary onClick={() => setSent(true)}>
          Poser ma question gratuite <span>(1 restante cette semaine)</span>
        </Primary>
        <section className="glass earn">
          <h3>Gagne des points en 2 minutes</h3>
          {[
            'Répondre à une question débutant',
            'Partager un projet',
            'Compléter ton profil',
          ].map((x) => (
            <button key={x}>
              {x}
              <Icon name="arrow" size={18} />
            </button>
          ))}
        </section>
      </section>
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
            active === x[0] || (active === 'results' && x[0] === 'home')
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
    }
  }, [loading, session])
  const go = (s: Screen) => {
    setScreen(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
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
              {activeScreen === 'home' && <Home go={go} />}{' '}
              {activeScreen === 'results' && <Results go={go} />}{' '}
              {activeScreen === 'help' && <Help go={go} />}{' '}
              {activeScreen === 'add' && <Add go={go} />}{' '}
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
                      closeSheet(() => alert('Formulaire de partage de projet'))
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
