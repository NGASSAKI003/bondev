/**
 * Recherche lexicale du catalogue Bondev.
 *
 * Ce module est volontairement pur et sans dépendance : il ne contacte aucun
 * service externe. La recherche repose sur une normalisation du texte, un
 * dictionnaire de synonymes FR/EN et un score par champ. Une vraie IA pourra
 * être branchée plus tard derrière `searchProjects`, avec le même type de
 * résultat et sans changer les écrans.
 */

export type SearchConceptId =
  | 'mobile-money'
  | 'offline'
  | 'ussd'
  | 'sms'
  | 'stock'
  | 'accounting'
  | 'payment'
  | 'pwa'
  | 'api'
  | 'education'
  | 'agriculture'
  | 'currency'

export type SearchField = 'tags' | 'technologies' | 'title' | 'description'

export type SearchConcept = {
  id: SearchConceptId
  label: { fr: string; en: string }
  /** Ajoute des mots ici pour enrichir le dictionnaire. */
  keywords: readonly string[]
  /** Verbe utilisé dans la phrase « Pourquoi ce projet ». */
  verb: { fr: string; en: string }
}

/**
 * Dictionnaire extensible. Chaque entrée associe un concept à ses mots-clés
 * français et anglais. Les accents, la casse et la ponctuation sont ignorés.
 */
export const SEARCH_CONCEPTS: readonly SearchConcept[] = [
  {
    id: 'mobile-money',
    label: { fr: 'Mobile Money', en: 'Mobile Money' },
    keywords: [
      'mobile money',
      'momo',
      'mtn momo',
      'airtel money',
      'paiement mobile',
      'paiements mobiles',
      'mobile payment',
      'mobile payments',
      'argent mobile',
      'orange money',
    ],
    verb: { fr: 'gère Mobile Money', en: 'handles Mobile Money' },
  },
  {
    id: 'offline',
    label: { fr: 'hors-ligne', en: 'offline' },
    keywords: [
      'hors ligne',
      'offline',
      'sans connexion',
      'sans internet',
      'faible connexion',
      'connexion faible',
      'sans reseau',
      'pas de reseau',
      'indexeddb',
      'low connection',
      'weak connection',
      'no connection',
    ],
    verb: { fr: 'fonctionne hors-ligne', en: 'works offline' },
  },
  {
    id: 'ussd',
    label: { fr: 'USSD', en: 'USSD' },
    keywords: ['ussd', 'menu ussd', 'code star'],
    verb: { fr: 'utilise l’USSD', en: 'uses USSD' },
  },
  {
    id: 'sms',
    label: { fr: 'SMS', en: 'SMS' },
    keywords: ['sms', 'message texte', 'text message'],
    verb: { fr: 'envoie des SMS', en: 'sends SMS' },
  },
  {
    id: 'stock',
    label: { fr: 'gestion de stock', en: 'stock management' },
    keywords: [
      'stock',
      'inventaire',
      'inventory',
      'boutique',
      'commerce',
      'magasin',
      'shop',
      'store',
    ],
    verb: { fr: 'gère le stock', en: 'manages stock' },
  },
  {
    id: 'accounting',
    label: { fr: 'comptabilité', en: 'accounting' },
    keywords: [
      'comptabilite',
      'comptable',
      'compta',
      'facture',
      'factures',
      'invoice',
      'accounting',
      'bilan',
      'depense',
      'depenses',
      'expense',
      'expenses',
    ],
    verb: { fr: 'gère la comptabilité', en: 'handles accounting' },
  },
  {
    id: 'payment',
    label: { fr: 'paiement', en: 'payment' },
    keywords: [
      'paiement',
      'paiements',
      'payment',
      'payments',
      'payer',
      'pay',
      'transaction',
      'transactions',
      'encaisser',
      'checkout',
    ],
    verb: { fr: 'gère les paiements', en: 'handles payments' },
  },
  {
    id: 'pwa',
    label: { fr: 'PWA', en: 'PWA' },
    keywords: [
      'pwa',
      'progressive web app',
      'application installable',
      'installable',
      'service worker',
    ],
    verb: { fr: 's’installe comme PWA', en: 'works as a PWA' },
  },
  {
    id: 'api',
    label: { fr: 'API', en: 'API' },
    keywords: ['api', 'apis', 'rest', 'endpoint', 'microservice', 'sdk'],
    verb: { fr: 'expose une API', en: 'exposes an API' },
  },
  {
    id: 'education',
    label: { fr: 'éducation', en: 'education' },
    keywords: [
      'education',
      'e learning',
      'elearning',
      'learning',
      'cours',
      'course',
      'formation',
      'apprentissage',
      'ecole',
      'school',
      'etudiant',
      'student',
    ],
    verb: { fr: 'sert à l’apprentissage', en: 'supports learning' },
  },
  {
    id: 'agriculture',
    label: { fr: 'agriculture', en: 'agriculture' },
    keywords: [
      'agriculture',
      'agricole',
      'agriculteur',
      'agriculteurs',
      'farmer',
      'farm',
      'recolte',
      'elevage',
    ],
    verb: { fr: 'cible l’agriculture', en: 'targets agriculture' },
  },
  {
    id: 'currency',
    label: { fr: 'devises', en: 'currencies' },
    keywords: [
      'devise',
      'devises',
      'currency',
      'currencies',
      'cfa',
      'xof',
      'xaf',
      'naira',
      'cedi',
      'change',
      'taux de change',
      'exchange rate',
      'conversion',
    ],
    verb: { fr: 'gère les devises africaines', en: 'handles African currencies' },
  },
]

export type SearchableProject = {
  id: string
  title: string
  description: string
  technologies: string[]
  tags: string[]
  stars: number
  last_activity: string
}

export type ProjectSearchResult<
  T extends SearchableProject = SearchableProject,
> = {
  project: T
  score: number
  concepts: SearchConceptId[]
  matchedFields: SearchField[]
  /** Phrase explicative en français. */
  why: string
  /** Phrase explicative en anglais. */
  whyEn: string
}

export type SearchOutcome<
  T extends SearchableProject = SearchableProject,
> = {
  results: ProjectSearchResult<T>[]
  concepts: SearchConceptId[]
  tokens: string[]
  /** Phrase « Bondev a compris », en français. */
  understood: string
  /** Phrase « Bondev a compris », en anglais. */
  understoodEn: string
}

const FIELD_ORDER: readonly SearchField[] = [
  'tags',
  'technologies',
  'title',
  'description',
]

const CONCEPT_FIELD_SCORE: Record<SearchField, number> = {
  tags: 12,
  technologies: 6,
  title: 8,
  description: 3,
}

const TOKEN_FIELD_SCORE: Record<SearchField, number> = {
  tags: 4,
  technologies: 2,
  title: 3,
  description: 1,
}

/**
 * Mots trop généraux pour être utiles seuls. Les concepts du dictionnaire
 * restent détectés même quand un de leurs mots apparaît ici.
 */
const STOPWORDS = new Set([
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'du',
  'de',
  'd',
  'pour',
  'avec',
  'sans',
  'et',
  'ou',
  'en',
  'au',
  'aux',
  'mon',
  'ma',
  'mes',
  'ton',
  'ta',
  'tes',
  'son',
  'sa',
  'ses',
  'ce',
  'cette',
  'ces',
  'qui',
  'que',
  'quoi',
  'dont',
  'je',
  'tu',
  'il',
  'elle',
  'on',
  'nous',
  'vous',
  'ils',
  'elles',
  'cherche',
  'recherche',
  'besoin',
  'veux',
  'aimerais',
  'trouver',
  'projet',
  'projets',
  'solution',
  'solutions',
  'application',
  'applications',
  'app',
  'outil',
  'outils',
  'service',
  'services',
  'dans',
  'sur',
  'a',
  'the',
  'an',
  'of',
  'for',
  'with',
  'without',
  'and',
  'or',
  'to',
  'in',
  'on',
  'my',
  'i',
  'we',
  'need',
  'want',
  'find',
  'looking',
  'project',
  'projects',
  'app',
  'apps',
  'tool',
  'tools',
  'service',
  'services',
  'is',
  'are',
  'that',
  'which',
])

/** Minuscules, sans accents ni ponctuation. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fieldMatches(normalisedField: string, term: string): boolean {
  const needle = normalizeSearchText(term)
  if (!needle) return false
  const haystack = ` ${normalisedField} `
  if (needle.includes(' ')) return haystack.includes(` ${needle} `)
  const words = normalisedField.split(' ').filter(Boolean)
  // Les termes courts restent exacts (API, SMS, USSD…). Les termes plus longs
  // acceptent les pluriels et les variantes : « facture » trouve « factures ».
  if (needle.length <= 4) return words.includes(needle)
  return words.some((word) => word === needle || word.startsWith(needle))
}

function findConcepts(query: string): SearchConcept[] {
  const normalised = normalizeSearchText(query)
  if (!normalised) return []
  return SEARCH_CONCEPTS.filter((concept) =>
    concept.keywords.some((keyword) => fieldMatches(normalised, keyword)),
  )
}

function queryTokens(query: string): string[] {
  const normalised = normalizeSearchText(query)
  if (!normalised) return []
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const token of normalised.split(' ')) {
    if (token.length < 2 || STOPWORDS.has(token) || seen.has(token)) continue
    seen.add(token)
    tokens.push(token)
  }
  return tokens
}

/**
 * Mots déjà couverts par un concept : inutile de les recompter comme mots
 * isolés, sinon « mobile » ferait remonter n'importe quel projet mobile pour
 * une recherche « Mobile Money ».
 */
function conceptKeywordWords(concepts: SearchConcept[]): Set<string> {
  const words = new Set<string>()
  for (const concept of concepts) {
    for (const keyword of concept.keywords) {
      for (const word of normalizeSearchText(keyword).split(' ')) {
        if (word) words.add(word)
      }
    }
  }
  return words
}

type Scored<T extends SearchableProject> = {
  result: ProjectSearchResult<T>
  concepts: SearchConcept[]
}

function scoreProject<T extends SearchableProject>(
  project: T,
  concepts: SearchConcept[],
  tokens: string[],
): Scored<T> | null {
  const fields: Record<SearchField, string> = {
    tags: normalizeSearchText(project.tags.join(' ')),
    technologies: normalizeSearchText(project.technologies.join(' ')),
    title: normalizeSearchText(project.title),
    description: normalizeSearchText(project.description),
  }

  const matchedFields = new Set<SearchField>()
  const matchedConcepts: SearchConcept[] = []
  let score = 0

  for (const concept of concepts) {
    let matched = false
    for (const field of FIELD_ORDER) {
      if (
        concept.keywords.some((keyword) => fieldMatches(fields[field], keyword))
      ) {
        score += CONCEPT_FIELD_SCORE[field]
        matchedFields.add(field)
        matched = true
      }
    }
    if (matched) matchedConcepts.push(concept)
  }

  for (const token of tokens) {
    for (const field of FIELD_ORDER) {
      if (fieldMatches(fields[field], token)) {
        score += TOKEN_FIELD_SCORE[field]
        matchedFields.add(field)
      }
    }
  }

  if (score === 0) return null

  const matched = FIELD_ORDER.filter((field) => matchedFields.has(field))
  return {
    result: {
      project,
      score,
      concepts: matchedConcepts.map((concept) => concept.id),
      matchedFields: matched,
      why: buildWhy(project, matchedConcepts, tokens, fields, 'fr'),
      whyEn: buildWhy(project, matchedConcepts, tokens, fields, 'en'),
    },
    concepts: matchedConcepts,
  }
}

function addTechnology(
  sentence: string,
  project: SearchableProject,
  concepts: SearchConcept[],
  lang: 'fr' | 'en',
): string {
  const technology = project.technologies[0]
  if (!technology) return sentence
  const alreadyMentioned = [...concepts.map((c) => c.verb[lang]), sentence].some(
    (value) => normalizeSearchText(value).includes(normalizeSearchText(technology)),
  )
  if (alreadyMentioned) return sentence
  const startsWithWorks = concepts.some((c) => c.verb[lang].startsWith('fonctionne'))
  if (lang === 'en') return `${sentence} and works with ${technology}`
  return `${sentence} et ${startsWithWorks ? 's’appuie sur' : 'fonctionne avec'} ${technology}`
}

function buildWhy(
  project: SearchableProject,
  concepts: SearchConcept[],
  tokens: string[],
  fields: Record<SearchField, string>,
  lang: 'fr' | 'en',
): string {
  // « paiement » est trop général quand Mobile Money est déjà détecté.
  const visibleConcepts = concepts.filter(
    (concept) =>
      !(
        concept.id === 'payment' &&
        concepts.some((other) => other.id === 'mobile-money')
      ),
  )

  if (visibleConcepts.length > 0) {
    const verbs = visibleConcepts.map((concept) => concept.verb[lang])
    const joiner = lang === 'en' ? ' and ' : ' et '
    const subject = lang === 'en' ? 'It' : 'Il'
    return `${addTechnology(`${subject} ${verbs.join(joiner)}`, project, visibleConcepts, lang)}.`
  }

  const matchedTokens = tokens.filter((token) =>
    FIELD_ORDER.some((field) => fieldMatches(fields[field], token)),
  )
  const quoted = matchedTokens
    .slice(0, 2)
    .map((token) => `« ${token} »`)
    .join(lang === 'en' ? ' and ' : ' et ')

  if (!quoted) {
    return addTechnology(
      lang === 'en' ? 'It matches your search' : 'Il correspond à ta recherche',
      project,
      [],
      lang,
    ) + '.'
  }

  const field = FIELD_ORDER.find((name) =>
    matchedTokens.some((token) => fieldMatches(fields[name], token)),
  )
  const fieldLabel =
    lang === 'en'
      ? field === 'tags'
        ? 'its tags'
        : field === 'technologies'
          ? 'its technologies'
          : field === 'title'
            ? 'its title'
            : 'its description'
      : field === 'tags'
        ? 'ses tags'
        : field === 'technologies'
          ? 'ses technologies'
          : field === 'title'
            ? 'son titre'
            : 'sa description'

  const base =
    lang === 'en'
      ? `It matches ${quoted} in ${fieldLabel}`
      : `Il correspond à ${quoted} dans ${fieldLabel}`
  return `${addTechnology(base, project, visibleConcepts, lang)}.`
}

function understoodPhrase(
  concepts: SearchConcept[],
  tokens: string[],
  lang: 'fr' | 'en',
): string {
  if (concepts.length > 0) {
    const labels = concepts.map((concept) => concept.label[lang])
    return lang === 'en'
      ? `you are looking for: ${labels.join(' · ')}.`
      : `tu cherches une solution pour : ${labels.join(' · ')}.`
  }
  if (tokens.length > 0) {
    const quoted = tokens
      .slice(0, 5)
      .map((token) => `« ${token} »`)
      .join(' · ')
    return lang === 'en'
      ? `you are looking for: ${quoted}.`
      : `tu cherches : ${quoted}.`
  }
  return ''
}

/**
 * Recherche les projets correspondant à la requête.
 *
 * - une requête vide renvoie tout le catalogue, du plus récent au plus ancien ;
 * - les tags pèsent plus que les technologies, le titre et la description ;
 * - les résultats sont triés par score, puis par nombre d’utiles et fraîcheur.
 */
export function searchProjects<T extends SearchableProject>(
  projects: readonly T[],
  query: string,
): SearchOutcome<T> {
  const concepts = findConcepts(query)
  const tokens = queryTokens(query)
  const conceptWords = conceptKeywordWords(concepts)
  const scoringTokens = tokens.filter((token) => !conceptWords.has(token))
  const hasQuery = normalizeSearchText(query).length > 0

  if (!hasQuery) {
    const results = [...projects]
      .sort(
        (a, b) =>
          new Date(b.last_activity).getTime() -
          new Date(a.last_activity).getTime(),
      )
      .map((project) => ({
        project,
        score: 0,
        concepts: [] as SearchConceptId[],
        matchedFields: [] as SearchField[],
        why: '',
        whyEn: '',
      }))
    return {
      results,
      concepts: [],
      tokens: [],
      understood: '',
      understoodEn: '',
    }
  }

  const scored: Scored<T>[] = []
  for (const project of projects) {
    const match = scoreProject(project, concepts, scoringTokens)
    if (match) scored.push(match)
  }

  scored.sort((a, b) => {
    if (b.result.score !== a.result.score) {
      return b.result.score - a.result.score
    }
    if (b.result.project.stars !== a.result.project.stars) {
      return b.result.project.stars - a.result.project.stars
    }
    return (
      new Date(b.result.project.last_activity).getTime() -
      new Date(a.result.project.last_activity).getTime()
    )
  })

  return {
    results: scored.map((entry) => entry.result),
    concepts: concepts.map((concept) => concept.id),
    tokens,
    understood: understoodPhrase(concepts, tokens, 'fr'),
    understoodEn: understoodPhrase(concepts, tokens, 'en'),
  }
}
