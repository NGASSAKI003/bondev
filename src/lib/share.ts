import { buildHash, type Route } from './router'

/** Domaine public : un lien partagé depuis le site doit rester absolu. */
export const SITE_ORIGIN = 'https://bondev.ngassakindzaa.workers.dev'

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

export type SharePayload = {
  title: string
  text?: string
  url: string
}

/** Lien absolu et canonique d'une route Bondev. */
export function shareUrlFor(route: Route): string {
  return `${SITE_ORIGIN}/${buildHash(route)}`
}

type ShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>
}

/** Copie de secours, y compris sur les navigateurs sans Clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* On tente l'ancienne méthode juste après. */
    }
  }
  if (typeof document === 'undefined') return false
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(area)
    return copied
  } catch {
    return false
  }
}

/**
 * Partage natif quand il existe, copie sinon. Une fermeture volontaire de la
 * feuille de partage (`AbortError`) n'est pas une erreur et n'affiche rien.
 */
export async function shareLink(payload: SharePayload): Promise<ShareOutcome> {
  const nav =
    typeof navigator === 'undefined' ? null : (navigator as ShareNavigator)
  if (typeof nav?.share === 'function') {
    try {
      await nav.share(payload)
      return 'shared'
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        return 'cancelled'
      }
      // Un navigateur peut refuser le partage (permission, iframe…) : le
      // presse-papiers reste une réponse utile.
    }
  }
  return (await copyText(payload.url)) ? 'copied' : 'failed'
}
