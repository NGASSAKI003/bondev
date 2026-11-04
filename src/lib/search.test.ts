import { describe, expect, it } from 'vitest'
import { normalizeSearchText, searchProjects, type SearchableProject } from './search'

function project(
  id: string,
  title: string,
  description: string,
  technologies: string[],
  tags: string[],
  githubStars: number,
  lastActivity: string,
): SearchableProject {
  return {
    id,
    title,
    description,
    technologies,
    tags,
    stars: 0,
    github_stars: githubStars,
    last_activity: lastActivity,
  }
}

const CATALOGUE: SearchableProject[] = [
  project(
    'stock',
    '[Exemple] Gestion de stock pour petites boutiques',
    'Application web pour suivre les produits, les ventes et les alertes de stock. Adaptée aux commerces africains avec un mode hors-ligne.',
    ['React', 'Node.js', 'SQLite'],
    ['hors-ligne', 'commerce'],
    12,
    '2026-11-01T10:00:00.000Z',
  ),
  project(
    'mobile-money',
    '[Exemple] Intégration Mobile Money MTN et Airtel',
    'SDK JavaScript pour intégrer les paiements Mobile Money (MTN MoMo, Airtel Money) sur un site web.',
    ['Node.js', 'TypeScript', 'API REST'],
    ['Mobile Money', 'fintech', 'paiement'],
    28,
    '2026-10-28T10:00:00.000Z',
  ),
  project(
    'offline-forms',
    '[Exemple] Formulaires qui marchent sans connexion',
    'Bibliothèque PWA pour créer des formulaires qui enregistrent les réponses en IndexedDB.',
    ['JavaScript', 'PWA', 'IndexedDB'],
    ['hors-ligne', 'formulaire', 'faible connexion'],
    19,
    '2026-10-25T10:00:00.000Z',
  ),
  project(
    'ussd',
    '[Exemple] Framework USSD pour services sans internet',
    'Créer des menus USSD interactifs en Python pour les personnes sans smartphone.',
    ['Python', 'USSD', 'API'],
    ['USSD', 'pas de smartphone', 'accessibilité'],
    15,
    '2026-10-30T10:00:00.000Z',
  ),
  project(
    'accounting',
    '[Exemple] Comptabilité simplifiée pour PME',
    'Application de comptabilité simple : factures, dépenses, rapports PDF.',
    ['React', 'Python', 'PostgreSQL'],
    ['comptabilité', 'PME', 'francophone'],
    8,
    '2026-10-23T10:00:00.000Z',
  ),
  project(
    'sms',
    '[Exemple] Passerelle SMS multi-opérateurs',
    'Microservice pour envoyer des SMS via les APIs de MTN, Orange et Airtel.',
    ['Node.js', 'Redis', 'Docker'],
    ['SMS', 'notification', 'multi-opérateurs'],
    22,
    '2026-10-29T10:00:00.000Z',
  ),
  project(
    'education',
    '[Exemple] Plateforme e-learning hors-ligne',
    'Application mobile pour suivre des cours même sans connexion.',
    ['React Native', 'SQLite', 'PWA'],
    ['hors-ligne', 'éducation', 'mobile'],
    14,
    '2026-10-27T10:00:00.000Z',
  ),
  project(
    'agriculture',
    '[Exemple] Marketplace pour produits agricoles',
    'Plateforme qui met en relation les agriculteurs et les acheteurs. Paiement via Mobile Money, notifications SMS.',
    ['Vue.js', 'Node.js', 'MongoDB'],
    ['Mobile Money', 'agriculture', 'SMS'],
    17,
    '2026-10-22T10:00:00.000Z',
  ),
  project(
    'currency',
    '[Exemple] API de conversion CFA / devises africaines',
    'API REST pour convertir entre le franc CFA (XOF/XAF), le naira et le cedi.',
    ['Go', 'API REST', 'PostgreSQL'],
    ['fintech', 'devises', 'API'],
    11,
    '2026-10-18T10:00:00.000Z',
  ),
  project(
    'receipts',
    '[Exemple] Générateur de reçus PDF et WhatsApp',
    'Micro-service qui génère des reçus de paiement en PDF ou en image.',
    ['Node.js', 'Puppeteer', 'TypeScript'],
    ['paiement', 'PDF', 'WhatsApp'],
    9,
    '2026-10-15T10:00:00.000Z',
  ),
]

/**
 * Petit catalogue fictif pour tester les recherches du catalogue de départ.
 * Aucun appel réseau : les projets sont entièrement définis ici.
 */
const CATALOGUE_OPEN_SOURCE: SearchableProject[] = [
  project(
    'cht',
    'Community Health Toolkit',
    'Application de santé communautaire qui fonctionne hors-ligne, même avec une faible connexion.',
    ['JavaScript', 'CouchDB'],
    ['santé', 'hors-ligne', 'faible connexion'],
    563,
    '2026-11-04T19:53:40.000Z',
  ),
  project(
    'openmrs',
    'OpenMRS',
    'Dossier médical open source pour les cliniques et les hôpitaux.',
    ['Java', 'Spring'],
    ['santé', 'hôpital'],
    480,
    '2026-10-20T10:00:00.000Z',
  ),
  project(
    'africas-talking',
    "Africa's Talking",
    'SDK pour envoyer des SMS, créer des menus USSD et intégrer des paiements mobile.',
    ['JavaScript', 'API'],
    ['SMS', 'USSD', 'paiement'],
    167,
    '2026-10-09T10:00:00.000Z',
  ),
  project(
    'kolibri',
    'Kolibri',
    "Plateforme d'apprentissage qui fonctionne hors-ligne, pensée pour les écoles sans internet fiable.",
    ['Python', 'Django'],
    ['éducation', 'hors-ligne', 'faible connexion'],
    1168,
    '2026-11-02T10:00:00.000Z',
  ),
  project(
    'dexie',
    'Dexie.js',
    'Wrapper minimaliste pour IndexedDB, utile pour stocker des données hors-ligne dans le navigateur.',
    ['JavaScript', 'IndexedDB'],
    ['hors-ligne', 'base de données', 'navigateur'],
    12000,
    '2026-10-30T10:00:00.000Z',
  ),
  project(
    'workbox',
    'Workbox',
    'Bibliothèque de service workers pour rendre une PWA rapide et disponible hors-ligne.',
    ['JavaScript', 'Service Worker'],
    ['hors-ligne', 'PWA', 'performance'],
    11000,
    '2026-10-31T10:00:00.000Z',
  ),
]

describe('normalizeSearchText', () => {
  it('ignore les accents, la casse et la ponctuation', () => {
    expect(normalizeSearchText('  Éducation, HORS-LIGNE ! ')).toBe(
      'education hors ligne',
    )
  })
})

describe('searchProjects', () => {
  it('classe le projet Mobile Money en premier avec une explication', () => {
    const outcome = searchProjects(CATALOGUE, 'paiement mobile money')

    expect(outcome.results[0]?.project.title).toContain(
      'Intégration Mobile Money',
    )
    expect(outcome.results[0]?.why).toContain('Mobile Money')
    expect(outcome.results[0]?.why).not.toContain('Node.js')
    expect(outcome.results[0]?.why).not.toContain('TypeScript')
    expect(outcome.understood).toContain('Mobile Money')
    expect(outcome.understood).toContain('paiement')
  })

  it('ne cite une technologie que si la requête la nomme', () => {
    const unnamed = searchProjects(CATALOGUE, 'stock')

    expect(unnamed.results[0]?.why).not.toContain('React')

    const named = searchProjects(CATALOGUE, 'stock React')

    expect(named.results[0]?.why).toContain('React')
  })

  it('comprend « sans connexion » comme le concept hors-ligne', () => {
    const outcome = searchProjects(CATALOGUE, 'sans connexion')

    expect(outcome.results[0]?.project.id).toBe('offline-forms')
    expect(outcome.understood).toContain('hors-ligne')
    expect(outcome.results[0]?.why).toContain('hors-ligne')
  })

  it('trouve la gestion de stock avec « stock boutique »', () => {
    const outcome = searchProjects(CATALOGUE, 'stock boutique')

    expect(outcome.results[0]?.project.id).toBe('stock')
    expect(outcome.understood).toContain('gestion de stock')
  })

  it('renvoie une liste vide quand rien ne correspond', () => {
    const outcome = searchProjects(CATALOGUE, 'astronautique quantique')

    expect(outcome.results).toEqual([])
    expect(outcome.understood).toContain('astronautique')
  })

  it('tolère les requêtes sans accents et avec accents', () => {
    const withoutAccent = searchProjects(CATALOGUE, 'comptabilite')
    const withAccent = searchProjects(CATALOGUE, 'COMPTABILITÉ')

    expect(withoutAccent.results[0]?.project.id).toBe('accounting')
    expect(withAccent.results[0]?.project.id).toBe('accounting')
    expect(searchProjects(CATALOGUE, 'education').results[0]?.project.id).toBe(
      'education',
    )
  })

  it('renvoie tout le catalogue, du plus récent au plus ancien, sans requête', () => {
    const outcome = searchProjects(CATALOGUE, '   ')

    expect(outcome.results).toHaveLength(CATALOGUE.length)
    expect(outcome.results[0]?.project.id).toBe('stock')
    expect(outcome.understood).toBe('')
  })
})

describe('catalogue de départ', () => {
  it('trouve un outil de santé qui fonctionne hors-ligne', () => {
    const outcome = searchProjects(
      CATALOGUE_OPEN_SOURCE,
      'application de santé hors-ligne',
    )
    const ids = outcome.results.map((result) => result.project.id)

    expect(outcome.understood).toBe('santé · hors-ligne')
    expect(outcome.results[0]?.project.id).toBe('cht')
    expect(outcome.results[0]?.why).toContain('santé')
    expect(outcome.results[0]?.why).toContain('hors-ligne')
    expect(outcome.results[0]?.why).not.toContain('JavaScript')

    expect(ids).toContain('openmrs')
    expect(ids).toContain('dexie')
    expect(ids).toContain('workbox')
    // Les projets de santé passent avant les bibliothèques techniques qui ne
    // partagent que la contrainte « hors-ligne ».
    expect(ids.indexOf('cht')).toBeLessThan(ids.indexOf('dexie'))
    expect(ids.indexOf('cht')).toBeLessThan(ids.indexOf('workbox'))
    expect(ids.indexOf('openmrs')).toBeLessThan(ids.indexOf('dexie'))
    expect(ids.indexOf('openmrs')).toBeLessThan(ids.indexOf('workbox'))
  })

  it("trouve Africa's Talking avec « sms ussd »", () => {
    const outcome = searchProjects(CATALOGUE_OPEN_SOURCE, 'sms ussd')

    expect(outcome.results[0]?.project.id).toBe('africas-talking')
    expect(outcome.understood).toBe('SMS · USSD')
    expect(outcome.results[0]?.why).toContain('SMS')
    expect(outcome.results[0]?.why).toContain('USSD')
    expect(outcome.results[0]?.why).not.toContain('JavaScript')
    expect(outcome.concepts).toContain('sms')
    expect(outcome.concepts).toContain('ussd')
  })

  it('trouve Kolibri avec « apprendre sans internet »', () => {
    const outcome = searchProjects(
      CATALOGUE_OPEN_SOURCE,
      'apprendre sans internet',
    )

    expect(outcome.results[0]?.project.id).toBe('kolibri')
    expect(outcome.understood).toBe('éducation · hors-ligne')
    expect(outcome.results[0]?.why).toContain('apprentissage')
    expect(outcome.results[0]?.why).toContain('hors-ligne')
    expect(outcome.results[0]?.why).not.toContain('Python')
  })

  it('reconnaît les nouveaux concepts du catalogue', () => {
    const cases = [
      ['santé', 'health'],
      ['microfinance', 'microfinance'],
      ['collecte de données', 'data-collection'],
      ['cartographie', 'mapping'],
      ['humanitaire', 'humanitarian'],
      ['état civil', 'civil-registry'],
      ['langues africaines', 'african-languages'],
      ['intelligence artificielle', 'ai'],
      ['messagerie', 'messaging'],
      ['PME', 'sme'],
      ['mobile', 'mobile'],
      ['faible connexion', 'offline'],
    ] as const

    for (const [query, concept] of cases) {
      expect(searchProjects(CATALOGUE_OPEN_SOURCE, query).concepts).toContain(
        concept,
      )
    }
  })
})
