import { describe, expect, it } from 'vitest'
import { greetingNameFor } from './format'

describe('greetingNameFor', () => {
  it('garde le premier mot en casse titre de 14 caractères ou moins', () => {
    expect(greetingNameFor('Cédric Ngassaki', 'cedric_237', 'fr')).toBe('Cédric')
    expect(greetingNameFor('Jean-Luc Mbeki', 'jl', 'fr')).toBe('Jean-Luc')
    expect(greetingNameFor("O'Brien Nguema", 'ob', 'fr')).toBe("O'Brien")
    expect(greetingNameFor('Awa', 'awa_dev', 'fr')).toBe('Awa')
  })

  it('revient au pseudo si le premier mot est trop long', () => {
    expect(
      greetingNameFor('Maximiliennoise Kouassi', 'maxi_k', 'fr'),
    ).toBe('maxi_k')
    expect(
      greetingNameFor('Abcdefghijklmno Nom', 'pseudo_15', 'fr'),
    ).toBe('pseudo_15')
  })

  it('revient au pseudo si le nom n’est pas en casse titre', () => {
    expect(greetingNameFor('NGASSAKI Cedric', 'ngassaki', 'fr')).toBe('ngassaki')
    expect(greetingNameFor('cedric ngassaki', 'cedric', 'fr')).toBe('cedric')
    expect(greetingNameFor('', 'invite_abc123', 'fr')).toBe('invite_abc123')
  })

  it('a un libellé de secours quand le profil est vide', () => {
    expect(greetingNameFor(null, null, 'fr')).toBe('développeur')
    expect(greetingNameFor('', '', 'en')).toBe('developer')
  })
})
