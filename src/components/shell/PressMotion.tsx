'use client'
// ============================================
// 押したときの反応（共通の枠の中のボタン・リンク・カードすべて）
// ============================================
// 押している間は少し縮み、離すと最後に少し弾んで戻る。
// - 部品ごとに書かず、枠のルートで1回だけ見張る（イベントの委譲）。新しく増えた部品にも効く
// - 動かすのは scale だけ（Web Animations API）。部品が持っている transition や transform とぶつからない
// - 大きい面（幅が広いカード）は縮みを小さくする。画面いっぱいのリンクが大きく縮まないように
// - 動きを減らす設定の人・押せない部品（disabled）・入力欄・data-no-press を付けた部品では動かさない
// - ⚠️ 見た目の変更だけ。クリックの動きは止めない（pointer のイベントは見るだけで preventDefault しない）
import { useEffect } from 'react'

/** 押せる部品の目印 */
const PRESSABLE = 'button, a[href], summary, [role="button"], [role="tab"], [role="menuitem"], [data-press]'
const EXCLUDE = '[disabled], [aria-disabled="true"], [data-no-press], input, textarea, select'

/** 押したときの縮み。小さい部品ほど大きく縮む */
export function pressScale(width: number, height: number): number {
  const longest = Math.max(width, height)
  if (longest >= 480) return 0.99
  if (longest >= 280) return 0.975
  return 0.95
}

export default function PressMotion() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let current: { el: HTMLElement; anim: Animation | null; to: number } | null = null

    const release = () => {
      const c = current
      current = null
      if (!c || !c.anim) return
      // いま縮んでいる大きさから、1 まで弾んで戻る
      try {
        const now = getComputedStyle(c.el).scale
        const from = now && now !== 'none' ? now : String(c.to)
        c.anim.cancel()
        c.el.animate([{ scale: from }, { scale: '1' }], { duration: 280, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
      } catch {
        c.anim.cancel()
      }
    }

    const down = (e: PointerEvent) => {
      if (reduced.matches || (e.pointerType === 'mouse' && e.button !== 0)) return
      const t = e.target
      if (!(t instanceof Element)) return
      const el = t.closest<HTMLElement>(PRESSABLE)
      // 枠の中だけ（ダイアログ・別の部品の外には効かせない）
      if (!el || el.matches(EXCLUDE) || !el.closest('[data-ui-next="true"]')) return
      if (typeof el.animate !== 'function') return
      release()
      const r = el.getBoundingClientRect()
      const to = pressScale(r.width, r.height)
      const anim = el.animate([{ scale: '1' }, { scale: String(to) }], { duration: 150, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' })
      current = { el, anim, to }
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', release, true)
    document.addEventListener('pointercancel', release, true)
    // 押したまま外へ出した・画面が隠れたときも戻す
    document.addEventListener('dragstart', release, true)
    window.addEventListener('blur', release)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', release, true)
      document.removeEventListener('pointercancel', release, true)
      document.removeEventListener('dragstart', release, true)
      window.removeEventListener('blur', release)
      release()
    }
  }, [])
  return null
}
