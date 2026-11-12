/**
 * Routeur de Bondev.
 *
 * Le site est servi en statique avec un repli SPA : les écrans vivent donc
 * derrière le fragment d'URL, jamais devant. Ce module reste pur (aucun accès
 * à `window`) pour être testé facilement et pour que le parseur et le
 * constructeur partagent exactement les mêmes règles.
 */

export type Route =
  | { name: 'home' }
  | { name: 'results'; query: string }
  | { name: 'project'; id: string }
  | { name: 'help' }
  | { name: 'question'; id: string }
  | { name: 'add' }
  | { name: 'share' }
  | { name: 'profile' }
  | { name: 'how' }
  | { name: 'login' }
  | { name: 'states' }
  | { name: 'diagnostic' }
  | { name: 'notFound'; path: string }

export type RouteName = Route['name']

/** Les identifiants Supabase sont des UUID : tout le reste est une 404. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidRouteId(value: string): boolean {
  return UUID_PATTERN.test(value)
}

const SCREEN_ROUTES: Record<
  Exclude<RouteName, 'notFound' | 'results' | 'project' | 'question'>,
  string
> = {
  home: '/',
  help: '/entraide',
  add: '/ajouter',
  share: '/partager',
  profile: '/profil',
  how: '/regles',
  login: '/connexion',
  states: '/etats',
  diagnostic: '/diagnostic',
}

/**
 * Lit un fragment (`#/projet/…`) et renvoie une route sûre.
 *
 * - une valeur vide correspond à l'accueil ;
 * - `/recherche` sans paramètre garde une requête vide ;
 * - `q` est décodé une seule fois, les `+` d'un formulaire restent des espaces ;
 * - un identifiant qui n'est pas un UUID, une route inconnue ou un fragment
 *   mal encodé renvoient `notFound` plutôt que de lever une exception.
 */
export function parseHash(hash: string): Route {
  let raw = (hash ?? '').trim()
  if (raw.startsWith('#')) raw = raw.slice(1)
  if (!raw || raw === '/') return { name: 'home' }

  // Un fragment de type `#contenu` n'est pas une route de l'application.
  if (!raw.startsWith('/')) return notFound(raw)

  const queryAt = raw.indexOf('?')
  const rawPath = queryAt >= 0 ? raw.slice(0, queryAt) : raw
  const rawSearch = queryAt >= 0 ? raw.slice(queryAt + 1) : ''

  let path: string
  try {
    path = decodeURIComponent(rawPath)
  } catch {
    return notFound(rawPath)
  }

  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return { name: 'home' }

  if (segments.length === 1) {
    switch (segments[0]) {
      case 'recherche':
        return { name: 'results', query: readQuery(rawSearch) }
      case 'entraide':
        return { name: 'help' }
      case 'ajouter':
        return { name: 'add' }
      case 'partager':
        return { name: 'share' }
      case 'profil':
        return { name: 'profile' }
      case 'regles':
        return { name: 'how' }
      case 'connexion':
        return { name: 'login' }
      case 'etats':
        return { name: 'states' }
      case 'diagnostic':
        return { name: 'diagnostic' }
      default:
        return notFound(path)
    }
  }

  if (segments.length === 2) {
    const id = segments[1]
    if (segments[0] === 'projet') {
      return isValidRouteId(id)
        ? { name: 'project', id: id.toLowerCase() }
        : notFound(path)
    }
    if (segments[0] === 'entraide') {
      return isValidRouteId(id)
        ? { name: 'question', id: id.toLowerCase() }
        : notFound(path)
    }
  }

  return notFound(path)
}

function readQuery(rawSearch: string): string {
  if (!rawSearch) return ''
  let params: URLSearchParams
  try {
    params = new URLSearchParams(rawSearch)
  } catch {
    return ''
  }
  return params.get('q')?.trim() ?? ''
}

function notFound(path: string): Route {
  return { name: 'notFound', path: path.startsWith('/') ? path : `/${path}` }
}

/**
 * Construit le fragment canonique d'une route. Les paramètres sont encodés
 * pour qu'un titre accentué ou un identifiant ne casse jamais le lien.
 */
export function buildHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'results':
      return route.query ? `#/recherche?q=${encodeURIComponent(route.query)}` : '#/recherche'
    case 'project':
      return `#/projet/${encodeURIComponent(route.id.toLowerCase())}`
    case 'question':
      return `#/entraide/${encodeURIComponent(route.id.toLowerCase())}`
    case 'notFound':
      return `#${route.path.startsWith('/') ? route.path : `/${route.path}`}`
    default:
      return `#${SCREEN_ROUTES[route.name]}`
  }
}

/** Clé stable d'un écran, utile pour les titres et les caches. */
export function routeKey(route: Route): string {
  switch (route.name) {
    case 'project':
    case 'question':
      return `${route.name}:${route.id}`
    case 'results':
      return `results:${route.query}`
    case 'notFound':
      return `notFound:${route.path}`
    default:
      return route.name
  }
}

/**
 * Compare deux routes sans tenir compte de la casse des identifiants.
 * Sert à éviter d'empiler deux fois la même entrée d'historique.
 */
export function sameRoute(a: Route, b: Route): boolean {
  return buildHash(a) === buildHash(b)
}
