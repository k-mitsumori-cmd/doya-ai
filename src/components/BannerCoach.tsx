'use client'

import { useState } from 'react'
import { 
  Sparkles, Loader2, TrendingUp, Lightbulb, Target, 
  Palette, BarChart3, Copy, Check, ChevronRight,
  Star, Zap, Award
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
        toast.success('AI分析が完了しました！')
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
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    benefit: { label: 'ベネフィット', icon: '💎', color: 'bg-blue-100 text-blue-700' },
    urgency: { label: '緊急性', icon: '⚡', color: 'bg-red-100 text-red-700' },
    social_proof: { label: '社会的証明', icon: '👥', color: 'bg-purple-100 text-purple-700' },
    question: { label: '質問形式', icon: '❓', color: 'bg-amber-100 text-amber-700' },
    emotional: { label: '感情訴求', icon: '❤️', color: 'bg-pink-100 text-pink-700' },
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold">AIバナーコーチ</h3>
              <p className="text-white/70 text-sm">プロの視点で分析・改善提案</p>
            </div>
          </div>
          <button
            onClick={analyzeWithCoach}
            disabled={isLoading || !keyword.trim()}
            className="px-4 py-2 bg-white text-violet-600 font-bold rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

      {/* タブ */}
      {(score || copyVariations || benchmark) && (
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { id: 'score', label: '品質スコア', icon: BarChart3 },
              { id: 'copy', label: 'コピー改善', icon: Lightbulb },
              { id: 'benchmark', label: '業界データ', icon: TrendingUp },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* コンテンツ */}
      <div className="p-4">
        {!score && !copyVariations && !benchmark ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-violet-500" />
            </div>
            <h4 className="font-bold text-gray-900 mb-2">AIがバナーを分析</h4>
            <p className="text-gray-500 text-sm mb-4">
              キーワードを入力して「AI分析」をクリックすると、<br />
              品質スコア・改善提案・業界データが表示されます
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['品質スコアリング', 'コピー改善5案', 'CTR予測', '業界ベンチマーク'].map((feature) => (
                <span key={feature} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* 品質スコアタブ */}
            {activeTab === 'score' && score && (
              <div className="space-y-4">
                {/* 総合スコア */}
                <div className="text-center py-4">
                  <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${getScoreBg(score.overall)}`}>
                    <span className={`text-4xl font-bold ${getScoreColor(score.overall)}`}>
                      {score.overall}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-2">総合スコア</p>
                  <p className="text-violet-600 font-medium mt-1">
                    予測CTR: {score.predictedCTR}
                  </p>
                </div>

                {/* 内訳 */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'visualImpact', label: '視覚的インパクト' },
                    { key: 'messageClarity', label: 'メッセージ明確さ' },
                    { key: 'ctaEffectiveness', label: 'CTA効果' },
                    { key: 'targetRelevance', label: 'ターゲット適合' },
                  ].map((item) => (
                    <div key={item.key} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">{item.label}</span>
                        <span className={`text-sm font-bold ${getScoreColor(score.breakdown[item.key as keyof typeof score.breakdown])}`}>
                          {score.breakdown[item.key as keyof typeof score.breakdown]}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            score.breakdown[item.key as keyof typeof score.breakdown] >= 80 ? 'bg-green-500' :
                            score.breakdown[item.key as keyof typeof score.breakdown] >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${score.breakdown[item.key as keyof typeof score.breakdown]}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 強み・改善点 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-xl p-3">
                    <h5 className="font-bold text-green-700 text-sm mb-2 flex items-center gap-1">
                      <Star className="w-4 h-4" /> 強み
                    </h5>
                    <ul className="space-y-1">
                      {score.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-green-700">• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <h5 className="font-bold text-amber-700 text-sm mb-2 flex items-center gap-1">
                      <Lightbulb className="w-4 h-4" /> 改善点
                    </h5>
                    <ul className="space-y-1">
                      {score.improvements.map((s, i) => (
                        <li key={i} className="text-xs text-amber-700">• {s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* コピー改善タブ */}
            {activeTab === 'copy' && copyVariations && (
              <div className="space-y-3">
                {/* ベストピック */}
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-violet-600" />
                    <span className="font-bold text-violet-700">AIおすすめ</span>
                  </div>
                  <p className="text-gray-900 font-medium mb-2">{copyVariations.bestPick.copy}</p>
                  <p className="text-sm text-gray-600 mb-3">{copyVariations.bestPick.reason}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyCopy(copyVariations.bestPick.copy, -1)}
                      className="px-3 py-1.5 bg-white text-violet-600 text-sm font-medium rounded-lg hover:bg-violet-100 transition-colors flex items-center gap-1"
                    >
                      {copiedIndex === -1 ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      コピー
                    </button>
                    <button
                      onClick={() => handleApplyCopy(copyVariations.bestPick.copy)}
                      className="px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-1"
                    >
                      <ChevronRight className="w-4 h-4" />
                      適用
                    </button>
                  </div>
                </div>

                {/* バリエーション */}
                <div className="space-y-2">
                  {copyVariations.variations.map((v, i) => {
                    const typeInfo = TYPE_LABELS[v.type] || { label: v.type, icon: '📝', color: 'bg-gray-100 text-gray-700' }
                    return (
                      <div key={i} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeInfo.color}`}>
                            {typeInfo.icon} {typeInfo.label}
                          </span>
                          <span className="text-xs text-green-600 font-medium">{v.expectedLift}</span>
                        </div>
                        <p className="text-sm text-gray-900 mb-2">{v.copy}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">{v.reason}</p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleCopyCopy(v.copy, i)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {copiedIndex === i ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleApplyCopy(v.copy)}
                              className="p-1.5 text-violet-400 hover:text-violet-600 transition-colors"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 業界データタブ */}
            {activeTab === 'benchmark' && benchmark && (
              <div className="space-y-4">
                {/* CTR情報 */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4">
                  <h5 className="font-bold text-blue-700 mb-3">{benchmark.category} 業界データ</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">平均CTR</p>
                      <p className="text-2xl font-bold text-blue-600">{benchmark.averageCTR}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">トップパフォーマー</p>
                      <p className="text-2xl font-bold text-green-600">{benchmark.topPerformerCTR}</p>
                    </div>
                  </div>
                </div>

                {/* 成功パターン */}
                <div className="bg-green-50 rounded-xl p-4">
                  <h5 className="font-bold text-green-700 text-sm mb-2">✓ 成功パターン</h5>
                  <ul className="space-y-1">
                    {benchmark.commonPatterns.map((p, i) => (
                      <li key={i} className="text-xs text-green-700">• {p}</li>
                    ))}
                  </ul>
                </div>

                {/* 避けるべきパターン */}
                <div className="bg-red-50 rounded-xl p-4">
                  <h5 className="font-bold text-red-700 text-sm mb-2">✗ 避けるべきパターン</h5>
                  <ul className="space-y-1">
                    {benchmark.avoidPatterns.map((p, i) => (
                      <li key={i} className="text-xs text-red-700">• {p}</li>
                    ))}
                  </ul>
                </div>

                {/* カラー推奨 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h5 className="font-bold text-gray-700 text-sm mb-2 flex items-center gap-1">
                    <Palette className="w-4 h-4" /> 推奨カラー
                  </h5>
                  <div className="flex items-center gap-3 mb-2">
                    <div 
                      className="w-10 h-10 rounded-lg shadow-inner" 
                      style={{ backgroundColor: benchmark.colorRecommendations.primary.split(' ')[0] }}
                    />
                    <div 
                      className="w-10 h-10 rounded-lg shadow-inner" 
                      style={{ backgroundColor: benchmark.colorRecommendations.accent.split(' ')[0] }}
                    />
                    <div className="text-xs text-gray-600">
                      <p>メイン: {benchmark.colorRecommendations.primary}</p>
                      <p>アクセント: {benchmark.colorRecommendations.accent}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{benchmark.colorRecommendations.reason}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

