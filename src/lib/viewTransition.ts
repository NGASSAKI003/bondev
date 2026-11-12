import { startTransition } from 'react'
import { flushSync } from 'react-dom'
import { motionEnabled, type NavigationDirection } from './motion'

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>
  }
}

let transitionRunning = false

function cleanup(): void {
  const root = document.documentElement
  delete root.dataset.navDir
  delete root.dataset.navFallback
  delete root.dataset.navMotion
}

/**
 * Met à jour l'écran dans une View Transition quand elle existe, avec un
 * repli de 200 ms en fondu + glissement. `flushSync` est indispensable : la
 * navigation et l'indicateur actif doivent être peints dans la même image,
 * sinon l'ancien onglet apparaîtrait face au nouvel écran.
 */
export function navigateWithMotion(
  update: () => void,
  direction: NavigationDirection,
): void {
  if (typeof document === 'undefined') {
    update()
    return
  }

  const root = document.documentElement
  const reduced = !motionEnabled() || direction === 'none'
  if (reduced) {
    // Sans View Transition ni animation, rien n'oblige à bloquer l'événement :
    // une transition React peut découper le rendu des longues listes.
    startTransition(update)
    return
  }

  root.dataset.navDir = direction
  // L'indicateur de navigation doit se poser immédiatement sur le nouvel
  // onglet : il ne doit jamais glisser vers un contenu déjà changé.
  root.dataset.navMotion = 'instant'

  const doc = document as TransitionDocument
  if (!transitionRunning && typeof doc.startViewTransition === 'function') {
    transitionRunning = true
    try {
      const transition = doc.startViewTransition(() => {
        flushSync(update)
      })
      void transition.finished.finally(() => {
        transitionRunning = false
        cleanup()
      })
      return
    } catch {
      transitionRunning = false
      // Une transition déjà en cours : on retombe sur le fondu local.
    }
  }

  flushSync(update)

  const content = document.querySelector<HTMLElement>('.content')
  if (content) {
    // Force le navigateur à réarmer l'animation avant de la relancer.
    void content.offsetWidth
    root.dataset.navFallback = direction
  }
  window.setTimeout(cleanup, 240)
}

/**
 * Fondu croisé local (onglets de l'Entraide). La View Transition est utilisée
 * si elle est disponible ; sinon la classe `motion-crossfade` prend le relais.
 */
export function crossfadeWithMotion(update: () => void): void {
  if (typeof document === 'undefined') {
    update()
    return
  }
  const root = document.documentElement
  if (!motionEnabled()) {
    flushSync(update)
    return
  }
  const doc = document as TransitionDocument
  if (!transitionRunning && typeof doc.startViewTransition === 'function') {
    transitionRunning = true
    try {
      const transition = doc.startViewTransition(() => {
        flushSync(update)
      })
      void transition.finished.finally(() => {
        transitionRunning = false
      })
      return
    } catch {
      transitionRunning = false
    }
  }
  flushSync(update)
  root.dataset.tabFallback = 'on'
  window.setTimeout(() => {
    delete root.dataset.tabFallback
  }, 220)
}
