import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { startTranslator } from './i18n'
import { AuthProvider } from './lib/auth'
import {
  applyEffects,
  probeFrameMedian,
  readEffectsPreference,
  writeEffectsPreference,
} from './lib/effects'
import { supabaseConfigError } from './lib/supabase'

startTranslator()
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}

/**
 * Pose les préférences qui pilotent le fond animé avant le premier rendu :
 * onglet caché et Économie de données coupent les halos sans attendre React.
 */
function syncRuntimePreferences() {
  const root = document.documentElement
  root.dataset.activity = document.hidden ? 'hidden' : 'visible'
  try {
    const saved = localStorage.getItem('bondev-data-saver')
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection
    root.dataset.saver =
      saved === 'on' || (saved !== 'off' && connection?.saveData === true)
        ? 'on'
        : 'off'
  } catch {
    root.dataset.activity = document.hidden ? 'hidden' : 'visible'
  }
}

syncRuntimePreferences()

/**
 * Applique le mode d'effets avant React : les signaux matériels (saveData,
 * mémoire, cœurs) sont immédiats. Une sonde de 2 s affine ensuite le choix
 * sur les appareils qui semblent puissants mais rament au démarrage.
 */
let effectsPreference = readEffectsPreference(
  typeof localStorage === 'undefined' ? null : localStorage,
)
writeEffectsPreference(
  effectsPreference,
  typeof localStorage === 'undefined' ? null : localStorage,
)
applyEffects(effectsPreference)

const probeEffects = () => {
  if (effectsPreference !== 'auto') return
  if (document.documentElement.dataset.effects === 'light') return
  if (document.visibilityState !== 'visible') return
  void probeFrameMedian().then(() => applyEffects(effectsPreference))
}

if (document.readyState === 'complete') {
  window.setTimeout(probeEffects, 320)
} else {
  window.addEventListener('load', () => window.setTimeout(probeEffects, 320), {
    once: true,
  })
}

document.addEventListener('visibilitychange', syncRuntimePreferences)

/** Fait disparaître le splash HTML après le montage de React. */
function hideSplash() {
  const splash = document.getElementById('splash')
  if (!splash) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  splash.classList.add('splash-out')
  window.setTimeout(() => splash.remove(), reduce ? 0 : 520)
}

function ConfigurationScreen() {
  return (
    <div className="shell">
      <div className="phone" data-nav="none">
        <main className="loading-screen">
          <img
            src="/assets/bondev-logo-192.webp"
            width={192}
            height={192}
            alt=""
          />
          <h1>Configuration requise</h1>
          <p>{supabaseConfigError}</p>
          <p className="config-hint">
            VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY
          </p>
        </main>
      </div>
    </div>
  )
}

type BoundaryProps = { children: React.ReactNode }
type BoundaryState = { hasError: boolean }

class AppErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="shell">
          <div className="phone" data-nav="none">
            <main className="loading-screen" role="alert">
              <img
                src="/assets/bondev-logo-192.webp"
                width={192}
                height={192}
                alt=""
              />
              <h1>Oups, quelque chose s'est mal passé</h1>
              <p>Recharge l’application pour continuer.</p>
              <button
                className="primary"
                onClick={() => window.location.reload()}
              >
                Recharger
              </button>
            </main>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {supabaseConfigError ? (
      <ConfigurationScreen />
    ) : (
      <AppErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppErrorBoundary>
    )}
  </React.StrictMode>,
)

// Laisse React peindre son premier écran avant de révéler l'application.
window.requestAnimationFrame(() => {
  window.setTimeout(hideSplash, 60)
})
