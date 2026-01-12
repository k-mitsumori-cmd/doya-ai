'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Target, Lightbulb, TrendingUp, BarChart3, CheckCircle2 } from 'lucide-react'
import { LpGenerationResult } from '@/lib/lp-site/types'
import confetti from 'canvas-confetti'

interface CompletionModalProps {
  open: boolean
  onClose: () => void
  result: LpGenerationResult
}

export function CompletionModal({ open, onClose, result }: CompletionModalProps) {
  React.useEffect(() => {
    if (open) {
      // 派手な紙吹雪アニメーション
      const duration = 3000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min
      }

      const interval: NodeJS.Timeout = setInterval(function() {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        })
      }, 250)
    }
  }, [open])

  if (!open) return null

  const { product_info, sections, competitor_research } = result

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 背景オーバーレイ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300]"
          />
          
          {/* モーダル */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none"
          >
            <motion.div
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* グローエフェクト */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-teal-500/20 via-cyan-500/20 to-blue-500/20 rounded-3xl pointer-events-none"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              />
              
              <div className="relative z-10">
                {/* ヘッダー */}
                <div className="sticky top-0 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 p-6 rounded-t-3xl flex items-center justify-between">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </motion.div>
                  <div className="flex-1 ml-4">
                    <motion.h2
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-2xl font-black text-white mb-1"
                    >
                      LP生成が完了しました！🎉
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-white/90 text-sm"
                    >
                      生成されたテーマと分析内容をご確認ください
                    </motion.p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* コンテンツ */}
                <div className="p-6 space-y-6">
                  {/* 商品情報 */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-6 border-2 border-teal-200"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900">生成テーマ</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-bold text-teal-700 mb-1">商品名</div>
                        <div className="text-lg font-bold text-slate-900">{product_info.product_name}</div>
                      </div>
                      {product_info.target && (
                        <div>
                          <div className="text-xs font-bold text-teal-700 mb-1">ターゲット</div>
                          <div className="text-sm text-slate-700">{product_info.target}</div>
                        </div>
                      )}
                      {product_info.problem && (
                        <div>
                          <div className="text-xs font-bold text-teal-700 mb-1">解決する課題</div>
                          <div className="text-sm text-slate-700">{product_info.problem}</div>
                        </div>
                      )}
                      {product_info.solution && (
                        <div>
                          <div className="text-xs font-bold text-teal-700 mb-1">提供価値</div>
                          <div className="text-sm text-slate-700">{product_info.solution}</div>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* LP構成 */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Target className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900">LP構成 ({sections.length}セクション)</h3>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {sections.map((section, index) => (
                        <motion.div
                          key={section.section_id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + index * 0.05 }}
                          className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-purple-200"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center font-black text-xs">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-bold text-slate-900">{section.headline}</div>
                              <div className="text-xs text-slate-600">{section.section_type}</div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  {/* 競合分析 */}
                  {competitor_research && competitor_research.competitors && competitor_research.competitors.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                          <BarChart3 className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900">競合分析</h3>
                      </div>
                      {competitor_research.summary && (
                        <div className="mb-4 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-blue-200">
                          <div className="text-xs font-bold text-blue-900 mb-2">分析サマリー</div>
                          <div className="text-sm text-blue-800 leading-relaxed">{competitor_research.summary}</div>
                        </div>
                      )}
                      {competitor_research.differentiation_strategy && (
                        <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-blue-200">
                          <div className="text-xs font-bold text-blue-900 mb-2">差別化戦略</div>
                          <div className="text-sm text-blue-800 leading-relaxed">{competitor_research.differentiation_strategy}</div>
                        </div>
                      )}
                      <div className="mt-4 text-xs text-blue-700">
                        {competitor_research.competitors.length}件の類似サービスを分析しました
                      </div>
                    </motion.div>
                  )}

                  {/* アクションボタン */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex gap-3"
                  >
                    <button
                      onClick={onClose}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-black rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl"
                    >
                      LPを確認する
                    </button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

