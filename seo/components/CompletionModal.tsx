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
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
          >
            {/* Header: 白基調で読みやすく */}
            <div className="relative p-6 sm:p-8 bg-white border-b border-gray-100">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                aria-label="閉じる"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>

              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                  <Sparkles className="w-4 h-4" />
                  完了
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-7 h-7 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-black leading-tight text-gray-900">完成！</p>
                    <p className="mt-1 text-gray-800 font-black text-sm sm:text-base leading-snug break-words">{title}</p>
                    {subtitle && <p className="mt-2 text-gray-500 text-xs sm:text-sm font-bold">{subtitle}</p>}
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
                  className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm shadow-lg shadow-blue-500/20 hover:opacity-95 transition-all"
                >
                  {primaryLabel}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 h-12 rounded-2xl bg-white border border-gray-200 text-gray-700 font-black text-sm hover:bg-gray-50 transition-colors shadow-sm"
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


