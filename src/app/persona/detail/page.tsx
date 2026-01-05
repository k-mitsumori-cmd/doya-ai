'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  ChevronDown,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Download,
  Loader2,
  User,
  FileText,
} from 'lucide-react'

// ============================================
// ペルソナ先生（詳細版）
// URLがない人向け：プルダウン/テキスト入力で生成
// ============================================

const INDUSTRY_OPTIONS = [
  { value: '', label: '（選択してください）' },
  { value: 'it_saas', label: 'IT / SaaS' },
  { value: 'ec_retail', label: 'EC / 小売' },
  { value: 'manufacturing', label: '製造業' },
  { value: 'finance', label: '金融 / 保険' },
  { value: 'real_estate', label: '不動産' },
  { value: 'consulting', label: 'コンサル / 士業' },
  { value: 'education', label: '教育 / 研修' },
  { value: 'healthcare', label: '医療 / ヘルスケア' },
  { value: 'food', label: '飲食 / フード' },
  { value: 'travel', label: '旅行 / ホスピタリティ' },
  { value: 'media', label: 'メディア / 広告' },
  { value: 'other', label: 'その他' },
]

const TARGET_OPTIONS = [
  { value: '', label: '（選択してください）' },
  { value: 'b2b_enterprise', label: 'B2B（大企業向け）' },
  { value: 'b2b_smb', label: 'B2B（中小企業向け）' },
  { value: 'b2c_general', label: 'B2C（一般消費者）' },
  { value: 'b2c_premium', label: 'B2C（高所得層）' },
  { value: 'b2c_youth', label: 'B2C（若年層/学生）' },
]

const AGE_RANGE_OPTIONS = [
  { value: '', label: '（選択してください）' },
  { value: '20-30', label: '20代〜30代前半' },
  { value: '30-40', label: '30代〜40代前半' },
  { value: '40-50', label: '40代〜50代前半' },
  { value: '50-60', label: '50代〜60代' },
  { value: 'all', label: '幅広い層' },
]

const GENDER_OPTIONS = [
  { value: '', label: '（どちらでも）' },
  { value: 'male', label: '男性中心' },
  { value: 'female', label: '女性中心' },
]

// サンプルデータ（プルダウンで選択 → 各項目に自動入力）
const SAMPLE_PRESETS = [
  {
    id: '',
    label: '（サンプルを選択）',
    data: null,
  },
  {
    id: 'saas_marketing',
    label: 'SaaSマーケティングツール',
    data: {
      industry: 'it_saas',
      targetType: 'b2b_smb',
      ageRange: '30-40',
      genderPref: '',
      serviceName: 'クラウドMA（マーケティングオートメーション）',
      serviceDetail: 'メール配信・リード管理・スコアリングを一元化できるクラウドサービス。中小企業のマーケティング担当者がメインターゲット。',
      additionalInfo: '導入ハードルの低さと日本語サポートが強み。競合はHubSpotやMarketoなど。',
    },
  },
  {
    id: 'ec_cosmetics',
    label: 'ECコスメブランド',
    data: {
      industry: 'ec_retail',
      targetType: 'b2c_general',
      ageRange: '20-30',
      genderPref: 'female',
      serviceName: 'オーガニックスキンケア「NaturaBelle」',
      serviceDetail: '天然由来成分100%のスキンケアライン。敏感肌でも使える低刺激処方。D2Cで直販。',
      additionalInfo: 'SNS（Instagram/TikTok）での口コミ拡散を狙う。価格帯は中〜高価格帯。',
    },
  },
  {
    id: 'consulting_dx',
    label: 'DXコンサルティング',
    data: {
      industry: 'consulting',
      targetType: 'b2b_enterprise',
      ageRange: '40-50',
      genderPref: 'male',
      serviceName: 'DX推進パートナーシップ',
      serviceDetail: '製造業・物流業向けのDX戦略立案〜システム導入支援。業務効率化とデータ活用がメインテーマ。',
      additionalInfo: '決裁者は経営層・情シス部長クラス。ROI可視化が重要。',
    },
  },
  {
    id: 'education_online',
    label: 'オンライン学習サービス',
    data: {
      industry: 'education',
      targetType: 'b2c_youth',
      ageRange: '20-30',
      genderPref: '',
      serviceName: 'スキルアップオンライン',
      serviceDetail: 'プログラミング・デザイン・ビジネススキルが学べるサブスク型オンライン学習プラットフォーム。',
      additionalInfo: '転職・副業目的のユーザーが多い。月額制で動画見放題。',
    },
  },
  {
    id: 'food_delivery',
    label: 'フードデリバリーアプリ',
    data: {
      industry: 'food',
      targetType: 'b2c_general',
      ageRange: '20-30',
      genderPref: '',
      serviceName: 'ごはんNOW',
      serviceDetail: '地元飲食店と提携したフードデリバリーアプリ。30分以内配達が売り。',
      additionalInfo: '一人暮らし・共働き世帯がメイン。クーポン施策で新規獲得。',
    },
  },
]

const LOADING_STAGES = [
  'ペルソナを調査中…',
  '候補を洗い出しています…',
  '生活パターンを分析中…',
  '履歴書を作成しています…',
  '最終仕上げ中…',
]

interface PersonaData {
  name: string
  age: number
  gender: string
  occupation: string
  industry?: string
  companySize?: string
  income: string
  location: string
  familyStructure: string
  education?: string
  lifestyle: string
  devices?: string[]
  challenges: string[]
  goals: string[]
  values?: string[]
  mediaUsage: string[]
  searchKeywords?: string[]
  purchaseMotivation: string[]
  objections: string[]
  objectionHandling?: string[]
  personalityTraits: string[]
  dayInLife: string
  quote: string
  dailySchedule?: { time: string; title: string; detail: string; mood?: string }[]
  diary?: { title: string; body: string; captionText?: string }
}

interface GeneratedData {
  analysis?: {
    siteSummary?: string
    keyOffer?: string
    targetHypothesis?: string
    whyThisPersona?: string
    evidence?: string[]
  }
  persona: PersonaData
}

const formatJpDate = (d: Date) =>
  `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`

export default function PersonaDetailPage() {
  // サンプル選択
  const [selectedSample, setSelectedSample] = useState('')

  // Form fields
  const [industry, setIndustry] = useState('')
  const [targetType, setTargetType] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [genderPref, setGenderPref] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [serviceDetail, setServiceDetail] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')

  // States
  const [loading, setLoading] = useState(false)
  const [stageIdx, setStageIdx] = useState(0)
  const [error, setError] = useState('')
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null)
  const [portraitImage, setPortraitImage] = useState<string | null>(null)
  const [portraitLoading, setPortraitLoading] = useState(false)

  // サンプル選択時に各フィールドを自動入力
  const handleSampleChange = (sampleId: string) => {
    setSelectedSample(sampleId)
    const preset = SAMPLE_PRESETS.find((p) => p.id === sampleId)
    if (preset?.data) {
      setIndustry(preset.data.industry)
      setTargetType(preset.data.targetType)
      setAgeRange(preset.data.ageRange)
      setGenderPref(preset.data.genderPref)
      setServiceName(preset.data.serviceName)
      setServiceDetail(preset.data.serviceDetail)
      setAdditionalInfo(preset.data.additionalInfo)
    }
  }

  // Loading animation
  useEffect(() => {
    if (!loading) return
    setStageIdx(0)
    const t = window.setInterval(() => {
      setStageIdx((v) => (v + 1) % LOADING_STAGES.length)
    }, 900)
    return () => window.clearInterval(t)
  }, [loading])

  const resumeIssueDate = useMemo(() => formatJpDate(new Date()), [])

  const generatePortrait = async (persona: PersonaData) => {
    setPortraitLoading(true)
    try {
      const res = await fetch('/api/persona/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      })
      const data = await res.json()
      if (data.success && data.image) {
        setPortraitImage(data.image)
      }
    } catch {
      // Ignore portrait errors
    } finally {
      setPortraitLoading(false)
    }
  }

  const handleGenerate = async () => {
    setError('')
    if (!industry) {
      setError('業界を選択してください')
      return
    }
    if (!targetType) {
      setError('ターゲットを選択してください')
      return
    }

    const brief = {
      industry: INDUSTRY_OPTIONS.find((o) => o.value === industry)?.label || industry,
      targetType: TARGET_OPTIONS.find((o) => o.value === targetType)?.label || targetType,
      ageRange: AGE_RANGE_OPTIONS.find((o) => o.value === ageRange)?.label || ageRange || '30代〜40代',
      genderPref: GENDER_OPTIONS.find((o) => o.value === genderPref)?.label || 'どちらでも',
      serviceName: serviceName || '未定',
      serviceDetail: serviceDetail || '',
      additionalInfo: additionalInfo || '',
    }

    setLoading(true)
    try {
      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, serviceName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成に失敗しました')
      // APIは { success, data: { persona }, meta } を返す
      const persona = data.data?.persona || data.persona
      const analysis = data.data?.analysis || data.analysis
      if (!persona) throw new Error('ペルソナ情報がありません')
      setGeneratedData({ persona, analysis })
      // Auto generate portrait
      void generatePortrait(persona)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成エラー')
    } finally {
      setLoading(false)
    }
  }

  const downloadJson = () => {
    if (!generatedData) return
    const blob = new Blob([JSON.stringify(generatedData, null, 2)], { type: 'application/json;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `persona-${generatedData.persona.name}-${Date.now()}.json`
    a.click()
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-purple-600" />
              ペルソナ生成（詳細版）
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              URLがなくても、プルダウンとテキスト入力だけでペルソナを生成できます。
            </p>
          </div>
          {/* サンプル選択 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">サンプル：</span>
            <select
              value={selectedSample}
              onChange={(e) => handleSampleChange(e.target.value)}
              className="h-10 px-3 bg-white border border-purple-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30 min-w-[200px]"
            >
              {SAMPLE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-8">
          <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            サービス・ターゲット情報
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {/* Industry */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">業界 *</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              >
                {INDUSTRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Type */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">ターゲット *</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              >
                {TARGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Age Range */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">年齢層</label>
              <select
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              >
                {AGE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">性別</label>
              <select
                value={genderPref}
                onChange={(e) => setGenderPref(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Service Name */}
          <div className="mb-4">
            <label className="block text-xs font-black text-slate-700 mb-1">サービス名 / 商品名</label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="例：クラウドCRM、オーガニック化粧品など"
              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>

          {/* Service Detail */}
          <div className="mb-4">
            <label className="block text-xs font-black text-slate-700 mb-1">サービス内容 / 特徴</label>
            <textarea
              value={serviceDetail}
              onChange={(e) => setServiceDetail(e.target.value)}
              placeholder="サービスの概要、解決する課題、強みなど（任意）"
              rows={3}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
            />
          </div>

          {/* Additional Info */}
          <div className="mb-5">
            <label className="block text-xs font-black text-slate-700 mb-1">追加情報</label>
            <textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="具体的に想定している顧客像、課題、要望があれば…（任意）"
              rows={2}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full h-12 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-base font-black hover:from-purple-500 hover:to-pink-500 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {LOADING_STAGES[stageIdx]}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                ペルソナを生成
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {generatedData && generatedData.persona && (
          <div className="space-y-6">
            {/* Analysis & rationale */}
            {generatedData.analysis && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <div className="relative px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-600 to-pink-600">
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-white blur-3xl" />
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-white blur-3xl" />
                  </div>
                  <div className="relative flex items-center justify-between gap-3">
                    <div>
                      <div className="text-white/90 text-[11px] font-black tracking-wider">DETAIL INTELLIGENCE</div>
                      <div className="text-white text-lg font-black leading-tight">入力内容の分析 / なぜこのペルソナ？</div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-black">
                      PERSONA RATIONALE
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[10px] font-black text-slate-500 mb-1">要約</div>
                      <div className="text-slate-900 text-sm font-bold leading-relaxed whitespace-pre-wrap">
                        {generatedData.analysis.siteSummary}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[10px] font-black text-slate-500 mb-1">価値提案（誰の課題をどう解決）</div>
                      <div className="text-slate-900 text-sm font-bold leading-relaxed whitespace-pre-wrap">
                        {generatedData.analysis.keyOffer}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[10px] font-black text-slate-500 mb-1">ターゲット仮説</div>
                      <div className="text-slate-900 text-sm font-bold leading-relaxed whitespace-pre-wrap">
                        {generatedData.analysis.targetHypothesis}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-slate-900 font-black">なぜこのペルソナになったのか</div>
                      <div className="hidden sm:flex items-center gap-2 text-xs font-black text-purple-700">
                        <Sparkles className="w-4 h-4" />
                        EXPLAINED
                      </div>
                    </div>
                    <div className="mt-2 text-slate-800 text-sm font-bold leading-relaxed whitespace-pre-wrap">
                      {generatedData.analysis.whyThisPersona}
                    </div>

                    {Array.isArray(generatedData.analysis.evidence) && generatedData.analysis.evidence.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[10px] font-black text-slate-500 mb-2">根拠（抽出）</div>
                        <div className="flex flex-wrap gap-2">
                          {generatedData.analysis.evidence.slice(0, 8).map((e, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-xs font-bold"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-slate-700 text-sm font-black">履歴書（ペルソナ）</div>
                <span className="hidden sm:inline text-slate-400 text-xs font-bold">/ ダウンロード可能</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-slate-500 text-xs font-bold">作成日：{resumeIssueDate}</div>
                <button
                  onClick={downloadJson}
                  className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-black hover:bg-slate-800"
                  title="JSONでダウンロード"
                >
                  JSON
                </button>
              </div>
            </div>

            {/* Resume card */}
            <div className="bg-white border-2 border-slate-800">
              {/* Header row */}
              <div className="grid grid-cols-12 border-b border-slate-800">
                <div className="col-span-9 p-4 border-r border-slate-800">
                  <div className="text-sm font-black text-slate-900">ふりがな（仮）</div>
                  <div className="mt-1 text-2xl font-black text-slate-900 tracking-wide">{generatedData.persona.name}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">年齢</div>
                      <div className="text-slate-900 font-black">{generatedData.persona.age}歳</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">性別</div>
                      <div className="text-slate-900 font-black">{generatedData.persona.gender}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">職業</div>
                      <div className="text-slate-900 font-black truncate">{generatedData.persona.occupation}</div>
                    </div>
                  </div>
                  {generatedData.persona.quote && (
                    <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">本人の一言（口癖）</div>
                      <div className="text-slate-900 font-bold">「{generatedData.persona.quote}」</div>
                    </div>
                  )}
                </div>
                <div className="col-span-3 p-4 flex flex-col items-center justify-center">
                  <div className="text-[10px] font-bold text-slate-500 mb-2">顔写真（AI生成）</div>
                  <div className="w-28 h-36 border-2 border-slate-800 bg-white rounded overflow-hidden flex items-center justify-center">
                    {portraitLoading ? (
                      <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                    ) : portraitImage ? (
                      <img src={portraitImage} alt="Portrait" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                  {!portraitLoading && !portraitImage && (
                    <button
                      onClick={() => generatePortrait(generatedData.persona)}
                      className="mt-2 text-xs text-purple-600 font-bold hover:underline"
                    >
                      画像を生成
                    </button>
                  )}
                </div>
              </div>

              {/* Basic Info */}
              {[
                { k: '現住所', v: generatedData.persona.location },
                { k: '家族構成', v: generatedData.persona.familyStructure },
                { k: '年収', v: generatedData.persona.income },
                { k: '業界', v: generatedData.persona.industry },
                { k: '会社規模', v: generatedData.persona.companySize },
                { k: '学歴', v: generatedData.persona.education },
                { k: 'ライフスタイル', v: generatedData.persona.lifestyle },
              ].filter((r) => r.v).map((row, i) => (
                <div key={i} className="grid grid-cols-12 border-b border-slate-200">
                  <div className="col-span-3 px-4 py-2 bg-slate-50 text-xs font-black text-slate-600 border-r border-slate-200">{row.k}</div>
                  <div className="col-span-9 px-4 py-2 text-sm text-slate-900 font-bold">{row.v}</div>
                </div>
              ))}

              {/* Day In Life */}
              {generatedData.persona.dayInLife && (
                <div className="px-4 py-3 border-t border-slate-800">
                  <div className="text-xs font-black text-slate-600 mb-1">一日の概要</div>
                  <p className="text-sm text-slate-900 leading-relaxed">{generatedData.persona.dayInLife}</p>
                </div>
              )}

              {/* Challenges / Goals */}
              <div className="grid grid-cols-2 border-t border-slate-800">
                <div className="p-4 border-r border-slate-800">
                  <div className="text-xs font-black text-slate-600 mb-2">抱えている課題</div>
                  <ul className="space-y-1 list-disc list-inside text-sm text-slate-900">
                    {generatedData.persona.challenges.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
                <div className="p-4">
                  <div className="text-xs font-black text-slate-600 mb-2">目標</div>
                  <ul className="space-y-1 list-disc list-inside text-sm text-slate-900">
                    {generatedData.persona.goals.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
              </div>

              {/* Media / Purchase */}
              <div className="grid grid-cols-2 border-t border-slate-800">
                <div className="p-4 border-r border-slate-800">
                  <div className="text-xs font-black text-slate-600 mb-2">メディア/SNS利用</div>
                  <div className="flex flex-wrap gap-1">
                    {generatedData.persona.mediaUsage.map((m, i) => (
                      <span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-md">{m}</span>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-xs font-black text-slate-600 mb-2">購買動機</div>
                  <ul className="space-y-1 list-disc list-inside text-sm text-slate-900">
                    {generatedData.persona.purchaseMotivation.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              </div>

              {/* Objections */}
              {generatedData.persona.objections && generatedData.persona.objections.length > 0 && (
                <div className="p-4 border-t border-slate-800">
                  <div className="text-xs font-black text-slate-600 mb-2">買わない理由（反論）</div>
                  <ul className="space-y-1 list-disc list-inside text-sm text-slate-900">
                    {generatedData.persona.objections.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Daily Schedule */}
            {generatedData.persona.dailySchedule && generatedData.persona.dailySchedule.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <h3 className="text-base font-black text-slate-900 mb-4">📅 1日のスケジュール</h3>
                <div className="space-y-3">
                  {generatedData.persona.dailySchedule.map((s, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="w-16 text-sm font-black text-purple-600">{s.time}</div>
                      <div className="flex-1">
                        <div className="font-black text-slate-900">{s.title}</div>
                        <p className="text-sm text-slate-600 leading-relaxed">{s.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diary */}
            {generatedData.persona.diary && (
              <div
                className="relative rounded-xl p-6"
                style={{
                  background: 'repeating-linear-gradient(to bottom, #fff7ed 0px, #fff7ed 28px, #f3e8db 28px, #f3e8db 29px)',
                  fontFamily: '"Klee One", "Zen Kurenaido", "Yomogi", "Kosugi Maru", cursive, serif',
                }}
              >
                <div className="absolute left-8 top-0 bottom-0 w-px bg-red-300/60 pointer-events-none" />
                <h3 className="text-lg font-black text-slate-800 mb-3">📔 {generatedData.persona.diary.title}</h3>
                <p className="text-base text-slate-800 leading-loose whitespace-pre-wrap">{generatedData.persona.diary.body}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

