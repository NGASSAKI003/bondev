import { describe, expect, it } from 'vitest'
import {
  MOTION,
  counterValue,
  easeOutCounter,
  navigationDirection,
  staggerDelay,
} from './motion'

describe('compteur de points', () => {
  it('part de la valeur initiale, progresse et termine exactement', () => {
    expect(counterValue(12, 30, 0)).toBe(12)
    expect(counterValue(12, 30, MOTION.counter)).toBe(30)
    expect(counterValue(12, 30, MOTION.counter + 500)).toBe(30)
    expect(counterValue(12, 30, 0, 0)).toBe(12)
    expect(counterValue(12, 30, 1200, 0)).toBe(30)
  })

  it('ralentit en fin de course', () => {
    const duration = MOTION.counter
    const half = counterValue(0, 100, duration / 2)
    const firstTenth = counterValue(0, 100, duration / 10)
    const lastTenth = counterValue(0, 100, duration) - counterValue(
      0,
      100,
      duration * 0.9,
    )

    // À mi-parcours, plus de la moitié du chemin est déjà faite.
    expect(half).toBeGreaterThan(50)
    // Le dernier dixième parcourt moins de terrain que le premier.
    expect(lastTenth).toBeLessThan(firstTenth)
  })

  it('reste monotone, y compris en cas de dépense', () => {
    let previous = counterValue(30, 12, 0)
    for (let elapsed = 0; elapsed <= MOTION.counter; elapsed += 30) {
      const current = counterValue(30, 12, elapsed)
      expect(current).toBeLessThanOrEqual(previous)
      previous = current
    }
    expect(previous).toBe(12)
  })

  it('borne la courbe et gère les valeurs invalides', () => {
    expect(easeOutCounter(-1)).toBe(0)
    expect(easeOutCounter(2)).toBe(1)
    expect(counterValue(Number.NaN, Number.NaN, 10)).toBe(0)
  })
})

describe('cascade des listes', () => {
  it('décale de 40 ms et plafonne à dix éléments', () => {
    expect(staggerDelay(0)).toBe(0)
    expect(staggerDelay(1)).toBe(40)
    expect(staggerDelay(9)).toBe(360)
    expect(staggerDelay(10)).toBe(360)
    expect(staggerDelay(42)).toBe(360)
    expect(staggerDelay(-3)).toBe(0)
  })

  it('accepte des réglages explicites sans dépasser la limite', () => {
    expect(staggerDelay(4, 25, 6)).toBe(100)
    expect(staggerDelay(99, 25, 6)).toBe(125)
    expect(staggerDelay(2, 0, 6)).toBe(0)
    expect(staggerDelay(2, 40, 0)).toBe(0)
  })
})

describe('sens des transitions', () => {
  it('avance vers un écran plus profond', () => {
    expect(navigationDirection('home', 'results')).toBe('forward')
    expect(navigationDirection('results', 'project')).toBe('forward')
    expect(navigationDirection('help', 'question')).toBe('forward')
    expect(navigationDirection('profile', 'how')).toBe('forward')
    expect(navigationDirection('login', 'home')).toBe('forward')
  })

  it('recule vers une liste ou un écran parent', () => {
    expect(navigationDirection('project', 'results')).toBe('back')
    expect(navigationDirection('project', 'home')).toBe('back')
    expect(navigationDirection('question', 'help')).toBe('back')
    expect(navigationDirection('how', 'profile')).toBe('back')
    expect(navigationDirection('states', 'profile')).toBe('back')
  })

  it('ne joue rien vers le même écran', () => {
    expect(navigationDirection('home', 'home')).toBe('none')
    expect(navigationDirection('project', 'project')).toBe('none')
  })
})
