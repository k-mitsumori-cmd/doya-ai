'use client'

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
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
  Brain,
  BarChart3,
  Search,
  FileText,
  Lightbulb,
  ShieldAlert,
  Cpu,
  Rocket,
  DollarSign,
  Plus,
  X,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Eye,
  ChevronDown,
  Image,
  Code2,
} from 'lucide-react'
import ScoreCard from '@/components/shindan/ScoreCard'
import ShindanRadarChart from '@/components/shindan/ShindanRadarChart'
import BenchmarkChart from '@/components/shindan/BenchmarkChart'
import BottleneckPanel from '@/components/shindan/BottleneckPanel'
import RecommendationPanel from '@/components/shindan/RecommendationPanel'
import PdfExportButton from '@/components/shindan/PdfExportButton'
import CompetitiveMatrix from '@/components/shindan/CompetitiveMatrix'

// ===== 型定義 =====
interface ShindanResult {
  overallScore: number
  overallGrade: string
  summary: string
  executiveSummary?: string
  axes: Array<{ label: string; score: number; comment: string }>
  strengths: Array<{ title: string; description: string; score: number; leverageAdvice?: string }>
  bottlenecks: Array<{ title: string; description: string; severity: string; impact: string; estimatedLoss?: string }>
  recommendations: Array<{
    title: string; description: string; priority: string
    estimatedCost: string; estimatedEffect: string; timeframe: string; quickWin?: boolean
  }>
  benchmark: Array<{ category: string; yourScore: number; industryAverage: number }>
  industryInsights?: string[]
  competitorIntelligence?: string
  immediateActions?: string[]
  analytics?: {
    categoryScores: Record<string, number>
    synergyPenalties: Array<{ name: string; penalty: number; description: string }>
    riskIndex: number
    dxMaturity: number
    growthPotential: number
    efficiencyScore: number
    websiteHealth: {
      seoScore: number; contentScore: number; technicalScore: number; totalScore: number
      issues: string[]; positives: string[]; pagesCrawled: number
      socialLinks: string[]; hasBlog: boolean; hasForm: boolean; ogImage?: string | null
      url?: string
      meta?: { title?: string; description?: string }
      headings?: string[]
      textLength?: number
      imageStats?: { total: number; withAlt: number }
      hasSchema?: boolean
      tracking?: {
        detectedTools: string[]
        maturityLevel: string
        trackingScore: number
      }
      appealAxis?: {
        heroText: string
        heroType: string
        valueProposition: string
        uspKeywords: string[]
        benefitStatements: string[]
        emotionalTriggers: string[]
        appealScore: number
      }
      socialProof?: {
        proofElements: string[]
        userCountText: string | null
        socialProofScore: number
      }
      ctaAnalysis?: {
        ctaTexts: string[]
        ctaCount: number
        ctaPlacement: string
        primaryCTA: string | null
        hasLeadMagnet: boolean
        hasLiveChat: boolean
        ctaEffectivenessScore: number
      }
      pricingSignals?: {
        pricingModel: string
        hasPricingPage: boolean
        hasFreeTrial: boolean
        priceIndicators: string[]
        pricingTransparencyScore: number
      }
      contentMarketing?: {
        contentTypes: string[]
        blogPostIndicators: number
        hasNewsletterSignup: boolean
        hasVideo: boolean
        contentDepthScore: number
        topicClusters: string[]
      }
      competitivePositioning?: {
        positioningType: string
        hasComparisonPage: boolean
        differentiationClaims: string[]
        mentionedCompetitors: string[]
        positioningScore: number
      }
    } | null
    credibilityGap: number
    competitorComparison: Array<{
      url: string; seoScore: number; contentScore: number; technicalScore: number
      totalScore: number; hasBlog: boolean; hasForm: boolean; socialLinks: string[]; ogImage?: string | null
      meta?: { title?: string; description?: string }
      headings?: string[]
      issues?: string[]
      positives?: string[]
      textLength?: number
      imageStats?: { total: number; withAlt: number }
      hasSchema?: boolean
      pagesCrawled?: number
      tracking?: {
        detectedTools: string[]
        maturityLevel: string
        trackingScore: number
      }
      appealAxis?: {
        heroText: string
        heroType: string
        valueProposition: string
        uspKeywords: string[]
        benefitStatements: string[]
        emotionalTriggers: string[]
        appealScore: number
      }
      socialProof?: {
        proofElements: string[]
        userCountText: string | null
        socialProofScore: number
      }
      ctaAnalysis?: {
        ctaTexts: string[]
        ctaCount: number
        ctaPlacement: string
        primaryCTA: string | null
        hasLeadMagnet: boolean
        hasLiveChat: boolean
        ctaEffectivenessScore: number
      }
      pricingSignals?: {
        pricingModel: string
        hasPricingPage: boolean
        hasFreeTrial: boolean
        priceIndicators: string[]
        pricingTransparencyScore: number
      }
      contentMarketing?: {
        contentTypes: string[]
        blogPostIndicators: number
        hasNewsletterSignup: boolean
        hasVideo: boolean
        contentDepthScore: number
        topicClusters: string[]
      }
      competitivePositioning?: {
        positioningType: string
        hasComparisonPage: boolean
        differentiationClaims: string[]
        mentionedCompetitors: string[]
        positioningScore: number
      }
    }>
    discoveredCompetitors?: Array<{
      url: string; name: string; reason: string; threatLevel: 'high' | 'medium' | 'low'
    }>
    growthForecast?: {
      current: number; month3: number; month6: number; month12: number
      bestCase12: number; worstCase12: number
    }
    riskTimeline?: Array<{
      risk: string; severity: 'critical' | 'warning' | 'watch'; deadline: string; description: string
    }>
    investmentPriorities?: Array<{
      area: string; currentScore: number; improvementPotential: number
      estimatedROI: string; difficulty: 'easy' | 'medium' | 'hard'; recommendation: string
    }>
    financialImpact?: {
      estimatedAnnualLoss: number
      estimatedAnnualGain: number
      competitorAvgScore: number
      industryGap: number
      lossBreakdown: { area: string; amount: number }[]
    }
  }
  competitiveDetailedComparison?: {
    trackingComparison: string
    appealAxisComparison: string
    socialProofComparison: string
    ctaComparison: string
    pricingComparison: string
    contentComparison: string
    overallWebPositioning: string
  }
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

// ===== テンプレートデータ =====
const FORM_TEMPLATES = [
  {
    name: 'ITスタートアップ',
    description: 'SaaS・アプリ開発企業',
    answers: {
      industry: 'IT/SaaS', revenueScale: '〜5,000万円', employeeCount: '6〜20人', companyAge: '3〜5年',
      channels: ['SEO/検索', 'Web広告', 'SNS運用'], leadCount: '月11〜50件', measurementMaturity: '定期測定', contentMarketing: '開始済み',
      closeRate: '21〜40%', salesProcess: 'CRM/SFA活用', leadTime: '2週間〜1ヶ月', salesAnalysis: 'BI活用',
      toolsUsed: ['CRM/SFA', 'ビジネスチャット', 'PJ管理ツール'], automationLevel: '主要業務を自動化', dataAccess: 'ダッシュボードあり',
    } as Record<string, string | string[]>,
    categories: ['marketing', 'sales', 'digital'],
  },
  {
    name: 'EC/通販事業',
    description: 'ECサイト・D2Cブランド',
    answers: {
      industry: 'EC/通販', revenueScale: '〜1億円', employeeCount: '6〜20人', companyAge: '5〜10年',
      channels: ['SEO/検索', 'Web広告', 'SNS運用', 'メール/DM'], leadCount: '月51〜100件', measurementMaturity: '分析→改善', contentMarketing: '定期発信中',
      repeatRate: '31〜50%', feedbackCollection: '定期収集', afterFollow: '定期連絡',
      growthTrend: '成長中', profitMargin: '業界並み', customerConcentration: '分散',
    } as Record<string, string | string[]>,
    categories: ['marketing', 'customer', 'finance'],
  },
  {
    name: '飲食/サービス業',
    description: '飲食店・サロン・店舗型',
    answers: {
      industry: '飲食/フード', revenueScale: '〜1,000万円', employeeCount: '2〜5人', companyAge: '3〜5年',
      repeatRate: '31〜50%', feedbackCollection: '不定期', afterFollow: '問合せ対応のみ',
      hiringDifficulty: 'やや困難', roleClarity: 'おおむね明確', training: 'OJTのみ', visionAlignment: '一部共有',
    } as Record<string, string | string[]>,
    categories: ['customer', 'organization'],
  },
]

// ===== ビジネス豆知識 =====
const BUSINESS_TIPS = [
  '中小企業の約60%が「人材不足」を最大の経営課題に挙げています',
  'マーケティングROIが最も高いチャネルは「メールマーケティング」（平均36倍）',
  'CRMを導入した企業の売上は平均29%向上するという調査結果があります',
  'リピーターの獲得コストは新規顧客の1/5。既存顧客の維持が重要です',
  'DXに成功した企業の生産性は平均40%向上しています',
  'SNSマーケティングの効果を実感する企業は3年で2倍に増加しました',
  '商談プロセスの「見える化」で成約率が平均15%改善するケースがあります',
  'データドリブン経営を実践する企業は意思決定スピードが5倍速いと言われています',
]

// ===== ローディングオーバーレイ（ライブフィード式）=====
function AnalysisLoadingOverlay({
  selectedCategories, answers, websiteUrl,
}: {
  selectedCategories: string[]
  answers: Record<string, string | string[]>
  websiteUrl: string
}) {
  const [feedIndex, setFeedIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)
  const feedRef = useRef<HTMLDivElement>(null)

  // 入力データに基づくライブフィードアイテム
  const feedItems = useMemo(() => {
    const items: { icon: React.ElementType; text: string; color: string; detail?: string }[] = []

    // Phase 1: 入力データ解析
    items.push({
      icon: Building2, text: `「${answers.industry || '不明'}」業界のデータベースを参照`,
      color: 'text-cyan-600',
      detail: `売上: ${answers.revenueScale || '-'} ／ 従業員: ${answers.employeeCount || '-'} ／ 創業: ${answers.companyAge || '-'}`,
    })

    // Phase 2: Webサイトクロール
    try {
      const hostname = new URL(websiteUrl).hostname
      items.push({
        icon: Globe, text: `${hostname} をクロール中`,
        color: 'text-blue-600', detail: 'HTML構造・メタタグ・内部リンクを解析',
      })
      items.push({
        icon: Search, text: 'SEO / OGP / 構造化データをスキャン',
        color: 'text-indigo-600', detail: 'title・description・sitemap・robots.txt',
      })
      items.push({
        icon: FileText, text: 'コンテンツ品質 & CTA導線を評価',
        color: 'text-purple-600', detail: 'テキスト量・見出し構造・問い合わせフォーム',
      })
    } catch {
      // URLが無効な場合はスキップ
    }

    // Phase 3: カテゴリ分析
    for (const catId of selectedCategories) {
      const cat = CATEGORIES.find((c) => c.id === catId)
      if (cat) {
        items.push({
          icon: cat.icon, text: `${cat.title}をスコアリング中`,
          color: 'text-teal-600', detail: cat.description,
        })
      }
    }

    // Phase 4: AI分析
    items.push({
      icon: Eye, text: '業界内の競合企業をAIが自動発見中',
      color: 'text-violet-600', detail: '市場シェア・サービス内容・脅威度を分析',
    })
    items.push({
      icon: Brain, text: 'Gemini AIが総合診断を実行中',
      color: 'text-purple-600', detail: 'ボトルネック特定・改善アクション策定',
    })
    items.push({
      icon: TrendingUp, text: '成長予測シミュレーション計算中',
      color: 'text-emerald-600', detail: '3ヶ月 / 6ヶ月 / 12ヶ月のシナリオ分析',
    })
    items.push({
      icon: Rocket, text: 'レポートを最終フォーマット中',
      color: 'text-amber-600', detail: 'ダッシュボード・PDF出力用データを構築',
    })

    return items
  }, [answers, websiteUrl, selectedCategories])

  // フィードを2.5秒ごとに1項目ずつ表示
  useEffect(() => {
    const interval = setInterval(() => {
      setFeedIndex((prev) => (prev < feedItems.length - 1 ? prev + 1 : prev))
    }, 2500)
    return () => clearInterval(interval)
  }, [feedItems.length])

  // 自動スクロール
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [feedIndex])

  // プログレスバー（30秒で92%まで）
  useEffect(() => {
    const start = Date.now()
    const duration = 30000
    const tick = () => {
      const elapsed = Date.now() - start
      const p = Math.min(92, (elapsed / duration) * 92)
      setProgress(p)
      if (p < 92) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  // ティップ切り替え
  useEffect(() => {
    setTipIndex(Math.floor(Math.random() * BUSINESS_TIPS.length))
    const interval = setInterval(() => setTipIndex((prev) => (prev + 1) % BUSINESS_TIPS.length), 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-full max-w-lg mx-4 bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-teal-500/10"
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 rounded-full border-2 border-dashed border-teal-500/40"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain className="w-6 h-6 text-teal-600" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900">AIが診断中</h3>
            <p className="text-[11px] text-gray-400">{feedIndex + 1} / {feedItems.length} ステップ完了</p>
          </div>
          <div className="ml-auto text-right">
            <span className="text-2xl font-black text-teal-600">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ライブ分析フィード */}
        <div ref={feedRef} className="space-y-1.5 mb-5 max-h-[260px] overflow-y-auto scrollbar-hide">
          {feedItems.slice(0, feedIndex + 1).map((item, i) => {
            const Icon = item.icon
            const isLatest = i === feedIndex
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: isLatest ? 1 : 0.6, x: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex items-start gap-2.5 px-3 py-2 rounded-xl transition-all ${
                  isLatest ? 'bg-gray-50 border border-gray-200' : ''
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isLatest ? (
                    <Loader2 className={`w-4 h-4 animate-spin ${item.color}`} />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-teal-500/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold leading-tight ${isLatest ? 'text-gray-900' : 'text-gray-400'}`}>
                    {item.text}
                  </p>
                  {isLatest && item.detail && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[11px] text-gray-400 mt-0.5 leading-relaxed"
                    >
                      {item.detail}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* ビジネス豆知識 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider mb-0.5">豆知識</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={tipIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-gray-500 leading-relaxed"
                >
                  {BUSINESS_TIPS[tipIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
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
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([''])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ShindanResult | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamPhase, setStreamPhase] = useState('')
  const [expandedCompetitor, setExpandedCompetitor] = useState<number | null>(null)
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
  // テンプレート適用
  const applyTemplate = useCallback((tpl: typeof FORM_TEMPLATES[number]) => {
    setAnswers(tpl.answers)
    setSelectedCategories(tpl.categories)
    setCurrentStep(0)
  }, [])

  // 参考入力（現在のステップに中間値を自動入力）
  const applyReference = useCallback(() => {
    if (currentStep === 0) {
      setAnswers((prev) => ({
        ...prev,
        industry: prev.industry || 'IT/SaaS',
        revenueScale: prev.revenueScale || '〜5,000万円',
        employeeCount: prev.employeeCount || '6〜20人',
        companyAge: prev.companyAge || '5〜10年',
      }))
      if (!websiteUrl) setWebsiteUrl('https://example.com')
      return
    }
    if (currentStep === 1) {
      if (selectedCategories.length === 0) setSelectedCategories(['marketing', 'sales', 'digital'])
      return
    }
    const catId = selectedCategories[currentStep - 2]
    const step = catId ? CATEGORY_QUESTIONS[catId] : null
    if (!step) return
    setAnswers((prev) => {
      const ref: Record<string, string | string[]> = { ...prev }
      for (const q of step.questions) {
        if (ref[q.id]) continue // 既に入力済みならスキップ
        if (q.type === 'multiselect') {
          ref[q.id] = q.options.filter((_, i) => i < 2 && q.options[i] !== NONE_OPTION)
        } else {
          ref[q.id] = q.options[Math.min(2, q.options.length - 1)]
        }
      }
      return ref
    })
  }, [currentStep, selectedCategories, websiteUrl])

  const canProceed = useMemo(() => {
    if (currentStep === 0) {
      const allAnswered = BASIC_STEP.questions.every((q) => !!answers[q.id])
      const hasUrl = websiteUrl.startsWith('http')
      return allAnswered && hasUrl
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
  }, [currentStep, answers, selectedCategories, questionStep, websiteUrl])

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

  // 送信 (SSE streaming)
  const handleSubmit = useCallback(async () => {
    setIsLoading(true)
    setIsStreaming(true)
    setStreamPhase('')
    setError('')
    setExpandedCompetitor(null)

    // 初期の空resultをセットしてダッシュボードを即表示
    setResult({
      overallScore: 0,
      overallGrade: '-',
      summary: '',
      axes: [],
      strengths: [],
      bottlenecks: [],
      recommendations: [],
      benchmark: [],
      analytics: {
        categoryScores: {},
        synergyPenalties: [],
        riskIndex: 0,
        dxMaturity: 0,
        growthPotential: 0,
        efficiencyScore: 0,
        websiteHealth: null,
        credibilityGap: 0,
        competitorComparison: [],
      },
    })

    try {
      const res = await fetch('/api/shindan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          selectedCategories,
          websiteUrl: websiteUrl || undefined,
          competitorUrls: competitorUrls.filter((u) => u && u.startsWith('http')),
        }),
      })

      // バリデーションエラー等 (non-stream response)
      if (!res.ok) {
        try {
          const data = await res.json()
          setError(data.error || '診断に失敗しました。もう一度お試しください。')
        } catch {
          setError('診断に失敗しました。もう一度お試しください。')
        }
        setResult(null)
        setIsStreaming(false)
        setIsLoading(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setError('ストリーミング接続に失敗しました。')
        setResult(null)
        setIsStreaming(false)
        setIsLoading(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const trimmed = part.trim()
          if (!trimmed) continue

          let eventName = ''
          let eventData = ''
          for (const line of trimmed.split('\n')) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              eventData = line.slice(5).trim()
            }
          }
          if (!eventName || !eventData) continue

          try {
            const parsed = JSON.parse(eventData)
            setStreamPhase(eventName)

            if (eventName === 'analyzing') {
              // Just a progress notification, no data to merge
              setStreamPhase('analyzing')
            } else if (eventName === 'scoring') {
              setResult((prev) => prev ? {
                ...prev,
                analytics: {
                  ...prev.analytics!,
                  categoryScores: parsed.categoryScores ?? prev.analytics!.categoryScores,
                  riskIndex: parsed.riskIndex ?? prev.analytics!.riskIndex,
                  dxMaturity: parsed.dxMaturity ?? prev.analytics!.dxMaturity,
                  growthPotential: parsed.growthPotential ?? prev.analytics!.growthPotential,
                  efficiencyScore: parsed.efficiencyScore ?? prev.analytics!.efficiencyScore,
                  synergyPenalties: parsed.synergyPenalties ?? prev.analytics!.synergyPenalties,
                },
              } : prev)
            } else if (eventName === 'website') {
              setResult((prev) => prev ? {
                ...prev,
                analytics: {
                  ...prev.analytics!,
                  websiteHealth: parsed.websiteHealth ?? null,
                },
              } : prev)
            } else if (eventName === 'discovery') {
              setResult((prev) => prev ? {
                ...prev,
                analytics: {
                  ...prev.analytics!,
                  discoveredCompetitors: parsed.discoveredCompetitors ?? [],
                },
              } : prev)
            } else if (eventName === 'competitors') {
              setResult((prev) => prev ? {
                ...prev,
                analytics: {
                  ...prev.analytics!,
                  competitorComparison: parsed.competitorComparison ?? [],
                },
              } : prev)
            } else if (eventName === 'scores') {
              setResult((prev) => prev ? {
                ...prev,
                overallScore: parsed.overallScore ?? prev.overallScore,
                overallGrade: parsed.overallGrade ?? prev.overallGrade,
                analytics: {
                  ...prev.analytics!,
                  growthForecast: parsed.growthForecast ?? prev.analytics!.growthForecast,
                  riskTimeline: parsed.riskTimeline ?? prev.analytics!.riskTimeline,
                  investmentPriorities: parsed.investmentPriorities ?? prev.analytics!.investmentPriorities,
                },
              } : prev)
            } else if (eventName === 'complete') {
              const r = (parsed.result ?? parsed) as ShindanResult
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
            } else if (eventName === 'error') {
              setError(parsed.error || '診断中にエラーが発生しました。')
              setResult(null)
            }
          } catch {
            // JSON parse error — skip this event
          }
        }
      }
    } catch {
      setError('通信エラーが発生しました。ネットワーク接続を確認してください。')
      setResult(null)
    } finally {
      setIsStreaming(false)
      setIsLoading(false)
      setStreamPhase('')
    }
  }, [answers, selectedCategories, websiteUrl, competitorUrls])

  // ===== 質問レンダリング =====
  const renderQuestion = (q: QuestionDef, idx: number) => {
    if (q.type === 'scale5') {
      return (
        <div key={q.id} className="space-y-2">
          <label className="block text-sm font-bold text-gray-600">
            <span className="text-teal-600 mr-1.5">Q{idx + 1}.</span>
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
                    : 'bg-white border-gray-300 text-gray-600 hover:border-teal-400'
                }`}
              >
                <span className="text-[10px] text-gray-400 mr-1">{i + 1}</span>
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
          <label className="block text-sm font-bold text-gray-600">
            <span className="text-teal-600 mr-1.5">Q{idx + 1}.</span>
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
                      ? 'bg-teal-50 border-teal-500 text-teal-600'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-teal-400'
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
        <label className="block text-sm font-bold text-gray-600">
          <span className="text-teal-600 mr-1.5">Q{idx + 1}.</span>
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
                  : 'bg-white border-gray-300 text-gray-600 hover:border-teal-400'
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 text-gray-900">
      {/* AI分析中ポップアップ */}
      <AnimatePresence>
        {isLoading && !isStreaming && <AnalysisLoadingOverlay selectedCategories={selectedCategories} answers={answers} websiteUrl={websiteUrl} />}
      </AnimatePresence>

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
          <p className="text-gray-500 text-sm sm:text-base">
            ビジネスの強み・ボトルネック・最適解をAIが診断
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!result && !isStreaming ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* テンプレート・参考入力 */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-500">テンプレートで入力</span>
                  <button
                    onClick={applyReference}
                    className="text-[11px] font-bold text-teal-600 hover:text-teal-500 flex items-center gap-1 transition-colors"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    参考値を入力
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {FORM_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      onClick={() => applyTemplate(tpl)}
                      className="p-3 rounded-xl bg-white border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left group"
                    >
                      <div className="text-sm font-black text-gray-900 group-hover:text-teal-600 transition-colors leading-tight">{tpl.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{tpl.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* プログレス */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-400">
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
                          : 'bg-gray-200 w-8'
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
                  className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-6"
                >
                  {/* ステップヘッダー */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                      <StepIcon className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black">
                        {stepType === 'basic' && '基本情報'}
                        {stepType === 'category-selection' && '確かめたい項目'}
                        {stepType === 'questions' && questionStep?.title}
                      </h2>
                      <p className="text-xs text-gray-400">
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
                      <div className="space-y-2 pt-2 border-t border-gray-200">
                        <label className="block text-sm font-bold text-gray-600">
                          <Globe className="w-4 h-4 inline mr-1" />
                          WebサイトURL
                          <span className="ml-1.5 text-[10px] font-black text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">必須</span>
                        </label>
                        <input
                          type="url"
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://example.com"
                          className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        />
                        <p className="text-[11px] text-gray-400">SEO・コンテンツ・技術面を自動クロールし、競合比較も行います</p>
                      </div>

                      {/* 競合URL */}
                      <div className="space-y-2 pt-2 border-t border-gray-200">
                        <label className="block text-sm font-bold text-gray-500">
                          <Target className="w-4 h-4 inline mr-1" />
                          競合サイトURL（任意・最大3社）
                        </label>
                        {competitorUrls.map((cu, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="url"
                              value={cu}
                              onChange={(e) => {
                                const newUrls = [...competitorUrls]
                                newUrls[idx] = e.target.value
                                setCompetitorUrls(newUrls)
                              }}
                              placeholder={`競合${idx + 1}のURL`}
                              className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            />
                            {competitorUrls.length > 1 && (
                              <button
                                onClick={() => setCompetitorUrls(competitorUrls.filter((_, i) => i !== idx))}
                                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {competitorUrls.length < 3 && (
                          <button
                            onClick={() => setCompetitorUrls([...competitorUrls, ''])}
                            className="flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:text-teal-500"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            競合を追加
                          </button>
                        )}
                        <p className="text-[11px] text-gray-500">入力すると競合サイトもクロールし、比較分析を行います</p>
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
                                ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500/30'
                                : 'bg-white border-gray-200 hover:border-teal-400'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? 'bg-teal-500' : 'bg-gray-200'
                            }`}>
                              <CatIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-sm text-gray-900">{cat.title}</div>
                              <div className="text-[11px] text-gray-500 leading-relaxed">{cat.description}</div>
                            </div>
                            {isSelected && <Check className="w-5 h-5 text-teal-600 flex-shrink-0" />}
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
                  className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl"
                >
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-500">{error}</p>
                </motion.div>
              )}

              {/* ナビゲーション */}
              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={goBack}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
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
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
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
              {!isStreaming && (
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => { setResult(null); setCurrentStep(0) }}
                    className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    ← 新しい診断を行う
                  </button>
                  <PdfExportButton targetRef={dashboardRef} fileName={`doya-shindan-${answers.industry || 'report'}`} />
                </div>
              )}

              <div ref={dashboardRef} className="space-y-6">
                {/* ストリーミング進捗インジケーター */}
                {isStreaming && (
                  <div className="mb-6 bg-white border border-teal-200 shadow-sm rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                      <div>
                        <p className="text-sm font-black text-teal-600">
                          {streamPhase === 'analyzing' && '調査を開始しました...'}
                          {streamPhase === 'website' && 'Webサイトを詳細分析中...'}
                          {streamPhase === 'discovery' && '競合企業をAIが探索中...'}
                          {streamPhase === 'competitors' && '競合サイトをクロール中...'}
                          {streamPhase === 'scoring' && '調査結果を反映してスコアリング中...'}
                          {streamPhase === 'scores' && '最終スコアを算出中...'}
                          {streamPhase === 'complete' && 'AIが総合診断中...'}
                          {!streamPhase && '分析を開始中...'}
                        </p>
                        <p className="text-[11px] text-gray-400">リアルタイムで結果が表示されます</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400"
                        animate={{ width: streamPhase === 'analyzing' ? '5%' : streamPhase === 'website' ? '25%' : streamPhase === 'discovery' ? '40%' : streamPhase === 'competitors' ? '55%' : streamPhase === 'scoring' ? '70%' : streamPhase === 'scores' ? '80%' : streamPhase === 'complete' ? '95%' : '3%' }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                )}

                {/* ===== サイトビジュアル比較（ダッシュボード先頭） ===== */}
                {(result?.analytics?.websiteHealth?.ogImage || (result?.analytics?.competitorComparison && result.analytics.competitorComparison.some((c) => c.ogImage))) && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-600" />
                      サイトビジュアル比較
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 自社サイト */}
                      {result?.analytics?.websiteHealth?.ogImage && (
                        <div>
                          <p className="text-xs font-bold text-teal-600 mb-2 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-teal-400" />
                            自社サイト
                          </p>
                          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="block group">
                            <div className="relative rounded-xl overflow-hidden border border-gray-200 group-hover:border-teal-400 transition-colors">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={result.analytics.websiteHealth.ogImage}
                                alt="自社サイト OGP"
                                className="w-full h-40 object-cover bg-gray-100"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/70 to-transparent p-3">
                                <p className="text-[11px] text-white font-bold truncate flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  {(() => { try { return new URL(websiteUrl).hostname } catch { return websiteUrl } })()}
                                </p>
                              </div>
                            </div>
                          </a>
                        </div>
                      )}
                      {/* 競合サイト */}
                      {result?.analytics?.competitorComparison?.filter((c) => c.ogImage).map((comp, i) => (
                        <div key={i}>
                          <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            競合 {i + 1}
                          </p>
                          <a href={comp.url} target="_blank" rel="noopener noreferrer" className="block group">
                            <div className="relative rounded-xl overflow-hidden border border-gray-200 group-hover:border-purple-400 transition-colors">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={comp.ogImage!}
                                alt={`競合 ${i + 1} OGP`}
                                className="w-full h-40 object-cover bg-gray-100"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/70 to-transparent p-3">
                                <p className="text-[11px] text-white font-bold truncate flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  {(() => { try { return new URL(comp.url).hostname.replace('www.', '') } catch { return comp.url } })()}
                                </p>
                              </div>
                            </div>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <ScoreCard
                  score={result?.overallScore ?? 0}
                  grade={result?.overallGrade ?? '-'}
                  summary={result?.summary ?? ''}
                />

                {/* ===== 財務インパクトサマリー ===== */}
                {result.analytics?.financialImpact && result.analytics.financialImpact.estimatedAnnualLoss > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-2xl p-5 text-center">
                      <div className="text-[11px] font-bold text-red-600 mb-1 flex items-center justify-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        推定年間機会損失
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-red-600">
                        ¥{result.analytics.financialImpact.estimatedAnnualLoss.toLocaleString()}<span className="text-base ml-1">万円</span>
                      </div>
                      <div className="text-[10px] text-red-600/60 mt-1">
                        このまま改善しない場合の推定損失額
                      </div>
                      {result.analytics.financialImpact.lossBreakdown.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {result.analytics.financialImpact.lossBreakdown.slice(0, 4).map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] bg-red-50/50 rounded-lg px-3 py-1.5">
                              <span className="text-gray-500">{item.area}</span>
                              <span className="font-black text-red-500">-¥{item.amount.toLocaleString()}万</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-5 text-center">
                      <div className="text-[11px] font-bold text-emerald-600 mb-1 flex items-center justify-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        改善後の期待年間収益増
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-emerald-600">
                        +¥{result.analytics.financialImpact.estimatedAnnualGain.toLocaleString()}<span className="text-base ml-1">万円</span>
                      </div>
                      <div className="text-[10px] text-emerald-600/60 mt-1">
                        提案アクション実行時の期待効果
                      </div>
                      {result.analytics.financialImpact.industryGap !== 0 && (
                        <div className={`mt-3 text-sm font-black ${result.analytics.financialImpact.industryGap >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          業界平均比: {result.analytics.financialImpact.industryGap >= 0 ? '+' : ''}{result.analytics.financialImpact.industryGap}pt
                        </div>
                      )}
                      {result.analytics.financialImpact.competitorAvgScore > 0 && result.analytics?.websiteHealth && (
                        <div className={`text-[11px] font-bold mt-1 ${
                          result.analytics.websiteHealth.totalScore >= result.analytics.financialImpact.competitorAvgScore ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          自社サイト {result.analytics.websiteHealth.totalScore}pt vs 競合平均 {result.analytics.financialImpact.competitorAvgScore}pt
                          ({result.analytics.websiteHealth.totalScore >= result.analytics.financialImpact.competitorAvgScore ? '+' : ''}
                          {result.analytics.websiteHealth.totalScore - result.analytics.financialImpact.competitorAvgScore}pt)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== エグゼクティブサマリー ===== */}
                {result.executiveSummary && (
                  <div className="bg-white border border-teal-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-teal-600" />
                      エグゼクティブサマリー
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{result.executiveSummary}</p>
                  </div>
                )}

                {/* ===== 今すぐやること ===== */}
                {result.immediateActions && result.immediateActions.length > 0 && (
                  <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-3 flex items-center gap-2">
                      <Flame className="w-5 h-5 text-amber-600" />
                      今すぐやるべきこと
                    </h3>
                    <div className="space-y-2">
                      {result.immediateActions.map((action, i) => (
                        <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                            {i + 1}
                          </span>
                          <p className="text-sm text-gray-600 leading-relaxed">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ===== 算出分析指標 ===== */}
                {result.analytics && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'リスク指数', value: result.analytics.riskIndex, icon: ShieldAlert,
                        color: result.analytics.riskIndex > 50 ? 'text-red-600' : result.analytics.riskIndex > 30 ? 'text-orange-600' : 'text-emerald-600',
                        bg: result.analytics.riskIndex > 50 ? 'bg-red-50 border-red-200' : result.analytics.riskIndex > 30 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200',
                        suffix: result.analytics.riskIndex > 50 ? '危険' : result.analytics.riskIndex > 30 ? '要注意' : '良好' },
                      { label: 'DX成熟度', value: result.analytics.dxMaturity >= 0 ? result.analytics.dxMaturity : null, icon: Cpu,
                        color: (result.analytics.dxMaturity ?? 0) < 30 ? 'text-red-600' : (result.analytics.dxMaturity ?? 0) < 50 ? 'text-amber-600' : 'text-teal-600',
                        bg: (result.analytics.dxMaturity ?? 0) < 30 ? 'bg-red-50 border-red-200' : (result.analytics.dxMaturity ?? 0) < 50 ? 'bg-amber-50 border-amber-200' : 'bg-teal-50 border-teal-200',
                        suffix: (result.analytics.dxMaturity ?? 0) < 30 ? '後進' : (result.analytics.dxMaturity ?? 0) < 50 ? '発展途上' : '進行中' },
                      { label: '成長ポテンシャル', value: result.analytics.growthPotential, icon: Rocket,
                        color: result.analytics.growthPotential < 35 ? 'text-red-600' : result.analytics.growthPotential < 55 ? 'text-amber-600' : 'text-teal-600',
                        bg: result.analytics.growthPotential < 35 ? 'bg-red-50 border-red-200' : result.analytics.growthPotential < 55 ? 'bg-amber-50 border-amber-200' : 'bg-teal-50 border-teal-200',
                        suffix: '' },
                      { label: '収益効率', value: result.analytics.efficiencyScore, icon: DollarSign,
                        color: result.analytics.efficiencyScore < 40 ? 'text-red-600' : result.analytics.efficiencyScore < 60 ? 'text-amber-600' : 'text-teal-600',
                        bg: result.analytics.efficiencyScore < 40 ? 'bg-red-50 border-red-200' : result.analytics.efficiencyScore < 60 ? 'bg-amber-50 border-amber-200' : 'bg-teal-50 border-teal-200',
                        suffix: '' },
                    ].map((m) => {
                      const MIcon = m.icon
                      return m.value !== null ? (
                        <div key={m.label} className={`rounded-xl border p-4 ${m.bg}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <MIcon className={`w-4 h-4 ${m.color}`} />
                            <span className="text-[11px] font-bold text-gray-500">{m.label}</span>
                          </div>
                          <div className="flex items-end gap-1">
                            <span className={`text-2xl font-black ${m.color}`}>{m.value}</span>
                            <span className="text-xs text-gray-400 mb-1">/100</span>
                          </div>
                          {m.suffix && <span className={`text-[10px] font-bold ${m.color}`}>{m.suffix}</span>}
                        </div>
                      ) : null
                    })}
                  </div>
                )}

                {/* ===== シナジーペナルティ ===== */}
                {result.analytics?.synergyPenalties && result.analytics.synergyPenalties.length > 0 && (
                  <div className="bg-red-50/50 border border-red-200 rounded-2xl p-5">
                    <h3 className="text-base font-black mb-3 flex items-center gap-2 text-red-600">
                      <AlertCircle className="w-5 h-5" />
                      構造的リスク（クロスカテゴリ分析）
                    </h3>
                    <div className="space-y-3">
                      {result.analytics.synergyPenalties.map((p, i) => (
                        <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                          <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg flex-shrink-0">
                            {p.penalty}pt
                          </span>
                          <div>
                            <p className="text-sm font-black text-red-500">{p.name}</p>
                            <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ===== 成長予測 ===== */}
                {result.analytics?.growthForecast && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-cyan-600" />
                      成長予測シミュレーション
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: '現在', value: result.analytics.growthForecast.current, months: '' },
                        { label: '3ヶ月後', value: result.analytics.growthForecast.month3, months: '3M' },
                        { label: '6ヶ月後', value: result.analytics.growthForecast.month6, months: '6M' },
                        { label: '12ヶ月後', value: result.analytics.growthForecast.month12, months: '12M' },
                      ].map((item, i) => {
                        const diff = item.value - result.analytics!.growthForecast!.current
                        const isUp = diff > 0
                        return (
                          <div key={item.label} className="text-center bg-gray-50 rounded-xl p-3">
                            <div className="text-[10px] text-gray-400 font-bold mb-1">{item.label}</div>
                            <div className="text-2xl font-black text-cyan-600">{item.value}</div>
                            {i > 0 && (
                              <div className={`text-[11px] font-bold flex items-center justify-center gap-0.5 ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {isUp ? '+' : ''}{diff}pt
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* プログレスバー風のフォーキャスト */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
                        <span>12ヶ月後のシナリオ</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-emerald-600 w-16">ベスト</span>
                          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${result.analytics.growthForecast.bestCase12}%` }} />
                          </div>
                          <span className="text-sm font-black text-emerald-600 w-10 text-right">{result.analytics.growthForecast.bestCase12}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-cyan-600 w-16">予測値</span>
                          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400" style={{ width: `${result.analytics.growthForecast.month12}%` }} />
                          </div>
                          <span className="text-sm font-black text-cyan-600 w-10 text-right">{result.analytics.growthForecast.month12}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-red-600 w-16">ワースト</span>
                          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400" style={{ width: `${result.analytics.growthForecast.worstCase12}%` }} />
                          </div>
                          <span className="text-sm font-black text-red-600 w-10 text-right">{result.analytics.growthForecast.worstCase12}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== リスクタイムライン ===== */}
                {result.analytics?.riskTimeline && result.analytics.riskTimeline.length > 0 && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-red-600" />
                      リスクタイムライン
                    </h3>
                    <div className="space-y-3">
                      {result.analytics.riskTimeline.map((item, i) => {
                        const severityStyle = {
                          critical: { bg: 'bg-red-50 border-red-200', text: 'text-red-600', badge: 'bg-red-500', label: '緊急' },
                          warning: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-600', badge: 'bg-orange-500', label: '警告' },
                          watch: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-500', label: '注視' },
                        }[item.severity] || { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-500', badge: 'bg-gray-500', label: '注視' }
                        return (
                          <div key={i} className={`${severityStyle.bg} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black text-white ${severityStyle.badge}`}>
                                {severityStyle.label}
                              </span>
                              <span className={`text-[11px] font-bold ${severityStyle.text}`}>
                                期限: {item.deadline}
                              </span>
                            </div>
                            <h4 className="font-black text-gray-900 text-sm mb-1">{item.risk}</h4>
                            <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ===== 投資優先度マトリクス ===== */}
                {result.analytics?.investmentPriorities && result.analytics.investmentPriorities.length > 0 && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      投資優先度マトリクス
                    </h3>
                    <div className="space-y-3">
                      {result.analytics.investmentPriorities.map((item, i) => {
                        const difficultyStyle = {
                          easy: { text: 'text-emerald-600', label: '容易' },
                          medium: { text: 'text-amber-600', label: '普通' },
                          hard: { text: 'text-red-600', label: '高難度' },
                        }[item.difficulty] || { text: 'text-gray-500', label: '普通' }
                        return (
                          <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-black text-gray-900 text-sm">{item.area}</h4>
                              <span className={`text-[10px] font-bold ${difficultyStyle.text}`}>
                                難易度: {difficultyStyle.label}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <div className="text-center">
                                <div className="text-[10px] text-gray-400 mb-0.5">現在スコア</div>
                                <div className="text-lg font-black text-gray-600">{item.currentScore}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-[10px] text-gray-400 mb-0.5">改善余地</div>
                                <div className="text-lg font-black text-teal-600">+{item.improvementPotential}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-[10px] text-gray-400 mb-0.5">推定ROI</div>
                                <div className="text-lg font-black text-emerald-600">{item.estimatedROI}</div>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">{item.recommendation}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-teal-600" />
                      {result.axes.length}軸評価
                    </h3>
                    <ShindanRadarChart axes={result.axes} />
                    {/* 軸別スコア＋業界比較 */}
                    {result.axes.length > 0 && result.benchmark.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {result.axes.map((axis, i) => {
                          const bm = result.benchmark.find((b) => b.category === axis.label)
                          const diff = bm ? axis.score - bm.industryAverage : 0
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-gray-500 w-20 truncate">{axis.label}</span>
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${axis.score >= 60 ? 'bg-teal-500' : axis.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${axis.score}%` }} />
                              </div>
                              <span className="text-sm font-black text-gray-900 w-8 text-right">{axis.score}</span>
                              {bm && (
                                <span className={`text-[10px] font-black w-14 text-right ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {diff >= 0 ? '+' : ''}{diff}pt
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      強み
                    </h3>
                    <div className="space-y-4">
                      {result.strengths.map((s, i) => (
                        <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-black text-white">{i + 1}</span>
                            <h4 className="font-black text-emerald-500">{s.title}</h4>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">{s.description}</p>
                          {s.leverageAdvice && (
                            <div className="mt-2 pt-2 border-t border-emerald-200">
                              <p className="text-xs text-emerald-600">
                                <span className="font-bold">活用戦略:</span> {s.leverageAdvice}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ===== Webサイト診断 ===== */}
                {result.analytics?.websiteHealth && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-blue-600" />
                      Webサイト診断
                    </h3>

                    {/* URL表示 */}
                    {(result.analytics.websiteHealth.url || websiteUrl) && (
                      <a
                        href={result.analytics.websiteHealth.url || websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-500 mb-4 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {(() => { try { return new URL(result.analytics.websiteHealth.url || websiteUrl).hostname } catch { return result.analytics.websiteHealth.url || websiteUrl } })()}
                      </a>
                    )}

                    {/* Meta情報 */}
                    {result.analytics.websiteHealth.meta && (
                      <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5">
                        {result.analytics.websiteHealth.meta.title && (
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Title</span>
                            <p className="text-sm text-gray-900 font-bold leading-tight">{result.analytics.websiteHealth.meta.title}</p>
                          </div>
                        )}
                        {result.analytics.websiteHealth.meta.description && (
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Description</span>
                            <p className="text-xs text-gray-500 leading-relaxed">{result.analytics.websiteHealth.meta.description}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {[
                        { label: 'SEO', score: result.analytics.websiteHealth.seoScore },
                        { label: 'コンテンツ', score: result.analytics.websiteHealth.contentScore },
                        { label: '技術', score: result.analytics.websiteHealth.technicalScore },
                        { label: '総合', score: result.analytics.websiteHealth.totalScore },
                      ].map((item) => (
                        <div key={item.label} className="text-center">
                          <div className={`text-2xl font-black mb-1 ${
                            item.score >= 60 ? 'text-teal-600' : item.score >= 40 ? 'text-amber-600' : 'text-red-600'
                          }`}>{item.score}</div>
                          <div className="text-[10px] text-gray-400 font-bold">{item.label}</div>
                          <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${
                              item.score >= 60 ? 'bg-teal-500' : item.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                            }`} style={{ width: `${item.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 統計バッジ */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {result.analytics.websiteHealth.textLength != null && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          テキスト {(result.analytics.websiteHealth.textLength / 1000).toFixed(1)}K文字
                        </span>
                      )}
                      {result.analytics.websiteHealth.imageStats && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                          <Image className="w-3 h-3" />
                          画像 {result.analytics.websiteHealth.imageStats.total}枚 (alt付: {result.analytics.websiteHealth.imageStats.withAlt})
                        </span>
                      )}
                      {result.analytics.websiteHealth.hasSchema != null && (
                        <span className={`text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1 ${
                          result.analytics.websiteHealth.hasSchema
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-red-50 text-red-600 border border-red-200'
                        }`}>
                          <Code2 className="w-3 h-3" />
                          構造化データ {result.analytics.websiteHealth.hasSchema ? 'あり' : 'なし'}
                        </span>
                      )}
                      {result.analytics.websiteHealth.pagesCrawled > 0 && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-bold">
                          {result.analytics.websiteHealth.pagesCrawled}ページ解析
                        </span>
                      )}
                    </div>

                    {/* 見出し一覧 */}
                    {result.analytics.websiteHealth.headings && result.analytics.websiteHealth.headings.length > 0 && (
                      <div className="mb-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block">主要見出し（TOP 10）</span>
                        <div className="flex flex-wrap gap-1.5">
                          {result.analytics.websiteHealth.headings.slice(0, 10).map((h, hi) => (
                            <span key={hi} className="text-[11px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded">{h}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 広告・トラッキングツール */}
                    {result.analytics.websiteHealth?.tracking && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold text-gray-400 mb-1">広告・トラッキング</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.analytics.websiteHealth.tracking.detectedTools.length > 0
                            ? result.analytics.websiteHealth.tracking.detectedTools.map((tool: string, i: number) => (
                                <span key={i} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-bold">{tool}</span>
                              ))
                            : <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-bold">未設定</span>
                          }
                        </div>
                      </div>
                    )}

                    {/* 社会的証明 */}
                    {result.analytics.websiteHealth?.socialProof && result.analytics.websiteHealth.socialProof.proofElements.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold text-gray-400 mb-1">社会的証明</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.analytics.websiteHealth.socialProof.proofElements.map((el: string, i: number) => (
                            <span key={i} className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold">{el}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CTA */}
                    {result.analytics.websiteHealth?.ctaAnalysis && result.analytics.websiteHealth.ctaAnalysis.ctaTexts.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold text-gray-400 mb-1">CTA（コールトゥアクション）</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.analytics.websiteHealth.ctaAnalysis.ctaTexts.slice(0, 6).map((cta: string, i: number) => (
                            <span key={i} className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">{cta}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 訴求軸 */}
                    {result.analytics.websiteHealth?.appealAxis && result.analytics.websiteHealth.appealAxis.heroText && (
                      <div className="mt-3 mb-4">
                        <p className="text-[10px] font-bold text-gray-400 mb-1">訴求軸</p>
                        <p className="text-xs text-gray-600 italic mb-1">&quot;{result.analytics.websiteHealth.appealAxis.heroText.slice(0, 100)}&quot;</p>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full font-bold">
                            {result.analytics.websiteHealth.appealAxis.heroType === 'benefit' ? 'ベネフィット訴求' 
                              : result.analytics.websiteHealth.appealAxis.heroType === 'feature' ? 'フィーチャー訴求'
                              : result.analytics.websiteHealth.appealAxis.heroType === 'emotional' ? '感情訴求'
                              : result.analytics.websiteHealth.appealAxis.heroType === 'social-proof' ? '実績訴求'
                              : '訴求不明確'}
                          </span>
                          {result.analytics.websiteHealth.appealAxis.uspKeywords.slice(0, 3).map((kw: string, i: number) => (
                            <span key={i} className="text-[10px] bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full font-bold">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {result.analytics.websiteHealth.issues.slice(0, 6).map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-500">{issue}</span>
                        </div>
                      ))}
                      {result.analytics.websiteHealth.positives?.slice(0, 4).map((pos, i) => (
                        <div key={`p-${i}`} className="flex items-start gap-2 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-500">{pos}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                                {/* ===== 詳細競合分析マトリクス ===== */}
                {result?.analytics?.websiteHealth?.tracking && (
                  <CompetitiveMatrix
                    websiteHealth={result.analytics.websiteHealth}
                    competitors={result.analytics.competitorComparison || []}
                    detailedComparison={result.competitiveDetailedComparison}
                  />
                )}

{/* ===== 競合比較 ===== */}
                {result.analytics?.competitorComparison && result.analytics.competitorComparison.length > 0 && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      競合サイト比較
                      <span className="text-[10px] font-bold text-gray-400 ml-auto">クリックで詳細表示</span>
                    </h3>
                    {/* 競合平均 vs 自社サマリー */}
                    {result.analytics?.websiteHealth && (
                      <div className="flex flex-wrap items-center gap-4 mb-4 bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-teal-600">自社</span>
                          <span className="text-lg font-black text-teal-600">{result.analytics.websiteHealth.totalScore}<span className="text-xs text-gray-400">pt</span></span>
                        </div>
                        <span className="text-gray-500">vs</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-purple-600">競合平均</span>
                          <span className="text-lg font-black text-purple-600">
                            {Math.round(result.analytics.competitorComparison.reduce((s, c) => s + c.totalScore, 0) / result.analytics.competitorComparison.length)}<span className="text-xs text-gray-400">pt</span>
                          </span>
                        </div>
                        {(() => {
                          const avg = Math.round(result.analytics!.competitorComparison.reduce((s, c) => s + c.totalScore, 0) / result.analytics!.competitorComparison.length)
                          const diff = result.analytics!.websiteHealth!.totalScore - avg
                          return (
                            <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                              {diff >= 0 ? '+' : ''}{diff}pt
                            </span>
                          )
                        })()}
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 text-xs border-b border-gray-200">
                            <th className="text-left py-2 font-bold">サイト</th>
                            <th className="text-center py-2 font-bold">SEO</th>
                            <th className="text-center py-2 font-bold">コンテンツ</th>
                            <th className="text-center py-2 font-bold">技術</th>
                            <th className="text-center py-2 font-bold">総合</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {result.analytics.websiteHealth && (
                            <tr className="border-b border-gray-200">
                              <td className="py-2.5 font-bold text-teal-600 text-xs">自社</td>
                              <td className="text-center font-black text-teal-600">{result.analytics.websiteHealth.seoScore}</td>
                              <td className="text-center font-black text-teal-600">{result.analytics.websiteHealth.contentScore}</td>
                              <td className="text-center font-black text-teal-600">{result.analytics.websiteHealth.technicalScore}</td>
                              <td className="text-center font-black text-teal-600">{result.analytics.websiteHealth.totalScore}</td>
                              <td />
                            </tr>
                          )}
                          {result.analytics.competitorComparison.map((comp, i) => (
                            <React.Fragment key={i}>
                              <tr
                                className="border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => setExpandedCompetitor(expandedCompetitor === i ? null : i)}
                              >
                                <td className="py-2.5 text-xs text-gray-500 max-w-[120px] truncate">
                                  <span className="flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    {(() => { try { return new URL(comp.url).hostname.replace('www.', '') } catch { return comp.url } })()}
                                  </span>
                                </td>
                                {[comp.seoScore, comp.contentScore, comp.technicalScore, comp.totalScore].map((s, j) => {
                                  const myScore = result.analytics?.websiteHealth ? [
                                    result.analytics.websiteHealth.seoScore,
                                    result.analytics.websiteHealth.contentScore,
                                    result.analytics.websiteHealth.technicalScore,
                                    result.analytics.websiteHealth.totalScore,
                                  ][j] : 0
                                  return (
                                    <td key={j} className={`text-center font-black ${s > myScore ? 'text-red-600' : 'text-gray-600'}`}>
                                      {s}
                                      {s > myScore && <span className="text-[9px] ml-0.5">↑</span>}
                                    </td>
                                  )
                                })}
                                <td className="text-center">
                                  <motion.div animate={{ rotate: expandedCompetitor === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  </motion.div>
                                </td>
                              </tr>
                              {/* 展開可能な詳細パネル */}
                              <tr>
                                <td colSpan={6} className="p-0">
                                  <AnimatePresence>
                                    {expandedCompetitor === i && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 my-2 space-y-4">
                                          {/* OGP画像 */}
                                          {comp.ogImage && (
                                            <div>
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img
                                                src={comp.ogImage}
                                                alt={`${(() => { try { return new URL(comp.url).hostname } catch { return comp.url } })()} OGP`}
                                                className="w-full max-h-48 object-cover rounded-lg bg-gray-50"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                              />
                                            </div>
                                          )}

                                          {/* Meta情報 */}
                                          {comp.meta && (
                                            <div className="space-y-1.5">
                                              {comp.meta.title && (
                                                <div>
                                                  <span className="text-[10px] font-bold text-gray-400 uppercase">Title</span>
                                                  <p className="text-sm text-gray-900 font-bold leading-tight">{comp.meta.title}</p>
                                                </div>
                                              )}
                                              {comp.meta.description && (
                                                <div>
                                                  <span className="text-[10px] font-bold text-gray-400 uppercase">Description</span>
                                                  <p className="text-xs text-gray-500 leading-relaxed">{comp.meta.description}</p>
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {/* 見出し一覧 */}
                                          {comp.headings && comp.headings.length > 0 && (
                                            <div>
                                              <span className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">主要見出し</span>
                                              <div className="flex flex-wrap gap-1.5">
                                                {comp.headings.slice(0, 8).map((h, hi) => (
                                                  <span key={hi} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{h}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* スコア詳細バー */}
                                          <div className="space-y-2">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">スコア詳細</span>
                                            {[
                                              { label: 'SEO', score: comp.seoScore, color: 'from-blue-500 to-cyan-400' },
                                              { label: 'コンテンツ', score: comp.contentScore, color: 'from-purple-500 to-pink-400' },
                                              { label: '技術', score: comp.technicalScore, color: 'from-emerald-500 to-teal-400' },
                                            ].map((bar) => (
                                              <div key={bar.label} className="flex items-center gap-3">
                                                <span className="text-[11px] font-bold text-gray-500 w-20">{bar.label}</span>
                                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                  <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${bar.score}%` }}
                                                    transition={{ duration: 0.5, delay: 0.1 }}
                                                    className={`h-full rounded-full bg-gradient-to-r ${bar.color}`}
                                                  />
                                                </div>
                                                <span className="text-sm font-black text-gray-600 w-8 text-right">{bar.score}</span>
                                              </div>
                                            ))}
                                          </div>

                                          {/* 問題点・評価点 */}
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {comp.issues && comp.issues.length > 0 && (
                                              <div>
                                                <span className="text-[10px] font-bold text-red-600 uppercase mb-1 block">課題</span>
                                                <div className="space-y-1">
                                                  {comp.issues.slice(0, 4).map((issue, ii) => (
                                                    <div key={ii} className="flex items-start gap-1.5 text-[11px]">
                                                      <AlertCircle className="w-3 h-3 text-red-600 flex-shrink-0 mt-0.5" />
                                                      <span className="text-gray-500">{issue}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {comp.positives && comp.positives.length > 0 && (
                                              <div>
                                                <span className="text-[10px] font-bold text-emerald-600 uppercase mb-1 block">評価点</span>
                                                <div className="space-y-1">
                                                  {comp.positives.slice(0, 4).map((pos, pi) => (
                                                    <div key={pi} className="flex items-start gap-1.5 text-[11px]">
                                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />
                                                      <span className="text-gray-500">{pos}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>

                                          {/* その他のステータス */}
                                          <div className="flex flex-wrap gap-2">
                                            {comp.socialLinks && comp.socialLinks.length > 0 && (
                                              <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded-lg font-bold">
                                                SNS {comp.socialLinks.length}件
                                              </span>
                                            )}
                                            {comp.hasBlog && (
                                              <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 rounded-lg font-bold">
                                                ブログあり
                                              </span>
                                            )}
                                            {comp.hasForm && (
                                              <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-2 py-1 rounded-lg font-bold">
                                                CTA/フォームあり
                                              </span>
                                            )}
                                            {comp.hasSchema && (
                                              <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-lg font-bold">
                                                構造化データあり
                                              </span>
                                            )}
                                            {comp.pagesCrawled != null && (
                                              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-bold">
                                                {comp.pagesCrawled}ページ
                                              </span>
                                            )}
                                            {comp.textLength != null && (
                                              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-bold">
                                                テキスト {(comp.textLength / 1000).toFixed(1)}K文字
                                              </span>
                                            )}
                                            {comp.imageStats && (
                                              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-bold">
                                                画像 {comp.imageStats.total}枚 (alt: {comp.imageStats.withAlt})
                                              </span>
                                            )}
                                          </div>

                                          {/* 広告・トラッキングツール */}
                                          {comp.tracking && (
                                            <div className="mt-1">
                                              <p className="text-[10px] font-bold text-gray-400 mb-1">広告・トラッキング</p>
                                              <div className="flex flex-wrap gap-1.5">
                                                {comp.tracking.detectedTools.length > 0
                                                  ? comp.tracking.detectedTools.map((tool: string, ti: number) => (
                                                      <span key={ti} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-bold">{tool}</span>
                                                    ))
                                                  : <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-bold">未設定</span>
                                                }
                                              </div>
                                            </div>
                                          )}

                                          {/* 社会的証明 */}
                                          {comp.socialProof && comp.socialProof.proofElements.length > 0 && (
                                            <div className="mt-1">
                                              <p className="text-[10px] font-bold text-gray-400 mb-1">社会的証明</p>
                                              <div className="flex flex-wrap gap-1.5">
                                                {comp.socialProof.proofElements.map((el: string, si: number) => (
                                                  <span key={si} className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold">{el}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* CTA */}
                                          {comp.ctaAnalysis && comp.ctaAnalysis.ctaTexts.length > 0 && (
                                            <div className="mt-1">
                                              <p className="text-[10px] font-bold text-gray-400 mb-1">CTA（コールトゥアクション）</p>
                                              <div className="flex flex-wrap gap-1.5">
                                                {comp.ctaAnalysis.ctaTexts.slice(0, 6).map((cta: string, ci: number) => (
                                                  <span key={ci} className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">{cta}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* 訴求軸 */}
                                          {comp.appealAxis && comp.appealAxis.heroText && (
                                            <div className="mt-1">
                                              <p className="text-[10px] font-bold text-gray-400 mb-1">訴求軸</p>
                                              <p className="text-xs text-gray-600 italic mb-1">&quot;{comp.appealAxis.heroText.slice(0, 100)}&quot;</p>
                                              <div className="flex flex-wrap gap-1.5">
                                                <span className="text-[10px] bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full font-bold">
                                                  {comp.appealAxis.heroType === 'benefit' ? 'ベネフィット訴求'
                                                    : comp.appealAxis.heroType === 'feature' ? 'フィーチャー訴求'
                                                    : comp.appealAxis.heroType === 'emotional' ? '感情訴求'
                                                    : comp.appealAxis.heroType === 'social-proof' ? '実績訴求'
                                                    : '訴求不明確'}
                                                </span>
                                                {comp.appealAxis.uspKeywords.slice(0, 3).map((kw: string, ki: number) => (
                                                  <span key={ki} className="text-[10px] bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full font-bold">{kw}</span>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* リンク */}
                                          <a
                                            href={comp.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-500 transition-colors"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            サイトを開く
                                          </a>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </td>
                              </tr>
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ===== AI発見 競合企業 ===== */}
                {result.analytics?.discoveredCompetitors && result.analytics.discoveredCompetitors.length > 0 && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-violet-600" />
                      AIが発見した競合企業
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-50 text-violet-600 border border-violet-200">
                        AI発見
                      </span>
                    </h3>
                    <div className="space-y-3">
                      {result.analytics.discoveredCompetitors.map((comp, i) => {
                        const threatStyle = {
                          high: { bg: 'bg-red-50 border-red-200', text: 'text-red-600', label: '高脅威' },
                          medium: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-600', label: '中脅威' },
                          low: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-600', label: '低脅威' },
                        }[comp.threatLevel] || { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-500', label: '不明' }
                        return (
                          <div key={i} className={`${threatStyle.bg} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${threatStyle.text}`}>
                                {threatStyle.label}
                              </span>
                              <h4 className="font-black text-gray-900 text-sm">{comp.name}</h4>
                            </div>
                            <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-1">
                              <ExternalLink className="w-3 h-3" />
                              {comp.url}
                            </a>
                            <p className="text-xs text-gray-500 leading-relaxed">{comp.reason}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ===== 競合インテリジェンス ===== */}
                {result.competitorIntelligence && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-3 flex items-center gap-2">
                      <Search className="w-5 h-5 text-blue-600" />
                      競合インテリジェンス
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{result.competitorIntelligence}</p>
                  </div>
                )}

                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-600" />
                    業界ベンチマーク比較
                  </h3>
                  <BenchmarkChart benchmark={result.benchmark} />
                </div>

                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2 flex-wrap">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    ボトルネック
                    <span className="text-xs font-bold text-gray-400 ml-auto">{result.bottlenecks.length}件検出</span>
                  </h3>
                  <BottleneckPanel bottlenecks={result.bottlenecks} />
                </div>

                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2 flex-wrap">
                    <Sparkles className="w-5 h-5 text-teal-600" />
                    改善アクション提案
                    <span className="text-xs font-bold text-gray-400 ml-auto">{result.recommendations.length}件 | Quick Win {result.recommendations.filter(r => r.quickWin).length}件</span>
                  </h3>
                  <RecommendationPanel recommendations={result.recommendations} />
                </div>

                {/* ===== 業界インサイト ===== */}
                {result.industryInsights && result.industryInsights.length > 0 && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                      <Compass className="w-5 h-5 text-purple-600" />
                      業界インサイト
                    </h3>
                    <div className="space-y-2">
                      {result.industryInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-3 bg-purple-50/50 border border-purple-200 rounded-xl p-3">
                          <span className="w-5 h-5 rounded-full bg-purple-50 flex items-center justify-center text-[10px] font-black text-purple-600 flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-sm text-gray-600 leading-relaxed">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!isStreaming && (
                <div className="mt-8 flex justify-center">
                  <PdfExportButton targetRef={dashboardRef} fileName={`doya-shindan-${answers.industry || 'report'}`} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
