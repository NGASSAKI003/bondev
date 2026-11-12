import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FRAME_PROBE_MS,
  normaliseEffectsPreference,
  readEffectsPreference,
  summariseFrames,
  type FrameSummary,
} from '../lib/effects'

/**
 * Page de diagnostic non liée dans l'interface.
 *
 * Elle ne fait aucun appel réseau : toutes les valeurs viennent de l'API du
 * navigateur. Le rapport copié ne contient que des mesures techniques.
 */

type SafeAreas = {
  top: string
  right: string
  bottom: string
  left: string
}

type Snapshot = {
  innerWidth: number
  innerHeight: number
  visualWidth: number | null
  visualHeight: number | null
  visualOffsetTop: number | null
  visualScale: number | null
  dpr: number
  screenWidth: number
  screenHeight: number
  screenAvailWidth: number
  screenAvailHeight: number
  safeAreas: SafeAreas
  userAgent: string
  deviceMemory: number | null
  hardwareConcurrency: number | null
  saveData: boolean | null
  connectionType: string | null
  downlink: number | null
  rtt: number | null
  effectsMode: 'full' | 'light'
  effectsPreference: string
  displayMode: string
  viewTransitions: boolean
  backdropFilter: boolean
  contentVisibility: boolean
}

type LongTaskSummary = {
  supported: boolean
  count: number
  total: number
  max: number
}

type ExtendedNavigator = Navigator & {
  deviceMemory?: number
  connection?: {
    saveData?: boolean
    effectiveType?: string
    downlink?: number
    rtt?: number
  }
}

type ExtendedDocument = Document & {
  startViewTransition?: unknown
}

function supports(property: string, value: string): boolean {
  try {
    return CSS.supports(property, value)
  } catch {
    return false
  }
}

function readSafeAreas(): SafeAreas {
  const probe = document.createElement('div')
  probe.className = 'safe-probe'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const areas = {
    top: style.paddingTop || '0px',
    right: style.paddingRight || '0px',
    bottom: style.paddingBottom || '0px',
    left: style.paddingLeft || '0px',
  }
  probe.remove()
  return areas
}

function displayMode(): string {
  const modes = ['standalone', 'fullscreen', 'minimal-ui', 'browser']
  for (const mode of modes) {
    if (window.matchMedia?.(`(display-mode: ${mode})`).matches) return mode
  }
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone
  return ios === true ? 'standalone' : 'browser'
}

function snapshot(): Snapshot {
  const nav = navigator as ExtendedNavigator
  const viewport = window.visualViewport
  const preference = readEffectsPreference(
    typeof localStorage === 'undefined' ? null : localStorage,
  )
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    visualWidth: viewport?.width ?? null,
    visualHeight: viewport?.height ?? null,
    visualOffsetTop: viewport?.offsetTop ?? null,
    visualScale: viewport?.scale ?? null,
    dpr: window.devicePixelRatio || 1,
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
    screenAvailWidth: window.screen?.availWidth ?? 0,
    screenAvailHeight: window.screen?.availHeight ?? 0,
    safeAreas: readSafeAreas(),
    userAgent: nav.userAgent,
    deviceMemory: nav.deviceMemory ?? null,
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    saveData: nav.connection?.saveData ?? null,
    connectionType: nav.connection?.effectiveType ?? null,
    downlink: nav.connection?.downlink ?? null,
    rtt: nav.connection?.rtt ?? null,
    effectsMode:
      document.documentElement.dataset.effects === 'light' ? 'light' : 'full',
    effectsPreference: normaliseEffectsPreference(preference),
    displayMode: displayMode(),
    viewTransitions:
      typeof (document as ExtendedDocument).startViewTransition === 'function',
    backdropFilter:
      supports('backdrop-filter', 'blur(1px)') ||
      supports('-webkit-backdrop-filter', 'blur(1px)'),
    contentVisibility: supports('content-visibility', 'auto'),
  }
}

function formatNumber(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return 'non mesuré'
  return value.toFixed(digits)
}

function safeLabel(value: string): string {
  return value && value !== '0px' ? value : '0 px'
}

function modeLabel(mode: string): string {
  return mode === 'light' ? 'léger' : 'complet'
}

function buildReport(
  data: Snapshot,
  frames: FrameSummary | null,
  tasks: LongTaskSummary | null,
): string {
  const lines = [
    'RAPPORT DE DIAGNOSTIC BONDEV',
    '',
    'Dimensions',
    `- Fenêtre : ${data.innerWidth} × ${data.innerHeight} px`,
    `- visualViewport : ${
      data.visualWidth === null || data.visualHeight === null
        ? 'non disponible'
        : `${formatNumber(data.visualWidth)} × ${formatNumber(data.visualHeight)} px`
    }`,
    `- visualViewport offset / échelle : ${formatNumber(data.visualOffsetTop)} px / ${formatNumber(data.visualScale, 2)}`,
    `- devicePixelRatio : ${formatNumber(data.dpr, 2)}`,
    `- Écran : ${data.screenWidth} × ${data.screenHeight} px (disponible ${data.screenAvailWidth} × ${data.screenAvailHeight})`,
    `- Safe areas (env) : haut ${safeLabel(data.safeAreas.top)}, droite ${safeLabel(data.safeAreas.right)}, bas ${safeLabel(data.safeAreas.bottom)}, gauche ${safeLabel(data.safeAreas.left)}`,
    '',
    'Appareil et réseau',
    `- User agent : ${data.userAgent}`,
    `- deviceMemory : ${data.deviceMemory === null ? 'non disponible' : `${data.deviceMemory} Go`}`,
    `- hardwareConcurrency : ${data.hardwareConcurrency === null ? 'non disponible' : data.hardwareConcurrency}`,
    `- saveData : ${data.saveData === null ? 'non disponible' : data.saveData ? 'oui' : 'non'}`,
    `- Connexion : ${data.connectionType ?? 'non disponible'} / downlink ${data.downlink === null ? '—' : `${data.downlink} Mb/s`} / RTT ${data.rtt === null ? '—' : `${data.rtt} ms`}`,
    '',
    'Affichage et effets',
    `- Mode d’effets actif : ${modeLabel(data.effectsMode)}`,
    `- Préférence mémorisée : ${data.effectsPreference}`,
    `- display-mode : ${data.displayMode}`,
    `- View Transitions : ${data.viewTransitions ? 'prise en charge' : 'non prise en charge'}`,
    `- backdrop-filter : ${data.backdropFilter ? 'pris en charge' : 'non pris en charge'}`,
    `- content-visibility : ${data.contentVisibility ? 'prise en charge' : 'non prise en charge'}`,
    '',
    'Test de frames',
    frames
      ? `- Durée : ${FRAME_PROBE_MS / 1000} s · ${frames.count} frames mesurées`
      : '- Test non effectué',
    frames ? `- Médiane : ${formatNumber(frames.median)} ms` : '',
    frames ? `- p95 : ${formatNumber(frames.p95)} ms` : '',
    frames ? `- Frames > 50 ms : ${frames.over50}` : '',
    tasks
      ? tasks.supported
        ? `- Tâches longues : ${tasks.count} · total ${formatNumber(tasks.total, 0)} ms · max ${formatNumber(tasks.max, 0)} ms`
        : '- Tâches longues : non observables sur ce navigateur'
      : '',
    '',
    'Aucun appel réseau et aucune donnée personnelle dans ce rapport.',
  ]
  return lines.filter((line) => line !== '').join('\n')
}

function measureFrames(
  durationMs: number,
): Promise<{ frames: FrameSummary; tasks: LongTaskSummary }> {
  return new Promise((resolve) => {
    const durations: number[] = []
    let previous: number | null = null
    let skipped = 0
    let frame = 0
    let stopped = false
    let longTasks = { count: 0, total: 0, max: 0 }
    let observer: PerformanceObserver | null = null
    let supported = false

    try {
      if (typeof PerformanceObserver !== 'undefined') {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longTasks = {
              count: longTasks.count + 1,
              total: longTasks.total + entry.duration,
              max: Math.max(longTasks.max, entry.duration),
            }
          }
        })
        observer.observe({ entryTypes: ['longtask'] })
        supported = true
      }
    } catch {
      observer = null
    }

    const finish = () => {
      if (stopped) return
      stopped = true
      window.cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
      resolve({
        frames: summariseFrames(durations),
        tasks: { ...longTasks, supported },
      })
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') finish()
    }

    const startedAt = performance.now()
    const tick = (now: number) => {
      if (document.visibilityState !== 'visible') {
        finish()
        return
      }
      if (previous !== null) {
        if (skipped < 2) skipped += 1
        else durations.push(now - previous)
      }
      previous = now
      if (now - startedAt >= durationMs) {
        finish()
        return
      }
      frame = window.requestAnimationFrame(tick)
    }

    document.addEventListener('visibilitychange', onVisibility)
    frame = window.requestAnimationFrame(tick)
  })
}

export function Diagnostic() {
  const [data, setData] = useState<Snapshot>(() => snapshot())
  const [frames, setFrames] = useState<FrameSummary | null>(null)
  const [tasks, setTasks] = useState<LongTaskSummary | null>(null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [report, setReport] = useState('')
  const started = useRef(false)

  // La page reste hors index même si elle est ouverte directement.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    meta.dataset.diagnostic = 'true'
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])

  const runTest = useCallback(async () => {
    setRunning(true)
    setCopied('idle')
    const result = await measureFrames(3000)
    setFrames(result.frames)
    setTasks(result.tasks)
    setRunning(false)
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true
    const timer = window.setTimeout(() => void runTest(), 350)
    return () => window.clearTimeout(timer)
  }, [runTest])

  useEffect(() => {
    let frame = 0
    const refresh = () => {
      frame = 0
      setData(snapshot())
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(refresh)
    }
    window.addEventListener('resize', schedule, { passive: true })
    window.visualViewport?.addEventListener('resize', schedule, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [])

  const copyReport = async () => {
    const text = buildReport(data, frames, tasks)
    setReport(text)
    try {
      await navigator.clipboard.writeText(text)
      setCopied('copied')
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand?.('copy')
      area.remove()
      setCopied(ok ? 'copied' : 'failed')
    }
  }

  const rows: [string, string][] = [
    ['Fenêtre', `${data.innerWidth} × ${data.innerHeight} px`],
    [
      'visualViewport',
      data.visualWidth === null || data.visualHeight === null
        ? 'non disponible'
        : `${formatNumber(data.visualWidth)} × ${formatNumber(data.visualHeight)} px`,
    ],
    [
      'Décalage visuel',
      `${formatNumber(data.visualOffsetTop)} px · échelle ${formatNumber(data.visualScale, 2)}`,
    ],
    ['devicePixelRatio', formatNumber(data.dpr, 2)],
    [
      'Écran',
      `${data.screenWidth} × ${data.screenHeight} px · disponible ${data.screenAvailWidth} × ${data.screenAvailHeight}`,
    ],
    [
      'Safe areas',
      `haut ${safeLabel(data.safeAreas.top)} · droite ${safeLabel(data.safeAreas.right)} · bas ${safeLabel(data.safeAreas.bottom)} · gauche ${safeLabel(data.safeAreas.left)}`,
    ],
    ['User agent', data.userAgent],
    [
      'deviceMemory',
      data.deviceMemory === null ? 'non disponible' : `${data.deviceMemory} Go`,
    ],
    [
      'hardwareConcurrency',
      data.hardwareConcurrency === null
        ? 'non disponible'
        : String(data.hardwareConcurrency),
    ],
    [
      'saveData',
      data.saveData === null ? 'non disponible' : data.saveData ? 'oui' : 'non',
    ],
    [
      'Connexion',
      `${data.connectionType ?? 'non disponible'} · downlink ${data.downlink ?? '—'} Mb/s · RTT ${data.rtt ?? '—'} ms`,
    ],
    ['Mode d’effets actif', modeLabel(data.effectsMode)],
    ['Préférence mémorisée', data.effectsPreference],
    ['display-mode', data.displayMode],
    ['View Transitions', data.viewTransitions ? 'prise en charge' : 'non prise en charge'],
    ['backdrop-filter', data.backdropFilter ? 'pris en charge' : 'non pris en charge'],
    ['content-visibility', data.contentVisibility ? 'prise en charge' : 'non prise en charge'],
  ]

  return (
    <main className="screen diagnostic">
      <header className="diagnostic-head">
        <h1>Diagnostic</h1>
        <p>
          Mesures locales, sans réseau ni donnée personnelle. Page non indexée
          et non liée dans la navigation.
        </p>
      </header>

      <div className="diagnostic-actions">
        <button className="primary" type="button" onClick={() => void copyReport()}>
          {copied === 'copied'
            ? 'Rapport copié'
            : copied === 'failed'
              ? 'Copie impossible'
              : 'Copier le rapport'}
        </button>
        <button
          type="button"
          onClick={() => {
            setData(snapshot())
            void runTest()
          }}
          disabled={running}
        >
          {running ? 'Test en cours…' : 'Relancer le test'}
        </button>
      </div>

      <div className="diagnostic-grid">
        <section className="diagnostic-card">
          <h2>Dimensions et appareil</h2>
          <dl>
            {rows.slice(0, 11).map(([label, value]) => (
              <div key={label} style={{ display: 'contents' }}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="diagnostic-card">
          <h2>Affichage et effets</h2>
          <dl>
            {rows.slice(11).map(([label, value]) => (
              <div key={label} style={{ display: 'contents' }}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="diagnostic-card">
          <h2>Test de frames · 3 s</h2>
          <p className="diagnostic-status">
            {running
              ? 'Mesure en cours… garde cet onglet visible.'
              : frames
                ? `${frames.count} frames mesurées`
                : 'En attente de la mesure.'}
          </p>
          <dl>
            <div style={{ display: 'contents' }}>
              <dt>Médiane</dt>
              <dd>{frames ? `${formatNumber(frames.median)} ms` : '—'}</dd>
            </div>
            <div style={{ display: 'contents' }}>
              <dt>p95</dt>
              <dd>{frames ? `${formatNumber(frames.p95)} ms` : '—'}</dd>
            </div>
            <div style={{ display: 'contents' }}>
              <dt>Frames &gt; 50 ms</dt>
              <dd>{frames ? frames.over50 : '—'}</dd>
            </div>
            <div style={{ display: 'contents' }}>
              <dt>Tâches longues</dt>
              <dd>
                {!tasks
                  ? '—'
                  : tasks.supported
                    ? `${tasks.count} · total ${formatNumber(tasks.total, 0)} ms · max ${formatNumber(tasks.max, 0)} ms`
                    : 'non observables sur ce navigateur'}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {report && (
        <textarea
          className="diagnostic-report"
          readOnly
          value={report}
          aria-label="Rapport de diagnostic en français"
        />
      )}
    </main>
  )
}
