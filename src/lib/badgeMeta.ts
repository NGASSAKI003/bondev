import type { Lang } from '../i18n'
import type {
  BadgeFamily,
  BadgeTier,
  CommunityBadgeId,
  QuestMissionId,
} from './progress'

// Libellés et seuils partagés par les écrans de progression.

export type BadgeFamilyMeta = {
  label: { fr: string; en: string }
  singular: { fr: string; en: string }
  plural: { fr: string; en: string }
  icon: string
}

export const BADGE_FAMILY_META: Record<BadgeFamily, BadgeFamilyMeta> = {
  help: {
    label: { fr: 'Entraide', en: 'Helping' },
    singular: { fr: 'réponse validée', en: 'validated answer' },
    plural: { fr: 'réponses validées', en: 'validated answers' },
    icon: 'handshake',
  },
  share: {
    label: { fr: 'Partage', en: 'Sharing' },
    singular: { fr: 'projet partagé', en: 'shared project' },
    plural: { fr: 'projets partagés', en: 'shared projects' },
    icon: 'code',
  },
  useful: {
    label: { fr: 'Utilité', en: 'Usefulness' },
    singular: { fr: '« Ça m’a servi » reçu', en: '“This helped me” received' },
    plural: { fr: '« Ça m’a servi » reçus', en: '“This helped me” received' },
    icon: 'star',
  },
  streak: {
    label: { fr: 'Série', en: 'Streak' },
    singular: { fr: 'semaine', en: 'week' },
    plural: { fr: 'semaines', en: 'weeks' },
    icon: 'flame',
  },
}

export const TIER_LABELS: Record<BadgeTier, { fr: string; en: string }> = {
  bronze: { fr: 'Bronze', en: 'Bronze' },
  silver: { fr: 'Argent', en: 'Silver' },
  gold: { fr: 'Or', en: 'Gold' },
}

export const COMMUNITY_META: Record<
  CommunityBadgeId,
  { title: { fr: string; en: string }; description: { fr: string; en: string }; icon: string }
> = {
  first_answer: {
    title: { fr: 'Première réponse', en: 'First answer' },
    description: {
      fr: 'Tu as publié ta première réponse.',
      en: 'You posted your first answer.',
    },
    icon: 'trophy',
  },
  new_voice: {
    title: { fr: 'Nouvelle voix', en: 'New voice' },
    description: {
      fr: 'Tu as répondu à une question « débutant bienvenu ».',
      en: 'You answered a “beginners welcome” question.',
    },
    icon: 'help',
  },
  kind: {
    title: { fr: 'Bienveillant', en: 'Kind' },
    description: {
      fr: '3 réponses à des questions « débutant bienvenu ».',
      en: '3 answers to “beginners welcome” questions.',
    },
    icon: 'handshake',
  },
}

export const QUEST_META: Record<
  QuestMissionId,
  { label: { fr: string; en: string }; icon: string }
> = {
  answer_beginner: {
    label: {
      fr: 'Répondre à une question débutant',
      en: 'Answer a beginner question',
    },
    icon: 'help',
  },
  publish_project: {
    label: { fr: 'Publier un projet', en: 'Publish a project' },
    icon: 'code',
  },
  mark_useful: {
    label: {
      fr: 'Dire « Ça m’a servi »',
      en: 'Say “This helped me”',
    },
    icon: 'star',
  },
}

export function familyLabel(family: BadgeFamily, lang: Lang): string {
  return BADGE_FAMILY_META[family].label[lang]
}

export function tierName(tier: BadgeTier, lang: Lang): string {
  return TIER_LABELS[tier][lang]
}

export function unitFor(
  family: BadgeFamily,
  count: number,
  lang: Lang,
): string {
  const meta = BADGE_FAMILY_META[family]
  return count === 1 ? meta.singular[lang] : meta.plural[lang]
}

export function questLabel(id: QuestMissionId, lang: Lang): string {
  return QUEST_META[id].label[lang]
}
