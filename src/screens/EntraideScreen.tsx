import { memo, useEffect, useState, type FormEvent } from 'react'
import { useLang, type Lang } from '../i18n'
import {
  addAnswer,
  deleteAnswer,
  getQuestion,
  isFreeQuestionAvailable,
  listQuestions,
  listQuestionTechnologies,
  postQuestion,
  toFrenchError,
  updateAnswer,
  validateAnswer,
  withdrawQuestion,
  type Answer,
  type Question,
  type QuestionTab,
  type QuestionThread,
} from '../lib/api'
import {
  useAuthActions,
  useAuthSession,
  useAuthStats,
} from '../lib/auth'
import { notifyProgressChanged } from '../lib/events'
import {
  firstQuestionFormField,
  formatTimeLeft,
  isHelpTier,
  parseQuestionTechnologies,
  pointsLabel,
  QUESTION_BODY_MAX,
  QUESTION_BODY_MIN,
  QUESTION_TITLE_MAX,
  QUESTION_TITLE_MIN,
  statusLabel,
  tierLabel,
  validateQuestionForm,
  type HelpTier,
  type QuestionFormErrors,
  type QuestionFormField,
} from '../lib/help'
import { Header, Icon, Primary, StateArt, initialsFor, toneFor } from '../components/ui'
import { ShareButton } from '../components/ShareButton'
import { shareUrlFor } from '../lib/share'
import { crossfadeWithMotion } from '../lib/viewTransition'
import { vibrate } from '../lib/haptics'
import type { Screen } from './types'

const QUESTION_DRAFT_PREFIX = 'bondev-question-draft-v1'
const ANSWER_DRAFT_PREFIX = 'bondev-answer-draft-v1'

const QUESTION_FIELD_IDS: Record<QuestionFormField, string> = {
  title: 'question-title',
  body: 'question-body',
  technologies: 'question-technologies',
  tier: 'question-tier-1',
  githubUrl: 'question-github',
}

type QuestionDraft = {
  title: string
  body: string
  technologies: string
  tier: HelpTier
  githubUrl: string
  beginnerOk: boolean
}

type AnswerDraft = {
  body: string
  proofUrl: string
}

type ThreadAction = 'withdraw' | 'answer' | 'validate' | 'edit' | 'delete'

type ThreadActionError = {
  message: string
  action: ThreadAction
  answerId?: string
}

const EMPTY_QUESTION_DRAFT: QuestionDraft = {
  title: '',
  body: '',
  technologies: '',
  tier: 1,
  githubUrl: '',
  beginnerOk: false,
}

function questionDraftHasContent(draft: QuestionDraft): boolean {
  return Boolean(
    draft.title.trim() ||
      draft.body.trim() ||
      draft.technologies.trim() ||
      draft.githubUrl.trim() ||
      draft.beginnerOk ||
      draft.tier !== 1,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readQuestionDraft(key: string): QuestionDraft {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return EMPTY_QUESTION_DRAFT
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return EMPTY_QUESTION_DRAFT
    const tier = Number(parsed.tier)
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      body: typeof parsed.body === 'string' ? parsed.body : '',
      technologies:
        typeof parsed.technologies === 'string' ? parsed.technologies : '',
      tier: isHelpTier(tier) ? tier : 1,
      githubUrl: typeof parsed.githubUrl === 'string' ? parsed.githubUrl : '',
      beginnerOk: parsed.beginnerOk === true,
    }
  } catch {
    return EMPTY_QUESTION_DRAFT
  }
}

function readAnswerDraft(key: string): AnswerDraft {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { body: '', proofUrl: '' }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { body: '', proofUrl: '' }
    return {
      body: typeof parsed.body === 'string' ? parsed.body : '',
      proofUrl: typeof parsed.proofUrl === 'string' ? parsed.proofUrl : '',
    }
  } catch {
    return { body: '', proofUrl: '' }
  }
}

function writeDraft(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Le brouillon est un confort : le formulaire reste utilisable sans lui. */
  }
}

function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* Rien à faire si le stockage local est indisponible. */
  }
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  return online
}

function answerCountLabel(count: number, lang: Lang): string {
  if (lang === 'en') {
    return `${count} ${count === 1 ? 'answer' : 'answers'}`
  }
  return `${count} ${count === 1 ? 'réponse' : 'réponses'}`
}

function HelpAvatar({
  author,
  size = 'normal',
}: {
  author: { pseudo: string; display_name: string; avatar_url: string }
  size?: 'normal' | 'small'
}) {
  const name = author.display_name.trim() || author.pseudo
  const avatar = author.avatar_url.startsWith('https://')
    ? author.avatar_url
    : ''
  const tone = toneFor(`${author.pseudo}:${author.display_name}`)
  return (
    <span
      className={`help-avatar tone-${tone} ${size === 'small' ? 'small' : ''}`}
    >
      {avatar ? <img src={avatar} alt="" /> : initialsFor(name, author.pseudo)}
    </span>
  )
}

function QuestionSkeleton() {
  return (
    <article className="glass request question-card skeleton-question" aria-hidden="true">
      <span className="skeleton-line short" />
      <span className="skeleton-line wide" />
      <span className="skeleton-line" />
      <span className="skeleton-line short" />
    </article>
  )
}

/** Coche « Utile » dessinée par stroke-dashoffset à l'apparition du badge. */
function UsefulCheck() {
  return (
    <svg
      className="useful-check"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" pathLength="1" />
    </svg>
  )
}

const QuestionCard = memo(function QuestionCard({
  question,
  lang,
  onOpen,
}: {
  question: Question
  lang: Lang
  onOpen: (id: string) => void
}) {
  return (
    <button
      className="glass request question-card"
      type="button"
      onClick={() => onOpen(question.id)}
    >
      <div className="question-card-top">
        <span className={`status-pill ${question.status}`}>
          {statusLabel(question.status, lang)}
        </span>
        <span className="tier-pill">
          {tierLabel(question.tier, lang)} · {pointsLabel(question.tier, lang)}
        </span>
      </div>
      <div className="question-card-tags">
        {question.beginner_ok && (
          <span className="mentor-tag">
            {lang === 'en'
              ? 'Beginners welcome · +1 mentor bonus'
              : 'Débutant bienvenu · +1 bonus mentor'}
          </span>
        )}
        {question.is_free && (
          <span className="free-pill">
            {lang === 'en' ? 'Free question' : 'Question gratuite'}
          </span>
        )}
      </div>
      <h3>{question.title}</h3>
      <p>
        {question.technologies.slice(0, 3).join(' · ') ||
          (lang === 'en' ? 'No technology specified' : 'Technologie non précisée')}
      </p>
      <div className="question-meta">
        <span>{answerCountLabel(question.answer_count, lang)}</span>
        {question.status === 'open' && (
          <span>{formatTimeLeft(question.expires_at, lang)}</span>
        )}
        <span>@{question.author.pseudo}</span>
      </div>
      <span className="help-link">
        {lang === 'en' ? 'View question' : 'Voir la question'}{' '}
        <Icon name="arrow" size={18} />
      </span>
    </button>
  )
})

export function Help({ go, openQuestion }: { go: (s: Screen) => void; openQuestion: (id: string) => void }) {
  const lang = useLang()
  const { user } = useAuthSession()
  const userId = user?.id
  const [tab, setTab] = useState<QuestionTab>('open')
  const [beginnerOnly, setBeginnerOnly] = useState(false)
  const [technology, setTechnology] = useState('')
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [technologies, setTechnologies] = useState<string[]>([])
  const [reload, setReload] = useState(0)
  const [visibleCount, setVisibleCount] = useState(20)
  // Les cartes se complètent par lots après la première peinture : la liste
  // garde sa page de 20, sans construire tous les nœuds dans la même tâche.
  const [renderedQuestions, setRenderedQuestions] = useState(8)

  useEffect(() => {
    setVisibleCount(20)
    setRenderedQuestions(Math.min(8, questions?.length ?? 0))
  }, [tab, beginnerOnly, technology, questions])

  useEffect(() => {
    const total = Math.min(questions?.length ?? 0, visibleCount)
    if (renderedQuestions >= total) return
    const timer = window.setTimeout(() => {
      setRenderedQuestions((current) => Math.min(current + 6, total))
    }, 120)
    return () => window.clearTimeout(timer)
  }, [questions?.length, renderedQuestions, visibleCount])

  useEffect(() => {
    let active = true
    setQuestions(null)
    setError(null)
    listQuestions({
      tab,
      beginnerOnly,
      technology: technology || undefined,
    })
      .then((list) => {
        if (active) setQuestions(list)
      })
      .catch((cause: unknown) => {
        if (active) {
          setQuestions([])
          setError(toFrenchError(cause))
        }
      })
    return () => {
      active = false
    }
  }, [tab, beginnerOnly, technology, userId, reload])

  useEffect(() => {
    let active = true
    listQuestionTechnologies()
      .then((list) => {
        if (active) setTechnologies(list)
      })
      .catch(() => {
        /* Le filtre technologie reste optionnel si la lecture échoue. */
      })
    return () => {
      active = false
    }
  }, [reload])

  const tabs: { id: QuestionTab; fr: string; en: string }[] = [
    { id: 'open', fr: 'Ouvertes', en: 'Open' },
    { id: 'resolved', fr: 'Résolues', en: 'Solved' },
    { id: 'mine', fr: 'Mes questions', en: 'My questions' },
  ]

  const emptyTitle =
    tab === 'mine'
      ? lang === 'en'
        ? 'You have not asked a question yet'
        : 'Tu n’as pas encore posé de question'
      : tab === 'resolved'
        ? lang === 'en'
          ? 'No solved questions yet'
          : 'Aucune question résolue pour le moment'
        : lang === 'en'
          ? 'No open questions right now'
          : 'Aucune question ouverte pour le moment'

  const emptyText =
    tab === 'mine'
      ? lang === 'en'
        ? 'Ask for help: the community can unblock you.'
        : 'Demande de l’aide : la communauté peut te débloquer.'
      : tab === 'resolved'
        ? lang === 'en'
          ? 'As soon as an answer is validated, it will appear here.'
          : 'Dès qu’une réponse est validée, elle apparaîtra ici.'
        : lang === 'en'
          ? 'Be the first to ask, or come back soon to help someone.'
          : 'Sois le premier à demander, ou reviens bientôt aider quelqu’un.'

  const selectTab = (id: QuestionTab) => {
    if (id === tab) return
    crossfadeWithMotion(() => setTab(id))
  }

  return (
    <main className="screen">
      <Header title="Entraide" />
      <div className="help-heading">
        <div>
          <p className="eyebrow">La communauté</p>
          <h2>{lang === 'en' ? 'Community questions' : 'Les questions de la communauté'}</h2>
        </div>
        <Primary onClick={() => go('add')} icon="plus">
          Poser ma question
        </Primary>
      </div>

      <div className="help-tabs" role="tablist" aria-label={lang === 'en' ? 'Question filters' : 'Filtres des questions'}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => selectTab(item.id)}
          >
            {lang === 'en' ? item.en : item.fr}
          </button>
        ))}
      </div>

      <div className="help-filters">
        <button
          type="button"
          className={`filter-chip ${beginnerOnly ? 'active' : ''}`}
          aria-pressed={beginnerOnly}
          onClick={() => setBeginnerOnly((value) => !value)}
        >
          {lang === 'en' ? 'Beginners welcome' : 'Débutant bienvenu'}
        </button>
        <label className="help-tech-select">
          <span>{lang === 'en' ? 'Technology' : 'Technologie'}</span>
          <select
            value={technology}
            onChange={(event) => setTechnology(event.target.value)}
            autoComplete="off"
          >
            <option value="">
              {lang === 'en' ? 'All technologies' : 'Toutes les technologies'}
            </option>
            {technologies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="help-results">
        {error ? (
          <section className="glass help-state" role="alert">
            <StateArt kind="error" />
            <h2>{lang === 'en' ? 'The questions are unavailable' : 'Les questions sont indisponibles'}</h2>
            <p>{error}</p>
            <button className="secondary help-retry" onClick={() => setReload((value) => value + 1)}>
              {lang === 'en' ? 'Try again' : 'Réessayer'}
            </button>
          </section>
        ) : questions === null ? (
          <section className="list question-list" aria-busy="true" aria-live="polite">
            {[0, 1, 2].map((item) => (
              <QuestionSkeleton key={item} />
            ))}
          </section>
        ) : questions.length === 0 ? (
          <section className="glass empty help-empty">
            <StateArt kind="help" />
            <h2>{emptyTitle}</h2>
            <p>{emptyText}</p>
            {tab === 'mine' && (
              <Primary onClick={() => go('add')} icon="plus">
                Poser ma question
              </Primary>
            )}
          </section>
        ) : (
          <>
            <section className="list question-list">
              {questions
                .slice(0, Math.min(visibleCount, renderedQuestions))
                .map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    lang={lang}
                    onOpen={openQuestion}
                  />
                ))}
            </section>
            {questions.length > visibleCount && (
              <>
                <p className="list-more-note">
                  {lang === 'en'
                    ? `${visibleCount} of ${questions.length} questions shown`
                    : `${visibleCount} questions sur ${questions.length} affichées`}
                </p>
                <button
                  className="load-more"
                  type="button"
                  onClick={() => setVisibleCount((value) => value + 20)}
                >
                  {lang === 'en' ? 'Show more' : 'Voir plus'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export function QuestionThread({
  questionId,
  back,
}: {
  questionId: string
  back: () => void
}) {
  const lang = useLang()
  const online = useOnline()
  const { user } = useAuthSession()
  const { refreshStats } = useAuthActions()
  const [thread, setThread] = useState<QuestionThread | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<ThreadActionError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editProof, setEditProof] = useState('')
  const draftKey = user
    ? `${ANSWER_DRAFT_PREFIX}:${questionId}:${user.id}`
    : ''
  const [initialDraft] = useState<AnswerDraft>(() =>
    draftKey ? readAnswerDraft(draftKey) : { body: '', proofUrl: '' },
  )
  const [answerBody, setAnswerBody] = useState(initialDraft.body)
  const [answerProof, setAnswerProof] = useState(initialDraft.proofUrl)

  useEffect(() => {
    let active = true
    setError(null)
    getQuestion(questionId)
      .then((value) => {
        if (active) setThread(value)
      })
      .catch((cause: unknown) => {
        if (active) setError(toFrenchError(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [questionId, reload])

  useEffect(() => {
    if (!draftKey) return
    if (!answerBody.trim() && !answerProof.trim()) {
      clearDraft(draftKey)
      return
    }
    writeDraft(draftKey, { body: answerBody, proofUrl: answerProof })
  }, [draftKey, answerBody, answerProof])

  const question = thread?.question ?? null
  const answers = thread?.answers ?? []
  const isAuthor = Boolean(user && question && user.id === question.author_id)

  const refresh = () => setReload((value) => value + 1)
  const offlineActionMessage =
    lang === 'en'
      ? 'Offline: this action cannot be sent. Try again when the connection is back.'
      : 'Hors-ligne : cette action ne peut pas être envoyée. Réessaie quand la connexion revient.'

  const handleValidate = async (answer: Answer) => {
    if (!question || busy) return
    if (!online) {
      setActionError({
        message: offlineActionMessage,
        action: 'validate',
        answerId: answer.id,
      })
      return
    }
    const pseudo = answer.author.pseudo
    const amount = pointsLabel(question.tier, lang)
    const confirmation =
      lang === 'en'
        ? `This will give ${amount} to @${pseudo}. Continue?`
        : `Cela donnera ${amount} à @${pseudo}. Continuer ?`
    if (!window.confirm(confirmation)) return

    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await validateAnswer(answer.id)
      vibrate(10)
      await refreshStats()
      notifyProgressChanged({ celebration: 'validated' })
      setNotice(
        lang === 'en'
          ? `Thank you! ${amount} transferred to @${pseudo}.`
          : `Merci ! ${amount} transféré${question.tier > 1 ? 's' : ''} à @${pseudo}.`,
      )
      refresh()
    } catch (cause: unknown) {
      setActionError({
        message: toFrenchError(cause),
        action: 'validate',
        answerId: answer.id,
      })
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = async () => {
    if (!question || busy) return
    if (!online) {
      setActionError({ message: offlineActionMessage, action: 'withdraw' })
      return
    }
    const refund = question.is_free
      ? lang === 'en'
        ? 'This free question will be withdrawn.'
        : 'Cette question gratuite sera retirée.'
      : lang === 'en'
        ? `${pointsLabel(question.tier, lang)} will be refunded to you.`
        : `${pointsLabel(question.tier, lang)} te seront remboursés.`
    const confirmation =
      lang === 'en'
        ? `Withdraw this question? ${refund}`
        : `Retirer cette question ? ${refund}`
    if (!window.confirm(confirmation)) return

    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await withdrawQuestion(question.id)
      await refreshStats()
      notifyProgressChanged()
      setNotice(
        question.is_free
          ? lang === 'en'
            ? 'Question withdrawn. No points were debited.'
            : 'Question retirée. Aucun point n’avait été débité.'
          : lang === 'en'
            ? `Question withdrawn. ${pointsLabel(question.tier, lang)} refunded to you.`
            : `Question retirée. ${pointsLabel(question.tier, lang)} te sont remboursés.`,
      )
      refresh()
    } catch (cause: unknown) {
      setActionError({
        message: toFrenchError(cause),
        action: 'withdraw',
      })
    } finally {
      setBusy(false)
    }
  }

  const submitAnswer = async (event: FormEvent) => {
    event.preventDefault()
    if (!question || busy) return
    if (!online) {
      setActionError({ message: offlineActionMessage, action: 'answer' })
      return
    }
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await addAnswer(question.id, answerBody, answerProof)
      if (draftKey) clearDraft(draftKey)
      setAnswerBody('')
      setAnswerProof('')
      notifyProgressChanged()
      setNotice(lang === 'en' ? 'Your answer has been sent.' : 'Ta réponse a bien été envoyée.')
      refresh()
    } catch (cause: unknown) {
      setActionError({
        message: toFrenchError(cause),
        action: 'answer',
      })
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (answer: Answer) => {
    setEditingId(answer.id)
    setEditBody(answer.body)
    setEditProof(answer.proof_url)
    setActionError(null)
    setNotice(null)
  }

  const saveEdit = async (event: FormEvent, answer: Answer) => {
    event.preventDefault()
    if (busy) return
    if (!online) {
      setActionError({
        message: offlineActionMessage,
        action: 'edit',
        answerId: answer.id,
      })
      return
    }
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await updateAnswer(answer.id, editBody, editProof)
      setEditingId(null)
      setNotice(lang === 'en' ? 'Your answer has been updated.' : 'Ta réponse a été modifiée.')
      refresh()
    } catch (cause: unknown) {
      setActionError({
        message: toFrenchError(cause),
        action: 'edit',
        answerId: answer.id,
      })
    } finally {
      setBusy(false)
    }
  }

  const removeAnswer = async (answer: Answer) => {
    if (busy) return
    if (!online) {
      setActionError({
        message: offlineActionMessage,
        action: 'delete',
        answerId: answer.id,
      })
      return
    }
    const confirmation =
      lang === 'en'
        ? 'Delete this answer? This cannot be undone.'
        : 'Supprimer cette réponse ? Cette action est définitive.'
    if (!window.confirm(confirmation)) return
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await deleteAnswer(answer.id)
      if (editingId === answer.id) setEditingId(null)
      notifyProgressChanged()
      setNotice(lang === 'en' ? 'Your answer has been deleted.' : 'Ta réponse a été supprimée.')
      refresh()
    } catch (cause: unknown) {
      setActionError({
        message: toFrenchError(cause),
        action: 'delete',
        answerId: answer.id,
      })
    } finally {
      setBusy(false)
    }
  }

  if (loading && !thread) {
    return (
      <main className="screen">
        <Header title="Entraide" back={back} />
        <section className="list question-list" aria-busy="true" aria-live="polite">
          <QuestionSkeleton />
          <QuestionSkeleton />
        </section>
      </main>
    )
  }

  if (error && !thread) {
    return (
      <main className="screen">
        <Header title="Entraide" back={back} />
        <section className="glass help-state" role="alert">
          <StateArt kind="error" />
          <h2>{lang === 'en' ? 'This question is unavailable' : 'Cette question est indisponible'}</h2>
          <p>{error}</p>
          <button className="secondary help-retry" onClick={() => setReload((value) => value + 1)}>
            {lang === 'en' ? 'Try again' : 'Réessayer'}
          </button>
        </section>
      </main>
    )
  }

  if (!question) {
    return (
      <main className="screen">
        <Header title="Entraide" back={back} />
        <section className="glass empty help-empty">
          <h2>{lang === 'en' ? 'Question not found' : 'Question introuvable'}</h2>
          <p>{lang === 'en' ? 'It may have been withdrawn or deleted.' : 'Elle a peut-être été retirée ou supprimée.'}</p>
        </section>
      </main>
    )
  }

  const validatedAnswer = answers.find((answer) => answer.is_useful) ?? null
  const canAnswer = Boolean(user) && !isAuthor && question.status === 'open'
  const showOfflineNote = !online
  const actionMessageFor = (
    action: ThreadAction,
    answerId?: string,
  ): string | null =>
    actionError &&
    actionError.action === action &&
    (answerId === undefined || actionError.answerId === answerId)
      ? actionError.message
      : null
  const withdrawError = actionMessageFor('withdraw')
  const answerSubmitError = actionMessageFor('answer')

  return (
    <main className="screen">
      <Header title="Entraide" back={back} />

      <section className="glass question-detail thread-question">
        <div className="question-card-top">
          <span className={`status-pill ${question.status}`}>
            {statusLabel(question.status, lang)}
          </span>
          <span className="tier-pill">
            {tierLabel(question.tier, lang)} · {pointsLabel(question.tier, lang)}
          </span>
        </div>
        <div className="question-card-tags">
          {question.beginner_ok && (
            <span className="mentor-tag">
              {lang === 'en'
                ? 'Beginners welcome · +1 mentor bonus'
                : 'Débutant bienvenu · +1 bonus mentor'}
            </span>
          )}
          {question.is_free && (
            <span className="free-pill">
              {lang === 'en' ? 'Free question' : 'Question gratuite'}
            </span>
          )}
        </div>
        <h2>{question.title}</h2>
        <div className="author-line thread-author">
          <HelpAvatar author={question.author} />
          <p>
            <b>{question.author.display_name || question.author.pseudo}</b>
            <small>@{question.author.pseudo}</small>
          </p>
        </div>
        <div className="thread-body">{question.body}</div>
        {question.github_url.startsWith('https://') && (
          <a
            className="thread-github"
            href={question.github_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="github" size={18} />
            {lang === 'en' ? 'View the GitHub link' : 'Voir le lien GitHub'}
            <Icon name="external" size={15} />
          </a>
        )}
        <div className="question-meta thread-meta">
          <span>{answerCountLabel(question.answer_count, lang)}</span>
          {question.status === 'open' && (
            <span>{formatTimeLeft(question.expires_at, lang)}</span>
          )}
          <span>{question.technologies.join(' · ')}</span>
        </div>
        <div className="thread-share">
          <ShareButton
            url={shareUrlFor({ name: 'question', id: question.id })}
            title={question.title}
            text={question.body.slice(0, 140)}
          />
        </div>

        {question.status === 'expired' && (
          <div className="help-notice animated">
            {lang === 'en'
              ? 'This question has expired. Any held points were returned to its author, and new answers are closed.'
              : 'Cette question a expiré. Les points mis de côté ont été rendus à son auteur et les nouvelles réponses sont fermées.'}
          </div>
        )}
        {question.status === 'withdrawn' && (
          <div className="help-notice animated">
            {lang === 'en'
              ? 'This question was withdrawn by its author. New answers are closed.'
              : 'Cette question a été retirée par son auteur. Les nouvelles réponses sont fermées.'}
          </div>
        )}
        {question.status === 'resolved' && validatedAnswer && (
          <div className="help-notice resolved-note animated">
            {lang === 'en'
              ? `Solved by @${validatedAnswer.author.pseudo}. The validated answer is highlighted below.`
              : `Résolue grâce à @${validatedAnswer.author.pseudo}. La réponse validée est mise en avant ci-dessous.`}
          </div>
        )}

        {isAuthor && question.status === 'open' && (
          <div className="thread-actions">
            <button
              className="secondary withdraw-btn"
              type="button"
              disabled={busy || !online}
              onClick={() => void handleWithdraw()}
            >
              {busy
                ? lang === 'en'
                  ? 'Working…'
                  : 'Traitement…'
                : lang === 'en'
                  ? 'Withdraw my question'
                  : 'Retirer ma question'}
            </button>
            {withdrawError && (
              <p className="inline-error form-error" role="alert">
                {withdrawError}
              </p>
            )}
          </div>
        )}
      </section>

      {notice && (
        <div className="glass thanks help-feedback" role="status">
          {notice}
        </div>
      )}

      <div className="answer-title thread-answer-title">
        <h3>{answerCountLabel(answers.length, lang)}</h3>
        <span>{lang === 'en' ? 'Validated answer first' : 'Réponse validée d’abord'}</span>
      </div>

      {answers.length === 0 ? (
        <p className="help-empty-line">
          {lang === 'en' ? 'No answers yet. Your help could unblock this question.' : 'Pas encore de réponse. Ton aide peut débloquer cette question.'}
        </p>
      ) : (
        <section className="thread-answers">
          {answers.map((answer) => {
            const ownAnswer = user?.id === answer.author_id
            const canValidate =
              isAuthor &&
              question.status === 'open' &&
              !answer.is_useful &&
              !ownAnswer
            const answerActionError =
              actionMessageFor('validate', answer.id) ??
              actionMessageFor('edit', answer.id) ??
              actionMessageFor('delete', answer.id)
            return (
              <article
                className={`answer thread-answer ${answer.is_useful ? 'validated' : ''}`}
                key={answer.id}
              >
                <div className="answer-head">
                  <HelpAvatar author={answer.author} size="small" />
                  <b>{answer.author.display_name || answer.author.pseudo}</b>
                  <small>
                    @{answer.author.pseudo}
                    {answer.level ? ` · ${answer.level}` : ''}
                  </small>
                  {answer.is_useful && (
                    <em className="useful-badge">
                      <UsefulCheck />
                      {lang === 'en' ? 'Useful' : 'Utile'}
                    </em>
                  )}
                </div>

                {editingId === answer.id ? (
                  <form className="answer-edit" onSubmit={(event) => void saveEdit(event, answer)}>
                    <textarea
                      className="text-input answer-textarea"
                      value={editBody}
                      maxLength={10000}
                      onChange={(event) => setEditBody(event.target.value)}
                      aria-label={lang === 'en' ? 'Edit your answer' : 'Modifier ta réponse'}
                      spellCheck
                      autoCapitalize="sentences"
                    />
                    <input
                      className="text-input"
                      type="url"
                      value={editProof}
                      placeholder={
                        lang === 'en'
                          ? 'Proof: GitHub link (optional)'
                          : 'Preuve : lien GitHub (facultatif)'
                      }
                      onChange={(event) => setEditProof(event.target.value)}
                      autoComplete="url"
                      inputMode="url"
                      enterKeyHint="done"
                      spellCheck={false}
                    />
                    <div className="answer-actions">
                      <button
                        className="secondary small-action"
                        type="submit"
                        disabled={busy || !online || !editBody.trim()}
                      >
                        {lang === 'en' ? 'Save' : 'Enregistrer'}
                      </button>
                      <button
                        className="ghost small-action"
                        type="button"
                        onClick={() => setEditingId(null)}
                      >
                        {lang === 'en' ? 'Cancel' : 'Annuler'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="answer-body">{answer.body}</p>
                    {answer.proof_url.startsWith('https://') && (
                      <a
                        className="proof-link"
                        href={answer.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="github" size={16} />
                        {lang === 'en' ? 'View proof' : 'Voir la preuve'}
                      </a>
                    )}
                  </>
                )}

                <div className="answer-actions">
                  {canValidate && (
                    <button
                      className="secondary small-action useful-action"
                      type="button"
                      disabled={busy || !online}
                      onClick={() => void handleValidate(answer)}
                    >
                      {lang === 'en' ? 'Useful ✓' : 'Utile ✓'}
                    </button>
                  )}
                  {ownAnswer && !answer.is_useful && editingId !== answer.id && (
                    <>
                      <button
                        className="ghost small-action"
                        type="button"
                        disabled={busy || !online}
                        onClick={() => startEdit(answer)}
                      >
                        {lang === 'en' ? 'Edit' : 'Modifier'}
                      </button>
                      <button
                        className="ghost small-action"
                        type="button"
                        disabled={busy || !online}
                        onClick={() => void removeAnswer(answer)}
                      >
                        {lang === 'en' ? 'Delete' : 'Supprimer'}
                      </button>
                    </>
                  )}
                </div>
                {answerActionError && (
                  <p className="inline-error form-error" role="alert">
                    {answerActionError}
                  </p>
                )}
              </article>
            )
          })}
        </section>
      )}

      {showOfflineNote && (
        <p className="help-offline-note" role="status">
          <Icon name="wifi" size={16} />
          {lang === 'en'
            ? 'Offline: sending is disabled. Your drafts stay on this device.'
            : 'Hors-ligne : les envois sont désactivés. Tes brouillons restent sur cet appareil.'}
        </p>
      )}

      {!user && (
        <section className="glass help-state signin-invite">
          <h2>{lang === 'en' ? 'Sign in to answer' : 'Connecte-toi pour répondre'}</h2>
          <p>
            {lang === 'en'
              ? 'You can read the conversation now. Sign in when you want to help.'
              : 'Tu peux lire la conversation maintenant. Connecte-toi quand tu veux aider.'}
          </p>
        </section>
      )}

      {canAnswer && (
        <form className="glass answer-form" onSubmit={(event) => void submitAnswer(event)}>
          <h3>{lang === 'en' ? 'Your answer' : 'Ta réponse'}</h3>
          <textarea
            className="text-input answer-textarea"
            value={answerBody}
            maxLength={10000}
            placeholder={
              lang === 'en'
                ? 'Explain the fix simply, step by step…'
                : 'Explique la solution simplement, étape par étape…'
            }
            onChange={(event) => setAnswerBody(event.target.value)}
            aria-label={lang === 'en' ? 'Your answer' : 'Ta réponse'}
            spellCheck
            autoCapitalize="sentences"
          />
          <input
            className="text-input"
            type="url"
            value={answerProof}
            placeholder={
              lang === 'en'
                ? 'Proof: GitHub link (optional)'
                : 'Preuve : lien GitHub (facultatif)'
            }
            onChange={(event) => setAnswerProof(event.target.value)}
            autoComplete="url"
            inputMode="url"
            enterKeyHint="done"
            spellCheck={false}
          />
          <p className="form-note">
            {lang === 'en'
              ? 'Your draft is saved on this device.'
              : 'Ton brouillon est enregistré sur cet appareil.'}
          </p>
          <Primary type="submit" disabled={busy || !online || !answerBody.trim()} loading={busy}>
            {busy
              ? lang === 'en'
                ? 'Sending…'
                : 'Envoi…'
              : lang === 'en'
                ? 'Send my answer'
                : 'Envoyer ma réponse'}
          </Primary>
          {answerSubmitError && (
            <p className="inline-error form-error" role="alert">
              {answerSubmitError}
            </p>
          )}
          {!online && (
            <p className="form-note offline-reason">
              {lang === 'en'
                ? 'Sending is disabled while you are offline.'
                : 'L’envoi est désactivé tant que tu es hors-ligne.'}
            </p>
          )}
        </form>
      )}

      {isAuthor && question.status === 'open' && (
        <p className="form-note owner-note">
          {lang === 'en'
            ? 'This is your question: choose the answer that helped you most.'
            : 'C’est ta question : choisis la réponse qui t’a le plus aidé.'}
        </p>
      )}
    </main>
  )
}

export function Add({
  go,
  onPosted,
  back,
}: {
  go: (s: Screen) => void
  onPosted: (questionId: string) => void
  back: () => void
}) {
  const lang = useLang()
  const online = useOnline()
  const { user } = useAuthSession()
  const { stats, statsLoading, statsError } = useAuthStats()
  const { refreshStats } = useAuthActions()
  const userId = user?.id ?? 'anon'
  const draftKey = `${QUESTION_DRAFT_PREFIX}:${userId}`
  const [draft, setDraft] = useState<QuestionDraft>(() => readQuestionDraft(draftKey))
  const [draftRestored, setDraftRestored] = useState(() =>
    questionDraftHasContent(draft),
  )
  const [fieldErrors, setFieldErrors] = useState<QuestionFormErrors>({})
  const [freeAvailable, setFreeAvailable] = useState<boolean | null>(null)
  const [freeError, setFreeError] = useState<string | null>(null)
  const [freeReload, setFreeReload] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setFreeAvailable(null)
    setFreeError(null)
    isFreeQuestionAvailable()
      .then((value) => {
        if (active) setFreeAvailable(value)
      })
      .catch((cause: unknown) => {
        if (active) {
          setFreeAvailable(null)
          setFreeError(toFrenchError(cause))
        }
      })
    return () => {
      active = false
    }
  }, [userId, freeReload])

  useEffect(() => {
    const empty = !questionDraftHasContent(draft)
    if (empty) {
      clearDraft(draftKey)
      setDraftRestored(false)
      return
    }
    writeDraft(draftKey, draft)
  }, [draft, draftKey])

  const balance = stats?.balance ?? 0
  const balanceKnown = Boolean(stats)
  const canAfford = balanceKnown && balance >= draft.tier
  const freeTier = draft.tier === 1
  const canUseFree = !canAfford && freeTier && freeAvailable === true
  const canPost = canAfford || canUseFree
  const balanceAfter = canAfford ? balance - draft.tier : canUseFree ? balance : null
  const freeCheckFailed = !canAfford && freeTier && Boolean(freeError)
  const freeCheckPending =
    !canAfford && freeTier && freeAvailable === null && !freeError

  const blockedReason: string | null = canPost
    ? null
    : !balanceKnown
      ? statsLoading
        ? lang === 'en'
          ? 'Loading your points…'
          : 'Chargement de tes points…'
        : lang === 'en'
          ? 'Cannot check your balance. Try again in a moment.'
          : `Impossible de vérifier ton solde. ${statsError ?? 'Réessaie dans un instant.'}`
      : !canAfford
        ? !freeTier
          ? lang === 'en'
            ? `Not enough points: you need ${pointsLabel(draft.tier, lang)}.`
            : `Solde insuffisant : il te faut ${pointsLabel(draft.tier, lang)}.`
          : freeCheckFailed
            ? lang === 'en'
              ? 'Cannot check whether your free question is available. Try again in a moment.'
              : 'Impossible de vérifier ta question gratuite. Réessaie dans un instant.'
            : freeCheckPending
              ? lang === 'en'
                ? 'Checking whether your free question is available…'
                : 'Vérification de ta question gratuite…'
              : lang === 'en'
                ? 'Not enough points: you need 1 point, and your free question is already used this week.'
                : 'Solde insuffisant : il te faut 1 point et ta question gratuite est déjà utilisée cette semaine.'
        : null

  const updateDraft = (changes: Partial<QuestionDraft>) => {
    setDraft((current) => ({ ...current, ...changes }))
    const changedFields = Object.keys(changes).filter(
      (key): key is QuestionFormField =>
        key === 'title' ||
        key === 'body' ||
        key === 'technologies' ||
        key === 'tier' ||
        key === 'githubUrl',
    )
    if (changedFields.length > 0) {
      setFieldErrors((current) => {
        if (!changedFields.some((field) => current[field])) return current
        const next = { ...current }
        for (const field of changedFields) delete next[field]
        return next
      })
    }
    setError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return

    const validationErrors = validateQuestionForm(
      {
        title: draft.title,
        body: draft.body,
        technologies: draft.technologies,
        tier: draft.tier,
        githubUrl: draft.githubUrl,
      },
      lang,
    )
    setFieldErrors(validationErrors)
    const firstInvalidField = firstQuestionFormField(validationErrors)
    if (firstInvalidField) {
      setError(null)
      document.getElementById(QUESTION_FIELD_IDS[firstInvalidField])?.focus()
      return
    }

    setError(null)
    if (!online) {
      setError(
        lang === 'en'
          ? 'Offline: posting is disabled. Your draft stays on this device.'
          : 'Hors-ligne : la publication est désactivée. Ton brouillon reste sur cet appareil.',
      )
      return
    }
    if (!canPost) {
      setError(
        blockedReason ??
          (lang === 'en'
            ? 'Posting is unavailable right now. Try again in a moment.'
            : 'La publication est indisponible pour le moment. Réessaie dans un instant.'),
      )
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const questionId = await postQuestion({
        title: draft.title,
        body: draft.body,
        technologies: parseQuestionTechnologies(draft.technologies),
        tier: draft.tier,
        githubUrl: draft.githubUrl,
        beginnerOk: draft.beginnerOk,
      })
      clearDraft(draftKey)
      onPosted(questionId)
      void refreshStats()
    } catch (cause: unknown) {
      setError(toFrenchError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  const tierHints: Record<HelpTier, { fr: string; en: string }> = {
    1: { fr: 'Pour une petite question rapide', en: 'For a small quick question' },
    3: { fr: 'Pour un vrai blocage', en: 'For a real blocker' },
    6: { fr: 'Pour un problème complexe', en: 'For a complex problem' },
  }

  return (
    <main className="screen">
      <Header title="Demander de l'aide" back={back} />
      <form className="form help-ask-form" onSubmit={(event) => void handleSubmit(event)}>
        <p className="eyebrow">Explique simplement</p>
        <h2>Où es-tu bloqué ?</h2>
        {draftRestored && (
          <p className="draft-note" role="status">
            {lang === 'en'
              ? 'Your draft from the last visit was restored.'
              : 'Ton brouillon de la dernière visite a été restauré.'}{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                clearDraft(draftKey)
                setDraft(EMPTY_QUESTION_DRAFT)
                setDraftRestored(false)
                setFieldErrors({})
                setError(null)
              }}
            >
              {lang === 'en' ? 'Start over' : 'Repartir de zéro'}
            </button>
          </p>
        )}

        <label>
          <span>{lang === 'en' ? 'Question title' : 'Titre de la question'}</span>
          <input
            id="question-title"
            className="text-input"
            value={draft.title}
            maxLength={QUESTION_TITLE_MAX}
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={`question-title-help${fieldErrors.title ? ' question-title-error' : ''}`}
            placeholder={
              lang === 'en'
                ? 'E.g. My Mobile Money payment returns an error'
                : 'Ex. Mon paiement Mobile Money affiche une erreur'
            }
            onChange={(event) => updateDraft({ title: event.target.value })}
            autoComplete="off"
            enterKeyHint="next"
            spellCheck
          />
          <small id="question-title-help" className="field-help">
            {lang === 'en'
              ? `${QUESTION_TITLE_MIN} to ${QUESTION_TITLE_MAX} characters.`
              : `Entre ${QUESTION_TITLE_MIN} et ${QUESTION_TITLE_MAX} caractères.`}{' '}
            <span className="char-count">
              {draft.title.length} / {QUESTION_TITLE_MAX}
            </span>
          </small>
          {fieldErrors.title && (
            <small id="question-title-error" className="inline-error field-error" role="alert">
              {fieldErrors.title}
            </small>
          )}
        </label>

        <label>
          <span>{lang === 'en' ? 'Description' : 'Description'}</span>
          <textarea
            id="question-body"
            value={draft.body}
            maxLength={QUESTION_BODY_MAX}
            aria-invalid={Boolean(fieldErrors.body)}
            aria-describedby={`question-body-help${fieldErrors.body ? ' question-body-error' : ''}`}
            placeholder={
              lang === 'en'
                ? 'What did you try? What error do you see?'
                : 'Qu’as-tu essayé ? Quel message d’erreur vois-tu ?'
            }
            onChange={(event) => updateDraft({ body: event.target.value })}
            spellCheck
            autoCapitalize="sentences"
          />
          <small id="question-body-help" className="field-help">
            {lang === 'en'
              ? `${QUESTION_BODY_MIN} to ${QUESTION_BODY_MAX.toLocaleString('en-US')} characters.`
              : `Entre ${QUESTION_BODY_MIN} et ${QUESTION_BODY_MAX.toLocaleString('fr-FR')} caractères.`}{' '}
            <span className="char-count">
              {draft.body.length} /{' '}
              {QUESTION_BODY_MAX.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}
            </span>
          </small>
          {fieldErrors.body && (
            <small id="question-body-error" className="inline-error field-error" role="alert">
              {fieldErrors.body}
            </small>
          )}
        </label>

        <label>
          <span>{lang === 'en' ? 'Technology' : 'Technologie'}</span>
          <input
            id="question-technologies"
            className="text-input"
            value={draft.technologies}
            aria-invalid={Boolean(fieldErrors.technologies)}
            aria-describedby={`question-technologies-help${fieldErrors.technologies ? ' question-technologies-error' : ''}`}
            placeholder="React, Node.js, PostgreSQL"
            onChange={(event) => updateDraft({ technologies: event.target.value })}
            autoComplete="off"
            enterKeyHint="next"
            spellCheck={false}
          />
          <small id="question-technologies-help" className="field-help">
            {lang === 'en'
              ? 'At least one technology, separated by commas.'
              : 'Au moins une technologie, séparée par des virgules.'}
          </small>
          {fieldErrors.technologies && (
            <small id="question-technologies-error" className="inline-error field-error" role="alert">
              {fieldErrors.technologies}
            </small>
          )}
        </label>

        <fieldset className="tier-fieldset">
          <legend>{lang === 'en' ? 'Choose your help level' : 'Choisis ton palier d’aide'}</legend>
          <div className="tier-options" role="radiogroup" aria-describedby="question-tier-help">
            {([1, 3, 6] as HelpTier[]).map((tier) => (
              <button
                key={tier}
                id={tier === 1 ? 'question-tier-1' : undefined}
                type="button"
                role="radio"
                aria-checked={draft.tier === tier}
                className={`glass tier-option ${draft.tier === tier ? 'active' : ''}`}
                onClick={() => updateDraft({ tier })}
              >
                <span>
                  <b>{tierLabel(tier, lang)}</b>
                  <small>{tierHints[tier][lang]}</small>
                </span>
                <strong>{pointsLabel(tier, lang)}</strong>
              </button>
            ))}
          </div>
          <small id="question-tier-help" className="field-help">
            {lang === 'en' ? 'Choose 1, 3 or 6 points.' : 'Choisis 1, 3 ou 6 points.'}
          </small>
          {fieldErrors.tier && (
            <small id="question-tier-error" className="inline-error field-error" role="alert">
              {fieldErrors.tier}
            </small>
          )}
          <p className="form-note tier-note">
            {lang === 'en'
              ? 'A question stays open for 7 days. Points are set aside and refunded if nobody helps.'
              : 'Une question reste ouverte 7 jours. Les points sont mis de côté et rendus si personne ne t’aide.'}
          </p>
        </fieldset>

        <label>
          <span>{lang === 'en' ? 'GitHub link (optional)' : 'Lien GitHub (facultatif)'}</span>
          <input
            id="question-github"
            className="text-input"
            type="url"
            value={draft.githubUrl}
            aria-invalid={Boolean(fieldErrors.githubUrl)}
            aria-describedby={`question-github-help${fieldErrors.githubUrl ? ' question-github-error' : ''}`}
            placeholder="https://github.com/ton-pseudo/ton-projet"
            onChange={(event) => updateDraft({ githubUrl: event.target.value })}
            autoComplete="url"
            inputMode="url"
            enterKeyHint="done"
            spellCheck={false}
          />
          <small id="question-github-help" className="field-help">
            {lang === 'en'
              ? 'Optional: https://github.com/username/repository'
              : 'Facultatif : https://github.com/pseudo/depot'}
          </small>
          {fieldErrors.githubUrl && (
            <small id="question-github-error" className="inline-error field-error" role="alert">
              {fieldErrors.githubUrl}
            </small>
          )}
        </label>

        <label className="check-line">
          <input
            type="checkbox"
            checked={draft.beginnerOk}
            onChange={(event) => updateDraft({ beginnerOk: event.target.checked })}
          />
          <span>
            <b>{lang === 'en' ? 'Beginners welcome' : 'Débutant bienvenu'}</b>
            <small>
              {lang === 'en'
                ? 'A beginner can answer and earn a mentor bonus.'
                : 'Un débutant peut répondre et gagner un bonus mentor.'}
            </small>
          </span>
        </label>

        <div className={`balance-after ${canPost ? '' : 'muted'}`}>
          <span>{lang === 'en' ? 'Your balance after posting' : 'Ton solde après publication'}</span>
          <b>
            {!balanceKnown
              ? statsLoading
                ? lang === 'en'
                  ? 'Loading…'
                  : 'Chargement…'
                : lang === 'en'
                  ? 'Unavailable'
                  : 'Indisponible'
              : balanceAfter === null
                ? lang === 'en'
                  ? 'Not enough points'
                  : 'Solde insuffisant'
                : `${balanceAfter} ${lang === 'en' ? 'pts' : 'points'}`}
          </b>
          {canUseFree && (
            <small>
              {lang === 'en'
                ? 'Free question: no points are deducted.'
                : 'Question gratuite : aucun point n’est déduit.'}
            </small>
          )}
          {!balanceKnown && (
            <small>
              {statsLoading
                ? lang === 'en'
                  ? 'Loading your points…'
                  : 'Chargement de tes points…'
                : statsError ??
                  (lang === 'en'
                    ? 'Cannot check your balance. Try again in a moment.'
                    : 'Impossible de vérifier ton solde. Réessaie dans un instant.')}
            </small>
          )}
        </div>

        {balanceKnown && !canAfford && freeTier && freeAvailable === true && (
          <div className="glass free-question-card">
            <Icon name="star" size={22} />
            <div>
              <h3>{lang === 'en' ? 'Free question available' : 'Question gratuite disponible'}</h3>
              <p>
                {lang === 'en'
                  ? '1 left this week. It covers the Quick help level (1 point).'
                  : '1 restante cette semaine. Elle couvre le palier Coup de pouce (1 point).'}
              </p>
            </div>
          </div>
        )}

        {balanceKnown && !canAfford && !freeTier && freeAvailable === true && (
          <div className="glass free-question-card">
            <Icon name="star" size={22} />
            <div>
              <h3>{lang === 'en' ? 'Your free question is still available' : 'Ta question gratuite est encore disponible'}</h3>
              <p>
                {lang === 'en'
                  ? 'It only covers the Quick help level (1 point). Choose it to post for free.'
                  : 'Elle couvre seulement le palier Coup de pouce (1 point). Choisis-le pour publier gratuitement.'}
              </p>
              <button
                className="ghost small-action"
                type="button"
                onClick={() => updateDraft({ tier: 1 })}
              >
                {lang === 'en' ? 'Choose Quick help (1 point)' : 'Choisir Coup de pouce (1 point)'}
              </button>
            </div>
          </div>
        )}

        {balanceKnown && !canAfford && freeAvailable === false && (
          <section className="glass earn help-earn">
            <h3>{lang === 'en' ? 'Earn points in 2 minutes' : 'Gagne des points en 2 minutes'}</h3>
            <p>
              {lang === 'en'
                ? 'Your free question is already used this week. Two quick ways to earn points:'
                : 'Ta question gratuite est déjà utilisée cette semaine. Deux façons rapides de gagner des points :'}
            </p>
            <button type="button" onClick={() => go('help')}>
              {lang === 'en' ? 'Answer a beginner question' : 'Répondre à une question débutant'}
              <Icon name="arrow" size={18} />
            </button>
            <button type="button" onClick={() => go('share')}>
              {lang === 'en' ? 'Share a project' : 'Partager un projet'}
              <Icon name="arrow" size={18} />
            </button>
          </section>
        )}

        {freeCheckPending && (
          <p className="form-note">
            {lang === 'en'
              ? 'Checking whether your free question is available…'
              : 'Vérification de ta question gratuite…'}
          </p>
        )}

        {!online && (
          <p className="help-offline-note" role="status">
            <Icon name="wifi" size={16} />
            {lang === 'en'
              ? 'Offline: posting is disabled. Your draft stays on this device.'
              : 'Hors-ligne : la publication est désactivée. Ton brouillon reste sur cet appareil.'}
          </p>
        )}

        {!error && blockedReason && (
          <p className="form-note form-blocked-reason" role="status">
            {blockedReason}
          </p>
        )}

        {((!balanceKnown && !statsLoading) || freeCheckFailed) && (
          <button
            className="ghost small-action form-retry"
            type="button"
            onClick={() => {
              if (!balanceKnown) void refreshStats()
              if (freeCheckFailed) setFreeReload((value) => value + 1)
            }}
          >
            {lang === 'en' ? 'Try again' : 'Réessayer'}
          </button>
        )}

        {error && (
          <p className="inline-error form-error" role="alert">
            {error}
          </p>
        )}

        <Primary type="submit" disabled={submitting} loading={submitting}>
          {submitting
            ? lang === 'en'
              ? 'Publishing…'
              : 'Publication…'
            : canUseFree
              ? lang === 'en'
                ? 'Ask my free question (1 left this week)'
                : 'Poser ma question gratuite (1 restante cette semaine)'
              : lang === 'en'
                ? 'Publish my question'
                : 'Publier ma question'}
        </Primary>

        <p className="form-note">
          {lang === 'en'
            ? 'Your draft is saved on this device and removed after publishing.'
            : 'Ton brouillon est enregistré sur cet appareil et effacé après publication.'}
        </p>
      </form>
    </main>
  )
}
