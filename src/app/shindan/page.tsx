'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  Loader2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Search,
  Sparkles,
  Shield,
  TrendingUp,
  ChevronDown,
  Zap,
} from 'lucide-react'
import ScoreCard from '@/components/shindan/ScoreCard'
import ShindanRadarChart from '@/components/shindan/ShindanRadarChart'
import BottleneckPanel from '@/components/shindan/BottleneckPanel'
import RecommendationPanel from '@/components/shindan/RecommendationPanel'
import PdfExportButton from '@/components/shindan/PdfExportButton'
import CompetitiveMatrix from '@/components/shindan/CompetitiveMatrix'

// ===== 型定義 =====
interface WebShindanResult {
  overallScore: number
  overallGrade: string
  summary: string
  axesScores: Record<string, number>
  axesImprovements: Record<string, {
    status: 'good' | 'warning' | 'critical'
    competitorGap: string
    improvementPoints: string[]
    competitorAdvantages: string[]
    yourAdvantages: string[]
  }>
  strengths: Array<{ title: string; description: string }>
  bottlenecks: Array<{ title: string; description: string; severity: string; impact: string }>
  recommendations: Array<{
    title: string; description: string; priority: string
    estimatedCost: string; estimatedEffect: string; timeframe: string; quickWin?: boolean
  }>
  websiteAnalysis: any
  competitorAnalyses: any[]
  discoveredCompetitors: Array<{ url: string; name: string; reason: string; threatLevel: string }>
  competitiveDetailedComparison: any
  pageSpeed?: {
    performanceScore: number
    accessibilityScore: number
    bestPracticesScore: number
    seoScore: number
    lcp: number | null
    fcp: number | null
    cls: number | null
    tbt: number | null
    si: number | null
    tti: number | null
    cruxLcp: number | null
    cruxFid: number | null
    cruxCls: number | null
    cruxInp: number | null
    strategy: 'mobile' | 'desktop'
  }
}

// ===== 7Web軸ラベル =====
const WEB_AXES_LABELS: Record<string, string> = {
  seo: 'SEO対策',
  content: 'コンテンツ力',
  conversion: 'コンバージョン設計',
  tracking: '集客・広告基盤',
  branding: '訴求力・ブランディング',
  trust: '信頼性・社会的証明',
  technical: '技術・パフォーマンス',
}

const STATUS_STYLES = {
  good: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-600', label: '良好' },
  warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-600', label: '要改善' },
  critical: { bg: 'bg-red-50 border-red-200', text: 'text-red-600', label: '要対応' },
}

// ===== SSE進捗ステップ =====
const SSE_STEPS = [
  { key: 'analyzing', label: '分析開始' },
  { key: 'website', label: 'サイト分析' },
  { key: 'pagespeed', label: '速度測定' },
  { key: 'discovery', label: '競合発見' },
  { key: 'competitors', label: '競合分析' },
  { key: 'scoring', label: 'スコア算出' },
  { key: 'complete', label: 'AI診断' },
]

export default function ShindanPage() {
  // フォームstate
  const [url, setUrl] = useState('')

  // 分析state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<WebShindanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // SSE段階表示
  const [sseWebsite, setSseWebsite] = useState<any>(null)
  const [sseCompetitors, setSseCompetitors] = useState<any[]>([])
  const [sseDiscovered, setSseDiscovered] = useState<any[]>([])
  const [sseScoring, setSseScoring] = useState<any>(null)
  const [ssePageSpeed, setSsePageSpeed] = useState<any>(null)
  const [ssePhase, setSsePhase] = useState<string>('')

  // ダッシュボード用
  const [expandedAxes, setExpandedAxes] = useState<Record<string, boolean>>({})
  const dashboardRef = useRef<HTMLDivElement>(null)

  // 診断実行
  const handleSubmit = async () => {
    if (!url) return
    setIsAnalyzing(true)
    setError(null)
    setResult(null)
    setSseWebsite(null)
    setSseCompetitors([])
    setSseDiscovered([])
    setSseScoring(null)
    setSsePageSpeed(null)
    setSsePhase('analyzing')

    try {
      const res = await fetch('/api/shindan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '診断に失敗しました')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6))
              switch (currentEvent) {
                case 'analyzing':
                  setSsePhase('analyzing')
                  break
                case 'website':
                  setSsePhase('website')
                  setSseWebsite(data.websiteHealth)
                  break
                case 'pagespeed':
                  setSsePhase('pagespeed')
                  setSsePageSpeed(data.pageSpeed)
                  break
                case 'discovery':
                  setSsePhase('discovery')
                  setSseDiscovered(data.discoveredCompetitors || [])
                  break
                case 'competitors':
                  setSsePhase('competitors')
                  setSseCompetitors(data.competitorComparison || [])
                  break
                case 'scoring':
                  setSsePhase('scoring')
                  setSseScoring(data)
                  break
                case 'complete':
                  setSsePhase('complete')
                  setResult(data.result)
                  // localStorage に履歴保存
                  try {
                    const history = JSON.parse(localStorage.getItem('shindan_history') || '[]')
                    history.unshift({
                      id: Date.now().toString(),
                      url,
                      overallScore: data.result.overallScore,
                      overallGrade: data.result.overallGrade,
                      createdAt: new Date().toISOString(),
                    })
                    localStorage.setItem('shindan_history', JSON.stringify(history.slice(0, 20)))
                  } catch {}
                  break
                case 'error':
                  setError(data.error || '診断に失敗しました')
                  break
              }
            } catch {}
            currentEvent = ''
          }
        }
      }
    } catch (e: any) {
      setError(e.message || '診断に失敗しました')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // SSEステップのインデックス
  const currentStepIndex = SSE_STEPS.findIndex((s) => s.key === ssePhase)

  // 軸展開トグル
  const toggleAxis = (key: string) => {
    setExpandedAxes((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // レーダーチャート用axes
  const radarAxes = result?.axesScores
    ? Object.entries(result.axesScores).map(([key, score]) => ({
        label: WEB_AXES_LABELS[key] || key,
        score: score as number,
        comment: '',
      }))
    : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">

        {/* ===== 入力フォーム (結果がない場合のみ表示) ===== */}
        {!result && !isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* ヒーローエリア */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-200 rounded-full">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-bold text-teal-700">AI Web診断</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                あなたのWebサイトを<br className="sm:hidden" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-600">7軸</span>で診断
              </h1>
              <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
                URLを入力するだけで、SEO・コンテンツ・CTA設計など7つの観点から<br className="hidden sm:block" />
                Webサイトを分析し、競合と比較した改善点を洗い出します
              </p>
            </div>

            {/* フォームカード */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6"
            >
              {/* URL入力 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  診断するWebサイトURL
                </label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && url && (e.preventDefault(), handleSubmit())}
                    placeholder="https://example.com"
                    className="w-full pl-11 pr-4 py-3.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  業種・競合サイトはAIが自動で推定・発見します
                </p>
              </div>

              {/* エラー表示 */}
              {error && (
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 font-bold">{error}</p>
                </div>
              )}

              {/* 診断開始ボタン */}
              <button
                onClick={handleSubmit}
                disabled={!url}
                className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-base font-black rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
              >
                <Search className="w-5 h-5" />
                診断開始
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* ===== SSE進捗表示 ===== */}
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="w-10 h-10 rounded-full border-2 border-dashed border-teal-500/40"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-teal-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">AIが診断中...</h3>
                  <p className="text-xs text-gray-400">{url}</p>
                </div>
              </div>

              {/* プログレスステッパー */}
              <div className="flex items-center gap-1 mb-8">
                {SSE_STEPS.map((step, i) => {
                  const isCompleted = i < currentStepIndex
                  const isCurrent = i === currentStepIndex
                  return (
                    <React.Fragment key={step.key}>
                      <div className="flex flex-col items-center gap-1.5 flex-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isCompleted
                              ? 'bg-teal-500 text-white'
                              : isCurrent
                              ? 'bg-teal-100 text-teal-600 border-2 border-teal-500'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isCurrent ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span className={`text-[10px] font-bold text-center leading-tight ${
                          isCompleted || isCurrent ? 'text-teal-600' : 'text-gray-400'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                      {i < SSE_STEPS.length - 1 && (
                        <div className={`h-0.5 flex-1 rounded-full mt-[-18px] ${
                          i < currentStepIndex ? 'bg-teal-500' : 'bg-gray-200'
                        }`} />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>

              {/* SSE中間データ表示 */}
              <div className="space-y-3">
                {sseWebsite && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2"
                  >
                    <p className="text-xs font-bold text-teal-600 mb-1">サイト分析完了</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white rounded-lg p-2 border border-gray-100">
                        <p className="text-lg font-black text-gray-900">{sseWebsite.seoScore ?? '-'}</p>
                        <p className="text-[10px] text-gray-500">SEO</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-100">
                        <p className="text-lg font-black text-gray-900">{sseWebsite.contentScore ?? '-'}</p>
                        <p className="text-[10px] text-gray-500">コンテンツ</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-gray-100">
                        <p className="text-lg font-black text-gray-900">{sseWebsite.technicalScore ?? '-'}</p>
                        <p className="text-[10px] text-gray-500">技術</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-gray-500">
                      {sseWebsite.pagesCrawled && <span className="bg-white px-2 py-0.5 rounded border border-gray-100">{sseWebsite.pagesCrawled}ページ分析</span>}
                      {sseWebsite.responseTimeMs && <span className="bg-white px-2 py-0.5 rounded border border-gray-100">{sseWebsite.responseTimeMs}ms</span>}
                      {sseWebsite.tracking?.detectedTools?.length > 0 && <span className="bg-white px-2 py-0.5 rounded border border-gray-100">{sseWebsite.tracking.detectedTools.join(', ')}</span>}
                    </div>
                  </motion.div>
                )}
                {ssePageSpeed && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2"
                  >
                    <p className="text-xs font-bold text-teal-600 mb-1">PageSpeed Insights</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: 'パフォーマンス', score: ssePageSpeed.performanceScore },
                        { label: 'アクセシビリティ', score: ssePageSpeed.accessibilityScore },
                        { label: 'ベストプラクティス', score: ssePageSpeed.bestPracticesScore },
                        { label: 'SEO', score: ssePageSpeed.seoScore },
                      ].map((cat, i) => (
                        <div key={i} className="bg-white rounded-lg p-2 border border-gray-100">
                          <p className={`text-lg font-black ${cat.score >= 90 ? 'text-emerald-600' : cat.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {cat.score}
                          </p>
                          <p className="text-[10px] text-gray-500 leading-tight">{cat.label}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
                {sseDiscovered.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                  >
                    <p className="text-xs font-bold text-teal-600 mb-1">{sseDiscovered.length}件の競合を発見</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sseDiscovered.map((c: any, i: number) => (
                        <span key={i} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg text-gray-600 font-bold">
                          {c.name || c.url}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
                {sseCompetitors.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                  >
                    <p className="text-xs font-bold text-teal-600 mb-1">競合分析完了（{sseCompetitors.length}件）</p>
                  </motion.div>
                )}
                {sseScoring && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                  >
                    <p className="text-xs font-bold text-teal-600 mb-1">スコア算出中...</p>
                  </motion.div>
                )}
              </div>

              {/* エラー表示 */}
              {error && (
                <div className="flex items-start gap-2 p-4 mt-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 font-bold">{error}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ===== ダッシュボード（結果表示） ===== */}
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* 戻るボタン + PDF */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setResult(null); setSsePhase('') }}
                className="text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                &larr; 新しい診断
              </button>
              <PdfExportButton targetRef={dashboardRef} fileName="doya-web-shindan" />
            </div>

            <div ref={dashboardRef} className="space-y-6">
              {/* 1. 総合スコア */}
              <ScoreCard
                score={result.overallScore}
                grade={result.overallGrade}
                summary={result.summary}
              />

              {/* 2. レーダーチャート */}
              {radarAxes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-teal-600" />
                    7軸スコア
                  </h3>
                  <ShindanRadarChart axes={radarAxes} />
                </motion.div>
              )}

              {/* 3. 7軸改善点パネル */}
              {result.axesImprovements && Object.keys(result.axesImprovements).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-teal-600" />
                    軸別改善ポイント
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(result.axesImprovements).map(([key, improvement]) => {
                      const style = STATUS_STYLES[improvement.status] || STATUS_STYLES.warning
                      const isExpanded = expandedAxes[key]
                      const score = result.axesScores?.[key]
                      return (
                        <div key={key} className={`border rounded-xl overflow-hidden ${style.bg}`}>
                          {/* ヘッダー */}
                          <button
                            onClick={() => toggleAxis(key)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${style.text} bg-white/80`}>
                                {style.label}
                              </span>
                              <span className="text-sm font-bold text-gray-900 truncate">
                                {WEB_AXES_LABELS[key] || key}
                              </span>
                              {score != null && (
                                <span className="text-sm font-black text-teal-600">{score}点</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 hidden sm:block">{improvement.competitorGap}</span>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </motion.div>
                          </button>

                          {/* 改善ポイント（常時表示） */}
                          <div className="px-4 pb-3">
                            <p className="text-xs text-gray-500 mb-2 sm:hidden">{improvement.competitorGap}</p>
                            {improvement.improvementPoints.length > 0 && (
                              <ul className="space-y-1">
                                {improvement.improvementPoints.map((point, i) => (
                                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                    <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${style.text}`} />
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* 展開: 競合の強み / 自社の強み */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 space-y-3 border-t border-current/10 pt-3">
                                  {improvement.competitorAdvantages.length > 0 && (
                                    <div>
                                      <p className="text-xs font-bold text-red-500 mb-1.5">競合の強み</p>
                                      <ul className="space-y-1">
                                        {improvement.competitorAdvantages.map((adv, i) => (
                                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                            <span className="text-red-400 mt-0.5">-</span>
                                            <span>{adv}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {improvement.yourAdvantages.length > 0 && (
                                    <div>
                                      <p className="text-xs font-bold text-emerald-600 mb-1.5">自社の強み</p>
                                      <ul className="space-y-1">
                                        {improvement.yourAdvantages.map((adv, i) => (
                                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                            <span>{adv}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {/* 4. 強み一覧 */}
              {result.strengths && result.strengths.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    強み
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.strengths.map((s, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                        className="bg-emerald-50 border border-emerald-200 rounded-xl p-4"
                      >
                        <h4 className="text-sm font-black text-gray-900 mb-1">{s.title}</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">{s.description}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 5. ボトルネック */}
              {result.bottlenecks && result.bottlenecks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    ボトルネック
                  </h3>
                  <BottleneckPanel bottlenecks={result.bottlenecks} />
                </motion.div>
              )}

              {/* 6. 改善提案 */}
              {result.recommendations && result.recommendations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal-600" />
                    改善提案
                  </h3>
                  <RecommendationPanel recommendations={result.recommendations} />
                </motion.div>
              )}

              {/* 7. 詳細競合比較 */}
              {result.websiteAnalysis && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <CompetitiveMatrix
                    websiteHealth={result.websiteAnalysis}
                    competitors={result.competitorAnalyses || []}
                    detailedComparison={result.competitiveDetailedComparison}
                  />
                </motion.div>
              )}

              {/* PageSpeed Insights */}
              {(result.websiteAnalysis?.pageSpeed || result.pageSpeed) && (() => {
                const ps = result.websiteAnalysis?.pageSpeed || result.pageSpeed
                if (!ps) return null
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.62 }}
                    className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
                  >
                    <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-teal-600" />
                      PageSpeed Insights
                      <span className="text-xs font-bold text-gray-400 ml-auto">{ps.strategy === 'mobile' ? 'モバイル' : 'デスクトップ'}</span>
                    </h3>

                    {/* Lighthouse 4カテゴリスコア */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                      {[
                        { label: 'パフォーマンス', score: ps.performanceScore },
                        { label: 'アクセシビリティ', score: ps.accessibilityScore },
                        { label: 'ベストプラクティス', score: ps.bestPracticesScore },
                        { label: 'SEO', score: ps.seoScore },
                      ].map((cat, i) => (
                        <div key={i} className="relative bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                          <div className="relative w-16 h-16 mx-auto mb-2">
                            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="4" />
                              <circle
                                cx="32" cy="32" r="28" fill="none"
                                stroke={cat.score >= 90 ? '#10b981' : cat.score >= 50 ? '#f59e0b' : '#ef4444'}
                                strokeWidth="4" strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 28}`}
                                strokeDashoffset={`${2 * Math.PI * 28 * (1 - cat.score / 100)}`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className={`text-lg font-black ${cat.score >= 90 ? 'text-emerald-600' : cat.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {cat.score}
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] font-bold text-gray-600">{cat.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Core Web Vitals */}
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-bold text-gray-700 mb-3">Core Web Vitals</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {ps.lcp != null && (
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <p className="text-[10px] text-gray-500 mb-1">LCP (読込速度)</p>
                            <p className={`text-xl font-black ${ps.lcp <= 2500 ? 'text-emerald-600' : ps.lcp <= 4000 ? 'text-amber-600' : 'text-red-600'}`}>
                              {(ps.lcp / 1000).toFixed(1)}<span className="text-xs font-bold">秒</span>
                            </p>
                            <p className="text-[9px] text-gray-400 mt-0.5">{ps.lcp <= 2500 ? '良好 (≤2.5s)' : ps.lcp <= 4000 ? '要改善 (≤4.0s)' : '不良 (>4.0s)'}</p>
                          </div>
                        )}
                        {ps.cls != null && (
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <p className="text-[10px] text-gray-500 mb-1">CLS (安定性)</p>
                            <p className={`text-xl font-black ${ps.cls <= 0.1 ? 'text-emerald-600' : ps.cls <= 0.25 ? 'text-amber-600' : 'text-red-600'}`}>
                              {ps.cls.toFixed(3)}
                            </p>
                            <p className="text-[9px] text-gray-400 mt-0.5">{ps.cls <= 0.1 ? '良好 (≤0.1)' : ps.cls <= 0.25 ? '要改善 (≤0.25)' : '不良 (>0.25)'}</p>
                          </div>
                        )}
                        {ps.tbt != null && (
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <p className="text-[10px] text-gray-500 mb-1">TBT (応答性)</p>
                            <p className={`text-xl font-black ${ps.tbt <= 200 ? 'text-emerald-600' : ps.tbt <= 600 ? 'text-amber-600' : 'text-red-600'}`}>
                              {Math.round(ps.tbt)}<span className="text-xs font-bold">ms</span>
                            </p>
                            <p className="text-[9px] text-gray-400 mt-0.5">{ps.tbt <= 200 ? '良好 (≤200ms)' : ps.tbt <= 600 ? '要改善 (≤600ms)' : '不良 (>600ms)'}</p>
                          </div>
                        )}
                        {ps.fcp != null && (
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <p className="text-[10px] text-gray-500 mb-1">FCP (初回描画)</p>
                            <p className={`text-xl font-black ${ps.fcp <= 1800 ? 'text-emerald-600' : ps.fcp <= 3000 ? 'text-amber-600' : 'text-red-600'}`}>
                              {(ps.fcp / 1000).toFixed(1)}<span className="text-xs font-bold">秒</span>
                            </p>
                          </div>
                        )}
                        {ps.si != null && (
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <p className="text-[10px] text-gray-500 mb-1">SI (速度指標)</p>
                            <p className={`text-xl font-black ${ps.si <= 3400 ? 'text-emerald-600' : ps.si <= 5800 ? 'text-amber-600' : 'text-red-600'}`}>
                              {(ps.si / 1000).toFixed(1)}<span className="text-xs font-bold">秒</span>
                            </p>
                          </div>
                        )}
                        {ps.tti != null && (
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <p className="text-[10px] text-gray-500 mb-1">TTI (操作可能)</p>
                            <p className={`text-xl font-black ${ps.tti <= 3800 ? 'text-emerald-600' : ps.tti <= 7300 ? 'text-amber-600' : 'text-red-600'}`}>
                              {(ps.tti / 1000).toFixed(1)}<span className="text-xs font-bold">秒</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CrUX real-world data */}
                    {(ps.cruxLcp != null || ps.cruxCls != null || ps.cruxInp != null) && (
                      <div className="border-t border-gray-100 pt-4 mt-4">
                        <p className="text-xs font-bold text-gray-700 mb-3">実ユーザーデータ (CrUX)</p>
                        <div className="grid grid-cols-3 gap-3">
                          {ps.cruxLcp != null && (
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
                              <p className="text-[10px] text-blue-500 mb-1">LCP (実測)</p>
                              <p className="text-lg font-black text-blue-700">{(ps.cruxLcp / 1000).toFixed(1)}s</p>
                            </div>
                          )}
                          {ps.cruxCls != null && (
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
                              <p className="text-[10px] text-blue-500 mb-1">CLS (実測)</p>
                              <p className="text-lg font-black text-blue-700">{(ps.cruxCls / 100).toFixed(2)}</p>
                            </div>
                          )}
                          {ps.cruxInp != null && (
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
                              <p className="text-[10px] text-blue-500 mb-1">INP (実測)</p>
                              <p className="text-lg font-black text-blue-700">{ps.cruxInp}ms</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )
              })()}

              {/* 技術詳細 */}
              {result.websiteAnalysis && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-teal-600" />
                    技術詳細
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {result.websiteAnalysis.responseTimeMs != null && (
                      <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                        <p className={`text-xl font-black ${result.websiteAnalysis.responseTimeMs < 1000 ? 'text-emerald-600' : result.websiteAnalysis.responseTimeMs < 3000 ? 'text-amber-600' : 'text-red-600'}`}>
                          {result.websiteAnalysis.responseTimeMs < 1000 ? `${result.websiteAnalysis.responseTimeMs}ms` : `${(result.websiteAnalysis.responseTimeMs / 1000).toFixed(1)}s`}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">レスポンス</p>
                      </div>
                    )}
                    <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                      <p className="text-xl font-black text-gray-900">{result.websiteAnalysis.pagesCrawled || 0}</p>
                      <p className="text-[10px] text-gray-500 mt-1">分析ページ数</p>
                    </div>
                    {result.websiteAnalysis.jsFileCount != null && (
                      <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                        <p className={`text-xl font-black ${result.websiteAnalysis.jsFileCount > 20 ? 'text-red-600' : 'text-gray-900'}`}>{result.websiteAnalysis.jsFileCount}</p>
                        <p className="text-[10px] text-gray-500 mt-1">JSファイル</p>
                      </div>
                    )}
                    {result.websiteAnalysis.cssFileCount != null && (
                      <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                        <p className={`text-xl font-black ${result.websiteAnalysis.cssFileCount > 10 ? 'text-red-600' : 'text-gray-900'}`}>{result.websiteAnalysis.cssFileCount}</p>
                        <p className="text-[10px] text-gray-500 mt-1">CSSファイル</p>
                      </div>
                    )}
                  </div>
                  {/* 検出ツール */}
                  {result.websiteAnalysis.tracking?.detectedTools?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-bold text-gray-700 mb-2">検出された広告・分析ツール</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.websiteAnalysis.tracking.detectedTools.map((tool: string, i: number) => (
                          <span key={i} className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-bold border border-teal-200">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* セキュリティヘッダー */}
                  {result.websiteAnalysis.securityHeaders && result.websiteAnalysis.securityHeaders.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-bold text-gray-700 mb-2">セキュリティヘッダー</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.websiteAnalysis.securityHeaders.map((h: string, i: number) => (
                          <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 技術フラグ */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                    {[
                      { label: 'HTTPS', active: result.websiteAnalysis.url?.startsWith('https') },
                      { label: 'viewport', active: true },
                      { label: '構造化データ', active: result.websiteAnalysis.hasSchema },
                      { label: '遅延読み込み', active: result.websiteAnalysis.hasLazyLoading },
                      { label: 'favicon', active: result.websiteAnalysis.hasFavicon },
                      { label: 'ブログ', active: result.websiteAnalysis.hasBlog },
                      { label: 'フォーム', active: result.websiteAnalysis.hasForm },
                    ].map((flag, i) => (
                      <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-bold border ${flag.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {flag.active ? '\u2713' : '\u2717'} {flag.label}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 検出された問題点・良い点 */}
              {result.websiteAnalysis && (result.websiteAnalysis.issues?.length > 0 || result.websiteAnalysis.positives?.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.67 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-lg font-black text-gray-900 mb-4">自動検出結果</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {result.websiteAnalysis.issues?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-red-600 mb-2">問題点（{result.websiteAnalysis.issues.length}件）</p>
                        <ul className="space-y-1.5">
                          {result.websiteAnalysis.issues.map((issue: string, i: number) => (
                            <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                              <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.websiteAnalysis.positives?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-emerald-600 mb-2">良い点（{result.websiteAnalysis.positives.length}件）</p>
                        <ul className="space-y-1.5">
                          {result.websiteAnalysis.positives.map((pos: string, i: number) => (
                            <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                              <span>{pos}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* 発見された競合 */}
              {result.discoveredCompetitors && result.discoveredCompetitors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
                >
                  <h3 className="text-lg font-black text-gray-900 mb-4">AIが発見した競合</h3>
                  <div className="space-y-2">
                    {result.discoveredCompetitors.map((c, i) => (
                      <div key={i} className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-black flex-shrink-0 ${
                          c.threatLevel === 'high' ? 'bg-red-50 text-red-600 border border-red-200' :
                          c.threatLevel === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                          'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                          {c.threatLevel === 'high' ? '脅威度:高' : c.threatLevel === 'medium' ? '脅威度:中' : '脅威度:低'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-500 truncate">{c.url}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{c.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
