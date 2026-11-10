'use client'
// ============================================
// 選択中の印（左のメニューの背景・下のタブの棒）。別の項目へ移ると、印が1つのまま滑って動く
// ============================================
// framer-motion の layoutId で、前の項目の印から新しい項目の印へ位置と大きさを移す（transform だけ）。
// - 左のメニューと下のタブは、同じ画面に両方は出ない（片方は display:none）が、layoutId は別にする
// - 動きを減らす設定では、滑らず切り替わる（duration 0）
// - 印は見た目だけ（aria-hidden）。選択中かどうかは今までどおり aria-current が伝える
import { motion, useReducedMotion } from 'framer-motion'

export function NavMark({ kind, className }: { kind: 'side' | 'tab'; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <motion.span
      aria-hidden
      layoutId={kind === 'side' ? 'shell-nav-mark-side' : 'shell-nav-mark-tab'}
      className={className}
      // 角丸は style で渡すと、framer が拡大縮小の間も丸みをそろえる
      style={{ borderRadius: kind === 'side' ? 12 : undefined }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34, mass: 0.9 }}
    />
  )
}
