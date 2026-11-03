import { describe, expect, it } from 'vitest'
import {
  formatTimeLeft,
  isHelpTier,
  pointsLabel,
  statusLabel,
  tierLabel,
  translateHelpError,
} from './help'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

describe('formatTimeLeft', () => {
  const now = new Date('2026-11-03T12:00:00.000Z').getTime()

  it('affiche les jours restants en français', () => {
    expect(formatTimeLeft(new Date(now + 5 * DAY), 'fr', now)).toBe(
      'Expire dans 5 j',
    )
  })

  it('arrondit au jour supérieur et gère le dernier jour', () => {
    expect(formatTimeLeft(new Date(now + 4 * DAY + 2 * HOUR), 'fr', now)).toBe(
      'Expire dans 5 j',
    )
    expect(formatTimeLeft(new Date(now + 2 * HOUR), 'fr', now)).toBe(
      'Expire aujourd’hui',
    )
  })

  it('signale une question expirée', () => {
    expect(formatTimeLeft(new Date(now - HOUR), 'fr', now)).toBe('Expirée')
    expect(formatTimeLeft(new Date(now - HOUR), 'en', now)).toBe('Expired')
  })

  it('traduit en anglais et ignore une date invalide', () => {
    expect(formatTimeLeft(new Date(now + 3 * DAY), 'en', now)).toBe(
      'Expires in 3 d',
    )
    expect(formatTimeLeft('pas une date', 'fr', now)).toBe('')
  })
})

describe('libellés des paliers', () => {
  it('connaît uniquement 1, 3 et 6 points', () => {
    expect(isHelpTier(1)).toBe(true)
    expect(isHelpTier(3)).toBe(true)
    expect(isHelpTier(6)).toBe(true)
    expect(isHelpTier(2)).toBe(false)
  })

  it('affiche les noms français et anglais', () => {
    expect(tierLabel(1, 'fr')).toBe('Coup de pouce')
    expect(tierLabel(3, 'fr')).toBe('Aide moyenne')
    expect(tierLabel(6, 'en')).toBe('Big helping hand')
  })

  it('accorde les points et traduit les statuts', () => {
    expect(pointsLabel(1, 'fr')).toBe('1 point')
    expect(pointsLabel(3, 'fr')).toBe('3 points')
    expect(statusLabel('resolved', 'fr')).toBe('Résolue ✓')
    expect(statusLabel('withdrawn', 'en')).toBe('Withdrawn')
  })
})

describe('translateHelpError', () => {
  it('traduit les erreurs métier de l’Entraide', () => {
    expect(translateHelpError('Solde insuffisant (0 points, palier 3)')).toBe(
      'Solde insuffisant. Choisis un palier plus petit ou utilise ta question gratuite.',
    )
    expect(
      translateHelpError(
        'Une réponse a déjà été validée pour cette question',
      ),
    ).toBe('Une réponse a déjà été validée pour cette question.')
    expect(
      translateHelpError(
        'Seul l’auteur de la question peut valider une réponse',
      ),
    ).toBe('Seul l’auteur de la question peut valider une réponse.')
    expect(
      translateHelpError('Impossible de valider sa propre réponse'),
    ).toBe('Tu ne peux pas valider ta propre réponse.')
    expect(
      translateHelpError(
        'Maximum 10 questions ouvertes en même temps',
      ),
    ).toBe(
      'Tu as déjà 10 questions ouvertes. Attends qu’une se termine ou retire-en une.',
    )
  })

  it('laisse passer les erreurs inconnues', () => {
    expect(translateHelpError('something else')).toBeNull()
    expect(translateHelpError(new Error(''))).toBeNull()
  })
})
