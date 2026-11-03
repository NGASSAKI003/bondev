/**
 * Récupération des informations publiques d’un dépôt GitHub.
 *
 * L’API GitHub est appelée sans clé : elle est publique mais limitée à
 * 60 requêtes par heure et par adresse IP. Les erreurs sont traduites en
 * messages simples pour que le formulaire reste utilisable à la main.
 */

export type GithubRepoRef = {
  owner: string
  repo: string
  canonicalUrl: string
}

export type GithubRepoPreview = {
  title: string
  description: string
  technologies: string[]
  license: string
  tags: string[]
  lastActivity: string
}

export class GithubError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GithubError'
  }
}

const GITHUB_REPO_PATTERN = /^[A-Za-z0-9_.-]+$/

/** Accepte un lien de dépôt GitHub et renvoie son adresse canonique. */
export function parseGithubRepoUrl(value: string): GithubRepoRef | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (
      url.protocol !== 'https:' ||
      (url.hostname !== 'github.com' && url.hostname !== 'www.github.com')
    ) {
      return null
    }

    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length < 2) return null

    const owner = segments[0]
    const repo = segments[1].replace(/\.git$/i, '')
    if (
      !owner ||
      !repo ||
      !GITHUB_REPO_PATTERN.test(owner) ||
      !GITHUB_REPO_PATTERN.test(repo)
    ) {
      return null
    }

    return {
      owner,
      repo,
      canonicalUrl: `https://github.com/${owner}/${repo}`,
    }
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function humaniseRepoName(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function readTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const topics: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const topic = item.trim().replace(/-+/g, ' ')
    if (topic && !topics.includes(topic)) topics.push(topic)
  }
  return topics.slice(0, 15)
}

function readLicense(value: unknown): string {
  if (!isRecord(value)) return ''
  const spdx = readString(value.spdx_id)
  if (!spdx || spdx === 'NOASSERTION') return ''
  return spdx
}

function rateLimitMessage(): string {
  return 'GitHub limite temporairement les demandes. Patiente quelques minutes ou remplis les champs à la main.'
}

/** Récupère le dépôt via https://api.github.com/repos/{owner}/{repo}. */
export async function fetchGithubRepo(
  repoUrl: string,
): Promise<GithubRepoPreview> {
  const ref = parseGithubRepoUrl(repoUrl)
  if (!ref) {
    throw new GithubError(
      'Lien GitHub invalide. Utilise le format https://github.com/pseudo/depot.',
    )
  }

  const endpoint = `https://api.github.com/repos/${encodeURIComponent(
    ref.owner,
  )}/${encodeURIComponent(ref.repo)}`

  let response: Response
  try {
    response = await fetch(endpoint, {
      headers: { Accept: 'application/vnd.github+json' },
    })
  } catch {
    throw new GithubError(
      'Impossible de contacter GitHub. Vérifie ta connexion ou remplis les champs à la main.',
    )
  }

  if (response.status === 404) {
    throw new GithubError(
      'Ce dépôt GitHub est introuvable. Vérifie le lien ou qu’il est public.',
    )
  }
  if (response.status === 403 || response.status === 429) {
    throw new GithubError(rateLimitMessage())
  }
  if (!response.ok) {
    throw new GithubError(
      'GitHub n’a pas pu répondre. Réessaie dans un instant ou remplis les champs à la main.',
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new GithubError(
      'La réponse de GitHub est illisible. Remplis les champs à la main.',
    )
  }

  if (!isRecord(payload)) {
    throw new GithubError(
      'La réponse de GitHub est illisible. Remplis les champs à la main.',
    )
  }

  const name = readString(payload.name)
  if (!name) {
    throw new GithubError(
      'GitHub n’a pas renvoyé les informations du dépôt. Remplis les champs à la main.',
    )
  }

  const language = readString(payload.language)
  const license = readLicense(payload.license)
  const description = readString(payload.description)
  const lastActivity =
    readString(payload.pushed_at) || readString(payload.updated_at)

  return {
    title: humaniseRepoName(name),
    description,
    technologies: language ? [language] : [],
    license,
    tags: readTopics(payload.topics),
    lastActivity,
  }
}
