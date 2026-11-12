import { useEffect, useState, type ClipboardEvent, type FormEvent } from 'react'
import { useLang } from '../i18n'
import { publishProject, toFrenchError, type PublishedProject } from '../lib/api'
import { useAuth } from '../lib/auth'
import { notifyProgressChanged } from '../lib/events'
import { formatRelativeDate } from '../lib/format'
import {
  fetchGithubRepo,
  githubErrorMessage,
  parseGithubRepoUrl,
  type GithubRepoPreview,
} from '../lib/github'
import { GUEST_SHARE_EXPLANATION } from '../lib/guest'
import { GuestRestriction } from '../components/GuestRestriction'
import { Header, Icon, Primary } from '../components/ui'
import type { Screen } from './types'

const SHARE_DRAFT_PREFIX = 'bondev-share-draft-v1'

type ShareDraft = {
  repoUrl: string
  title: string
  description: string
  technologies: string
  license: string
  tags: string
}

const EMPTY_SHARE_DRAFT: ShareDraft = {
  repoUrl: '',
  title: '',
  description: '',
  technologies: '',
  license: '',
  tags: '',
}

function readShareDraft(key: string): ShareDraft {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return EMPTY_SHARE_DRAFT
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return EMPTY_SHARE_DRAFT
    const value = parsed as Record<string, unknown>
    return {
      repoUrl: typeof value.repoUrl === 'string' ? value.repoUrl : '',
      title: typeof value.title === 'string' ? value.title : '',
      description:
        typeof value.description === 'string' ? value.description : '',
      technologies:
        typeof value.technologies === 'string' ? value.technologies : '',
      license: typeof value.license === 'string' ? value.license : '',
      tags: typeof value.tags === 'string' ? value.tags : '',
    }
  } catch {
    return EMPTY_SHARE_DRAFT
  }
}

function shareDraftHasContent(draft: ShareDraft): boolean {
  return Object.values(draft).some((value) => value.trim().length > 0)
}

function writeShareDraft(key: string, draft: ShareDraft): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    /* Le brouillon reste un confort : publier ne doit jamais en dépendre. */
  }
}

function clearShareDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* Rien à faire. */
  }
}

export function ShareProject({
  go,
  onPublished,
  back,
}: {
  go: (screen: Screen) => void
  onPublished: () => void
  back: () => void
}) {
  const lang = useLang()
  const { refreshStats, isGuest, user } = useAuth()
  const draftKey = `${SHARE_DRAFT_PREFIX}:${user?.id ?? 'anon'}`
  const [restoredDraft] = useState<ShareDraft>(() => readShareDraft(draftKey))
  const [draftRestored, setDraftRestored] = useState(() =>
    shareDraftHasContent(restoredDraft),
  )
  const [repoUrl, setRepoUrl] = useState(restoredDraft.repoUrl)
  const [title, setTitle] = useState(restoredDraft.title)
  const [description, setDescription] = useState(restoredDraft.description)
  const [technologies, setTechnologies] = useState(restoredDraft.technologies)
  const [license, setLicense] = useState(restoredDraft.license)
  const [tags, setTags] = useState(restoredDraft.tags)
  const [preview, setPreview] = useState<GithubRepoPreview | null>(null)
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [published, setPublished] = useState<PublishedProject | null>(null)

  useEffect(() => {
    const draft: ShareDraft = {
      repoUrl,
      title,
      description,
      technologies,
      license,
      tags,
    }
    if (!shareDraftHasContent(draft)) {
      clearShareDraft(draftKey)
      setDraftRestored(false)
      return
    }
    writeShareDraft(draftKey, draft)
  }, [draftKey, repoUrl, title, description, technologies, license, tags])

  if (isGuest) {
    return (
      <GuestRestriction
        title="Partager un projet"
        explanation={GUEST_SHARE_EXPLANATION}
        back={back}
      />
    )
  }

  const loadRepo = async (value: string) => {
    const ref = parseGithubRepoUrl(value)
    if (!ref) {
      setFetchError(
        'Lien GitHub invalide. Utilise le format https://github.com/pseudo/depot.',
      )
      setPreview(null)
      setFetchedUrl(null)
      return
    }

    setRepoUrl(ref.canonicalUrl)
    setFetching(true)
    setFetchError(null)
    try {
      const info = await fetchGithubRepo(ref.canonicalUrl)
      setPreview(info)
      setFetchedUrl(ref.canonicalUrl)
      setTitle(info.title)
      setDescription(info.description)
      setTechnologies(info.technologies.join(', '))
      setLicense(info.license)
      setTags(info.tags.join(', '))
    } catch (cause) {
      setPreview(null)
      setFetchedUrl(null)
      setFetchError(githubErrorMessage(cause))
    } finally {
      setFetching(false)
    }
  }

  const handleRepoChange = (value: string) => {
    setRepoUrl(value)
    setFetchError(null)
    if (fetchedUrl && value.trim() !== fetchedUrl) {
      setFetchedUrl(null)
      setPreview(null)
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').trim()
    const ref = parseGithubRepoUrl(pasted)
    if (!ref) return
    event.preventDefault()
    setRepoUrl(ref.canonicalUrl)
    void loadRepo(ref.canonicalUrl)
  }

  const handleBlur = () => {
    if (!repoUrl.trim() || fetchedUrl || fetching) return
    void loadRepo(repoUrl)
  }

  const splitList = (value: string): string[] =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPublishError(null)

    const ref = parseGithubRepoUrl(repoUrl)
    if (!ref) {
      setPublishError(
        'Lien GitHub invalide. Utilise le format https://github.com/pseudo/depot.',
      )
      return
    }

    setPublishing(true)
    try {
      const result = await publishProject({
        title,
        description,
        repoUrl: ref.canonicalUrl,
        license,
        technologies: splitList(technologies),
        tags: splitList(tags),
      })
      setPublished(result)
      clearShareDraft(draftKey)
      setDraftRestored(false)
      await refreshStats().catch(() => undefined)
      notifyProgressChanged()
      onPublished()
    } catch (cause) {
      setPublishError(toFrenchError(cause))
    } finally {
      setPublishing(false)
    }
  }

  if (published) {
    return (
      <main className="screen centered">
        <div className="success">
          <Icon name="check" size={38} />
        </div>
        <h1>{lang === 'en' ? 'Project published!' : 'Projet publié !'}</h1>
        <p>
          {published.pointsEarned > 0
            ? lang === 'en'
              ? `Your project is now in the catalogue. You earned +${published.pointsEarned} points.`
              : `Ton projet est maintenant dans le catalogue. Tu gagnes +${published.pointsEarned} points.`
            : lang === 'en'
              ? 'Your project is now in the catalogue. You have already received the points for your first five publications.'
              : 'Ton projet est maintenant dans le catalogue. Tu as déjà reçu les points de tes 5 premières publications.'}
        </p>
        <Primary onClick={() => go('results')}>
          {lang === 'en' ? 'See the catalogue' : 'Voir le catalogue'}
        </Primary>
        <button className="textbtn" onClick={() => go('home')} type="button">
          {lang === 'en' ? 'Back home' : 'Retour à l’accueil'}
        </button>
      </main>
    )
  }

  return (
    <main className="screen">
      <Header
        title={lang === 'en' ? 'Share a project' : 'Partager un projet'}
        back={back}
      />
      <form className="form share-form" onSubmit={handlePublish}>
        <p className="eyebrow">
          {lang === 'en' ? 'A public repository is enough' : 'Un dépôt public suffit'}
        </p>
        <h2>{lang === 'en' ? 'Present your project' : 'Présente ton projet'}</h2>
        {draftRestored && (
          <p className="draft-note" role="status">
            {lang === 'en'
              ? 'Your draft from the last visit was restored.'
              : 'Ton brouillon de la dernière visite a été restauré.'}{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                clearShareDraft(draftKey)
                setRepoUrl('')
                setTitle('')
                setDescription('')
                setTechnologies('')
                setLicense('')
                setTags('')
                setDraftRestored(false)
                setPublishError(null)
                setFetchError(null)
                setPreview(null)
                setFetchedUrl(null)
              }}
            >
              {lang === 'en' ? 'Start over' : 'Repartir de zéro'}
            </button>
          </p>
        )}

        <label>
          <span>{lang === 'en' ? 'GitHub link' : 'Lien GitHub'}</span>
          <div className="repo-row">
            <input
              className="text-input"
              type="url"
              value={repoUrl}
              onChange={(event) => handleRepoChange(event.target.value)}
              onPaste={handlePaste}
              onBlur={handleBlur}
              placeholder="https://github.com/ton-pseudo/ton-projet"
              autoComplete="url"
              inputMode="url"
              enterKeyHint="next"
              spellCheck={false}
            />
            <button
              className="secondary"
              type="button"
              onClick={() => void loadRepo(repoUrl)}
              disabled={fetching || !repoUrl.trim()}
              aria-busy={fetching || undefined}
            >
              <Icon name="github" size={18} />{' '}
              {fetching
                ? lang === 'en'
                  ? 'Loading…'
                  : 'Récupération…'
                : lang === 'en'
                  ? 'Fill from GitHub'
                  : 'Remplir depuis GitHub'}
            </button>
          </div>
          {fetchError && (
            <small className="inline-error repo-error" role="status">
              {fetchError}
            </small>
          )}
          {preview?.lastActivity && (
            <small className="github-note">
              {lang === 'en' ? 'GitHub last activity:' : 'Dernière activité sur GitHub :'}{' '}
              {formatRelativeDate(preview.lastActivity, lang)}
            </small>
          )}
        </label>

        <label>
          <span>{lang === 'en' ? 'Project title' : 'Titre du projet'}</span>
          <input
            className="text-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex. Gestion de stock pour petites boutiques"
            maxLength={200}
            autoComplete="off"
            enterKeyHint="next"
            spellCheck
          />
          <small className="field-help">
            <span className="char-count">{title.length} / 200</span>
          </small>
        </label>

        <label>
          <span>{lang === 'en' ? 'Description' : 'Description'}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={
              lang === 'en'
                ? 'Explain what the project does and who it helps.'
                : 'Explique ce que fait le projet et à qui il sert.'
            }
            maxLength={5000}
            spellCheck
            autoCapitalize="sentences"
          />
          <small className="field-help">
            <span className="char-count">{description.length} / 5 000</span>
          </small>
        </label>

        <label>
          <span>
            {lang === 'en'
              ? 'Technologies (comma-separated)'
              : 'Technologies (séparées par des virgules)'}
          </span>
          <input
            className="text-input"
            value={technologies}
            onChange={(event) => setTechnologies(event.target.value)}
            placeholder="React, Node.js, PostgreSQL"
            autoComplete="off"
            enterKeyHint="next"
            spellCheck={false}
          />
        </label>

        <label>
          <span>{lang === 'en' ? 'Licence' : 'Licence'}</span>
          <input
            className="text-input"
            value={license}
            onChange={(event) => setLicense(event.target.value)}
            placeholder="MIT, Apache-2.0, GPL-3.0…"
            maxLength={40}
            autoComplete="off"
            enterKeyHint="next"
            spellCheck={false}
          />
        </label>

        <label>
          <span>
            {lang === 'en'
              ? 'Tags (comma-separated)'
              : 'Tags (séparés par des virgules)'}
          </span>
          <input
            className="text-input"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Mobile Money, hors-ligne, SMS"
            autoComplete="off"
            enterKeyHint="done"
            spellCheck={false}
          />
        </label>

        <p className="form-note">
          {lang === 'en'
            ? 'The fields filled from GitHub stay editable.'
            : 'Les champs remplis depuis GitHub restent modifiables.'}
        </p>

        {publishError && (
          <p className="inline-error form-error" role="alert">
            {publishError}
          </p>
        )}

        <Primary type="submit" disabled={publishing} loading={publishing}>
          {publishing
            ? lang === 'en'
              ? 'Publishing…'
              : 'Publication…'
            : lang === 'en'
              ? 'Publish project'
              : 'Publier le projet'}
        </Primary>
      </form>
    </main>
  )
}
