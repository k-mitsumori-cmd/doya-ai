'use client'
// ============================================
// ds/motion — 動きの部品（UI 品質 A-1）
// ============================================
// - 画面に入ったときに1回だけ動く（IntersectionObserver）
// - 動きを減らす設定（prefers-reduced-motion）では、最初から最後の形で出す
// - 数字は等幅（tabular-nums）。動いている間も桁がぶれない
// ⚠️ 数字やデータは props で受け取るだけ。ここで取得しない。
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './motion.module.css'

/** 動きを減らす設定か */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}

/** 要素が画面に入ったら true（一度 true になったら戻らない） */
export function useInViewOnce<T extends Element>(rootMargin = '0px 0px -10% 0px') {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect() }
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [seen, rootMargin])
  return { ref, seen }
}

/**
 * スクリプトが動いたら true（初めの描画では false）。
 * 隠してから見せる動きは、これが true のときだけ隠す。スクリプトが動かない環境では、最初から見える（F-12）
 */
export function useArmed(): boolean {
  const [armed, setArmed] = useState(false)
  useEffect(() => setArmed(true), [])
  return armed
}

/** start が true になってから ms が過ぎたら true。アニメーションが止まる環境でも、最後の形に移すため（F-12） */
export function useDoneAfter(start: boolean, ms: number): boolean {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!start || done) return
    const t = setTimeout(() => setDone(true), ms)
    return () => clearTimeout(t)
  }, [start, ms, done])
  return done
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/**
 * 数字のカウントアップ。値が変わったときは、今の表示から新しい値へ動く。
 * 例: <CountUp value={2650000} format={(n) => `${Math.round(n / 10000)}万円`} />
 */
export function CountUp({ value, duration = 900, format, className }: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const { ref, seen } = useInViewOnce<HTMLSpanElement>()
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (!seen) return
    if (reduced) { setShown(value); from.current = value; return }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const v = a + (value - a) * easeOutExpo(t)
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seen, value, duration, reduced])
  const text = format ? format(shown) : Math.round(shown).toLocaleString('ja-JP')
  return (
    <span ref={ref} className={`${styles.num} ${className ?? ''}`} aria-label={format ? format(value) : value.toLocaleString('ja-JP')}>
      <span aria-hidden>{text}</span>
    </span>
  )
}

/**
 * 子要素を、画面に入ったときに少しずつずらして入れる（カード・行の一覧に使う）。
 * 子はそれぞれ <StaggerItem> で包む。
 */
export function Stagger({ children, className, step = 60, as: Tag = 'div' }: {
  children: ReactNode
  className?: string
  /** 1つごとの遅れ（ms） */
  step?: number
  as?: 'div' | 'ul' | 'ol' | 'section'
}) {
  const { ref, seen } = useInViewOnce<HTMLDivElement>()
  return (
    <Tag
      ref={ref as never}
      className={`${styles.stagger} ${className ?? ''}`}
      data-seen={seen ? 'true' : undefined}
      style={{ '--stagger-step': `${step}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  )
}

/** Stagger の中の1つ。index で順番を決める */
export function StaggerItem({ children, index, className, as: Tag = 'div' }: {
  children: ReactNode
  index: number
  className?: string
  as?: 'div' | 'li'
}) {
  return (
    <Tag className={`${styles.item} ${className ?? ''}`} style={{ '--i': index } as CSSProperties}>
      {children}
    </Tag>
  )
}

/**
 * SVG の線を、画面に入ったときに描き出す（グラフの線・円の弧に使う）。
 * 子の path / circle に pathLength="1" を付けておく。
 */
export function DrawIn({ children, duration = 900, className }: { children: ReactNode; duration?: number; className?: string }) {
  const { ref, seen } = useInViewOnce<SVGGElement>()
  const armed = useArmed()
  const done = useDoneAfter(seen, duration + 400)
  return (
    <g ref={ref} className={`${styles.draw} ${className ?? ''}`} data-seen={seen ? 'true' : undefined} data-armed={armed && !done ? 'true' : undefined} data-done={done ? 'true' : undefined} style={{ '--draw-ms': `${duration}ms` } as CSSProperties}>
      {children}
    </g>
  )
}
