'use client'
// ============================================
// ds/motion — 動きの部品（UI 品質 A-1）
// ============================================
// - 画面に入ったときに1回だけ動く（IntersectionObserver）
// - 動きを減らす設定（prefers-reduced-motion）では、最初から最後の形で出す
// - 数字は等幅（tabular-nums）。動いている間も桁がぶれない
// ⚠️ 数字やデータは props で受け取るだけ。ここで取得しない。
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './motion.module.css'
import { countFrame, formatCount } from './chart-math'
import { splitWords } from './split-words'
export { splitWords } from './split-words'

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

/** 画面に入らなくても、この時間が過ぎたら「入った」とみなす（ms）。隠したまま残らないようにする（F-12 の救済） */
export const IN_VIEW_FALLBACK_MS = 2500

/**
 * 要素が画面に入ったら true（一度 true になったら戻らない）。
 * ⚠️ ページのいちばん下の短いグラフでも判定されるよう、既定の rootMargin は 0。
 *    前は下を -10% にしていたため、下の端の 10% に収まる要素は「入った」とされず、隠れたままになることがあった。
 * ⚠️ 画面に入らないまま fallbackMs が過ぎたら、true にする（スクロールされない・判定が止まる環境でも、最後の形を出すため）。
 *    0 を渡すと救済しない。
 */
export function useInViewOnce<T extends Element>(rootMargin = '0px', fallbackMs: number = IN_VIEW_FALLBACK_MS) {
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
    const t = fallbackMs > 0 ? setTimeout(() => { setSeen(true); io.disconnect() }, fallbackMs) : undefined
    return () => { io.disconnect(); if (t) clearTimeout(t) }
  }, [seen, rootMargin, fallbackMs])
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
 * SVG の線を、画面に入ったときに描き出す（グラフの線・レーダーの線・円の弧に使う）。
 * - mode='wipe'（既定）: 左から右へ、見える範囲を広げて描く。線の描き方（破線・点線の strokeDasharray）はそのまま出る。
 *   ⚠️ 前は pathLength=1 と stroke-dasharray で描いていたため、系列の破線（"6 4" など）が実線に上書きされていた（統括の指摘 2026-10-23）
 * - mode='stroke': 弧を長さに沿って描く（Ring の円）。子に pathLength="1" と、値の strokeDasharray を付けておく
 * - スクリプトが動く前・動きを減らす設定・描き終わるはずの時間が過ぎたあとは、そのまま出す（F-12）
 */
export function DrawIn({ children, duration = 900, className, mode = 'wipe', extent = 1000 }: {
  children: ReactNode
  duration?: number
  className?: string
  mode?: 'wipe' | 'stroke'
  /** 'wipe' のとき、描き終わりの右端（グラフの座標。viewBox の幅を渡す） */
  extent?: number
}) {
  const { ref, seen } = useInViewOnce<SVGGElement>()
  const armed = useArmed()
  const reduced = usePrefersReducedMotion()
  const done = useDoneAfter(seen, duration + 400)
  const rawId = useId()
  const clipId = `ds-draw-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const animRef = useRef<SVGAnimateElement | null>(null)
  // 'wipe' は、隠す（幅0）→ 画面に入ったら幅を広げる。SMIL の animate を、入ったときに始める
  const wiping = mode === 'wipe' && armed && !done && !reduced
  useEffect(() => {
    if (!wiping || !seen) return
    try { animRef.current?.beginElement() } catch { /* 始められなくても、時間が過ぎれば done で出る */ }
  }, [wiping, seen])
  if (mode === 'stroke') {
    return (
      <g ref={ref} className={`${styles.draw} ${className ?? ''}`} data-seen={seen ? 'true' : undefined} data-armed={armed && !done ? 'true' : undefined} data-done={done ? 'true' : undefined} style={{ '--draw-ms': `${duration}ms` } as CSSProperties}>
        {children}
      </g>
    )
  }
  return (
    <g ref={ref} className={className} data-seen={seen ? 'true' : undefined} data-done={done ? 'true' : undefined}>
      {wiping ? (
        <defs>
          {/* グラフの座標で切り抜く。線の外枠（objectBoundingBox）で決めると、値がすべて同じ水平な線は高さ0になって消えるため。
              上下は十分に広く、左右は線の太さと端の丸みの分だけ余白を取る */}
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <rect x={-8} y={-100000} height={200000} width={0}>
              <animate ref={animRef} attributeName="width" from="0" to={String(extent + 16)} dur={`${duration}ms`} begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.65 0 0.35 1" />
            </rect>
          </clipPath>
        </defs>
      ) : null}
      <g clipPath={wiping ? `url(#${clipId})` : undefined}>{children}</g>
    </g>
  )
}

/**
 * 言葉を1語ずつ、薄い色から濃い色へ順に変える（参考: ai-design-skills の B11 Tagline reveal）。
 * 待ちの文や、結果が出た瞬間のひと言に使う。日本語は読点・句点・「、」で区切る（文字ごとには分けない）。
 * - 動きを減らす設定では、最初から濃い色で出す
 * - 文が変わったら、最初からやり直す
 */
export function RevealWords({ text, step = 90, className, as: Tag = 'span' }: {
  text: string
  /** 1語ごとの遅れ（ms） */
  step?: number
  className?: string
  as?: 'span' | 'p' | 'h2'
}) {
  const reduced = usePrefersReducedMotion()
  const words = splitWords(text)
  return (
    <Tag key={text} className={`${styles.reveal} ${className ?? ''}`} data-reduced={reduced ? 'true' : undefined}>
      {/* 読み上げ用に、文を1回だけ置く（語ごとの span は aria-hidden。見出しが空にならないように） */}
      <span className={styles.srOnly}>{text}</span>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" className={styles.word} style={{ '--w': i, '--reveal-step': `${step}ms` } as CSSProperties}>{w}</span>
      ))}
    </Tag>
  )
}
