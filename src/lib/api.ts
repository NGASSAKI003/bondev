import type { Lang } from '../i18n'
import {
  isHelpTier,
  translateHelpError,
  type HelpStatus,
  type HelpTier,
} from './help'
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

export type ProjectAuthor = {
  id: string
  pseudo: string
  display_name: string
  avatar_url: string
}

export type Project = {
  id: string
  author_id: string
  title: string
  description: string
  repo_url: string
  license: string
  technologies: string[]
  tags: string[]
  stars: number
  last_activity: string
  created_at: string
  author: ProjectAuthor
}

export type ProjectRow = {
  id: string
  author_id: string
  title: string
  description: string | null
  repo_url: string | null
  license: string | null
  technologies: unknown
  tags: unknown
  stars: number | null
  last_activity: string | null
  created_at: string | null
  author?: unknown
}

export type PublishProjectInput = {
  title: string
  description: string
  repoUrl: string
  license: string
  technologies: string[]
  tags: string[]
}

export type PublishedProject = {
  id: string
  /** 3 pour les 5 premières publications, 0 ensuite (règle de la base). */
  pointsEarned: number
}

export type QuestionTab = 'open' | 'resolved' | 'mine'

export type QuestionFilter = {
  tab?: QuestionTab
  beginnerOnly?: boolean
  technology?: string
}

export type Question = {
  id: string
  author_id: string
  title: string
  body: string
  technologies: string[]
  tier: HelpTier
  github_url: string
  beginner_ok: boolean
  status: HelpStatus
  is_free: boolean
  expires_at: string
  validated_answer_id: string | null
  created_at: string
  updated_at: string
  author: ProjectAuthor
  answer_count: number
}

export type QuestionRow = {
  id: string
  author_id: string
  title: string
  body: string | null
  technologies: unknown
  tier: number | null
  github_url: string | null
  beginner_ok: boolean | null
  status: string | null
  is_free: boolean | null
  expires_at: string | null
  validated_answer_id: string | null
  created_at: string | null
  updated_at: string | null
  author?: unknown
  answers?: unknown
}

export type Answer = {
  id: string
  question_id: string
  author_id: string
  body: string
  proof_url: string
  is_useful: boolean
  created_at: string
  updated_at: string
  author: ProjectAuthor
  level: string
}

export type AnswerRow = {
  id: string
  question_id: string
  author_id: string
  body: string | null
  proof_url: string | null
  is_useful: boolean | null
  created_at: string | null
  updated_at: string | null
  author?: unknown
}

export type QuestionThread = {
  question: Question
  answers: Answer[]
}

export type PostQuestionInput = {
  title: string
  body: string
  technologies: string[]
  tier: HelpTier
  githubUrl: string
  beginnerOk: boolean
}

export const QUESTION_COLUMNS =
  'id,author_id,title,body,technologies,tier,github_url,beginner_ok,status,is_free,expires_at,validated_answer_id,created_at,updated_at,author:profiles!questions_author_id_fkey(id,pseudo,display_name,avatar_url),answers(count)'

export const ANSWER_COLUMNS =
  'id,question_id,author_id,body,proof_url,is_useful,created_at,updated_at,author:profiles!answers_author_id_fkey(id,pseudo,display_name,avatar_url)'

/** Colonnes lues pour le catalogue, avec l’auteur via la clé étrangère. */
export const PROJECT_COLUMNS =
  'id,author_id,title,description,repo_url,license,technologies,tags,stars,last_activity,created_at,author:profiles!projects_author_id_fkey(id,pseudo,display_name,avatar_url)'

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
  const helpMessage = translateHelpError(message)
  if (helpMessage) return helpMessage

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
  if (
    lower.includes('déjà dans le catalogue') ||
    lower.includes('deja dans le catalogue')
  ) {
    return 'Ce dépôt est déjà dans le catalogue.'
  }
  if (
    lower.includes('déjà marqué ce projet') ||
    lower.includes('deja marque ce projet')
  ) {
    return 'Tu as déjà marqué ce projet comme utile.'
  }
  if (lower.includes('propre projet')) {
    return 'Impossible de marquer ton propre projet comme utile.'
  }
  if (lower.includes('plafond')) {
    return 'Ce projet a atteint son plafond de « Ça m’a servi » cette semaine. Réessaie la semaine prochaine.'
  }
  if (
    lower.includes('lien github invalide') ||
    lower.includes('format https://github.com')
  ) {
    return 'Lien GitHub invalide. Utilise le format https://github.com/pseudo/depot.'
  }
  if (lower.includes('projet introuvable')) {
    return 'Ce projet n’existe plus dans le catalogue.'
  }
  if (code === '23505') {
    return 'Cette information est déjà utilisée.'
  }
  if (code === '23514') {
    return 'Les informations envoyées ne sont pas valides. Vérifie le titre, le lien et les listes.'
  }
  if (
    code === 'PGRST202' ||
    lower.includes('could not find the function') ||
    lower.includes('schema cache')
  ) {
    return 'Cette action n’est pas encore disponible. Vérifie que les migrations Supabase sont à jour.'
  }
  if (code === 'PGRST205' || lower.includes('could not find the table')) {
    return 'Le catalogue n’est pas encore disponible. Vérifie que les migrations Supabase ont été exécutées.'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const items: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const clean = item.trim()
    if (clean && !items.includes(clean)) items.push(clean)
  }
  return items
}

function normaliseProjectAuthor(
  value: unknown,
  authorId: string,
): ProjectAuthor {
  const author = isRecord(value) ? value : {}
  const pseudo = readText(author.pseudo)
  return {
    id: readText(author.id) || authorId,
    pseudo,
    display_name:
      readText(author.display_name) ||
      pseudo ||
      'Développeur Bondev',
    avatar_url: readText(author.avatar_url),
  }
}

export function normaliseProject(row: ProjectRow): Project {
  const authorId = readText(row.author_id)
  const createdAt = readText(row.created_at)
  const stars = Number(row.stars ?? 0)

  return {
    id: readText(row.id),
    author_id: authorId,
    title: readText(row.title),
    description: readText(row.description),
    repo_url: readText(row.repo_url),
    license: readText(row.license),
    technologies: readStringList(row.technologies),
    tags: readStringList(row.tags),
    stars: Number.isFinite(stars) ? Math.max(0, stars) : 0,
    last_activity: readText(row.last_activity) || createdAt,
    created_at: createdAt,
    author: normaliseProjectAuthor(row.author, authorId),
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

/** Les projets du catalogue, du plus récent au plus ancien (200 maximum). */
export async function listProjects(): Promise<Project[]> {
  try {
    const { data, error } = await getSupabase()
      .from('projects')
      .select(PROJECT_COLUMNS)
      .order('last_activity', { ascending: false })
      .limit(200)

    if (error) throw error
    return ((data ?? []) as ProjectRow[]).map(normaliseProject)
  } catch (error) {
    throw asApiError(error)
  }
}

/**
 * « Ça m’a servi » : la base ajoute 1 point à l’auteur et incrémente le
 * compteur. Un seul clic par utilisateur et par projet.
 */
export async function markProjectUsed(projectId: string): Promise<void> {
  if (!projectId) {
    throw new ApiError('Ce projet n’existe plus dans le catalogue.')
  }

  try {
    await requireUserId()
    const { error } = await getSupabase().rpc('mark_project_used', {
      p_project_id: projectId,
    })
    if (error) {
      if (error.code === '23505') {
        throw new ApiError('Tu as déjà marqué ce projet comme utile.')
      }
      throw error
    }
  } catch (error) {
    throw asApiError(error)
  }
}

function cleanList(values: string[], max: number): string[] {
  const cleaned: string[] = []
  for (const value of values) {
    const item = value.trim()
    if (item && !cleaned.includes(item)) cleaned.push(item)
    if (cleaned.length >= max) break
  }
  return cleaned
}

/**
 * Publie un projet via la RPC `publish_project`. Aucune insertion directe
 * dans `projects` ni dans `points_ledger`.
 */
export async function publishProject(
  input: PublishProjectInput,
): Promise<PublishedProject> {
  const title = input.title.trim()
  const description = input.description.trim()
  const repoUrl = input.repoUrl.trim().replace(/\/+$/, '')
  const license = input.license.trim() || 'MIT'
  const technologies = cleanList(input.technologies, 15)
  const tags = cleanList(input.tags, 15)

  if (title.length < 5 || title.length > 200) {
    throw new ApiError(
      'Le titre doit contenir entre 5 et 200 caractères.',
    )
  }
  if (description.length > 5000) {
    throw new ApiError('La description ne doit pas dépasser 5000 caractères.')
  }
  if (!/^https:\/\/github\.com\/[^/ ]+\/[^/ ]+$/.test(repoUrl)) {
    throw new ApiError(
      'Lien GitHub invalide. Utilise le format https://github.com/pseudo/depot.',
    )
  }
  if (license.length > 40) {
    throw new ApiError('Le nom de la licence est trop long.')
  }

  try {
    const userId = await requireUserId()
    const { data, error } = await getSupabase().rpc('publish_project', {
      p_title: title,
      p_description: description,
      p_repo_url: repoUrl,
      p_license: license,
      p_technologies: technologies,
      p_tags: tags,
    })

    if (error) {
      if (error.code === '23505') {
        throw new ApiError('Ce dépôt est déjà dans le catalogue.')
      }
      throw error
    }

    const projectId = typeof data === 'string' ? data : ''
    if (!projectId) {
      throw new ApiError(
        'Le projet a été publié, mais sa fiche n’est pas encore disponible. Recharge le catalogue.',
      )
    }

    // La RPC ne renvoie que l’identifiant. On lit la ligne du registre pour
    // savoir si cette publication a bien rapporté +3 points (5 premières).
    let pointsEarned = 0
    const reward = await getSupabase()
      .from('points_ledger')
      .select('delta')
      .eq('user_id', userId)
      .eq('ref_id', projectId)
      .eq('reason', 'project_publish')
      .limit(1)

    if (!reward.error && Array.isArray(reward.data) && reward.data.length > 0) {
      const row: unknown = reward.data[0]
      if (isRecord(row)) {
        const delta = Number(row.delta)
        pointsEarned = Number.isFinite(delta) ? delta : 0
      }
    }

    return { id: projectId, pointsEarned }
  } catch (error) {
    throw asApiError(error)
  }
}

function readQuestionStatus(value: unknown): HelpStatus {
  return value === 'resolved' ||
    value === 'expired' ||
    value === 'withdrawn' ||
    value === 'open'
    ? value
    : 'open'
}

function readAnswerCount(value: unknown): number {
  if (!Array.isArray(value) || value.length === 0) return 0
  const first = value[0]
  if (!isRecord(first)) return 0
  const count = Number(first.count)
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
}

export function normaliseQuestion(row: QuestionRow): Question {
  const authorId = readText(row.author_id)
  const tierValue = Number(row.tier)
  const tier: HelpTier = isHelpTier(tierValue) ? tierValue : 1
  return {
    id: readText(row.id),
    author_id: authorId,
    title: readText(row.title),
    body: readText(row.body),
    technologies: readStringList(row.technologies),
    tier,
    github_url: readText(row.github_url),
    beginner_ok: row.beginner_ok === true,
    status: readQuestionStatus(row.status),
    is_free: row.is_free === true,
    expires_at: readText(row.expires_at),
    validated_answer_id: readText(row.validated_answer_id) || null,
    created_at: readText(row.created_at),
    updated_at: readText(row.updated_at),
    author: normaliseProjectAuthor(row.author, authorId),
    answer_count: readAnswerCount(row.answers),
  }
}

function normaliseAnswer(row: AnswerRow, level: string): Answer {
  const authorId = readText(row.author_id)
  return {
    id: readText(row.id),
    question_id: readText(row.question_id),
    author_id: authorId,
    body: readText(row.body),
    proof_url: readText(row.proof_url),
    is_useful: row.is_useful === true,
    created_at: readText(row.created_at),
    updated_at: readText(row.updated_at),
    author: normaliseProjectAuthor(row.author, authorId),
    level,
  }
}

function isHttpsGithubLink(value: string): boolean {
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

function cleanOptionalGithubLink(value: string): string {
  const link = value.trim()
  if (!link) return ''
  if (!isHttpsGithubLink(link)) {
    throw new ApiError(
      'Le lien GitHub doit commencer par https://github.com/.',
    )
  }
  return link
}

/**
 * Questions de l’Entraide, de la plus récente à la plus ancienne. Les profils
 * des auteurs et le nombre de réponses viennent de la même requête.
 */
export async function listQuestions(
  filter: QuestionFilter = {},
): Promise<Question[]> {
  try {
    const tab: QuestionTab = filter.tab ?? 'open'
    const userId = tab === 'mine' ? await requireUserId() : ''
    let request = getSupabase()
      .from('questions')
      .select(QUESTION_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(150)

    if (tab === 'open') request = request.eq('status', 'open')
    if (tab === 'resolved') request = request.eq('status', 'resolved')
    if (tab === 'mine') request = request.eq('author_id', userId)
    if (filter.beginnerOnly) request = request.eq('beginner_ok', true)
    if (filter.technology) {
      request = request.contains('technologies', [filter.technology])
    }

    const { data, error } = await request
    if (error) throw error
    return ((data ?? []) as QuestionRow[]).map(normaliseQuestion)
  } catch (error) {
    throw asApiError(error)
  }
}

/** Technologies réellement présentes dans les questions, pour le filtre. */
export async function listQuestionTechnologies(): Promise<string[]> {
  try {
    const { data, error } = await getSupabase()
      .from('questions')
      .select('technologies')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error
    const technologies = new Set<string>()
    for (const row of (data ?? []) as { technologies: unknown }[]) {
      for (const technology of readStringList(row.technologies)) {
        technologies.add(technology)
      }
    }
    return [...technologies].sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' }),
    )
  } catch (error) {
    throw asApiError(error)
  }
}

/**
 * Une question et ses réponses. La réponse validée passe en premier, puis les
 * réponses sont ordonnées de la plus ancienne à la plus récente. Le niveau est
 * lu dans `profile_stats`, qui expose publiquement le niveau et le total gagné.
 */
export async function getQuestion(id: string): Promise<QuestionThread> {
  if (!id) throw new ApiError('Cette question n’existe plus.')

  try {
    const { data, error } = await getSupabase()
      .from('questions')
      .select(QUESTION_COLUMNS)
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new ApiError('Cette question n’existe plus.')
    const question = normaliseQuestion(data as QuestionRow)

    const { data: answerData, error: answerError } = await getSupabase()
      .from('answers')
      .select(ANSWER_COLUMNS)
      .eq('question_id', id)
      .order('created_at', { ascending: true })
      .limit(200)

    if (answerError) throw answerError
    const rows = (answerData ?? []) as AnswerRow[]

    const levels = new Map<string, string>()
    const authorIds = [...new Set(rows.map((row) => row.author_id))]
    if (authorIds.length > 0) {
      const { data: stats, error: statsError } = await getSupabase()
        .from('profile_stats')
        .select('id,level')
        .in('id', authorIds)
      if (!statsError) {
        for (const row of (stats ?? []) as { id: string; level: string | null }[]) {
          levels.set(row.id, row.level ?? '')
        }
      }
    }

    const answers = rows
      .map((row) => normaliseAnswer(row, levels.get(row.author_id) ?? ''))
      .sort((a, b) => {
        if (a.is_useful !== b.is_useful) return a.is_useful ? -1 : 1
        const first = new Date(a.created_at).getTime()
        const second = new Date(b.created_at).getTime()
        return (Number.isFinite(first) ? first : 0) -
          (Number.isFinite(second) ? second : 0)
      })

    return { question, answers }
  } catch (error) {
    throw asApiError(error)
  }
}

/** Publie une question via la RPC : la base débite ou utilise la question gratuite. */
export async function postQuestion(input: PostQuestionInput): Promise<string> {
  const title = input.title.trim()
  const body = input.body.trim()
  const technologies = cleanList(input.technologies, 10)
  const githubUrl = cleanOptionalGithubLink(input.githubUrl)

  if (title.length < 5 || title.length > 300) {
    throw new ApiError(
      'Le titre doit contenir entre 5 et 300 caractères.',
    )
  }
  if (!body) {
    throw new ApiError('Décris ton blocage en quelques mots.')
  }
  if (body.length > 10000) {
    throw new ApiError('La description ne doit pas dépasser 10 000 caractères.')
  }
  if (technologies.length === 0) {
    throw new ApiError('Choisis au moins une technologie.')
  }
  if (!isHelpTier(input.tier)) {
    throw new ApiError('Choisis un palier valide : 1, 3 ou 6 points.')
  }

  try {
    await requireUserId()
    const { data, error } = await getSupabase().rpc('post_question', {
      p_title: title,
      p_body: body,
      p_technologies: technologies,
      p_tier: input.tier,
      p_github_url: githubUrl,
      p_beginner_ok: input.beginnerOk,
    })
    if (error) throw error

    const questionId = typeof data === 'string' ? data : ''
    if (!questionId) {
      throw new ApiError(
        'La question a été publiée, mais son fil n’est pas encore disponible. Recharge l’Entraide.',
      )
    }
    return questionId
  } catch (error) {
    throw asApiError(error)
  }
}

/** La question gratuite hebdomadaire est-elle encore disponible ? */
export async function isFreeQuestionAvailable(): Promise<boolean> {
  try {
    await requireUserId()
    const { data, error } = await getSupabase().rpc(
      'my_free_question_available',
    )
    if (error) throw error
    return data === true
  } catch (error) {
    throw asApiError(error)
  }
}

/**
 * Répond à une question. Seules les colonnes autorisées par les GRANT sont
 * envoyées : jamais `is_useful` ni `visible`.
 */
export async function addAnswer(
  questionId: string,
  body: string,
  proofUrl = '',
): Promise<string> {
  const text = body.trim()
  const proof = cleanOptionalGithubLink(proofUrl)

  if (!questionId) throw new ApiError('Cette question n’existe plus.')
  if (!text) throw new ApiError('Écris une réponse avant d’envoyer.')
  if (text.length > 10000) {
    throw new ApiError('La réponse ne doit pas dépasser 10 000 caractères.')
  }

  try {
    const userId = await requireUserId()
    const { data, error } = await getSupabase()
      .from('answers')
      .insert({
        question_id: questionId,
        author_id: userId,
        body: text,
        proof_url: proof,
      })
      .select('id')
      .single()

    if (error) throw error
    const answerId = isRecord(data) ? readText(data.id) : ''
    if (!answerId) {
      throw new ApiError(
        'La réponse a été envoyée, mais elle n’est pas encore visible. Recharge la question.',
      )
    }
    return answerId
  } catch (error) {
    throw asApiError(error)
  }
}

async function getOwnAnswerForEdit(
  answerId: string,
): Promise<{ id: string; author_id: string; is_useful: boolean }> {
  if (!answerId) throw new ApiError('Cette réponse n’existe plus.')
  const userId = await requireUserId()
  const { data, error } = await getSupabase()
    .from('answers')
    .select('id,author_id,is_useful')
    .eq('id', answerId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError('Cette réponse n’existe plus.')

  const row = data as {
    id: string
    author_id: string
    is_useful: boolean | null
  }
  if (row.author_id !== userId) {
    throw new ApiError('Tu ne peux modifier que tes propres réponses.')
  }
  return {
    id: row.id,
    author_id: row.author_id,
    is_useful: row.is_useful === true,
  }
}

function assertAnswerEditable(isUseful: boolean): void {
  if (isUseful) {
    throw new ApiError(
      'Cette réponse a déjà été validée : elle ne peut plus être modifiée.',
    )
  }
}

/** Modifie une réponse tant qu’elle n’a pas été validée. */
export async function updateAnswer(
  answerId: string,
  body: string,
  proofUrl = '',
): Promise<void> {
  const text = body.trim()
  const proof = cleanOptionalGithubLink(proofUrl)

  if (!text) throw new ApiError('Écris une réponse avant d’enregistrer.')
  if (text.length > 10000) {
    throw new ApiError('La réponse ne doit pas dépasser 10 000 caractères.')
  }

  try {
    const answer = await getOwnAnswerForEdit(answerId)
    assertAnswerEditable(answer.is_useful)

    const { error } = await getSupabase()
      .from('answers')
      .update({ body: text, proof_url: proof })
      .eq('id', answerId)
    if (error) throw error
  } catch (error) {
    throw asApiError(error)
  }
}

/** Supprime une réponse tant qu’elle n’a pas été validée. */
export async function deleteAnswer(answerId: string): Promise<void> {
  try {
    const answer = await getOwnAnswerForEdit(answerId)
    assertAnswerEditable(answer.is_useful)

    const { error } = await getSupabase()
      .from('answers')
      .delete()
      .eq('id', answerId)
    if (error) throw error
  } catch (error) {
    throw asApiError(error)
  }
}

/** Valide une réponse : la RPC vérifie l’auteur et verse le palier. */
export async function validateAnswer(answerId: string): Promise<void> {
  if (!answerId) throw new ApiError('Cette réponse n’existe plus.')
  try {
    await requireUserId()
    const { error } = await getSupabase().rpc('validate_answer', {
      p_answer_id: answerId,
    })
    if (error) throw error
  } catch (error) {
    throw asApiError(error)
  }
}

/** Retire sa question : la RPC rembourse le palier si elle n’est pas gratuite. */
export async function withdrawQuestion(questionId: string): Promise<void> {
  if (!questionId) throw new ApiError('Cette question n’existe plus.')
  try {
    await requireUserId()
    const { error } = await getSupabase().rpc('withdraw_question', {
      p_question_id: questionId,
    })
    if (error) throw error
  } catch (error) {
    throw asApiError(error)
  }
}
