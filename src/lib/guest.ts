/**
 * Logique pure du mode invité.
 *
 * Un invité est un utilisateur Supabase anonyme. Son pseudo commence par
 * `invite_` suivi de 6 caractères aléatoires, ce qui respecte la contrainte
 * `^[a-zA-Z0-9_-]{3,30}$` de la table `profiles`.
 */

export const GUEST_PSEUDO_PREFIX = 'invite_'
export const GUEST_SUFFIX_LENGTH = 6
export const GUEST_DISPLAY_NAME = 'Invité'
export const GUEST_PSEUDO_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/
export const GUEST_SIGN_IN_ERROR =
  "Le mode invité est indisponible pour l'instant, connecte-toi avec GitHub"
export const GUEST_BANNER_TEXT =
  'Tu es en mode invité. Crée un compte GitHub pour garder tes points et publier un projet.'
export const GUEST_UPGRADE_LABEL = 'Se connecter avec GitHub'
export const GUEST_UPGRADE_CONFIRM =
  'Tes données d’invité (points, questions et réponses) seront perdues. Continuer avec GitHub ?'
export const GUEST_SHARE_EXPLANATION =
  'Les invités ne peuvent pas publier de projet. Crée un compte GitHub pour partager ton travail.'
export const GUEST_USED_EXPLANATION =
  'Les invités ne peuvent pas dire « Ça m’a servi ». Crée un compte GitHub pour soutenir les projets.'

const GUEST_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const BANNER_STORAGE_PREFIX = 'bondev-guest-banner'

/** Vrai si le compte Supabase est anonyme (invité). */
export function isGuestUser(
  user: { is_anonymous?: boolean } | null | undefined,
): boolean {
  return user?.is_anonymous === true
}

/** Tire 6 caractères alphanumériques, avec une fonction aléatoire injectable. */
export function randomGuestSuffix(random: () => number = Math.random): string {
  let suffix = ''
  for (let index = 0; index < GUEST_SUFFIX_LENGTH; index += 1) {
    const value = Math.min(Math.max(random(), 0), 0.999999999)
    const character =
      GUEST_ALPHABET[Math.floor(value * GUEST_ALPHABET.length)] ?? 'a'
    suffix += character
  }
  return suffix
}

/** Construit un pseudo invité valide : `invite_` + 6 caractères. */
export function generateGuestPseudo(random: () => number = Math.random): string {
  return `${GUEST_PSEUDO_PREFIX}${randomGuestSuffix(random)}`
}

/** Vérifie le format exact d'un pseudo généré pour un invité. */
export function isGuestPseudo(value: string): boolean {
  return /^invite_[a-z0-9]{6}$/.test(value)
}

/**
 * Décision d'affichage de la bannière : seulement pour un invité qui ne l'a
 * pas encore fermée.
 */
export function shouldShowGuestBanner({
  isAnonymous,
  dismissed,
}: {
  isAnonymous: boolean
  dismissed: boolean
}): boolean {
  return isAnonymous && !dismissed
}

export function guestBannerKey(userId: string): string {
  return `${BANNER_STORAGE_PREFIX}:${userId}`
}

export function readGuestBannerDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(guestBannerKey(userId)) === '1'
  } catch {
    return false
  }
}

export function writeGuestBannerDismissed(userId: string): void {
  try {
    localStorage.setItem(guestBannerKey(userId), '1')
  } catch {
    // La bannière reste simplement visible si le stockage est bloqué.
  }
}
