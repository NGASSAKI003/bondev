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
  | 'health'
  | 'microfinance'
  | 'data-collection'
  | 'mapping'
  | 'humanitarian'
  | 'civil-registry'
  | 'african-languages'
  | 'ai'
  | 'messaging'
  | 'sme'
  | 'mobile'

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
      'apprendre',
      'learn',
      'apprenant',
      'élève',
      'eleve',
      'pupil',
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
  {
    id: 'health',
    label: { fr: 'santé', en: 'health' },
    keywords: [
      'santé',
      'health',
      'healthcare',
      'soin',
      'soins',
      'hôpital',
      'hopital',
      'hospital',
      'clinique',
      'clinic',
      'médecin',
      'medecin',
      'docteur',
      'doctor',
      'médical',
      'medical',
      'patient',
      'patients',
      'dispensaire',
      'ehealth',
      'e-santé',
      'santé publique',
      'public health',
    ],
    verb: { fr: 'sert la santé', en: 'supports health' },
  },
  {
    id: 'microfinance',
    label: { fr: 'microfinance', en: 'microfinance' },
    keywords: [
      'microfinance',
      'micro finance',
      'microcrédit',
      'micro-crédit',
      'crédit',
      'credit',
      'prêt',
      'pret',
      'loan',
      'loans',
      'épargne',
      'epargne',
      'savings',
      'sacco',
      'caisse',
      'coopérative',
      'cooperative',
      'banque',
      'bank',
      'banking',
      'inclusion financière',
      'financial inclusion',
    ],
    verb: { fr: 'gère la microfinance', en: 'supports microfinance' },
  },
  {
    id: 'data-collection',
    label: { fr: 'collecte de données', en: 'data collection' },
    keywords: [
      'collecte de données',
      'collecte',
      'enquête',
      'enquêtes',
      'survey',
      'surveys',
      'formulaire',
      'formulaires',
      'form',
      'forms',
      'questionnaire',
      'questionnaires',
      'data collection',
      'field data',
      'collecte terrain',
      'recensement',
      'census',
      'saisie',
    ],
    verb: { fr: 'collecte des données', en: 'collects data' },
  },
  {
    id: 'mapping',
    label: { fr: 'cartographie', en: 'mapping' },
    keywords: [
      'cartographie',
      'carto',
      'carte',
      'cartes',
      'map',
      'maps',
      'mapping',
      'géolocalisation',
      'geospatial',
      'sig',
      'gis',
      'openstreetmap',
      'osm',
    ],
    verb: { fr: 'affiche des cartes', en: 'provides maps' },
  },
  {
    id: 'humanitarian',
    label: { fr: 'humanitaire', en: 'humanitarian' },
    keywords: [
      'humanitaire',
      'humanitarian',
      'crise',
      'crisis',
      'urgence',
      'emergency',
      'catastrophe',
      'disaster',
      'réfugié',
      'réfugiés',
      'refugee',
      'refugees',
      'ong',
      'ngo',
      'aide humanitaire',
      'humanitarian aid',
    ],
    verb: { fr: 'aide en contexte humanitaire', en: 'supports humanitarian work' },
  },
  {
    id: 'civil-registry',
    label: { fr: 'état civil', en: 'civil registry' },
    keywords: [
      'état civil',
      'civil registry',
      'civil registration',
      'birth registration',
      'naissance',
      'naissances',
      'birth',
      'births',
      'certificat',
      'certificate',
      'acte de naissance',
      'crvs',
      'identité',
      'identity',
      'identification',
    ],
    verb: { fr: 'enregistre l’état civil', en: 'registers civil records' },
  },
  {
    id: 'african-languages',
    label: { fr: 'langues africaines', en: 'African languages' },
    keywords: [
      'langues africaines',
      'langue africaine',
      'african languages',
      'african language',
      'swahili',
      'yoruba',
      'igbo',
      'hausa',
      'wolof',
      'bambara',
      'lingala',
      'amharique',
      'amharic',
      'traduction',
      'translation',
      'translate',
      'machine translation',
      'traduction automatique',
      'nlp',
      'traitement du langage',
    ],
    verb: {
      fr: 'prend en charge les langues africaines',
      en: 'supports African languages',
    },
  },
  {
    id: 'ai',
    label: { fr: 'IA', en: 'AI' },
    keywords: [
      'ia',
      'intelligence artificielle',
      'artificial intelligence',
      'machine learning',
      'apprentissage automatique',
      'deep learning',
      'apprentissage profond',
      'ml',
      'ai',
      'llm',
      'modèle',
      'model',
      'neural',
      'réseau de neurones',
    ],
    verb: { fr: 'utilise l’IA', en: 'uses AI' },
  },
  {
    id: 'messaging',
    label: { fr: 'messagerie', en: 'messaging' },
    keywords: [
      'messagerie',
      'messaging',
      'message',
      'messages',
      'chat',
      'whatsapp',
      'telegram',
      'bot',
      'chatbot',
      'conversation',
      'conversationnel',
      'conversational',
      'texto',
    ],
    verb: { fr: 'gère la messagerie', en: 'handles messaging' },
  },
  {
    id: 'sme',
    label: { fr: 'PME', en: 'SMEs' },
    keywords: [
      'pme',
      'petite entreprise',
      'petites entreprises',
      'small business',
      'small businesses',
      'sme',
      'smes',
      'entreprise',
      'entreprises',
      'business',
      'artisan',
      'artisans',
    ],
    verb: { fr: 'cible les PME', en: 'targets SMEs' },
  },
  {
    id: 'mobile',
    label: { fr: 'mobile', en: 'mobile' },
    keywords: [
      'mobile',
      'mobiles',
      'téléphone',
      'smartphone',
      'smartphones',
      'android',
      'ios',
      'application mobile',
      'applications mobiles',
      'gsm',
      'cellular',
      'feature phone',
      'téléphone basique',
    ],
    verb: { fr: 'cible le mobile', en: 'targets mobile' },
  },
]

export type SearchableProject = {
  id: string
  title: string
  description: string
  technologies: string[]
  tags: string[]
  /** Nombre de « Ça m’a servi » reçus sur Bondev. */
  stars: number
  /** Étoiles GitHub, quand le projet vient du catalogue importé. */
  github_stars?: number
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
 * Concepts de domaine (santé, éducation, agriculture…). Quand une requête en
 * contient un, les projets qui y répondent passent avant ceux qui ne partagent
 * qu'une contrainte technique comme « hors-ligne » ou « API ».
 */
const DOMAIN_CONCEPTS = new Set<SearchConceptId>([
  'mobile-money',
  'stock',
  'accounting',
  'payment',
  'education',
  'agriculture',
  'currency',
  'health',
  'microfinance',
  'data-collection',
  'mapping',
  'humanitarian',
  'civil-registry',
  'african-languages',
  'sme',
])

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

export function findConcepts(query: string): SearchConcept[] {
  const normalised = normalizeSearchText(query)
  if (!normalised) return []

  const matches: { concept: SearchConcept; position: number }[] = []
  for (const concept of SEARCH_CONCEPTS) {
    let position = Number.POSITIVE_INFINITY
    for (const keyword of concept.keywords) {
      if (!fieldMatches(normalised, keyword)) continue
      const index = normalised.indexOf(normalizeSearchText(keyword))
      if (index >= 0 && index < position) position = index
    }
    if (position !== Number.POSITIVE_INFINITY) {
      matches.push({ concept, position })
    }
  }

  // L'ordre de la requête prime sur l'ordre du dictionnaire : « santé
  // hors-ligne » s'affiche « santé · hors-ligne », pas l'inverse.
  return matches
    .sort((a, b) => a.position - b.position)
    .map((match) => match.concept)
}

export function queryTokens(query: string): string[] {
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
  /** Nombre de concepts de domaine trouvés dans le projet. */
  domainMatches: number
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
    domainMatches: matchedConcepts.filter((concept) =>
      DOMAIN_CONCEPTS.has(concept.id),
    ).length,
  }
}

/**
 * Ajoute une technologie uniquement quand la requête la nomme. Pour les autres
 * correspondances, les concepts et les étiquettes suffisent : on n'ajoute
 * jamais « s'appuie sur TypeScript » sans que l'utilisateur ait demandé TypeScript.
 */
function addNamedTechnologies(
  sentence: string,
  project: SearchableProject,
  tokens: string[],
  lang: 'fr' | 'en',
): string {
  const normalisedSentence = normalizeSearchText(sentence)
  const named = project.technologies
    .filter((technology) => {
      const normalised = normalizeSearchText(technology)
      if (!normalised || normalisedSentence.includes(normalised)) return false
      return tokens.some((token) => fieldMatches(normalised, token))
    })
    .slice(0, 2)
  if (named.length === 0) return sentence
  const list = named.join(lang === 'en' ? ' and ' : ' et ')
  return lang === 'en'
    ? `${sentence} and uses ${list}`
    : `${sentence} et s’appuie sur ${list}`
}

function buildWhy(
  project: SearchableProject,
  concepts: SearchConcept[],
  tokens: string[],
  fields: Record<SearchField, string>,
  lang: 'fr' | 'en',
): string {
  // « paiement » et « mobile » sont trop généraux quand Mobile Money est déjà détecté.
  const visibleConcepts = concepts.filter((concept) => {
    if (concept.id === 'payment' && concepts.some((other) => other.id === 'mobile-money')) {
      return false
    }
    if (concept.id === 'mobile' && concepts.some((other) => other.id === 'mobile-money')) {
      return false
    }
    return true
  })

  if (visibleConcepts.length > 0) {
    const verbs = visibleConcepts.map((concept) => concept.verb[lang])
    const joiner = lang === 'en' ? ' and ' : ' et '
    const subject = lang === 'en' ? 'It' : 'Il'
    const base = `${subject} ${verbs.join(joiner)}`
    return `${addNamedTechnologies(base, project, tokens, lang)}.`
  }

  const matchedTokens = tokens.filter((token) =>
    FIELD_ORDER.some((field) => fieldMatches(fields[field], token)),
  )
  const quoted = matchedTokens
    .slice(0, 2)
    .map((token) => `« ${token} »`)
    .join(lang === 'en' ? ' and ' : ' et ')

  if (!quoted) {
    return lang === 'en' ? 'It matches your search.' : 'Il correspond à ta recherche.'
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
  return `${addNamedTechnologies(base, project, tokens, lang)}.`
}

function understoodPhrase(
  concepts: SearchConcept[],
  tokens: string[],
  lang: 'fr' | 'en',
): string {
  if (concepts.length > 0) {
    const labels = concepts.map((concept) => concept.label[lang])
    return labels.join(' · ')
  }
  if (tokens.length > 0) {
    return tokens
      .slice(0, 5)
      .map((token) => `« ${token} »`)
      .join(' · ')
  }
  return ''
}

/**
 * Recherche les projets correspondant à la requête.
 *
 * - une requête vide renvoie tout le catalogue, du plus récent au plus ancien ;
 * - les tags pèsent plus que les technologies, le titre et la description ;
 * - les concepts de domaine (santé, éducation…) passent avant les simples
 *   contraintes techniques (hors-ligne, API…) ;
 * - à pertinence égale, les étoiles GitHub puis les « Ça m’a servi » et la
 *   fraîcheur départagent les résultats.
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
    if (b.domainMatches !== a.domainMatches) {
      return b.domainMatches - a.domainMatches
    }
    if (b.result.score !== a.result.score) {
      return b.result.score - a.result.score
    }
    const aGithub = a.result.project.github_stars ?? 0
    const bGithub = b.result.project.github_stars ?? 0
    if (bGithub !== aGithub) {
      return bGithub - aGithub
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

/**
 * Fragments d'un texte à mettre en avant dans les résultats. Le découpage
 * conserve la ponctuation et les espaces : l'interface peut rendre le texte
 * d'origine à l'identique, seuls les mots reconnus passent dans un `<mark>`.
 */
export type HighlightPart = { text: string; match: boolean }

export function splitHighlight(
  text: string,
  tokens: readonly string[],
): HighlightPart[] {
  if (!text) return []
  if (tokens.length === 0) return [{ text, match: false }]
  return text.split(/(\s+)/).map((chunk) => {
    if (!chunk || /^\s+$/.test(chunk)) return { text: chunk, match: false }
    const word = normalizeSearchText(chunk)
    const match = Boolean(
      word &&
        tokens.some(
          (token) =>
            word === token || (token.length > 4 && word.startsWith(token)),
        ),
    )
    return { text: chunk, match }
  })
}

