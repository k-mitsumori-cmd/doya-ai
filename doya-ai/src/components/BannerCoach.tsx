'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronRight,
  Copy,
  Image as ImageIcon,
  Info,
  Lightbulb,
  Loader2,
  Palette,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface BannerCoachProps {
  keyword: string
  category: string
  useCase: string
  selectedVariant?: 'A' | 'B' | 'C'
  selectedImage?: string | null
  onApplyCopy?: (copy: string) => void
  onApplyRefine?: (instruction: string) => Promise<void> | void
  onApplyOverlay?: (overlay: { headline: string; subhead: string; cta: string }) => void
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
  benefit: { label: 'ベネフィット', icon: '💎', gradient: 'from-blue-50 to-cyan-50' },
  urgency: { label: '緊急性', icon: '⚡', gradient: 'from-rose-50 to-amber-50' },
  social_proof: { label: '社会的証明', icon: '👥', gradient: 'from-violet-50 to-indigo-50' },
  question: { label: '質問形式', icon: '❓', gradient: 'from-amber-50 to-yellow-50' },
  emotional: { label: '感情訴求', icon: '❤️', gradient: 'from-pink-50 to-rose-50' },
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    telecom: '通信',
    marketing: 'マーケ',
    ec: 'EC',
    recruit: '採用',
    beauty: '美容',
    food: '飲食',
    realestate: '不動産',
    education: '教育',
    finance: '金融',
    health: '医療',
    it: 'IT',
    other: 'その他',
  }
  return map[category] || category || '(未選択)'
}

function getUseCaseLabel(useCase: string): string {
  const map: Record<string, string> = {
    sns_ad: 'SNS広告',
    youtube: 'YouTube',
    display: 'ディスプレイ',
    webinar: 'ウェビナー',
    lp_hero: 'LP',
    email: 'メール',
    campaign: 'セール',
  }
  return map[useCase] || useCase || '(未選択)'
}

export default function BannerCoach(props: BannerCoachProps) {
  const { keyword, category, useCase, selectedVariant, selectedImage, onApplyCopy, onApplyRefine, onApplyOverlay } = props

  const [activeTab, setActiveTab] = useState<'score' | 'copy' | 'benchmark' | 'fb'>('fb')
  const [isLoading, setIsLoading] = useState(false)
  const [isFbLoading, setIsFbLoading] = useState(false)
  const [score, setScore] = useState<BannerScore | null>(null)
  const [copyVariations, setCopyVariations] = useState<CopyVariations | null>(null)
  const [benchmark, setBenchmark] = useState<IndustryBenchmark | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [fb, setFb] = useState<any | null>(null)
  const [fbInstruction, setFbInstruction] = useState('')
  const [lastError, setLastError] = useState('')

  const hasAny = !!(score || copyVariations || benchmark || fb)

  const inputKey = useMemo(() => {
    const hasImg = !!selectedImage
    return `${keyword}|${category}|${useCase}|${selectedVariant || ''}|${hasImg ? '1' : '0'}`
  }, [keyword, category, useCase, selectedVariant, selectedImage])

  useEffect(() => {
    if (isLoading || isFbLoading) return
    if (!hasAny) return
    setScore(null)
    setCopyVariations(null)
    setBenchmark(null)
    setFb(null)
    setFbInstruction('')
    setLastError('')
    setActiveTab('fb')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey])

  const categoryLabel = useMemo(() => getCategoryLabel(category), [category])
  const useCaseLabel = useMemo(() => getUseCaseLabel(useCase), [useCase])

  const getScoreColor = (v: number) => {
    if (v >= 80) return 'text-emerald-600'
    if (v >= 60) return 'text-amber-600'
    return 'text-rose-600'
  }

  const getScoreGradient = (v: number) => {
    if (v >= 80) return 'from-emerald-500 to-green-500'
    if (v >= 60) return 'from-amber-500 to-yellow-500'
    return 'from-rose-500 to-orange-500'
  }

  const ensureDataUrl = async (src: string): Promise<string> => {
    const s = String(src || '').trim()
    if (!s) throw new Error('画像が空です')
    if (s.startsWith('data:')) return s
    const res = await fetch(s)
    if (!res.ok) throw new Error(`画像の取得に失敗しました: ${res.status}`)
    const blob = await res.blob()
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result || ''))
      fr.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      fr.readAsDataURL(blob)
    })
    if (!dataUrl.startsWith('data:')) throw new Error('画像の変換に失敗しました')
    return dataUrl
  }

  const handleCopyCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    toast.success('コピーしました')
    setTimeout(() => setCopiedIndex(null), 1200)
  }

  const handleApplyCopy = (text: string) => {
    if (onApplyCopy) {
      onApplyCopy(text)
      toast.success('キーワードに適用しました')
    }
  }

  const analyzeWithCoach = async () => {
    if (!category) return toast.error('業種（カテゴリ）を選択してください')
    if (!keyword.trim()) return toast.error('キーワードを入力してください')

    setIsLoading(true)
    setLastError('')
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
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || '分析に失敗しました')
      }
      setScore(result.data.score || null)
      setCopyVariations(result.data.copyVariations || null)
      setBenchmark(result.data.benchmark || null)
      setActiveTab(result.data.score ? 'score' : 'copy')
      toast.success('AI分析が完了しました', { icon: '✨' })
    } catch (e: any) {
      const msg = e?.message || '分析に失敗しました'
      setLastError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const analyzeSelectedBanner = async () => {
    if (!selectedImage) return toast.error('A/B/Cのバナーを選択してください')
    if (!category || !useCase) return toast.error('業種と用途を選択してください')

    setIsFbLoading(true)
    setLastError('')
    const loading = toast.loading('選択バナーを診断中...', { icon: '🔍' })
    try {
      const img = await ensureDataUrl(selectedImage)
      const response = await fetch('/api/banner/coach/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: img,
          category,
          useCase,
          variant: selectedVariant,
          keyword,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'FB生成に失敗しました')
      }
      setFb(result.data)
      setFbInstruction(result.data.refineInstruction || '')
      setActiveTab('fb')
      toast.success('FBを生成しました', { icon: '✅' })
    } catch (e: any) {
      const msg = e?.message || 'FB生成に失敗しました'
      setLastError(msg)
      toast.error(msg)
    } finally {
      toast.dismiss(loading)
      setIsFbLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="relative p-5 border-b border-gray-100">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-50/70 via-fuchsia-50/60 to-violet-50/70" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-gray-900 truncate">AIバナーコーチ</h3>
              <p className="text-xs text-gray-600 truncate">独自便益：画像→改善点→修正指示→ワンクリック適用</p>
            </div>
          </div>
        </div>

        {/* Context pills */}
        <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-white/70 border border-gray-200 text-gray-700 font-semibold">
            業種: {categoryLabel}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/70 border border-gray-200 text-gray-700 font-semibold">
            用途: {useCaseLabel}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/70 border border-gray-200 text-gray-700 font-semibold">
            バナー: {selectedVariant ? `${selectedVariant}案` : '未選択'}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/70 border border-gray-200 text-gray-700 font-semibold">
            キーワード: {keyword?.trim() ? '入力あり' : '未入力'}
          </span>
        </div>

        {/* How-to */}
        <div className="relative mt-4 rounded-2xl border border-violet-200/60 bg-white/70 p-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-violet-600 mt-0.5" />
            <div className="text-sm text-gray-700">
              <div className="font-black text-gray-900 mb-1">使い方（迷ったらこの順番）</div>
              <div className="text-xs text-gray-700 leading-relaxed">
                ① 右の「生成結果」でA/B/Cからバナーを選択 → ② <span className="font-black">選択バナーを診断（FB）</span>
                <br />
                ③ 出てきた <span className="font-black">提案コピー / 修正指示 / テキストレイヤー</span> をボタンで適用
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="relative mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={analyzeSelectedBanner}
            disabled={isFbLoading || !selectedImage}
            className="px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between gap-3"
            title={selectedImage ? '選択バナーを診断（画像FB）' : '先にA/B/Cのバナーを選択してください'}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center">
                {isFbLoading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <ImageIcon className="w-5 h-5 text-white" />}
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-gray-900">選択バナーを診断（FB）</div>
                <div className="text-xs text-gray-600">画像から改善点→修正指示を生成</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={analyzeWithCoach}
            disabled={isLoading || !keyword.trim() || !category}
            className="px-4 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-3 shadow-lg shadow-violet-500/20"
            title={!category ? '先に業種（カテゴリ）を選択してください' : !keyword.trim() ? 'キーワードを入力してください' : '条件から分析'}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <div className="text-sm font-black">条件から分析</div>
                <div className="text-xs text-white/85">スコア/コピー/業界データ</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </div>

      {/* Error */}
      {lastError && (
        <div className="p-5 border-b border-gray-100">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5" />
              <div>
                <div className="text-sm font-black text-rose-700 mb-1">うまく動かない時</div>
                <div className="text-sm text-rose-700">{lastError}</div>
                <div className="text-xs text-rose-600 mt-2">
                  よくある原因：A/B/C未選択 / 業種未選択 / サーバー側の <span className="font-mono">GOOGLE_GENAI_API_KEY</span> 未設定 / 画像がdata URLではない
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasAny ? (
        <div className="p-5">
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-100 flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-violet-600" />
            </div>
            <h4 className="font-black text-gray-900 mb-2">機能の意味（わかりやすく）</h4>
            <p className="text-gray-600 text-sm mb-4">
              <span className="font-black text-gray-900">FB</span>＝画像の改善提案（おすすめ）／
              <span className="font-black text-gray-900"> スコア</span>＝CTR伸びしろ／
              <span className="font-black text-gray-900"> コピー改善</span>＝言い換え案
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['選択バナー診断', '提案コピー', '修正指示（再生成）', 'テキストレイヤー適用'].map((t) => (
                <span key={t} className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {[
              { id: 'fb', label: 'FB（画像診断）', icon: Sparkles },
              { id: 'score', label: 'スコア', icon: BarChart3 },
              { id: 'copy', label: 'コピー改善', icon: Lightbulb },
              { id: 'benchmark', label: '業界データ', icon: TrendingUp },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-3 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all relative ${
                  activeTab === tab.id ? 'text-violet-700' : 'text-gray-500 hover:text-gray-800'
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

          {/* Content */}
          <div className="p-5">
            <AnimatePresence mode="wait">
              {/* FB */}
              {activeTab === 'fb' && (
                <motion.div
                  key="fb"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {!selectedImage ? (
                    <div className="text-center py-6 text-gray-600 text-sm">
                      右の「生成結果」でA/B/Cを選択してから「選択バナーを診断（FB）」を押してください
                    </div>
                  ) : !fb ? (
                    <div className="text-center py-6 text-gray-600 text-sm">
                      「選択バナーを診断（FB）」を押すと、改善提案・提案コピー・修正指示が出ます
                    </div>
                  ) : (
                    <>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">サマリー</div>
                        <div className="text-sm text-gray-900 font-semibold">{fb.summary}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                          <h5 className="font-black text-emerald-700 text-xs mb-2 flex items-center gap-1">
                            <Star className="w-3 h-3" /> 良い点
                          </h5>
                          <ul className="space-y-1">
                            {(fb.strengths || []).slice(0, 4).map((s: string, i: number) => (
                              <li key={i} className="text-[11px] text-gray-700">• {s}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                          <h5 className="font-black text-amber-700 text-xs mb-2 flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" /> 改善点
                          </h5>
                          <ul className="space-y-1">
                            {(fb.issues || []).slice(0, 4).map((s: string, i: number) => (
                              <li key={i} className="text-[11px] text-gray-700">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="text-xs text-gray-500 mb-2">クイック改善（すぐ効く）</div>
                        <div className="flex flex-wrap gap-2">
                          {(fb.quickWins || []).slice(0, 6).map((t: string) => (
                            <span key={t} className="px-2 py-1 rounded-full text-[11px] bg-gray-100 text-gray-700">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-100 rounded-xl p-4">
                        <div className="text-xs text-gray-500 mb-1">提案コピー（CTR重視）</div>
                        <div className="text-sm text-gray-900 font-semibold mb-3">{fb.suggestedCopy}</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApplyCopy(fb.suggestedCopy)}
                            className="px-3 py-1.5 bg-violet-100 text-violet-700 text-xs font-black rounded-lg hover:bg-violet-200 transition-colors"
                          >
                            コピーを適用
                          </button>
                          <button
                            onClick={() => handleCopyCopy(fb.suggestedCopy, 9999)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" /> コピー
                          </button>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="text-xs text-gray-500 mb-2">AI修正指示（このまま再生成できます）</div>
                        <textarea
                          value={fbInstruction}
                          onChange={(e) => setFbInstruction(e.target.value)}
                          rows={4}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button
                            onClick={async () => {
                              if (!onApplyRefine) return
                              await onApplyRefine(fbInstruction)
                            }}
                            disabled={!onApplyRefine || !fbInstruction.trim()}
                            className="px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-black disabled:opacity-50"
                          >
                            この指示で「さらに修正」
                          </button>
                          <button
                            onClick={() => {
                              if (onApplyOverlay && fb?.suggestedOverlay) {
                                onApplyOverlay(fb.suggestedOverlay)
                                toast.success('テキストレイヤーに適用しました')
                              }
                            }}
                            disabled={!onApplyOverlay || !fb?.suggestedOverlay}
                            className="px-3 py-2 rounded-xl bg-white text-gray-900 text-xs font-bold border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                          >
                            テキストレイヤーに適用
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* Score */}
              {activeTab === 'score' && score && (
                <motion.div
                  key="score"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="text-center py-2">
                    <div className="relative inline-flex items-center justify-center">
                      <svg className="w-28 h-28 transform -rotate-90">
                        <circle cx="56" cy="56" r="48" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-100" />
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
                        <span className={`text-3xl font-black ${getScoreColor(score.overall)}`}>{score.overall}</span>
                        <span className="text-xs text-gray-400">/ 100</span>
                      </div>
                    </div>
                    <p className="text-violet-700 font-semibold mt-2">予測CTR: {score.predictedCTR}</p>
                  </div>

                  <div className="space-y-2">
                    {[
                      { key: 'visualImpact', label: '視覚的インパクト', icon: '👁️' },
                      { key: 'messageClarity', label: 'メッセージ明確さ', icon: '💬' },
                      { key: 'ctaEffectiveness', label: 'CTA効果', icon: '🎯' },
                      { key: 'targetRelevance', label: 'ターゲット適合', icon: '👥' },
                    ].map((item) => {
                      const value = score.breakdown[item.key as keyof typeof score.breakdown] as number
                      return (
                        <div key={item.key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <span>{item.icon}</span>
                              {item.label}
                            </span>
                            <span className={`text-sm font-black ${getScoreColor(value)}`}>{value}</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                      <h5 className="font-black text-emerald-700 text-xs mb-2 flex items-center gap-1">
                        <Star className="w-3 h-3" /> 強み
                      </h5>
                      <ul className="space-y-1">
                        {score.strengths.slice(0, 3).map((s, i) => (
                          <li key={i} className="text-[11px] text-gray-700">• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <h5 className="font-black text-amber-700 text-xs mb-2 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> 改善点
                      </h5>
                      <ul className="space-y-1">
                        {score.improvements.slice(0, 3).map((s, i) => (
                          <li key={i} className="text-[11px] text-gray-700">• {s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Copy */}
              {activeTab === 'copy' && copyVariations && (
                <motion.div
                  key="copy"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="relative bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-100 rounded-xl p-4">
                    <div className="absolute -top-2 -right-2">
                      <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10px] font-black rounded-full">
                        AIおすすめ
                      </span>
                    </div>
                    <p className="text-gray-900 font-semibold text-sm mb-2">{copyVariations.bestPick.copy}</p>
                    <p className="text-xs text-gray-600 mb-3">{copyVariations.bestPick.reason}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyCopy(copyVariations.bestPick.copy, -1)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                      >
                        {copiedIndex === -1 ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        コピー
                      </button>
                      <button
                        onClick={() => handleApplyCopy(copyVariations.bestPick.copy)}
                        className="px-3 py-1.5 bg-violet-100 text-violet-700 text-xs font-black rounded-lg hover:bg-violet-200 transition-colors flex items-center gap-1"
                      >
                        <ChevronRight className="w-3 h-3" />
                        適用
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {copyVariations.variations.map((v, i) => {
                      const typeInfo = TYPE_LABELS[v.type] || { label: v.type, icon: '📝', gradient: 'from-gray-50 to-slate-50' }
                      return (
                        <div key={i} className={`bg-gradient-to-br ${typeInfo.gradient} border border-gray-100 rounded-xl p-3`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                              <span>{typeInfo.icon}</span>
                              {typeInfo.label}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                              {v.expectedLift}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 mb-2 font-medium">{v.copy}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-gray-500 flex-1">{v.reason}</p>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => handleCopyCopy(v.copy, i)}
                                className="p-1.5 text-gray-500 hover:text-gray-800 transition-colors"
                              >
                                {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleApplyCopy(v.copy)}
                                className="p-1.5 text-violet-600 hover:text-violet-800 transition-colors"
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

              {/* Benchmark */}
              {activeTab === 'benchmark' && benchmark && (
                <motion.div
                  key="benchmark"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-4">
                    <h5 className="font-black text-blue-700 text-sm mb-3">{benchmark.category}</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">平均CTR</p>
                        <p className="text-2xl font-black text-gray-900">{benchmark.averageCTR}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">トップ</p>
                        <p className="text-2xl font-black text-emerald-700">{benchmark.topPerformerCTR}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                      <h5 className="font-black text-emerald-700 text-xs mb-2">✓ 成功パターン</h5>
                      <ul className="space-y-1">
                        {benchmark.commonPatterns.slice(0, 3).map((p, i) => (
                          <li key={i} className="text-[10px] text-gray-700">• {p}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                      <h5 className="font-black text-rose-700 text-xs mb-2">✗ 避けるべき</h5>
                      <ul className="space-y-1">
                        {benchmark.avoidPatterns.slice(0, 3).map((p, i) => (
                          <li key={i} className="text-[10px] text-gray-700">• {p}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <h5 className="font-black text-gray-800 text-xs mb-2 flex items-center gap-1">
                      <Palette className="w-3 h-3" /> 推奨カラー
                    </h5>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg shadow-inner border border-gray-200" style={{ backgroundColor: benchmark.colorRecommendations.primary.split(' ')[0] }} />
                      <div className="w-8 h-8 rounded-lg shadow-inner border border-gray-200" style={{ backgroundColor: benchmark.colorRecommendations.accent.split(' ')[0] }} />
                      <div className="text-[10px] text-gray-600 flex-1">{benchmark.colorRecommendations.reason}</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}

 