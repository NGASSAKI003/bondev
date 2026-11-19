import { useSyncExternalStore } from 'react'
import { translate, useLang } from '../i18n'
import {
  applyServiceWorkerUpdate,
  serviceWorkerUpdateAvailable,
  subscribeToServiceWorker,
} from '../lib/serviceWorker'

/**
 * Bandeau discret affiché quand un nouveau service worker attend.
 * L'utilisateur choisit le moment du rechargement.
 */
export function UpdateBanner() {
  // S'abonne aux changements de langue : translate() relit le dictionnaire.
  useLang()
  const available = useSyncExternalStore(
    subscribeToServiceWorker,
    serviceWorkerUpdateAvailable,
    () => false,
  )

  if (!available) return null

  return (
    <aside className="update-banner" role="status">
      <span>{translate('Nouvelle version disponible')}</span>
      <button type="button" onClick={applyServiceWorkerUpdate}>
        {translate('Actualiser')}
      </button>
    </aside>
  )
}
