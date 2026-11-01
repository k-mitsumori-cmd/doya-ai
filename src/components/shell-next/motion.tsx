'use client'
// ============================================
// 動きの部品（見本の経営ホーム・部署のページで使う）: 動きの強さの共有・数字の数え上がり
// ============================================
// 動かすのは位置・透明度・拡大縮小だけ。曲線は cubic-bezier(0.22,1,0.36,1)（CSS 側）。
// 動きを減らす設定では、数字は最終の値をそのまま出す。その日の最初の表示だけフルに動かし、2回目以降は短くする。
// 開発用: 見本のページ（本番では 404）に限り、?motion=full で最初の表示を強制、?slow=4 で動きを4倍ゆっくりにできる（途中のコマを撮るため）。
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { countValue, dayKey, formatCount, isFirstOfDay, motionTimes, parseCount, type MotionMode } from './motion-count'

const DAY_KEY = 'doya-shell-sample-motion-day'

export interface MotionState { mode: MotionMode | null; slow: number }
const MotionCtx = createContext<MotionState>({ mode: null, slow: 1 })
export const useMotion = () => useContext(MotionCtx)

let cache: { mode: MotionMode; slow: number } | null = null

/** この画面を開いたときの動きの強さを決める（開くたびに1回だけ）。端末の日付が前回と違えばフル */
export function readMotion(): { mode: MotionMode; slow: number } {
  if (cache) return cache
  const q = new URLSearchParams(window.location.search)
  const slowRaw = Number(q.get('slow'))
  const slow = Number.isFinite(slowRaw) && slowRaw > 0 && slowRaw <= 10 ? slowRaw : 1
  let mode: MotionMode = 'full'
  let reduced = false
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { /* 読めなければ動かす */ }
  if (reduced) mode = 'none'
  else if (q.get('motion') === 'full') mode = 'full'
  else {
    try {
      const today = dayKey(new Date())
      mode = isFirstOfDay(window.localStorage.getItem(DAY_KEY), today) ? 'full' : 'short'
      window.localStorage.setItem(DAY_KEY, today)
    } catch { /* 記録できなければフルのまま */ }
  }
  cache = { mode, slow }
  return cache
}

export function MotionProvider({ children, onReady }: { children: React.ReactNode; onReady?: (s: { mode: MotionMode; slow: number }) => void }) {
  const [state, setState] = useState<MotionState>({ mode: null, slow: 1 })
  useEffect(() => {
    const s = readMotion()
    setState(s)
    onReady?.(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <MotionCtx.Provider value={state}>{children}</MotionCtx.Provider>
}

export type CountPhase = 'counting' | 'done'

/** 数字が 0 から目標の値まで、減速しながら数え上がる。見えてきたときに始まり、index が大きいほど少し遅れる。数字でない表示はそのまま出す */
export function CountUp({ text, index = 0, onPhase }: { text: string; index?: number; onPhase?: (p: CountPhase) => void }) {
  const { mode, slow } = useMotion()
  const spec = useMemo(() => parseCount(text), [text])
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(text)
  const phaseRef = useRef(onPhase)
  phaseRef.current = onPhase

  useEffect(() => {
    if (mode === null) return
    if (!spec || mode === 'none') { setShown(text); phaseRef.current?.('done'); return }
    const t = motionTimes(mode, slow)
    setShown(formatCount(0, spec))
    phaseRef.current?.('counting')
    let raf = 0
    let timer = 0
    const run = () => {
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = (now - t0) / t.count
        if (p < 1) { setShown(formatCount(countValue(spec, p), spec)); raf = requestAnimationFrame(tick) }
        else { setShown(text); phaseRef.current?.('done') }
      }
      raf = requestAnimationFrame(tick)
    }
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { run(); return () => cancelAnimationFrame(raf) }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { io.disconnect(); timer = window.setTimeout(run, 120 * slow + index * t.cardStep) }
    }, { threshold: 0.3 })
    io.observe(el)
    return () => { io.disconnect(); window.clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [mode, slow, spec, text, index])

  return <span ref={ref}>{shown}</span>
}
