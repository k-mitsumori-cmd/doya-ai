'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { animate, motion } from 'framer-motion'

// 英語の飾り見出しは使わない（統合仕様 §11）。eyebrow は会場名などの日本語の補足だけに使う
export function PageHeader({ eyebrow, title, desc, right }: { eyebrow?: string; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-2xl flex-col gap-1.5">
        {eyebrow && (
          <motion.span initial={false} animate={{ opacity: 1, x: 0 }} className="text-[13px] font-medium text-doya-500">
            {eyebrow}
          </motion.span>
        )}
        {/* ページの h1 は枠（ToolFrame）の「ドヤ展示会」。各画面の見出しは h2（h1 を1つにする） */}
        <h2 className="m-0 text-balance font-display text-2xl text-ink md:text-3xl">{title}</h2>
        {desc && <p className="text-sm leading-relaxed text-gray-600">{desc}</p>}
      </div>
      {right}
    </div>
  )
}

export function CountUp({ value, format = (n) => Math.round(n).toLocaleString(), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const c = animate(v, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: setV })
    return () => c.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <span className={className}>{format(v)}</span>
}

// 入りのアニメーションは付けない（initial: false）。アニメーションが止まる環境（裏のタブ・重い端末）で、
// 薄い色のまま止まって見えるため（F-12）。i は呼び出し側の互換のために残している
export const cardIn = (i: number) => ({
  initial: false as const,
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 + i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
})

// 確認の画面。document.body の直下に描く（createPortal）。
// ⚠️ 置いた場所の中に描くと、親に transform・filter・will-change などがあるとき、fixed がその親を基準にしてしまい、
//    画面の真ん中に出ない（2026-10-26 ユーザーの指摘「まとめて作るを押すと、変なところに出る」）。
// 色の変数（--blue など）は .tenjikai-root に定義しているので、外側にも .tenjikai-root を付ける。
export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="tenjikai-root text-ink">
      <div data-testid="tenjikai-modal-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[var(--r)] bg-white p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-black text-ink">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-bold text-gray-500 hover:bg-gray-100">閉じる</button>
          </div>
          {children}
        </motion.div>
      </div>
    </div>,
    document.body,
  )
}
