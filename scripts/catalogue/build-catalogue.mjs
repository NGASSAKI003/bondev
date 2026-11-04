#!/usr/bin/env node
/**
 * Génère supabase/catalogue_depart.sql à partir de scripts/catalogue/repos.json.
 *
 * Node 20+, aucune dépendance : uniquement `fetch` natif et les modules `node:`.
 * Le script interroge l'API GitHub pour vérifier chaque dépôt et récupérer son
 * langage, sa licence, ses étoiles GitHub et sa dernière activité.
 *
 * Utilisation :
 *   npm run catalogue:build
 *   GITHUB_TOKEN=... npm run catalogue:build
 *
 * Options utiles pour tester sans écraser le fichier final :
 *   node scripts/catalogue/build-catalogue.mjs --input ./petit.json --output ./tmp.sql
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..')
const DEFAULT_INPUT = path.join(SCRIPT_DIR, 'repos.json')
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, 'supabase', 'catalogue_depart.sql')

const GITHUB_API = 'https://api.github.com/repos'
const PAUSE_MS = 250
const MAX_TAGS = 15
const MAX_DESCRIPTION = 5000
const MAX_TITLE = 200
const MIN_TITLE = 5

const TEAM_ID = 'a0000000-0000-0000-0000-0000000000b0'
const TEAM_EMAIL = 'equipe@bondev.invalid'
const TEAM_PSEUDO = 'equipe_bondev'
const TEAM_NAME = 'Équipe Bondev'

class CatalogueError extends Error {}

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--input' || arg === '--output') {
      const value = argv[index + 1]
      if (!value) throw new CatalogueError(`L'option ${arg} attend un chemin.`)
      options[arg.slice(2)] = path.resolve(process.cwd(), value)
      index += 1
      continue
    }
    throw new CatalogueError(`Option inconnue : ${arg}`)
  }

  return options
}

function printHelp() {
  console.log(`Génère le catalogue de départ Bondev.

Usage :
  node scripts/catalogue/build-catalogue.mjs [--input <repos.json>] [--output <catalogue.sql>]

Variables :
  GITHUB_TOKEN   Jeton facultatif pour augmenter le quota de l'API GitHub.

Sans option, lit scripts/catalogue/repos.json et écrit supabase/catalogue_depart.sql.`)
}

function info(message) {
  console.log(message)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function oneLine(value, maxLength = 300) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CatalogueError(`Le champ « ${field} » doit être un texte non vide.`)
  }
  return value.trim()
}

function optionalTextArray(value, field) {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw new CatalogueError(`Le champ « ${field} » doit être un tableau.`)
  }
  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw new CatalogueError(`« ${field}[${index}] » doit être un texte.`)
    }
    return item.trim()
  }).filter(Boolean)
}

/** Extrait owner/repo d'une URL GitHub complète. */
function parseRepoReference(value) {
  const text = requireText(value, 'repo')
  let url
  try {
    url = new URL(text)
  } catch {
    throw new CatalogueError(`URL GitHub invalide : ${text}`)
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CatalogueError(`URL GitHub invalide (https attendu) : ${text}`)
  }
  if (url.hostname.toLowerCase() !== 'github.com') {
    throw new CatalogueError(`URL hors github.com : ${text}`)
  }
  if (url.search || url.hash) {
    throw new CatalogueError(`URL GitHub avec paramètres inattendus : ${text}`)
  }

  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  if (parts.length !== 2) {
    throw new CatalogueError(`URL GitHub invalide (owner/repo attendu) : ${text}`)
  }

  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new CatalogueError(`Nom de dépôt GitHub invalide : ${text}`)
  }

  return {
    owner,
    repo,
    slug: `${owner}/${repo}`,
  }
}

/**
 * Vérifie que l'adresse renvoyée par GitHub reste bien un dépôt github.com.
 * Retourne l'URL canonique sans slash final, ou null si elle est inutilisable.
 */
function canonicalGithubRepoUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null

  let url
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  const hostname = url.hostname.toLowerCase()
  if (url.protocol !== 'https:') return null
  if (hostname !== 'github.com' && hostname !== 'www.github.com') return null
  if (url.port) return null

  const parts = url.pathname.replace(/\/+$/g, '').split('/').filter(Boolean)
  if (parts.length !== 2) return null

  const [owner, repo] = parts
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return null
  }

  return `https://github.com/${owner}/${repo}`
}

function formatResetDate(headerValue) {
  const seconds = Number(headerValue)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

function rateLimitError(status, slug, response, hasToken) {
  const remaining = response.headers.get('x-ratelimit-remaining')
  const reset = formatResetDate(response.headers.get('x-ratelimit-reset'))
  const retryAfter = response.headers.get('retry-after')
  const pieces = [`GitHub a renvoyé ${status} pour ${slug}.`]

  if (remaining === '0') {
    pieces.push(
      reset
        ? `Quota GitHub épuisé ; réinitialisation prévue le ${reset}.`
        : 'Quota GitHub épuisé.',
    )
    pieces.push(
      hasToken
        ? 'Vérifie le quota du jeton GITHUB_TOKEN.'
        : 'Définis GITHUB_TOKEN pour passer de 60 à 5000 requêtes par heure.',
    )
  } else if (retryAfter) {
    pieces.push(`Réessaie dans ${retryAfter} seconde(s).`)
  } else {
    pieces.push(
      'Accès refusé par GitHub (dépôt privé, blocage temporaire ou quota).',
    )
  }

  return new CatalogueError(pieces.join(' '))
}

async function fetchRepository(reference, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'bondev-catalogue-builder',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(
      `${GITHUB_API}/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repo)}`,
      {
        headers,
        signal: AbortSignal.timeout(20000),
      },
    )
  } catch (error) {
    throw new CatalogueError(
      `Impossible de contacter l'API GitHub pour ${reference.slug} : ${error.message}`,
    )
  }

  if (response.status === 404) {
    return { ok: false, reason: 'introuvable sur GitHub (404)' }
  }

  if (response.status === 403 || response.status === 429) {
    throw rateLimitError(response.status, reference.slug, response, Boolean(token))
  }

  if (!response.ok) {
    let details = ''
    try {
      const body = await response.text()
      if (body) details = ` Réponse : ${oneLine(body, 200)}`
    } catch {
      // Le corps n'est pas indispensable au diagnostic.
    }
    throw new CatalogueError(
      `L'API GitHub a répondu ${response.status} pour ${reference.slug}.${details}`,
    )
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new CatalogueError(
      `La réponse GitHub pour ${reference.slug} n'est pas un JSON valide.`,
    )
  }

  if (data.archived === true) {
    return { ok: false, reason: 'archivé sur GitHub' }
  }

  const repoUrl = canonicalGithubRepoUrl(data.html_url)
  if (!repoUrl) {
    return {
      ok: false,
      reason: `adresse de destination hors github.com ou invalide (${oneLine(data.html_url || 'html_url absente')})`,
    }
  }

  return { ok: true, data, repoUrl }
}

function buildProject(entry, data, repoUrl, warnings) {
  const slug = `${entry.repo}`
  const title = requireText(entry.title, `title (${slug})`)
  const description = requireText(entry.summary_fr, `summary_fr (${slug})`)

  if (title.length < MIN_TITLE || title.length > MAX_TITLE) {
    throw new CatalogueError(
      `Le titre « ${oneLine(title)} » doit faire entre ${MIN_TITLE} et ${MAX_TITLE} caractères.`,
    )
  }
  if (description.length > MAX_DESCRIPTION) {
    throw new CatalogueError(
      `La description de « ${title} » dépasse ${MAX_DESCRIPTION} caractères.`,
    )
  }

  const rawTags = optionalTextArray(entry.tags, `tags (${slug})`)
  if (rawTags.length > MAX_TAGS) {
    warnings.push(
      `${title} : ${rawTags.length} tags fournis, seuls les ${MAX_TAGS} premiers sont conservés.`,
    )
  }
  const tags = rawTags.slice(0, MAX_TAGS)

  const language =
    typeof data.language === 'string' ? data.language.trim() : ''
  // Depuis la migration 0004, le catalogue ne garde que le langage principal.
  const technologies = language ? [language] : []

  const spdxId =
    data.license && typeof data.license.spdx_id === 'string'
      ? data.license.spdx_id.trim()
      : ''
  const license = spdxId && spdxId !== 'NOASSERTION' ? spdxId : 'Autre'

  const githubStars = Number.isFinite(data.stargazers_count)
    ? Math.max(0, Math.trunc(data.stargazers_count))
    : 0

  if (!data.pushed_at || Number.isNaN(Date.parse(data.pushed_at))) {
    throw new CatalogueError(
      `Le dépôt ${slug} n'a pas de date pushed_at exploitable.`,
    )
  }
  const lastActivity = new Date(data.pushed_at).toISOString()

  return {
    title,
    description,
    repoUrl,
    license,
    technologies,
    tags,
    githubStars,
    lastActivity,
  }
}

/** Dollar-quoting : gère apostrophes, retours à la ligne et séquences $-…$. */
function quoteLiteral(value) {
  const text = String(value ?? '')
  let tag = '$bondev$'
  let suffix = 0
  while (text.includes(tag)) {
    suffix += 1
    tag = `$bondev_${suffix}$`
  }
  return `${tag}${text}${tag}`
}

function quoteArray(values) {
  if (values.length === 0) return 'ARRAY[]::text[]'
  return `ARRAY[${values.map(quoteLiteral).join(', ')}]::text[]`
}

function sqlProject(project) {
  return [
    `-- ${oneLine(project.title)} — ${project.repoUrl}`,
    'INSERT INTO public.projects (',
    '  author_id, title, description, repo_url, license, technologies, tags, stars, github_stars, last_activity',
    ')',
    'VALUES (',
    `  '${TEAM_ID}'::uuid,`,
    `  ${quoteLiteral(project.title)},`,
    `  ${quoteLiteral(project.description)},`,
    `  ${quoteLiteral(project.repoUrl)},`,
    `  ${quoteLiteral(project.license)},`,
    `  ${quoteArray(project.technologies)},`,
    `  ${quoteArray(project.tags)},`,
    '  0,',
    `  ${project.githubStars},`,
    `  ${quoteLiteral(project.lastActivity)}::timestamptz`,
    ')',
    "ON CONFLICT (lower(repo_url)) WHERE repo_url <> '' DO NOTHING;",
    '',
  ].join('\n')
}

function sqlHeader(imported, ignored, sourcePath, generatedAt, warnings) {
  const lines = [
    '-- =============================================================================',
    '-- Bondev – Catalogue de départ',
    '-- =============================================================================',
    `-- Généré le ${generatedAt} par scripts/catalogue/build-catalogue.mjs.`,
    `-- Source : ${sourcePath}`,
    `-- Dépôts examinés : ${imported.length + ignored.length} | importés : ${imported.length} | ignorés : ${ignored.length}`,
    '--',
  ]

  if (imported.length > 0) {
    lines.push(`-- Dépôts importés (${imported.length}) :`)
    for (const project of imported) {
      lines.push(`--   - ${oneLine(project.title)} — ${project.repoUrl}`)
    }
  } else {
    lines.push('-- Aucun dépôt importé.')
  }

  lines.push('--')
  if (ignored.length > 0) {
    lines.push(`-- Dépôts ignorés (${ignored.length}) :`)
    for (const item of ignored) {
      lines.push(`--   - ${oneLine(item.slug)} — ${oneLine(item.reason)}`)
    }
  } else {
    lines.push('-- Aucun dépôt ignoré.')
  }

  if (warnings.length > 0) {
    lines.push('--')
    lines.push('-- Avertissements :')
    for (const warning of warnings) lines.push(`--   - ${oneLine(warning)}`)
  }

  lines.push(
    '--',
    '-- Ce fichier est idempotent : il peut être rejoué sans créer de doublon.',
    '-- Il ne contient aucun INSERT dans public.points_ledger. Le bonus d’inscription',
    '-- est évité en désactivant temporairement le trigger trg_signup_bonus autour',
    '-- de l’insertion du profil technique.',
    '--',
    '-- À exécuter dans l’éditeur SQL de Supabase (rôle postgres), APRÈS les',
    '-- migrations 0001_init.sql à 0004_stars.sql. Ne pas utiliser la clé anon.',
    '-- =============================================================================',
    '',
  )

  return lines.join('\n')
}

function buildSql(imported, ignored, sourcePath, generatedAt, warnings) {
  const sections = [
    sqlHeader(imported, ignored, sourcePath, generatedAt, warnings),
    'BEGIN;',
    '',
    '-- ─────────────────────────────────────────────────────────────────────────────',
    '-- 1. Compte technique « Équipe Bondev » (non connectable)',
    '-- ─────────────────────────────────────────────────────────────────────────────',
    '-- Le mot de passe est aléatoire et n’est communiqué à personne : le compte ne',
    '-- peut pas se connecter. Il sert uniquement d’auteur aux projets du catalogue.',
    'INSERT INTO auth.users (',
    '  id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at,',
    '  role, instance_id, aud, encrypted_password',
    ')',
    'VALUES (',
    `  '${TEAM_ID}'::uuid,`,
    `  ${quoteLiteral(TEAM_EMAIL)},`,
    '  \'{"display_name":"Équipe Bondev"}\'::jsonb,',
    '  now(), now(), now(),',
    "  'authenticated',",
    "  '00000000-0000-0000-0000-000000000000'::uuid,",
    "  'authenticated',",
    "  crypt(gen_random_uuid()::text, gen_salt('bf'))",
    ')',
    'ON CONFLICT DO NOTHING;',
    '',
    '-- Le trigger trg_signup_bonus ajoute +5 points dans points_ledger à chaque',
    '-- profil créé. On le désactive uniquement le temps d’insérer le profil',
    '-- technique, puis on le réactive. L’opération est transactionnelle : en cas',
    '-- d’erreur, PostgreSQL restaure automatiquement l’état du trigger.',
    'ALTER TABLE public.profiles DISABLE TRIGGER trg_signup_bonus;',
    '',
    'INSERT INTO public.profiles (',
    '  id, pseudo, display_name, avatar_url, bio, github_url, lang',
    ')',
    'VALUES (',
    `  '${TEAM_ID}'::uuid,`,
    `  ${quoteLiteral(TEAM_PSEUDO)},`,
    `  ${quoteLiteral(TEAM_NAME)},`,
    "  '',",
    `  ${quoteLiteral('Compte technique du catalogue Bondev. Non connectable.')},`,
    "  '',",
    "  'fr'",
    ')',
    'ON CONFLICT DO NOTHING;',
    '',
    'ALTER TABLE public.profiles ENABLE TRIGGER trg_signup_bonus;',
    '',
    '-- ─────────────────────────────────────────────────────────────────────────────',
    `-- 2. Projets du catalogue (${imported.length})`,
    '-- ─────────────────────────────────────────────────────────────────────────────',
    '-- La licence vaut « Autre » quand GitHub ne fournit pas de SPDX exploitable.',
    '-- Les technologies se limitent au langage principal renvoyé par GitHub.',
    '-- github_stars contient les étoiles GitHub ; stars reste à 0 (usage Bondev).',
    '',
  ]

  if (imported.length === 0) {
    sections.push('-- Aucun projet à insérer.', '')
  } else {
    for (const project of imported) sections.push(sqlProject(project))
  }

  sections.push('COMMIT;', '')
  return sections.join('\n')
}

async function loadEntries(inputPath) {
  let raw
  try {
    raw = await readFile(inputPath, 'utf8')
  } catch (error) {
    throw new CatalogueError(
      `Impossible de lire ${inputPath} : ${error.message}`,
    )
  }

  let entries
  try {
    entries = JSON.parse(raw)
  } catch (error) {
    throw new CatalogueError(
      `Le fichier ${inputPath} n’est pas un JSON valide : ${error.message}`,
    )
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new CatalogueError(
      `Le fichier ${inputPath} doit contenir un tableau non vide de dépôts.`,
    )
  }

  return entries
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const token = process.env.GITHUB_TOKEN?.trim() || ''
  if (token) {
    info('GITHUB_TOKEN détecté : quota GitHub augmenté.')
  } else {
    info('GITHUB_TOKEN absent : quota GitHub anonyme (60 requêtes/heure).')
  }

  const entries = await loadEntries(options.input)
  info(`Source : ${options.input}`)
  info(`${entries.length} dépôt(s) à vérifier.`)

  const imported = []
  const ignored = []
  const warnings = []
  const seen = new Set()

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const label = `[${String(index + 1).padStart(String(entries.length).length, '0')}/${entries.length}]`

    try {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new CatalogueError('entrée invalide (objet attendu)')
      }

      const reference = parseRepoReference(entry.repo)
      const key = reference.slug.toLowerCase()

      if (seen.has(key)) {
        const item = {
          slug: reference.slug,
          reason: 'doublon dans repos.json',
        }
        ignored.push(item)
        info(`${label} IGNORÉ ${item.slug} — ${item.reason}`)
        continue
      }
      seen.add(key)

      const result = await fetchRepository(reference, token)
      if (!result.ok) {
        const item = {
          slug: reference.slug,
          reason: result.reason,
        }
        ignored.push(item)
        info(`${label} IGNORÉ ${item.slug} — ${item.reason}`)
        continue
      }

      const project = buildProject(entry, result.data, result.repoUrl, warnings)
      imported.push(project)
      info(`${label} OK     ${project.title} — ${project.repoUrl}`)
    } catch (error) {
      throw new CatalogueError(
        `Entrée ${index + 1} (${oneLine(entry?.repo || 'repo absent')}) : ${error.message}`,
      )
    } finally {
      if (index < entries.length - 1) await sleep(PAUSE_MS)
    }
  }

  const generatedAt = new Date().toISOString()
  const sourcePath = path.relative(PROJECT_ROOT, options.input).replaceAll('\\', '/')
  const sql = buildSql(imported, ignored, sourcePath, generatedAt, warnings)

  await mkdir(path.dirname(options.output), { recursive: true })
  await writeFile(options.output, sql, 'utf8')

  info('')
  info('Résumé :')
  info(`  importés : ${imported.length}`)
  info(`  ignorés  : ${ignored.length}`)
  for (const item of ignored) info(`    - ${item.slug} : ${item.reason}`)
  if (warnings.length > 0) {
    info(`  avertissements : ${warnings.length}`)
    for (const warning of warnings) info(`    - ${warning}`)
  }
  info(`SQL écrit dans ${options.output}`)
}

main().catch((error) => {
  console.error('')
  console.error(`Erreur : ${error.message}`)
  process.exitCode = 1
})
