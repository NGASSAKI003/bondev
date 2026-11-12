/**
 * Décision du mode d'effets visuels.
 *
 * Le module est volontairement pur pour être testable sous Node : les
 * fonctions de décision ne lisent ni `window` ni `navigator`. Les quelques
 * aides en bas de fichier sont les seules à toucher au navigateur, et restent
 * sans effet si elles sont appelées hors d'un document.
 */

export type EffectsPreference = 'auto' | 'full' | 'light'
export type EffectsMode = 'full' | 'light'

export const EFFECTS_STORAGE_KEY = 'bondev-effects'

/** Au-delà de cette durée médiane, l'appareil est considéré comme lent. */
export const SLOW_FRAME_MS = 24

/** Durée de la sonde de démarrage, en millisecondes. */
export const FRAME_PROBE_MS = 2000

export type EffectsEnvironment = {
  preference: EffectsPreference
  saveData: boolean
  deviceMemory: number | null | undefined
  hardwareConcurrency: number | null | undefined
  /** Médiane mesurée par la sonde, ou null si elle n'a pas encore tourné. */
  medianFrameMs: number | null | undefined
}

export type FrameSummary = {
  count: number
  median: number | null
  p95: number | null
  over50: number
}

/** Normalise une valeur de stockage inconnue vers une préférence valide. */
export function normaliseEffectsPreference(
  value: unknown,
): EffectsPreference {
  return value === 'full' || value === 'light' ? value : 'auto'
}

/** Lit la préférence mémorisée, sans jamais lever si le stockage est bloqué. */
export function readEffectsPreference(storage?: Pick<Storage, 'getItem'> | null): EffectsPreference {
  if (!storage) return 'auto'
  try {
    return normaliseEffectsPreference(storage.getItem(EFFECTS_STORAGE_KEY))
  } catch {
    return 'auto'
  }
}

/** Écrit la préférence ; le mode reste actif pour la session si l'écriture échoue. */
export function writeEffectsPreference(
  preference: EffectsPreference,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  if (!storage) return
  try {
    storage.setItem(EFFECTS_STORAGE_KEY, preference)
  } catch {
    /* Stockage privé ou saturé : la préférence reste celle de la session. */
  }
}

/**
 * Règle unique du mode d'effets.
 *
 * 1. Un choix manuel gagne toujours.
 * 2. En Auto : Économie de données, mémoire ≤ 4 Go, CPU ≤ 4 cœurs ou sonde
 *    lente (> 24 ms de frame médiane) passent en mode léger.
 */
export function decideEffects(environment: EffectsEnvironment): EffectsMode {
  if (environment.preference === 'light') return 'light'
  if (environment.preference === 'full') return 'full'
  if (environment.saveData) return 'light'
  if (
    typeof environment.deviceMemory === 'number' &&
    Number.isFinite(environment.deviceMemory) &&
    environment.deviceMemory <= 4
  ) {
    return 'light'
  }
  if (
    typeof environment.hardwareConcurrency === 'number' &&
    Number.isFinite(environment.hardwareConcurrency) &&
    environment.hardwareConcurrency <= 4
  ) {
    return 'light'
  }
  if (
    typeof environment.medianFrameMs === 'number' &&
    Number.isFinite(environment.medianFrameMs) &&
    environment.medianFrameMs > SLOW_FRAME_MS
  ) {
    return 'light'
  }
  return 'full'
}

/** Médiane d'une série, sans muter le tableau reçu. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

/** Centile par interpolation linéaire, utilisé par le diagnostic. */
export function percentile(values: readonly number[], ratio: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const position = Math.min(1, Math.max(0, ratio)) * (sorted.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

/** Résumé des durées de frame : médiane, p95 et frames au-delà de 50 ms. */
export function summariseFrames(durations: readonly number[]): FrameSummary {
  const clean = durations.filter(
    (value) => Number.isFinite(value) && value >= 0,
  )
  return {
    count: clean.length,
    median: median(clean),
    p95: percentile(clean, 0.95),
    over50: clean.filter((value) => value > 50).length,
  }
}

/** Environnement matériel, isolé pour être remplacé dans les tests. */
export type RuntimeNavigator = {
  connection?: { saveData?: boolean }
  deviceMemory?: number
  hardwareConcurrency?: number
}

export function environmentFrom(
  navigatorLike: RuntimeNavigator | null | undefined,
): Pick<EffectsEnvironment, 'saveData' | 'deviceMemory' | 'hardwareConcurrency'> {
  return {
    saveData: navigatorLike?.connection?.saveData === true,
    deviceMemory: navigatorLike?.deviceMemory,
    hardwareConcurrency: navigatorLike?.hardwareConcurrency,
  }
}

let measuredMedianFrameMs: number | null = null

/** Mémorise la sonde de démarrage pour les recalculs de préférence. */
export function rememberFrameMedian(value: number | null): void {
  measuredMedianFrameMs = value
}

export function rememberedFrameMedian(): number | null {
  return measuredMedianFrameMs
}

/**
 * Recalcule et applique le mode au document. Renvoie le mode retenu.
 * Sans `document` (tests Node), la fonction ne fait que calculer.
 */
export function applyEffects(
  preference: EffectsPreference,
  navigatorLike: RuntimeNavigator | null | undefined = typeof navigator === 'undefined'
    ? null
    : navigator,
): EffectsMode {
  const mode = decideEffects({
    preference,
    ...environmentFrom(navigatorLike),
    medianFrameMs: measuredMedianFrameMs,
  })
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.effects = mode
  }
  return mode
}

/**
 * Mesure la durée médiane des frames pendant `durationMs`.
 *
 * La sonde ne tourne que dans un onglet visible, s'arrête proprement si
 * l'onglet passe en arrière-plan et ignore les deux premières frames (mise en
 * route du compositeur). Elle ne lit ni ne modifie la mise en page.
 */
export function probeFrameMedian(
  durationMs: number = FRAME_PROBE_MS,
): Promise<number | null> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    document.visibilityState !== 'visible'
  ) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const durations: number[] = []
    let previous: number | null = null
    let skipped = 0
    let frame = 0
    let stopped = false
    const startedAt = performance.now()

    const finish = (value: number | null) => {
      if (stopped) return
      stopped = true
      window.cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
      rememberFrameMedian(value)
      resolve(value)
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') finish(null)
    }

    const tick = (now: number) => {
      if (document.visibilityState !== 'visible') {
        finish(null)
        return
      }
      if (previous !== null) {
        if (skipped < 2) skipped += 1
        else durations.push(now - previous)
      }
      previous = now
      if (now - startedAt >= durationMs) {
        finish(median(durations))
        return
      }
      frame = window.requestAnimationFrame(tick)
    }

    document.addEventListener('visibilitychange', onVisibility)
    frame = window.requestAnimationFrame(tick)
  })
}
