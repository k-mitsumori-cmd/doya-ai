'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Sparkles, X, FileText } from 'lucide-react'

export function InterviewCompletionModal({
  open,
  title,
  subtitle,
  primaryLabel = '記事を確認する',
  onPrimary,
  onClose,
}: {
  open: boolean
  title: string
  subtitle?: string
  primaryLabel?: string
  onPrimary?: () => void
  onClose: () => void
}) {
  const reduce = useReducedMotion()

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: 'easeOut' }}
            className="relative w-full max-w-2xl bg-gradient-to-br from-white via-orange-50/30 to-amber-50/30 rounded-3xl shadow-2xl overflow-hidden border-2 border-orange-200/50"
          >
            {/* Header: グラデーション背景 */}
            <div className="relative p-8 sm:p-10 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400" />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 transition-all"
                aria-label="閉じる"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              <div className="relative">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-black uppercase tracking-widest">
                  <Sparkles className="w-4 h-4" />
                  記事生成完了
                </div>
                <div className="mt-6 flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-3xl sm:text-4xl font-black leading-tight text-white mb-2">
                      ありがとうございました
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-white/95 leading-snug break-words mb-2">
                      {title}
                    </p>
                    {subtitle && (
                      <p className="text-base sm:text-lg text-white/90 font-bold leading-relaxed mt-3">
                        {subtitle}
                      </p>
                    )}
                    <p className="text-sm text-white/80 font-bold mt-4 leading-relaxed">
                      丁寧なビジネス記事が完成しました。内容をご確認いただけます。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 sm:p-10 bg-white">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    onPrimary?.()
                    onClose()
                  }}
                  className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-black text-base shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 transition-all flex items-center justify-center gap-3"
                >
                  <FileText className="w-5 h-5" />
                  {primaryLabel}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 h-14 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 font-black text-base hover:bg-slate-50 transition-all shadow-sm"
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

