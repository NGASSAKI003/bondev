import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { startTranslator } from './i18n'
import { AuthProvider } from './lib/auth'
import { supabaseConfigError } from './lib/supabase'

startTranslator()
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
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
