'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Sparkles, Loader2, AlertCircle, Info, ChevronRight, 
  Zap, Target, Palette, Clock, Crown, ArrowRight,
  CheckCircle, Star, TrendingUp, HelpCircle, Wand2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import OnboardingModal from '@/components/OnboardingModal'
import { SAMPLE_INPUTS, getRandomSample, type SampleInput } from '@/lib/sample-inputs'

// サイズプリセット
const SIZE_PRESETS = [
  { value: '1080x1080', label: '1080×1080', desc: 'Instagram / Facebook', icon: '📱', popular: true },
  { value: '1200x628', label: '1200×628', desc: 'Facebook広告 / OGP', icon: '🖼️', popular: true },
  { value: '1080x1920', label: '1080×1920', desc: 'ストーリーズ / リール', icon: '📲', popular: false },
  { value: '300x250', label: '300×250', desc: 'ディスプレイ広告', icon: '🎯', popular: false },
  { value: '728x90', label: '728×90', desc: 'リーダーボード', icon: '📰', popular: false },
  { value: '160x600', label: '160×600', desc: 'スカイスクレイパー', icon: '🗼', popular: false },
]

// カテゴリ（業界調査に基づいた10カテゴリ）
const CATEGORIES = [
  { 
    value: 'telecom', 
    label: '通信向け', 
    icon: '📱', 
    desc: '格安SIM・光回線・WiFi',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    examples: ['格安SIM乗り換え', 'キャッシュバック', '月額割引'],
  },
  { 
    value: 'marketing', 
    label: 'マーケティング', 
    icon: '📊', 
    desc: 'リード獲得・ウェビナー',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    examples: ['ウェビナー集客', '資料ダウンロード', '無料相談'],
  },
  { 
    value: 'ec', 
    label: 'EC向け', 
    icon: '🛒', 
    desc: 'セール・新商品・キャンペーン',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    examples: ['セール告知', '新商品発売', '送料無料'],
  },
  { 
    value: 'recruit', 
    label: '採用向け', 
    icon: '👥', 
    desc: '求人・説明会・インターン',
    color: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    examples: ['エンジニア募集', '新卒採用', '会社説明会'],
  },
  { 
    value: 'beauty', 
    label: '美容・コスメ', 
    icon: '💄', 
    desc: 'スキンケア・化粧品・エステ',
    color: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    examples: ['スキンケア', 'コスメ新作', '限定セット'],
  },
  { 
    value: 'food', 
    label: '飲食・フード', 
    icon: '🍽️', 
    desc: 'レストラン・デリバリー・食品',
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    examples: ['デリバリー', '限定メニュー', 'クーポン'],
  },
  { 
    value: 'education', 
    label: '教育・学習', 
    icon: '📚', 
    desc: 'オンライン講座・塾・資格',
    color: 'from-indigo-500 to-blue-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    examples: ['オンライン講座', '資格取得', '無料体験'],
  },
  { 
    value: 'finance', 
    label: '金融・保険', 
    icon: '💰', 
    desc: '銀行・証券・保険・投資',
    color: 'from-slate-600 to-slate-800',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    examples: ['投資・資産運用', '保険', '無料相談'],
  },
  { 
    value: 'travel', 
    label: '旅行・観光', 
    icon: '✈️', 
    desc: 'ツアー・ホテル・航空券',
    color: 'from-sky-500 to-cyan-500',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    examples: ['ツアー予約', 'ホテル', '早割'],
  },
  { 
    value: 'realestate', 
    label: '不動産', 
    icon: '🏠', 
    desc: '物件・賃貸・売買',
    color: 'from-teal-500 to-green-500',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    examples: ['賃貸物件', '新築マンション', '内見予約'],
  },
]

// 目的
const PURPOSES = [
  { value: 'ctr', label: 'CTR重視', icon: '👆', desc: 'クリック率を最大化', color: 'text-blue-600 bg-blue-50' },
  { value: 'cv', label: 'CV重視', icon: '🎯', desc: 'コンバージョン重視', color: 'text-purple-600 bg-purple-50' },
  { value: 'awareness', label: '認知重視', icon: '👁️', desc: 'ブランド認知向上', color: 'text-amber-600 bg-amber-50' },
]

// トーン
const TONES = [
  { value: 'trust', label: '信頼感', icon: '🏢', color: 'bg-slate-100 text-slate-700' },
  { value: 'friendly', label: '親しみやすさ', icon: '😊', color: 'bg-orange-100 text-orange-700' },
  { value: 'luxury', label: '高級感', icon: '✨', color: 'bg-amber-100 text-amber-700' },
  { value: 'deal', label: 'お得感', icon: '💰', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'urgent', label: '緊急感', icon: '⏰', color: 'bg-red-100 text-red-700' },
]

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // フォーム状態
  const [category, setCategory] = useState('')
  const [size, setSize] = useState('1080x1080')
  const [keyword, setKeyword] = useState('')
  const [purpose, setPurpose] = useState<string>('')
  const [tone, setTone] = useState<string>('')
  
  // UI状態
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [quotaInfo, setQuotaInfo] = useState<{ used: number; limit: number | null } | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // 未認証時はリダイレクト
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/app')
    }
  }, [status, router])

  // 初回訪問時にオンボーディングを表示
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('doya_banner_onboarding_completed')
    if (!hasSeenOnboarding && status === 'authenticated') {
      setShowOnboarding(true)
    }
  }, [status])

  const plan = (session?.user as any)?.plan || 'FREE'
  const isPro = plan === 'PRO'

  // サンプル入力を適用
  const handleSampleInput = () => {
    const sample = getRandomSample()
    setCategory(sample.category)
    setSize(sample.size)
    setKeyword(sample.keyword)
    if (sample.purpose) setPurpose(sample.purpose)
    if (sample.tone) setTone(sample.tone)
    setShowAdvanced(true)
    setError('')
    toast.success(`サンプル「${sample.label}」を入力しました！`, { icon: '✨' })
  }

  // 進行状況を計算
  const progress = [
    category !== '',
    keyword.trim() !== '',
  ].filter(Boolean).length

  const canGenerate = category !== '' && keyword.trim() !== ''

  const handleGenerate = async () => {
    setError('')

    if (!keyword.trim()) {
      setError('キーワード/キャッチコピーを入力してください')
      return
    }

    if (!category) {
      setError('カテゴリを選択してください')
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorySlug: category,
          size,
          keyword: keyword.trim(),
          purpose: purpose || undefined,
          tone: tone || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          setError('本日の生成上限に達しました。明日またお試しいただくか、プロプランにアップグレードしてください。')
          setQuotaInfo(data.quota)
        } else {
          setError(data.error || 'エラーが発生しました')
        }
        return
      }

      if (data.quota) {
        setQuotaInfo(data.quota)
      }

      toast.success('バナー生成を開始しました！', {
        icon: '🎨',
        duration: 3000,
      })
      
      router.push(`/app/result/${data.jobId}`)
    } catch (err) {
      console.error('Generation error:', err)
      setError('エラーが発生しました。しばらくしてからお試しください。')
    } finally {
      setIsGenerating(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg shadow-blue-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 font-medium">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ===== ヘッダー ===== */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                バナーを生成
              </h1>
              <p className="text-gray-600">
                テンプレートを選んでキーワードを入力するだけ。AIがA/B/Cの3案を生成します。
              </p>
            </div>
            {/* サンプル入力ボタン */}
            <button
              onClick={handleSampleInput}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-xl transition-all whitespace-nowrap"
            >
              <Wand2 className="w-4 h-4" />
              サンプルで試す
            </button>
          </div>
          
          {/* モバイル用サンプルボタン */}
          <button
            onClick={handleSampleInput}
            className="sm:hidden w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg mb-4"
          >
            <Wand2 className="w-4 h-4" />
            ワンボタンでサンプルを試す
          </button>

          {/* クォータ & プラン表示 */}
          <div className={cn(
            "rounded-2xl p-4 border-2",
            isPro 
              ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200" 
              : "bg-amber-50 border-amber-200"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isPro ? (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                )}
                <div>
                  <p className={cn("font-bold", isPro ? "text-blue-900" : "text-amber-900")}>
                    {isPro ? '✨ プロプラン' : '無料プラン'}
                  </p>
                  <p className={cn("text-sm", isPro ? "text-blue-700" : "text-amber-700")}>
                    {isPro 
                      ? '無制限に生成できます' 
                      : `本日の残り: ${quotaInfo ? Math.max(0, (quotaInfo.limit || 1) - quotaInfo.used) : '1'}枚`
                    }
                  </p>
                </div>
              </div>
              {!isPro && (
                <a 
                  href="/app/billing" 
                  className="flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                >
                  アップグレード
                  <ChevronRight className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ===== エラー表示 ===== */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">エラーが発生しました</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* ===== 入力フォーム ===== */}
        <div className="space-y-6">
          {/* Step 1: カテゴリ選択 */}
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="step-number">1</div>
              <div>
                <h2 className="font-bold text-gray-900">カテゴリを選択</h2>
                <p className="text-sm text-gray-500">業種・目的に合ったテンプレートを選んでください</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => {
                    setCategory(cat.value)
                    setCurrentStep(2)
                  }}
                  className={cn(
                    "relative p-5 rounded-2xl border-2 text-left transition-all duration-200 group",
                    category === cat.value
                      ? `${cat.bgColor} ${cat.borderColor} ring-2 ring-offset-2 ring-blue-500`
                      : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0",
                      category === cat.value 
                        ? `bg-gradient-to-br ${cat.color} shadow-lg` 
                        : "bg-gray-100"
                    )}>
                      <span className={category === cat.value ? "grayscale-0" : ""}>{cat.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 mb-1">{cat.label}</p>
                      <p className="text-sm text-gray-500 mb-2">{cat.desc}</p>
                      <div className="flex flex-wrap gap-1">
                        {cat.examples.slice(0, 2).map((ex, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                            {ex}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {category === cat.value && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className="w-6 h-6 text-blue-600" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: サイズ選択 */}
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className={category ? "step-number" : "step-number-inactive"}>2</div>
              <div>
                <h2 className="font-bold text-gray-900">サイズを選択</h2>
                <p className="text-sm text-gray-500">広告プラットフォームに合わせたサイズを選んでください</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setSize(preset.value)}
                  className={cn(
                    "relative p-4 rounded-xl border-2 text-center transition-all duration-200",
                    size === preset.value
                      ? "border-blue-500 bg-blue-50 ring-2 ring-offset-2 ring-blue-500"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  )}
                >
                  {preset.popular && (
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                      人気
                    </span>
                  )}
                  <span className="text-2xl block mb-2">{preset.icon}</span>
                  <p className="font-bold text-gray-900 text-sm">{preset.label}</p>
                  <p className="text-xs text-gray-500">{preset.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: キーワード入力 */}
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className={category ? "step-number" : "step-number-inactive"}>3</div>
              <div>
                <h2 className="font-bold text-gray-900">
                  訴求内容を入力
                  <span className="text-red-500 ml-1">*</span>
                </h2>
                <p className="text-sm text-gray-500">キャッチコピーやキーワードを入力してください</p>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setError('')
                }}
                placeholder="例: 乗り換えで月額990円、業界最安"
                className="input-field text-lg py-4 pr-12"
                maxLength={200}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                {keyword.length}/200
              </span>
            </div>

            {/* 例文サジェスト */}
            {category && keyword === '' && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">クリックして入力:</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.find(c => c.value === category)?.examples.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setKeyword(ex)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 詳細オプション（折りたたみ） */}
          <div className="card">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="step-number-inactive">
                  <Palette className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h2 className="font-bold text-gray-900">詳細オプション</h2>
                  <p className="text-sm text-gray-500">目的・トーンを指定（任意）</p>
                </div>
              </div>
              <ChevronRight className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                showAdvanced && "rotate-90"
              )} />
            </button>

            {showAdvanced && (
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-6 animate-fade-in">
                {/* 目的 */}
                <div>
                  <p className="font-medium text-gray-700 mb-3">目的</p>
                  <div className="flex flex-wrap gap-2">
                    {PURPOSES.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPurpose(purpose === p.value ? '' : p.value)}
                        className={cn(
                          "px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                          purpose === p.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        <span className="mr-1">{p.icon}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* トーン */}
                <div>
                  <p className="font-medium text-gray-700 mb-3">トーン</p>
                  <div className="flex flex-wrap gap-2">
                    {TONES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTone(tone === t.value ? '' : t.value)}
                        className={cn(
                          "px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                          tone === t.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        <span className="mr-1">{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 生成ボタン */}
          <div className="pt-4">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className={cn(
                "w-full py-5 rounded-2xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3",
                canGenerate && !isGenerating
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 transform hover:-translate-y-1"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>AIが生成中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  <span>バナーを生成する（A/B/C 3案）</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {!canGenerate && (
              <p className="text-center text-sm text-gray-500 mt-3">
                {!category && !keyword.trim() && 'カテゴリを選択し、キーワードを入力してください'}
                {category && !keyword.trim() && 'キーワードを入力してください'}
                {!category && keyword.trim() && 'カテゴリを選択してください'}
              </p>
            )}
          </div>
        </div>

        {/* ===== Tips ===== */}
        <div className="mt-12 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-blue-900 mb-2">💡 より良いバナーを作るコツ</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>短く刺さる一言</strong>を入力すると効果的です</li>
                <li>• <strong>具体的な数字</strong>（月額990円、30%OFF など）を入れると訴求力UP</li>
                <li>• 目的・トーンを指定すると、より最適化されたバナーが生成されます</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ===== 使い方ガイドリンク ===== */}
        <div className="mt-6 text-center">
          <Link 
            href="/guide"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            詳しい使い方を見る
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}
