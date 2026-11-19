/**
 * Laboratoire de rendu de la page Diagnostic.
 *
 * Chaque interrupteur désactive une famille de CSS à risque sur un appareil
 * réel (GPU Mali/Adreno, navigateur Xiaomi). L'état est mémorisé dans le
 * stockage local et appliqué sur `<html>` par des attributs `data-lab-*`.
 * Le module reste pur : les lectures de stockage et de document sont
 * injectables, ce qui permet de le tester sous Node.
 */

export type RenderLabFlag =
  | 'gradientBorders'
  | 'shadows'
  | 'innerShine'
  | 'backgroundLayer'
  | 'grain'
  | 'blurs'
  | 'motion'
  | 'iconGradients'
  | 'containment'
  | 'viewTransitions'

export type RenderLabState = Record<RenderLabFlag, boolean>

export type RenderLabItem = {
  flag: RenderLabFlag
  attribute: string
  label: string
  detail: string
}

export const RENDER_LAB_STORAGE_KEY = 'bondev-render-lab'

/**
 * Les dix familles suivies par le laboratoire. L'ordre est celui de l'écran
 * Diagnostic et du rapport copié.
 */
export const RENDER_LAB_ITEMS: RenderLabItem[] = [
  {
    flag: 'gradientBorders',
    attribute: 'data-lab-gradient-borders',
    label: 'Bordures en dégradé',
    detail: 'mask, mask-composite, border-image',
  },
  {
    flag: 'shadows',
    attribute: 'data-lab-shadows',
    label: 'Ombres et lueurs',
    detail: 'box-shadow, text-shadow, drop-shadow',
  },
  {
    flag: 'innerShine',
    attribute: 'data-lab-inner-shine',
    label: 'Reflets intérieurs',
    detail: '::before et ::after de brillance des cartes',
  },
  {
    flag: 'backgroundLayer',
    attribute: 'data-lab-background-layer',
    label: 'Fond fixe et halos',
    detail: 'couche fixed et dégradés radiaux animés',
  },
  {
    flag: 'grain',
    attribute: 'data-lab-grain',
    label: 'Grain',
    detail: 'texture de bruit et mix-blend-mode',
  },
  {
    flag: 'blurs',
    attribute: 'data-lab-blurs',
    label: 'Flous',
    detail: 'backdrop-filter et filter',
  },
  {
    flag: 'motion',
    attribute: 'data-lab-motion',
    label: 'Animations et transitions',
    detail: 'keyframes, transitions et scroll-behavior',
  },
  {
    flag: 'iconGradients',
    attribute: 'data-lab-icon-gradients',
    label: 'Dégradés SVG des icônes',
    detail: 'fill et stroke url(#brand-gradient)',
  },
  {
    flag: 'containment',
    attribute: 'data-lab-containment',
    label: 'content-visibility et contain',
    detail: 'peinture différée des listes',
  },
  {
    flag: 'viewTransitions',
    attribute: 'data-lab-view-transitions',
    label: 'View Transitions',
    detail: 'document.startViewTransition',
  },
]

export function defaultRenderLabState(): RenderLabState {
  return {
    gradientBorders: true,
    shadows: true,
    innerShine: true,
    backgroundLayer: true,
    grain: true,
    blurs: true,
    motion: true,
    iconGradients: true,
    containment: true,
    viewTransitions: true,
  }
}

/** Lit l'état mémorisé ; toute valeur inconnue retombe sur « activé ». */
export function readRenderLabState(
  storage?: Pick<Storage, 'getItem'> | null,
): RenderLabState {
  const state = defaultRenderLabState()
  if (!storage) return state
  try {
    const raw = storage.getItem(RENDER_LAB_STORAGE_KEY)
    if (!raw) return state
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object') return state
    for (const item of RENDER_LAB_ITEMS) {
      const value = parsed[item.flag]
      if (typeof value === 'boolean') state[item.flag] = value
    }
  } catch {
    /* Stockage privé, saturé ou JSON invalide : état par défaut. */
  }
  return state
}

export function writeRenderLabState(
  state: RenderLabState,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  if (!storage) return
  try {
    storage.setItem(RENDER_LAB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* La session garde l'état courant même si l'écriture échoue. */
  }
}

/**
 * Pose les dix attributs sur `<html>`, toujours avec la valeur `on` ou `off`.
 * Les attributs absents (premier rendu, ancien état) valent « activé ».
 */
export function applyRenderLabState(
  state: RenderLabState,
  root?: HTMLElement | null,
): void {
  const target =
    root ??
    (typeof document === 'undefined' ? null : document.documentElement)
  if (!target) return
  for (const item of RENDER_LAB_ITEMS) {
    target.setAttribute(item.attribute, state[item.flag] ? 'on' : 'off')
  }
}

/** Vrai quand une famille a été coupée depuis la page Diagnostic. */
export function renderLabDisabled(
  flag: RenderLabFlag,
  root?: HTMLElement | null,
): boolean {
  if (flag === 'viewTransitions') return viewTransitionsDisabled(root)
  const target =
    root ??
    (typeof document === 'undefined' ? null : document.documentElement)
  if (!target) return false
  const item = RENDER_LAB_ITEMS.find((entry) => entry.flag === flag)
  if (!item) return false
  return target.getAttribute(item.attribute) === 'off'
}

/** Vérifié avant chaque navigation : une View Transition peut être coupée. */
export function viewTransitionsDisabled(
  root?: HTMLElement | null,
): boolean {
  const target =
    root ??
    (typeof document === 'undefined' ? null : document.documentElement)
  if (!target) return false
  return target.getAttribute('data-lab-view-transitions') === 'off'
}

/** Lignes ajoutées au rapport copié depuis la page Diagnostic. */
export function renderLabReportLines(state: RenderLabState): string[] {
  return RENDER_LAB_ITEMS.map(
    (item) =>
      `- ${item.label} : ${state[item.flag] ? 'activé' : 'désactivé'}`,
  )
}
