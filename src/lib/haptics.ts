export const HAPTICS_KEY = 'bondev-haptics'

let lastVibration = 0

/** Le retour haptique est actif par défaut, sauf choix explicite. */
export function readHapticsEnabled(): boolean {
  try {
    return localStorage.getItem(HAPTICS_KEY) !== 'off'
  } catch {
    return true
  }
}

export function writeHapticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTICS_KEY, enabled ? 'on' : 'off')
  } catch {
    // Le choix reste actif pour la session même si le stockage est bloqué.
  }
}

/**
 * L'Économie de données coupe l'haptique, comme les animations et le flou.
 * `prefers-reduced-motion` ne concerne que le mouvement visuel : le choix
 * haptique reste donc indépendant.
 */
export function hapticsAllowed(): boolean {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return false
  }
  if (document.documentElement.dataset.saver === 'on') return false
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection
  if (connection?.saveData === true) return false
  return readHapticsEnabled()
}

/**
 * Vibration très courte (10 ms par défaut). Un délai minimal évite de cumuler
 * plusieurs impulsions quand plusieurs célébrations arrivent ensemble.
 */
export function vibrate(duration = 10): boolean {
  if (!hapticsAllowed()) return false
  if (typeof navigator.vibrate !== 'function') return false
  const now = Date.now()
  if (now - lastVibration < 120) return false
  lastVibration = now
  try {
    return navigator.vibrate(duration)
  } catch {
    return false
  }
}
