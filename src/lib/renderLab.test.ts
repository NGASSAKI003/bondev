import { describe, expect, it } from 'vitest'
import {
  RENDER_LAB_ITEMS,
  RENDER_LAB_STORAGE_KEY,
  applyRenderLabState,
  defaultRenderLabState,
  readRenderLabState,
  renderLabDisabled,
  renderLabReportLines,
  viewTransitionsDisabled,
  writeRenderLabState,
  type RenderLabState,
} from './renderLab'

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

function fakeRoot() {
  const attributes = new Map<string, string>()
  return {
    setAttribute: (name: string, value: string) => {
      attributes.set(name, value)
    },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    attributes,
  } as unknown as HTMLElement & { attributes: Map<string, string> }
}

describe('laboratoire de rendu — état', () => {
  it('active les dix familles par défaut', () => {
    const state = defaultRenderLabState()
    expect(Object.values(state).every(Boolean)).toBe(true)
    expect(RENDER_LAB_ITEMS).toHaveLength(10)
  })

  it('relit un état valide et ignore les valeurs inconnues', () => {
    const state = readRenderLabState(
      storage({
        [RENDER_LAB_STORAGE_KEY]: JSON.stringify({
          shadows: false,
          grain: false,
          viewTransitions: 'non',
          inconnu: true,
        }),
      }),
    )
    expect(state.shadows).toBe(false)
    expect(state.grain).toBe(false)
    expect(state.viewTransitions).toBe(true)
    expect(state.blurs).toBe(true)
  })

  it('retombe sur les valeurs par défaut si le stockage est illisible', () => {
    expect(
      readRenderLabState(storage({ [RENDER_LAB_STORAGE_KEY]: '{oops' })),
    ).toEqual(defaultRenderLabState())
    expect(
      readRenderLabState({
        getItem: () => {
          throw new Error('bloqué')
        },
      }),
    ).toEqual(defaultRenderLabState())
  })

  it('écrit puis relit le même état', () => {
    const store = storage()
    const state: RenderLabState = {
      ...defaultRenderLabState(),
      blurs: false,
      motion: false,
    }
    writeRenderLabState(state, store)
    expect(readRenderLabState(store)).toEqual(state)
  })
})

describe('laboratoire de rendu — attributs', () => {
  it('pose toujours les dix attributs on/off', () => {
    const root = fakeRoot()
    applyRenderLabState(
      { ...defaultRenderLabState(), gradientBorders: false },
      root,
    )
    expect(root.attributes.size).toBe(10)
    expect(root.getAttribute('data-lab-gradient-borders')).toBe('off')
    expect(root.getAttribute('data-lab-shadows')).toBe('on')
  })

  it('reconnaît une famille coupée', () => {
    const root = fakeRoot()
    applyRenderLabState(
      { ...defaultRenderLabState(), viewTransitions: false, grain: false },
      root,
    )
    expect(renderLabDisabled('grain', root)).toBe(true)
    expect(renderLabDisabled('shadows', root)).toBe(false)
    expect(viewTransitionsDisabled(root)).toBe(true)
  })

  it('laisse tout actif quand les attributs sont absents', () => {
    const root = fakeRoot()
    expect(renderLabDisabled('blurs', root)).toBe(false)
    expect(viewTransitionsDisabled(root)).toBe(false)
  })
})

describe('laboratoire de rendu — rapport', () => {
  it('liste les dix interrupteurs avec leur état', () => {
    const lines = renderLabReportLines({
      ...defaultRenderLabState(),
      iconGradients: false,
    })
    expect(lines).toHaveLength(10)
    expect(lines.join('\n')).toContain('Dégradés SVG des icônes : désactivé')
    expect(lines.join('\n')).toContain('Bordures en dégradé : activé')
  })
})
