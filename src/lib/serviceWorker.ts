/**
 * Enregistrement du service worker et détection des mises à jour.
 *
 * Le worker reste en attente tant que l'utilisateur n'a pas cliqué sur
 * « Actualiser » : un déploiement ne remplace jamais l'application ouverte
 * sous ses pieds.
 */
type UpdateListener = () => void

const listeners = new Set<UpdateListener>()
let registration: ServiceWorkerRegistration | null = null
let waitingWorker: ServiceWorker | null = null
let updateAvailable = false
let lastUpdateCheck = 0
let reloading = false

function emit(): void {
  for (const listener of listeners) listener()
}

function announce(worker: ServiceWorker): void {
  if (updateAvailable && waitingWorker === worker) return
  waitingWorker = worker
  updateAvailable = true
  emit()
}

export function subscribeToServiceWorker(listener: UpdateListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function serviceWorkerUpdateAvailable(): boolean {
  return updateAvailable
}

function watchWorker(worker: ServiceWorker): void {
  const check = () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      announce(worker)
    }
  }
  if (worker.state === 'installed') {
    check()
    return
  }
  worker.addEventListener('statechange', check)
}

async function checkForUpdate(): Promise<void> {
  if (!registration) return
  const now = Date.now()
  if (now - lastUpdateCheck < 30 * 60 * 1000) return
  lastUpdateCheck = now
  try {
    await registration.update()
  } catch {
    // Hors ligne : la prochaine visite réessaiera.
  }
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((value) => {
        registration = value
        if (value.waiting && navigator.serviceWorker.controller) {
          announce(value.waiting)
        }
        if (value.installing) watchWorker(value.installing)
        value.addEventListener('updatefound', () => {
          if (value.installing) watchWorker(value.installing)
        })
      })
      .catch(() => {
        // L'application fonctionne normalement sans service worker.
      })
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
}

export function applyServiceWorkerUpdate(): void {
  if (reloading) return
  reloading = true

  const worker = waitingWorker
  if (!worker) {
    window.location.reload()
    return
  }

  let done = false
  let fallback = 0
  const reload = () => {
    if (done) return
    done = true
    window.clearTimeout(fallback)
    window.location.reload()
  }

  navigator.serviceWorker.addEventListener('controllerchange', reload, {
    once: true,
  })
  worker.postMessage({ type: 'SKIP_WAITING' })
  fallback = window.setTimeout(reload, 2500)
}
