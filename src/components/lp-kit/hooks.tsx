'use client'
// 動きの前提（動きを減らす設定・カーソルの有無・「動きを止める」の切り替え）を共有する。
import { createContext, useContext, useEffect, useState } from 'react'

export type MotionState = {
  /** 動きを出してよいか（動きを減らす設定でも、「動きを止める」でも false） */
  ok: boolean
  /** マウスなど細かい指し示しができ、幅が 768px 以上か（カーソル系の仕掛けを出す条件） */
  fine: boolean
}

export const MotionContext = createContext<MotionState>({ ok: false, fine: false })
export const useMotion = () => useContext(MotionContext)

function useMedia(query: string, initial = false) {
  const [v, setV] = useState(initial)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setV(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return v
}

export const usePrefersReduced = () => useMedia('(prefers-reduced-motion: reduce)')
export const useFinePointer = () => useMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)')

/** 画面に入っているかを返す。once=true なら一度入ったあとも true のまま。 */
export function useInView<T extends Element>(ref: React.RefObject<T>, opts: { once?: boolean; margin?: string } = {}) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) {
            setInView(true)
            if (opts.once) io.disconnect()
          } else if (!opts.once) setInView(false)
        }
      },
      { rootMargin: opts.margin ?? '0px' },
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, opts.once, opts.margin])
  return inView
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

/** ページ全体の動きの前提を決める。読み込み前は ok=false（完成の状態で描く）。判定が済んでから ok が決まる。 */
export function useMotionState(still: boolean): MotionState {
  const [s, setS] = useState<{ ready: boolean; reduced: boolean; fine: boolean }>({ ready: false, reduced: false, fine: false })
  useEffect(() => {
    const r = window.matchMedia('(prefers-reduced-motion: reduce)')
    const f = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)')
    const on = () => setS({ ready: true, reduced: r.matches, fine: f.matches })
    on()
    r.addEventListener('change', on)
    f.addEventListener('change', on)
    return () => {
      r.removeEventListener('change', on)
      f.removeEventListener('change', on)
    }
  }, [])
  return { ok: s.ready && !s.reduced && !still, fine: s.ready && s.fine }
}
