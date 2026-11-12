/**
 * Historique local des recherches.
 *
 * Cinq entrées au maximum, dédoublonnées sans tenir compte de la casse. Le
 * module ne touche au stockage que par petites fonctions sûres : un navigateur
 * qui refuse localStorage laisse simplement la recherche fonctionner.
 */

const RECENT_KEY = 'bondev-recent-searches-v1'
const DISABLED_KEY = 'bondev-recent-searches-disabled-v1'
export const RECENT_SEARCH_LIMIT = 5

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function readRecentSearches(): string[] {
  const store = storage()
  if (!store) return []
  try {
    const parsed: unknown = JSON.parse(store.getItem(RECENT_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const list: string[] = []
    for (const item of parsed) {
      if (typeof item !== 'string') continue
      const value = clean(item)
      const key = value.toLowerCase()
      if (!value || seen.has(key)) continue
      seen.add(key)
      list.push(value)
      if (list.length === RECENT_SEARCH_LIMIT) break
    }
    return list
  } catch {
    return []
  }
}

function writeRecentSearches(values: string[]): string[] {
  const store = storage()
  if (store) {
    try {
      store.setItem(RECENT_KEY, JSON.stringify(values))
    } catch {
      /* L'historique est un confort, jamais un prérequis. */
    }
  }
  return values
}

export function recordRecentSearch(
  query: string,
  current: readonly string[] = readRecentSearches(),
): string[] {
  const value = clean(query)
  if (!value) return [...current]
  const key = value.toLowerCase()
  return writeRecentSearches([
    value,
    ...current.filter((item) => item.toLowerCase() !== key),
  ].slice(0, RECENT_SEARCH_LIMIT))
}

export function removeRecentSearch(
  query: string,
  current: readonly string[] = readRecentSearches(),
): string[] {
  const key = query.toLowerCase()
  return writeRecentSearches(current.filter((item) => item.toLowerCase() !== key))
}

export function clearRecentSearches(): string[] {
  return writeRecentSearches([])
}

export function recentSearchesDisabled(): boolean {
  const store = storage()
  if (!store) return false
  try {
    return store.getItem(DISABLED_KEY) === 'on'
  } catch {
    return false
  }
}

export function setRecentSearchesDisabled(disabled: boolean): void {
  const store = storage()
  if (!store) return
  try {
    if (disabled) store.setItem(DISABLED_KEY, 'on')
    else store.removeItem(DISABLED_KEY)
  } catch {
    /* Rien à faire : le réglage reste simplement absent. */
  }
}
