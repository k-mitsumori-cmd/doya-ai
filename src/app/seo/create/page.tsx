'use client'

import Link from 'next/link'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
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
  Lock,
} from 'lucide-react'
import { AiThinkingStrip } from '@seo/components/AiThinkingStrip'

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
  { value: 3000, label: '3,000字', desc: 'コンパクトな記事', minPlan: 'GUEST' },
  { value: 5000, label: '5,000字', desc: '要点を絞った記事', minPlan: 'GUEST' },
  { value: 10000, label: '10,000字', desc: '標準的なSEO記事', minPlan: 'FREE' },
  { value: 20000, label: '20,000字', desc: '網羅性の高い記事', minPlan: 'PRO' },
  { value: 30000, label: '30,000字', desc: '徹底解説記事', minPlan: 'PRO' },
  { value: 50000, label: '50,000字', desc: '超大型コンテンツ', minPlan: 'ENTERPRISE' },
] as const

// プラン別文字数上限
const CHAR_LIMITS: Record<string, number> = {
  GUEST: 5000,
  FREE: 10000,
  PRO: 30000,
  ENTERPRISE: 50000,
}

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

type Sample = {
  id: string
  name: string
  mainKeyword: string
  articleType: typeof ARTICLE_TYPES[number]['id']
  audiencePreset: typeof AUDIENCE_PRESETS[number]['id']
  tone: typeof TONE_OPTIONS[number]['id']
  targetChars: number
  relatedKeywords?: string
  originalContent?: string
  constraints?: string
}

// サンプル（押すたびに切り替え/一覧から選択）
const SAMPLES: Sample[] = [
  {
    id: 'rpo50',
    name: 'RPO（採用代行）比較',
    mainKeyword: 'RPO おすすめ 比較',
    articleType: 'comparison',
    audiencePreset: 'hr',
    tone: 'logical',
    targetChars: 20000,
    relatedKeywords: '採用代行, 料金相場, 選び方, 比較表, 失敗例, チェックリスト',
    originalContent: '自社の採用課題（例：母集団が弱い/面接工数が逼迫）と、RPOに期待する成果（スピード/品質/コスト）を必ず入れてください。',
  },
  {
    id: 'aiwriting',
    name: 'AIライティングツール比較',
    mainKeyword: 'AI ライティング ツール 比較',
    articleType: 'comparison',
    audiencePreset: 'marketer',
    tone: 'logical',
    targetChars: 10000,
    relatedKeywords: '記事作成, 生成AI, 料金, 精度, 使い方, 注意点',
    originalContent: '実際に運用した時の“地味に効くポイント”（例：下書き→人間校正の分業、社内ルール整備）を入れてください。',
  },
  {
    id: 'crm',
    name: 'CRMツール比較',
    mainKeyword: 'CRM おすすめ 比較',
    articleType: 'comparison',
    audiencePreset: 'executive',
    tone: 'professional',
    targetChars: 20000,
    relatedKeywords: '顧客管理, SFA, MA, 料金, 導入手順, 失敗しない選び方',
    originalContent: '導入目的（売上可視化/引き継ぎ/商談管理）を明確にし、目的別におすすめが分かれる形で書いてください。',
  },
  {
    id: 'sfa',
    name: 'SFA導入ガイド（HowTo）',
    mainKeyword: 'SFA 導入 手順',
    articleType: 'howto',
    audiencePreset: 'marketer',
    tone: 'logical',
    targetChars: 10000,
    relatedKeywords: '営業管理, KPI, 定着, 運用ルール, 失敗例',
    originalContent: '“定着しない”が最大の失敗。運用ルール（入力の最小要件/週次レビュー）を具体例で入れてください。',
  },
  {
    id: 'seo',
    name: 'SEO対策（完全ガイド）',
    mainKeyword: 'SEO対策 やり方',
    articleType: 'howto',
    audiencePreset: 'beginner',
    tone: 'friendly',
    targetChars: 20000,
    relatedKeywords: '検索意図, キーワード選定, 内部対策, コンテンツ, 失敗例, チェックリスト',
    originalContent: '初心者がやりがちな失敗（タイトルだけ最適化/リライトしない）を入れてください。',
  },
  {
    id: 'lp',
    name: 'LP改善（CVR改善）',
    mainKeyword: 'LP 改善 方法',
    articleType: 'howto',
    audiencePreset: 'marketer',
    tone: 'logical',
    targetChars: 10000,
    relatedKeywords: 'CVR, ファーストビュー, CTA, ABテスト, ヒートマップ',
    originalContent: '“何を捨てるか”の優先順位（1回の改修で触る箇所は3つまで等）を入れてください。',
  },
  {
    id: 'webinar',
    name: 'ウェビナー集客（解説）',
    mainKeyword: 'ウェビナー 集客',
    articleType: 'explanation',
    audiencePreset: 'marketer',
    tone: 'professional',
    targetChars: 10000,
    relatedKeywords: '告知, メール, SNS広告, LP, 当日運営, フォロー',
    originalContent: '開催前/当日/開催後の“やること”をチェックリストで入れてください。',
  },
  {
    id: 'pricing',
    name: '料金ページの作り方（CV）',
    mainKeyword: '料金ページ 作り方',
    articleType: 'howto',
    audiencePreset: 'marketer',
    tone: 'logical',
    targetChars: 10000,
    relatedKeywords: '価格設計, 比較表, 不安解消, FAQ, 導入事例',
    originalContent: '価格の不安を減らすために、よくある不満（高い/比較できない）を先回りで潰してください。',
  },
  {
    id: 'case',
    name: '導入事例記事（型）',
    mainKeyword: '導入事例 記事 書き方',
    articleType: 'case',
    audiencePreset: 'marketer',
    tone: 'professional',
    targetChars: 10000,
    relatedKeywords: '課題, 解決策, 導入効果, 数値, 再現性',
    originalContent: 'Before/Afterは必須。可能なら数値で効果（例：工数-30%）を書く方針で。',
  },
  {
    id: 'ranking',
    name: 'おすすめランキング記事',
    mainKeyword: 'おすすめ ランキング 作り方',
    articleType: 'ranking',
    audiencePreset: 'beginner',
    tone: 'friendly',
    targetChars: 10000,
    relatedKeywords: '選び方, 比較軸, 料金, 口コミ, 注意点',
    originalContent: '結論→比較表→目的別おすすめ→FAQ の流れで“迷わない”構成にしてください。',
  },
  {
    id: 'dx',
    name: 'DX（徹底解説）',
    mainKeyword: 'DX とは',
    articleType: 'explanation',
    audiencePreset: 'executive',
    tone: 'professional',
    targetChars: 30000,
    relatedKeywords: '定義, 事例, 進め方, 失敗例, ロードマップ',
    originalContent: '社内の抵抗（現場負担/属人化）を前提に、進め方を段階的に書いてください。',
  },
  {
    id: 'hr-ai',
    name: '採用×AI（解説）',
    mainKeyword: '採用 AI 活用',
    articleType: 'explanation',
    audiencePreset: 'hr',
    tone: 'logical',
    targetChars: 10000,
    relatedKeywords: 'スカウト, 書類選考, 面接, 個人情報, 注意点',
    originalContent: '個人情報/バイアスへの配慮を必ず入れてください（やってはいけない例も）。',
  },
  {
    id: 'saas-launch',
    name: 'SaaSローンチ戦略（解説）',
    mainKeyword: 'SaaS ローンチ 戦略',
    articleType: 'explanation',
    audiencePreset: 'executive',
    tone: 'logical',
    targetChars: 20000,
    relatedKeywords: 'PMF, 価格, 初期ユーザー, オンボーディング, KPI',
    originalContent: '最初は“誰にだけ刺すか”を狭める。ターゲット絞り込みの例を入れてください。',
  },
  {
    id: 'content',
    name: 'コンテンツSEO（運用）',
    mainKeyword: 'コンテンツSEO 運用',
    articleType: 'howto',
    audiencePreset: 'marketer',
    tone: 'logical',
    targetChars: 20000,
    relatedKeywords: 'KW設計, 企画, リライト, 内部リンク, 効果測定',
    originalContent: '“作って終わり”にしない運用（週次でSearch Console確認→月次でリライト）を入れてください。',
  },
  {
    id: 'b2b-sales',
    name: 'B2B営業の型（解説）',
    mainKeyword: 'B2B 営業 進め方',
    articleType: 'explanation',
    audiencePreset: 'expert',
    tone: 'professional',
    targetChars: 10000,
    relatedKeywords: 'リード獲得, 商談化, 提案, 失注理由, 型',
    originalContent: '“失注理由の回収→反映”までの運用を具体的に書いてください。',
  },
]

// ================== メインコンポーネント ==================
export default function SeoCreateWizardPage() {
  const router = useRouter()

  // Step管理
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const { data: session } = useSession()

  // Step1: 記事の軸
  const [mainKeyword, setMainKeyword] = useState('')
  const [articleType, setArticleType] = useState<string>('comparison')

  // Step2: 読者
  const [audiencePreset, setAudiencePreset] = useState<string>('marketer')
  const [customAudience, setCustomAudience] = useState('')

  // Step3: 仕上がり
  const [tone, setTone] = useState<string>('logical')
  const [targetChars, setTargetChars] = useState(10000)

  // プラン情報
  const isLoggedIn = !!session?.user?.email
  const userPlan = useMemo(() => {
    if (!isLoggedIn) return 'GUEST'
    const seoPlan = (session?.user as any)?.seoPlan
    const plan = (session?.user as any)?.plan
    const p = String(seoPlan || plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO') return 'PRO'
    return 'FREE'
  }, [session, isLoggedIn])
  
  const charLimit = CHAR_LIMITS[userPlan] || 10000

  // 詳細設定（折りたたみ）
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [relatedKeywords, setRelatedKeywords] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [constraints, setConstraints] = useState('')
  const [showSampleMenu, setShowSampleMenu] = useState(false)
  const [sampleCursor, setSampleCursor] = useState(0)

  // 処理状態
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCta, setErrorCta] = useState<null | { label: string; href: string }>(null)
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
    setErrorCta(null)

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

      const requestText = [
        originalContent.trim() ? `【一次情報（経験・訴求ポイント）】\n${originalContent.trim()}` : '',
        constraints.trim() ? `【制約・NG表現】\n${constraints.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')

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
          requestText: requestText || undefined,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        if (res.status === 429) {
          setErrorCta({ label: '料金/プランを見る', href: '/seo/pricing' })
        } else if (res.status === 401) {
          setErrorCta({ label: 'ログインする', href: '/auth/signin' })
        }
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

  function applySample(sampleId?: string) {
    const sample = sampleId ? SAMPLES.find((s) => s.id === sampleId) : SAMPLES[0]
    if (!sample) return
    const idx = SAMPLES.findIndex((s) => s.id === sample.id)
    if (idx >= 0) setSampleCursor(idx)
    setMainKeyword(sample.mainKeyword)
    setArticleType(sample.articleType)
    setAudiencePreset(sample.audiencePreset)
    setTone(sample.tone)
    // サンプルの文字数がプラン上限を超える場合は上限に制限
    setTargetChars(Math.min(sample.targetChars, charLimit))
    setRelatedKeywords(sample.relatedKeywords || '')
    setOriginalContent(sample.originalContent || '')
    setConstraints(sample.constraints || '')
    setShowSampleMenu(false)
  }

  function cycleSample() {
    const next = (sampleCursor + 1) % SAMPLES.length
    applySample(SAMPLES[next]?.id)
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
                      <div className="relative flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cycleSample}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 text-purple-600 text-[10px] font-black hover:from-purple-100 hover:to-indigo-100 transition-all"
                          title="押すたびにサンプルが切り替わります"
                        >
                          <Wand2 className="w-3 h-3" />
                          サンプル（切替）
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSampleMenu((v) => !v)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[10px] font-black hover:bg-gray-50 transition-all"
                          title="サンプル一覧"
                        >
                          一覧
                          <ChevronDown className={`w-3 h-3 transition-transform ${showSampleMenu ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {showSampleMenu && (
                            <motion.div
                              initial={{ opacity: 0, y: -8, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.98 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-full mt-2 w-[360px] max-w-[85vw] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
                            >
                              <div className="p-3 border-b border-gray-50 bg-gray-50/50">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">サンプルを選択</p>
                              </div>
                              <div className="max-h-80 overflow-y-auto">
                                {SAMPLES.map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => applySample(s.id)}
                                    className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0"
                                  >
                                    <p className="text-sm font-black text-gray-900">{s.name}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">{s.mainKeyword}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 text-[9px] font-black border border-gray-100">
                                        {ARTICLE_TYPES.find((t) => t.id === s.articleType)?.label || s.articleType}
                                      </span>
                                      <span className="text-[10px] text-gray-400">{s.targetChars.toLocaleString()}字</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
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

                  {/* 一次情報（最重要） */}
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                      一次情報（経験・訴求ポイント）
                    </label>
                    <textarea
                      value={originalContent}
                      onChange={(e) => setOriginalContent(e.target.value)}
                      placeholder="例：実体験、現場の失敗談、数字、独自の主張、比較の結論、読者に必ず伝えたいこと…"
                      rows={4}
                      className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-sm placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                    />
                    <p className="mt-2 text-xs text-gray-400 font-medium">
                      ✨ ここに一次情報を入れるほど、独自性と説得力が増し、実務で使いやすい記事に仕上がります
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
                      <span className="ml-2 text-[10px] font-bold text-gray-400 normal-case">
                        ({userPlan === 'GUEST' ? 'ゲスト' : userPlan === 'FREE' ? '無料' : userPlan === 'PRO' ? 'プロ' : 'エンタープライズ'}プラン: 最大{charLimit.toLocaleString()}字)
                      </span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {CHAR_PRESETS.filter(p => p.value <= charLimit).map((preset) => {
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
                      {/* プランアップグレード誘導 */}
                      {userPlan !== 'ENTERPRISE' && (
                        <Link href="/seo/pricing" className="block">
                          <div className="p-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer">
                            <div className="flex items-center justify-center gap-1 text-sm font-black text-gray-400">
                              <Lock className="w-3.5 h-3.5" />
                              <span>もっと長く</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">プランをアップグレード</p>
                          </div>
                        </Link>
                      )}
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
                              制約・NG表現（任意）
                            </label>
                            <textarea
                              value={constraints}
                              onChange={(e) => setConstraints(e.target.value)}
                              placeholder="例：この表現は使わない、必ず『料金相場』を入れる、結論を冒頭に置く…"
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
                <div className="whitespace-pre-wrap break-words">{error}</div>
                {errorCta && (
                  <div className="mt-3">
                    <Link href={errorCta.href}>
                      <button
                        type="button"
                        className="h-10 px-4 rounded-xl bg-white border border-red-200 text-red-700 font-black text-xs hover:bg-red-50 transition-colors"
                      >
                        {errorCta.label}
                      </button>
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* フッター（ナビゲーション） */}
          <div className="px-6 sm:px-10 pb-8 sm:pb-10 flex flex-col gap-3">
            {loading && (
              <AiThinkingStrip
                show
                compact
                title="AIがSEO/LLMO対策を実行中…"
                subtitle="検索意図 → 構造化 → 網羅性 → 読みやすさ の順で最適化しています"
                tags={['SEO', 'LLMO', '構造化', '網羅性', '読みやすさ']}
                steps={['検索意図を推定', '上位構造を分析', 'LLMO向けに整理', '本文を生成・整合']}
              />
            )}

            <div className="flex items-center gap-3">
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
