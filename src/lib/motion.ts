import type { Screen } from '../screens/types'

/**
 * Règles de mouvement partagées entre l'interface et les tests.
 *
 * Le module reste volontairement sans état : les fonctions pures décrivent la
 * courbe du compteur, le plafond de la cascade et le sens de navigation. Les
 * deux lectures d'environnement en bas de fichier servent uniquement à couper
 * le mouvement quand le navigateur ou l'utilisateur le demandent.
 */

export type NavigationDirection = 'forward' | 'back' | 'none'

export const MOTION = {
  /** Durée du compteur de points, en millisecondes. */
  counter: 600,
  /** Écart entre deux éléments d'une liste. */
  staggerStep: 40,
  /** Nombre maximal d'éléments réellement décalés. */
  staggerLimit: 10,
  /** Repli sans View Transition. */
  fallback: 200,
  /** Durée d'une transition d'écran avec View Transition. */
  screen: 240,
  /** Durée de la coche « Utile ». */
  check: 380,
} as const

/**
 * Profondeur visuelle de chaque écran. Une cible moins profonde que l'écran
 * courant est un retour ; une cible plus profonde ou de même niveau avance.
 */
export const SCREEN_DEPTH: Record<Screen, number> = {
  login: 0,
  home: 0,
  results: 1,
  share: 1,
  help: 1,
  profile: 1,
  add: 2,
  question: 2,
  project: 2,
  how: 2,
  states: 2,
  notFound: 0,
}

/** Courbe ease-out cubique : rapide au début, lente en fin de course. */
export function easeOutCounter(progress: number): number {
  const t = Math.min(1, Math.max(0, progress))
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Valeur intermédiaire d'un compteur. `elapsed` et `duration` sont exprimés
 * dans la même unité (millisecondes en pratique). La valeur finale est
 * toujours renvoyée exactement, sans dérive de flottant.
 */
export function counterValue(
  from: number,
  to: number,
  elapsed: number,
  duration: number = MOTION.counter,
): number {
  if (!Number.isFinite(from)) from = 0
  if (!Number.isFinite(to)) to = 0
  if (!Number.isFinite(elapsed) || elapsed <= 0) return from
  if (duration <= 0 || elapsed >= duration) return to
  return from + (to - from) * easeOutCounter(elapsed / duration)
}

/**
 * Délai de cascade d'un élément. Les dix premiers éléments sont décalés de
 * 40 ms ; au-delà, le délai reste plafonné pour ne jamais retarder la lecture.
 */
export function staggerDelay(
  index: number,
  step: number = MOTION.staggerStep,
  limit: number = MOTION.staggerLimit,
): number {
  if (!Number.isFinite(index) || index <= 0 || step <= 0 || limit <= 0) return 0
  return Math.min(Math.floor(index), limit - 1) * step
}

/**
 * Sens de la transition entre deux écrans. Les écrans de détail (projet,
 * question, ajout) sont plus profonds que leurs listes : leur retour joue donc
 * dans le sens inverse de l'aller.
 */
export function navigationDirection(
  from: Screen,
  to: Screen,
): NavigationDirection {
  if (from === to) return 'none'
  const fromDepth = SCREEN_DEPTH[from] ?? 0
  const toDepth = SCREEN_DEPTH[to] ?? 0
  return toDepth < fromDepth ? 'back' : 'forward'
}

/** Vrai si le navigateur demande moins de mouvement. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Vrai si le mode Économie de données coupe le mouvement. */
export function dataSaverEnabled(): boolean {
  if (typeof document === 'undefined') return false
  if (document.documentElement.dataset.saver === 'on') return true
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection
  return connection?.saveData === true
}

/**
 * Porte d'entrée unique du mouvement côté JavaScript : ni le mode Économie de
 * données ni `prefers-reduced-motion` ne doivent lancer une animation.
 */
export function motionEnabled(): boolean {
  return !prefersReducedMotion() && !dataSaverEnabled()
}
