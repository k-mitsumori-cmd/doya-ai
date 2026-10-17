'use client'

import { useEffect, useState } from 'react'
import { animate, motion } from 'framer-motion'

export function PageHeader({ eyebrow, title, desc, right }: { eyebrow: string; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-2xl flex-col gap-1.5">
        <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="font-mono text-[11px] uppercase tracking-[.14em] text-doya-500">
          {eyebrow}
        </motion.span>
        <h1 className="text-balance font-display text-2xl text-ink md:text-3xl">{title}</h1>
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

export const cardIn = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 + i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
})

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  if (!open) return null
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[var(--r)] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-black text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-bold text-gray-500 hover:bg-gray-100">閉じる</button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}
