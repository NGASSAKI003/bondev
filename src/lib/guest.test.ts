import { describe, expect, it } from 'vitest'
import {
  GUEST_PSEUDO_PATTERN,
  generateGuestPseudo,
  isGuestPseudo,
  isGuestUser,
  randomGuestSuffix,
  shouldShowGuestBanner,
} from './guest'

describe('génération du pseudo invité', () => {
  it('respecte le format invite_ + 6 caractères et la contrainte SQL', () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const pseudo = generateGuestPseudo()
      expect(pseudo).toMatch(/^invite_[a-z0-9]{6}$/)
      expect(pseudo).toMatch(GUEST_PSEUDO_PATTERN)
      expect(pseudo.length).toBe(13)
      expect(isGuestPseudo(pseudo)).toBe(true)
    }
  })

  it('est déterministe quand la source aléatoire est injectée', () => {
    expect(generateGuestPseudo(() => 0)).toBe('invite_aaaaaa')
    expect(generateGuestPseudo(() => 0.999999)).toBe('invite_999999')
  })

  it('borne les valeurs aléatoires hors de [0, 1)', () => {
    expect(randomGuestSuffix(() => -1)).toBe('aaaaaa')
    expect(randomGuestSuffix(() => 2)).toBe('999999')
  })

  it('rejette les pseudos qui ne suivent pas le format invité', () => {
    expect(isGuestPseudo('invite_abc')).toBe(false)
    expect(isGuestPseudo('invite_ABC123')).toBe(false)
    expect(isGuestPseudo('amadou')).toBe(false)
    expect(isGuestPseudo('invite_abc1234')).toBe(false)
  })
})

describe('détection du compte anonyme', () => {
  it('reconnaît un utilisateur anonyme', () => {
    expect(isGuestUser({ is_anonymous: true })).toBe(true)
    expect(isGuestUser({ is_anonymous: false })).toBe(false)
    expect(isGuestUser({})).toBe(false)
    expect(isGuestUser(null)).toBe(false)
    expect(isGuestUser(undefined)).toBe(false)
  })
})

describe('affichage de la bannière invité', () => {
  it('s’affiche pour un invité qui ne l’a pas fermée', () => {
    expect(shouldShowGuestBanner({ isAnonymous: true, dismissed: false })).toBe(
      true,
    )
  })

  it('reste cachée après fermeture', () => {
    expect(shouldShowGuestBanner({ isAnonymous: true, dismissed: true })).toBe(
      false,
    )
  })

  it('ne s’affiche jamais pour un compte normal', () => {
    expect(
      shouldShowGuestBanner({ isAnonymous: false, dismissed: false }),
    ).toBe(false)
    expect(shouldShowGuestBanner({ isAnonymous: false, dismissed: true })).toBe(
      false,
    )
  })
})
