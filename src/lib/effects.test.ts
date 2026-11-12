import { describe, expect, it } from 'vitest'
import {
  decideEffects,
  median,
  normaliseEffectsPreference,
  percentile,
  summariseFrames,
  type EffectsEnvironment,
} from './effects'

function environment(
  overrides: Partial<EffectsEnvironment> = {},
): EffectsEnvironment {
  return {
    preference: 'auto',
    saveData: false,
    deviceMemory: 8,
    hardwareConcurrency: 8,
    medianFrameMs: 16,
    ...overrides,
  }
}

describe('decideEffects — signaux automatiques', () => {
  it('reste en mode complet sur un appareil confortable', () => {
    expect(decideEffects(environment())).toBe('full')
  })

  it('passe en mode léger quand saveData est vrai', () => {
    expect(decideEffects(environment({ saveData: true }))).toBe('light')
  })

  it('passe en mode léger quand deviceMemory vaut 4 Go ou moins', () => {
    expect(decideEffects(environment({ deviceMemory: 4 }))).toBe('light')
    expect(decideEffects(environment({ deviceMemory: 3 }))).toBe('light')
    expect(decideEffects(environment({ deviceMemory: 6 }))).toBe('full')
  })

  it('passe en mode léger quand le CPU a 4 cœurs ou moins', () => {
    expect(decideEffects(environment({ hardwareConcurrency: 4 }))).toBe('light')
    expect(decideEffects(environment({ hardwareConcurrency: 2 }))).toBe('light')
    expect(decideEffects(environment({ hardwareConcurrency: 8 }))).toBe('full')
  })

  it('passe en mode léger quand la sonde dépasse 24 ms de médiane', () => {
    expect(decideEffects(environment({ medianFrameMs: 24.1 }))).toBe('light')
    expect(decideEffects(environment({ medianFrameMs: 24 }))).toBe('full')
    expect(decideEffects(environment({ medianFrameMs: null }))).toBe('full')
  })

  it('ignore les signaux matériels absents ou invalides', () => {
    expect(
      decideEffects(
        environment({
          deviceMemory: undefined,
          hardwareConcurrency: undefined,
          medianFrameMs: null,
        }),
      ),
    ).toBe('full')
    expect(
      decideEffects(environment({ deviceMemory: Number.NaN })),
    ).toBe('full')
  })
})

describe('decideEffects — préférence manuelle', () => {
  it('force le mode léger même sur un appareil puissant', () => {
    expect(decideEffects(environment({ preference: 'light' }))).toBe('light')
  })

  it('force le mode complet malgré saveData et une sonde lente', () => {
    expect(
      decideEffects(
        environment({
          preference: 'full',
          saveData: true,
          deviceMemory: 2,
          hardwareConcurrency: 2,
          medianFrameMs: 60,
        }),
      ),
    ).toBe('full')
  })

  it('reste en automatique quand la préférence est auto', () => {
    expect(
      decideEffects(environment({ preference: 'auto', saveData: true })),
    ).toBe('light')
  })
})

describe('normaliseEffectsPreference', () => {
  it('accepte uniquement les trois valeurs connues', () => {
    expect(normaliseEffectsPreference('auto')).toBe('auto')
    expect(normaliseEffectsPreference('full')).toBe('full')
    expect(normaliseEffectsPreference('light')).toBe('light')
    expect(normaliseEffectsPreference('LIGHT')).toBe('auto')
    expect(normaliseEffectsPreference(null)).toBe('auto')
  })
})

describe('statistiques de frames', () => {
  it('calcule une médiane impaire et paire', () => {
    expect(median([16, 20, 8])).toBe(16)
    expect(median([8, 16, 20, 30])).toBe(18)
    expect(median([])).toBeNull()
  })

  it('calcule le p95 et compte les frames lentes', () => {
    const frames = Array.from({ length: 100 }, (_, index) => index + 1)
    expect(percentile(frames, 0.95)).toBeCloseTo(95.05, 2)
    const summary = summariseFrames([10, 12, 40, 60, 80])
    expect(summary.median).toBe(40)
    expect(summary.over50).toBe(2)
    expect(summary.count).toBe(5)
  })

  it('ignore les valeurs invalides', () => {
    const summary = summariseFrames([Number.NaN, -4, 16, 20])
    expect(summary.count).toBe(2)
    expect(summary.median).toBe(18)
  })
})
