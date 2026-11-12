import { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n'
import { shareLink } from '../lib/share'
import { Icon } from './ui'

/**
 * Bouton de partage réutilisable. Le retour est annoncé dans un toast local :
 * aucune feuille, aucun écran et donc aucune entrée d'historique en plus.
 */
export function ShareButton({
  url,
  title,
  text,
  className = 'secondary',
}: {
  url: string
  title: string
  text?: string
  className?: string
}) {
  const lang = useLang()
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<number>(0)

  useEffect(() => {
    return () => window.clearTimeout(timer.current)
  }, [])

  const handleShare = async () => {
    if (busy) return
    setBusy(true)
    try {
      const outcome = await shareLink({ title, text, url })
      if (outcome === 'cancelled') return
      setNotice(
        outcome === 'shared'
          ? lang === 'en'
            ? 'Link shared'
            : 'Lien partagé'
          : outcome === 'copied'
            ? lang === 'en'
              ? 'Link copied'
              : 'Lien copié'
            : lang === 'en'
              ? 'Could not copy the link'
              : 'Impossible de copier le lien',
      )
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setNotice(null), 2800)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={() => void handleShare()}
        aria-busy={busy || undefined}
      >
        <Icon name="share" size={18} />{' '}
        {lang === 'en' ? 'Share' : 'Partager'}
      </button>
      {notice && (
        <div className="share-toast glass" role="status" aria-live="polite">
          <Icon name="check" size={17} />
          {notice}
        </div>
      )}
    </>
  )
}
