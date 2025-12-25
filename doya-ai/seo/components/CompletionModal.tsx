'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Sparkles, X } from 'lucide-react'

export function CompletionModal({
  open,
  title,
  subtitle,
  primaryLabel = '記事を見る',
  onPrimary,
  onClose,
  defaultDontShowAgain = false,
  onDontShowAgainChange,
}: {
  open: boolean
  title: string
  subtitle?: string
  primaryLabel?: string
  onPrimary?: () => void
  onClose: () => void
  defaultDontShowAgain?: boolean
  onDontShowAgainChange?: (v: boolean) => void
}) {
  const reduce = useReducedMotion()
  const [dontShowAgain, setDontShowAgain] = useState(defaultDontShowAgain)

  useEffect(() => {
    if (!open) return
    setDontShowAgain(defaultDontShowAgain)
  }, [open, defaultDontShowAgain])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="relative p-6 sm:p-8 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.55),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.35),transparent_40%)]" />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-widest">
                  <Sparkles className="w-4 h-4" />
                  Completed
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-black leading-tight">完成！</p>
                    <p className="mt-1 text-white/90 font-black text-sm sm:text-base leading-snug">{title}</p>
                    {subtitle && <p className="mt-2 text-white/80 text-xs sm:text-sm font-bold">{subtitle}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <label className="flex items-start gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => {
                    const v = e.target.checked
                    setDontShowAgain(v)
                    onDontShowAgainChange?.(v)
                  }}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <p className="text-sm font-black text-gray-900">次回からこのポップアップを表示しない</p>
                  <p className="text-xs font-bold text-gray-500 mt-1">あとから設定画面でいつでも戻せます。</p>
                </div>
              </label>

              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    onPrimary?.()
                    onClose()
                  }}
                  className="flex-1 h-12 rounded-2xl bg-gray-900 text-white font-black text-sm shadow-lg hover:bg-gray-800 transition-colors"
                >
                  {primaryLabel}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 h-12 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black text-sm hover:bg-gray-50 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}


