import type { Lang } from '../i18n'
import { getSupabase } from './supabase'

export const PROFILE_COLUMNS =
  'id,pseudo,display_name,avatar_url,bio,github_url,lang'

export type Profile = {
  id: string
  pseudo: string
  display_name: string
  avatar_url: string
  bio: string
  github_url: string
  lang: Lang
}

export type ProfileRow = {
  id: string
  pseudo: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  github_url: string | null
  lang: string | null
}

export type ProfileStats = {
  balance: number
  total_earned: number
  level: string
}

export type PointReason =
  | 'signup'
  | 'hold'
  | 'reward'
  | 'refund'
  | 'project_publish'
  | 'project_used'
  | 'free_question'

export type LedgerEntry = {
  id: string
  delta: number
  reason: PointReason | 'unknown'
  /** Libellé lisible en français, traduit ensuite par le dictionnaire i18n. */
  reasonLabel: string
  created_at: string
}

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    'pseudo' | 'display_name' | 'avatar_url' | 'bio' | 'github_url' | 'lang'
  >
>

const POINT_REASONS: readonly PointReason[] = [
  'signup',
  'hold',
  'reward',
  'refund',
  'project_publish',
  'project_used',
  'free_question',
]

const REASON_LABELS: Record<PointReason | 'unknown', string> = {
  signup: 'Bonus d’inscription',
  hold: 'Points mis de côté',
  reward: 'Récompense reçue',
  refund: 'Remboursement',
  project_publish: 'Publication d’un projet',
  project_used: 'Projet jugé utile',
  free_question: 'Question gratuite',
  unknown: 'Mouvement de points',
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

type ErrorShape = {
  name: string
  message: string
  code: string
  status: number
}

function readErrorShape(error: unknown): ErrorShape {
  if (typeof error === 'object' && error !== null) {
    const value = error as Record<string, unknown>
    return {
      name: typeof value.name === 'string' ? value.name : '',
      message: typeof value.message === 'string' ? value.message : '',
      code: typeof value.code === 'string' ? value.code : '',
      status: typeof value.status === 'number' ? value.status : 0,
    }
  }
  return {
    name: '',
    message: typeof error === 'string' ? error : '',
    code: '',
    status: 0,
  }
}

/** Transforme une erreur technique en message français simple, sans détail sensible. */
export function toFrenchError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  const { name, message, code, status } = readErrorShape(error)
  const lower = message.toLowerCase()

  if (name === 'AuthSessionMissingError' || lower.includes('auth session missing')) {
    return 'Ta session a expiré. Reconnecte-toi.'
  }
  if (lower.includes('jwt expired') || lower.includes('token is expired')) {
    return 'Ta session a expiré. Reconnecte-toi.'
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network error') ||
    lower.includes('load failed') ||
    lower.includes('network request failed')
  ) {
    return 'Impossible de contacter le serveur. Vérifie ta connexion et réessaie.'
  }
  if (
    status === 429 ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return 'Trop de tentatives. Patiente un moment avant de réessayer.'
  }
  if (code === '23505') {
    return 'Cette information est déjà utilisée.'
  }
  if (
    code === '42501' ||
    lower.includes('row-level security') ||
    lower.includes('permission denied')
  ) {
    return 'Tu n’as pas le droit de faire cette action.'
  }
  if (
    lower.includes('invalid email') ||
    lower.includes('unable to validate email') ||
    (lower.includes('email') && lower.includes('invalid'))
  ) {
    return 'Cette adresse email n’est pas valide.'
  }
  if (
    lower.includes('email link is invalid or has expired') ||
    lower.includes('token has expired') ||
    lower.includes('otp has expired')
  ) {
    return 'Ce lien de connexion n’est pas valide ou a expiré. Demande-en un nouveau.'
  }
  if (
    lower.includes('provider is not enabled') ||
    lower.includes('unsupported provider')
  ) {
    return 'Ce mode de connexion n’est pas activé. Choisis une autre méthode.'
  }
  if (lower.includes('signup is disabled') || lower.includes('signups not allowed')) {
    return 'La création de compte est désactivée pour le moment.'
  }
  if (lower.includes('user already registered')) {
    return 'Un compte existe déjà avec cette adresse email.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme ton adresse email avant de te connecter.'
  }
  return 'Une erreur est survenue. Réessaie dans un instant.'
}

export function isUniqueViolation(error: unknown): boolean {
  return readErrorShape(error).code === '23505'
}

/** Un lien de profil GitHub doit rester sur github.com. */
function isGithubLink(value: string): boolean {
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

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(toFrenchError(error))
}

async function requireUserId(): Promise<string> {
  try {
    const { data, error } = await getSupabase().auth.getSession()
    if (error) throw error
    const id = data.session?.user.id
    if (!id) throw new ApiError('Ta session a expiré. Reconnecte-toi.')
    return id
  } catch (error) {
    throw asApiError(error)
  }
}

export function normaliseProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    pseudo: row.pseudo,
    display_name: row.display_name ?? '',
    avatar_url: row.avatar_url ?? '',
    bio: row.bio ?? '',
    github_url: row.github_url ?? '',
    lang: row.lang === 'en' ? 'en' : 'fr',
  }
}

function isPointReason(value: string): value is PointReason {
  return (POINT_REASONS as readonly string[]).includes(value)
}

/** Solde, total gagné et niveau de l'utilisateur connecté (vue profile_stats). */
export async function getMyStats(): Promise<ProfileStats> {
  try {
    const userId = await requireUserId()
    const { data, error } = await getSupabase()
      .from('profile_stats')
      .select('balance,total_earned,level')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      throw new ApiError(
        'Tes statistiques ne sont pas encore disponibles. Reconnecte-toi.',
      )
    }

    const row = data as {
      balance: number | null
      total_earned: number | null
      level: string | null
    }

    return {
      balance: Number(row.balance ?? 0),
      total_earned: Number(row.total_earned ?? 0),
      level: row.level ?? 'Étincelle',
    }
  } catch (error) {
    throw asApiError(error)
  }
}

/** Les écritures du registre de points de l'utilisateur connecté. */
export async function getMyLedger(limit = 20): Promise<LedgerEntry[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(100, Math.max(1, Math.trunc(limit)))
    : 20

  try {
    const userId = await requireUserId()
    const { data, error } = await getSupabase()
      .from('points_ledger')
      .select('id,delta,reason,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (error) throw error

    const rows = (data ?? []) as {
      id: string
      delta: number
      reason: string
      created_at: string
    }[]

    return rows.map((row) => {
      const reason = isPointReason(row.reason) ? row.reason : 'unknown'
      return {
        id: row.id,
        delta: Number(row.delta),
        reason,
        reasonLabel: REASON_LABELS[reason],
        created_at: row.created_at,
      }
    })
  } catch (error) {
    throw asApiError(error)
  }
}

/** Met à jour uniquement les colonnes autorisées par les droits Supabase. */
export async function updateMyProfile(
  changes: ProfileUpdate,
): Promise<Profile> {
  try {
    const userId = await requireUserId()
    const payload: Record<string, string> = {}

    if (changes.pseudo !== undefined) {
      const pseudo = changes.pseudo.trim()
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(pseudo)) {
        throw new ApiError(
          'Le pseudo doit contenir entre 3 et 30 caractères (lettres, chiffres, _ ou -).',
        )
      }
      payload.pseudo = pseudo
    }

    if (changes.display_name !== undefined) {
      const displayName = changes.display_name.trim()
      if (displayName.length > 80) {
        throw new ApiError('Le nom affiché ne doit pas dépasser 80 caractères.')
      }
      payload.display_name = displayName
    }

    if (changes.bio !== undefined) {
      const bio = changes.bio.trim()
      if (bio.length > 500) {
        throw new ApiError('La bio ne doit pas dépasser 500 caractères.')
      }
      payload.bio = bio
    }

    if (changes.avatar_url !== undefined) {
      const link = changes.avatar_url.trim()
      if (link && !link.startsWith('https://')) {
        throw new ApiError('Le lien doit commencer par https://.')
      }
      payload.avatar_url = link
    }

    if (changes.github_url !== undefined) {
      const link = changes.github_url.trim()
      if (link && !isGithubLink(link)) {
        throw new ApiError('Le lien GitHub doit pointer vers github.com.')
      }
      payload.github_url = link
    }

    if (changes.lang !== undefined) {
      if (changes.lang !== 'fr' && changes.lang !== 'en') {
        throw new ApiError('La langue choisie n’est pas valide.')
      }
      payload.lang = changes.lang
    }

    if (Object.keys(payload).length === 0) {
      throw new ApiError('Aucune modification à enregistrer.')
    }

    const { data, error } = await getSupabase()
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single()

    if (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError('Ce pseudo est déjà pris. Essaie un autre.')
      }
      throw error
    }
    if (!data) {
      throw new ApiError('Ton profil est introuvable. Reconnecte-toi.')
    }

    return normaliseProfile(data as ProfileRow)
  } catch (error) {
    throw asApiError(error)
  }
}
