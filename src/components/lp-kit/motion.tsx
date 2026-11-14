'use client'
// 動きの部品。すべて自作（外部の部品集からのコピーは無し。ライセンスの手間を避けるため）。
// 考え方の参考: React Bits の ClickSpark / Magnet / SpotlightCard、Magic UI の border-beam / marquee / text-reveal、
//               Motion Primitives の in-view / animated-number / tilt（いずれも「動きの型」を参考にして書き直したもの。コードは写していない）。
// 動かす性質は transform / opacity が中心。JS が動かなくても、動きを減らす設定でも、完成の状態が見える。
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { cx, useInView, useMotion } from './hooks'

/* ------------------------------------------------------------------ */
/* 出現（InView）。最初の状態は CSS（.lpk-js .lpk-rv）に書く。            */
/* ------------------------------------------------------------------ */

let sharedIO: IntersectionObserver | null = null
const ioCallbacks = new WeakMap<Element, () => void>()
function observeOnce(el: Element, cb: () => void) {
  if (typeof IntersectionObserver === 'undefined') {
    cb()
    return () => {}
  }
  if (!sharedIO) {
    sharedIO = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) {
            const f = ioCallbacks.get(e.target)
            if (f) {
              ioCallbacks.delete(e.target)
              sharedIO?.unobserve(e.target)
              f()
            }
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    )
  }
  ioCallbacks.set(el, cb)
  sharedIO.observe(el)
  return () => {
    ioCallbacks.delete(el)
    sharedIO?.unobserve(el)
  }
}

/** 画面に入ったら、要素に in クラスを付ける（Reactの再描画を使わない。一度だけ）。 */
export function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    return observeOnce(el, () => el.classList.add('in'))
  }, [])
  return ref
}

export function Reveal({
  as,
  delay = 0,
  className,
  style,
  children,
}: {
  as?: ElementType
  delay?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const ref = useRevealOnce<HTMLElement>()
  const Tag = (as ?? 'div') as ElementType
  // 順に出る遅れは 60ms ずつ、最大 400ms
  const d = Math.min(delay, 400)
  return (
    <Tag ref={ref} className={cx('lpk-rv', className)} style={{ ...style, transitionDelay: d ? `${d}ms` : undefined }}>
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------------ */
/* 数字が増える（1回だけ）。最終値の幅を先に確保するので、ずれない。       */
/* ------------------------------------------------------------------ */
export function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const { ok } = useMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  const done = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || !ok || done.current) return
    const r = el.getBoundingClientRect()
    const offscreen = r.top > window.innerHeight || r.bottom < 0
    // 画面の外にあるうちに 0 へ戻す（見えている間に最終値から 0 へ戻る動きを出さない）
    if (offscreen) setShown(0)
    let raf = 0
    const stop = observeOnce(el, () => {
      done.current = true
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration)
        const eased = 1 - Math.pow(1 - p, 3)
        setShown(Math.round(value * eased))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    return () => {
      stop()
      cancelAnimationFrame(raf)
    }
  }, [ok, value, duration])

  return (
    <span ref={ref} className="lpk-count">
      <span className="lpk-count-ghost" aria-hidden="true">{value}</span>
      <span className="lpk-count-now" aria-label={String(value)}>{ok ? shown : value}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* 火花（ClickSpark）。押した位置から線が広がる。                         */
/* ------------------------------------------------------------------ */
export function ClickSpark({ children, color = '#ffd400', className }: { children: ReactNode; color?: string; className?: string }) {
  const { ok } = useMotion()
  const wrap = useRef<HTMLSpanElement>(null)
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const el = wrap.current
      if (!el || !ok || typeof el.animate !== 'function') return
      const box = el.getBoundingClientRect()
      const cx0 = e.clientX - box.left
      const cy0 = e.clientY - box.top
      const n = 8
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n
        const s = document.createElement('i')
        s.className = 'lpk-spark'
        s.style.left = `${cx0}px`
        s.style.top = `${cy0}px`
        s.style.background = color
        s.style.setProperty('--a', `${(a * 180) / Math.PI}deg`)
        el.appendChild(s)
        const dist = 26 + Math.random() * 8
        const anim = s.animate(
          [
            { transform: `translate(-50%,-50%) rotate(${a}rad) translateX(6px) scaleX(1)`, opacity: 1 },
            { transform: `translate(-50%,-50%) rotate(${a}rad) translateX(${dist}px) scaleX(.3)`, opacity: 0 },
          ],
          { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
        )
        anim.onfinish = () => s.remove()
      }
    },
    [ok, color],
  )
  return (
    <span ref={wrap} className={cx('lpk-sparkwrap', className)} onClickCapture={onClick}>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Magnet。カーソルが寄ると、ほんの少し寄る（細かい指し示しがあるときだけ）。 */
/* ------------------------------------------------------------------ */
export function Magnet({ children, strength = 0.18, className }: { children: ReactNode; strength?: number; className?: string }) {
  const { ok, fine } = useMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const active = ok && fine
  const move = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || !active) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    el.style.transform = `translate(${(dx * strength).toFixed(1)}px, ${(dy * strength).toFixed(1)}px)`
  }
  const leave = () => {
    if (ref.current) ref.current.style.transform = ''
  }
  return (
    <span ref={ref} className={cx('lpk-magnet', className)} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* SpotlightCard。カーソルの位置に光が出る。                             */
/* ------------------------------------------------------------------ */
export function SpotlightCard({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const { ok, fine } = useMotion()
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || !(ok && fine)) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--sx', `${e.clientX - r.left}px`)
    el.style.setProperty('--sy', `${e.clientY - r.top}px`)
    el.classList.add('lit')
  }
  return (
    <div ref={ref} className={cx('lpk-spot', className)} style={style} onPointerMove={move} onPointerLeave={() => ref.current?.classList.remove('lit')}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tilt。カードが傾き、光が走る（カーソルがあるときだけ）。                */
/* ------------------------------------------------------------------ */
export function Tilt({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const { ok, fine } = useMotion()
  const ref = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const move = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || !(ok && fine)) return
    const { clientX, clientY } = e
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      const px = (clientX - r.left) / r.width
      const py = (clientY - r.top) / r.height
      el.style.setProperty('--rx', `${((0.5 - py) * max * 2).toFixed(2)}deg`)
      el.style.setProperty('--ry', `${((px - 0.5) * max * 2).toFixed(2)}deg`)
      el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`)
      el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`)
      el.classList.add('tilting')
    })
  }
  const leave = () => {
    cancelAnimationFrame(raf.current)
    const el = ref.current
    if (!el) return
    el.classList.remove('tilting')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }
  return (
    <div ref={ref} className={cx('lpk-tilt', className)} onPointerMove={move} onPointerLeave={leave}>
      {children}
      <span className="lpk-glare" aria-hidden="true" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Marquee。CSS だけで横に流れる。動きを止めると折り返して全部見える。      */
/* ------------------------------------------------------------------ */
export function Marquee({ items, label }: { items: string[]; label: string }) {
  return (
    <div className="lpk-marquee" role="group" aria-label={label}>
      <ul className="lpk-mq-track">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
        {items.map((t) => (
          <li key={`d-${t}`} className="lpk-mq-dup" aria-hidden="true">{t}</li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BorderBeam。枠の縁を光が走る（PC のカーソルがあるときだけ・画面内のときだけ）。 */
/* 回す物は transform の回転だけ。                                        */
/* ------------------------------------------------------------------ */
export function BorderBeam({ children, active, className }: { children: ReactNode; active: boolean; className?: string }) {
  const { ok, fine } = useMotion()
  return <div className={cx('lpk-beam', ok && fine && active && 'on', className)}>{children}</div>
}

/* ------------------------------------------------------------------ */
/* スクロールに合わせて、文節ごとに色がつく。                             */
/* ------------------------------------------------------------------ */
export function ScrollColorText({ phrases, breakPc = [], breakSp = [], className }: { phrases: string[]; breakPc?: number[]; breakSp?: number[]; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const spans = Array.from(el.querySelectorAll<HTMLElement>('.lpk-ph'))
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      // 上端が画面の 85% の高さに来たら 0、下端が 45% の高さに来たら 1
      const start = vh * 0.85
      const end = vh * 0.45
      const p = Math.min(1, Math.max(0, (start - r.top) / (start - end + r.height)))
      const n = spans.length
      spans.forEach((s, i) => s.classList.toggle('lit', p * (n + 0.5) > i + 0.2))
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      cancelAnimationFrame(raf)
    }
  }, [])
  const full = phrases.join('')
  return (
    <p ref={ref} className={cx('lpk-scrolltext', className)}>
      <span className="lpk-sr">{full}</span>
      <span aria-hidden="true">
        {phrases.map((p, i) => (
          <span key={i}>
            <span className="lpk-ph">{p}</span>
            {breakPc.includes(i) && <br className="lpk-br-pc" />}
            {breakSp.includes(i) && <br className="lpk-br-sp" />}
          </span>
        ))}
      </span>
    </p>
  )
}

export { useInView }
