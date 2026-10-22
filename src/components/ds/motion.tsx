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
import { countFrame, formatCount } from './chart-math'

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

function prefersReducedNow(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 数字のカウントアップ（UI 品質 A-2）。画面に入ったときに1回だけ、0 から最後の値まで数え上げる。
 * 値が変わったときは、今の表示から新しい値へ動く。
 * - 動きを減らす設定では動かさず、最後の値を出す
 * - 最後の値の幅で場所を取る（桁が増えても幅が変わらない。CLS を増やさない）
 * - 読み上げは最後の値だけ（途中の数字は aria-hidden）
 * - タブが裏にあるなど requestAnimationFrame が止まる環境でも、時間が過ぎたら最後の値を出す（F-12）
 * - スクリプトが動く前（サーバーの描画）は最後の値を出す
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
  const armed = useArmed()
  // null のときは最後の値を出す
  const [shown, setShown] = useState<number | null>(null)
  const from = useRef(0)
  const cur = useRef<number | null>(null)
  useEffect(() => {
    if (!armed) return
    const finishNow = () => { from.current = value; cur.current = null; setShown(null) }
    if (reduced || prefersReducedNow() || !Number.isFinite(value)) { finishNow(); return }
    if (!seen) { setShown(from.current); return }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { finishNow(); return }
    const a = from.current
    if (a === value) { finishNow(); return }
    const start = performance.now()
    let raf = 0
    const finish = () => { cancelAnimationFrame(raf); finishNow() }
    const tick = (now: number) => {
      const t = (now - start) / duration
      if (t >= 1) { finish(); return }
      const v = countFrame(a, value, t)
      cur.current = v
      setShown(v)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // requestAnimationFrame が止まっても、最後の値に移す
    const timer = setTimeout(finish, duration + 400)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      // 途中で値が変わったら、今の表示から動き直す
      if (cur.current !== null) from.current = cur.current
    }
  }, [armed, seen, value, duration, reduced])
  const fmt = (n: number) => (format ? format(n) : formatCount(n, value))
  const finalText = Number.isFinite(value) ? fmt(value) : String(value)
  return (
    <span ref={ref} className={`${styles.num} ${styles.count} ${className ?? ''}`}>
      {/* 最後の値の幅で場所を取る */}
      <span className={styles.countGhost} aria-hidden>{finalText}</span>
      <span className={styles.countLive} aria-hidden>{shown === null ? finalText : fmt(shown)}</span>
      <span className={styles.srOnly}>{finalText}</span>
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
