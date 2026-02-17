'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// Types
// ============================================
interface RefineModalProps {
  outputId: string
  platform: string
  isOpen: boolean
  onClose: () => void
  onRegenerate: (newContent: string) => void
}

// ============================================
// プラットフォーム名マッピング
// ============================================
const PLATFORM_NAMES: Record<string, string> = {
  note: 'note',
  blog: 'Blog',
  x: 'X',
  instagram: 'Instagram',
  line: 'LINE',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  newsletter: 'メルマガ',
  press_release: 'プレスリリース',
}

// ============================================
// RefineModal コンポーネント
// ============================================
export default function RefineModal({
  outputId,
  platform,
  isOpen,
  onClose,
  onRegenerate,
}: RefineModalProps) {
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const MAX_FEEDBACK = 2000

  const platformName = PLATFORM_NAMES[platform] || platform

  // ============================================
  // 再生成リクエスト
  // ============================================
  const handleRegenerate = useCallback(async () => {
    if (!feedback.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/tenkai/generate/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputId,
          platform,
          feedback: feedback.trim(),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || '再生成に失敗しました')
      }

      const data = await res.json()
      onRegenerate(data.content || '')
      setFeedback('')
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '再生成中にエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }, [outputId, platform, feedback, onRegenerate, onClose])

  // ============================================
  // クイックフィードバックオプション
  // ============================================
  const quickFeedbacks = [
    'もっとカジュアルなトーンで',
    'もっとフォーマルに',
    '文章を短くして',
    'もっと詳しく説明して',
    'CTA（行動喚起）を強くして',
    'ハッシュタグを増やして',
  ]

  const addQuickFeedback = useCallback((text: string) => {
    setFeedback((prev) => {
      const separator = prev.trim() ? '\n' : ''
      return prev + separator + text
    })
  }, [])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* バックドロップ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* モーダル */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
              {/* ヘッダー */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-500">auto_fix_high</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">コンテンツを再生成</h3>
                    <p className="text-xs text-slate-400">{platformName}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* コンテンツ */}
              <div className="px-6 py-5 space-y-4">
                {/* 説明 */}
                <p className="text-sm text-slate-600">
                  フィードバックや指示を入力すると、AIが内容を改善して再生成します。
                </p>

                {/* クイックフィードバック */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    クイック指示
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {quickFeedbacks.map((qf) => (
                      <button
                        key={qf}
                        onClick={() => addQuickFeedback(qf)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        {qf}
                      </button>
                    ))}
                  </div>
                </div>

                {/* フィードバック入力 */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    フィードバック / 追加指示
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_FEEDBACK) {
                        setFeedback(e.target.value)
                      }
                    }}
                    placeholder="例: もう少しカジュアルなトーンで、具体的な事例を入れてください..."
                    rows={5}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
                  />
                  <p className="text-xs text-slate-400 text-right mt-1">
                    {feedback.length} / {MAX_FEEDBACK}文字
                  </p>
                </div>

                {/* エラー */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-red-500 text-lg">error</span>
                    <p className="text-sm text-red-600">{error}</p>
                  </motion.div>
                )}
              </div>

              {/* フッター */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={!feedback.trim() || isLoading}
                  className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    feedback.trim() && !isLoading
                      ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <motion.span
                        className="material-symbols-outlined text-lg"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        progress_activity
                      </motion.span>
                      再生成中...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                      再生成
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
