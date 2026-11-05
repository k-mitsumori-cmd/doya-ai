'use client'

// 決済のあとのお礼のポップアップ（追加購入・プランの反映・人数の追加）。
// 出すかどうかは呼ぶ側が、サーバーの確認の結果で決める。ここは見せ方だけ。
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { paymentThanksCopy, type PaymentThanksView } from '@/lib/pricing-v2/payment-thanks'
import styles from './PaymentThanks.module.css'

// 白は白い文字の後ろで読みにくくなるので使わない
const COLORS = ['#ffd400', '#ff1e72', '#00e0ff', '#ff8a00']
const COUNT_MS = 900

/** 紙吹雪の並び（毎回同じ。乱数を使わない） */
const CONFETTI = Array.from({ length: 48 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${((i * 7) % 16) / 10}s`,
  duration: `${2.4 + ((i * 11) % 14) / 10}s`,
  drift: `${((i * 53) % 160) - 80}px`,
  turn: `${360 + ((i * 97) % 720)}deg`,
  color: COLORS[i % COLORS.length],
  round: i % 5 === 0,
}))

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** 0 から目標の数まで数え上げる。動きを減らす設定の人には、はじめから目標の数を出す */
function useCountUp(target: number): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0))
  useEffect(() => {
    if (reducedMotion()) { setValue(target); return }
    const started = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - started) / COUNT_MS)
      setValue(Math.round(target * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target])
  return value
}

function Amount({ prefix, value, unit }: { prefix: string; value: number; unit: string }) {
  const shown = useCountUp(value)
  return (
    <p className={styles.amount} aria-label={`${prefix}${value.toLocaleString('ja-JP')} ${unit}`}>
      <span aria-hidden className={styles.amountNum}>{prefix}{shown.toLocaleString('ja-JP')}</span>
      <span aria-hidden className={styles.amountUnit}>{unit}</span>
    </p>
  )
}

export default function PaymentThanks({ view, onClose }: { view: PaymentThanksView | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const open = view !== null

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      // 中のボタンは閉じるの2つだけなので、Tab はその間で回す
      if (e.key === 'Tab') {
        const items = Array.from(document.querySelectorAll<HTMLElement>('[data-payment-thanks-focus]'))
        const at = items.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      before?.focus?.()
    }
  }, [open])

  if (!view || typeof document === 'undefined') return null
  const copy = paymentThanksCopy(view)
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={copy.eyebrow} onClick={onClose}>
      <div className={styles.burst} aria-hidden />
      <div className={styles.confetti} aria-hidden>
        {CONFETTI.map((c, i) => (
          <span key={i} className={styles.piece} data-round={c.round ? 'true' : undefined} style={{
            left: c.left, background: c.color, animationDelay: c.delay, animationDuration: c.duration,
            ['--drift' as string]: c.drift, ['--turn' as string]: c.turn,
          }} />
        ))}
      </div>
      <button ref={closeRef} type="button" data-payment-thanks-focus className={styles.close} aria-label="閉じる" onClick={onClose}><X size={22} aria-hidden /></button>
      <div className={styles.stage} onClick={(e) => e.stopPropagation()}>
        <img src="/character/jump-512.webp" alt="" width={220} height={220} className={styles.art} />
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        {copy.amount ? <Amount {...copy.amount} /> : null}
        <h2 className={copy.amount ? styles.headline : styles.headlineLarge}>{copy.headline}</h2>
        <p className={styles.body}>{copy.body}</p>
        <button type="button" data-payment-thanks-focus className={styles.cta} onClick={onClose}>閉じる</button>
      </div>
    </div>,
    document.body,
  )
}
