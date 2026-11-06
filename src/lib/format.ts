import type { Lang } from '../i18n'

/** Date relative courte, par ex. « il y a 3 jours » / « 3 days ago ». */
export function formatRelativeDate(value: string, lang: Lang): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return lang === 'en' ? 'just now' : 'à l’instant'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return lang === 'en'
      ? `${minutes} minute${minutes > 1 ? 's' : ''} ago`
      : `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return lang === 'en'
      ? `${hours} hour${hours > 1 ? 's' : ''} ago`
      : `il y a ${hours} heure${hours > 1 ? 's' : ''}`
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    return lang === 'en'
      ? `${days} day${days > 1 ? 's' : ''} ago`
      : `il y a ${days} jour${days > 1 ? 's' : ''}`
  }

  const weeks = Math.floor(days / 7)
  if (days < 30) {
    return lang === 'en'
      ? `${weeks} week${weeks > 1 ? 's' : ''} ago`
      : `il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`
  }

  const months = Math.floor(days / 30)
  if (days < 365) {
    return lang === 'en'
      ? `${months} month${months > 1 ? 's' : ''} ago`
      : `il y a ${months} mois`
  }

  const years = Math.floor(days / 365)
  return lang === 'en'
    ? `${years} year${years > 1 ? 's' : ''} ago`
    : `il y a ${years} an${years > 1 ? 's' : ''}`
}

/** Date et heure lisibles pour la mention « Dernière mise à jour ». */
export function formatDateTime(value: number, lang: Lang): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/** Date courte de l'historique des points. */
export function formatLedgerDate(value: string, lang: Lang): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
