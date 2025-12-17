'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, Loader2, TrendingUp, Lightbulb, 
  Palette, BarChart3, Copy, Check, ChevronRight,
  Star, Zap, Award, Target
} from 'lucide-react'
import toast from 'react-hot-toast'

interface BannerCoachProps {
  keyword: string
  category: string
  useCase: string
  onApplyCopy?: (copy: string) => void
}

interface BannerScore {
  overall: number
  breakdown: {
    visualImpact: number
    messageClarity: number
    ctaEffectiveness: number
    brandConsistency: number
    targetRelevance: number
  }
  strengths: string[]
  improvements: string[]
  predictedCTR: string
}

interface CopyVariation {
  type: string
  copy: string
  reason: string
  expectedLift: string
}

interface CopyVariations {
  original: string
  variations: CopyVariation[]
  bestPick: {
    copy: string
    reason: string
  }
}

interface IndustryBenchmark {
  category: string
  averageCTR: string
  topPerformerCTR: string
  commonPatterns: string[]
  avoidPatterns: string[]
  colorRecommendations: {
    primary: string
    accent: string
    reason: string
  }
}

const TYPE_LABELS: Record<string, { label: string; icon: string; gradient: string }> = {
  benefit: { label: 'ベネフィット', icon: '💎', gradient: 'from-blue-500/20 to-cyan-500/20' },
  urgency: { label: '緊急性', icon: '⚡', gradient: 'from-red-500/20 to-orange-500/20' },
  social_proof: { label: '社会的証明', icon: '👥', gradient: 'from-purple-500/20 to-violet-500/20' },
  question: { label: '質問形式', icon: '❓', gradient: 'from-amber-500/20 to-yellow-500/20' },
  emotional: { label: '感情訴求', icon: '❤️', gradient: 'from-pink-500/20 to-rose-500/20' },
}

export default function BannerCoach({ keyword, category, useCase, onApplyCopy }: BannerCoachProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'score' | 'copy' | 'benchmark'>('score')
  const [score, setScore] = useState<BannerScore | null>(null)
  const [copyVariations, setCopyVariations] = useState<CopyVariations | null>(null)
  const [benchmark, setBenchmark] = useState<IndustryBenchmark | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const analyzeWithCoach = async () => {
    if (!keyword.trim()) {
      toast.error('キーワードを入力してください')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/banner/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'full',
          keyword,
          category,
          useCase,
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        setScore(result.data.score)
        setCopyVariations(result.data.copyVariations)
        setBenchmark(result.data.benchmark)
        toast.success('AI分析が完了しました！', { icon: '✨' })
      } else {
        toast.error(result.error || '分析に失敗しました')
      }
    } catch (error) {
      toast.error('エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyCopy = (copy: string, index: number) => {
    navigator.clipboard.writeText(copy)
    setCopiedIndex(index)
    toast.success('コピーしました')
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleApplyCopy = (copy: string) => {
    if (onApplyCopy) {
      onApplyCopy(copy)
      toast.success('キーワードに適用しました')
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 60) return 'text-amber-400'
    return 'text-red-400'
  }

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-green-500'
    if (score >= 60) return 'from-amber-500 to-yellow-500'
    return 'from-red-500 to-orange-500'
  }

  return (
    <div className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="relative p-5 border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-violet-500/10" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">AIバナーコーチ</h3>
              <p className="text-xs text-white/50">プロの視点で分析・改善提案</p>
            </div>
          </div>
          <button
            onClick={analyzeWithCoach}
            disabled={isLoading || !keyword.trim()}
            className="px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm shadow-lg shadow-violet-500/25"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                AI分析
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      {(score || copyVariations || benchmark) && (
        <div className="flex border-b border-white/5">
          {[
            { id: 'score', label: 'スコア', icon: BarChart3 },
            { id: 'copy', label: 'コピー改善', icon: Lightbulb },
            { id: 'benchmark', label: '業界データ', icon: TrendingUp },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all relative ${
                activeTab === tab.id
                  ? 'text-violet-400'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {!score && !copyVariations && !benchmark ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-violet-400" />
            </div>
            <h4 className="font-bold text-white mb-2">AIがバナーを分析</h4>
            <p className="text-white/40 text-sm mb-4">
              キーワードを入力して「AI分析」をクリック
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['品質スコア', 'コピー5案', 'CTR予測', '業界データ'].map((feature) => (
                <span key={feature} className="px-3 py-1 bg-white/5 rounded-full text-xs text-white/40">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* Score Tab */}
            {activeTab === 'score' && score && (
              <motion.div
                key="score"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Overall Score */}
                <div className="text-center py-4">
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-28 h-28 transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r="48"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-white/10"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="48"
                        stroke="url(#scoreGradient)"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${score.overall * 3.01} 301`}
                      />
                      <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#D946EF" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-3xl font-bold ${getScoreColor(score.overall)}`}>
                        {score.overall}
                      </span>
                      <span className="text-xs text-white/40">/ 100</span>
                    </div>
                  </div>
                  <p className="text-violet-400 font-medium mt-2">
                    予測CTR: {score.predictedCTR}
                  </p>
                </div>

                {/* Breakdown */}
                <div className="space-y-2">
                  {[
                    { key: 'visualImpact', label: '視覚的インパクト', icon: '👁️' },
                    { key: 'messageClarity', label: 'メッセージ明確さ', icon: '💬' },
                    { key: 'ctaEffectiveness', label: 'CTA効果', icon: '🎯' },
                    { key: 'targetRelevance', label: 'ターゲット適合', icon: '👥' },
                  ].map((item) => {
                    const value = score.breakdown[item.key as keyof typeof score.breakdown]
                    return (
                      <div key={item.key} className="bg-white/5 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-white/60 flex items-center gap-1">
                            <span>{item.icon}</span>
                            {item.label}
                          </span>
                          <span className={`text-sm font-bold ${getScoreColor(value)}`}>
                            {value}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${value}%` }}
                            className={`h-full rounded-full bg-gradient-to-r ${getScoreGradient(value)}`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Strengths & Improvements */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <h5 className="font-bold text-emerald-400 text-xs mb-2 flex items-center gap-1">
                      <Star className="w-3 h-3" /> 強み
                    </h5>
                    <ul className="space-y-1">
                      {score.strengths.slice(0, 2).map((s, i) => (
                        <li key={i} className="text-[11px] text-white/60">• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <h5 className="font-bold text-amber-400 text-xs mb-2 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" /> 改善点
                    </h5>
                    <ul className="space-y-1">
                      {score.improvements.slice(0, 2).map((s, i) => (
                        <li key={i} className="text-[11px] text-white/60">• {s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Copy Tab */}
            {activeTab === 'copy' && copyVariations && (
              <motion.div
                key="copy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {/* Best Pick */}
                <div className="relative bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/30 rounded-xl p-4">
                  <div className="absolute -top-2 -right-2">
                    <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10px] font-bold rounded-full">
                      AIおすすめ
                    </span>
                  </div>
                  <p className="text-white font-medium text-sm mb-2">{copyVariations.bestPick.copy}</p>
                  <p className="text-xs text-white/50 mb-3">{copyVariations.bestPick.reason}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyCopy(copyVariations.bestPick.copy, -1)}
                      className="px-3 py-1.5 bg-white/10 text-white/80 text-xs font-medium rounded-lg hover:bg-white/20 transition-colors flex items-center gap-1"
                    >
                      {copiedIndex === -1 ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      コピー
                    </button>
                    <button
                      onClick={() => handleApplyCopy(copyVariations.bestPick.copy)}
                      className="px-3 py-1.5 bg-violet-500/20 text-violet-300 text-xs font-medium rounded-lg hover:bg-violet-500/30 transition-colors flex items-center gap-1"
                    >
                      <ChevronRight className="w-3 h-3" />
                      適用
                    </button>
                  </div>
                </div>

                {/* Variations */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {copyVariations.variations.map((v, i) => {
                    const typeInfo = TYPE_LABELS[v.type] || { label: v.type, icon: '📝', gradient: 'from-gray-500/20 to-slate-500/20' }
                    return (
                      <div key={i} className={`bg-gradient-to-br ${typeInfo.gradient} border border-white/5 rounded-xl p-3`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-white/60 flex items-center gap-1">
                            <span>{typeInfo.icon}</span>
                            {typeInfo.label}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            {v.expectedLift}
                          </span>
                        </div>
                        <p className="text-sm text-white mb-2">{v.copy}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-white/40 flex-1">{v.reason}</p>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => handleCopyCopy(v.copy, i)}
                              className="p-1.5 text-white/40 hover:text-white transition-colors"
                            >
                              {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleApplyCopy(v.copy)}
                              className="p-1.5 text-violet-400 hover:text-violet-300 transition-colors"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Benchmark Tab */}
            {activeTab === 'benchmark' && benchmark && (
              <motion.div
                key="benchmark"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* CTR Data */}
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
                  <h5 className="font-bold text-blue-400 text-sm mb-3">{benchmark.category}</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wide">平均CTR</p>
                      <p className="text-2xl font-bold text-white">{benchmark.averageCTR}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wide">トップ</p>
                      <p className="text-2xl font-bold text-emerald-400">{benchmark.topPerformerCTR}</p>
                    </div>
                  </div>
                </div>

                {/* Patterns */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <h5 className="font-bold text-emerald-400 text-xs mb-2">✓ 成功パターン</h5>
                    <ul className="space-y-1">
                      {benchmark.commonPatterns.slice(0, 3).map((p, i) => (
                        <li key={i} className="text-[10px] text-white/60">• {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <h5 className="font-bold text-red-400 text-xs mb-2">✗ 避けるべき</h5>
                    <ul className="space-y-1">
                      {benchmark.avoidPatterns.slice(0, 3).map((p, i) => (
                        <li key={i} className="text-[10px] text-white/60">• {p}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Color Recommendations */}
                <div className="bg-white/5 rounded-xl p-3">
                  <h5 className="font-bold text-white/80 text-xs mb-2 flex items-center gap-1">
                    <Palette className="w-3 h-3" /> 推奨カラー
                  </h5>
                  <div className="flex items-center gap-3 mb-2">
                    <div 
                      className="w-8 h-8 rounded-lg shadow-inner border border-white/10" 
                      style={{ backgroundColor: benchmark.colorRecommendations.primary.split(' ')[0] }}
                    />
                    <div 
                      className="w-8 h-8 rounded-lg shadow-inner border border-white/10" 
                      style={{ backgroundColor: benchmark.colorRecommendations.accent.split(' ')[0] }}
                    />
                    <div className="text-[10px] text-white/50 flex-1">
                      {benchmark.colorRecommendations.reason}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
