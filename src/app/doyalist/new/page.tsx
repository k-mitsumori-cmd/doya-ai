'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'

interface FormData {
  // Step 1
  title: string
  companyName: string
  serviceDescription: string
  strengths: string
  // Step 2
  industries: string[]
  areas: string[]
  companySize: string
  keywords: string
  // AI suggestion
  aiSuggestion: string | null
}

const INDUSTRIES = [
  'IT・通信', '製造業', '小売・卸売', '金融・保険', '不動産', '建設',
  '医療・福祉', '教育', '飲食・宿泊', '運輸・物流', 'コンサルティング',
  '広告・メディア', '人材サービス', 'EC・通販', 'SaaS・クラウド', 'その他',
]

const PREFECTURE_GROUPS: { region: string; items: string[] }[] = [
  { region: '北海道・東北', items: ['北海道', '東北'] },
  { region: '関東', items: ['関東', '東京'] },
  { region: '中部', items: ['中部'] },
  { region: '近畿', items: ['近畿', '大阪'] },
  { region: '中国・四国', items: ['中国', '四国'] },
  { region: '九州・沖縄', items: ['九州・沖縄'] },
  { region: 'その他', items: ['全国'] },
]

// Flat list kept for backward compat (used in toggleArrayItem etc.)
const PREFECTURES = PREFECTURE_GROUPS.flatMap((g) => g.items)

const COMPANY_SIZES = [
  { value: '', label: '指定なし', sub: '', icon: 'block' },
  { value: '1-10', label: '1〜10名', sub: 'スタートアップ・個人事業', icon: 'person' },
  { value: '11-50', label: '11〜50名', sub: '小規模企業', icon: 'group' },
  { value: '51-100', label: '51〜100名', sub: '中小企業', icon: 'groups' },
  { value: '101-300', label: '101〜300名', sub: '中堅企業', icon: 'apartment' },
  { value: '301-1000', label: '301〜1000名', sub: '大企業', icon: 'domain' },
  { value: '1001+', label: '1001名以上', sub: 'エンタープライズ', icon: 'corporate_fare' },
]

const STEPS = [
  { number: 1, title: '基本情報', icon: 'edit_note' },
  { number: 2, title: 'ターゲット条件', icon: 'tune' },
  { number: 3, title: '確認 & 実行', icon: 'rocket_launch' },
]

export default function NewProjectPage() {
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: '',
    companyName: '',
    serviceDescription: '',
    strengths: '',
    industries: [],
    areas: [],
    companySize: '',
    keywords: '',
    aiSuggestion: null,
  })

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const toggleArrayItem = (key: 'industries' | 'areas', item: string) => {
    setFormData((prev) => {
      const arr = prev[key]
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item],
      }
    })
  }

  const handleSuggestTarget = async () => {
    setIsSuggesting(true)
    try {
      const res = await fetch('/api/doyalist/suggest-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myServiceDesc: formData.serviceDescription,
          myStrengths: formData.strengths,
          targetHint: formData.keywords || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        updateField('aiSuggestion', data.reasoning || null)
        // Auto-fill suggested values if present
        if (data.industries) updateField('industries', data.industries)
        if (data.areas) updateField('areas', data.areas)
        if (data.companySize?.minEmployees || data.companySize?.maxEmployees) {
          // Map AI-suggested employee range to closest companySize option
          const max = data.companySize.maxEmployees || 9999
          if (max <= 10) updateField('companySize', '1-10')
          else if (max <= 50) updateField('companySize', '11-50')
          else if (max <= 100) updateField('companySize', '51-100')
          else if (max <= 300) updateField('companySize', '101-300')
          else if (max <= 1000) updateField('companySize', '301-1000')
          else updateField('companySize', '1001+')
        }
        if (data.keywords) {
          const kw = Array.isArray(data.keywords) ? data.keywords.join(', ') : data.keywords
          updateField('keywords', kw)
        }
      } else {
        console.error('AI提案失敗:', res.status)
      }
    } catch (err) {
      console.error('AI提案エラー:', err)
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/doyalist/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          myCompanyName: formData.companyName,
          myServiceDesc: formData.serviceDescription,
          myStrengths: formData.strengths,
          targetCriteria: {
            industries: formData.industries,
            areas: formData.areas,
            companySize: formData.companySize,
            keywords: formData.keywords,
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSubmitSuccess(true)
        // API returns the project object directly (not wrapped in { project: ... })
        setTimeout(() => {
          router.push(`/doyalist/projects/${data.id || ''}`)
        }, 1200)
      } else {
        const errData = await res.json().catch(() => ({}))
        alert(errData.error || 'プロジェクト作成に失敗しました')
      }
    } catch (err) {
      console.error('プロジェクト作成エラー:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.title.trim() && formData.companyName.trim() && formData.serviceDescription.trim()
      case 2:
        return formData.industries.length > 0 || formData.keywords.trim()
      case 3:
        return true
      default:
        return false
    }
  }

  /* ---------- Step indicator (Google-style horizontal stepper) ---------- */
  const StepIndicator = () => (
    <div className="flex items-start justify-center mb-14">
      {STEPS.map((step, index) => {
        const isCompleted = currentStep > step.number
        const isActive = currentStep === step.number

        return (
          <div key={step.number} className="flex items-start">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <motion.div
                layout
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-md'
                    : isActive
                      ? 'bg-blue-500 text-white ring-4 ring-blue-100 shadow-md'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <span className="material-symbols-outlined text-lg">check</span>
                ) : (
                  <span>{step.number}</span>
                )}
              </motion.div>
              <span
                className={`text-sm mt-2.5 font-medium whitespace-nowrap ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {step.title}
              </span>
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div className="relative w-20 sm:w-32 h-0.5 mx-4 mt-5">
                <div className="absolute inset-0 bg-slate-200 rounded-full" />
                <motion.div
                  className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                  initial={false}
                  animate={{ width: isCompleted ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  /* ---------- Login required ---------- */
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.img src="/characters/working_作業中.png" alt="読み込み中" className="w-20 h-20 object-contain rounded-full" animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 1.5, repeat: Infinity }} />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <motion.img src="/characters/hello_挨拶.png" alt="ログイン" className="w-28 h-28 object-contain rounded-full mx-auto mb-6" animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
          <h2 className="text-2xl font-bold text-slate-800 mb-3">ログインが必要です</h2>
          <p className="text-slate-500 mb-8">リストを作成するにはGoogleアカウントでログインしてください</p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/doyalist/new' })}
            className="inline-flex items-center gap-3 px-8 py-3.5 bg-blue-500 text-white font-bold rounded-full shadow-lg hover:bg-blue-600 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">login</span>
            Googleでログイン
          </button>
        </motion.div>
      </div>
    )
  }

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
            <span className="material-symbols-outlined text-3xl text-blue-500">playlist_add</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">新規リスト作成</h1>
          <p className="text-sm text-slate-500 mt-1.5">AIが最適なターゲット企業を見つけます</p>
        </div>

        {/* Step Indicator */}
        <StepIndicator />

        {/* Step Content Card */}
        <div className="bg-white rounded-3xl p-6 lg:p-10 shadow-sm">
          <AnimatePresence mode="wait">
            {/* ========== Step 1: Basic Info ========== */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                className="space-y-8"
              >
                {/* Section heading */}
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-50">
                      <span className="material-symbols-outlined text-xl text-blue-500">edit_note</span>
                    </span>
                    基本情報入力
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 ml-11">
                    自社の情報を入力してください。AIがターゲットを提案します。
                  </p>
                </div>

                {/* Tip card */}
                <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3">
                  <motion.img
                    src="/characters/point_解説.png"
                    alt="ポイント"
                    className="w-14 h-14 object-contain flex-shrink-0"
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">はじめての方へ</p>
                    <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                      自社サービスの情報を入力すると、AIが最適なターゲット企業を自動で提案します。まずは簡単な説明から始めましょう。
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* リスト名 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                      リスト名 <span className="text-red-400 text-xs">*必須</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      placeholder="例: IT企業向け新規開拓リスト"
                      className="w-full rounded-2xl border-2 border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 px-4 py-3.5 text-base text-slate-800 placeholder:text-slate-300 outline-none transition-all"
                    />
                  </div>

                  {/* 自社名 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                      自社名 <span className="text-red-400 text-xs">*必須</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => updateField('companyName', e.target.value)}
                      placeholder="例: 株式会社ドヤ"
                      className="w-full rounded-2xl border-2 border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 px-4 py-3.5 text-base text-slate-800 placeholder:text-slate-300 outline-none transition-all"
                    />
                  </div>

                  {/* 自社サービス説明 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                      自社サービス説明 <span className="text-red-400 text-xs">*必須</span>
                    </label>
                    <textarea
                      value={formData.serviceDescription}
                      onChange={(e) => updateField('serviceDescription', e.target.value)}
                      placeholder="例: 中小企業向けのクラウド会計ソフト。月額5,000円から利用でき、請求書発行や経費精算を自動化します。"
                      rows={4}
                      className="w-full rounded-2xl border-2 border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 px-4 py-3.5 text-base text-slate-800 placeholder:text-slate-300 outline-none transition-all resize-none min-h-[100px]"
                    />
                  </div>

                  {/* 自社の強み */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                      自社の強み・差別化ポイント <span className="text-slate-400 text-xs">任意</span>
                    </label>
                    <textarea
                      value={formData.strengths}
                      onChange={(e) => updateField('strengths', e.target.value)}
                      placeholder="例: 業界最安値の料金設定、導入後3日で運用開始可能、24時間チャットサポート"
                      rows={3}
                      className="w-full rounded-2xl border-2 border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 px-4 py-3.5 text-base text-slate-800 placeholder:text-slate-300 outline-none transition-all resize-none min-h-[100px]"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ========== Step 2: Target Criteria ========== */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                className="space-y-8"
              >
                {/* Section heading */}
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-50">
                      <span className="material-symbols-outlined text-xl text-blue-500">tune</span>
                    </span>
                    ターゲット条件設定
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 ml-11">
                    ターゲット企業の条件を設定してください。
                  </p>
                </div>

                {/* AI Suggestion Card Button */}
                <div className="relative">
                  <button
                    onClick={handleSuggestTarget}
                    disabled={isSuggesting}
                    className="w-full bg-white border-2 border-blue-200 rounded-2xl p-5 flex items-center gap-4 hover:border-blue-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed text-left group relative overflow-hidden"
                  >
                    <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 shrink-0 group-hover:bg-amber-100 transition-colors relative">
                      {isSuggesting ? (
                        <span className="material-symbols-outlined text-2xl text-amber-500 animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-amber-500">auto_awesome</span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-800">
                        {isSuggesting ? 'AIが分析中...' : 'AIにおまかせ'}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        基本情報をもとに、AIが最適なターゲット条件を自動提案します
                      </p>
                    </div>
                    {!isSuggesting && (
                      <span className="material-symbols-outlined text-xl text-blue-400 shrink-0">arrow_forward</span>
                    )}
                  </button>
                  {/* Sparkle particles around AI button */}
                  {!isSuggesting && (
                    <>
                      <motion.span
                        className="absolute -top-1 -right-1 text-amber-400 pointer-events-none select-none text-sm"
                        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      >&#10024;</motion.span>
                      <motion.span
                        className="absolute top-2 left-2 text-blue-400 pointer-events-none select-none text-xs"
                        animate={{ rotate: -360, scale: [1, 1.3, 1] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      >&#10024;</motion.span>
                      <motion.span
                        className="absolute -bottom-1 right-8 text-emerald-400 pointer-events-none select-none text-sm"
                        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "linear", delay: 0.5 }}
                      >&#10024;</motion.span>
                    </>
                  )}
                </div>

                {/* Bear character for AI state */}
                <AnimatePresence mode="wait">
                  {isSuggesting ? (
                    <motion.div key="thinking-bear" className="flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <motion.img src="/characters/thinking_考え中.png" alt="考え中..." className="w-16 h-16 object-contain" animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 1.5, repeat: Infinity }} />
                    </motion.div>
                  ) : formData.aiSuggestion ? (
                    <motion.div key="surprise-bear" className="flex justify-center relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <motion.img src="/characters/surprise_驚き.png" alt="発見!" className="w-16 h-16 object-contain" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }} />
                      {/* Burst particles */}
                      {[...Array(8)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316'][i],
                            top: '50%',
                            left: '50%',
                          }}
                          initial={{ x: 0, y: 0, opacity: 1 }}
                          animate={{
                            x: Math.cos(i * Math.PI / 4) * 60,
                            y: Math.sin(i * Math.PI / 4) * 60,
                            opacity: 0,
                            scale: 0,
                          }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {/* AI Suggestion Display */}
                <AnimatePresence>
                  {formData.aiSuggestion && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-blue-50 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100">
                            <span className="material-symbols-outlined text-base text-blue-500">lightbulb</span>
                          </span>
                          <span className="text-sm font-bold text-blue-700">AIからの提案</span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {formData.aiSuggestion}
                        </p>
                        {(formData.industries.length > 0 || formData.areas.length > 0) && (
                          <div className="mt-3 pt-3 border-t border-blue-100 flex flex-wrap gap-1.5">
                            {formData.industries.map((i) => (
                              <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {i}
                              </span>
                            ))}
                            {formData.areas.map((a) => (
                              <span key={a} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Manual Fields */}
                <div className="space-y-7">
                  {/* Industries - Chip toggles */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-3">
                      業種（複数選択可）
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {INDUSTRIES.map((industry) => {
                        const isSelected = formData.industries.includes(industry)
                        return (
                          <motion.button
                            key={industry}
                            layout
                            whileTap={{ scale: 0.9 }}
                            animate={isSelected ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                            transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}
                            onClick={() => toggleArrayItem('industries', industry)}
                            className={`px-4 py-2 text-sm rounded-full border-2 transition-colors duration-200 ${
                              isSelected
                                ? 'bg-blue-500 border-blue-500 text-white font-semibold shadow-sm'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                            }`}
                          >
                            {isSelected && (
                              <span className="material-symbols-outlined text-sm mr-1 align-middle" style={{ fontSize: '14px' }}>check</span>
                            )}
                            {industry}
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Areas - Chip toggles grouped by region */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-3">
                      エリア（複数選択可）
                    </label>
                    <div className="space-y-4">
                      {PREFECTURE_GROUPS.map((group) => (
                        <div key={group.region}>
                          <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            {group.region}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {group.items.map((area) => {
                              const isSelected = formData.areas.includes(area)
                              return (
                                <motion.button
                                  key={area}
                                  layout
                                  whileTap={{ scale: 0.9 }}
                                  animate={isSelected ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                                  transition={{ type: "spring", bounce: 0.4, duration: 0.3 }}
                                  onClick={() => toggleArrayItem('areas', area)}
                                  className={`px-4 py-2 text-sm rounded-full border-2 transition-colors duration-200 ${
                                    isSelected
                                      ? 'bg-blue-500 border-blue-500 text-white font-semibold shadow-sm'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                                  }`}
                                >
                                  {isSelected && (
                                    <span className="material-symbols-outlined text-sm mr-1 align-middle" style={{ fontSize: '14px' }}>check</span>
                                  )}
                                  {area}
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Company Size - Card selection grid */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-3">企業規模</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {COMPANY_SIZES.map((size) => {
                        const isSelected = formData.companySize === size.value
                        return (
                          <button
                            key={size.value}
                            onClick={() => updateField('companySize', size.value)}
                            className={`relative flex flex-col items-center justify-center px-3 py-5 rounded-2xl border-2 transition-all duration-200 text-center ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 shadow-md'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            {isSelected && (
                              <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-white" style={{ fontSize: '14px' }}>check</span>
                              </span>
                            )}
                            <span className={`material-symbols-outlined text-2xl mb-1.5 ${isSelected ? 'text-blue-500' : 'text-slate-300'}`}>
                              {size.icon}
                            </span>
                            <span className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                              {size.label}
                            </span>
                            {size.sub && (
                              <span className={`text-xs mt-0.5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>
                                {size.sub}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Keywords */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">キーワード</label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-lg text-slate-300 absolute left-4 top-1/2 -translate-y-1/2">sell</span>
                      <input
                        type="text"
                        value={formData.keywords}
                        onChange={(e) => updateField('keywords', e.target.value)}
                        placeholder="例: DX推進, 業務効率化, クラウド移行"
                        className="w-full rounded-2xl border-2 border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 pl-11 pr-4 py-3.5 text-base text-slate-800 placeholder:text-slate-300 outline-none transition-all"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 ml-1">カンマ区切りで複数入力可</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ========== Step 3: Confirmation ========== */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                className="space-y-6"
              >
                {/* Present bear mascot */}
                <motion.img
                  src="/characters/present_プレゼン.png"
                  alt="確認"
                  className="w-20 h-20 object-contain mx-auto"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* Section heading */}
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50">
                      <span className="material-symbols-outlined text-xl text-emerald-500">rocket_launch</span>
                    </span>
                    確認 & 実行
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 ml-11">
                    入力内容を確認して、リスト作成を開始してください。
                  </p>
                </div>

                {/* Basic Info Summary Card */}
                <div className="bg-slate-50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100">
                      <span className="material-symbols-outlined text-base text-blue-500">info</span>
                    </span>
                    基本情報
                  </h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex gap-4">
                      <dt className="text-slate-400 font-medium min-w-[100px] shrink-0">リスト名</dt>
                      <dd className="text-slate-800 font-medium">{formData.title}</dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="text-slate-400 font-medium min-w-[100px] shrink-0">自社名</dt>
                      <dd className="text-slate-800 font-medium">{formData.companyName}</dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="text-slate-400 font-medium min-w-[100px] shrink-0">サービス</dt>
                      <dd className="text-slate-800 leading-relaxed">{formData.serviceDescription}</dd>
                    </div>
                    {formData.strengths && (
                      <div className="flex gap-4">
                        <dt className="text-slate-400 font-medium min-w-[100px] shrink-0">強み</dt>
                        <dd className="text-slate-800 leading-relaxed">{formData.strengths}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Target Criteria Summary Card */}
                <div className="bg-slate-50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100">
                      <span className="material-symbols-outlined text-base text-blue-500">filter_alt</span>
                    </span>
                    ターゲット条件
                  </h3>
                  <dl className="space-y-4 text-sm">
                    {formData.industries.length > 0 && (
                      <div className="flex gap-4">
                        <dt className="text-slate-400 font-medium min-w-[100px] shrink-0">業種</dt>
                        <dd>
                          <div className="flex flex-wrap gap-1.5">
                            {formData.industries.map((i) => (
                              <span
                                key={i}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                              >
                                {i}
                              </span>
                            ))}
                          </div>
                        </dd>
                      </div>
                    )}
                    {formData.areas.length > 0 && (
                      <div className="flex gap-4">
                        <dt className="text-slate-400 font-medium min-w-[100px] shrink-0">エリア</dt>
                        <dd>
                          <div className="flex flex-wrap gap-1.5">
                            {formData.areas.map((a) => (
                              <span
                                key={a}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                              >
                                {a}
                              </span>
                            ))}
                          </div>
                        </dd>
                      </div>
                    )}
                    {formData.companySize && (
                      <div className="flex gap-4">
                        <dt className="text-slate-400 font-medium min-w-[100px] shrink-0">企業規模</dt>
                        <dd>
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            {COMPANY_SIZES.find((s) => s.value === formData.companySize)?.label}
                          </span>
                        </dd>
                      </div>
                    )}
                    {formData.keywords && (
                      <div className="flex gap-4">
                        <dt className="text-slate-400 font-medium min-w-[100px] shrink-0">キーワード</dt>
                        <dd>
                          <div className="flex flex-wrap gap-1.5">
                            {formData.keywords.split(/[,、]/).filter(Boolean).map((kw) => (
                              <span
                                key={kw.trim()}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                              >
                                {kw.trim()}
                              </span>
                            ))}
                          </div>
                        </dd>
                      </div>
                    )}
                    {formData.industries.length === 0 && formData.areas.length === 0 && !formData.companySize && !formData.keywords && (
                      <p className="text-slate-400 text-sm italic">ターゲット条件が未設定です</p>
                    )}
                  </dl>
                </div>

                {/* Final CTA / Success celebration */}
                {submitSuccess ? (
                  <div className="flex flex-col items-center gap-3 py-4 relative">
                    {/* Confetti rain */}
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={`confetti-${i}`}
                        className="fixed w-3 h-3 rounded-sm z-50 pointer-events-none"
                        style={{
                          backgroundColor: ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899'][i % 6],
                          left: `${5 + (i * 4.7) % 90}%`,
                          top: -20,
                        }}
                        animate={{
                          y: [0, 800],
                          rotate: [0, 360 + Math.random() * 360],
                          opacity: [1, 1, 0],
                        }}
                        transition={{
                          duration: 2 + (i % 3) * 0.5,
                          delay: (i % 5) * 0.1,
                          ease: "easeIn",
                        }}
                      />
                    ))}
                    <motion.img
                      src="/characters/jump_大喜び.png"
                      alt="やったー！"
                      className="w-24 h-24 object-contain"
                      initial={{ scale: 0, rotate: -10 }}
                      animate={{ scale: [0, 1.2, 1], rotate: [-10, 5, 0] }}
                      transition={{ type: "spring", bounce: 0.6 }}
                    />
                    <motion.p
                      className="text-2xl font-black text-blue-600"
                      initial={{ opacity: 0, scale: 0.5, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 0.3, type: "spring", bounce: 0.4 }}
                    >
                      🎉 やったー！リスト作成完了！
                    </motion.p>
                    <motion.p
                      className="text-sm text-slate-500"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                    >
                      リストページに移動します...
                    </motion.p>
                  </div>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-blue-500 text-white text-lg font-bold rounded-full shadow-lg hover:bg-blue-600 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
                        作成中...
                      </>
                    ) : (
                      <>
                        リスト作成を開始
                        <span className="material-symbols-outlined text-2xl">arrow_forward</span>
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              disabled={currentStep === 1}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-0 disabled:cursor-default transition-all rounded-full hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              戻る
            </button>

            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep((s) => Math.min(3, s + 1))}
                disabled={!canProceed()}
                className="inline-flex items-center gap-2 px-8 py-3 bg-blue-500 text-white font-semibold text-sm rounded-full shadow-md hover:bg-blue-600 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                次へ
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-8 py-3 bg-blue-500 text-white font-semibold text-sm rounded-full shadow-md hover:bg-blue-600 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                    作成中...
                  </>
                ) : (
                  <>
                    リスト作成を開始
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
