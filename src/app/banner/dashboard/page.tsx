'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { 
  Sparkles, Loader2, AlertCircle,
  ArrowRight, CheckCircle, Wand2,
  ArrowLeft, LogIn, Download, Clock, Zap, Palette, Layout,
  Upload, X, Image as ImageIcon, User, Building2, Video, Mail, Gift, Megaphone, Target, Calendar
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { GUEST_LIMITS, getGuestUsage, setGuestUsage as saveGuestUsage, getGuestRemainingCount } from '@/lib/pricing'

// カテゴリ（業種）
const CATEGORIES = [
  { value: 'telecom', label: '通信・SIM', icon: '📱', gradient: 'from-blue-500 to-cyan-500' },
  { value: 'marketing', label: 'マーケ', icon: '📊', gradient: 'from-purple-500 to-pink-500' },
  { value: 'ec', label: 'EC・セール', icon: '🛒', gradient: 'from-amber-500 to-orange-500' },
  { value: 'recruit', label: '採用', icon: '👥', gradient: 'from-emerald-500 to-green-500' },
  { value: 'beauty', label: '美容', icon: '💄', gradient: 'from-pink-500 to-rose-500' },
  { value: 'food', label: '飲食', icon: '🍽️', gradient: 'from-red-500 to-orange-500' },
  { value: 'realestate', label: '不動産', icon: '🏠', gradient: 'from-teal-500 to-emerald-500' },
  { value: 'education', label: '教育', icon: '📚', gradient: 'from-indigo-500 to-blue-500' },
  { value: 'finance', label: '金融', icon: '💰', gradient: 'from-yellow-500 to-amber-500' },
  { value: 'health', label: '医療', icon: '🏥', gradient: 'from-cyan-500 to-teal-500' },
  { value: 'it', label: 'IT・SaaS', icon: '💻', gradient: 'from-violet-500 to-purple-500' },
  { value: 'other', label: 'その他', icon: '✨', gradient: 'from-gray-500 to-slate-500' },
]

// 用途（マーケティング施策）
const PURPOSES = [
  { value: 'sns_ad', label: 'SNS広告', icon: Target, desc: 'Facebook/Instagram/X広告', popular: true },
  { value: 'display', label: 'ディスプレイ広告', icon: Layout, desc: 'GDN/YDAバナー', popular: true },
  { value: 'webinar', label: 'ウェビナー告知', icon: Video, desc: 'セミナー・ウェビナー集客', popular: true },
  { value: 'lp_hero', label: 'LPヒーロー', icon: Megaphone, desc: 'ランディングページ用', popular: false },
  { value: 'email', label: 'メルマガ', icon: Mail, desc: 'メールヘッダー画像', popular: false },
  { value: 'campaign', label: 'キャンペーン', icon: Gift, desc: 'セール・キャンペーン告知', popular: false },
  { value: 'event', label: 'イベント', icon: Calendar, desc: '展示会・イベント告知', popular: false },
  { value: 'product', label: '商品紹介', icon: ImageIcon, desc: '商品・サービス紹介', popular: false },
]

// サイズプリセット（用途別に最適化）
const SIZE_PRESETS: Record<string, Array<{ value: string; label: string; desc: string; popular?: boolean }>> = {
  default: [
    { value: '1080x1080', label: 'スクエア', desc: 'Instagram/Facebook', popular: true },
    { value: '1200x628', label: '横長', desc: 'Facebook広告/OGP', popular: true },
    { value: '1080x1920', label: '縦長', desc: 'ストーリーズ/リール', popular: false },
  ],
  sns_ad: [
    { value: '1080x1080', label: 'フィード', desc: 'Instagram/Facebook', popular: true },
    { value: '1200x628', label: 'リンク広告', desc: 'Facebook広告', popular: true },
    { value: '1080x1920', label: 'ストーリーズ', desc: 'Instagram/Facebook', popular: false },
  ],
  display: [
    { value: '300x250', label: 'ミディアムレクタングル', desc: '最も一般的', popular: true },
    { value: '728x90', label: 'リーダーボード', desc: 'ヘッダー・フッター', popular: true },
    { value: '160x600', label: 'ワイドスカイスクレイパー', desc: 'サイドバー', popular: false },
    { value: '320x50', label: 'モバイルバナー', desc: 'スマホ用', popular: false },
  ],
  webinar: [
    { value: '1920x1080', label: 'FHD', desc: 'ウェビナー告知用', popular: true },
    { value: '1200x628', label: 'OGP', desc: 'SNSシェア用', popular: true },
    { value: '1080x1080', label: 'スクエア', desc: 'SNS投稿用', popular: false },
  ],
  lp_hero: [
    { value: '1920x600', label: 'ヒーローワイド', desc: 'PC向けLP', popular: true },
    { value: '1200x800', label: 'ヒーロー標準', desc: '汎用LP', popular: true },
    { value: '750x1334', label: 'スマホファースト', desc: 'モバイルLP', popular: false },
  ],
  email: [
    { value: '600x200', label: 'メールヘッダー', desc: '標準幅', popular: true },
    { value: '600x300', label: 'メールバナー', desc: '目立つサイズ', popular: true },
  ],
  campaign: [
    { value: '1200x628', label: '横長', desc: 'SNS・Web用', popular: true },
    { value: '1080x1080', label: 'スクエア', desc: 'Instagram用', popular: true },
    { value: '800x800', label: 'ポップアップ', desc: 'サイト内告知', popular: false },
  ],
  event: [
    { value: '1920x1080', label: 'FHD', desc: '大型スクリーン', popular: true },
    { value: '1200x628', label: 'OGP', desc: 'SNSシェア用', popular: true },
    { value: 'A4', label: 'A4チラシ', desc: '印刷用（2480x3508）', popular: false },
  ],
  product: [
    { value: '1080x1080', label: 'スクエア', desc: 'EC・SNS用', popular: true },
    { value: '1200x628', label: '横長', desc: '広告用', popular: true },
    { value: '800x1200', label: '縦長', desc: 'Pinterest用', popular: false },
  ],
}

// サンプルデータ（用途別）
const SAMPLE_INPUTS: Record<string, { category: string; keyword: string; companyName?: string }> = {
  sns_ad: { category: 'marketing', keyword: '成果報酬型広告運用 初月無料キャンペーン実施中', companyName: 'マーケAI株式会社' },
  display: { category: 'ec', keyword: '決算セール MAX70%OFF 本日限り！', companyName: 'ECショップ' },
  webinar: { category: 'marketing', keyword: '【無料ウェビナー】AI時代のマーケティング戦略 〜ChatGPT活用術〜', companyName: 'テックカンパニー' },
  lp_hero: { category: 'it', keyword: '業務効率を10倍に。次世代AIツール', companyName: 'SaaS Inc.' },
  email: { category: 'ec', keyword: '会員様限定 ポイント5倍キャンペーン開催中', companyName: 'オンラインストア' },
  campaign: { category: 'telecom', keyword: '乗り換えで最大2万円キャッシュバック 月額990円〜', companyName: 'モバイルキャリア' },
  event: { category: 'it', keyword: 'Tech Summit 2025 〜未来を創るテクノロジー〜', companyName: 'イベント運営会社' },
  product: { category: 'beauty', keyword: '肌に優しいオーガニック美容液 今だけ初回50%OFF', companyName: 'ビューティーブランド' },
}

// 生成ステップ
const GENERATION_STEPS = [
  { id: 1, label: 'プロンプト分析中', icon: Zap, duration: 3 },
  { id: 2, label: 'A案（ベネフィット重視）を生成中', icon: Palette, duration: 8 },
  { id: 3, label: 'B案（緊急性・限定性）を生成中', icon: Palette, duration: 8 },
  { id: 4, label: 'C案（信頼性・実績）を生成中', icon: Palette, duration: 8 },
  { id: 5, label: '仕上げ処理中', icon: Layout, duration: 3 },
]

// 生成中のTips
const GENERATION_TIPS = [
  '💡 A/B/Cの3パターンで最適なバナーを見つけましょう',
  '🎯 ベネフィット訴求は購買意欲を高めます',
  '⚡ 緊急性のあるバナーはCTRが2倍になることも',
  '🏆 実績や数字は信頼感を高めます',
  '✨ プロのデザイナーが作ったような仕上がりに',
  '📊 複数パターンでA/Bテストがおすすめ',
  '🎨 ロゴや人物画像で独自性をアップ',
  '📱 用途に合わせたサイズで最適化',
]

// 画像をBase64に変換
async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 画像ダウンロード関数
async function downloadImage(url: string, filename: string) {
  try {
    if (url.startsWith('data:')) {
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return true
    }
    
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
    return true
  } catch (error) {
    console.error('Download error:', error)
    return false
  }
}


// 画像アップロードコンポーネント
function ImageUploader({ 
  label, 
  icon: Icon, 
  value, 
  onChange, 
  placeholder 
}: { 
  label: string
  icon: any
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 許可されるMIMEタイプを明確に指定
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('JPEG、PNG、GIF、WebP形式の画像を選択してください')
      return
    }

    // ファイル拡張子チェック
    const ext = file.name.split('.').pop()?.toLowerCase()
    const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error('不正なファイル形式です')
      return
    }

    // ファイルサイズ制限（2MBに縮小してパフォーマンス向上）
    if (file.size > 2 * 1024 * 1024) {
      toast.error('2MB以下の画像を選択してください')
      return
    }

    try {
      const base64 = await imageToBase64(file)
      onChange(base64)
      toast.success(`${label}をアップロードしました`)
    } catch (error) {
      toast.error('アップロードに失敗しました')
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {value ? (
        <div className="relative group">
          <img 
            src={value} 
            alt={label}
            className="w-full h-24 object-contain bg-gray-50 rounded-xl border-2 border-gray-200"
          />
          <button
            onClick={() => onChange(null)}
            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-violet-400 hover:bg-violet-50 transition-all"
        >
          <Icon className="w-6 h-6 text-gray-400" />
          <span className="text-xs text-gray-500">{placeholder}</span>
        </button>
      )}
    </div>
  )
}

// 生成中オーバーレイコンポーネント
function GeneratingOverlay({ 
  currentStep, 
  elapsedTime, 
  estimatedTotal 
}: { 
  currentStep: number
  elapsedTime: number
  estimatedTotal: number
}) {
  const [tipIndex, setTipIndex] = useState(0)
  const progress = Math.min((elapsedTime / estimatedTotal) * 100, 95)
  const remainingTime = Math.max(estimatedTotal - elapsedTime, 5)

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % GENERATION_TIPS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-violet-900/95 via-purple-900/95 to-fuchsia-900/95 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {/* メインアニメーション */}
        <div className="text-center mb-8">
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-white/10"></div>
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="60"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${progress * 3.77} 377`}
                className="transition-all duration-500"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center animate-pulse shadow-2xl shadow-violet-500/50">
                <span className="text-4xl">🎨</span>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            AIがバナーを生成中...
          </h2>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-white/90 mb-4">
            <Clock className="w-4 h-4" />
            <span className="font-medium">あと約 {remainingTime} 秒</span>
          </div>
        </div>

        {/* ステップ表示 */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
          <div className="space-y-3">
            {GENERATION_STEPS.map((step, index) => {
              const StepIcon = step.icon
              const isActive = index + 1 === currentStep
              const isCompleted = index + 1 < currentStep
              
              return (
                <div 
                  key={step.id}
                  className={`flex items-center gap-3 transition-all duration-300 ${
                    isActive ? 'opacity-100' : isCompleted ? 'opacity-60' : 'opacity-30'
                  }`}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${isCompleted ? 'bg-emerald-500' : isActive ? 'bg-violet-500 animate-pulse' : 'bg-white/20'}
                  `}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : (
                      <StepIcon className={`w-4 h-4 text-white ${isActive ? 'animate-spin' : ''}`} />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>
                    {step.label}
                    {isActive && <span className="ml-2 animate-pulse">●</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tips */}
        <div className="text-center">
          <div className="inline-block px-6 py-3 bg-white/5 backdrop-blur rounded-xl">
            <p className="text-white/80 text-sm transition-all duration-500">
              {GENERATION_TIPS[tipIndex]}
            </p>
          </div>
        </div>

        {/* 進捗バー */}
        <div className="mt-6">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-white/50 text-xs mt-2">
            {Math.round(progress)}% 完了
          </p>
        </div>
      </div>
    </div>
  )
}

export default function BannerDashboardPage() {
  const { data: session, status } = useSession()
  
  // フォーム状態
  const [purpose, setPurpose] = useState('sns_ad')
  const [category, setCategory] = useState('')
  const [size, setSize] = useState('1080x1080')
  const [keyword, setKeyword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [logoImage, setLogoImage] = useState<string | null>(null)
  const [personImage, setPersonImage] = useState<string | null>(null)
  
  // UI状態
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [generatedBanners, setGeneratedBanners] = useState<string[]>([])
  const [guestUsageCount, setGuestUsageCount] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // 生成進捗状態
  const [currentStep, setCurrentStep] = useState(1)
  const [elapsedTime, setElapsedTime] = useState(0)
  const estimatedTotal = 30

  const isGuest = !session
  const userName = session?.user?.name?.split(' ')[0] || 'ゲスト'

  // 用途に応じたサイズプリセットを取得
  const currentSizePresets = SIZE_PRESETS[purpose] || SIZE_PRESETS.default

  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      const usage = getGuestUsage('banner')
      const today = new Date().toISOString().split('T')[0]
      if (usage.date === today) {
        setGuestUsageCount(usage.count)
      } else {
        setGuestUsageCount(0)
      }
    }
  }, [isGuest])

  // 用途が変更されたらサイズをリセット
  useEffect(() => {
    const presets = SIZE_PRESETS[purpose] || SIZE_PRESETS.default
    setSize(presets[0].value)
  }, [purpose])

  // 生成中のタイマー
  useEffect(() => {
    if (!isGenerating) {
      setElapsedTime(0)
      setCurrentStep(1)
      return
    }

    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isGenerating])

  // ステップ更新
  useEffect(() => {
    if (!isGenerating) return

    const stepTimes = [3, 11, 19, 27, 30]
    const newStep = stepTimes.findIndex(time => elapsedTime < time) + 1
    if (newStep > 0 && newStep !== currentStep) {
      setCurrentStep(newStep)
    }
  }, [elapsedTime, isGenerating, currentStep])

  const guestRemainingCount = GUEST_LIMITS.banner.dailyLimit - guestUsageCount
  const canGuestGenerate = guestRemainingCount > 0
  const canGenerate = category !== '' && keyword.trim() !== '' && (session || canGuestGenerate)

  // サンプル入力
  const handleSampleInput = () => {
    const sample = SAMPLE_INPUTS[purpose] || SAMPLE_INPUTS.sns_ad
    setCategory(sample.category)
    setKeyword(sample.keyword)
    if (sample.companyName) setCompanyName(sample.companyName)
    toast.success('サンプルを入力しました！', { icon: '✨' })
  }

  const handleGenerate = async () => {
    setError('')

    if (!category) {
      setError('業種カテゴリを選択してください')
      return
    }

    if (!keyword.trim()) {
      setError('訴求内容を入力してください')
      return
    }

    if (isGuest && !canGuestGenerate) {
      setError('本日の無料お試しは上限に達しました。ログインでもっと使えます！')
      return
    }

    setIsGenerating(true)
    setElapsedTime(0)
    setCurrentStep(1)

    try {
      const response = await fetch('/api/banner/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          keyword: keyword.trim(),
          size,
          purpose,
          companyName: companyName.trim() || undefined,
          logoImage: logoImage || undefined,
          personImage: personImage || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'バナー生成に失敗しました')
      }

      setGeneratedBanners(data.banners)
      
      if (data.isMock) {
        toast.success('デモ用のサンプルを表示中', { icon: '📋' })
      } else {
        toast.success('バナー生成完了！', { icon: '🎨' })
      }

      if (isGuest) {
        const newCount = guestUsageCount + 1
        setGuestUsageCount(newCount)
        saveGuestUsage('banner', newCount)
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました。')
      toast.error(err.message || 'エラーが発生しました')
    } finally {
      setIsGenerating(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-fuchsia-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">🎨</span>
          </div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Toaster position="top-center" />
      
      {/* 生成中オーバーレイ */}
      {isGenerating && (
        <GeneratingOverlay 
          currentStep={currentStep}
          elapsedTime={elapsedTime}
          estimatedTotal={estimatedTotal}
        />
      )}
      
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm hidden sm:inline">ポータル</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <span className="text-lg">🎨</span>
            </div>
            <span className="font-bold text-gray-800">ドヤバナーAI</span>
          </div>
          
          {session ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                <span className="text-violet-600 text-sm font-bold">{userName[0]}</span>
              </div>
            </div>
          ) : (
            <Link href="/auth/signin?service=banner" className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-full hover:bg-violet-700 transition-colors">
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">ログイン</span>
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* ゲストバナー */}
        {isGuest && !isGenerating && (
          <div className="mb-6 p-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200 rounded-2xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">🆓 お試しモード</p>
                  <p className="text-sm text-gray-600">
                    残り <span className="font-bold text-violet-600">{guestRemainingCount}回</span>（1日{GUEST_LIMITS.banner.dailyLimit}回まで）
                  </p>
                </div>
              </div>
              <Link href="/auth/signin?service=banner">
                <button className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-full transition-colors flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  ログインで無制限に！
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* 生成結果 */}
        {generatedBanners.length > 0 ? (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-4">
                <CheckCircle className="w-4 h-4" />
                生成完了！
              </div>
              <h1 className="text-2xl font-bold text-gray-900">A/B/C 3案できました！</h1>
              <p className="text-gray-500 text-sm mt-1">気に入ったバナーをダウンロードしてご利用ください</p>
            </div>

            <div className="space-y-4 mb-6">
              {generatedBanners.map((url, index) => (
                <div key={index} className="bg-gray-50 rounded-2xl p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm
                        ${index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-orange-500' : 'bg-green-500'}
                      `}>
                        {['A', 'B', 'C'][index]}
                      </span>
                      <span className="font-bold text-gray-700">
                        {['ベネフィット重視', '緊急性・限定性', '信頼性・実績'][index]}
                      </span>
                    </div>
                    <button 
                      onClick={async () => {
                        const success = await downloadImage(url, `banner_${['A', 'B', 'C'][index]}_${Date.now()}.png`)
                        if (success) {
                          toast.success('ダウンロードしました！', { icon: '📥' })
                        } else {
                          toast.error('ダウンロードに失敗しました')
                        }
                      }}
                      className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      ダウンロード
                    </button>
                  </div>
                  <img 
                    src={url} 
                    alt={`Banner ${String.fromCharCode(65 + index)}`} 
                    className="w-full rounded-xl shadow-md"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => setGeneratedBanners([])}
              className="w-full py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-bold rounded-2xl transition-all shadow-lg"
            >
              ✨ 新しいバナーを作成
            </button>
          </div>
        ) : (
          <>
            {/* タイトル */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
                プロ品質のバナーを作ろう！ 🎨
              </h1>
              <p className="text-gray-600">
                用途・業種・訴求内容を入力するだけでA/B/C 3案を自動生成
              </p>
              <p className="text-violet-600 text-sm mt-1 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4" />
                約30秒で完成
              </p>
            </div>

            {/* サンプルボタン */}
            <button
              onClick={handleSampleInput}
              className="w-full mb-6 py-3 px-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:shadow-xl transition-all"
            >
              <Wand2 className="w-5 h-5" />
              ワンボタンでサンプル入力
            </button>

            {/* エラー */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Step 1: 用途を選択 */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">① 用途を選択</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PURPOSES.map((p) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPurpose(p.value)}
                      className={`
                        p-3 rounded-xl text-left transition-all relative
                        ${purpose === p.value 
                          ? 'bg-violet-100 border-2 border-violet-500 text-violet-700' 
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-2 border-transparent'
                        }
                      `}
                    >
                      {p.popular && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                          人気
                        </span>
                      )}
                      <Icon className={`w-5 h-5 mb-1 ${purpose === p.value ? 'text-violet-600' : 'text-gray-400'}`} />
                      <span className="font-bold text-sm block">{p.label}</span>
                      <span className="text-xs text-gray-500">{p.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2: 業種カテゴリ */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">② 業種カテゴリを選択</h2>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`
                      p-2 sm:p-3 rounded-xl text-center transition-all
                      ${category === cat.value 
                        ? `bg-gradient-to-br ${cat.gradient} text-white shadow-lg scale-105` 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }
                    `}
                  >
                    <span className="text-xl sm:text-2xl block mb-1">{cat.icon}</span>
                    <span className="text-[10px] sm:text-xs font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: サイズ */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">③ サイズを選択</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {currentSizePresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setSize(preset.value)}
                    className={`
                      p-3 rounded-xl text-center transition-all relative
                      ${size === preset.value 
                        ? 'bg-violet-100 border-2 border-violet-500 text-violet-700' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-2 border-transparent'
                      }
                    `}
                  >
                    {preset.popular && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                        人気
                      </span>
                    )}
                    <span className="font-bold text-sm block">{preset.label}</span>
                    <span className="text-xs text-gray-500">{preset.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: 訴求内容 */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">④ 訴求内容を入力</h2>
              <textarea
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="例: 月額990円〜 乗り換えで最大2万円キャッシュバック"
                className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all resize-none"
                rows={3}
                maxLength={200}
              />
              <p className="text-right text-xs text-gray-400 mt-1">{keyword.length}/200</p>
            </div>

            {/* 詳細設定（トグル） */}
            <div className="mb-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-violet-600 hover:text-violet-700 font-medium text-sm"
              >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                詳細設定（会社名・ロゴ・人物画像）
              </button>
              
              {showAdvanced && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-4">
                  {/* 会社名 */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Building2 className="w-4 h-4" />
                      会社名・ブランド名（任意）
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="例: 株式会社〇〇"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all"
                      maxLength={50}
                    />
                  </div>

                  {/* ロゴ・人物画像 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <ImageIcon className="w-4 h-4" />
                        ロゴ画像（任意）
                      </label>
                      <ImageUploader
                        label="ロゴ"
                        icon={Building2}
                        value={logoImage}
                        onChange={setLogoImage}
                        placeholder="ロゴをアップロード"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <User className="w-4 h-4" />
                        人物画像（任意）
                      </label>
                      <ImageUploader
                        label="人物"
                        icon={User}
                        value={personImage}
                        onChange={setPersonImage}
                        placeholder="人物をアップロード"
                      />
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    ※ ロゴや人物画像をアップロードすると、バナーに組み込まれます（5MB以下のJPG/PNG）
                  </p>
                </div>
              )}
            </div>

            {/* 生成ボタン */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className={`
                w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3
                ${canGenerate && !isGenerating
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-xl shadow-violet-500/25 hover:shadow-2xl hover:scale-[1.02]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  AIが生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  バナーを生成する（A/B/C 3案）
                </>
              )}
            </button>
          </>
        )}

        {/* 文章作成への誘導 */}
        {generatedBanners.length === 0 && !isGenerating && (
          <Link href="/kantan/dashboard" className="block mt-8">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-5 flex items-center gap-4 hover:shadow-xl transition-all">
              <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">📝</span>
              </div>
              <div className="flex-1">
                <p className="text-white/80 text-sm">文章も作れる！</p>
                <h3 className="text-lg font-bold text-white">カンタンドヤAI</h3>
              </div>
              <ArrowRight className="w-5 h-5 text-white/70" />
            </div>
          </Link>
        )}
      </main>

      {/* フッター */}
      {!isGenerating && (
        <footer className="py-6 px-4 border-t border-gray-100 mt-8">
          <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-700">ドヤAI</Link>
            <div className="flex items-center gap-4">
              <Link href="/banner/dashboard/history" className="hover:text-gray-700">履歴</Link>
              <Link href="/banner/pricing" className="hover:text-gray-700">料金</Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
