/*
 * Finalise dist/ après `vite build` :
 * - injecte l'origine Supabase dans la CSP de _headers (jamais en dur) ;
 * - versionne le cache du service worker ;
 * - vérifie qu'aucune source map ne part en production.
 *
 * Aucune dépendance : uniquement la bibliothèque standard de Node.
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

/** Lit un fichier .env sans dépendance ni expansion de variables. */
function readEnvFile(name) {
  const path = join(root, name)
  if (!existsSync(path)) return {}
  const values = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match) continue
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[match[1]] = value
  }
  return values
}

function fail(message) {
  console.error(`build-artifacts: ${message}`)
  process.exit(1)
}

if (!existsSync(dist)) fail('dist/ est absent, lance `vite build` d’abord.')

// Même ordre de priorité que Vite pour le mode production.
const env = {
  ...readEnvFile('.env'),
  ...readEnvFile('.env.local'),
  ...readEnvFile('.env.production'),
  ...readEnvFile('.env.production.local'),
  ...process.env,
}

let supabaseOrigin = ''
const supabaseUrl = (env.VITE_SUPABASE_URL ?? '').trim()
if (supabaseUrl) {
  try {
    supabaseOrigin = new URL(supabaseUrl).origin
  } catch {
    fail('VITE_SUPABASE_URL n’est pas une URL valide.')
  }
}

// 1. CSP : remplace le jeton par l'origine réelle, ou le retire proprement.
const headersPath = join(dist, '_headers')
if (!existsSync(headersPath)) fail('dist/_headers est absent.')
let headers = readFileSync(headersPath, 'utf8')
if (!headers.includes('__SUPABASE_ORIGIN__')) {
  fail('dist/_headers ne contient pas le jeton __SUPABASE_ORIGIN__.')
}
headers = headers
  .split(/\r?\n/)
  .map((line) => {
    const match = line.match(/^(\s*)Content-Security-Policy:(.*)$/)
    if (!match) return line
    const value = match[2]
      .replace('__SUPABASE_ORIGIN__', supabaseOrigin)
      .replace(/\s+/g, ' ')
      .trim()
    return `${match[1]}Content-Security-Policy: ${value}`
  })
  .join('\n')
writeFileSync(headersPath, headers)

if (supabaseOrigin) {
  console.log(`CSP : origine Supabase injectée (${supabaseOrigin}).`)
} else {
  console.warn(
    'CSP : VITE_SUPABASE_URL absent, connect-src reste limité à self et GitHub.',
  )
}

// 2. Service worker : version de cache liée au commit quand il est connu.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const sha = (process.env.GITHUB_SHA ?? '').slice(0, 7)
const version = `${pkg.version}-${sha || Date.now().toString(36)}`
const swPath = join(dist, 'sw.js')
if (!existsSync(swPath)) fail('dist/sw.js est absent.')
let sw = readFileSync(swPath, 'utf8')
if (!sw.includes('__BUILD_VERSION__')) {
  fail('dist/sw.js ne contient pas le jeton __BUILD_VERSION__.')
}
sw = sw.replaceAll('__BUILD_VERSION__', version)
writeFileSync(swPath, sw)
console.log(`Service worker : cache bondev-${version}.`)

// 3. Aucune source map ne doit être publiée.
function walk(directory) {
  const files = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) files.push(...walk(path))
    else files.push(path)
  }
  return files
}

const sourceMaps = walk(dist).filter((file) => file.endsWith('.map'))
if (sourceMaps.length > 0) {
  for (const file of sourceMaps) rmSync(file)
  fail(`${sourceMaps.length} source map(s) trouvée(s) puis supprimée(s).`)
}
console.log('Source maps : aucune dans dist/.')
