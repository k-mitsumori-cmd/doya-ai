'use client'

// リニューアル案で使う動きの部品。
// 参考: 画面に入った要素へ data-in を付けて CSS 側で動かす（JS は発火だけ）。
// prefers-reduced-motion では CSS 側で全アニメーションを止める。
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import s from './renewal.module.css'

const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 4)

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** root 配下の [data-reveal] が画面に入ったら data-in を付ける
 *  （className は React が再描画で上書きするので、クラスではなく属性で印を付ける） */
export function useReveal<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.setAttribute('data-in', ''))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.setAttribute('data-in', '')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    targets.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

/** 要素が一度でも画面に入ったか */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, seen] as const
}

/** 0 から value まで数え上げる */
export function CountUp({
  value,
  decimals = 0,
  duration = 1600,
  start = true,
  delay = 0,
}: {
  value: number
  decimals?: number
  duration?: number
  start?: boolean
  delay?: number
}) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!start) return
    if (prefersReducedMotion()) {
      setN(value)
      return
    }
    let raf = 0
    const from = performance.now() + delay
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - from) / duration))
      setN(value * EASE_OUT(t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, start, delay])
  return (
    <span className={s.num}>
      {n.toLocaleString('ja-JP', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  )
}

/** 見出しを1文字ずつ下からせり上げる */
export function SplitText({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={`${s.split} ${className ?? ''}`} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span key={i} className={s.chWrap} aria-hidden="true">
          <span className={s.ch} style={{ '--i': i, '--d0': `${delay}ms` } as CSSProperties}>
            {ch === ' ' ? ' ' : ch}
          </span>
        </span>
      ))}
    </span>
  )
}

/** 円形ゲージ（stroke-dashoffset で描く） */
export function Ring({
  value,
  max = 100,
  size = 88,
  stroke = 8,
  color = '#0066ff',
  track = 'var(--track)',
  start = true,
  children,
}: {
  value: number
  max?: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  start?: boolean
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = Math.max(0, Math.min(1, value / max))
  return (
    <span className={s.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: track }} strokeWidth={stroke} />
        <circle
          className={s.ringArc}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={start ? c * (1 - ratio) : c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className={s.ringLabel}>{children}</span>
    </span>
  )
}

/** 数字が1桁ずつ回って止まる（Stripe のダッシュボード風） */
export function Odometer({ value, decimals = 0, start = true }: { value: number; decimals?: number; start?: boolean }) {
  const text = value.toFixed(decimals)
  const digits = '01234567890123456789'.split('')
  return (
    <span className={s.odo} aria-label={text} role="text">
      {Array.from(text).map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className={s.odoCol} aria-hidden="true">
            <span className={s.odoStrip} style={{ '--n': start ? Number(ch) + 10 : 0, '--i': i } as CSSProperties}>
              {digits.map((d, j) => (
                <span key={j}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </span>
  )
}
