import { describe, expect, it } from 'vitest'
import { ApiError, toFrenchError } from './api'

describe('toFrenchError', () => {
  it('conserve le message lisible d’une ApiError', () => {
    expect(
      toFrenchError(new ApiError('Le titre doit contenir entre 5 et 300 caractères.')),
    ).toBe('Le titre doit contenir entre 5 et 300 caractères.')
  })

  it('traduit les erreurs de connexion et de réseau', () => {
    expect(toFrenchError(new Error('Failed to fetch'))).toBe(
      'Impossible de contacter le serveur. Vérifie ta connexion et réessaie.',
    )
    expect(toFrenchError(new Error('Auth session missing'))).toBe(
      'Ta session a expiré. Reconnecte-toi.',
    )
    expect(toFrenchError(new Error('JWT expired'))).toBe(
      'Ta session a expiré. Reconnecte-toi.',
    )
  })

  it('traduit les erreurs connues de l’Entraide', () => {
    expect(toFrenchError(new Error('Solde insuffisant (0 points, palier 3)'))).toBe(
      'Solde insuffisant. Choisis un palier plus petit ou utilise ta question gratuite.',
    )
    expect(toFrenchError(new Error('Question introuvable'))).toBe(
      'Cette question n’existe plus.',
    )
  })

  it('traduit les codes PostgreSQL et les limites de débit', () => {
    expect(toFrenchError({ code: '23505', message: '' })).toBe(
      'Cette information est déjà utilisée.',
    )
    expect(toFrenchError({ code: '42501', message: '' })).toBe(
      'Tu n’as pas le droit de faire cette action.',
    )
    expect(toFrenchError({ status: 429, message: '' })).toBe(
      'Trop de tentatives. Patiente un moment avant de réessayer.',
    )
  })

  it('affiche un message simple pour une erreur inconnue', () => {
    expect(toFrenchError(new Error('boom'))).toBe(
      'Une erreur est survenue. Réessaie dans un instant.',
    )
    expect(toFrenchError(null)).toBe(
      'Une erreur est survenue. Réessaie dans un instant.',
    )
  })
})
