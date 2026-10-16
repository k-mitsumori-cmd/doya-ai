'use client'

// カーソル演出：点＋遅れてついてくる輪／押せる物の上で輪が膨らみラベルが出る／
// [data-magnetic] は吸い付く／クリックで粒が弾ける／動くと光の尾が残る。
// マウス操作の端末だけで動かし、動きを減らす設定の人には出さない。
import { useEffect, useRef } from 'react'
import s from './renewal.module.css'

const HOVER = 'button, a, [role="option"], [data-cursor], label, select'
const TEXT = 'input:not([type="range"]), textarea'

export function Cursor({ enabled }: { enabled: boolean }) {
  const layer = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!enabled) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const L = layer.current!
    const D = dot.current!
    const R = ring.current!
    const T = label.current!
    L.dataset.ready = ''

    let x = -100
    let y = -100
    let rx = x
    let ry = y
    let raf = 0
    let magnet: HTMLElement | null = null
    let moves = 0

    const trail: HTMLSpanElement[] = Array.from({ length: 16 }, () => {
      const el = document.createElement('span')
      el.className = s.trail
      L.appendChild(el)
      return el
    })
    let trailIdx = 0

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
      const tip = hover?.getAttribute('data-cursor') ?? ''
      if (T.textContent !== tip) T.textContent = tip
      if (tip) R.dataset.label = ''
      else delete R.dataset.label

      // 吸い付くボタン
      const m = target?.closest?.('[data-magnetic]') as HTMLElement | null
      if (m !== magnet) release()
      if (m) {
        magnet = m
        const r = m.getBoundingClientRect()
        const dx = (x - (r.left + r.width / 2)) * 0.28
        const dy = (y - (r.top + r.height / 2)) * 0.28
        m.style.translate = `${dx}px ${dy}px`
      }

      // 光の尾（2回に1回置く）
      moves += 1
      if (moves % 2 === 0) {
        const p = trail[trailIdx]
        trailIdx = (trailIdx + 1) % trail.length
        p.style.left = `${x}px`
        p.style.top = `${y}px`
        p.classList.remove(s.trailOn)
        void p.offsetWidth
        p.classList.add(s.trailOn)
      }
    }

    const onDown = (e: PointerEvent) => {
      R.dataset.down = ''
      // クリックで粒が弾ける
      for (let i = 0; i < 12; i++) {
        const p = document.createElement('span')
        const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.4
        const d = 26 + Math.random() * 34
        p.className = s.spark
        p.style.left = `${e.clientX}px`
        p.style.top = `${e.clientY}px`
        p.style.setProperty('--dx', `${Math.cos(a) * d}px`)
        p.style.setProperty('--dy', `${Math.sin(a) * d}px`)
        p.style.setProperty('--c', ['var(--cursor-a)', 'var(--cursor-b)', '#ffd400'][i % 3])
        p.addEventListener('animationend', () => p.remove(), { once: true })
        L.appendChild(p)
      }
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
      trail.forEach((t) => t.remove())
      delete L.dataset.ready
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <div ref={layer} className={s.cursorLayer} aria-hidden="true">
      <div ref={ring} className={s.cursorRing}>
        <span ref={label} className={s.cursorLabel} />
      </div>
      <div ref={dot} className={s.cursorDot} />
    </div>
  )
}
