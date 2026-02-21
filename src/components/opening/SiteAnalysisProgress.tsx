'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Globe, Palette, Image, Type, Sparkles } from 'lucide-react'

const STEPS = [
  { id: 'access', label: 'サイトにアクセス中...', icon: Globe, detail: 'ターゲットサイトに接続しました' },
  { id: 'colors', label: 'カラースキームを抽出中...', icon: Palette, detail: 'ドミナントカラーを特定しました' },
  { id: 'logo', label: 'ロゴを検出中...', icon: Image, detail: 'ブランドアセットをスキャンしました' },
  { id: 'text', label: 'テキストを解析中...', icon: Type, detail: 'コンテンツを分析しました' },
  { id: 'generate', label: 'アニメーションを生成中...', icon: Sparkles, detail: 'テンプレートを最適化しています' },
]

interface SiteAnalysisProgressProps {
  url: string
  colors?: string[]
}

export default function SiteAnalysisProgress({ url, colors }: SiteAnalysisProgressProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [showWaiting, setShowWaiting] = useState(false)

  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setCurrentStep(i + 1), (i + 1) * 2500)
    )
    // 全ステップ完了後、まだ表示されている場合は待機メッセージを表示
    const waitTimer = setTimeout(() => setShowWaiting(true), STEPS.length * 2500 + 3000)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(waitTimer)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      {/* URL表示 */}
      <motion.div
        className="mb-12 text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-sm text-white/40 mb-2">解析対象</p>
        <p className="text-lg font-mono text-[#EF4343] animate-pulse">{url}</p>
      </motion.div>

      {/* Steps */}
      <div className="w-full max-w-md space-y-1">
        {STEPS.map((step, i) => {
          const status = i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending'
          return (
            <motion.div
              key={step.id}
              className="flex items-start gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {/* Icon */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                    status === 'done'
                      ? 'bg-[#EF4343] text-white shadow-[0_0_20px_rgba(239,67,67,0.3)]'
                      : status === 'active'
                      ? 'bg-[#EF4343]/20 text-[#EF4343] border border-[#EF4343]/40'
                      : 'bg-white/5 text-white/30'
                  }`}
                >
                  {status === 'done' ? (
                    <Check className="h-4 w-4" />
                  ) : status === 'active' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-0.5 h-8 ${status === 'done' ? 'bg-[#EF4343]/30' : 'bg-white/5'}`} />
                )}
              </div>

              {/* Text */}
              <div className="pt-1 pb-4">
                <p className={`font-medium ${status === 'pending' ? 'text-white/30' : 'text-white'}`}>
                  {step.label}
                </p>
                <AnimatePresence>
                  {status === 'done' && (
                    <motion.p
                      className="text-sm text-[#EF4343]/60"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.3 }}
                    >
                      {step.detail}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* 全ステップ完了後の待機メッセージ */}
      <AnimatePresence>
        {showWaiting && (
          <motion.div
            className="mt-8 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-[#EF4343]" />
            <p className="text-sm text-white/50">最終処理中です。もう少々お待ちください...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extracted colors preview */}
      {colors && colors.length > 0 && (
        <motion.div
          className="mt-8 flex gap-2"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          {colors.slice(0, 5).map((c, i) => (
            <motion.div
              key={i}
              className="h-8 w-8 rounded-full border border-white/10"
              style={{ backgroundColor: c }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1, type: 'spring' }}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}
