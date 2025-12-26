'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Wand2,
  HelpCircle,
  X,
  CheckCircle2,
  Lightbulb,
  FileText,
  Zap,
  Target,
  TrendingUp,
  Search,
  BarChart3,
} from 'lucide-react'

// ================== 定数 ==================
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
  { value: 5000, label: '5,000字', desc: '要点を絞った記事' },
  { value: 10000, label: '10,000字', desc: '標準的なSEO記事' },
  { value: 20000, label: '20,000字', desc: '網羅性の高い記事' },
  { value: 30000, label: '30,000字', desc: '徹底解説記事' },
] as const

const DEFAULT_LLMO = {
  tldr: true,
  conclusionFirst: true,
  faq: true,
  glossary: false,
  comparison: false,
  quotes: true,
  templates: false,
  objections: false,
}

// ================== メインコンポーネント ==================
export default function SeoCreateWizardPage() {
  const router = useRouter()

  // Step管理
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step1: 記事の軸
  const [mainKeyword, setMainKeyword] = useState('')
  const [articleType, setArticleType] = useState<string>('comparison')

  // Step2: 読者
  const [audiencePreset, setAudiencePreset] = useState<string>('marketer')
  const [customAudience, setCustomAudience] = useState('')

  // Step3: 仕上がり
  const [tone, setTone] = useState<string>('logical')
  const [targetChars, setTargetChars] = useState(10000)

  // 詳細設定（折りたたみ）
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [relatedKeywords, setRelatedKeywords] = useState('')
  const [customInfo, setCustomInfo] = useState('')

  // 処理状態
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // プレビュー用の計算
  const preview = useMemo(() => {
    const type = ARTICLE_TYPES.find((t) => t.id === articleType)
    const audience = audiencePreset === 'custom' ? customAudience : AUDIENCE_PRESETS.find((a) => a.id === audiencePreset)?.label
    const toneLabel = TONE_OPTIONS.find((t) => t.id === tone)?.label

    // 想定見出し数（文字数ベース）
    const estimatedHeadings = Math.max(5, Math.floor(targetChars / 1500))

    // SEO意図の推定
    let seoIntent = '情報収集'
    if (articleType === 'comparison' || articleType === 'ranking') seoIntent = '比較検討'
    if (mainKeyword.includes('おすすめ') || mainKeyword.includes('比較')) seoIntent = '購買検討'

    return {
      type: type?.label || '解説記事',
      audience: audience || '一般読者',
      tone: toneLabel || '論理的',
      chars: targetChars.toLocaleString(),
      headings: estimatedHeadings,
      seoIntent,
    }
  }, [mainKeyword, articleType, audiencePreset, customAudience, tone, targetChars])

  const canProceed = useMemo(() => {
    if (step === 1) return mainKeyword.trim().length >= 2
    if (step === 2) return audiencePreset !== 'custom' || customAudience.trim().length >= 2
    return true
  }, [step, mainKeyword, audiencePreset, customAudience])

  async function handleGenerate() {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const related = relatedKeywords
        .split(/[,、\n]/)
        .map((s) => s.trim())
        .filter(Boolean)

      const persona = audiencePreset === 'custom' ? customAudience : AUDIENCE_PRESETS.find((a) => a.id === audiencePreset)?.label || ''

      const toneMap: Record<string, string> = {
        logical: 'ビジネス',
        friendly: 'やさしい',
        professional: '専門的',
        casual: 'カジュアル',
      }

      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${mainKeyword}に関する${ARTICLE_TYPES.find((t) => t.id === articleType)?.label || '記事'}`,
          keywords: [mainKeyword, ...related],
          persona,
          tone: toneMap[tone] || '丁寧',
          targetChars,
          searchIntent: preview.seoIntent,
          llmoOptions: DEFAULT_LLMO,
          autoBundle: true,
          createJob: true,
          requestText: customInfo.trim() || undefined,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `エラーが発生しました (${res.status})`)
      }

      const jobId = json.jobId || json.job?.id
      const articleId = json.articleId || json.article?.id
      if (jobId) {
        router.push(`/seo/jobs/${jobId}?auto=1`)
      } else if (articleId) {
        router.push(`/seo/articles/${articleId}`)
      } else {
        router.push('/seo')
      }
    } catch (e: any) {
      setError(e?.message || '生成に失敗しました')
      setLoading(false)
    }
  }

  function fillSample() {
    setMainKeyword('AI ライティング ツール 比較')
    setArticleType('comparison')
    setAudiencePreset('marketer')
    setTone('logical')
    setTargetChars(10000)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <div className="bg-white rounded-3xl sm:rounded-[40px] border border-gray-100 shadow-2xl shadow-blue-500/5 overflow-hidden">
          {/* ヘッダー */}
          <div className="px-6 sm:px-10 pt-8 sm:pt-10 pb-6 text-center border-b border-gray-50 relative">
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black hover:bg-blue-100 transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              使い方
            </button>

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl shadow-blue-500/30">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              SEO記事を作成する
            </h1>
            <p className="text-sm text-gray-400 font-bold mt-2">
              3ステップで高品質な記事を生成
            </p>

            {/* Stepインジケーター */}
            <div className="mt-6 flex items-center justify-center gap-3">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      step === s
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : step > s
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`w-8 h-0.5 ${step > s ? 'bg-blue-300' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {step === 1 && 'Step 1: 記事の軸'}
              {step === 2 && 'Step 2: 読者像'}
              {step === 3 && 'Step 3: 仕上がり'}
            </div>
          </div>

          {/* コンテンツ */}
          <div className="px-6 sm:px-10 py-6 sm:py-8">
            <AnimatePresence mode="wait">
              {/* Step 1: 記事の軸 */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* 主キーワード */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                        主キーワード <span className="text-red-400">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={fillSample}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 text-purple-600 text-[10px] font-black hover:from-purple-100 hover:to-indigo-100 transition-all"
                      >
                        <Wand2 className="w-3 h-3" />
                        サンプル入力
                      </button>
                    </div>
                    <input
                      type="text"
                      value={mainKeyword}
                      onChange={(e) => setMainKeyword(e.target.value)}
                      placeholder="例：AI ライティング ツール 比較"
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-base placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      autoFocus
                    />
                    <p className="mt-2 text-xs text-gray-400 font-medium">
                      💡 上位表示したい検索キーワードを入力してください
                    </p>
                  </div>

                  {/* 記事タイプ */}
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                      記事タイプ
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {ARTICLE_TYPES.map((type) => {
                        const Icon = type.icon
                        const selected = articleType === type.id
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setArticleType(type.id)}
                            className={`p-4 rounded-2xl border-2 text-left transition-all ${
                              selected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <Icon className={`w-5 h-5 mb-2 ${selected ? 'text-blue-600' : 'text-gray-400'}`} />
                            <p className={`text-sm font-black ${selected ? 'text-blue-600' : 'text-gray-700'}`}>
                              {type.label}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">{type.desc}</p>
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-3 text-xs text-gray-400 font-medium">
                      📝 記事タイプに応じて構成が最適化されます
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 2: 読者像 */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                      想定読者
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {AUDIENCE_PRESETS.map((preset) => {
                        const selected = audiencePreset === preset.id
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setAudiencePreset(preset.id)}
                            className={`p-4 rounded-2xl border-2 text-left transition-all ${
                              selected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <p className={`text-sm font-black ${selected ? 'text-blue-600' : 'text-gray-700'}`}>
                              {preset.label}
                            </p>
                            {preset.desc && (
                              <p className="text-[10px] text-gray-400 mt-1">{preset.desc}</p>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {audiencePreset === 'custom' && (
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                        読者を具体的に
                      </label>
                      <input
                        type="text"
                        value={customAudience}
                        onChange={(e) => setCustomAudience(e.target.value)}
                        placeholder="例：SaaS企業のマーケ責任者（30〜40代）"
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-sm placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                  )}

                  <p className="text-xs text-gray-400 font-medium">
                    👤 読者像を設定すると、語り口や具体例が最適化されます
                  </p>
                </motion.div>
              )}

              {/* Step 3: 仕上がり */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* 文体 */}
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                      文体・トーン
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {TONE_OPTIONS.map((option) => {
                        const selected = tone === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setTone(option.id)}
                            className={`p-4 rounded-2xl border-2 text-left transition-all ${
                              selected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{option.emoji}</span>
                              <p className={`text-sm font-black ${selected ? 'text-blue-600' : 'text-gray-700'}`}>
                                {option.label}
                              </p>
                            </div>
                            <p className="text-[10px] text-gray-400">{option.desc}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 文字数 */}
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                      文字数目安
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {CHAR_PRESETS.map((preset) => {
                        const selected = targetChars === preset.value
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setTargetChars(preset.value)}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${
                              selected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <p className={`text-sm font-black ${selected ? 'text-blue-600' : 'text-gray-700'}`}>
                              {preset.label}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{preset.desc}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 詳細設定（折りたたみ） */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <Zap className="w-3.5 h-3.5" />
                      SEOを本気で強化する（任意）
                    </button>

                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-4 space-y-4 overflow-hidden"
                        >
                          <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                              関連キーワード
                            </label>
                            <textarea
                              value={relatedKeywords}
                              onChange={(e) => setRelatedKeywords(e.target.value)}
                              placeholder="カンマ区切りで入力&#10;例：SEO対策, コンテンツ作成, 記事代行"
                              rows={3}
                              className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-sm placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                            />
                            <p className="mt-1 text-[10px] text-gray-400">
                              💡 入れなくても生成できます。入れると網羅性が上がります
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                              独自情報・制約
                            </label>
                            <textarea
                              value={customInfo}
                              onChange={(e) => setCustomInfo(e.target.value)}
                              placeholder="自社の強み、料金、NG表現など&#10;例：競合A社より価格が20%安い、〇〇という表現は使わない"
                              rows={4}
                              className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-sm placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                            />
                            <p className="mt-1 text-[10px] text-gray-400">
                              💡 一次情報を入れると、他にない記事になります
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* プレビューパネル */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                    <p className="text-xs font-black text-blue-700 uppercase tracking-widest mb-3">
                      生成プレビュー
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] text-blue-500 font-bold">記事タイプ</p>
                        <p className="font-black text-gray-900">{preview.type}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-blue-500 font-bold">想定読者</p>
                        <p className="font-black text-gray-900">{preview.audience}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-blue-500 font-bold">想定見出し数</p>
                        <p className="font-black text-gray-900">{preview.headings}見出し</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-blue-500 font-bold">想定文字数</p>
                        <p className="font-black text-gray-900">{preview.chars}字</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] text-blue-500 font-bold">SEO意図</p>
                        <p className="font-black text-gray-900">{preview.seoIntent}</p>
                      </div>
                    </div>

                    {/* 差別化メッセージ */}
                    <div className="mt-4 pt-4 border-t border-blue-100 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                        <Search className="w-3.5 h-3.5" />
                        <span>上位記事を分析して構成設計</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                        <Zap className="w-3.5 h-3.5" />
                        <span>LLMO（AI検索）を意識した構造</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                        <Target className="w-3.5 h-3.5" />
                        <span>日本語SEO特化の文章生成</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* エラー */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold"
              >
                {error}
              </motion.div>
            )}
          </div>

          {/* フッター（ナビゲーション） */}
          <div className="px-6 sm:px-10 pb-8 sm:pb-10 flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
                className="h-14 px-6 rounded-2xl bg-gray-100 text-gray-600 font-black text-sm hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                戻る
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (step < 3) {
                  setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)
                } else {
                  handleGenerate()
                }
              }}
              disabled={!canProceed || loading}
              className="flex-1 h-14 sm:h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-base shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  生成中...
                </>
              ) : step < 3 ? (
                <>
                  次へ
                  <ArrowRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  記事を生成する
                  <Sparkles className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* 補足 */}
        <p className="text-center text-xs text-gray-400 font-bold mt-6">
          3ステップで簡単に高品質なSEO記事を作成できます。<br />
          構成・本文はあとから自由に編集できます。
        </p>
      </motion.div>

      {/* 使い方モーダル */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowHelp(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-black text-gray-900">使い方ガイド</h2>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-6 overflow-y-auto space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black flex-shrink-0">1</div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 mb-1">記事の軸を決める</h3>
                    <p className="text-xs text-gray-500">
                      上位表示したいキーワードと記事タイプを選択します。
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black flex-shrink-0">2</div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 mb-1">読者像を設定</h3>
                    <p className="text-xs text-gray-500">
                      誰に向けた記事かを選ぶと、語り口や具体例が最適化されます。
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black flex-shrink-0">3</div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 mb-1">仕上がりを確認</h3>
                    <p className="text-xs text-gray-500">
                      文体・文字数を選び、プレビューを確認してから生成します。
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                  <p className="text-xs font-bold text-blue-700">
                    💡 「SEOを本気で強化する」を開くと、関連キーワードや独自情報を追加できます。
                    入力しなくても高品質な記事が生成されます。
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100">
                <button
                  onClick={() => setShowHelp(false)}
                  className="w-full h-12 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}
