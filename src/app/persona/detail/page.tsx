'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
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
import {
  PartyLoadingOverlay,
  ctaMotion,
  pageMount,
  useConfettiOnComplete,
  usePersonaMotionMode,
} from '@/components/persona/PersonaMotion'
import { isWithinFreeHour } from '@/lib/pricing'
import { LoadingProgress } from '@/components/persona/LoadingProgress'

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
  dailySchedule?: { time: string; title: string; detail: string; mood?: string; imageCaption?: string; sceneKeywords?: string[] }[]
  diary?: { title: string; body: string; captionText: string; sceneKeywords: string[] }
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
  const motionMode = usePersonaMotionMode()
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  const unifiedPlan = String((session?.user as any)?.plan || '').toUpperCase()
  const firstLoginAt = (session?.user as any)?.firstLoginAt as string | null | undefined
  const isFreeHourActive = isLoggedIn && isWithinFreeHour(firstLoginAt)
  const personaTier = isLoggedIn ? (unifiedPlan === 'ENTERPRISE' ? 'ENTERPRISE' : unifiedPlan === 'PRO' ? 'PRO' : 'FREE') : 'GUEST'
  const canGenerateDiaryScheduleImages = isFreeHourActive || personaTier === 'PRO' || personaTier === 'ENTERPRISE'
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
  const [diaryImage, setDiaryImage] = useState<string | null>(null)
  const [diaryCaption, setDiaryCaption] = useState<string>('ある日の記録')
  const [diaryLoading, setDiaryLoading] = useState(false)
  const [scheduleImages, setScheduleImages] = useState<Record<number, string>>({})
  const [scheduleImagesLoading, setScheduleImagesLoading] = useState(false)
  const [scheduleImageLoadingMap, setScheduleImageLoadingMap] = useState<Record<number, boolean>>({})

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

  const overlayProgress = useMemo(() => {
    const base = Math.round(((stageIdx + 1) / Math.max(1, LOADING_STAGES.length)) * 100)
    if (!loading) return 100
    return Math.min(96, Math.max(10, base))
  }, [loading, stageIdx])

  const overlayMood = useMemo(() => {
    if (!loading) return 'idle' as const
    if (overlayProgress < 35) return 'search' as const
    if (overlayProgress < 70) return 'think' as const
    return 'happy' as const
  }, [loading, overlayProgress])

  useConfettiOnComplete({
    enabled: motionMode === 'party',
    when: !loading && Boolean(generatedData),
  })

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

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    link.click()
  }

  const generateDiaryImageFor = async (args: {
    diaryText: string
    captionText: string
    keywords: string[]
    gender?: string
  }): Promise<string> => {
    const res = await fetch('/api/persona/diary-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...args, size: '1200x628' }),
    })
    const raw = await res.text()
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }
    if (!res.ok || !data?.success || !data?.image) {
      throw new Error((data && (data.error || data.message)) || '日記イメージ生成に失敗しました')
    }
    return data.image
  }

  const generateScheduleImageFor = async (args: {
    title: string
    detail: string
    mood?: string
    captionText?: string
    keywords?: string[]
    gender?: string
  }): Promise<string> => {
    const diaryText = `${args.title}\n${args.detail}${args.mood ? `\n気分: ${args.mood}` : ''}`.trim()
    const captionText = String(args.captionText || args.title || '生活の一コマ').slice(0, 32)
    const keywords = Array.isArray(args.keywords) ? args.keywords.map(String).filter(Boolean).slice(0, 12) : []
    return await generateDiaryImageFor({ diaryText, captionText, keywords, gender: args.gender })
  }

  const generateScheduleImageForIndex = async (idx: number, s: any, gender?: string) => {
    if (!canGenerateDiaryScheduleImages) {
      setError('日記/スケジュールの画像生成はPRO/ENTERPRISEまたは初回ログイン後1時間のみ利用できます')
      return
    }
    setScheduleImageLoadingMap((prev) => ({ ...prev, [idx]: true }))
    try {
      const img = await generateScheduleImageFor({
        title: s.title,
        detail: s.detail,
        mood: s.mood,
        captionText: s.imageCaption || s.title,
        keywords: s.sceneKeywords || [],
        gender,
      })
      setScheduleImages((prev) => ({ ...prev, [idx]: img }))
      return img
    } finally {
      setScheduleImageLoadingMap((prev) => ({ ...prev, [idx]: false }))
    }
  }

  const autoGenerateDiaryAndScheduleImages = async (data: GeneratedData) => {
    if (!canGenerateDiaryScheduleImages) return
    // 日記は自動生成（1枚）
    const diary = data.persona.diary
    if (diary?.body) {
      setDiaryLoading(true)
      try {
        const img = await generateDiaryImageFor({
          diaryText: diary.body,
          captionText: String(diary.captionText || diaryCaption || 'ある日の記録'),
          keywords: diary.sceneKeywords || [],
          gender: data.persona.gender,
        })
        setDiaryImage(img)
      } catch (e) {
        console.warn('auto diary image failed', e)
      } finally {
        setDiaryLoading(false)
      }
    }

    const schedule = Array.isArray(data.persona.dailySchedule) ? data.persona.dailySchedule : []
    if (schedule.length === 0) return

    // 画像は「1日あたり約4枚」に絞る
    const textOf = (s: any) => `${String(s?.title || '')} ${String(s?.detail || '')}`
    const pickFirst = (re: RegExp, used: Set<number>) => {
      const idx = schedule.findIndex((s, i) => !used.has(i) && re.test(textOf(s)))
      if (idx >= 0) {
        used.add(idx)
        return idx
      }
      return -1
    }
    const used = new Set<number>()
    const priority: RegExp[] = [
      /業務開始|始業|仕事開始|出社/i,
      /会議|商談|提案|打合せ|MTG/i,
      /ランチ|昼食|昼休み|食事/i,
      /作業|分析|制作|運用|資料/i,
      /帰宅|退勤|夕食|夜|子ども|家族/i,
    ]
    const targetIdx: number[] = []
    for (const re of priority) {
      const idx = pickFirst(re, used)
      if (idx >= 0) targetIdx.push(idx)
      if (targetIdx.length >= 4) break
    }
    for (let i = 0; i < schedule.length && targetIdx.length < 4; i++) {
      if (!used.has(i)) {
        used.add(i)
        targetIdx.push(i)
      }
    }

    if (targetIdx.length === 0) return
    setScheduleImagesLoading(true)
    try {
      for (const i of targetIdx) {
        const s = schedule[i]
        if (!s) continue
        try {
          await generateScheduleImageForIndex(i, s, data.persona.gender)
        } catch (e) {
          console.warn('schedule image failed', i, e)
        }
      }
    } finally {
      setScheduleImagesLoading(false)
    }
  }

  const generateDiaryImage = async () => {
    if (!canGenerateDiaryScheduleImages) {
      setError('日記/スケジュールの画像生成はPRO/ENTERPRISEまたは初回ログイン後1時間のみ利用できます')
      return
    }
    if (!generatedData?.persona?.diary?.body) {
      setError('日記が未生成です（再生成してください）')
      return
    }
    setDiaryLoading(true)
    try {
      const img = await generateDiaryImageFor({
        diaryText: generatedData.persona.diary.body,
        captionText: diaryCaption,
        keywords: generatedData.persona.diary.sceneKeywords || [],
        gender: generatedData.persona.gender,
      })
      setDiaryImage(img)
    } catch (e) {
      setError(e instanceof Error ? e.message : '日記イメージ生成エラー')
    } finally {
      setDiaryLoading(false)
    }
  }

  const keyScheduleIndices = useMemo(() => {
    const schedule = generatedData?.persona?.dailySchedule || []
    if (!Array.isArray(schedule) || schedule.length === 0) return []
    const textOf = (s: any) => `${String(s?.title || '')} ${String(s?.detail || '')}`
    const used = new Set<number>()
    const picked: number[] = []
    const priority: RegExp[] = [
      /業務開始|始業|仕事開始|出社/i,
      /会議|商談|提案|打合せ|MTG/i,
      /ランチ|昼食|昼休み|食事/i,
      /作業|分析|制作|運用|資料/i,
      /帰宅|退勤|夕食|夜|子ども|家族/i,
    ]
    for (const re of priority) {
      const idx = schedule.findIndex((s, i) => !used.has(i) && re.test(textOf(s)))
      if (idx >= 0) {
        used.add(idx)
        picked.push(idx)
      }
      if (picked.length >= 4) break
    }
    for (let i = 0; i < schedule.length && picked.length < 4; i++) {
      if (!used.has(i)) {
        used.add(i)
        picked.push(i)
      }
    }
    return picked.sort((a, b) => a - b)
  }, [generatedData?.persona?.dailySchedule])

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
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 65_000)
      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, serviceName }),
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout))
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成に失敗しました')
      // APIは { success, data: { persona }, meta } を返す
      const persona = data.data?.persona || data.persona
      const analysis = data.data?.analysis || data.analysis
      if (!persona) throw new Error('ペルソナ情報がありません')
      setGeneratedData({ persona, analysis })
      // 画像関連の状態を初期化
      setDiaryImage(null)
      const cap = String(persona?.diary?.captionText || '').trim()
      setDiaryCaption(cap || 'ある日の記録')
      setScheduleImages({})
      // Auto generate portrait
      void generatePortrait(persona)
      // 日記/スケジュール画像も自動生成（非同期で進める）
      void autoGenerateDiaryAndScheduleImages({ persona, analysis })
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'AbortError'
          ? '生成がタイムアウトしました（通信が長時間応答しませんでした）。もう一度お試しください。'
          : e instanceof Error
          ? e.message
          : '生成エラー'
      setError(msg)
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
    <motion.div variants={pageMount} initial="initial" animate="animate" className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <PartyLoadingOverlay
        open={loading}
        mode={motionMode}
        progress={overlayProgress}
        stageText={LOADING_STAGES[stageIdx] || 'ペルソナを調査中…'}
        mood={overlayMood}
        steps={[
          { label: '解析', threshold: 15 },
          { label: '設計', threshold: 45 },
          { label: '履歴書', threshold: 70 },
          { label: '日記', threshold: 90 },
        ]}
      />
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

          <motion.button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full h-12 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-base font-black hover:from-purple-500 hover:to-pink-500 disabled:opacity-60 flex items-center justify-center gap-2"
            {...ctaMotion(motionMode)}
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
          </motion.button>
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
                  {/* 履歴書っぽさ強化：上部の情報密度を上げる */}
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">現住所</div>
                      <div className="text-slate-900 font-black truncate">{generatedData.persona.location}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">年収</div>
                      <div className="text-slate-900 font-black truncate">{generatedData.persona.income}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">業界</div>
                      <div className="text-slate-900 font-black truncate">{generatedData.persona.industry || '—'}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">会社規模</div>
                      <div className="text-slate-900 font-black truncate">{generatedData.persona.companySize || '—'}</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">家族構成</div>
                      <div className="text-slate-900 font-black truncate">{generatedData.persona.familyStructure}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">学歴</div>
                      <div className="text-slate-900 font-black truncate">{generatedData.persona.education || '—'}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">推定生年</div>
                      <div className="text-slate-900 font-black">
                        {generatedData.persona.age ? `${new Date().getFullYear() - generatedData.persona.age}年頃` : '—'}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500">デバイス</div>
                      <div className="text-slate-900 font-black truncate">
                        {Array.isArray(generatedData.persona.devices) && generatedData.persona.devices.length > 0
                          ? generatedData.persona.devices.slice(0, 2).join(' / ')
                          : '—'}
                      </div>
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

            {/* 履歴書の下：特徴（スケジュール＋日記＋日記イメージ） */}
            <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-slate-900 font-black text-base">特徴：こういったスケジュールで1日を送っています</div>
                    <div className="text-slate-500 text-xs font-bold mt-1">“実在感”を出すため、日常のリズムをそのまま使えます。</div>
                  </div>
                  <button
                    onClick={() => void autoGenerateDiaryAndScheduleImages(generatedData)}
                    disabled={!canGenerateDiaryScheduleImages || scheduleImagesLoading || diaryLoading}
                    className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50 disabled:opacity-50"
                    title={
                      canGenerateDiaryScheduleImages
                        ? '業務開始/ランチ等の優先イベントを中心に画像を自動生成します'
                        : '画像生成はPRO/ENTERPRISEまたは初回ログイン後1時間のみ利用できます'
                    }
                  >
                    {!canGenerateDiaryScheduleImages
                      ? '画像はPROで解放'
                      : scheduleImagesLoading || diaryLoading
                      ? '自動生成中…'
                      : '画像を自動生成'}
                  </button>
                </div>
              </div>

              <div className="p-5">
                {generatedData.persona.dayInLife ? (
                  <div className="prose prose-slate max-w-none">
                    <p className="text-slate-700 text-base font-bold leading-relaxed">{generatedData.persona.dayInLife}</p>
                  </div>
                ) : null}

                <div className="mt-5 space-y-4">
                  {(generatedData.persona.dailySchedule || []).slice(0, 18).map((s, i) => {
                    const showImg = keyScheduleIndices.includes(i)
                    return (
                      <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="p-5">
                          <div className={`grid gap-4 ${showImg ? 'md:grid-cols-12' : ''}`}>
                            <div className={showImg ? 'md:col-span-5' : ''}>
                              <div className="flex items-baseline gap-3 flex-wrap">
                                <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-900 text-sm font-black">{s.time}</span>
                                <span className="text-slate-900 text-lg font-black">{s.title}</span>
                                {s.mood ? <span className="text-slate-500 text-sm font-bold">気分：{s.mood}</span> : null}
                              </div>
                              <div className="mt-3 text-slate-800 text-base leading-relaxed whitespace-pre-wrap">{s.detail}</div>
                            </div>

                            {showImg ? (
                              <div className="md:col-span-7">
                                <div className="text-slate-900 text-sm font-black mb-2">このシーンのイメージ</div>
                                <div className="aspect-[1200/628] rounded-2xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
                                  {!canGenerateDiaryScheduleImages ? (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                      <div className="text-center px-6">
                                        <div className="text-slate-900 font-black text-sm">この機能はブラインド表示です</div>
                                        <div className="text-slate-500 text-xs font-bold mt-1">
                                          PRO/ENTERPRISEでスケジュール画像が解放されます
                                        </div>
                                      </div>
                                    </div>
                                  ) : scheduleImages[i] ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={scheduleImages[i]} alt={`${s.title}`} className="w-full h-full object-cover" />
                                  ) : scheduleImageLoadingMap[i] || scheduleImagesLoading ? (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                      <LoadingProgress label="スケジュール画像を生成しています" />
                                    </div>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                      <div className="text-center">
                                        <div className="text-slate-900 font-black text-sm">このシーンは画像化します（全体で約4枚）</div>
                                        <div className="text-slate-500 text-xs font-bold mt-1">必要な重要シーンだけを抜粋しています。</div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="mt-3 flex gap-2">
                                  <button
                                    onClick={() =>
                                      void (async () => {
                                        try {
                                                  await generateScheduleImageForIndex(i, s, generatedData.persona.gender)
                                        } catch (e) {
                                          setError(e instanceof Error ? e.message : 'スケジュール画像生成エラー')
                                        }
                                      })()
                                    }
                                    disabled={!canGenerateDiaryScheduleImages || !!scheduleImageLoadingMap[i]}
                                    className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-black hover:bg-slate-100 disabled:opacity-50"
                                  >
                                    {!canGenerateDiaryScheduleImages
                                      ? 'PROで解放'
                                      : scheduleImageLoadingMap[i]
                                      ? '生成中…'
                                      : scheduleImages[i]
                                      ? '再生成'
                                      : '画像を生成'}
                                  </button>
                                  {scheduleImages[i] ? (
                                    <button
                                      onClick={() => downloadImage(scheduleImages[i], `schedule-${i + 1}-${generatedData.persona.name}.png`)}
                                      className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800"
                                    >
                                      画像を保存
                                    </button>
                                  ) : (
                                    <button disabled className="h-10 px-4 rounded-xl bg-slate-200 text-slate-500 text-sm font-black">
                                      画像を保存
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {generatedData.persona.diary ? (
                  <div className="mt-6">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <div className="text-slate-900 font-black">日記：{generatedData.persona.diary.title}</div>
                        <div className="text-slate-500 text-xs font-bold mt-1">“手書きノート”っぽく、生活感が出るように表示しています。</div>
                      </div>

                      <div className="p-5">
                        <div
                          className="relative rounded-2xl border border-slate-200 overflow-hidden"
                          style={{
                            background: 'repeating-linear-gradient(to bottom, #ffffff 0px, #ffffff 26px, #eef2ff 27px, #ffffff 28px)',
                          }}
                        >
                          <div className="px-6 py-6">
                            <p
                              className="text-slate-900 leading-[2.05] whitespace-pre-wrap text-lg"
                              style={{
                                fontFamily:
                                  "'Hannotate SC','YuKyokasho','YuKyokasho Yoko','Hiragino Maru Gothic ProN','Hiragino Sans','Segoe Print','Bradley Hand','Comic Sans MS',ui-sans-serif,system-ui",
                              }}
                            >
                              {generatedData.persona.diary.body}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <div className="text-slate-900 font-black">日記イメージ</div>
                              <div className="text-slate-500 text-xs font-bold mt-1">日記内容に合わせた画像を自動生成します。</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={generateDiaryImage}
                                disabled={!canGenerateDiaryScheduleImages || diaryLoading}
                                className="h-10 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-black disabled:opacity-50"
                              >
                                {!canGenerateDiaryScheduleImages ? 'PROで解放' : diaryLoading ? '生成中…' : '画像を生成'}
                              </button>
                              {diaryImage ? (
                                <button
                                  onClick={() => downloadImage(diaryImage, `diary-${generatedData.persona.name}.png`)}
                                  className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800"
                                >
                                  画像保存
                                </button>
                              ) : (
                                <button disabled className="h-10 px-4 rounded-xl bg-slate-200 text-slate-500 text-sm font-black">
                                  画像保存
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                            <div className="aspect-[1200/628] flex items-center justify-center">
                              {!canGenerateDiaryScheduleImages ? (
                                <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                  <div className="text-center px-6">
                                    <div className="text-slate-900 font-black text-sm">日記画像はブラインド表示です</div>
                                    <div className="text-slate-500 text-xs font-bold mt-1">
                                      PRO/ENTERPRISEで日記画像が解放されます
                                    </div>
                                  </div>
                                </div>
                              ) : diaryImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={diaryImage} alt="diary" className="w-full h-full object-cover" />
                              ) : diaryLoading ? (
                                <div className="w-full h-full flex items-center justify-center">
                                  <LoadingProgress label="日記イメージを生成しています" />
                                </div>
                              ) : (
                                <div className="text-slate-400 text-sm font-bold">まだ生成されていません</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

