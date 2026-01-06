'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Globe, Layout, Image as ImageIcon, Package, CheckCircle2, Loader2, Zap } from 'lucide-react'
import confetti from 'canvas-confetti'

type OverlayMood = 'idle' | 'search' | 'think' | 'happy'

interface LpGenerationOverlayProps {
  open: boolean
  progress: number // 0-100
  stageText: string
  mood: OverlayMood
  steps: { label: string; threshold: number; icon: React.ElementType }[]
}

const loadingTips = [
  '商品情報を分析し、最適なLP構成を検討しています…',
  'ターゲットに響くコピーとレイアウトを設計しています。',
  'PC/SP別のワイヤーフレームを生成中…',
  '各セクションの画像を高品質で生成しています。',
  'すべてのアセットを整理し、ダウンロード準備を進めています…',
  'まもなく完了します。しばらくそのままお待ちください。',
]

export function LpGenerationOverlay({
  open,
  progress,
  stageText,
  mood,
  steps,
}: LpGenerationOverlayProps) {
  const p = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  const [tipIndex, setTipIndex] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [hasShownConfetti, setHasShownConfetti] = useState(false)

  // 完了時に紙吹雪
  useEffect(() => {
    if (p >= 100 && !hasShownConfetti && open) {
      setHasShownConfetti(true)
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6'],
      })
    }
  }, [p, hasShownConfetti, open])

  // ヒントのローテーション
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % loadingTips.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [open])

  // 経過時間のカウント
  useEffect(() => {
    if (!open) {
      setElapsedTime(0)
      return
    }
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [open])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const currentStepIndex = useMemo(() => {
    return Math.max(0, steps.findIndex((s) => p < s.threshold))
  }, [p, steps])

  const mascotAnim = useMemo(() => {
    if (mood === 'happy') return { rotate: [0, 8, -8, 0], y: [0, -2, 0] }
    if (mood === 'search') return { rotate: [0, -2, 2, 0], y: [0, -4, 0] }
    if (mood === 'think') return { rotate: 0, y: [0, -2, 0] }
    return { rotate: 0, y: 0 }
  }, [mood])

  return (
    <>
      {/* 動く背景 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-[199]"
          >
            <motion.div
              animate={{
                background: [
                  'radial-gradient(circle at 20% 80%, rgba(20, 184, 166, 0.15) 0%, transparent 50%)',
                  'radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.15) 0%, transparent 50%)',
                ],
              }}
              transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
              className="absolute inset-0"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
              className="absolute -bottom-48 -right-48 w-[560px] h-[560px] rounded-full bg-teal-400/20 blur-3xl"
            />
            <motion.div
              animate={{ y: [0, -18, 0] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-24 right-20 w-56 h-56 rounded-full bg-cyan-300/20 blur-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* メインオーバーレイ */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="w-full max-w-4xl rounded-3xl border border-white/10 bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden"
            >
              {/* ヘッダー */}
              <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-cyan-50">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {/* マスコットアイコン */}
                    <motion.div
                      animate={mascotAnim}
                      transition={{
                        duration: 0.7,
                        repeat: mood !== 'idle' ? Infinity : 0,
                        repeatType: 'mirror',
                        ease: 'easeInOut',
                      }}
                      className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20"
                    >
                      <Globe className="w-6 h-6 text-white" />
                    </motion.div>
                    <div className="w-11 h-11 rounded-2xl bg-white/80 border border-teal-200 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-teal-600" />
                    </div>
                    <div>
                      <div className="text-slate-900 font-black text-lg leading-tight">LP生成中</div>
                      <div className="text-teal-600 text-xs font-bold mt-1">{stageText}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-500 font-bold">
                      {formatTime(elapsedTime)}
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-teal-200 border-t-teal-500 animate-spin" />
                  </div>
                </div>

                {/* ステップインジケーター */}
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {steps.map((s, i) => {
                    const active = p >= s.threshold
                    const isCurrent = i === currentStepIndex
                    const Icon = s.icon
                    return (
                      <div key={`${s.label}-${i}`} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                          isCurrent
                            ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30 scale-110'
                            : active
                              ? 'bg-teal-100 text-teal-600'
                              : 'bg-gray-100 text-gray-300'
                        }`}>
                          {isCurrent ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <div className={`text-[11px] font-black ${active ? 'text-slate-900' : 'text-gray-400'}`}>
                          {s.label}
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`w-6 h-px ${active ? 'bg-teal-300' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* プログレスバー */}
                <div className="mt-4 h-3 rounded-full bg-gray-100 overflow-hidden border border-gray-200 shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 relative"
                  >
                    <motion.div
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    />
                  </motion.div>
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <span>進捗</span>
                  <span className="text-teal-600">{Math.round(p)}%</span>
                </div>
              </div>

              {/* コンテンツエリア */}
              <div className="p-6">
                {/* ステップカード */}
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  {steps.slice(0, 3).map((s, i) => {
                    const active = p >= s.threshold
                    const Icon = s.icon
                    return (
                      <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * i, duration: 0.3, ease: 'easeOut' }}
                        className={`rounded-2xl border p-4 transition-all ${
                          active
                            ? 'bg-teal-50 border-teal-200 shadow-sm'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            active
                              ? 'bg-teal-500 text-white'
                              : 'bg-gray-200 text-gray-400'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className={`font-black text-sm ${active ? 'text-slate-900' : 'text-gray-400'}`}>
                            {s.label}
                          </div>
                        </div>
                        <div className={`text-xs font-bold ${active ? 'text-gray-600' : 'text-gray-400'}`}>
                          {active ? '完了' : '処理中...'}
                        </div>
                        {!active && (
                          <motion.div
                            key={p}
                            initial={{ x: '-40%' }}
                            animate={{ x: '140%' }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            className="mt-3 h-1 w-1/2 rounded-full bg-gradient-to-r from-transparent via-teal-300 to-transparent"
                          />
                        )}
                      </motion.div>
                    )
                  })}
                </div>

                {/* ローテーションするヒント */}
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl p-5 border border-teal-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tipIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-start gap-4"
                    >
                      <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-teal-600 uppercase tracking-[0.2em] mb-1">ドヤTip</p>
                        <p className="text-sm text-gray-700 font-medium leading-relaxed">
                          {loadingTips[tipIndex]}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

