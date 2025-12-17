'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, Loader2, ArrowRight, Wand2, LogIn, 
  Download, Clock, Zap, Layout, X, Image as ImageIcon, 
  User, Building2, Video, Mail, Gift, Megaphone, Target,
  ChevronDown, Check, Star, Eye, Copy, 
  Layers, Play, Crown, ArrowUpRight, Palette, BarChart3,
  MessageSquare, Send, RotateCcw, Pencil
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { BANNER_PRICING, getGuestUsage, setGuestUsage } from '@/lib/pricing'
import BannerCoach from '@/components/BannerCoach'

// ========================================
// 定数
// ========================================
const CATEGORIES = [
  { value: 'telecom', label: '通信', icon: '📱', color: '#3B82F6', bg: 'from-blue-500/20 to-cyan-500/20' },
  { value: 'marketing', label: 'マーケ', icon: '📊', color: '#8B5CF6', bg: 'from-violet-500/20 to-purple-500/20' },
  { value: 'ec', label: 'EC', icon: '🛒', color: '#F97316', bg: 'from-orange-500/20 to-amber-500/20' },
  { value: 'recruit', label: '採用', icon: '👥', color: '#22C55E', bg: 'from-green-500/20 to-emerald-500/20' },
  { value: 'beauty', label: '美容', icon: '💄', color: '#EC4899', bg: 'from-pink-500/20 to-rose-500/20' },
  { value: 'food', label: '飲食', icon: '🍽️', color: '#EF4444', bg: 'from-red-500/20 to-orange-500/20' },
  { value: 'realestate', label: '不動産', icon: '🏠', color: '#14B8A6', bg: 'from-teal-500/20 to-cyan-500/20' },
  { value: 'education', label: '教育', icon: '📚', color: '#6366F1', bg: 'from-indigo-500/20 to-blue-500/20' },
  { value: 'finance', label: '金融', icon: '💰', color: '#EAB308', bg: 'from-yellow-500/20 to-amber-500/20' },
  { value: 'health', label: '医療', icon: '🏥', color: '#06B6D4', bg: 'from-cyan-500/20 to-teal-500/20' },
  { value: 'it', label: 'IT', icon: '💻', color: '#A855F7', bg: 'from-purple-500/20 to-violet-500/20' },
  { value: 'other', label: 'その他', icon: '✨', color: '#64748B', bg: 'from-slate-500/20 to-gray-500/20' },
]

const PURPOSES = [
  { value: 'sns_ad', label: 'SNS広告', icon: Target, desc: 'FB/IG/X', hot: true },
  { value: 'youtube', label: 'YouTube', icon: Play, desc: 'サムネイル', hot: true },
  { value: 'display', label: 'ディスプレイ', icon: Layout, desc: 'GDN/YDA', hot: false },
  { value: 'webinar', label: 'ウェビナー', icon: Video, desc: 'セミナー', hot: false },
  { value: 'lp_hero', label: 'LP', icon: Megaphone, desc: 'ヒーロー', hot: false },
  { value: 'email', label: 'メール', icon: Mail, desc: 'ヘッダー', hot: false },
  { value: 'campaign', label: 'セール', icon: Gift, desc: 'キャンペーン', hot: false },
]

const SIZE_PRESETS: Record<string, Array<{ value: string; label: string; ratio: string }>> = {
  default: [
    { value: '1080x1080', label: 'スクエア', ratio: '1:1' },
    { value: '1200x628', label: '横長', ratio: '1.91:1' },
    { value: '1080x1920', label: '縦長', ratio: '9:16' },
  ],
  sns_ad: [
    { value: '1080x1080', label: 'フィード', ratio: '1:1' },
    { value: '1200x628', label: 'リンク', ratio: '1.91:1' },
    { value: '1080x1920', label: 'ストーリー', ratio: '9:16' },
  ],
  youtube: [
    { value: '1280x720', label: 'HD標準', ratio: '16:9' },
    { value: '1920x1080', label: 'フルHD', ratio: '16:9' },
  ],
  display: [
    { value: '300x250', label: 'レクタングル', ratio: '300×250' },
    { value: '728x90', label: 'リーダーボード', ratio: '728×90' },
    { value: '320x50', label: 'モバイル', ratio: '320×50' },
  ],
  webinar: [
    { value: '1920x1080', label: 'FHD', ratio: '16:9' },
    { value: '1200x628', label: 'OGP', ratio: '1.91:1' },
  ],
  lp_hero: [
    { value: '1920x600', label: 'ワイド', ratio: '1920×600' },
    { value: '1200x800', label: '標準', ratio: '3:2' },
  ],
  email: [
    { value: '600x200', label: 'ヘッダー', ratio: '600×200' },
    { value: '600x300', label: 'バナー', ratio: '600×300' },
  ],
  campaign: [
    { value: '1200x628', label: '横長', ratio: '1.91:1' },
    { value: '1080x1080', label: 'スクエア', ratio: '1:1' },
  ],
}

const SAMPLES: Record<string, { category: string; keyword: string; company?: string }> = {
  sns_ad: { category: 'marketing', keyword: '成果報酬型広告運用 初月無料キャンペーン実施中', company: 'マーケAI' },
  youtube: { category: 'it', keyword: '【衝撃】ChatGPT活用術 知らないと損する5つの裏技', company: 'AI解説チャンネル' },
  display: { category: 'ec', keyword: '決算セール MAX70%OFF 本日限り！' },
  webinar: { category: 'it', keyword: '【無料ウェビナー】AI時代のマーケティング完全攻略', company: 'TechCorp' },
  lp_hero: { category: 'it', keyword: '業務効率を10倍に。次世代AIプラットフォーム' },
  email: { category: 'ec', keyword: '会員様限定 ポイント5倍キャンペーン開催中' },
  campaign: { category: 'telecom', keyword: '乗り換えで最大2万円キャッシュバック 月額990円〜' },
}

// A/B/Cパターンの工夫点・特徴
const BANNER_INSIGHTS: Record<string, { 
  type: string
  title: string
  features: string[]
  color: string
  icon: string
}[]> = {
  default: [
    {
      type: 'A',
      title: 'ベネフィット訴求',
      features: [
        'ユーザーメリットを前面に',
        'ポジティブな明るいデザイン',
        '価値提案を強調したコピー',
      ],
      color: 'from-blue-500 to-cyan-500',
      icon: '💡',
    },
    {
      type: 'B',
      title: '緊急性・限定訴求',
      features: [
        '「今だけ」「限定」の訴求',
        '赤・黄のアクセントカラー',
        '行動を促すダイナミックデザイン',
      ],
      color: 'from-amber-500 to-orange-500',
      icon: '⚡',
    },
    {
      type: 'C',
      title: '信頼性・実績訴求',
      features: [
        '「No.1」「〇万人利用」など実績',
        '落ち着いたプロフェッショナルカラー',
        '安心感を与えるレイアウト',
      ],
      color: 'from-emerald-500 to-teal-500',
      icon: '🏆',
    },
  ],
  youtube: [
    {
      type: 'A',
      title: '衝撃・驚きフック',
      features: [
        '「衝撃」「まさか」の好奇心喚起',
        'ドラマチックな表情エリア',
        '赤・黄の強調ハイライト',
      ],
      color: 'from-red-500 to-pink-500',
      icon: '😱',
    },
    {
      type: 'B',
      title: '教育・価値提供',
      features: [
        '「〜の方法」「完全解説」の学び訴求',
        'ナンバリング（3つ、5選）で具体性',
        '青・緑の信頼感カラー',
      ],
      color: 'from-blue-500 to-violet-500',
      icon: '📚',
    },
    {
      type: 'C',
      title: '体験・ストーリー',
      features: [
        '「〜した結果」「密着」の物語性',
        '個人的で共感しやすいテイスト',
        '暖かみのあるカラー',
      ],
      color: 'from-orange-500 to-amber-500',
      icon: '📖',
    },
  ],
}

const GENERATION_PHASES = [
  { label: 'AIが分析中...', icon: '🔍', subtext: 'キーワードとカテゴリを解析' },
  { label: 'デザイン設計中...', icon: '📐', subtext: 'レイアウトを最適化' },
  { label: 'A案を生成中', icon: '🎨', subtext: 'ベネフィット訴求デザイン' },
  { label: 'B案を生成中', icon: '⚡', subtext: '緊急性・限定訴求デザイン' },
  { label: 'C案を生成中', icon: '🏆', subtext: '信頼性・実績訴求デザイン' },
  { label: '最終調整中...', icon: '✨', subtext: 'クオリティチェック' },
]

// 生成中に表示するTips
const GENERATION_TIPS = [
  { icon: '💡', text: 'A/B/Cの3案を比較して、最もパフォーマンスの良いバナーを選びましょう' },
  { icon: '🎯', text: 'CTAボタンの色や文言を変えると、クリック率が大きく変わります' },
  { icon: '📊', text: '同じキーワードでも、訴求タイプによって反応が異なります' },
  { icon: '🔥', text: '緊急性のある文言は、即座のアクションを促します' },
  { icon: '⭐', text: '実績や数字を入れると、信頼性がアップします' },
  { icon: '🎨', text: 'バナーの色は、ターゲット層によって最適なものが変わります' },
  { icon: '📱', text: 'モバイルでの見え方も確認しましょう' },
  { icon: '🚀', text: '生成されたバナーは、さらに修正指示で調整できます' },
]

// 生成中のアニメーション用アイコン
const FLOATING_ICONS = ['🎨', '✨', '🚀', '💫', '🌟', '💎', '🎯', '⚡']

// ========================================
// ヘルパー
// ========================================
async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ========================================
// メインコンポーネント
// ========================================
export default function BannerDashboard() {
  const { data: session } = useSession()
  
  // State
  const [purpose, setPurpose] = useState('sns_ad')
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [size, setSize] = useState('1080x1080')
  const [useCustomSize, setUseCustomSize] = useState(false)
  const [customWidth, setCustomWidth] = useState('1080')
  const [customHeight, setCustomHeight] = useState('1080')
  const [companyName, setCompanyName] = useState('')
  const [logoImage, setLogoImage] = useState<string | null>(null)
  const [personImage, setPersonImage] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showCoach, setShowCoach] = useState(false)
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedBanners, setGeneratedBanners] = useState<string[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [selectedBanner, setSelectedBanner] = useState<number | null>(null)
  
  // 修正機能
  const [refineInstruction, setRefineInstruction] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [showRefineInput, setShowRefineInput] = useState(false)
  const [refineHistory, setRefineHistory] = useState<{ instruction: string; image: string }[]>([])
  
  // テキストオーバーレイ機能
  const [overlayText, setOverlayText] = useState('')
  const [overlayFontSize, setOverlayFontSize] = useState(48)
  const [overlayColor, setOverlayColor] = useState('#FFFFFF')
  const [overlayBgColor, setOverlayBgColor] = useState('#000000')
  const [overlayBgOpacity, setOverlayBgOpacity] = useState(70)
  const [showTextOverlay, setShowTextOverlay] = useState(false)
  
  const [guestUsageCount, setGuestUsageCount] = useState(0)
  
  const isGuest = !session
  const currentSizes = SIZE_PRESETS[purpose] || SIZE_PRESETS.default
  const guestRemaining = BANNER_PRICING.guestLimit - guestUsageCount
  
  // カスタムサイズの場合は入力値を使用
  const effectiveSize = useCustomSize ? `${customWidth}x${customHeight}` : size
  const isValidCustomSize = !useCustomSize || (
    parseInt(customWidth) >= 100 && parseInt(customWidth) <= 4096 &&
    parseInt(customHeight) >= 100 && parseInt(customHeight) <= 4096
  )
  const canGenerate = category && keyword.trim() && (session || guestRemaining > 0) && isValidCustomSize

  // Effects
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      const usage = getGuestUsage('banner')
      const today = new Date().toISOString().split('T')[0]
      setGuestUsageCount(usage.date === today ? usage.count : 0)
    }
  }, [isGuest])

  useEffect(() => {
    const sizes = SIZE_PRESETS[purpose] || SIZE_PRESETS.default
    setSize(sizes[0].value)
  }, [purpose])

  useEffect(() => {
    if (!isGenerating) {
      setProgress(0)
      setPhaseIndex(0)
      return
    }
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100
        const increment = Math.random() * 3 + 1
        return Math.min(prev + increment, 98)
      })
    }, 500)
    return () => clearInterval(interval)
  }, [isGenerating])

  useEffect(() => {
    if (!isGenerating) return
    const phaseInterval = setInterval(() => {
      setPhaseIndex(prev => (prev + 1) % GENERATION_PHASES.length)
    }, 6000)
    return () => clearInterval(phaseInterval)
  }, [isGenerating])

  // Handlers
  const handleSample = () => {
    const sample = SAMPLES[purpose] || SAMPLES.sns_ad
    setCategory(sample.category)
    setKeyword(sample.keyword)
    if (sample.company) setCompanyName(sample.company)
    toast.success('サンプルを入力しました', { icon: '✨' })
  }

  const handleGenerate = async () => {
    if (!canGenerate) return
    
    setError('')
    setIsGenerating(true)
    setGeneratedBanners([])
    setSelectedBanner(null)

    try {
      const response = await fetch('/api/banner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          keyword: keyword.trim(),
          size: effectiveSize,
          purpose,
          companyName: companyName.trim() || undefined,
          logoImage: logoImage || undefined,
          personImage: personImage || undefined,
        }),
      })

      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || '生成に失敗しました')
      
      setProgress(100)
      await new Promise(r => setTimeout(r, 500))
      setGeneratedBanners(data.banners || [])
      
      if (isGuest) {
        const newCount = guestUsageCount + 1
        setGuestUsageCount(newCount)
        setGuestUsage('banner', newCount)
      }
      
      // 部分的にエラーがあった場合は警告表示
      if (data.error) {
        setError(data.error)
        toast.error('一部のバナー生成に失敗しました', { 
          icon: '⚠️',
          duration: 5000,
        })
      } else {
        toast.success('バナーが完成しました！', { icon: '🎉' })
      }
    } catch (err: any) {
      setError(err.message)
      toast.error('生成に失敗しました', { icon: '❌', duration: 5000 })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `doya-banner-${['A', 'B', 'C'][index]}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('ダウンロード開始')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'person') => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('5MB以下の画像を選択してください')
      return
    }
    try {
      const base64 = await imageToBase64(file)
      if (type === 'logo') setLogoImage(base64)
      else setPersonImage(base64)
      toast.success('画像をアップロードしました')
    } catch {
      toast.error('アップロードに失敗しました')
    }
  }

  // 画像修正ハンドラー
  const handleRefine = async () => {
    if (selectedBanner === null || !refineInstruction.trim()) return
    
    const originalImage = generatedBanners[selectedBanner]
    
    setIsRefining(true)
    try {
      const response = await fetch('/api/banner/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImage,
          instruction: refineInstruction.trim(),
          category,
          size,
        }),
      })

      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '修正に失敗しました')
      }

      // 履歴に追加
      setRefineHistory(prev => [...prev, { 
        instruction: refineInstruction, 
        image: originalImage 
      }])
      
      // バナーを更新
      const newBanners = [...generatedBanners]
      newBanners[selectedBanner] = data.refinedImage
      setGeneratedBanners(newBanners)
      
      setRefineInstruction('')
      setShowRefineInput(false)
      toast.success('バナーを修正しました！', { icon: '✨' })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsRefining(false)
    }
  }

  // 修正を元に戻す
  const handleUndoRefine = () => {
    if (selectedBanner === null || refineHistory.length === 0) return
    
    const lastHistory = refineHistory[refineHistory.length - 1]
    const newBanners = [...generatedBanners]
    newBanners[selectedBanner] = lastHistory.image
    setGeneratedBanners(newBanners)
    setRefineHistory(prev => prev.slice(0, -1))
    toast.success('元に戻しました')
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 text-gray-900">
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#1a1a2e',
            color: '#fff',
            borderRadius: '16px',
            padding: '16px 24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
        }}
      />
      
      {/* ========================================
          Header - Ultra Modern Glass Morphism
          ======================================== */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="h-16 sm:h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 sm:gap-4 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-xl">
                  <span className="text-xl sm:text-2xl">🎨</span>
                </div>
              </div>
              <div>
                <h1 className="font-black text-lg sm:text-xl tracking-tight">
                  <span className="bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                    ドヤバナーAI
                  </span>
                </h1>
                <p className="hidden sm:block text-[10px] text-gray-400 font-medium tracking-wider uppercase">Professional Banner Generator</p>
              </div>
            </Link>
            
            <div className="flex items-center gap-3 sm:gap-4">
              {isGuest ? (
                <>
                  <div className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs sm:text-sm font-bold text-amber-700">{guestRemaining}</span>
                    <span className="text-xs text-amber-600 hidden sm:inline">回残り</span>
                  </div>
                  <Link href="/auth/signin?callbackUrl=/banner/dashboard">
                    <button className="group flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all text-xs sm:text-sm shadow-lg shadow-gray-900/20">
                      <LogIn className="w-4 h-4" />
                      <span>ログイン</span>
                      <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    </button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/banner/dashboard/history">
                    <button className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all text-sm">
                      <Clock className="w-4 h-4" />
                      <span className="hidden sm:inline">履歴</span>
                    </button>
                  </Link>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-100 to-fuchsia-100 border border-violet-200/50">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold">
                      {session.user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-semibold text-gray-700 max-w-[80px] truncate hidden sm:block">{session.user?.name?.split(' ')[0]}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================
          Main Content
          ======================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="grid lg:grid-cols-[1fr,440px] gap-6 sm:gap-10">
          
          {/* ========================================
              Left Column - Input Form
              ======================================== */}
          <div className="space-y-6">
            
            {/* Hero Section - Premium Minimal Design */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden"
            >
              {/* Main Card */}
              <div className="relative bg-white rounded-3xl border border-gray-200/60 p-6 sm:p-10 shadow-2xl shadow-violet-500/5">
                {/* Subtle Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.02] via-transparent to-fuchsia-500/[0.02] rounded-3xl" />
                
                {/* Decorative Shapes */}
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-violet-100 to-fuchsia-100 rounded-full blur-3xl opacity-60" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-cyan-100 to-blue-100 rounded-full blur-3xl opacity-40" />
                
                <div className="relative">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/30 mb-6">
                    <Sparkles className="w-4 h-4" />
                    A/B/C 3パターン同時生成
                  </div>
                  
                  {/* Title */}
                  <h1 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight leading-tight">
                    プロ品質バナーを
                    <br />
                    <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                      30秒で自動生成
                    </span>
                  </h1>
                  
                  {/* Subtitle */}
                  <p className="text-gray-500 text-sm sm:text-base max-w-md">
                    カテゴリとキーワードを入力するだけ。AIがプロのデザイナー品質のバナーを3パターン作成します。
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Step 1: Purpose */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/60 p-5 sm:p-6 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-lg shadow-violet-500/30">
                    1
                  </div>
                  <div>
                    <h2 className="font-bold text-base sm:text-lg text-gray-900">用途を選択</h2>
                    <p className="text-xs text-gray-400 hidden sm:block">どこで使うバナーですか？</p>
                  </div>
                </div>
                <button 
                  onClick={handleSample}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-lg transition-colors text-xs font-semibold"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  サンプル
                </button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3">
                {PURPOSES.map((p) => {
                  const Icon = p.icon
                  const isSelected = purpose === p.value
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPurpose(p.value)}
                      className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl text-center transition-all ${
                        isSelected 
                          ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 scale-[1.02]' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:scale-[1.02]'
                      }`}
                    >
                      {p.hot && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full shadow-md flex items-center justify-center">
                          <span className="text-[6px] text-white font-bold">★</span>
                        </span>
                      )}
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 ${isSelected ? 'text-white' : ''}`} />
                      <span className="text-[10px] sm:text-xs font-bold block truncate">{p.label}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>

            {/* Step 2: Category */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/60 p-5 sm:p-6 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-lg shadow-cyan-500/30">
                  2
                </div>
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-gray-900">業種を選択</h2>
                  <p className="text-xs text-gray-400 hidden sm:block">デザインテイストに影響します</p>
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.value
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-center transition-all ${
                        isSelected 
                          ? 'bg-white shadow-lg scale-[1.02] ring-2' 
                          : 'bg-gray-50/50 hover:bg-gray-100 hover:scale-[1.02]'
                      }`}
                      style={{ 
                        ringColor: isSelected ? cat.color : undefined,
                        boxShadow: isSelected ? `0 10px 40px -10px ${cat.color}40` : undefined
                      }}
                    >
                      <span className="text-xl sm:text-2xl block mb-1">{cat.icon}</span>
                      <span className={`text-[10px] sm:text-xs font-bold ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                        {cat.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>

            {/* Step 3: Size */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/60 p-5 sm:p-6 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-500/30">
                  3
                </div>
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-gray-900">サイズを選択</h2>
                  <p className="text-xs text-gray-400 hidden sm:block">用途に合わせた最適サイズ</p>
                </div>
              </div>
              
              {/* プリセット or カスタム 切り替え */}
              <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setUseCustomSize(false)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    !useCustomSize 
                      ? 'bg-white text-gray-900 shadow-md' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  プリセット
                </button>
                <button
                  onClick={() => setUseCustomSize(true)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    useCustomSize 
                      ? 'bg-white text-gray-900 shadow-md' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  カスタム
                </button>
              </div>

              <AnimatePresence mode="wait">
                {useCustomSize ? (
                  <motion.div
                    key="custom"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">幅 (px)</label>
                        <input
                          type="number"
                          value={customWidth}
                          onChange={(e) => setCustomWidth(e.target.value)}
                          min={100}
                          max={4096}
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-center text-lg font-bold focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 outline-none transition-all"
                          placeholder="1080"
                        />
                      </div>
                      <span className="text-gray-300 text-xl mt-5">×</span>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">高さ (px)</label>
                        <input
                          type="number"
                          value={customHeight}
                          onChange={(e) => setCustomHeight(e.target.value)}
                          min={100}
                          max={4096}
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-center text-lg font-bold focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 outline-none transition-all"
                          placeholder="1080"
                        />
                      </div>
                    </div>
                    
                    {/* アスペクト比プレビュー */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2">
                        <div 
                          className="bg-gradient-to-br from-fuchsia-200 to-violet-200 border border-fuchsia-300 rounded"
                          style={{
                            width: `${Math.min(40, 40 * (parseInt(customWidth) || 1) / (parseInt(customHeight) || 1))}px`,
                            height: `${Math.min(40, 40 * (parseInt(customHeight) || 1) / (parseInt(customWidth) || 1))}px`,
                            minWidth: '16px',
                            minHeight: '16px',
                          }}
                        />
                        <span className="text-sm text-gray-600">
                          {customWidth} × {customHeight}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {(() => {
                          const w = parseInt(customWidth) || 1
                          const h = parseInt(customHeight) || 1
                          const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a
                          const g = gcd(w, h)
                          return `${w/g}:${h/g}`
                        })()}
                      </span>
                    </div>
                    
                    {/* よく使うサイズ */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">よく使うサイズ</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { w: 1080, h: 1080, label: 'インスタ' },
                          { w: 1200, h: 628, label: 'OGP' },
                          { w: 1280, h: 720, label: 'YouTube' },
                          { w: 1920, h: 1080, label: 'FHD' },
                          { w: 800, h: 418, label: 'X/Twitter' },
                          { w: 1200, h: 900, label: 'note' },
                        ].map((preset) => (
                          <button
                            key={`${preset.w}x${preset.h}`}
                            onClick={() => {
                              setCustomWidth(preset.w.toString())
                              setCustomHeight(preset.h.toString())
                            }}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 text-xs rounded-md transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {!isValidCustomSize && (
                      <p className="text-red-500 text-xs">
                        サイズは100〜4096pxの範囲で指定してください
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="preset"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-wrap gap-1.5 sm:gap-2"
                  >
                    {currentSizes.map((s) => {
                      const isSelected = size === s.value
                      return (
                        <button
                          key={s.value}
                          onClick={() => setSize(s.value)}
                          className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 ${
                            isSelected 
                              ? 'bg-violet-50 border-2 border-violet-400 text-violet-700 shadow-sm' 
                              : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600" />}
                          <span className="font-medium text-xs sm:text-sm">{s.label}</span>
                          <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">{s.ratio}</span>
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Step 4: Keyword */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/60 p-5 sm:p-6 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-orange-600 to-amber-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-lg shadow-orange-500/30">
                  4
                </div>
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-gray-900">キャッチコピー</h2>
                  <p className="text-xs text-gray-400 hidden sm:block">バナーのメインメッセージ</p>
                </div>
              </div>
              <div className="relative">
                <textarea
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例: 月額990円〜 乗り換えで最大2万円キャッシュバック"
                  className="w-full px-4 sm:px-5 py-4 sm:py-5 bg-gray-50/50 border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:bg-white focus:shadow-lg focus:shadow-violet-500/10 outline-none transition-all resize-none text-sm sm:text-base leading-relaxed"
                  rows={3}
                  maxLength={200}
                />
                <div className="absolute bottom-4 right-4 px-2 py-1 bg-white rounded-md text-xs text-gray-400 font-medium">
                  {keyword.length}/200
                </div>
              </div>
            </motion.div>

            {/* Advanced Options */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm mb-3 font-medium"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                詳細設定（会社名・ロゴ・人物）
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm"
                  >
                    {/* Company Name */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium">
                        <Building2 className="w-4 h-4" />
                        会社名・ブランド名
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="例: 株式会社〇〇"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all"
                      />
                    </div>
                    
                    {/* Image Uploads */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Logo */}
                      <div>
                        <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium">
                          <ImageIcon className="w-4 h-4" />
                          ロゴ
                        </label>
                        <div className="relative">
                          {logoImage ? (
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
                              <img src={logoImage} alt="Logo" className="w-full h-full object-contain p-2" />
                              <button
                                onClick={() => setLogoImage(null)}
                                className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center hover:bg-white shadow-sm"
                              >
                                <X className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 cursor-pointer transition-colors bg-gray-50 hover:bg-violet-50">
                              <Building2 className="w-8 h-8 text-gray-300 mb-2" />
                              <span className="text-xs text-gray-400">アップロード</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'logo')}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                      
                      {/* Person */}
                      <div>
                        <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium">
                          <User className="w-4 h-4" />
                          人物
                        </label>
                        <div className="relative">
                          {personImage ? (
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
                              <img src={personImage} alt="Person" className="w-full h-full object-cover" />
                              <button
                                onClick={() => setPersonImage(null)}
                                className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center hover:bg-white shadow-sm"
                              >
                                <X className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 cursor-pointer transition-colors bg-gray-50 hover:bg-violet-50">
                              <User className="w-8 h-8 text-gray-300 mb-2" />
                              <span className="text-xs text-gray-400">アップロード</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'person')}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Generate Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canGenerate}
                className={`group w-full py-5 sm:py-6 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                  canGenerate && !isGenerating
                    ? 'bg-gray-900 text-white shadow-2xl shadow-gray-900/30 hover:shadow-gray-900/50 hover:scale-[1.01]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="absolute inset-0 bg-gray-900" />
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 transition-all duration-300"
                      style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
                    />
                    <div className="relative flex items-center gap-3">
                      <div className="relative">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                      <span className="text-base sm:text-lg">{GENERATION_PHASES[phaseIndex].icon} {GENERATION_PHASES[phaseIndex].label}</span>
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs sm:text-sm font-bold">{Math.round(progress)}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600/0 via-violet-600/10 to-violet-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
                    <span>バナーを生成する</span>
                    <ArrowRight className="w-5 h-5 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                  </>
                )}
              </button>
              
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl"
                >
                  <p className="text-red-600 text-sm text-center font-medium">{error}</p>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* ========================================
              Right Column - Results & Coach
              ======================================== */}
          <div className="space-y-5 sm:space-y-6">
            
            {/* AI Coach Toggle */}
            <div className="flex gap-2 p-1.5 bg-gray-100 rounded-2xl">
              <button
                onClick={() => setShowCoach(false)}
                className={`flex-1 py-3 sm:py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  !showCoach 
                    ? 'bg-white text-gray-900 shadow-lg' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Layers className="w-4 h-4" />
                生成結果
              </button>
              <button
                onClick={() => setShowCoach(true)}
                className={`flex-1 py-3 sm:py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  showCoach 
                    ? 'bg-white text-gray-900 shadow-lg' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                AIコーチ
              </button>
            </div>

            <AnimatePresence mode="wait">
              {showCoach ? (
                <motion.div
                  key="coach"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <BannerCoach
                    keyword={keyword}
                    category={category}
                    useCase={purpose}
                    onApplyCopy={(copy) => setKeyword(copy)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3 sm:space-y-4"
                >
                  {generatedBanners.length > 0 ? (
                    <>
                      {/* Text Overlay Notice */}
                      <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200/50 rounded-2xl p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <Pencil className="w-4 h-4 text-violet-600" />
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-semibold text-violet-700">ヒント：</span>
                            生成されたバナーにはテキスト用スペースが確保されています。Canvaなどでテキストを追加してください。
                          </div>
                        </div>
                      </div>
                      
                      {/* Banner Grid */}
                      <div className="grid grid-cols-3 gap-3 sm:gap-4">
                        {generatedBanners.map((banner, i) => {
                          const insights = BANNER_INSIGHTS[purpose] || BANNER_INSIGHTS.default
                          const insight = insights[i]
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.1 }}
                              onClick={() => setSelectedBanner(i)}
                              className={`relative aspect-square rounded-lg sm:rounded-xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-shadow ${
                                selectedBanner === i 
                                  ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-white' 
                                  : ''
                              }`}
                            >
                              <img src={banner} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              {/* バッジ：A/B/C + アイコン */}
                              <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/90 backdrop-blur-sm rounded-md sm:rounded-lg shadow-sm">
                                <span className="text-sm sm:text-base">{insight.icon}</span>
                                <span className="text-[10px] sm:text-xs font-bold text-gray-800">{insight.type}案</span>
                              </div>
                              {/* ホバー時：訴求タイプ名 */}
                              <div className="absolute bottom-0 inset-x-0 p-2 sm:p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[10px] sm:text-xs font-medium text-white truncate">
                                  {insight.title}
                                </p>
                              </div>
                              {/* ダウンロードボタン */}
                              <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload(banner, i) }}
                                  className="w-7 h-7 sm:w-8 sm:h-8 bg-white/90 backdrop-blur-sm rounded-md sm:rounded-lg flex items-center justify-center hover:bg-white shadow-sm"
                                >
                                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-700" />
                                </button>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>

                      {/* Selected Banner Preview */}
                      {selectedBanner !== null && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-3 sm:space-y-4"
                        >
                          {/* バナー工夫点カード */}
                          {(() => {
                            const insights = BANNER_INSIGHTS[purpose] || BANNER_INSIGHTS.default
                            const insight = insights[selectedBanner]
                            return (
                              <motion.div
                                key={selectedBanner}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`relative overflow-hidden bg-gradient-to-br ${insight.color} rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg`}
                              >
                                <div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-white/20 rounded-full blur-2xl" />
                                <div className="absolute bottom-0 left-0 w-16 h-16 sm:w-24 sm:h-24 bg-white/20 rounded-full blur-xl" />
                                
                                <div className="relative">
                                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                    <span className="text-xl sm:text-2xl">{insight.icon}</span>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-white/30 rounded text-[10px] sm:text-xs font-bold text-white">
                                          {insight.type}案
                                        </span>
                                        <span className="text-white text-xs sm:text-sm font-medium">
                                          {insight.title}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <h4 className="font-bold text-white text-xs sm:text-sm mb-2">
                                    💡 このバナーの工夫点
                                  </h4>
                                  <ul className="space-y-1.5 sm:space-y-2">
                                    {insight.features.map((feature, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-white text-[11px] sm:text-xs">
                                        <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white flex-shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </motion.div>
                            )
                          })()}
                          
                          {/* 画像プレビュー・操作エリア */}
                          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-3 sm:p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <h3 className="font-bold flex items-center gap-2 text-sm sm:text-base text-gray-900">
                              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                              {['A', 'B', 'C'][selectedBanner]}案 プレビュー
                            </h3>
                            <div className="flex gap-2">
                              {refineHistory.length > 0 && (
                                <button
                                  onClick={handleUndoRefine}
                                  className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-gray-200 hover:text-gray-700 transition-colors"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  戻す
                                </button>
                              )}
                              <button
                                onClick={() => setShowRefineInput(!showRefineInput)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                  showRefineInput 
                                    ? 'bg-fuchsia-100 text-fuchsia-700' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                修正
                              </button>
                              <button
                                onClick={() => handleDownload(generatedBanners[selectedBanner], selectedBanner)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm hover:bg-violet-200 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                DL
                              </button>
                            </div>
                          </div>
                          
                          {/* プレビュー画像 */}
                          <div className="rounded-xl overflow-hidden mb-3 shadow-md">
                            <img 
                              src={generatedBanners[selectedBanner]} 
                              alt="Selected Banner" 
                              className="w-full"
                            />
                          </div>

                          {/* 修正入力フォーム */}
                          <AnimatePresence>
                            {showRefineInput && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="pt-3 border-t border-gray-100">
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare className="w-4 h-4 text-fuchsia-500" />
                                    <span className="text-sm font-medium text-gray-800">AIに修正指示</span>
                                  </div>
                                  <div className="relative">
                                    <textarea
                                      value={refineInstruction}
                                      onChange={(e) => setRefineInstruction(e.target.value)}
                                      placeholder="例: 背景を青に変更して、文字をもっと大きくして"
                                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 outline-none transition-all resize-none text-sm pr-12"
                                      rows={2}
                                      maxLength={200}
                                      disabled={isRefining}
                                    />
                                    <button
                                      onClick={handleRefine}
                                      disabled={isRefining || !refineInstruction.trim()}
                                      className="absolute right-2 bottom-2 w-8 h-8 bg-gradient-to-r from-fuchsia-500 to-violet-500 rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isRefining ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Send className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {[
                                      '背景を変更',
                                      '文字を大きく',
                                      '色を鮮やかに',
                                      'CTAを目立たせて',
                                      'シンプルに',
                                    ].map((suggestion) => (
                                      <button
                                        key={suggestion}
                                        onClick={() => setRefineInstruction(suggestion)}
                                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 text-xs rounded-md transition-colors"
                                      >
                                        {suggestion}
                                      </button>
                                    ))}
                                  </div>
                                  {isRefining && (
                                    <div className="mt-3 flex items-center gap-2 text-fuchsia-600 text-sm">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span>AIが修正中...</span>
                                    </div>
)}
                                  </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          </div>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center mx-auto mb-4">
                        <ImageIcon className="w-10 h-10 text-violet-500" />
                      </div>
                      <h3 className="font-bold text-lg mb-2 text-gray-900">生成結果がここに表示されます</h3>
                      <p className="text-gray-500 text-sm mb-4">
                        カテゴリとキーワードを入力して<br />
                        「バナーを生成する」をクリック
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {['A案', 'B案', 'C案'].map((label) => (
                          <span key={label} className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-500">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ドヤマーケ CV Banner */}
            <a 
              href="https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-16 sm:w-24 h-16 sm:h-24 bg-white/10 rounded-full blur-xl" />
                
                <div className="relative flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xl sm:text-2xl">💬</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                      <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 rounded text-[9px] sm:text-[10px] font-bold">無料相談</span>
                      <span className="text-white/80 text-[10px] sm:text-xs">by ドヤマーケ</span>
                    </div>
                    <h4 className="font-bold text-white text-xs sm:text-sm mb-0.5 truncate">
                      マーケティングのお悩み、いつでも相談OK！
                    </h4>
                    <p className="text-white/70 text-[10px] sm:text-xs hidden xs:block">
                      バナー制作・広告運用・SNS戦略なんでも →
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </a>

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Link href="/kantan/dashboard">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-blue-400 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <span className="text-xl sm:text-2xl">📝</span>
                    <span className="font-bold text-xs sm:text-sm text-gray-800">カンタンドヤAI</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
                    文章も作成する →
                  </p>
                </div>
              </Link>
              <Link href="/banner/pricing">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-amber-400 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                    <span className="font-bold text-xs sm:text-sm text-gray-800">プランを見る</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
                    もっと使いたい方へ →
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================
          Footer
          ======================================== */}
      <footer className="border-t border-gray-100 mt-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <Link href="/" className="hover:text-gray-900 transition-colors">ポータル</Link>
              <Link href="/kantan" className="hover:text-gray-900 transition-colors">カンタンドヤAI</Link>
              <Link href="/terms" className="hover:text-gray-900 transition-colors">利用規約</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition-colors">プライバシー</Link>
            </div>
            <p className="text-xs text-gray-400">
              © 2025 ドヤAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
