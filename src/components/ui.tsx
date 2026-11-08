import { useEffect, useState, type ReactNode } from 'react'
import { LangToggle, useLang } from '../i18n'
import { toFrenchError, updateMyProfile } from '../lib/api'
import { useAuth } from '../lib/auth'

// Briques visuelles communes aux écrans (icônes, en-tête, boutons).

export function initialsFor(name: string, pseudo: string): string {
  const source = (name.trim() || pseudo.trim()).replace(/\s+/g, ' ')
  const parts = source.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase() || '?'
}


const FILLED_ICONS: Record<string, ReactNode> = {
  home: (
    <path d="M3 10.7a2 2 0 0 1 .74-1.55l7-6a2 2 0 0 1 2.52 0l7 6A2 2 0 0 1 21 10.7V19a2 2 0 0 1-2 2h-4.6v-5.2a2.4 2.4 0 0 0-4.8 0V21H5a2 2 0 0 1-2-2Z" />
  ),
  help: (
    <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4.2" />
      <path d="M4.4 21a7.6 7.6 0 0 1 15.2 0Z" />
    </>
  ),
  book: (
    <path d="M6.5 2A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22H20V2Zm0 2H18v14H6.5a2.5 2.5 0 0 0-.5.05V4.5A.5.5 0 0 1 6.5 4Z" />
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" stroke="var(--bd-surface, #0c1124)" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
}

/** Dégradé de marque partagé par les icônes et les contours SVG. */
export function BrandGradientDefs() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1EA7FF" />
          <stop offset="0.54" stopColor="#2F6BFF" />
          <stop offset="1" stopColor="#7B3FF2" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Icon({
  name,
  size = 22,
  filled = false,
  gradient = false,
}: {
  name: string
  size?: number
  /** Icône pleine, utilisée pour l’état actif de la navigation. */
  filled?: boolean
  /** Trait peint avec le dégradé de marque. */
  gradient?: boolean
}) {
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
    flame: (
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    lock: (
      <>
        <rect width="18" height="11" x="3" y="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
  }
  const isFilled = filled && Boolean(FILLED_ICONS[name])
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFilled ? 'url(#brand-gradient)' : 'none'}
      stroke={isFilled ? 'none' : gradient ? 'url(#brand-gradient)' : 'currentColor'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isFilled ? FILLED_ICONS[name] : p[name]}
    </svg>
  )
}

export function ThemeToggle() {
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
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#050816' : '#eef3ff')
  }, [dark])
  return (
    <button
      className="theme-toggle"
      onClick={() => setDark(!dark)}
      aria-label={`Passer au thème ${dark ? 'clair' : 'sombre'}`}
      title={`Passer au thème ${dark ? 'clair' : 'sombre'}`}
      type="button"
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
      <span>{dark ? 'Clair' : 'Sombre'}</span>
    </button>
  )
}
export function Primary({
  children,
  onClick,
  icon,
  disabled = false,
  loading = false,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  icon?: string
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      className="primary"
      onClick={onClick}
      disabled={disabled}
      type={type}
      aria-busy={loading || undefined}
    >
      {icon && <Icon name={icon} />} {children}
    </button>
  )
}
export function Header({
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
          <img
            src="/assets/bondev-logo-48.webp"
            srcSet="/assets/bondev-logo-48.webp 48w, /assets/bondev-logo-96.webp 96w"
            sizes="30px"
            width={48}
            height={48}
            alt=""
          />
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
              ? undefined
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

export function AccountLangToggle({ compact = false }: { compact?: boolean }) {
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

export function ScreenSkeleton() {
  return (
    <main className="screen" aria-busy="true" aria-label="Chargement de l’écran">
      <div className="topbar" />
      <div className="screen-skeleton glass">
        <span className="skeleton-line short" />
        <span className="skeleton-line wide" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
      </div>
    </main>
  )
}
