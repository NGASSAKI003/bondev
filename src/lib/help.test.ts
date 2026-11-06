import { describe, expect, it } from 'vitest'
import {
  firstQuestionFormError,
  firstQuestionFormField,
  formatTimeLeft,
  isHelpTier,
  parseQuestionTechnologies,
  pointsLabel,
  statusLabel,
  tierLabel,
  translateHelpError,
  validateQuestionForm,
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

describe('validation du formulaire de question', () => {
  const validForm = {
    title: 'Mon paiement Mobile Money échoue',
    body: 'Le paiement renvoie une erreur 500 quand je valide le formulaire.',
    technologies: 'React, Node.js',
    tier: 1 as const,
    githubUrl: 'https://github.com/ngassaki/bondev',
  }

  it('accepte un formulaire complet', () => {
    expect(validateQuestionForm(validForm)).toEqual({})
  })

  it('indique le titre fautif avec ses limites', () => {
    expect(
      validateQuestionForm({ ...validForm, title: 'abc' }).title,
    ).toBe('Le titre doit contenir entre 5 et 300 caractères.')
  })

  it('impose une description d’au moins 10 caractères', () => {
    expect(
      validateQuestionForm({ ...validForm, body: 'court' }).body,
    ).toBe(
      'La description doit contenir au moins 10 caractères pour expliquer ton blocage.',
    )
    expect(
      validateQuestionForm({ ...validForm, body: '' }).body,
    ).toBe(
      'La description doit contenir au moins 10 caractères pour expliquer ton blocage.',
    )
  })

  it('exige une technologie et un palier valide', () => {
    expect(
      validateQuestionForm({ ...validForm, technologies: ' , , ' })
        .technologies,
    ).toBe('Choisis au moins une technologie, séparée par des virgules.')
    expect(validateQuestionForm({ ...validForm, tier: 2 }).tier).toBe(
      'Choisis un palier valide : 1, 3 ou 6 points.',
    )
  })

  it('refuse un lien GitHub qui ne pointe pas vers github.com', () => {
    expect(
      validateQuestionForm({
        ...validForm,
        githubUrl: 'https://gitlab.com/pseudo/depot',
      }).githubUrl,
    ).toBe(
      'Le lien GitHub doit commencer par https://github.com/ et pointer vers une page.',
    )
    expect(
      validateQuestionForm({ ...validForm, githubUrl: '' }).githubUrl,
    ).toBeUndefined()
  })

  it('renvoie le premier champ invalide dans l’ordre du formulaire', () => {
    const errors = validateQuestionForm({
      ...validForm,
      title: '',
      technologies: '',
      tier: 0,
    })
    expect(firstQuestionFormField(errors)).toBe('title')
    expect(firstQuestionFormError(errors)).toBe(
      'Le titre doit contenir entre 5 et 300 caractères.',
    )
  })

  it('nettoie les technologies séparées par des virgules', () => {
    expect(
      parseQuestionTechnologies(' React, Node.js, React,  , PostgreSQL '),
    ).toEqual(['React', 'Node.js', 'PostgreSQL'])
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
    expect(translateHelpError('Question introuvable')).toBe(
      'Cette question n’existe plus.',
    )
    expect(translateHelpError("La question n'est plus ouverte")).toBe(
      'Cette question n’est plus ouverte.',
    )
    expect(translateHelpError('Non authentifié')).toBe(
      'Connecte-toi pour faire cette action.',
    )
  })

  it('laisse passer les erreurs inconnues', () => {
    expect(translateHelpError('something else')).toBeNull()
    expect(translateHelpError(new Error(''))).toBeNull()
  })
})
