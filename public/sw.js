/*
 * Service worker Bondev.
 *
 * Stratégies :
 * - navigation : réseau d'abord, cache de secours ;
 * - fichiers statiques : cache d'abord puis rafraîchissement en arrière-plan ;
 * - jamais de cache pour les requêtes authentifiées ni pour les autres origines
 *   (Supabase, GitHub, avatars).
 *
 * Le jeton de version est remplacé au build par scripts/build-artifacts.mjs :
 * chaque déploiement obtient donc un cache neuf, et les anciens sont purgés.
 */
const VERSION = '__BUILD_VERSION__'
const CACHE = 'bondev-' + VERSION
const CACHE_PREFIX = 'bondev-'
const PRECACHE = [
  '/',
  '/theme-init.js',
  '/manifest.webmanifest',
  '/favicon.png',
  '/assets/bondev-logo-192.webp',
]
const CACHEABLE_DESTINATIONS = new Set(['style', 'script', 'font', 'image'])

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(PRECACHE.map((path) => cache.add(path))),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

function offlineResponse() {
  return new Response(
    '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Bondev</title>' +
      '<p>Le service est momentanément indisponible, réessaie dans un instant.</p>',
    {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  )
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    const url = new URL(request.url)
    // On ne mémorise que la coquille publique, jamais un retour OAuth.
    if (
      response.ok &&
      response.type === 'basic' &&
      url.pathname === '/' &&
      !url.search
    ) {
      const cache = await caches.open(CACHE)
      await cache.put('/', response.clone())
    }
    return response
  } catch {
    const cached = await caches.match('/')
    return cached || offlineResponse()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok && response.type === 'basic') {
        void cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)
  if (cached) return cached
  const response = await network
  return response || Response.error()
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  // Les appels authentifiés ne doivent jamais finir dans le cache.
  if (request.headers.has('authorization')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (
    url.pathname !== '/sw.js' &&
    CACHEABLE_DESTINATIONS.has(request.destination)
  ) {
    event.respondWith(cacheFirst(request))
  }
})
