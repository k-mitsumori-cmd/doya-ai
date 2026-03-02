'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import type { SidebarTheme } from './types'

export function SidebarLogoutDialog({
  isOpen,
  isLoggingOut,
  onClose,
  onConfirm,
  theme,
}: {
  isOpen: boolean
  isLoggingOut: boolean
  onClose: () => void
  onConfirm: () => void
  theme: SidebarTheme
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="logout-confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => !isLoggingOut && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <p className="text-sm font-black text-slate-900">確認</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className={`w-8 h-8 rounded-full ${theme.aiBubbleBg} text-white flex items-center justify-center text-[11px] font-black flex-shrink-0`}>
                  AI
                </div>
                <div className="bg-slate-100 rounded-2xl px-3 py-2">
                  <p className="text-sm font-black text-slate-800 leading-relaxed">ログアウトしますか？</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">いつでも再ログインできます。</p>
                </div>
              </div>
            </div>
            <div className="p-4 pt-0 flex gap-2">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-colors disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={onConfirm}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-900 text-white font-black hover:bg-black transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {isLoggingOut && <Loader2 className="w-4 h-4 animate-spin" />}
                ログアウト
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
