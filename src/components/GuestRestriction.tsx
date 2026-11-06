import { GUEST_UPGRADE_LABEL } from '../lib/guest'
import { Header, Icon } from './ui'
import { useGuestUpgrade } from './GuestBanner'

type GuestRestrictionProps = {
  title: string
  explanation: string
  back: () => void
}

/**
 * Écran calme affiché à un invité quand une action est réservée aux comptes
 * GitHub. Le bouton de conversion est proposé directement sur place.
 */
export function GuestRestriction({
  title,
  explanation,
  back,
}: GuestRestrictionProps) {
  const { upgrade, busy, error } = useGuestUpgrade()
  return (
    <main className="screen">
      <Header title={title} back={back} />
      <section className="glass guest-restriction">
        <span className="guest-restriction-icon" aria-hidden="true">
          <Icon name="lock" size={28} />
        </span>
        <h2>{title}</h2>
        <p>{explanation}</p>
        <button
          className="primary"
          type="button"
          onClick={() => void upgrade()}
          disabled={busy}
        >
          <Icon name="github" />
          {GUEST_UPGRADE_LABEL}
        </button>
        <button className="textbtn" type="button" onClick={back}>
          Retour
        </button>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
