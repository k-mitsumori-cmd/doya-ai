'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface InterviewUpgradeCelebrationProps {
  isOpen: boolean
  onClose: () => void
  planName?: string
}

const PRO_FEATURES = [
  { icon: 'mic', text: '毎月150分まで文字起こし', highlight: true },
  { icon: 'cloud_upload', text: 'アップロード最大2GB', highlight: false },
  { icon: 'fact_check', text: 'ファクトチェック機能', highlight: false },
  { icon: 'translate', text: '10言語への翻訳', highlight: false },
  { icon: 'share', text: 'SNS投稿文の自動生成', highlight: false },
  { icon: 'all_inclusive', text: '履歴保存（無制限）', highlight: false },
  { icon: 'support_agent', text: '優先サポート', highlight: false },
]

export default function InterviewUpgradeCelebration({
  isOpen,
  onClose,
  planName = 'PRO',
}: InterviewUpgradeCelebrationProps) {
  const [showContent, setShowContent] = useState(false)

  const planLabel = planName === 'ENTERPRISE' ? 'エンタープライズ' : 'プロ'

  useEffect(() => {
    if (isOpen) {
      // 紙吹雪アニメーション
      const duration = 3 * 1000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 }

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min
      }

      const interval: ReturnType<typeof setInterval> = setInterval(function () {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#7f19e6', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#7f19e6', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
        })
      }, 250)

      // コンテンツを少し遅れて表示
      setTimeout(() => setShowContent(true), 300)

      return () => clearInterval(interval)
    } else {
      setShowContent(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 背景グラデーション */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#7f19e6]/10 via-blue-500/5 to-transparent" />

          {/* 閉じるボタン */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors z-10"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-500">close</span>
          </button>

          <div className="relative p-8 text-center">
            {/* アイコンとお祝いメッセージ */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.2, damping: 15 }}
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-br from-[#7f19e6] to-blue-600 shadow-lg shadow-[#7f19e6]/30"
            >
              <span className="material-symbols-outlined text-white text-[40px]">workspace_premium</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[20px] text-[#7f19e6]">celebration</span>
                <span className="text-sm font-bold text-slate-500">UPGRADE COMPLETE</span>
                <span className="material-symbols-outlined text-[20px] text-[#7f19e6] transform scale-x-[-1]">celebration</span>
              </div>

              <h2 className="text-2xl font-black text-slate-900 mb-2">
                おめでとうございます！
              </h2>

              <p className="text-slate-600 text-sm mb-6">
                {planLabel}プランへのアップグレードが完了しました。<br />
                ご登録ありがとうございます！
              </p>
            </motion.div>

            {/* 新機能リスト */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showContent ? 1 : 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-50 rounded-2xl p-4 mb-6 text-left"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[16px] text-[#7f19e6]">auto_awesome</span>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  できることが増えました！
                </span>
              </div>

              <ul className="space-y-2">
                {PRO_FEATURES.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className={`flex items-center gap-3 p-2 rounded-xl ${
                      feature.highlight ? 'bg-blue-100' : 'bg-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      feature.highlight
                        ? 'bg-[#7f19e6] text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className="material-symbols-outlined text-[16px]">{feature.icon}</span>
                    </div>
                    <span className={`text-sm font-medium ${
                      feature.highlight ? 'text-slate-900 font-bold' : 'text-slate-700'
                    }`}>
                      {feature.text}
                    </span>
                    <span className="material-symbols-outlined text-[16px] ml-auto text-[#7f19e6]">
                      check_circle
                    </span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* CTAボタン */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              onClick={onClose}
              className="w-full py-4 px-6 rounded-2xl font-bold text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-[#7f19e6] to-blue-600 hover:from-[#152e70] hover:to-blue-700 shadow-lg shadow-[#7f19e6]/30"
            >
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                さっそく使ってみる
              </span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
