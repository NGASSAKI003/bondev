export type HelpLang = 'fr' | 'en'
export type HelpTier = 1 | 3 | 6
export type HelpStatus = 'open' | 'resolved' | 'expired' | 'withdrawn'

export const HELP_TIERS: readonly HelpTier[] = [1, 3, 6]

const TIER_LABELS: Record<HelpTier, { fr: string; en: string }> = {
  1: { fr: 'Coup de pouce', en: 'Quick help' },
  3: { fr: 'Aide moyenne', en: 'Medium help' },
  6: { fr: 'Gros coup de main', en: 'Big helping hand' },
}

const STATUS_LABELS: Record<HelpStatus, { fr: string; en: string }> = {
  open: { fr: 'Ouverte', en: 'Open' },
  resolved: { fr: 'Résolue ✓', en: 'Solved ✓' },
  expired: { fr: 'Expirée', en: 'Expired' },
  withdrawn: { fr: 'Retirée', en: 'Withdrawn' },
}

export function isHelpTier(value: number): value is HelpTier {
  return value === 1 || value === 3 || value === 6
}

export function tierLabel(tier: HelpTier, lang: HelpLang = 'fr'): string {
  return TIER_LABELS[tier][lang]
}

export function statusLabel(
  status: HelpStatus,
  lang: HelpLang = 'fr',
): string {
  return STATUS_LABELS[status][lang]
}

export function pointsLabel(points: number, lang: HelpLang = 'fr'): string {
  const value = Math.max(0, Math.trunc(points))
  if (lang === 'en') return `${value} ${value === 1 ? 'point' : 'points'}`
  return `${value} ${value === 1 ? 'point' : 'points'}`
}

export const QUESTION_TITLE_MIN = 5
export const QUESTION_TITLE_MAX = 300
export const QUESTION_BODY_MIN = 10
export const QUESTION_BODY_MAX = 10000

export type QuestionFormField =
  | 'title'
  | 'body'
  | 'technologies'
  | 'tier'
  | 'githubUrl'

export type QuestionFormErrors = Partial<
  Record<QuestionFormField, string>
>

export type QuestionFormValues = {
  title: string
  body: string
  technologies: string | readonly string[]
  tier: number
  githubUrl?: string
}

const QUESTION_FIELD_ORDER: readonly QuestionFormField[] = [
  'title',
  'body',
  'technologies',
  'tier',
  'githubUrl',
]

/** Découpe et nettoie une liste de technologies saisie avec des virgules. */
export function parseQuestionTechnologies(
  value: string | readonly string[],
): string[] {
  const values = typeof value === 'string' ? value.split(',') : value
  const cleaned: string[] = []
  for (const item of values) {
    const technology = item.trim()
    if (technology && !cleaned.includes(technology)) cleaned.push(technology)
  }
  return cleaned
}

function isQuestionGithubLink(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'github.com' || url.hostname === 'www.github.com') &&
      url.pathname !== '/' &&
      url.pathname !== ''
    )
  } catch {
    return false
  }
}

/**
 * Validation pure du formulaire de question. Les messages indiquent le champ
 * fautif et les limites attendues, pour être affichés directement sous le champ.
 */
export function validateQuestionForm(
  values: QuestionFormValues,
  lang: HelpLang = 'fr',
): QuestionFormErrors {
  const errors: QuestionFormErrors = {}
  const title = values.title.trim()
  const body = values.body.trim()
  const technologies = parseQuestionTechnologies(values.technologies)
  const githubUrl = (values.githubUrl ?? '').trim()

  if (title.length < QUESTION_TITLE_MIN || title.length > QUESTION_TITLE_MAX) {
    errors.title =
      lang === 'en'
        ? `The title must be between ${QUESTION_TITLE_MIN} and ${QUESTION_TITLE_MAX} characters.`
        : `Le titre doit contenir entre ${QUESTION_TITLE_MIN} et ${QUESTION_TITLE_MAX} caractères.`
  }

  if (body.length < QUESTION_BODY_MIN) {
    errors.body =
      lang === 'en'
        ? `The description must contain at least ${QUESTION_BODY_MIN} characters explaining what is blocking you.`
        : `La description doit contenir au moins ${QUESTION_BODY_MIN} caractères pour expliquer ton blocage.`
  } else if (body.length > QUESTION_BODY_MAX) {
    errors.body =
      lang === 'en'
        ? `The description must not exceed ${QUESTION_BODY_MAX.toLocaleString('en-US')} characters.`
        : `La description ne doit pas dépasser ${QUESTION_BODY_MAX.toLocaleString('fr-FR')} caractères.`
  }

  if (technologies.length === 0) {
    errors.technologies =
      lang === 'en'
        ? 'Choose at least one technology, separated by commas.'
        : 'Choisis au moins une technologie, séparée par des virgules.'
  }

  if (!isHelpTier(values.tier)) {
    errors.tier =
      lang === 'en'
        ? 'Choose a valid level: 1, 3 or 6 points.'
        : 'Choisis un palier valide : 1, 3 ou 6 points.'
  }

  if (githubUrl && !isQuestionGithubLink(githubUrl)) {
    errors.githubUrl =
      lang === 'en'
        ? 'The GitHub link must start with https://github.com/ and point to a page.'
        : 'Le lien GitHub doit commencer par https://github.com/ et pointer vers une page.'
  }

  return errors
}

/** Premier champ invalide, dans l’ordre visuel du formulaire. */
export function firstQuestionFormField(
  errors: QuestionFormErrors,
): QuestionFormField | null {
  return QUESTION_FIELD_ORDER.find((field) => Boolean(errors[field])) ?? null
}

/** Premier message de validation, utile pour les appels API. */
export function firstQuestionFormError(
  errors: QuestionFormErrors,
): string | null {
  const field = firstQuestionFormField(errors)
  return field ? (errors[field] ?? null) : null
}

/**
 * Temps restant avant l’expiration d’une question. Les jours sont arrondis au
 * supérieur : une question qui expire dans 4 jours et 2 heures reste « 5 j ».
 */
export function formatTimeLeft(
  expiresAt: string | number | Date,
  lang: HelpLang = 'fr',
  now: number = Date.now(),
): string {
  const date =
    expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
  const target = date.getTime()
  if (!Number.isFinite(target)) return ''
  if (target <= now) return lang === 'en' ? 'Expired' : 'Expirée'

  const day = 24 * 60 * 60 * 1000
  const remaining = target - now
  if (remaining < day) {
    return lang === 'en' ? 'Expires today' : 'Expire aujourd’hui'
  }
  const days = Math.ceil(remaining / day)
  if (lang === 'en') return `Expires in ${days} d`
  return `Expire dans ${days} j`
}

/**
 * Traduit uniquement les erreurs connues de l’Entraide. Retourne null pour
 * laisser `toFrenchError` gérer les erreurs générales.
 */
export function translateHelpError(error: unknown): string | null {
  const raw =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null
        ? typeof (error as { message?: unknown }).message === 'string'
          ? String((error as { message: string }).message)
          : ''
        : ''
  if (!raw) return null

  const text = raw
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (text.includes('solde insuffisant')) {
    return 'Solde insuffisant. Choisis un palier plus petit ou utilise ta question gratuite.'
  }
  if (text.includes('maximum 10 questions ouvertes')) {
    return 'Tu as déjà 10 questions ouvertes. Attends qu’une se termine ou retire-en une.'
  }
  if (text.includes('une reponse a deja ete validee')) {
    return 'Une réponse a déjà été validée pour cette question.'
  }
  if (text.includes('seul l\'auteur de la question peut valider')) {
    return 'Seul l’auteur de la question peut valider une réponse.'
  }
  if (text.includes('impossible de valider sa propre reponse')) {
    return 'Tu ne peux pas valider ta propre réponse.'
  }
  if (text.includes('cette reponse est masquee')) {
    return 'Cette réponse n’est plus disponible.'
  }
  if (text.includes("question n'est plus ouverte")) {
    return 'Cette question n’est plus ouverte.'
  }
  if (text.includes('impossible de retirer une question avec une reponse validee')) {
    return 'Impossible de retirer une question dont une réponse a déjà été validée.'
  }
  if (text.includes('seul l\'auteur peut retirer sa question')) {
    return 'Seul l’auteur peut retirer sa question.'
  }
  if (text.includes('question introuvable')) {
    return 'Cette question n’existe plus.'
  }
  if (text.includes('reponse introuvable')) {
    return 'Cette réponse n’existe plus.'
  }
  if (text.includes('palier invalide')) {
    return 'Choisis un palier valide : 1, 3 ou 6 points.'
  }
  if (text.includes('non authentifie')) {
    return 'Connecte-toi pour faire cette action.'
  }
  if (text.includes('profil introuvable')) {
    return 'Ton profil est introuvable. Reconnecte-toi.'
  }
  return null
}
