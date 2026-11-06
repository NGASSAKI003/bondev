import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getLang } from '../i18n'
import {
  ApiError,
  getMyStats,
  isUniqueViolation,
  normaliseProfile,
  PROFILE_COLUMNS,
  toFrenchError,
  type Profile,
  type ProfileRow,
  type ProfileStats,
} from './api'
import {
  GUEST_DISPLAY_NAME,
  GUEST_SIGN_IN_ERROR,
  generateGuestPseudo,
  isGuestUser,
} from './guest'
import { getSupabase } from './supabase'

type AuthResult = { error: string | null }

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isGuest: boolean
  authNotice: string | null
  setAuthNotice: (message: string | null) => void
  stats: ProfileStats | null
  statsLoading: boolean
  profileError: string | null
  statsError: string | null
  signInWithGitHub: () => Promise<AuthResult>
  signInWithGoogle: () => Promise<AuthResult>
  signInWithEmail: (email: string) => Promise<AuthResult>
  signInAnonymously: () => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  refreshProfile: () => Promise<void>
  refreshStats: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function metadataObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function firstString(
  values: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = values[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function isGithubAccount(appMetadata: Record<string, unknown>): boolean {
  const provider =
    typeof appMetadata.provider === 'string' ? appMetadata.provider : ''
  if (provider === 'github') return true
  const providers = appMetadata.providers
  return (
    Array.isArray(providers) &&
    providers.some((candidate) => candidate === 'github')
  )
}

/** Nettoie un pseudo pour respecter ^[a-zA-Z0-9_-]{3,30}$. */
function cleanPseudo(value: string): string {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 30)

  if (cleaned.length >= 3) return cleaned
  return `${cleaned}dev`.slice(0, 30)
}

function pseudoForAttempt(base: string, attempt: number): string {
  if (attempt === 0) return base
  const suffix = String(1000 + Math.floor(Math.random() * 9000))
  const room = Math.max(3, 30 - suffix.length)
  return `${base.slice(0, room)}${suffix}`
}

/**
 * Crée le profil à la première connexion. N'écrit que dans les colonnes
 * autorisées ; les 5 points de départ sont ajoutés par le trigger Supabase.
 */
async function ensureProfile(user: User): Promise<Profile> {
  const client = getSupabase()

  const selectMine = async (): Promise<Profile | null> => {
    const { data, error } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .maybeSingle()
    if (error) throw error
    return data ? normaliseProfile(data as ProfileRow) : null
  }

  const existing = await selectMine()
  if (existing) return existing

  const anonymous = isGuestUser(user)
  const metadata = metadataObject(user.user_metadata)
  const appMetadata = metadataObject(user.app_metadata)
  const githubAccount = !anonymous && isGithubAccount(appMetadata)
  const githubName = firstString(metadata, ['user_name', 'preferred_username'])
  const fullName = firstString(metadata, ['full_name', 'name'])
  const email = user.email?.trim() ?? ''
  const emailPrefix = email.includes('@')
    ? email.slice(0, email.indexOf('@'))
    : email
  const source = (githubAccount ? githubName : '') || emailPrefix || fullName || 'dev'
  const basePseudo = anonymous ? '' : cleanPseudo(source)

  const avatarCandidate = anonymous
    ? ''
    : firstString(metadata, ['avatar_url', 'picture'])
  const avatarUrl = avatarCandidate.startsWith('https://')
    ? avatarCandidate
    : ''
  const githubUrl =
    githubAccount && githubName
      ? `https://github.com/${encodeURIComponent(githubName)}`
      : ''
  const displayName = anonymous
    ? GUEST_DISPLAY_NAME
    : (fullName || basePseudo).replace(/\s+/g, ' ').slice(0, 80)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    // Un invité reçoit un nouveau suffixe à chaque tentative de conflit.
    // On n'écrit que dans `profiles` : les 5 points viennent du trigger SQL.
    const pseudo = anonymous
      ? generateGuestPseudo()
      : pseudoForAttempt(basePseudo, attempt)
    const { data, error } = await client
      .from('profiles')
      .insert({
        id: user.id,
        pseudo,
        display_name: displayName,
        avatar_url: avatarUrl,
        bio: '',
        github_url: githubUrl,
        lang: getLang(),
      })
      .select(PROFILE_COLUMNS)
      .single()

    if (!error && data) return normaliseProfile(data as ProfileRow)

    if (error && isUniqueViolation(error)) {
      // Un autre onglet a peut-être déjà créé le profil, ou le pseudo est pris.
      const concurrent = await selectMine()
      if (concurrent) return concurrent
      continue
    }

    if (error) throw error
  }

  throw new ApiError(
    'Impossible de créer ton profil : ce pseudo est déjà utilisé. Réessaie dans un instant.',
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  const sequenceRef = useRef(0)
  const currentUserIdRef = useRef<string | null>(null)
  const initialHandledRef = useRef(false)
  const profileRequestRef = useRef<{
    userId: string
    promise: Promise<Profile>
  } | null>(null)

  const loadProfileOnce = useCallback((user: User): Promise<Profile> => {
    const pending = profileRequestRef.current
    if (pending && pending.userId === user.id) return pending.promise

    let promise: Promise<Profile>
    promise = ensureProfile(user).finally(() => {
      if (profileRequestRef.current?.promise === promise) {
        profileRequestRef.current = null
      }
    })
    profileRequestRef.current = { userId: user.id, promise }
    return promise
  }, [])

  const reset = useCallback(() => {
    sequenceRef.current += 1
    currentUserIdRef.current = null
    profileRequestRef.current = null
    initialHandledRef.current = true
    setSession(null)
    setProfile(null)
    setStats(null)
    setLoading(false)
    setStatsLoading(false)
    setProfileError(null)
    setStatsError(null)
    setAuthNotice(null)
  }, [])

  const hydrate = useCallback(
    async (nextSession: Session, initial: boolean) => {
      const sequence = ++sequenceRef.current
      currentUserIdRef.current = nextSession.user.id
      setSession(nextSession)
      setProfileError(null)
      if (initial) setLoading(true)

      try {
        const nextProfile = await loadProfileOnce(nextSession.user)
        if (sequence !== sequenceRef.current) return
        setProfile(nextProfile)

        setStatsLoading(true)
        try {
          const nextStats = await getMyStats()
          if (sequence === sequenceRef.current) {
            setStats(nextStats)
            setStatsError(null)
          }
        } catch (error) {
          if (sequence === sequenceRef.current) {
            setStats(null)
            setStatsError(toFrenchError(error))
          }
        } finally {
          if (sequence === sequenceRef.current) setStatsLoading(false)
        }
      } catch (error) {
        if (sequence === sequenceRef.current) {
          setProfile(null)
          setProfileError(toFrenchError(error))
        }
      } finally {
        if (sequence === sequenceRef.current) setLoading(false)
      }
    },
    [loadProfileOnce],
  )

  const handleInitialSession = useCallback(
    (nextSession: Session | null) => {
      if (initialHandledRef.current) return
      initialHandledRef.current = true
      if (nextSession) {
        void hydrate(nextSession, true)
      } else {
        reset()
      }
    },
    [hydrate, reset],
  )

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined

    try {
      const client = getSupabase()
      const { data } = client.auth.onAuthStateChange((event, nextSession) => {
        if (!active) return

        if (event === 'INITIAL_SESSION') {
          handleInitialSession(nextSession)
          return
        }
        if (event === 'SIGNED_OUT') {
          reset()
          return
        }
        if (!nextSession) {
          reset()
          return
        }
        if (event === 'TOKEN_REFRESHED') {
          setSession(nextSession)
          return
        }
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (!initialHandledRef.current) {
            handleInitialSession(nextSession)
          } else {
            void hydrate(nextSession, false)
          }
        }
      })
      unsubscribe = () => data.subscription.unsubscribe()

      client.auth
        .getSession()
        .then(({ data: sessionData, error }) => {
          if (!active) return
          if (error) {
            reset()
            return
          }
          handleInitialSession(sessionData.session)
        })
        .catch(() => {
          if (active) reset()
        })
    } catch (error) {
      setProfileError(toFrenchError(error))
      setLoading(false)
    }

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [handleInitialSession, hydrate, reset])

  const refreshProfile = useCallback(async () => {
    try {
      const { data, error } = await getSupabase().auth.getSession()
      if (error) throw error
      const currentUser = data.session?.user
      if (!currentUser) {
        reset()
        return
      }
      const nextProfile = await loadProfileOnce(currentUser)
      setProfile(nextProfile)
      setProfileError(null)
    } catch (error) {
      setProfileError(toFrenchError(error))
    }
  }, [loadProfileOnce, reset])

  const refreshStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const nextStats = await getMyStats()
      setStats(nextStats)
      setStatsError(null)
    } catch (error) {
      setStatsError(toFrenchError(error))
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const signInWithGitHub = useCallback(async (): Promise<AuthResult> => {
    setAuthNotice(null)
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin },
      })
      return { error: error ? toFrenchError(error) : null }
    } catch (error) {
      return { error: toFrenchError(error) }
    }
  }, [])

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      return { error: error ? toFrenchError(error) : null }
    } catch (error) {
      return { error: toFrenchError(error) }
    }
  }, [])

  const signInWithEmail = useCallback(
    async (email: string): Promise<AuthResult> => {
      const value = email.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { error: 'Cette adresse email n’est pas valide.' }
      }
      try {
        const { error } = await getSupabase().auth.signInWithOtp({
          email: value,
          options: { emailRedirectTo: window.location.origin },
        })
        return { error: error ? toFrenchError(error) : null }
      } catch (error) {
        return { error: toFrenchError(error) }
      }
    },
    [],
  )

  const signInAnonymously = useCallback(async (): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.signInAnonymously()
      return { error: error ? GUEST_SIGN_IN_ERROR : null }
    } catch {
      return { error: GUEST_SIGN_IN_ERROR }
    }
  }, [])

  const signOut = useCallback(async (): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.signOut()
      if (error) return { error: toFrenchError(error) }
      reset()
      return { error: null }
    } catch (error) {
      return { error: toFrenchError(error) }
    }
  }, [reset])

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        isGuest: isGuestUser(session?.user),
        authNotice,
        setAuthNotice,
        stats,
        statsLoading,
        profileError,
        statsError,
        signInWithGitHub,
        signInWithGoogle,
        signInWithEmail,
        signInAnonymously,
        signOut,
        refreshProfile,
        refreshStats,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider.')
  }
  return context
}
