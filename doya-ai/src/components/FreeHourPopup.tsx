'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Clock, Sparkles, Rocket } from 'lucide-react'
import { getFreeHourRemainingMs, FREE_HOUR_DURATION_MS } from '@/lib/pricing'

interface FreeHourPopupProps {
  firstLoginAt: string | null | undefined
  onClose?: () => void
}

/**
 * 初回ログイン後1時間生成し放題のお知らせポップアップ
 * - フリープランユーザーかつ1時間以内の場合に表示
 * - 一度閉じたらセッション中は再表示しない（sessionStorage）
 */
export function FreeHourPopup({ firstLoginAt, onClose }: FreeHourPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [remainingMs, setRemainingMs] = useState(0)

  useEffect(() => {
    // 既に閉じた場合はスキップ
    const dismissed = sessionStorage.getItem('doya_free_hour_dismissed')
    if (dismissed === '1') return

    const remaining = getFreeHourRemainingMs(firstLoginAt)
    if (remaining > 0) {
      setRemainingMs(remaining)
      // 少し遅延してから表示（UX向上）
      const timer = setTimeout(() => setIsOpen(true), 800)
      return () => clearTimeout(timer)
    }
  }, [firstLoginAt])

  // 残り時間のカウントダウン
  useEffect(() => {
    if (!isOpen || remainingMs <= 0) return
    const interval = setInterval(() => {
      const newRemaining = getFreeHourRemainingMs(firstLoginAt)
      setRemainingMs(newRemaining)
      if (newRemaining <= 0) {
        setIsOpen(false)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isOpen, firstLoginAt])

  const handleClose = () => {
    setIsOpen(false)
    sessionStorage.setItem('doya_free_hour_dismissed', '1')
    onClose?.()
  }

  // 残り時間を「分:秒」形式に変換
  const formatRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // 進捗率（1時間中の経過%）
  const progressPercent = Math.max(0, Math.min(100, (remainingMs / FREE_HOUR_DURATION_MS) * 100))

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* オーバーレイ（薄暗く） */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          {/* ポップアップ本体 */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div
              className="relative w-full max-w-md bg-gradient-to-br from-amber-50 via-white to-orange-50 rounded-2xl shadow-2xl border border-amber-200/60 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 装飾的な背景グラデーション */}
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 via-transparent to-orange-500/5 pointer-events-none" />
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-amber-400/20 to-orange-400/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-yellow-400/20 to-amber-400/20 rounded-full blur-2xl pointer-events-none" />

              {/* 閉じるボタン */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-500 hover:text-gray-700 transition-colors shadow-sm z-10"
                aria-label="閉じる"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative p-6 space-y-5">
                {/* ヘッダー */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30 mb-2">
                    <Rocket className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    今だけ生成し放題！
                    <Sparkles className="w-5 h-5 text-amber-500" />
                  </h2>
                  <p className="text-sm text-gray-600">
                    Googleログイン後<span className="font-semibold text-amber-600">1時間</span>は
                    <br />
                    <span className="font-bold text-orange-600">バナー生成が無制限</span>でお試しいただけます！
                  </p>
                </div>

                {/* 残り時間表示 */}
                <div className="bg-white/70 rounded-xl p-4 border border-amber-200/50 shadow-inner">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Clock className="w-4 h-4 text-amber-600" />
                      残り時間
                    </div>
                    <div className="text-2xl font-bold text-amber-600 font-mono">
                      {formatRemaining(remainingMs)}
                    </div>
                  </div>
                  {/* プログレスバー */}
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                      initial={{ width: `${progressPercent}%` }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {/* 特典リスト */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>最大<span className="font-bold text-amber-600">10枚</span>まで一度に生成可能</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>カスタムサイズ指定も<span className="font-bold text-amber-600">解放</span></span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>日次上限<span className="font-bold text-amber-600">無制限</span>（1時間限定）</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>履歴機能も<span className="font-bold text-amber-600">解放</span>（再ダウンロード可）</span>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={handleClose}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-lg shadow-amber-500/30 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Rocket className="w-5 h-5" />
                  今すぐ生成を試す！
                </button>

                <p className="text-xs text-center text-gray-500">
                  ※ 1時間経過後は通常の日次上限が適用されます
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

