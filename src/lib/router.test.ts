import { describe, expect, it } from 'vitest'
import {
  buildHash,
  isValidRouteId,
  parseHash,
  routeKey,
  sameRoute,
} from './router'

const PROJECT_ID = '3f1b8c2e-9d4a-4f6b-8c1d-2e3f4a5b6c7d'
const QUESTION_ID = 'a1b2c3d4-e5f6-4789-9abc-def012345678'

describe('parseHash — écrans simples', () => {
  it('traite un fragment vide ou la racine comme l’accueil', () => {
    expect(parseHash('')).toEqual({ name: 'home' })
    expect(parseHash('#')).toEqual({ name: 'home' })
    expect(parseHash('#/')).toEqual({ name: 'home' })
  })

  it('reconnaît chaque route de premier niveau', () => {
    expect(parseHash('#/entraide')).toEqual({ name: 'help' })
    expect(parseHash('#/profil')).toEqual({ name: 'profile' })
    expect(parseHash('#/regles')).toEqual({ name: 'how' })
    expect(parseHash('#/connexion')).toEqual({ name: 'login' })
  })

  it('accepte un fragment sans dièse', () => {
    expect(parseHash('/profil')).toEqual({ name: 'profile' })
  })
})

describe('parseHash — recherche', () => {
  it('lit la requête et décode les paramètres encodés', () => {
    expect(parseHash('#/recherche?q=sant%C3%A9%20hors-ligne')).toEqual({
      name: 'results',
      query: 'santé hors-ligne',
    })
  })

  it('gère les espaces encodés en + par URLSearchParams', () => {
    expect(parseHash('#/recherche?q=mobile+money')).toEqual({
      name: 'results',
      query: 'mobile money',
    })
  })

  it('renvoie une requête vide quand q est absent', () => {
    expect(parseHash('#/recherche')).toEqual({ name: 'results', query: '' })
    expect(parseHash('#/recherche?tri=recent')).toEqual({
      name: 'results',
      query: '',
    })
  })
})

describe('parseHash — identifiants', () => {
  it('reconnaît un projet et une question valides', () => {
    expect(parseHash(`#/projet/${PROJECT_ID}`)).toEqual({
      name: 'project',
      id: PROJECT_ID,
    })
    expect(parseHash(`#/projet/${PROJECT_ID.toUpperCase()}`)).toEqual({
      name: 'project',
      id: PROJECT_ID,
    })
    expect(parseHash(`#/entraide/${QUESTION_ID}`)).toEqual({
      name: 'question',
      id: QUESTION_ID,
    })
  })

  it('refuse un identifiant vide, trop court ou hors format', () => {
    expect(parseHash('#/projet/')).toMatchObject({ name: 'notFound' })
    expect(parseHash('#/projet/abc')).toMatchObject({ name: 'notFound' })
    expect(parseHash('#/projet/..%2Fprofil')).toMatchObject({
      name: 'notFound',
    })
    expect(parseHash('#/entraide/123')).toMatchObject({ name: 'notFound' })
  })

  it('valide le format UUID indépendamment de la casse', () => {
    expect(isValidRouteId(PROJECT_ID)).toBe(true)
    expect(isValidRouteId(PROJECT_ID.toUpperCase())).toBe(true)
    expect(isValidRouteId('pas-un-uuid')).toBe(false)
  })
})

describe('parseHash — routes inconnues', () => {
  it('renvoie une 404 avec le chemin demandé', () => {
    expect(parseHash('#/inconnue')).toEqual({
      name: 'notFound',
      path: '/inconnue',
    })
    expect(parseHash('#/projet/id/suite')).toEqual({
      name: 'notFound',
      path: '/projet/id/suite',
    })
    expect(parseHash('#contenu')).toEqual({
      name: 'notFound',
      path: '/contenu',
    })
  })

  it('ne lève pas sur un encodage invalide', () => {
    expect(() => parseHash('#/projet/%E0%A4%A')).not.toThrow()
    expect(parseHash('#/projet/%E0%A4%A')).toMatchObject({ name: 'notFound' })
  })
})

describe('buildHash', () => {
  it('produit des fragments canoniques', () => {
    expect(buildHash({ name: 'home' })).toBe('#/')
    expect(buildHash({ name: 'help' })).toBe('#/entraide')
    expect(buildHash({ name: 'profile' })).toBe('#/profil')
    expect(buildHash({ name: 'how' })).toBe('#/regles')
    expect(buildHash({ name: 'login' })).toBe('#/connexion')
    expect(buildHash({ name: 'project', id: PROJECT_ID })).toBe(
      `#/projet/${PROJECT_ID}`,
    )
    expect(buildHash({ name: 'question', id: QUESTION_ID })).toBe(
      `#/entraide/${QUESTION_ID}`,
    )
  })

  it('encode la requête de recherche', () => {
    expect(buildHash({ name: 'results', query: 'santé hors-ligne' })).toBe(
      '#/recherche?q=sant%C3%A9%20hors-ligne',
    )
    expect(buildHash({ name: 'results', query: '' })).toBe('#/recherche')
  })

  it('fait un aller-retour stable avec le parseur', () => {
    const routes = [
      { name: 'home' as const },
      { name: 'results' as const, query: 'mobile money & SMS' },
      { name: 'project' as const, id: PROJECT_ID },
      { name: 'question' as const, id: QUESTION_ID },
      { name: 'notFound' as const, path: '/perdu' },
    ]
    for (const route of routes) {
      expect(parseHash(buildHash(route))).toEqual(route)
    }
  })
})

describe('routeKey et sameRoute', () => {
  it('distingue deux projets mais reconnaît la même route', () => {
    expect(routeKey({ name: 'project', id: PROJECT_ID })).toBe(
      `project:${PROJECT_ID}`,
    )
    expect(
      sameRoute(
        { name: 'project', id: PROJECT_ID },
        { name: 'project', id: PROJECT_ID.toUpperCase() },
      ),
    ).toBe(true)
    expect(
      sameRoute(
        { name: 'project', id: PROJECT_ID },
        { name: 'project', id: QUESTION_ID },
      ),
    ).toBe(false)
  })
})
