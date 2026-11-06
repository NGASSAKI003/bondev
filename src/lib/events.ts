export type ProgressEventDetail = { celebration?: 'validated' }

export const PROGRESS_EVENT = 'bondev:progress-changed'

/** Prévient l'application qu'une action vient de changer la progression. */
export function notifyProgressChanged(detail?: ProgressEventDetail): void {
  window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail }))
}
