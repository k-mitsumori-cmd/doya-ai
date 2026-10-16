'use client'

// カーソル演出（控えめ版）：小さな点＋遅れてついてくる細い輪／押せる物の上で輪が少しだけ広がる／
// [data-magnetic] は少し吸い付く。光の尾・クリックの粒・ラベルは出さない。
// マウス操作の端末だけで動かし、動きを減らす設定の人には出さない。
import { useEffect, useRef } from 'react'
import s from './renewal.module.css'

const HOVER = 'button, a, [role="option"], [data-cursor], label, select'
const TEXT = 'input:not([type="range"]), textarea'

export function Cursor({ enabled }: { enabled: boolean }) {
  const layer = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const L = layer.current!
    const D = dot.current!
    const R = ring.current!
    L.dataset.ready = ''

    let x = -100
    let y = -100
    let rx = x
    let ry = y
    let raf = 0
    let magnet: HTMLElement | null = null

    const release = () => {
      if (magnet) magnet.style.translate = ''
      magnet = null
    }

    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      D.style.transform = `translate3d(${x}px, ${y}px, 0)`
      const target = e.target as Element | null
      const text = target?.closest?.(TEXT)
      const hover = text ? null : (target?.closest?.(HOVER) as HTMLElement | null)
      R.dataset.state = text ? 'text' : hover ? 'hover' : ''
      // 吸い付くボタン
      const m = target?.closest?.('[data-magnetic]') as HTMLElement | null
      if (m !== magnet) release()
      if (m) {
        magnet = m
        const r = m.getBoundingClientRect()
        const dx = (x - (r.left + r.width / 2)) * 0.12
        const dy = (y - (r.top + r.height / 2)) * 0.12
        m.style.translate = `${dx}px ${dy}px`
      }
    }

    const onDown = () => {
      R.dataset.down = ''
    }
    const onUp = () => delete R.dataset.down
    const onLeave = () => {
      L.dataset.hidden = ''
      release()
    }
    const onEnter = () => delete L.dataset.hidden

    const loop = () => {
      rx += (x - rx) * 0.16
      ry += (y - ry) * 0.16
      R.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    document.documentElement.addEventListener('pointerleave', onLeave)
    document.documentElement.addEventListener('pointerenter', onEnter)
    return () => {
      cancelAnimationFrame(raf)
      release()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.documentElement.removeEventListener('pointerenter', onEnter)
      delete L.dataset.ready
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <div ref={layer} className={s.cursorLayer} aria-hidden="true">
      <div ref={ring} className={s.cursorRing} />
      <div ref={dot} className={s.cursorDot} />
    </div>
  )
}
