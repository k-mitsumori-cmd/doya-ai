'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Sparkles,
  Loader2,
  AlertTriangle,
  Globe,
  Building2,
  Users,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Check,
  Target,
  Heart,
  Zap,
  Compass,
  LayoutGrid,
} from 'lucide-react'
import ScoreCard from '@/components/shindan/ScoreCard'
import ShindanRadarChart from '@/components/shindan/ShindanRadarChart'
import BenchmarkChart from '@/components/shindan/BenchmarkChart'
import BottleneckPanel from '@/components/shindan/BottleneckPanel'
import RecommendationPanel from '@/components/shindan/RecommendationPanel'
import PdfExportButton from '@/components/shindan/PdfExportButton'

// ===== 型定義 =====
interface ShindanResult {
  overallScore: number
  overallGrade: string
  summary: string
  axes: Array<{ label: string; score: number; comment: string }>
  strengths: Array<{ title: string; description: string; score: number }>
  bottlenecks: Array<{ title: string; description: string; severity: string; impact: string }>
  recommendations: Array<{
    title: string; description: string; priority: string
    estimatedCost: string; estimatedEffect: string; timeframe: string
  }>
  benchmark: Array<{ category: string; yourScore: number; industryAverage: number }>
}

interface QuestionDef {
  id: string
  label: string
  type: 'select' | 'scale5' | 'multiselect'
  options: string[]
}

interface StepDef {
  title: string
  description: string
  questions: QuestionDef[]
}

interface CategoryDef {
  id: string
  title: string
  icon: React.ElementType
  description: string
}

// ===== カテゴリ定義 =====
const CATEGORIES: CategoryDef[] = [
  { id: 'marketing', title: '集客・マーケティング', icon: Globe, description: '広告・SEO・SNS・リード獲得の状況' },
  { id: 'sales', title: '営業・商談プロセス', icon: Target, description: '成約率・営業プロセス・CRM活用' },
  { id: 'customer', title: '顧客対応・リテンション', icon: Heart, description: 'リピート率・フィードバック・CS体制' },
  { id: 'organization', title: '組織・人材', icon: Users, description: '採用・研修・役割分担・ビジョン浸透' },
  { id: 'finance', title: '財務・収益構造', icon: TrendingUp, description: '売上成長・利益率・顧客集中度' },
  { id: 'digital', title: 'デジタル・業務効率化', icon: Zap, description: 'ツール活用・自動化・データアクセス' },
  { id: 'strategy', title: '経営戦略・成長投資', icon: Compass, description: '成長目標・障壁・競争優位性' },
]

// ===== 基本情報ステップ =====
const BASIC_STEP: StepDef = {
  title: '基本情報',
  description: 'ビジネスの基本プロフィールを教えてください',
  questions: [
    {
      id: 'industry', type: 'select', label: '業種',
      options: ['IT/SaaS', 'EC/通販', '飲食/フード', '不動産', '教育/スクール', '医療/ヘルスケア', '製造/メーカー', '士業/コンサル', '美容/サロン', '人材/HR', '金融/保険', '広告/メディア', 'その他'],
    },
    {
      id: 'revenueScale', type: 'select', label: '年間売上規模',
      options: ['〜1,000万円', '〜5,000万円', '〜1億円', '〜5億円', '〜10億円', '10億円以上'],
    },
    {
      id: 'employeeCount', type: 'select', label: '従業員数',
      options: ['1人（個人）', '2〜5人', '6〜20人', '21〜50人', '51〜100人', '101〜300人', '300人以上'],
    },
    {
      id: 'companyAge', type: 'select', label: '創業年数',
      options: ['1年未満', '1〜3年', '3〜5年', '5〜10年', '10〜20年', '20年以上'],
    },
  ],
}

// ===== カテゴリ別質問ステップ =====
const CATEGORY_QUESTIONS: Record<string, StepDef> = {
  marketing: {
    title: '集客・マーケティング',
    description: '新規顧客の獲得状況を詳しく教えてください',
    questions: [
      { id: 'channels', type: 'multiselect', label: '主な集客チャネル（複数選択可）', options: ['SEO/検索', 'SNS運用', 'Web広告', '紹介・口コミ', '展示会/セミナー', 'メール/DM', '特になし'] },
      { id: 'leadCount', type: 'scale5', label: '月間リード獲得数', options: ['ほぼなし', '月1〜10件', '月11〜50件', '月51〜100件', '月100件以上'] },
      { id: 'measurementMaturity', type: 'scale5', label: 'マーケティング効果測定', options: ['未実施', '一部実施', '定期測定', '分析→改善', '高度に最適化'] },
      { id: 'contentMarketing', type: 'scale5', label: 'コンテンツマーケティング', options: ['未着手', '検討中', '開始済み', '定期発信中', '成果実績あり'] },
    ],
  },
  sales: {
    title: '営業・商談プロセス',
    description: '営業活動の効率と成約力を詳しく教えてください',
    questions: [
      { id: 'closeRate', type: 'scale5', label: '商談成約率', options: ['〜10%', '11〜20%', '21〜40%', '41〜60%', '60%以上'] },
      { id: 'salesProcess', type: 'scale5', label: '営業プロセスの標準化', options: ['完全に属人的', '一部共有', 'マニュアル化', 'CRM/SFA活用', 'AI活用'] },
      { id: 'leadTime', type: 'scale5', label: '商談リードタイム', options: ['3ヶ月以上', '2〜3ヶ月', '1〜2ヶ月', '2週間〜1ヶ月', '2週間未満'] },
      { id: 'salesAnalysis', type: 'scale5', label: 'データに基づく営業分析', options: ['未実施', '勘と経験', 'Excel管理', 'BI活用', '予測分析'] },
    ],
  },
  customer: {
    title: '顧客対応・リテンション',
    description: '既存顧客の維持・満足度を詳しく教えてください',
    questions: [
      { id: 'repeatRate', type: 'scale5', label: 'リピート率・継続率', options: ['〜10%', '11〜30%', '31〜50%', '51〜70%', '70%以上'] },
      { id: 'feedbackCollection', type: 'scale5', label: '顧客フィードバック収集', options: ['未実施', '不定期', '定期収集', 'NPS等で定量化', '改善サイクル連動'] },
      { id: 'afterFollow', type: 'scale5', label: 'アフターフォロー体制', options: ['体制なし', '問合せ対応のみ', '定期連絡', '専任CS担当', '自動+個別最適化'] },
    ],
  },
  organization: {
    title: '組織・人材',
    description: '組織体制と人材の充実度を詳しく教えてください',
    questions: [
      { id: 'hiringDifficulty', type: 'scale5', label: '採用の課題度', options: ['非常に困難', 'やや困難', '普通', '比較的容易', '問題なし'] },
      { id: 'roleClarity', type: 'scale5', label: '役割・責任の明確さ', options: ['不明確', '一部不明確', 'おおむね明確', '明確', '評価制度と連動'] },
      { id: 'training', type: 'scale5', label: '教育・研修制度', options: ['制度なし', 'OJTのみ', '年数回の研修', '体系的プログラム', '個別最適化'] },
      { id: 'visionAlignment', type: 'scale5', label: '経営ビジョンの浸透度', options: ['未策定', '経営層のみ', '一部共有', '全社浸透', '行動指針と連動'] },
    ],
  },
  finance: {
    title: '財務・収益構造',
    description: '収益の安定性と成長性を詳しく教えてください',
    questions: [
      { id: 'growthTrend', type: 'scale5', label: '直近の売上成長トレンド', options: ['大幅減少', 'やや減少', '横ばい', '成長中', '急成長'] },
      { id: 'profitMargin', type: 'scale5', label: '利益率の実感', options: ['赤字', '薄利', '業界並み', 'やや高い', '高い'] },
      { id: 'customerConcentration', type: 'scale5', label: '顧客・売上の集中度', options: ['1社依存', '上位3社で過半', 'やや集中', '分散', '高度に分散'] },
    ],
  },
  digital: {
    title: 'デジタル・業務効率化',
    description: 'IT活用と業務効率の成熟度を詳しく教えてください',
    questions: [
      { id: 'toolsUsed', type: 'multiselect', label: '利用中のツール（複数選択可）', options: ['CRM/SFA', 'MA（マーケ自動化）', '会計/経理ソフト', 'ビジネスチャット', 'PJ管理ツール', 'AI/自動化ツール', '特になし'] },
      { id: 'automationLevel', type: 'scale5', label: '業務自動化レベル', options: ['ほぼ手作業', '一部自動化', '主要業務を自動化', '全体最適化', 'AI活用自動化'] },
      { id: 'dataAccess', type: 'scale5', label: 'データへのアクセス性', options: ['バラバラ管理', '一部統合', 'ダッシュボードあり', 'リアルタイム可視化', '予測分析可能'] },
    ],
  },
  strategy: {
    title: '経営戦略・成長投資',
    description: '中長期の戦略と競争力を詳しく教えてください',
    questions: [
      { id: 'priorityGoal', type: 'select', label: '最優先の成長目標', options: ['売上拡大', '利益率改善', '新市場開拓', '新商品/サービス開発', 'M&A・業務提携', 'DX推進'] },
      { id: 'growthObstacle', type: 'select', label: '最大の成長障壁', options: ['資金不足', '人材不足', '市場の縮小', '技術力不足', '競合激化', '規制・法的制約'] },
      { id: 'competitiveAdvantage', type: 'scale5', label: '競争優位性の自己評価', options: ['特になし', '価格競争力', '品質・技術力', 'スピード・柔軟性', 'ブランド+独自性'] },
    ],
  },
}

const NONE_OPTION = '特になし'

// ===== メインコンポーネント =====
export default function ShindanPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ShindanResult | null>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)

  // ステップ数（基本情報 + 項目選択 + 選択カテゴリ数）
  const totalSteps = 2 + selectedCategories.length
  const isLastStep = currentStep === totalSteps - 1 && currentStep >= 2

  // 現在のステップ情報取得
  const getStepType = (): 'basic' | 'category-selection' | 'questions' => {
    if (currentStep === 0) return 'basic'
    if (currentStep === 1) return 'category-selection'
    return 'questions'
  }

  const getCurrentQuestionStep = (): StepDef | null => {
    if (currentStep < 2) return currentStep === 0 ? BASIC_STEP : null
    const catId = selectedCategories[currentStep - 2]
    return catId ? CATEGORY_QUESTIONS[catId] : null
  }

  const getCurrentIcon = (): React.ElementType => {
    if (currentStep === 0) return Building2
    if (currentStep === 1) return LayoutGrid
    const catId = selectedCategories[currentStep - 2]
    return CATEGORIES.find((c) => c.id === catId)?.icon || Activity
  }

  const stepType = getStepType()
  const questionStep = getCurrentQuestionStep()
  const StepIcon = getCurrentIcon()

  // 進行可能判定
  const canProceed = useMemo(() => {
    if (currentStep === 0) {
      return BASIC_STEP.questions.every((q) => !!answers[q.id])
    }
    if (currentStep === 1) {
      return selectedCategories.length > 0
    }
    if (!questionStep) return false
    return questionStep.questions.every((q) => {
      const a = answers[q.id]
      if (q.type === 'multiselect') return Array.isArray(a) && a.length > 0
      return !!a
    })
  }, [currentStep, answers, selectedCategories, questionStep])

  // 回答済み数
  const answeredCount = useMemo(() => {
    let count = 0
    // 基本情報
    for (const q of BASIC_STEP.questions) {
      if (answers[q.id]) count++
    }
    // 選択カテゴリの質問
    for (const catId of selectedCategories) {
      const step = CATEGORY_QUESTIONS[catId]
      if (!step) continue
      for (const q of step.questions) {
        const a = answers[q.id]
        if (q.type === 'multiselect' ? (Array.isArray(a) && a.length > 0) : !!a) count++
      }
    }
    return count
  }, [answers, selectedCategories])

  const totalQuestions = useMemo(() => {
    let count = BASIC_STEP.questions.length
    for (const catId of selectedCategories) {
      count += CATEGORY_QUESTIONS[catId]?.questions.length || 0
    }
    return count
  }, [selectedCategories])

  // カテゴリ選択トグル
  const toggleCategory = useCallback((catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((c) => c !== catId)
        : [...prev, catId]
    )
  }, [])

  // 回答セット
  const setAnswer = useCallback((id: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }, [])

  // マルチセレクトのトグル
  const toggleMultiselect = useCallback((id: string, option: string) => {
    setAnswers((prev) => {
      const current = (prev[id] as string[]) || []
      if (option === NONE_OPTION) {
        return { ...prev, [id]: current.includes(NONE_OPTION) ? [] : [NONE_OPTION] }
      }
      const withoutNone = current.filter((v) => v !== NONE_OPTION)
      if (withoutNone.includes(option)) {
        return { ...prev, [id]: withoutNone.filter((v) => v !== option) }
      }
      return { ...prev, [id]: [...withoutNone, option] }
    })
  }, [])

  // ナビゲーション
  const goNext = useCallback(() => {
    if (currentStep < totalSteps - 1) setCurrentStep((s) => s + 1)
  }, [currentStep, totalSteps])

  const goBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }, [currentStep])

  // 送信
  const handleSubmit = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/shindan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          selectedCategories,
          websiteUrl: websiteUrl || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '診断に失敗しました。もう一度お試しください。')
        return
      }

      const r = data.result as ShindanResult
      setResult(r)

      // 履歴保存
      try {
        const existing = JSON.parse(localStorage.getItem('doya_shindan_history') || '[]')
        const entry = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          industry: answers.industry || '',
          overallScore: r.overallScore,
          overallGrade: r.overallGrade,
          summary: r.summary,
          result: r,
        }
        localStorage.setItem('doya_shindan_history', JSON.stringify([entry, ...existing].slice(0, 20)))
      } catch {}
    } catch {
      setError('通信エラーが発生しました。ネットワーク接続を確認してください。')
    } finally {
      setIsLoading(false)
    }
  }, [answers, selectedCategories, websiteUrl])

  // ===== 質問レンダリング =====
  const renderQuestion = (q: QuestionDef, idx: number) => {
    if (q.type === 'scale5') {
      return (
        <div key={q.id} className="space-y-2">
          <label className="block text-sm font-bold text-slate-300">
            <span className="text-teal-400 mr-1.5">Q{idx + 1}.</span>
            {q.label}
          </label>
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => setAnswer(q.id, opt)}
                className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                  answers[q.id] === opt
                    ? 'bg-teal-500 border-teal-500 text-white shadow-lg shadow-teal-500/20'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-teal-500/50'
                }`}
              >
                <span className="text-[10px] text-slate-500 mr-1">{i + 1}</span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (q.type === 'multiselect') {
      const selected = (answers[q.id] as string[]) || []
      return (
        <div key={q.id} className="space-y-2">
          <label className="block text-sm font-bold text-slate-300">
            <span className="text-teal-400 mr-1.5">Q{idx + 1}.</span>
            {q.label}
          </label>
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => {
              const isSelected = selected.includes(opt)
              return (
                <button
                  key={opt}
                  onClick={() => toggleMultiselect(q.id, opt)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-teal-500/50'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    // select
    return (
      <div key={q.id} className="space-y-2">
        <label className="block text-sm font-bold text-slate-300">
          <span className="text-teal-400 mr-1.5">Q{idx + 1}.</span>
          {q.label}
        </label>
        <div className="flex flex-wrap gap-2">
          {q.options.map((opt) => (
            <button
              key={opt}
              onClick={() => setAnswer(q.id, opt)}
              className={`px-3 py-2.5 rounded-lg text-sm font-bold transition-all border ${
                answers[q.id] === opt
                  ? 'bg-teal-500 border-teal-500 text-white shadow-lg shadow-teal-500/20'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-teal-500/50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ===== 描画 =====
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* ヘッダー */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">ドヤ診断AI</h1>
          </div>
          <p className="text-slate-400 text-sm sm:text-base">
            ビジネスの強み・ボトルネック・最適解をAIが診断
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* プログレス */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>ステップ {currentStep + 1} / {totalSteps}</span>
                  {currentStep >= 1 && <span>{answeredCount} / {totalQuestions} 問回答済み</span>}
                </div>
                <div className="flex items-center gap-2 justify-center">
                  {Array.from({ length: totalSteps }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => i <= currentStep && setCurrentStep(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === currentStep
                          ? 'bg-teal-500 w-12'
                          : i < currentStep
                          ? 'bg-teal-500/40 w-8 cursor-pointer'
                          : 'bg-slate-700 w-8'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* ステップコンテンツ */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6"
                >
                  {/* ステップヘッダー */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                      <StepIcon className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black">
                        {stepType === 'basic' && '基本情報'}
                        {stepType === 'category-selection' && '確かめたい項目'}
                        {stepType === 'questions' && questionStep?.title}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {stepType === 'basic' && 'ビジネスの基本プロフィールを教えてください'}
                        {stepType === 'category-selection' && '診断したい領域を選んでください（複数選択可）'}
                        {stepType === 'questions' && questionStep?.description}
                      </p>
                    </div>
                  </div>

                  {/* === 基本情報 === */}
                  {stepType === 'basic' && (
                    <>
                      {BASIC_STEP.questions.map((q, i) => renderQuestion(q, i))}
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <label className="block text-sm font-bold text-slate-400">
                          <Globe className="w-4 h-4 inline mr-1" />
                          WebサイトURL（任意）
                        </label>
                        <input
                          type="url"
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://example.com"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        />
                        <p className="text-[11px] text-slate-600">入力するとWebサイトの内容もAI分析に含めます</p>
                      </div>
                    </>
                  )}

                  {/* === カテゴリ選択 === */}
                  {stepType === 'category-selection' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {CATEGORIES.map((cat) => {
                        const isSelected = selectedCategories.includes(cat.id)
                        const CatIcon = cat.icon
                        return (
                          <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                              isSelected
                                ? 'bg-teal-500/10 border-teal-500 ring-1 ring-teal-500/30'
                                : 'bg-slate-800/50 border-slate-700 hover:border-teal-500/30'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? 'bg-teal-500' : 'bg-slate-700'
                            }`}>
                              <CatIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-sm text-white">{cat.title}</div>
                              <div className="text-[11px] text-slate-400 leading-relaxed">{cat.description}</div>
                            </div>
                            {isSelected && <Check className="w-5 h-5 text-teal-400 flex-shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* === カテゴリ質問 === */}
                  {stepType === 'questions' && questionStep && (
                    questionStep.questions.map((q, i) => renderQuestion(q, i))
                  )}
                </motion.div>
              </AnimatePresence>

              {/* エラー */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </motion.div>
              )}

              {/* ナビゲーション */}
              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={goBack}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-300 bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    戻る
                  </motion.button>
                )}

                <motion.button
                  whileHover={canProceed ? { scale: 1.02 } : {}}
                  whileTap={canProceed ? { scale: 0.98 } : {}}
                  onClick={isLastStep ? handleSubmit : goNext}
                  disabled={!canProceed || isLoading}
                  className={`flex-1 flex items-center justify-center gap-3 py-3.5 rounded-xl font-black text-base transition-all ${
                    canProceed && !isLoading
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/20 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      AIが診断中...
                    </>
                  ) : isLastStep ? (
                    <>
                      <Sparkles className="w-5 h-5" />
                      ビジネスを診断する
                    </>
                  ) : (
                    <>
                      次へ
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          ) : (
            /* ===== ダッシュボード ===== */
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => { setResult(null); setCurrentStep(0) }}
                  className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
                >
                  ← 新しい診断を行う
                </button>
                <PdfExportButton targetRef={dashboardRef} fileName={`doya-shindan-${answers.industry || 'report'}`} />
              </div>

              <div ref={dashboardRef} className="space-y-6">
                <ScoreCard
                  score={result.overallScore}
                  grade={result.overallGrade}
                  summary={result.summary}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-teal-400" />
                      {result.axes.length}軸評価
                    </h3>
                    <ShindanRadarChart axes={result.axes} />
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      強み Top3
                    </h3>
                    <div className="space-y-4">
                      {result.strengths.map((s, i) => (
                        <div key={i} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-black text-white">{i + 1}</span>
                              <h4 className="font-black text-emerald-300">{s.title}</h4>
                            </div>
                            <span className="text-sm font-black text-emerald-400">{s.score}点</span>
                          </div>
                          <p className="text-sm text-slate-300 leading-relaxed">{s.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    業界ベンチマーク比較
                  </h3>
                  <BenchmarkChart benchmark={result.benchmark} />
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    ボトルネック
                  </h3>
                  <BottleneckPanel bottlenecks={result.bottlenecks} />
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal-400" />
                    改善アクション提案
                  </h3>
                  <RecommendationPanel recommendations={result.recommendations} />
                </div>
              </div>

              <div className="mt-8 flex justify-center">
                <PdfExportButton targetRef={dashboardRef} fileName={`doya-shindan-${answers.industry || 'report'}`} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
