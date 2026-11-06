import { useEffect, useState } from 'react'
import { translate } from '../i18n'
import { useAuth } from '../lib/auth'
import {
  GUEST_BANNER_TEXT,
  GUEST_UPGRADE_CONFIRM,
  GUEST_UPGRADE_LABEL,
  readGuestBannerDismissed,
  shouldShowGuestBanner,
  writeGuestBannerDismissed,
} from '../lib/guest'
import { Icon } from './ui'

type GuestUpgradeState = {
  upgrade: () => Promise<void>
  busy: boolean
  error: string | null
}

/**
 * Convertit un invité en compte GitHub : confirmation, déconnexion puis OAuth.
 * Les données de l'invité sont perdues, comme annoncé dans la confirmation.
 */
export function useGuestUpgrade(): GuestUpgradeState {
  const { signInWithGitHub, signOut, setAuthNotice } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upgrade = async () => {
    if (!window.confirm(translate(GUEST_UPGRADE_CONFIRM))) return
    setBusy(true)
    setError(null)
    const out = await signOut()
    if (out.error) {
      setError(out.error)
      setBusy(false)
      return
    }
    const result = await signInWithGitHub()
    if (result.error) {
      // La bannière a disparu avec la déconnexion : l'écran de connexion
      // affiche ce message calme via le contexte d'authentification.
      setAuthNotice(result.error)
    }
    setBusy(false)
  }

  return { upgrade, busy, error }
}

/**
 * Bannière discrète affichée en haut de l'accueil et du profil pour un invité.
 */
export function GuestBanner() {
  const { user, isGuest } = useAuth()
  const { upgrade, busy, error } = useGuestUpgrade()
  const [dismissed, setDismissed] = useState(false)
  const userId = user?.id

  useEffect(() => {
    setDismissed(userId ? readGuestBannerDismissed(userId) : true)
  }, [userId])

  if (!shouldShowGuestBanner({ isAnonymous: isGuest, dismissed })) return null

  const dismiss = () => {
    if (userId) writeGuestBannerDismissed(userId)
    setDismissed(true)
  }

  return (
    <aside className="guest-banner glass" aria-label="Mode invité">
      <div>
        <p>{GUEST_BANNER_TEXT}</p>
        {error && (
          <small className="inline-error" role="alert">
            {error}
          </small>
        )}
      </div>
      <div className="guest-banner-actions">
        <button
          className="guest-banner-cta"
          type="button"
          onClick={() => void upgrade()}
          disabled={busy}
        >
          <Icon name="github" size={16} />
          {GUEST_UPGRADE_LABEL}
        </button>
        <button
          className="guest-banner-close"
          type="button"
          onClick={dismiss}
          aria-label="Fermer la bannière"
        >
          ×
        </button>
      </div>
    </aside>
  )
}
