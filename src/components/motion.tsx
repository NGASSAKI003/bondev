import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { counterValue, MOTION, motionEnabled } from '../lib/motion'

/**
 * Compteur de points animé. Il ne compte que lorsqu'une valeur arrive ou
 * change : un écran qui remonte avec les mêmes données n'affiche pas une
 * nouvelle fois l'animation.
 */
export function AnimatedNumber({
  value,
  duration = MOTION.counter,
  className,
}: {
  value: number | null
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState<number | null>(value)
  const displayRef = useRef<number | null>(value)
  const frameRef = useRef(0)

  useEffect(() => {
    window.cancelAnimationFrame(frameRef.current)

    if (value === null || !Number.isFinite(value)) {
      displayRef.current = null
      setDisplay(null)
      return
    }

    const from = displayRef.current ?? 0
    if (!motionEnabled() || from === value) {
      displayRef.current = value
      setDisplay(value)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      if (elapsed >= duration) {
        displayRef.current = value
        setDisplay(value)
        return
      }
      const next = Math.round(counterValue(from, value, elapsed, duration))
      displayRef.current = next
      setDisplay(next)
      frameRef.current = window.requestAnimationFrame(tick)
    }
    frameRef.current = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return (
    <span className={`motion-number ${className ?? ''}`.trim()}>
      {display === null ? '—' : display}
    </span>
  )
}

/**
 * Solde vivant : compteur + puce flottante « +3 » / « −1 ». La puce est
 * décorative (aria-hidden) et disparaît d'elle-même après 950 ms.
 */
export function LivePoints({
  value,
  suffix,
  className,
}: {
  value: number | null
  suffix?: ReactNode
  className?: string
}) {
  const previous = useRef<number | null>(null)
  const [delta, setDelta] = useState<{ amount: number; key: number } | null>(
    null,
  )

  useEffect(() => {
    if (value === null || !Number.isFinite(value)) {
      previous.current = null
      return
    }
    const before = previous.current
    previous.current = value
    if (before === null || before === value) return
    setDelta({ amount: value - before, key: Date.now() })
  }, [value])

  useEffect(() => {
    if (!delta) return
    const timer = window.setTimeout(() => setDelta(null), 950)
    return () => window.clearTimeout(timer)
  }, [delta])

  return (
    <span className={`live-points ${className ?? ''}`.trim()}>
      <AnimatedNumber value={value} />
      {suffix}
      {delta && (
        <span
          key={delta.key}
          className={`points-delta ${delta.amount >= 0 ? 'up' : 'down'}`}
          aria-hidden="true"
        >
          {delta.amount > 0 ? '+' : ''}
          {delta.amount}
        </span>
      )}
    </span>
  )
}

/** Propriété CSS d'une barre remplie par transform: scaleX(). */
export function barStyle(percent: number): CSSProperties {
  const safe = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0))
  return { '--bar': String(safe / 100) } as CSSProperties
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  spin: number
  color: string
  shape: 'rect' | 'circle'
  life: number
}

const CONFETTI_COLORS = ['#1EA7FF', '#2F6BFF', '#7B3FF2', '#FFD479', '#38D996']

/**
 * Confettis sobres : 40 particules maximum, canvas maison, aucun appel réseau.
 * Le canvas s'arrête et se nettoie après 1,5 s. Il n'est jamais monté quand le
 * mouvement est coupé (Économie de données ou prefers-reduced-motion).
 */
export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!motionEnabled()) return
    if (document.documentElement.dataset.effects === 'light') return
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    const originX = width / 2
    const originY = Math.min(height * 0.38, 320)
    const particles: Particle[] = Array.from({ length: 40 }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9
      const speed = 0.22 + Math.random() * 0.34
      return {
        x: originX + (Math.random() - 0.5) * 36,
        y: originY + (Math.random() - 0.5) * 18,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.014,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        shape: index % 3 === 0 ? 'circle' : 'rect',
        life: 1,
      }
    })

    const startedAt = performance.now()
    let frame = 0

    const stop = () => {
      window.cancelAnimationFrame(frame)
      context.clearRect(0, 0, width, height)
    }

    const draw = (now: number) => {
      const elapsed = now - startedAt
      if (
        elapsed >= 1500 ||
        document.documentElement.dataset.saver === 'on'
      ) {
        stop()
        return
      }

      context.clearRect(0, 0, width, height)
      const fade = elapsed > 1000 ? 1 - (elapsed - 1000) / 500 : 1

      for (const particle of particles) {
        // Légère gravité, exprimée en pixels par milliseconde.
        particle.vy += 0.00052 * 16.67
        particle.x += particle.vx * 16.67
        particle.y += particle.vy * 16.67
        particle.rotation += particle.spin * 16.67
        particle.life = Math.max(0, fade)

        if (particle.life <= 0) continue
        context.save()
        context.globalAlpha = particle.life * 0.9
        context.translate(particle.x, particle.y)
        context.rotate(particle.rotation)
        context.fillStyle = particle.color
        if (particle.shape === 'circle') {
          context.beginPath()
          context.arc(0, 0, particle.size / 2, 0, Math.PI * 2)
          context.fill()
        } else {
          context.fillRect(
            -particle.size / 2,
            -particle.size / 4,
            particle.size,
            particle.size / 2,
          )
        }
        context.restore()
      }
      frame = window.requestAnimationFrame(draw)
    }

    frame = window.requestAnimationFrame(draw)
    return stop
  }, [])

  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />
}
