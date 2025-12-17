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

const GENERATION_PHASES = [
  { label: 'プロンプト最適化', icon: '🎯' },
  { label: 'A案生成中', icon: '🎨' },
  { label: 'B案生成中', icon: '✨' },
  { label: 'C案生成中', icon: '🚀' },
  { label: '最終調整', icon: '💎' },
]

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
      
      toast.success('バナーが完成しました！', { icon: '🎉' })
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
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
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Toaster position="top-center" />
      
      {/* ========================================
          Header
          ======================================== */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0A0F]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
                  <span className="text-base sm:text-xl">🎨</span>
                </div>
                <div>
                  <span className="font-bold text-sm sm:text-lg bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    ドヤバナーAI
                  </span>
                  <span className="hidden sm:inline text-xs text-white/40 ml-2">by ドヤAI</span>
                </div>
              </Link>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {isGuest ? (
                <>
                  {/* スマホ: 残り回数を小さく表示 */}
                  <div className="flex sm:hidden items-center gap-1 px-2 py-1 rounded-full bg-white/5 text-xs">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="font-bold text-amber-400">{guestRemaining}</span>
                  </div>
                  {/* PC: 残り回数を詳しく表示 */}
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-sm">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-white/60">残り</span>
                    <span className="font-bold text-amber-400">{guestRemaining}</span>
                    <span className="text-white/40">回</span>
                  </div>
                  <Link href="/auth/signin?callbackUrl=/banner/dashboard">
                    <button className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all text-xs sm:text-sm">
                      <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden xs:inline">ログイン</span>
                    </button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/banner/dashboard/history">
                    <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-white/60 hover:text-white transition-colors text-xs sm:text-sm">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">履歴</span>
                    </button>
                  </Link>
                  <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
                    <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400" />
                    <span className="text-xs sm:text-sm font-medium max-w-[60px] sm:max-w-none truncate">{session.user?.name?.split(' ')[0]}</span>
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
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="grid lg:grid-cols-[1fr,400px] gap-4 sm:gap-8">
          
          {/* ========================================
              Left Column - Input Form
              ======================================== */}
          <div className="space-y-6">
            
            {/* Hero Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent border border-white/10 p-6 sm:p-8"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-fuchsia-500/20 rounded-full blur-3xl" />
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm">
                    <Sparkles className="w-4 h-4" />
                    A/B/C 3案同時生成
                  </div>
                  {isGuest && (
                    <div className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs">
                      <Zap className="w-3 h-3" />
                      残り{guestRemaining}回
                    </div>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  プロ品質のバナーを<br />
                  <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    AIが自動生成
                  </span>
                </h1>
                <p className="text-white/50 text-sm sm:text-base">
                  カテゴリとキーワードを入力するだけ。30秒で3案完成。
                </p>
              </div>
            </motion.div>

            {/* Step 1: Purpose */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/[0.02] backdrop-blur rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-5"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="font-bold flex items-center gap-2 text-sm sm:text-base">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-violet-500/20 text-violet-400 text-[10px] sm:text-xs flex items-center justify-center">1</span>
                  用途
                </h2>
                <button 
                  onClick={handleSample}
                  className="text-[10px] sm:text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  <Wand2 className="w-3 h-3" />
                  サンプル
                </button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2">
                {PURPOSES.map((p) => {
                  const Icon = p.icon
                  const isSelected = purpose === p.value
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPurpose(p.value)}
                      className={`relative p-2 sm:p-3 rounded-lg sm:rounded-xl text-center transition-all ${
                        isSelected 
                          ? 'bg-violet-500/20 border-violet-500/50 border-2 text-white' 
                          : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {p.hot && (
                        <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 rounded-full" />
                      )}
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-0.5 sm:mb-1 ${isSelected ? 'text-violet-400' : ''}`} />
                      <span className="text-[10px] sm:text-xs font-medium block truncate">{p.label}</span>
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
              className="bg-white/[0.02] backdrop-blur rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-5"
            >
              <h2 className="font-bold flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base">
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-violet-500/20 text-violet-400 text-[10px] sm:text-xs flex items-center justify-center">2</span>
                業種
              </h2>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 sm:gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.value
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-center transition-all ${
                        isSelected 
                          ? `bg-gradient-to-br ${cat.bg} border-2` 
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                      style={{ borderColor: isSelected ? cat.color : undefined }}
                    >
                      <span className="text-base sm:text-xl block mb-0.5">{cat.icon}</span>
                      <span className={`text-[9px] sm:text-[10px] font-medium ${isSelected ? 'text-white' : 'text-white/60'}`}>
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
              className="bg-white/[0.02] backdrop-blur rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-5"
            >
              <h2 className="font-bold flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base">
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-violet-500/20 text-violet-400 text-[10px] sm:text-xs flex items-center justify-center">3</span>
                サイズ
              </h2>
              
              {/* プリセット or カスタム 切り替え */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setUseCustomSize(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    !useCustomSize 
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/50' 
                      : 'bg-white/5 text-white/50 border border-white/10 hover:text-white'
                  }`}
                >
                  プリセット
                </button>
                <button
                  onClick={() => setUseCustomSize(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    useCustomSize 
                      ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/50' 
                      : 'bg-white/5 text-white/50 border border-white/10 hover:text-white'
                  }`}
                >
                  カスタムサイズ
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
                        <label className="text-xs text-white/40 mb-1 block">幅 (px)</label>
                        <input
                          type="number"
                          value={customWidth}
                          onChange={(e) => setCustomWidth(e.target.value)}
                          min={100}
                          max={4096}
                          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-center text-lg font-bold focus:border-fuchsia-500/50 focus:ring-2 focus:ring-fuchsia-500/20 outline-none transition-all"
                          placeholder="1080"
                        />
                      </div>
                      <span className="text-white/30 text-xl mt-5">×</span>
                      <div className="flex-1">
                        <label className="text-xs text-white/40 mb-1 block">高さ (px)</label>
                        <input
                          type="number"
                          value={customHeight}
                          onChange={(e) => setCustomHeight(e.target.value)}
                          min={100}
                          max={4096}
                          className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-center text-lg font-bold focus:border-fuchsia-500/50 focus:ring-2 focus:ring-fuchsia-500/20 outline-none transition-all"
                          placeholder="1080"
                        />
                      </div>
                    </div>
                    
                    {/* アスペクト比プレビュー */}
                    <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/5">
                      <div className="flex items-center gap-2">
                        <div 
                          className="bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 border border-fuchsia-500/50 rounded"
                          style={{
                            width: `${Math.min(40, 40 * (parseInt(customWidth) || 1) / (parseInt(customHeight) || 1))}px`,
                            height: `${Math.min(40, 40 * (parseInt(customHeight) || 1) / (parseInt(customWidth) || 1))}px`,
                            minWidth: '16px',
                            minHeight: '16px',
                          }}
                        />
                        <span className="text-sm text-white/60">
                          {customWidth} × {customHeight}
                        </span>
                      </div>
                      <span className="text-xs text-white/40">
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
                      <p className="text-xs text-white/30 mb-2">よく使うサイズ</p>
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
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded-md transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {!isValidCustomSize && (
                      <p className="text-red-400 text-xs">
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
                              ? 'bg-violet-500/20 border-2 border-violet-500/50 text-white' 
                              : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400" />}
                          <span className="font-medium text-xs sm:text-sm">{s.label}</span>
                          <span className="text-[10px] sm:text-xs text-white/40 hidden sm:inline">{s.ratio}</span>
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
              className="bg-white/[0.02] backdrop-blur rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-5"
            >
              <h2 className="font-bold flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base">
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-violet-500/20 text-violet-400 text-[10px] sm:text-xs flex items-center justify-center">4</span>
                キャッチコピー
              </h2>
              <div className="relative">
                <textarea
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例: 月額990円〜 乗り換えで最大2万円キャッシュバック"
                  className="w-full px-3 sm:px-4 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white placeholder-white/30 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all resize-none text-sm sm:text-base"
                  rows={3}
                  maxLength={200}
                />
                <div className="absolute bottom-3 right-3 text-xs text-white/30">
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
                className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm mb-3"
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
                    className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-5 space-y-4"
                  >
                    {/* Company Name */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                        <Building2 className="w-4 h-4" />
                        会社名・ブランド名
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="例: 株式会社〇〇"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-violet-500/50 outline-none transition-all"
                      />
                    </div>
                    
                    {/* Image Uploads */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Logo */}
                      <div>
                        <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                          <ImageIcon className="w-4 h-4" />
                          ロゴ
                        </label>
                        <div className="relative">
                          {logoImage ? (
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10">
                              <img src={logoImage} alt="Logo" className="w-full h-full object-contain p-2" />
                              <button
                                onClick={() => setLogoImage(null)}
                                className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/50 cursor-pointer transition-colors bg-white/[0.02]">
                              <Building2 className="w-8 h-8 text-white/20 mb-2" />
                              <span className="text-xs text-white/40">アップロード</span>
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
                        <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                          <User className="w-4 h-4" />
                          人物
                        </label>
                        <div className="relative">
                          {personImage ? (
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10">
                              <img src={personImage} alt="Person" className="w-full h-full object-cover" />
                              <button
                                onClick={() => setPersonImage(null)}
                                className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/50 cursor-pointer transition-colors bg-white/[0.02]">
                              <User className="w-8 h-8 text-white/20 mb-2" />
                              <span className="text-xs text-white/40">アップロード</span>
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
                className={`w-full py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg transition-all flex items-center justify-center gap-2 sm:gap-3 relative overflow-hidden ${
                  canGenerate && !isGenerating
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-2xl shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02]'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600" />
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-fuchsia-600 to-violet-600 transition-all duration-500"
                      style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
                    />
                    <div className="relative flex items-center gap-2 sm:gap-3">
                      <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                      <span className="text-sm sm:text-base">{GENERATION_PHASES[phaseIndex].icon} {GENERATION_PHASES[phaseIndex].label}</span>
                      <span className="text-white/60 text-xs sm:text-sm">{Math.round(progress)}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span>バナーを生成</span>
                    <span className="text-white/60 text-xs sm:text-sm hidden xs:inline">（A/B/C 3案）</span>
                  </>
                )}
              </button>
              
              {error && (
                <p className="mt-2 sm:mt-3 text-red-400 text-xs sm:text-sm text-center">{error}</p>
              )}
            </motion.div>
          </div>

          {/* ========================================
              Right Column - Results & Coach
              ======================================== */}
          <div className="space-y-4 sm:space-y-6">
            
            {/* AI Coach Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCoach(false)}
                className={`flex-1 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                  !showCoach 
                    ? 'bg-violet-500/20 border border-violet-500/50 text-white' 
                    : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                生成結果
              </button>
              <button
                onClick={() => setShowCoach(true)}
                className={`flex-1 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                  showCoach 
                    ? 'bg-violet-500/20 border border-violet-500/50 text-white' 
                    : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                      {/* Banner Grid */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {generatedBanners.map((banner, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => setSelectedBanner(i)}
                            className={`relative aspect-square rounded-lg sm:rounded-xl overflow-hidden cursor-pointer group ${
                              selectedBanner === i 
                                ? 'ring-2 ring-violet-500 ring-offset-1 sm:ring-offset-2 ring-offset-[#0A0A0F]' 
                                : ''
                            }`}
                          >
                            <img src={banner} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded-lg text-xs font-bold">
                              {['A', 'B', 'C'][i]}案
                            </div>
                            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDownload(banner, i) }}
                                className="w-8 h-8 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center hover:bg-white/30"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Selected Banner Preview */}
                      {selectedBanner !== null && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold flex items-center gap-2">
                              <Star className="w-4 h-4 text-amber-400" />
                              {['A', 'B', 'C'][selectedBanner]}案 プレビュー
                            </h3>
                            <div className="flex gap-2">
                              {refineHistory.length > 0 && (
                                <button
                                  onClick={handleUndoRefine}
                                  className="flex items-center gap-1 px-2 py-1.5 bg-white/5 text-white/50 rounded-lg text-xs hover:bg-white/10 hover:text-white transition-colors"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  戻す
                                </button>
                              )}
                              <button
                                onClick={() => setShowRefineInput(!showRefineInput)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                  showRefineInput 
                                    ? 'bg-fuchsia-500/20 text-fuchsia-300' 
                                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                修正
                              </button>
                              <button
                                onClick={() => handleDownload(generatedBanners[selectedBanner], selectedBanner)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 text-violet-300 rounded-lg text-sm hover:bg-violet-500/30 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                DL
                              </button>
                            </div>
                          </div>
                          
                          {/* プレビュー画像 */}
                          <div className="rounded-xl overflow-hidden mb-3">
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
                                <div className="pt-3 border-t border-white/5">
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare className="w-4 h-4 text-fuchsia-400" />
                                    <span className="text-sm font-medium text-white">AIに修正指示</span>
                                  </div>
                                  <div className="relative">
                                    <textarea
                                      value={refineInstruction}
                                      onChange={(e) => setRefineInstruction(e.target.value)}
                                      placeholder="例: 背景を青に変更して、文字をもっと大きくして"
                                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-fuchsia-500/50 focus:ring-2 focus:ring-fuchsia-500/20 outline-none transition-all resize-none text-sm pr-12"
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
                                        className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded-md transition-colors"
                                      >
                                        {suggestion}
                                      </button>
                                    ))}
                                  </div>
                                  {isRefining && (
                                    <div className="mt-3 flex items-center gap-2 text-fuchsia-400 text-sm">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span>AIが修正中...</span>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <div className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-8 text-center">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mx-auto mb-4">
                        <ImageIcon className="w-10 h-10 text-violet-400" />
                      </div>
                      <h3 className="font-bold text-lg mb-2">生成結果がここに表示されます</h3>
                      <p className="text-white/50 text-sm mb-4">
                        カテゴリとキーワードを入力して<br />
                        「バナーを生成する」をクリック
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {['A案', 'B案', 'C案'].map((label) => (
                          <span key={label} className="px-3 py-1 bg-white/5 rounded-full text-xs text-white/40">
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
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-blue-500/40 transition-colors group">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <span className="text-xl sm:text-2xl">📝</span>
                    <span className="font-bold text-xs sm:text-sm">カンタンドヤAI</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-white/50 group-hover:text-white/70 transition-colors">
                    文章も作成する →
                  </p>
                </div>
              </Link>
              <Link href="/banner/pricing">
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-amber-500/40 transition-colors group">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                    <span className="font-bold text-xs sm:text-sm">プランを見る</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-white/50 group-hover:text-white/70 transition-colors">
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
      <footer className="border-t border-white/5 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-white/40">
              <Link href="/" className="hover:text-white transition-colors">ポータル</Link>
              <Link href="/kantan" className="hover:text-white transition-colors">カンタンドヤAI</Link>
              <Link href="/terms" className="hover:text-white transition-colors">利用規約</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">プライバシー</Link>
            </div>
            <p className="text-xs text-white/30">
              © 2025 ドヤAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
