'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { categories, allTemplates } from './data'
import { ArticleTemplate } from './types'
import {
  Sparkles, Loader2, CheckCircle2, Lightbulb, FileText, Zap, Target,
  TrendingUp, Search, BarChart3, ArrowRight, ArrowLeft, ChevronDown,
  ChevronUp, X,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { Toaster, toast } from 'react-hot-toast'

const ARTICLE_TYPES = [
  { id: 'comparison', label: '比較記事', desc: '複数の製品やサービスを比較', icon: BarChart3 },
  { id: 'howto', label: 'HowTo記事', desc: '手順や方法を解説', icon: FileText },
  { id: 'explanation', label: '解説記事', desc: '概念や仕組みを詳しく説明', icon: Lightbulb },
  { id: 'case', label: '事例記事', desc: '導入事例や成功例を紹介', icon: Target },
  { id: 'ranking', label: 'ランキング記事', desc: 'おすすめ順に紹介', icon: TrendingUp },
] as const

const AUDIENCE_PRESETS = [
  { id: 'marketer', label: 'マーケ担当者', desc: 'SEO/広告を扱う人' },
  { id: 'executive', label: '経営者', desc: '意思決定者・役員' },
  { id: 'hr', label: '人事担当', desc: '採用・労務担当' },
  { id: 'beginner', label: '初心者', desc: 'その分野を学び始めた人' },
  { id: 'expert', label: '上級者', desc: '既に詳しい人向け' },
  { id: 'custom', label: '自分で入力', desc: '' },
] as const

const TONE_OPTIONS = [
  { id: 'logical', label: '論理的', desc: 'データや根拠を重視', emoji: '📊' },
  { id: 'friendly', label: 'やさしい', desc: '初心者にも分かりやすく', emoji: '😊' },
  { id: 'professional', label: '専門的', desc: '業界知識を前提に', emoji: '🎓' },
  { id: 'casual', label: 'カジュアル', desc: '親しみやすい文体', emoji: '💬' },
] as const

const CHAR_PRESETS = [
  { value: 3000, label: '3,000字', desc: 'コンパクト', minPlan: 'GUEST' },
  { value: 5000, label: '5,000字', desc: '要点を絞った', minPlan: 'GUEST' },
  { value: 10000, label: '10,000字', desc: '標準的なSEO', minPlan: 'FREE' },
  { value: 20000, label: '20,000字', desc: '網羅性の高い', minPlan: 'PRO' },
  { value: 30000, label: '30,000字', desc: '徹底解説', minPlan: 'ENTERPRISE' },
  { value: 50000, label: '50,000字', desc: '超大型', minPlan: 'ENTERPRISE' },
] as const

const CHAR_LIMITS: Record<string, number> = {
  GUEST: 5000, FREE: 10000, PRO: 20000, ENTERPRISE: 50000,
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-600' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-600' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-600' },
}

function normalizeUrlInput(raw: string): string | null {
  const s = String(raw || '').trim().replace(/[)\]】）]+$/g, '').replace(/^[「『【\[]+/g, '').replace(/[、。,\s]+$/g, '')
  if (!s) return null
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    return u.toString()
  } catch { return null }
}

function parseUrlListText(text: string, max: number) {
  const parts = String(text || '').split(/[\n\r,、\t ]+/).map((s) => s.trim()).filter(Boolean)
  const urls: string[] = []
  const invalid: string[] = []
  for (const p of parts) {
    const u = normalizeUrlInput(p)
    if (u) urls.push(u)
    else invalid.push(p)
  }
  return { urls: Array.from(new Set(urls)).slice(0, max), invalid: Array.from(new Set(invalid)).slice(0, 6) }
}

export default function SeoTestPage() {
  const router = useRouter()
  const { data: session } = useSession()

  // カテゴリ & テンプレート選択
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ArticleTemplate | null>(null)

  // Step管理
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step1
  const [mainKeyword, setMainKeyword] = useState('')
  const [articleTitle, setArticleTitle] = useState('')
  const [titleCandidates, setTitleCandidates] = useState<string[]>([])
  const [titleSelected, setTitleSelected] = useState<number | null>(null)
  const [titleLoading, setTitleLoading] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [articleType, setArticleType] = useState<string>('comparison')
  const [originalContent, setOriginalContent] = useState('')

  // Step2
  const [audiencePreset, setAudiencePreset] = useState<string>('marketer')
  const [customAudience, setCustomAudience] = useState('')

  // Step3
  const [tone, setTone] = useState<string>('logical')
  const [targetChars, setTargetChars] = useState(10000)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [relatedKeywords, setRelatedKeywords] = useState('')
  const [constraints, setConstraints] = useState('')
  const [referenceUrlsText, setReferenceUrlsText] = useState('')

  // 状態
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLoggedIn = !!session?.user?.email
  const userPlan = useMemo(() => {
    if (!isLoggedIn) return 'GUEST'
    const p = String((session?.user as any)?.seoPlan || (session?.user as any)?.plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO') return 'PRO'
    return 'FREE'
  }, [session, isLoggedIn])
  const charLimit = CHAR_LIMITS[userPlan] || 10000

  // テンプレート選択時に値セット
  const handleSelectTemplate = useCallback((template: ArticleTemplate) => {
    setSelectedTemplate(template)
    setMainKeyword(template.defaultKeyword)
    setArticleTitle(template.defaultTitle)
    setArticleType(template.articleType)
    setAudiencePreset(template.targetAudience)
    setTone(template.recommendedTone)
    setTargetChars(Math.min(template.recommendedChars, charLimit))
    if (template.exampleKeywords?.length) setRelatedKeywords(template.exampleKeywords.join('、'))
    setOriginalContent('')
    setStep(1)
    setTitleCandidates([])
    setTitleSelected(null)
    setError(null)
  }, [charLimit])

  async function generateTitleCandidates() {
    if (titleLoading) return
    const kw = mainKeyword.trim()
    if (kw.length < 2) return
    setTitleLoading(true)
    setTitleError(null)
    try {
      const res = await fetch('/api/seo/title-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw, articleType, targetChars, tone, count: 6 }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || 'タイトル生成に失敗しました')
      const list = Array.isArray(json?.titles) ? (json.titles as string[]) : []
      const uniq = Array.from(new Set(list.map((s) => String(s || '').trim()).filter(Boolean))).slice(0, 6)
      if (!uniq.length) throw new Error('タイトル候補を生成できませんでした')
      setTitleCandidates(uniq)
      if (!articleTitle.trim()) { setArticleTitle(uniq[0]); setTitleSelected(0) }
    } catch (e: any) {
      setTitleError(e?.message || 'タイトル候補の生成に失敗しました')
    } finally { setTitleLoading(false) }
  }

  async function handleGenerate() {
    if (loading || !selectedTemplate) return
    setLoading(true)
    setError(null)
    try {
      const referenceUrls = parseUrlListText(referenceUrlsText, 20).urls
      const related = relatedKeywords.split(/[,、\n]/).map((s) => s.trim()).filter(Boolean)
      const persona = audiencePreset === 'custom' ? customAudience : AUDIENCE_PRESETS.find((a) => a.id === audiencePreset)?.label || ''
      const toneMap: Record<string, string> = { logical: 'ビジネス', friendly: 'やさしい', professional: '専門的', casual: 'カジュアル' }
      const isComparisonMode = articleType === 'comparison' || articleType === 'ranking'
      const mode = isComparisonMode ? 'comparison_research' : 'standard'
      const comparisonConfig = isComparisonMode ? { template: articleType === 'ranking' ? 'ranking' : 'tools', count: 10, region: 'JP', requireOfficial: true, includeThirdParty: true } : undefined
      const requestText = [
        originalContent.trim() ? `【一次情報（経験・訴求ポイント）】\n${originalContent.trim()}` : '',
        constraints.trim() ? `【制約・NG表現】\n${constraints.trim()}` : '',
      ].filter(Boolean).join('\n\n')
      const fallbackTitle = `${mainKeyword}に関する${ARTICLE_TYPES.find((t) => t.id === articleType)?.label || '記事'}`
      const finalTitle = articleTitle.trim() || fallbackTitle
      let seoIntent = '情報収集'
      if (articleType === 'comparison' || articleType === 'ranking') seoIntent = '比較検討'
      if (mainKeyword.includes('おすすめ') || mainKeyword.includes('比較')) seoIntent = '購買検討'

      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle, keywords: [mainKeyword, ...related], persona, tone: toneMap[tone] || '丁寧',
          targetChars, searchIntent: seoIntent, referenceUrls,
          llmoOptions: { tldr: true, conclusionFirst: true, faq: true, glossary: false, comparison: isComparisonMode, quotes: true, templates: false, objections: false },
          autoBundle: true, createJob: true, requestText: requestText || undefined, mode, comparisonConfig,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || `エラーが発生しました (${res.status})`)
      const jobId = json.jobId || json.job?.id
      const articleId = json.articleId || json.article?.id
      if (jobId) router.push(`/seo/jobs/${jobId}?auto=1`)
      else if (articleId) router.push(`/seo/articles/${articleId}`)
      else router.push('/seo')
    } catch (e: any) {
      setError(e?.message || '生成に失敗しました')
      setLoading(false)
    }
  }

  const canProceed = useMemo(() => {
    if (step === 1) return mainKeyword.trim().length >= 2
    if (step === 2) return audiencePreset !== 'custom' || customAudience.trim().length >= 2
    return true
  }, [step, mainKeyword, audiencePreset, customAudience])

  const referenceUrlParse = useMemo(() => parseUrlListText(referenceUrlsText, 20), [referenceUrlsText])

  // --- UI ---
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Toaster position="top-center" />

      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                SEO記事テンプレート
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                テンプレートを選んで、すぐにSEO記事を作成
              </p>
            </div>
            {selectedTemplate && (
              <button
                onClick={() => { setSelectedTemplate(null); setActiveCategoryId(null) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all"
              >
                <X className="w-3.5 h-3.5" />
                リセット
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          {!selectedTemplate ? (
            /* ==================== テンプレート選択画面 ==================== */
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {/* カテゴリタブ */}
              <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveCategoryId(null)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    !activeCategoryId
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  すべて
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                      activeCategoryId === cat.id
                        ? 'bg-slate-900 text-white shadow-lg'
                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>

              {/* カテゴリごとのテンプレート表示 */}
              {categories
                .filter((cat) => !activeCategoryId || cat.id === activeCategoryId)
                .map((cat) => {
                  const colors = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.blue
                  return (
                    <div key={cat.id} className="mb-8 sm:mb-10">
                      {/* カテゴリヘッダー */}
                      <div className="flex items-center gap-2.5 mb-4">
                        <span className={`w-8 h-8 rounded-lg ${colors.badge} flex items-center justify-center text-white text-sm`}>
                          {cat.emoji}
                        </span>
                        <div>
                          <h2 className="text-base sm:text-lg font-black text-slate-900">{cat.label}</h2>
                        </div>
                        <div className="flex-1 h-px bg-slate-200 ml-2" />
                      </div>

                      {/* テンプレートグリッド（4列） */}
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        {cat.templates.map((tmpl, idx) => (
                          <motion.button
                            key={tmpl.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05, duration: 0.3 }}
                            onClick={() => handleSelectTemplate(tmpl)}
                            className={`group text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-blue-200/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200`}
                          >
                            {/* カードヘッダー（グラデーション） */}
                            <div className={`h-20 sm:h-24 ${colors.bg} relative flex items-center justify-center`}>
                              <span className="text-3xl sm:text-4xl">{tmpl.icon}</span>
                              <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black text-white ${colors.badge}`}>
                                {tmpl.recommendedChars >= 15000 ? '長文' : tmpl.recommendedChars >= 10000 ? '標準' : '短文'}
                              </span>
                            </div>

                            {/* カードボディ */}
                            <div className="p-3 sm:p-4">
                              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug mb-1.5 line-clamp-2 group-hover:text-blue-600 transition-colors">
                                {tmpl.title}
                              </h3>
                              <p className="text-[10px] sm:text-xs text-slate-500 line-clamp-2 mb-3">
                                {tmpl.description}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${colors.text} ${colors.bg}`}>
                                  {ARTICLE_TYPES.find((t) => t.id === tmpl.articleType)?.label || tmpl.articleType}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-500 bg-slate-100">
                                  {tmpl.recommendedChars.toLocaleString()}字
                                </span>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )
                })}
            </motion.div>
          ) : (
            /* ==================== フォーム画面（3ステップ） ==================== */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {/* 選択中テンプレート表示 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-6 flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl ${CATEGORY_COLORS[categories.find(c => c.id === selectedTemplate.category)?.color || 'blue']?.bg || 'bg-blue-50'} flex items-center justify-center text-2xl flex-shrink-0`}>
                  {selectedTemplate.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">選択中のテンプレート</p>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">{selectedTemplate.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedTemplate.description}</p>
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold transition-all"
                >
                  変更
                </button>
              </div>

              {/* ステップウィザード */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {/* ステップヘッダー */}
                <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-slate-100">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    {[1, 2, 3].map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                            step === s
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                              : step > s
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                        </div>
                        {s < 3 && <div className={`w-8 sm:w-12 h-0.5 rounded ${step > s ? 'bg-blue-400' : 'bg-slate-200'}`} />}
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {step === 1 && 'Step 1: キーワード・タイトル・記事タイプ'}
                    {step === 2 && 'Step 2: 読者像・ターゲット設定'}
                    {step === 3 && 'Step 3: 仕上がり調整'}
                  </p>
                </div>

                {/* ステップコンテンツ */}
                <div className="px-5 sm:px-8 py-6 sm:py-8">
                  <AnimatePresence mode="wait">
                    {/* ----- Step 1 ----- */}
                    {step === 1 && (
                      <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-5">
                        {/* 主キーワード */}
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            主キーワード <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text" value={mainKeyword} onChange={(e) => setMainKeyword(e.target.value)}
                            placeholder="例：AI ライティング ツール 比較"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            autoFocus
                          />
                          <p className="text-[10px] text-slate-400 mt-1.5">上位表示したい検索キーワードを入力</p>
                        </div>

                        {/* 記事タイトル */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-slate-700">記事タイトル <span className="text-red-500">*</span></label>
                            <button
                              type="button" onClick={generateTitleCandidates} disabled={titleLoading || mainKeyword.trim().length < 2}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black shadow-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                              {titleLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              AIでタイトル生成
                            </button>
                          </div>
                          <input
                            type="text" value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)}
                            placeholder="例：AIライティングツール比較｜料金・特徴・選び方を2026年版で徹底解説"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          />
                          {titleError && <p className="mt-2 text-xs font-bold text-red-500">{titleError}</p>}
                          {titleCandidates.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {titleCandidates.slice(0, 6).map((t, i) => (
                                <button key={`${i}_${t}`} type="button" onClick={() => { setArticleTitle(t); setTitleSelected(i) }}
                                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                                    titleSelected === i ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <span className="text-sm font-bold text-slate-800 leading-snug">{t}</span>
                                    {titleSelected === i && <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 一次情報 */}
                        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 sm:p-5">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black">重要</span>
                            <label className="text-xs font-black text-blue-700">一次情報（経験・訴求ポイント）</label>
                          </div>
                          <p className="text-xs text-blue-600 mb-3">ここが入るほど「あなたにしか書けない記事」になります</p>
                          <textarea
                            value={originalContent} onChange={(e) => setOriginalContent(e.target.value)}
                            placeholder="例：実体験、現場の失敗談、数字、独自の主張、比較の結論…"
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl bg-white border border-blue-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        </div>

                        {/* 記事タイプ */}
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-3">記事タイプ</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {ARTICLE_TYPES.map((type) => {
                              const Icon = type.icon
                              const selected = articleType === type.id
                              return (
                                <button key={type.id} type="button" onClick={() => setArticleType(type.id)}
                                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                                    selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <Icon className={`w-5 h-5 mb-2 ${selected ? 'text-blue-600' : 'text-slate-400'}`} />
                                  <p className={`text-sm font-bold ${selected ? 'text-blue-700' : 'text-slate-700'}`}>{type.label}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">{type.desc}</p>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ----- Step 2 ----- */}
                    {step === 2 && (
                      <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-5">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-3">想定読者</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {AUDIENCE_PRESETS.map((preset) => {
                              const selected = audiencePreset === preset.id
                              return (
                                <button key={preset.id} type="button" onClick={() => setAudiencePreset(preset.id)}
                                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                                    selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <p className={`text-sm font-bold ${selected ? 'text-blue-700' : 'text-slate-700'}`}>{preset.label}</p>
                                  {preset.desc && <p className="text-[10px] text-slate-400 mt-1">{preset.desc}</p>}
                                </button>
                              )
                            })}
                          </div>
                          {audiencePreset === 'custom' && (
                            <input type="text" value={customAudience} onChange={(e) => setCustomAudience(e.target.value)} placeholder="例：不動産営業3年目の担当者"
                              className="mt-3 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-3">文体</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {TONE_OPTIONS.map((opt) => {
                              const selected = tone === opt.id
                              return (
                                <button key={opt.id} type="button" onClick={() => setTone(opt.id)}
                                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                                    selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <span className="text-xl mb-1 block">{opt.emoji}</span>
                                  <p className={`text-sm font-bold ${selected ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">{opt.desc}</p>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ----- Step 3 ----- */}
                    {step === 3 && (
                      <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-5">
                        {/* 文字数 */}
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-3">文字数</label>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {CHAR_PRESETS.map((p) => {
                              const selected = targetChars === p.value
                              const disabled = p.value > charLimit
                              return (
                                <button key={p.value} type="button" disabled={disabled}
                                  onClick={() => setTargetChars(p.value)}
                                  className={`py-3 px-2 rounded-xl border-2 text-center transition-all ${
                                    disabled ? 'opacity-30 cursor-not-allowed border-slate-200 bg-slate-50'
                                    : selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <p className={`text-sm font-black ${selected ? 'text-blue-700' : 'text-slate-700'}`}>{p.label}</p>
                                  <p className="text-[9px] text-slate-400 mt-0.5">{p.desc}</p>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* 詳細設定 */}
                        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          詳細設定
                        </button>

                        {showAdvanced && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2">関連キーワード</label>
                              <input type="text" value={relatedKeywords} onChange={(e) => setRelatedKeywords(e.target.value)} placeholder="例：AI、ChatGPT、Claude、SEO"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2">制約・NG表現</label>
                              <input type="text" value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="例：競合他社名は出さない"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2">
                                参考URL（最大20件）
                                {referenceUrlParse.urls.length > 0 && <span className="ml-2 text-blue-600 font-bold">{referenceUrlParse.urls.length}件</span>}
                              </label>
                              <textarea value={referenceUrlsText} onChange={(e) => setReferenceUrlsText(e.target.value)} placeholder="https://example.com（改行またはカンマ区切り）"
                                rows={3}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all" />
                              {referenceUrlParse.invalid.length > 0 && (
                                <p className="mt-1 text-xs text-red-500">無効なURL: {referenceUrlParse.invalid.join(', ')}</p>
                              )}
                            </div>
                          </motion.div>
                        )}

                        {/* プレビュー */}
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                          <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">生成プレビュー</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                            <div><p className="text-[10px] text-slate-400">タイトル</p><p className="font-bold text-slate-800 truncate">{articleTitle || '(未設定)'}</p></div>
                            <div><p className="text-[10px] text-slate-400">記事タイプ</p><p className="font-bold text-slate-800">{ARTICLE_TYPES.find(t => t.id === articleType)?.label}</p></div>
                            <div><p className="text-[10px] text-slate-400">読者像</p><p className="font-bold text-slate-800">{audiencePreset === 'custom' ? customAudience : AUDIENCE_PRESETS.find(a => a.id === audiencePreset)?.label}</p></div>
                            <div><p className="text-[10px] text-slate-400">文体</p><p className="font-bold text-slate-800">{TONE_OPTIONS.find(t => t.id === tone)?.label}</p></div>
                            <div><p className="text-[10px] text-slate-400">文字数</p><p className="font-bold text-slate-800">{targetChars.toLocaleString()}字</p></div>
                            <div><p className="text-[10px] text-slate-400">想定見出し数</p><p className="font-bold text-slate-800">{Math.max(5, Math.floor(targetChars / 1500))}個</p></div>
                          </div>
                        </div>

                        {error && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <p className="text-sm font-bold text-red-600">{error}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* フッターボタン */}
                <div className="px-5 sm:px-8 py-4 sm:py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                  {step > 1 ? (
                    <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" /> 戻る
                    </button>
                  ) : <div />}

                  {step < 3 ? (
                    <button type="button" onClick={() => setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)} disabled={!canProceed}
                      className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      次へ <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button type="button" onClick={handleGenerate} disabled={loading || !canProceed}
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-black shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {loading ? '生成中...' : 'SEO記事を生成'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
