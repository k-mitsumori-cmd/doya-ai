'use client'

import { Suspense, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Sparkles, Loader2, Download, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Play, ImageIcon, Maximize2, X, Upload, User, Image as ImageLucide, Square, RectangleHorizontal, RectangleVertical, Crown, Menu, Lock, LogIn, FileText, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'
import DashboardSidebar from '@/components/DashboardSidebar'
import Image from 'next/image'

type BannerTemplate = {
  id: string
  industry: string
  category: string
  prompt: string
  size: string
  imageUrl: string | null
  previewUrl: string | null
  isFeatured?: boolean
  displayTitle?: string // 日本語の短いタイトル
  name?: string // プロンプト名
  isPending?: boolean // 画像未生成（バックグラウンド生成中）
}

type GeneratedBanner = {
  id: string
  imageUrl: string
  prompt: string
  createdAt: Date
}

// サイズプリセット（Gemini APIがネイティブでサポートするアスペクト比）
// Gemini APIは以下のアスペクト比をサポート: 1:1, 3:4, 4:3, 9:16, 16:9
// これらのアスペクト比で生成すると、パディングやクロップなしで正確なサイズが得られます
const SIZE_PRESETS = [
  { id: 'square', label: '正方形', ratio: '1:1', width: 1024, height: 1024, icon: Square },
  { id: 'landscape-4-3', label: '横長 4:3', ratio: '4:3', width: 1024, height: 768, icon: RectangleHorizontal },
  { id: 'portrait-3-4', label: '縦長 3:4', ratio: '3:4', width: 768, height: 1024, icon: RectangleVertical },
  { id: 'landscape-16-9', label: 'ワイド 16:9', ratio: '16:9', width: 1280, height: 720, icon: RectangleHorizontal },
  { id: 'portrait-9-16', label: 'ストーリー 9:16', ratio: '9:16', width: 720, height: 1280, icon: RectangleVertical },
]

// 生成中のローディングメッセージ
const LOADING_MESSAGES = [
  'AIがデザインを分析中...',
  'スタイルを適用中...',
  'レイアウトを調整中...',
  'テキストを配置中...',
  '色彩を最適化中...',
  '最終調整中...',
  'もう少しで完成です...',
]

// プラン別の制約定義
type PlanType = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE'

type PlanConfig = {
  label: string
  maxCountPerGeneration: number // 1回の生成で作れる枚数
  monthlyLimit: number // 月間の生成上限
  imagesPerGenre: number // 各ジャンルで使える画像数（左から何枚目まで）
  allUnlocked: boolean // 全画像解放かどうか
}

const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  GUEST: {
    label: 'ゲスト',
    maxCountPerGeneration: 3,
    monthlyLimit: 3,
    imagesPerGenre: 1, // 各ジャンル左から1枚目のみ
    allUnlocked: false,
  },
  FREE: {
    label: 'ベーシック',
    maxCountPerGeneration: 3,
    monthlyLimit: 15,
    imagesPerGenre: 3, // 各ジャンル左から3枚目まで
    allUnlocked: false,
  },
  PRO: {
    label: 'PROプラン',
    maxCountPerGeneration: 5,
    monthlyLimit: 150,
    imagesPerGenre: Infinity, // 全画像
    allUnlocked: true,
  },
  ENTERPRISE: {
    label: 'Enterpriseプラン',
    maxCountPerGeneration: 5,
    monthlyLimit: 1000,
    imagesPerGenre: Infinity, // 全画像
    allUnlocked: true,
  },
}

// ロック状態の種類
type LockType = 'login' | 'pro' | 'enterprise' | null

// テンプレートIDからPRO専用かどうかを決定論的に判定（全体の約50%がPRO専用）
// ハッシュベースなので並び順に依存せず、常に同じ結果になる
const isProOnlyTemplate = (templateId: string): boolean => {
  let hash = 0
  for (let i = 0; i < templateId.length; i++) {
    hash = ((hash << 5) - hash) + templateId.charCodeAt(i)
    hash |= 0
  }
  return (Math.abs(hash) % 2) === 0
}

// 後方互換性のためのPLAN_LIMITS
const PLAN_LIMITS = {
  FREE: { maxCount: 3, label: '無料プラン' },
  PRO: { maxCount: 5, label: 'PROプラン' },
  ENTERPRISE: { maxCount: 5, label: 'Enterpriseプラン' },
}

// ページ内Suspense用のスケルトン（loading.tsxと同じ構造）
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white flex">
      <div className="hidden md:block w-[240px] bg-gray-950 border-r border-gray-800/50 flex-shrink-0">
        <div className="p-4 space-y-4">
          <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 bg-gray-800/60 rounded-lg animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      </div>
      <main className="flex-1 min-h-screen bg-black overflow-hidden">
        <div className="relative h-[32vh] sm:h-[40vh] md:h-[50vh] lg:h-[55vh] bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-800/30 to-transparent animate-[shimmer_2s_infinite]" style={{ backgroundSize: '200% 100%' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent z-10" />
          <div className="absolute bottom-6 left-4 sm:left-8 z-20 space-y-3">
            <div className="h-4 w-20 bg-gray-700/60 rounded animate-pulse" />
            <div className="h-8 sm:h-10 w-48 sm:w-72 bg-gray-700/40 rounded animate-pulse" />
            <div className="h-4 w-64 sm:w-96 bg-gray-700/30 rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-black/90 border-b border-gray-800/50 px-2 sm:px-4 md:px-8 lg:px-12 py-2 flex gap-1">
          {[80, 64, 56, 72, 64, 48].map((w, i) => (
            <div key={i} className="h-7 rounded-full bg-gray-800/60 animate-pulse flex-shrink-0" style={{ width: `${w}px`, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <div className="px-1 sm:px-2 md:px-4 lg:px-8 py-2">
          {[1, 2].map((section) => (
            <div key={section} className="mb-3">
              <div className="flex items-center gap-1.5 px-1 sm:px-2 py-1.5">
                <div className="w-2 h-2 bg-blue-400/40 rounded-sm animate-pulse" />
                <div className="h-3.5 w-24 bg-gray-700/40 rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="aspect-[16/10] rounded bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/20 to-transparent animate-[shimmer_2s_infinite]" style={{ backgroundSize: '200% 100%', animationDelay: `${(section * 4 + i) * 100}ms` }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default function BannerTestPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <BannerTestPageInner />
    </Suspense>
  )
}

function BannerTestPageInner() {
  const { data: session } = useSession()
  const [templates, setTemplates] = useState<BannerTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<BannerTemplate | null>(null)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedBanners, setGeneratedBanners] = useState<GeneratedBanner[]>([])
  const [selectedBanner, setSelectedBanner] = useState<GeneratedBanner | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // 画像拡大モーダル用の状態
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null)

  // フォーム状態（拡張版）
  const [serviceName, setServiceName] = useState('')
  const [tone, setTone] = useState('')
  const [customText, setCustomText] = useState('')
  
  // 新しいフォーム状態
  const [selectedSize, setSelectedSize] = useState(SIZE_PRESETS[0]) // デフォルト: 正方形（大）(1024x1024)
  const [customWidth, setCustomWidth] = useState(1024)
  const [customHeight, setCustomHeight] = useState(1024)
  const [generateCount, setGenerateCount] = useState(3)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [personFile, setPersonFile] = useState<File | null>(null)
  const [personPreview, setPersonPreview] = useState<string | null>(null)
  
  // カラー指定
  const [mainColor, setMainColor] = useState('')
  const [subColor, setSubColor] = useState('')
  
  // カスタムプロンプト（エンタープライズ限定）
  const [customPrompt, setCustomPrompt] = useState('')
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  
  // 画像修正モーダル（エンタープライズ限定）
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingBanner, setEditingBanner] = useState<GeneratedBanner | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  
  // プロンプト閲覧モーダル（エンタープライズ限定）
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [viewingPromptBanner, setViewingPromptBanner] = useState<GeneratedBanner | null>(null)
  
  // 生成中のローディング状態
  const [loadingMessage, setLoadingMessage] = useState('')
  const [generationProgress, setGenerationProgress] = useState(0)
  
  // 生成モーダル状態
  const [showGenerationModal, setShowGenerationModal] = useState(false)
  const [generationComplete, setGenerationComplete] = useState(false)
  
  // ロックモーダル状態
  const [showLockModal, setShowLockModal] = useState(false)
  const [lockModalType, setLockModalType] = useState<LockType>(null)
  const [lockedTemplate, setLockedTemplate] = useState<BannerTemplate | null>(null)
  
  // 選択中のテンプレートのロック状態
  const [selectedTemplateLockType, setSelectedTemplateLockType] = useState<LockType>(null)
  
  // 今日の生成数（ローカルストレージから取得）
  const [monthlyGenerationCount, setMonthlyGenerationCount] = useState(0)
  
  // トライアル状態（ログイン後1時間は全機能解放）
  const [isTrialActive, setIsTrialActive] = useState(false)
  const [trialRemainingMinutes, setTrialRemainingMinutes] = useState(0)
  
  // フォームエリアの可視性（ヒーローセクションの縮小制御用）
  const [isFormVisible, setIsFormVisible] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  // ヒーロー画像の縮小状態（デフォルト: 閉じてギャラリー全体表示）
  const [isHeroCollapsed, setIsHeroCollapsed] = useState(true)

  // ギャラリーのジャンルフィルタ
  const [activeFilter, setActiveFilter] = useState<string>('すべて')

  // ローディング画面用
  const [loadingTipIndex, setLoadingTipIndex] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)

  const LOADING_TIPS = useMemo(() => [
    { emoji: '🎨', text: 'プロデザイナー品質のテンプレートを準備中...' },
    { emoji: '✨', text: 'テンプレートは定期的に新作が追加されます' },
    { emoji: '🚀', text: 'AIが30秒でバナーを自動生成します' },
    { emoji: '📐', text: '正方形・横長・縦長・ストーリーなど5サイズ対応' },
    { emoji: '🎯', text: '12ジャンルのテンプレートから好みのスタイルを選択' },
    { emoji: '💡', text: 'テンプレートを選んでテキストを入力するだけでOK' },
    { emoji: '🔄', text: '気に入らなければワンクリックで再生成できます' },
  ], [])

  // ローディングTIPSのローテーション & プログレスバー
  useEffect(() => {
    if (!isLoadingTemplates) return
    const tipTimer = setInterval(() => {
      setLoadingTipIndex((prev) => (prev + 1) % 7)
    }, 2500)
    const progressTimer = setInterval(() => {
      setLoadingProgress((prev) => prev >= 90 ? prev : prev + Math.random() * 8 + 2)
    }, 400)
    return () => { clearInterval(tipTimer); clearInterval(progressTimer) }
  }, [isLoadingTemplates])

  useEffect(() => {
    if (!isLoadingTemplates) setLoadingProgress(100)
  }, [isLoadingTemplates])

  // トライアル判定（ログイン後1時間）
  useEffect(() => {
    if (!session?.user) {
      setIsTrialActive(false)
      setTrialRemainingMinutes(0)
      return
    }
    
    const TRIAL_DURATION_MS = 60 * 60 * 1000 // 1時間
    const TRIAL_STORAGE_KEY = 'bannerTrialStartTime'
    
    // トライアル開始時刻を取得または設定
    let trialStartTime: number
    const stored = localStorage.getItem(TRIAL_STORAGE_KEY)
    const userId = (session.user as any)?.id || session.user?.email || 'unknown'
    
    if (stored) {
      try {
        const data = JSON.parse(stored)
        // 同じユーザーのトライアル情報か確認
        if (data.userId === userId) {
          trialStartTime = data.startTime
        } else {
          // 別ユーザーの場合は新規トライアル開始
          trialStartTime = Date.now()
          localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ userId, startTime: trialStartTime }))
        }
      } catch {
        trialStartTime = Date.now()
        localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ userId, startTime: trialStartTime }))
      }
    } else {
      // 初回ログイン：トライアル開始
      trialStartTime = Date.now()
      localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ userId, startTime: trialStartTime }))
    }
    
    // トライアル残り時間を計算
    const updateTrialStatus = () => {
      const elapsed = Date.now() - trialStartTime
      const remaining = TRIAL_DURATION_MS - elapsed
      
      if (remaining > 0) {
        setIsTrialActive(true)
        setTrialRemainingMinutes(Math.ceil(remaining / 60000))
      } else {
        setIsTrialActive(false)
        setTrialRemainingMinutes(0)
      }
    }
    
    updateTrialStatus()
    
    // 1分ごとに更新
    const interval = setInterval(updateTrialStatus, 60000)
    
    return () => clearInterval(interval)
  }, [session])
  
  // フォームエリアの可視性を検知（ヒーローセクションの縮小制御用）
  useEffect(() => {
    if (!formRef.current) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // フォームが画面に入ってきたらヒーローを縮小
          setIsFormVisible(entry.isIntersecting)
        })
      },
      {
        // フォームの上端が画面の60%の位置に来たら発火
        rootMargin: '-40% 0px -40% 0px',
        threshold: 0,
      }
    )
    
    observer.observe(formRef.current)
    
    return () => observer.disconnect()
  }, [selectedTemplate, selectedBanner])
  
  // ユーザープラン（GUEST / FREE / PRO / ENTERPRISE）
  // トライアル中はENTERPRISEとして扱う
  const currentPlan = useMemo((): PlanType => {
    if (!session?.user) return 'GUEST'
    
    // トライアル中は全機能解放（ENTERPRISE扱い）
    if (isTrialActive) return 'ENTERPRISE'
    
    const user = session.user as any
    const plan = user?.bannerPlan || user?.plan || 'FREE'
    const upperPlan = String(plan).toUpperCase()
    if (upperPlan === 'PRO') return 'PRO'
    if (upperPlan === 'ENTERPRISE') return 'ENTERPRISE'
    return 'FREE'
  }, [session, isTrialActive])
  
  const planConfig = useMemo(() => PLAN_CONFIG[currentPlan], [currentPlan])
  
  // 後方互換性のためのuserPlan
  const userPlan = useMemo(() => {
    if (currentPlan === 'GUEST') return 'FREE'
    return currentPlan as 'FREE' | 'PRO' | 'ENTERPRISE'
  }, [currentPlan])
  
  const planLimits = useMemo(() => PLAN_LIMITS[userPlan] || PLAN_LIMITS.FREE, [userPlan])
  
  // 今月の生成数をローカルストレージから読み込み
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const stored = localStorage.getItem('bannerGenerationCount')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        // 月次比較（旧YYYY-MM-DD形式にも対応：先頭7文字で比較）
        if (data.date && data.date.slice(0, 7) === currentMonth) {
          setMonthlyGenerationCount(data.count || 0)
        } else {
          // 月が変わったらリセット
          localStorage.setItem('bannerGenerationCount', JSON.stringify({ date: currentMonth, count: 0 }))
          setMonthlyGenerationCount(0)
        }
      } catch {
        setMonthlyGenerationCount(0)
      }
    }
  }, [])
  
  // 画像のロック状態を判定する関数
  // テンプレートIDのハッシュで50%をログイン解放、50%をPRO解放に割り振り
  const getImageLockType = useCallback((template: BannerTemplate, indexInGenre: number): LockType => {
    // PRO以上は全解放
    if (planConfig.allUnlocked) return null

    const proOnly = isProOnlyTemplate(template.id)

    if (currentPlan === 'GUEST') {
      // ゲスト: すべてロック（PRO専用→PRO表示、それ以外→ログイン表示）
      return proOnly ? 'pro' : 'login'
    }

    if (currentPlan === 'FREE') {
      // ログイン済み: PRO専用テンプレートのみロック（約50%が使える）
      return proOnly ? 'pro' : null
    }

    return null
  }, [currentPlan, planConfig])
  
  // ロック画像クリック時のハンドラ
  // ヒーローセクションにも画像を表示し、ロック状態を明示
  const handleLockedImageClick = useCallback((template: BannerTemplate, lockType: LockType) => {
    // ヒーローセクションに画像を表示（ロック状態でも）
    setSelectedTemplate(template)
    setSelectedBanner(null)
    // ヒーローセクションにロック状態を表示
    setSelectedTemplateLockType(lockType)
    // ロックモーダルを表示
    setLockedTemplate(template)
    setLockModalType(lockType)
    setShowLockModal(true)
  }, [])
  
  // 月間の生成上限チェック
  const isOverMonthlyLimit = useMemo(() => {
    return monthlyGenerationCount >= planConfig.monthlyLimit
  }, [monthlyGenerationCount, planConfig.monthlyLimit])
  
  // 生成数を更新する関数（月間）
  const incrementGenerationCount = useCallback((count: number) => {
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
    const newCount = monthlyGenerationCount + count
    setMonthlyGenerationCount(newCount)
    localStorage.setItem('bannerGenerationCount', JSON.stringify({ date: currentMonth, count: newCount }))
  }, [monthlyGenerationCount])
  
  // ファイルアップロードハンドラ
  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }, [])
  
  const handlePersonUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPersonFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setPersonPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }, [])

  const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [visibleImages, setVisibleImages] = useState<Set<string>>(new Set()) // ビューポート内の画像
  const imageObserverRef = useRef<IntersectionObserver | null>(null)
  
  // スクロール位置の状態（左右矢印の表示制御用）
  const [scrollPositions, setScrollPositions] = useState<{ [key: string]: { canScrollLeft: boolean; canScrollRight: boolean } }>({})
  
  // タッチスワイプ用の状態
  const touchStartX = useRef<{ [key: string]: number }>({})
  const touchCurrentX = useRef<{ [key: string]: number }>({})
  const isDragging = useRef<{ [key: string]: boolean }>({})
  
  // 各カテゴリごとの表示数を管理（初期は4枚、スクロール時に追加）
  const [visibleCounts, setVisibleCounts] = useState<{ [key: string]: number }>({})
  const INITIAL_VISIBLE_COUNT = 5 // 初期表示数（1列5枚）
  const LOAD_MORE_COUNT = 8 // 追加読み込み数

  // 画像リトライ管理（最大3回リトライ）
  const imageRetryRef = useRef<{ [key: string]: number }>({})
  const MAX_IMAGE_RETRY = 3
  const CACHE_KEY = 'banner_templates_cache_v6'

  // キャッシュから失敗テンプレートを除外するヘルパー
  const removeFromCache = useCallback((failedId: string) => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return
      const parsed = JSON.parse(cached)
      if (!parsed.data?.templates) return
      parsed.data.templates = parsed.data.templates.filter(
        (t: BannerTemplate) => t.id !== failedId
      )
      // featuredTemplateIdが除外されたテンプレートなら更新
      if (parsed.data.featuredTemplateId === failedId) {
        parsed.data.featuredTemplateId = parsed.data.templates[0]?.id || null
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(parsed))
    } catch (e) {
      // キャッシュ更新失敗は無視
    }
  }, [])

  // 画像読み込み完了ハンドラ
  const handleImageLoad = useCallback((id: string) => {
    setLoadedImages(prev => new Set(prev).add(id))
    // 成功したらリトライカウントをリセット
    delete imageRetryRef.current[id]
  }, [])

  // 画像エラーハンドラ（自動リトライ付き）
  const handleImageError = useCallback((id: string) => {
    const retryCount = imageRetryRef.current[id] || 0
    if (retryCount < MAX_IMAGE_RETRY) {
      imageRetryRef.current[id] = retryCount + 1
      // 段階的に待機時間を増やしてリトライ（1秒、2秒、3秒）
      setTimeout(() => {
        setImageErrors(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        setLoadedImages(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, (retryCount + 1) * 1000)
    } else {
      // 最終失敗 → キャッシュからも除外（次回訪問時に表示されなくなる）
      removeFromCache(id)
    }
    setImageErrors(prev => new Set(prev).add(id))
  }, [removeFromCache])

  // IntersectionObserverで画像の遅延読み込みを管理
  useEffect(() => {
    // 既存のオブザーバーをクリーンアップ
    if (imageObserverRef.current) {
      imageObserverRef.current.disconnect()
    }

    // 新しいオブザーバーを作成
    imageObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-template-id')
          if (id && entry.isIntersecting) {
            setVisibleImages(prev => new Set(prev).add(id))
          }
        })
      },
      {
        rootMargin: '300px', // 300px手前から読み込み開始（事前ロード範囲を広げてスムーズに）
        threshold: 0.01,
      }
    )
    
    return () => {
      if (imageObserverRef.current) {
        imageObserverRef.current.disconnect()
      }
    }
  }, [])
  
  // 画像要素をオブザーバーに登録するコールバック
  const observeImage = useCallback((element: HTMLDivElement | null, id: string) => {
    if (element && imageObserverRef.current) {
      element.setAttribute('data-template-id', id)
      imageObserverRef.current.observe(element)
    }
  }, [])

  // カテゴリマッピング（要求に合わせて明確化）
  const categoryMapping: { [key: string]: string } = {
    // 旧プロンプトの industry 値
    'ビジネス / ブランディング': 'ビジネス',
    'UX / デザイン / テクノロジー': 'IT・テクノロジー',
    'Web / IT / スクール / 教育': 'IT・テクノロジー',
    '人物写真 / ポートレート': '採用',
    '季節感 / イベント': 'イベント',
    'セール / キャンペーン': 'イベント',
    'EC・小売業のデジタルマーケティング戦略': 'EC',
    'カジュアル / 親しみやすい': 'EC',
    'にぎやか / ポップ': 'EC',
    '高級感 / きれいめ': '美容・ファッション',
    'かわいい / ポップ': '美容・ファッション',
    'ナチュラル / 爽やか': '美容・ファッション',
    // 実際のDB industry 値
    'ビジネス・SaaS': 'ビジネス',
    'business': 'ビジネス',
    'marketing': 'ビジネス',
    'IT・テクノロジー': 'IT・テクノロジー',
    'it': 'IT・テクノロジー',
    '転職・採用・人材': '採用',
    'イベント・メディア': 'イベント',
    '食品': '食品・飲料',
    '飲料': '食品・飲料',
    '美容・コスメ': '美容・ファッション',
    'ファッション・アパレル': '美容・ファッション',
    '住宅・不動産': '不動産・旅行',
    '旅行・観光': '不動産・旅行',
    '教育・学習・セミナー': '教育',
    '医療・ヘルスケア': '医療・金融',
    '金融・保険': '医療・金融',
    'EC・セール': 'EC',
    // 新ジャンル（thumbnail-gallery.net参考）
    'スポーツ・フィットネス': 'スポーツ・趣味',
    'エンタメ・趣味': 'スポーツ・趣味',
    'ペット・動物': 'ライフスタイル',
    'ライフスタイル・暮らし': 'ライフスタイル',
  }

  // ヒーロー画像のプリロード（テンプレートURL確定直後に呼び出し、ブラウザが先行取得開始）
  const preloadHeroImage = useCallback((imageUrl: string | null | undefined) => {
    try {
      if (!imageUrl) return
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = imageUrl
      link.setAttribute('fetchpriority', 'high')
      document.head.appendChild(link)
    } catch (e) {
      // プリロード失敗してもテンプレート読み込みを止めない
    }
  }, [])

  // テンプレートを取得（高速化: 最小限のデータを最初に取得）
  useEffect(() => {
    const CACHE_EXPIRY = 30 * 60 * 1000 // 30分間キャッシュ
    
    const fetchTemplates = async () => {
      const startTime = Date.now()
      
      try {
        // クライアント側キャッシュをチェック
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached)
            const now = Date.now()
            
            // キャッシュが有効で、promptフィールドが含まれている場合のみ使用
            const hasPrompts = data.templates?.[0]?.prompt && data.templates[0].prompt.length > 50
            if (now - timestamp < CACHE_EXPIRY && data.templates && Array.isArray(data.templates) && hasPrompts) {
              setTemplates(data.templates)
              
              // 各カテゴリの初期表示数を設定
              const initialCounts: { [key: string]: number } = {}
              data.templates.forEach((template: BannerTemplate) => {
                const category = categoryMapping[template.industry] || template.industry
                if (!initialCounts[category]) {
                  initialCounts[category] = INITIAL_VISIBLE_COUNT
                }
              })
              setVisibleCounts(initialCounts)
              
              if (data.featuredTemplateId) {
                const featured = data.templates.find((t: BannerTemplate) => t.id === data.featuredTemplateId)
                if (featured) {
                  setSelectedTemplate(featured)
                  preloadHeroImage(featured.imageUrl)
                } else if (data.templates.length > 0) {
                  setSelectedTemplate(data.templates[0])
                  preloadHeroImage(data.templates[0].imageUrl)
                }
              } else if (data.templates.length > 0) {
                setSelectedTemplate(data.templates[0])
                preloadHeroImage(data.templates[0].imageUrl)
              }

              setIsLoadingTemplates(false)
              console.log(`[Templates] Loaded from cache in ${Date.now() - startTime}ms`)
              return
            }
          } catch (e) {
            // キャッシュが壊れている場合は無視
            localStorage.removeItem(CACHE_KEY)
          }
        }
        
        // APIから取得（DBエラー時はリトライ）
        const MAX_RETRIES = 3
        let lastError: any = null

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const res = await fetch('/api/banner/test/templates?limit=200')

            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}))
              // DBエラー（503）の場合はリトライ
              if (errorData.dbError && attempt < MAX_RETRIES - 1) {
                console.warn(`[Templates] DB error on attempt ${attempt + 1}, retrying...`)
                await new Promise(r => setTimeout(r, (attempt + 1) * 500))
                continue
              }
              throw new Error(errorData.error || `HTTP error! status: ${res.status}`)
            }

            const data = await res.json()

            if (data.templates && Array.isArray(data.templates) && data.templates.length > 0) {
              setTemplates(data.templates)

              const initialCounts: { [key: string]: number } = {}
              data.templates.forEach((template: BannerTemplate) => {
                const category = categoryMapping[template.industry] || template.industry
                if (!initialCounts[category]) {
                  initialCounts[category] = INITIAL_VISIBLE_COUNT
                }
              })
              setVisibleCounts(initialCounts)

              try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                  data,
                  timestamp: Date.now(),
                }))
              } catch (e) {
                // localStorageが満杯の場合は無視
              }

              if (data.featuredTemplateId) {
                const featured = data.templates.find((t: BannerTemplate) => t.id === data.featuredTemplateId)
                if (featured) {
                  setSelectedTemplate(featured)
                  preloadHeroImage(featured.imageUrl)
                } else if (data.templates.length > 0) {
                  setSelectedTemplate(data.templates[0])
                  preloadHeroImage(data.templates[0].imageUrl)
                }
              } else if (data.templates.length > 0) {
                setSelectedTemplate(data.templates[0])
                preloadHeroImage(data.templates[0].imageUrl)
              }

              console.log(`[Templates] Loaded ${data.templates.length} templates (pending: ${data.pendingCount ?? 0}) in ${Date.now() - startTime}ms`)
              break // 成功したらループを抜ける
            } else {
              console.warn('[Templates] Empty templates array received')
              if (attempt < MAX_RETRIES - 1) {
                await new Promise(r => setTimeout(r, (attempt + 1) * 500))
                continue
              }
              toast.error('テンプレートが見つかりませんでした')
            }
          } catch (fetchErr: any) {
            lastError = fetchErr
            if (attempt < MAX_RETRIES - 1) {
              console.warn(`[Templates] Fetch error on attempt ${attempt + 1}, retrying...`)
              await new Promise(r => setTimeout(r, (attempt + 1) * 500))
              continue
            }
          }
        }

        if (lastError && templates.length === 0) {
          console.error('Failed to fetch templates after retries:', lastError)
          toast.error('テンプレートの取得に失敗しました。ページを再読み込みしてください。')
        }
      } catch (err: any) {
        console.error('Failed to fetch templates:', err)
        toast.error('テンプレートの取得に失敗しました')
      } finally {
        setIsLoadingTemplates(false)
      }
    }
    fetchTemplates()
  }, [])


  // カテゴリごとにテンプレートをグループ化（要求に合わせて整理）
  // 遅延読み込み対応：各カテゴリの表示数を制限
  const templatesByCategory = useMemo((): { [key: string]: BannerTemplate[] } => {
    if (!templates || !Array.isArray(templates) || templates.length === 0) {
      return {}
    }
    
    const grouped: { [key: string]: BannerTemplate[] } = {}
    const categoryOrder = ['食品・飲料', 'イベント', '美容・ファッション', 'ビジネス', '不動産・旅行', '採用', 'IT・テクノロジー', '教育', 'スポーツ・趣味', 'ライフスタイル', '医療・金融', 'EC']
    
    // すべてのテンプレートを処理（画像URLがないものも含む）
    templates.forEach((template) => {
      if (!template) return
      // カテゴリマッピングを使用、なければ元の業種名を使用
      const industry = template.industry || 'その他'
      const category = categoryMapping[industry] || industry
      
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(template)
    })
    
    // カテゴリ順序に従ってソート
    const sorted: { [key: string]: BannerTemplate[] } = {}
    categoryOrder.forEach((cat) => {
      if (grouped[cat] && grouped[cat].length > 0) {
        sorted[cat] = grouped[cat]
      }
    })
    
    // その他のカテゴリも追加
    Object.keys(grouped).forEach((cat) => {
      if (!categoryOrder.includes(cat) && grouped[cat] && grouped[cat].length > 0) {
        sorted[cat] = grouped[cat]
      }
    })
    
    // 各カテゴリの表示数を制限（遅延読み込み）
    const limited: { [key: string]: BannerTemplate[] } = {}
    Object.keys(sorted).forEach((cat) => {
      const visibleCount = visibleCounts[cat] || INITIAL_VISIBLE_COUNT
      const categoryTemplates = sorted[cat] || []
      limited[cat] = categoryTemplates.slice(0, visibleCount)
    })
    
    return limited
  }, [templates, visibleCounts])
  
  // カテゴリごとの全テンプレート数（「もっと見る」ボタンの表示判定用）
  const totalTemplatesByCategory = useMemo((): { [key: string]: BannerTemplate[] } => {
    if (!templates || !Array.isArray(templates) || templates.length === 0) {
      return {}
    }
    
    const grouped: { [key: string]: BannerTemplate[] } = {}
    templates.forEach((template) => {
      if (!template) return
      const industry = template.industry || 'その他'
      const category = categoryMapping[industry] || industry
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(template)
    })
    return grouped
  }, [templates])

  // グリッドギャラリー用：全カテゴリグループ（表示数制限なし）
  const allTemplatesByCategory = useMemo((): { [key: string]: BannerTemplate[] } => {
    if (!templates || !Array.isArray(templates) || templates.length === 0) return {}
    const grouped: { [key: string]: BannerTemplate[] } = {}
    const categoryOrder = ['食品・飲料', 'イベント', '美容・ファッション', 'ビジネス', '不動産・旅行', '採用', 'IT・テクノロジー', '教育', 'スポーツ・趣味', 'ライフスタイル', '医療・金融', 'EC']
    templates.forEach((t) => {
      if (!t) return
      const category = categoryMapping[t.industry] || t.industry || 'その他'
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(t)
    })
    const sorted: { [key: string]: BannerTemplate[] } = {}
    categoryOrder.forEach((cat) => { if (grouped[cat]?.length) sorted[cat] = grouped[cat] })
    Object.keys(grouped).forEach((cat) => { if (!categoryOrder.includes(cat) && grouped[cat]?.length) sorted[cat] = grouped[cat] })
    return sorted
  }, [templates])

  // フィルタ適用後のテンプレート
  const filteredTemplates = useMemo(() => {
    if (activeFilter === 'すべて') return templates
    return allTemplatesByCategory[activeFilter] || []
  }, [activeFilter, templates, allTemplatesByCategory])

  // カテゴリ内indexを取得（ロック判定用）
  const getCategoryIndex = useCallback((template: BannerTemplate): number => {
    const category = categoryMapping[template.industry] || template.industry || 'その他'
    const categoryTemplates = allTemplatesByCategory[category] || []
    return categoryTemplates.findIndex((t) => t.id === template.id)
  }, [allTemplatesByCategory])

  const galleryFilterTabs = ['すべて', '食品・飲料', 'イベント', '美容・ファッション', 'ビジネス', '不動産・旅行', '採用', 'IT・テクノロジー', '教育', 'スポーツ・趣味', 'ライフスタイル', '医療・金融', 'EC']

  // カテゴリの表示数を増やす（スクロール時に呼び出し）
  const loadMoreTemplates = useCallback((category: string) => {
    setVisibleCounts((prev) => {
      const current = prev[category] || INITIAL_VISIBLE_COUNT
      const total = totalTemplatesByCategory[category]?.length || 0
      const next = Math.min(current + LOAD_MORE_COUNT, total)
      return { ...prev, [category]: next }
    })
  }, [totalTemplatesByCategory])

  // スクロール位置を更新する関数
  const updateScrollPosition = useCallback((category: string) => {
    const container = scrollRefs.current[category]
    if (container) {
      const canScrollLeft = container.scrollLeft > 10
      const canScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      setScrollPositions(prev => ({
        ...prev,
        [category]: { canScrollLeft, canScrollRight }
      }))
    }
  }, [])
  
  // 横スクロール関数（改良版：カード単位でスクロール）
  const scroll = (direction: 'left' | 'right', category: string) => {
    const container = scrollRefs.current[category]
    if (container) {
      // カード幅 + gap を考慮したスクロール量（実際のカードサイズに合わせる）
      const cardWidth = window.innerWidth < 640 ? 144 : window.innerWidth < 768 ? 192 : window.innerWidth < 1024 ? 256 : 320
      const gap = window.innerWidth < 640 ? 8 : window.innerWidth < 768 ? 12 : 16
      const scrollAmount = (cardWidth + gap) * 2 // 2枚分スクロール
      
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
      
      // スクロール後に位置を更新
      setTimeout(() => updateScrollPosition(category), 400)
    }
  }
  
  // スクロールイベントハンドラ
  const handleScroll = useCallback((category: string) => {
    updateScrollPosition(category)
  }, [updateScrollPosition])
  
  // 初期スクロール位置を設定
  useEffect(() => {
    if (!isLoadingTemplates && templates.length > 0) {
      // 少し遅延させてDOMが完全にレンダリングされてから実行
      const timer = setTimeout(() => {
        Object.keys(templatesByCategory).forEach(category => {
          updateScrollPosition(category)
        })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isLoadingTemplates, templates, templatesByCategory, updateScrollPosition])
  
  // タッチスワイプハンドラ（Netflix風のスムーズなスワイプ）
  const handleTouchStart = useCallback((e: React.TouchEvent, category: string) => {
    touchStartX.current[category] = e.touches[0].clientX
    touchCurrentX.current[category] = e.touches[0].clientX
    isDragging.current[category] = true
  }, [])
  
  const handleTouchMove = useCallback((e: React.TouchEvent, category: string) => {
    if (!isDragging.current[category]) return
    e.preventDefault() // デフォルトのスクロールを防止
    touchCurrentX.current[category] = e.touches[0].clientX
    
    const container = scrollRefs.current[category]
    if (container) {
      const diff = touchStartX.current[category] - touchCurrentX.current[category]
      // リアルタイムでスクロール位置を更新（完全に追従）
      container.scrollLeft += diff
      touchStartX.current[category] = touchCurrentX.current[category]
    }
  }, [])
  
  const handleTouchEnd = useCallback((e: React.TouchEvent, category: string) => {
    if (!isDragging.current[category]) return
    isDragging.current[category] = false
    
    const container = scrollRefs.current[category]
    if (container) {
      // スワイプの勢いを計算してスムーズにスクロール
      const diff = touchStartX.current[category] - touchCurrentX.current[category]
      if (Math.abs(diff) > 30) {
        // スワイプの速度に応じてスクロール量を調整
        const cardWidth = window.innerWidth < 768 ? 144 : window.innerWidth < 1024 ? 256 : 320
        const scrollAmount = Math.min(Math.abs(diff) * 1.5, cardWidth * 2) // 最大2枚分
        container.scrollBy({
          left: diff > 0 ? scrollAmount : -scrollAmount,
          behavior: 'smooth',
        })
      }
      // スクロール位置を更新
      setTimeout(() => updateScrollPosition(category), 300)
    }
  }, [updateScrollPosition])
  
  // マウスドラッグハンドラ（デスクトップ用）
  const handleMouseDown = useCallback((e: React.MouseEvent, category: string) => {
    // 左クリックのみ処理
    if (e.button !== 0) return
    
    touchStartX.current[category] = e.clientX
    touchCurrentX.current[category] = e.clientX
    isDragging.current[category] = true
    
    const container = scrollRefs.current[category]
    if (container) {
      container.style.cursor = 'grabbing'
      container.style.userSelect = 'none'
    }
    
    // グローバルイベントリスナーを追加（コンテナ外でもドラッグを継続）
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging.current[category]) return
      e.preventDefault()
      
      touchCurrentX.current[category] = e.clientX
      const container = scrollRefs.current[category]
      if (container) {
        const diff = touchStartX.current[category] - touchCurrentX.current[category]
        container.scrollLeft += diff
        touchStartX.current[category] = touchCurrentX.current[category]
      }
    }
    
    const handleGlobalMouseUp = () => {
      isDragging.current[category] = false
      const container = scrollRefs.current[category]
      if (container) {
        container.style.cursor = 'grab'
        container.style.userSelect = ''
      }
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
    
    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)
  }, [])
  
  const handleMouseMove = useCallback((e: React.MouseEvent, category: string) => {
    if (!isDragging.current[category]) return
    e.preventDefault()
    
    touchCurrentX.current[category] = e.clientX
    const container = scrollRefs.current[category]
    if (container) {
      const diff = touchStartX.current[category] - touchCurrentX.current[category]
      container.scrollLeft += diff
      touchStartX.current[category] = touchCurrentX.current[category]
    }
  }, [])
  
  const handleMouseUp = useCallback((category: string) => {
    isDragging.current[category] = false
    const container = scrollRefs.current[category]
    if (container) {
      container.style.cursor = 'grab'
      container.style.userSelect = ''
    }
  }, [])
  
  const handleMouseLeave = useCallback((category: string) => {
    // マウスが離れた時はドラッグを継続（グローバルイベントで処理）
  }, [])
  
  // マウスホイール/トラックパッドでの横スクロール（Netflix風）- 超軽快なスワイプ
  const handleWheel = useCallback((e: React.WheelEvent, category: string) => {
    const container = scrollRefs.current[category]
    if (!container) return
    
    const hasHorizontalScroll = container.scrollWidth > container.clientWidth
    if (!hasHorizontalScroll) return
    
    // トラックパッドの横スワイプを検出
    // deltaXが0でない場合は横スワイプ
    if (e.deltaX !== 0) {
      // 横スワイプの場合は感度を大幅に上げて適用（3倍速）
      // requestAnimationFrameでスムーズに
      requestAnimationFrame(() => {
        container.scrollLeft += e.deltaX * 3
        updateScrollPosition(category)
      })
      return
    }
    
    // Shiftキー + 縦スクロールの場合
    if (e.shiftKey && e.deltaY !== 0) {
      e.preventDefault()
      requestAnimationFrame(() => {
        container.scrollLeft += e.deltaY * 3
        updateScrollPosition(category)
      })
      return
    }
    
    // 通常の縦スクロールは横スクロールに変換しない（ページスクロールを優先）
  }, [updateScrollPosition])

  // バナー生成
  const handleGenerate = async () => {
    // ゲストでも生成可能（PLAN_CONFIG.GUEST: dailyLimit 5）
    // ログインチェックは不要（日次制限で制御）

    if (!selectedTemplate) {
      toast.error('テンプレートを選択してください')
      return
    }

    if (!serviceName.trim()) {
      toast.error('入れたいテキストを入力してください')
      return
    }

    setIsGenerating(true)
    setGeneratedBanners([])
    setGenerationProgress(0)
    setLoadingMessage(LOADING_MESSAGES[0])
    setShowGenerationModal(true)
    setGenerationComplete(false)
    
    // ローディングメッセージを定期的に更新
    let messageIndex = 0
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length
      setLoadingMessage(LOADING_MESSAGES[messageIndex])
      setGenerationProgress(prev => Math.min(prev + Math.random() * 15, 90))
    }, 3000)

    try {
      // サイズ文字列を生成（プリセットのみ使用）
      const finalWidth = selectedSize.width
      const finalHeight = selectedSize.height
      const sizeString = `${finalWidth}x${finalHeight}`

      // 既存APIをラップして使用（本番APIは変更しない）
      // 選択したテンプレートのスタイルを維持するため、basePromptとtemplateImageUrlを渡す
      const res = await fetch('/api/banner/test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: selectedTemplate.category,
          size: sizeString,
          industry: selectedTemplate.industry,
          mainTitle: serviceName,
          // トーンは削除（元のスタイルを維持するため）
          count: generateCount,
          basePrompt: selectedTemplate.prompt,
          templateImageUrl: selectedTemplate.imageUrl, // 元の画像URLを渡してスタイル参照
          templateDisplayTitle: selectedTemplate.displayTitle || selectedTemplate.name,
          logoBase64: logoPreview || undefined,
          personBase64: personPreview || undefined,
          // カラー指定
          mainColor: mainColor.trim() || undefined,
          subColor: subColor.trim() || undefined,
          // エンタープライズ限定：カスタムプロンプト
          customPrompt: currentPlan === 'ENTERPRISE' && customPrompt.trim() ? customPrompt.trim() : undefined,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || '生成に失敗しました')
      }

      if (result.banners && Array.isArray(result.banners) && result.banners.length > 0) {
        setGenerationProgress(100)
        setLoadingMessage('完成しました！')
        const banners: GeneratedBanner[] = result.banners.map((url: string, idx: number) => ({
          id: `banner-${Date.now()}-${idx}`,
          imageUrl: url,
          prompt: result.prompts?.[idx] || '',
          createdAt: new Date(),
        }))
        setGeneratedBanners(banners)
        setGenerationComplete(true)
        clearInterval(messageInterval)
        
        // 生成数をカウントアップ
        incrementGenerationCount(banners.length)
        
        // 完了演出を3秒表示してからモーダルを閉じる
        setTimeout(() => {
          setShowGenerationModal(false)
          setIsGenerating(false)
          setGenerationComplete(false)
        }, 3000)
      } else {
        throw new Error('バナーが生成されませんでした')
      }
    } catch (err: any) {
      console.error('Generate error:', err)
      toast.error(err.message || '生成に失敗しました')
      setShowGenerationModal(false)
      clearInterval(messageInterval)
      setIsGenerating(false)
      setGenerationProgress(0)
      setLoadingMessage('')
    }
  }

  const handleDownload = (banner: GeneratedBanner) => {
    const link = document.createElement('a')
    link.href = banner.imageUrl
    link.download = `banner-${banner.id}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('ダウンロードしました')
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* PC用サイドバー（モバイルでは完全に非表示） */}
      <div className="hidden md:block">
        <DashboardSidebar isMobile={false} />
      </div>
      
      {/* モバイル用サイドバーオーバーレイ（ハンバーガーメニューから開く） */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="fixed left-0 top-0 h-full z-50 md:hidden"
            >
              <DashboardSidebar forceExpanded isMobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* メインコンテンツ */}
      <main className="flex-1 ml-0 md:ml-[240px] min-h-screen bg-black overflow-x-hidden">
        {/* モバイル用ヘッダー */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-black/90 backdrop-blur-sm border-b border-gray-800 px-3 py-2 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="メニューを開く"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-sm font-bold text-white">バナーテンプレート</h1>
          <div className="w-9" /> {/* スペーサー */}
        </div>
        
        {/* トライアルバナー（ログイン後1時間） */}
        {isTrialActive && (
          <div className="fixed top-12 md:top-0 left-0 md:left-[240px] right-0 z-40 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium shadow-lg">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>🎉 全機能無料トライアル中！</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
              残り {trialRemainingMinutes}分
            </span>
            <span className="hidden sm:inline text-white/80">- エンタープライズ機能をお試しください</span>
          </div>
        )}
        
        {/* ローディング画面 */}
        {isLoadingTemplates && (
          <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* 回転リング */}
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
              <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-pink-500 animate-spin" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
            </div>

            {/* タイトル */}
            <h2 className="text-2xl font-black text-white mb-2">ドヤバナーAI</h2>
            <p className="text-sm text-white/60 font-bold mb-8">テンプレートを読み込んでいます...</p>

            {/* プログレスバー */}
            <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mb-8">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${loadingProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* ローテーションTIPS */}
            <AnimatePresence mode="wait">
              <motion.div
                key={loadingTipIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10"
              >
                <span className="text-2xl">{LOADING_TIPS[loadingTipIndex]?.emoji}</span>
                <span className="text-sm text-white/80 font-bold">{LOADING_TIPS[loadingTipIndex]?.text}</span>
              </motion.div>
            </AnimatePresence>

            {/* バウンスドット */}
            <div className="flex items-center gap-1.5 mt-6">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-white/30"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15, ease: 'easeInOut' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Netflix風のメインコンテンツ */}
        <div className={`relative ${isTrialActive ? 'pt-20 md:pt-10' : 'pt-12 md:pt-0'}`}>
          {/* 大きなヒーロー画像（選択されたバナーまたはテンプレート）- 固定表示、フォーム表示時は縮小 */}
          <div
            data-tour="hero-preview"
            className={`fixed ${isTrialActive ? 'top-20 md:top-10' : 'top-12 md:top-0'} left-0 md:left-[240px] right-0 z-20 overflow-hidden transition-all duration-500 ease-in-out ${
              isHeroCollapsed
                ? 'h-[0vh] sm:h-[0vh] md:h-[0vh] lg:h-[0vh]'
                : isFormVisible
                  ? 'h-[15vh] sm:h-[18vh] md:h-[20vh] lg:h-[22vh]'
                  : 'h-[32vh] sm:h-[40vh] md:h-[50vh] lg:h-[55vh]'
            }`}
          >
            {/* グラデーション: 下は黒、上は明るく */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent z-10" />
            
            {/* ロック状態のオーバーレイ - 削除済み（生成ボタン押下時にログイン誘導へ変更） */}
            
            {selectedBanner ? (
              <img
                src={selectedBanner.imageUrl}
                alt="Selected banner"
                loading="eager"
                decoding="async"
                // @ts-ignore fetchpriority is valid HTML but not in React types
                fetchpriority="high"
                className="w-full h-full object-cover"
              />
            ) : selectedTemplate?.imageUrl && !imageErrors.has(selectedTemplate.id) ? (
              <img
                src={selectedTemplate.imageUrl}
                alt={selectedTemplate.prompt}
                loading="eager"
                decoding="async"
                // @ts-ignore fetchpriority is valid HTML but not in React types
                fetchpriority="high"
                onError={() => handleImageError(selectedTemplate.id)}
                className="w-full h-full object-cover"
              />
            ) : selectedTemplate && imageErrors.has(selectedTemplate.id) ? (
              // ヒーロー画像読み込みエラー時
              <div className="w-full h-full bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <div className="text-center p-4 sm:p-8">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <X className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
                  </div>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 text-white">
                    画像を読み込めませんでした
                  </h2>
                  <p className="text-gray-400 text-sm sm:text-base mb-4">
                    ネットワーク接続を確認してください
                  </p>
                  <button
                    onClick={() => {
                      // エラーをクリアして再読み込み
                      setImageErrors(prev => {
                        const next = new Set(prev)
                        next.delete(selectedTemplate.id)
                        return next
                      })
                      setLoadedImages(prev => {
                        const next = new Set(prev)
                        next.delete(selectedTemplate.id)
                        return next
                      })
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    再読み込み
                  </button>
                </div>
              </div>
            ) : selectedTemplate ? (
              <div className="w-full h-full bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <div className="text-center p-8">
                  <Sparkles className="w-20 h-20 mx-auto mb-6 text-gray-400" />
                  <h2 className="text-2xl md:text-4xl font-bold mb-4 text-white">
                    {selectedTemplate.prompt.split('、')[0] || selectedTemplate.industry}
                  </h2>
                  <p className="text-gray-400 text-lg">{selectedTemplate.prompt}</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-20 h-20 mx-auto mb-6 text-gray-400 animate-pulse" />
                  <p className="text-gray-400 text-xl">テンプレートを読み込み中...</p>
                </div>
              </div>
            )}
            
            {/* オーバーレイ情報（Netflix風）- ヒーロー閉じ時は非表示、フォーム表示時は縮小 */}
            <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-500 ease-in-out ${
              isHeroCollapsed
                ? 'opacity-0 pointer-events-none translate-y-4'
                : isFormVisible ? 'opacity-100 p-1 sm:p-2' : 'opacity-100 p-2 sm:p-4 md:p-6 lg:p-8'
            }`}>
              <div className="max-w-6xl mx-auto">
                {/* メインタイトル：日本語の短いタイトルを優先表示 */}
                <h1 className={`font-black drop-shadow-2xl leading-tight transition-all duration-300 ${
                  isFormVisible 
                    ? 'text-sm sm:text-base md:text-lg mb-0.5' 
                    : 'text-base sm:text-xl md:text-3xl lg:text-4xl mb-0.5 sm:mb-2'
                }`}>
                  {selectedBanner 
                    ? serviceName || '生成されたバナー'
                    : selectedTemplate?.displayTitle || selectedTemplate?.name || selectedTemplate?.industry || 'バナーテンプレート'
                  }
                </h1>
                {/* サブタイトル：ジャンル名（フォーム表示時は非表示） */}
                {!isFormVisible && (
                  <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-200 mb-1 drop-shadow-lg font-medium">
                    {selectedBanner 
                      ? (tone ? `トーン: ${tone}` : '')
                      : selectedTemplate?.industry || ''
                    }
                  </p>
                )}
                {/* プロンプト表示：アイコン付きで分かりやすく（スマホでは非表示、フォーム表示時も非表示） */}
                {!selectedBanner && selectedTemplate && !isFormVisible && (
                  <div className="hidden sm:flex items-center gap-2 mb-2 sm:mb-3 max-w-2xl">
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 shrink-0">
                      <Sparkles className="w-3 h-3 text-yellow-400" />
                      <span className="text-[10px] sm:text-xs text-white/80 font-medium whitespace-nowrap">スタイル</span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-300 drop-shadow-lg line-clamp-1 leading-relaxed">
                      {selectedTemplate.prompt && selectedTemplate.prompt.length > 10 
                        ? (selectedTemplate.prompt.length > 100 
                            ? selectedTemplate.prompt.substring(0, 100) + '...'
                            : selectedTemplate.prompt)
                        : selectedTemplate.displayTitle || selectedTemplate.name || selectedTemplate.industry || 'スタイル情報あり'
                      }
                    </p>
                  </div>
                )}
                {/* ボタン（フォーム表示時は非表示） */}
                {!isFormVisible && (
                  <div className="flex gap-2 flex-wrap">
                    {!selectedBanner && selectedTemplate && (
                      <>
                        {/* ロック状態の場合 */}
                        {selectedTemplateLockType ? (
                          <button
                            onClick={() => {
                              setLockedTemplate(selectedTemplate)
                              setLockModalType(selectedTemplateLockType)
                              setShowLockModal(true)
                            }}
                            className={`px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 font-bold rounded-md transition-all flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm shadow-lg ${
                              selectedTemplateLockType === 'login'
                                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                                : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:from-yellow-600 hover:to-orange-600'
                            }`}
                          >
                            <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="whitespace-nowrap">
                              {selectedTemplateLockType === 'login' ? 'ログインして使う' : 'PROプランで解放'}
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              // ヒーローを閉じてからフォームにスクロール
                              setIsHeroCollapsed(true)
                              setTimeout(() => {
                                const formElement = document.getElementById('banner-form')
                                if (formElement) {
                                  formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }
                              }, 400)
                            }}
                            data-tour="generate-style"
                            className="px-5 sm:px-7 md:px-10 py-2.5 sm:py-3.5 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white font-black rounded-xl transition-all flex items-center gap-2 sm:gap-2.5 text-sm sm:text-base md:text-lg shadow-[0_4px_20px_rgba(59,130,246,0.5)] hover:shadow-[0_6px_30px_rgba(59,130,246,0.7)] hover:scale-105 active:scale-95"
                          >
                            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                            <span className="whitespace-nowrap">このスタイルで生成</span>
                          </button>
                        )}
                        {/* 画像拡大ボタン */}
                        <button
                          onClick={() => {
                            if (selectedTemplate?.imageUrl) {
                              setZoomImage({
                                url: selectedTemplate.imageUrl,
                                title: selectedTemplate.displayTitle || selectedTemplate.name || selectedTemplate.industry
                              })
                            }
                          }}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-800/80 text-white font-bold rounded-md hover:bg-gray-700 transition-all flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm backdrop-blur-sm border border-white/20"
                          title="画像を拡大表示"
                        >
                          <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="whitespace-nowrap hidden sm:inline">画像全体を見る</span>
                        </button>
                      </>
                    )}
                    {selectedBanner && (
                      <>
                        <button
                          onClick={() => handleDownload(selectedBanner)}
                          className="px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition-all flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm shadow-lg hover:shadow-xl"
                        >
                          <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="whitespace-nowrap">ダウンロード</span>
                        </button>
                        {/* 生成バナーの拡大ボタン */}
                        <button
                          onClick={() => {
                            setZoomImage({
                              url: selectedBanner.imageUrl,
                              title: '生成されたバナー'
                            })
                          }}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-800/80 text-white font-bold rounded-md hover:bg-gray-700 transition-all flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm backdrop-blur-sm border border-white/20"
                          title="画像を拡大表示"
                        >
                          <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="whitespace-nowrap hidden sm:inline">画像全体を見る</span>
                        </button>
                        <button 
                          onClick={() => setSelectedBanner(null)}
                          className="px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 bg-gray-600/80 text-white font-bold rounded-md hover:bg-gray-600 transition-all flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm backdrop-blur-sm"
                        >
                          <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="whitespace-nowrap">戻る</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ジャンルフィルタタブ + ギャラリーに戻るボタン */}
          <div className={`w-full relative z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800/50 transition-all duration-500 ease-in-out ${
              isHeroCollapsed
                ? 'pt-[6vh] sm:pt-[6vh] md:pt-[4vh] lg:pt-[4vh]'
                : isFormVisible
                  ? 'pt-[17vh] sm:pt-[20vh] md:pt-[22vh] lg:pt-[24vh]'
                  : 'pt-[34vh] sm:pt-[42vh] md:pt-[52vh] lg:pt-[57vh]'
          }`}>
            {/* ギャラリーに戻るバー（ヒーロー展開時のみ表示） */}
            {!isHeroCollapsed && (
              <div className="flex items-center justify-between px-2 sm:px-4 md:px-8 lg:px-12 py-2 border-b border-gray-800/30">
                <span className="text-xs sm:text-sm text-gray-400 font-medium truncate mr-2">
                  選択中: {selectedTemplate?.displayTitle || selectedTemplate?.name || selectedTemplate?.industry || ''}
                </span>
                <button
                  onClick={() => setIsHeroCollapsed(true)}
                  className="flex-shrink-0 px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center gap-2 transition-all duration-200 shadow-md border border-gray-700 text-white text-xs sm:text-sm font-bold"
                >
                  <ChevronUp className="w-4 h-4" />
                  ギャラリーに戻る
                </button>
              </div>
            )}
            <div data-tour="filter-tabs" className="flex items-center gap-1 px-2 sm:px-4 md:px-8 lg:px-12 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {galleryFilterTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`flex-shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    activeFilter === tab
                      ? 'bg-white text-black shadow-lg'
                      : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* 未生成テンプレートの生成進捗バーは管理画面でのみ表示 */}

          {/* グリッドギャラリー */}
          <div data-tour="gallery-grid" className="w-full px-1 sm:px-2 md:px-4 lg:px-8 py-2 bg-black relative z-10">
            {isLoadingTemplates ? (
              <div className="space-y-3">
                {[1, 2, 3].map((section) => (
                  <div key={section}>
                    <div className="flex items-center gap-1.5 px-1 sm:px-2 py-1.5">
                      <span className="text-blue-400 text-xs">▶</span>
                      <div className="h-3.5 w-24 bg-gray-700/40 rounded animate-pulse" style={{ animationDelay: `${section * 150}ms` }} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="aspect-[16/10] rounded bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/20 to-transparent animate-[shimmer_2s_infinite]" style={{ backgroundSize: '200% 100%', animationDelay: `${(section * 4 + i) * 100}ms` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : activeFilter === 'すべて' ? (
              Object.entries(allTemplatesByCategory).map(([categoryName, categoryTemplates]) => {
                if (!categoryTemplates?.length) return null
                return (
                  <div key={categoryName} className="mb-3">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-400 px-1 sm:px-2 py-1.5 flex items-center gap-1.5">
                      <span className="text-blue-400">▶</span> {categoryName}
                      <span className="text-gray-600 text-[10px]">({categoryTemplates.length})</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                      {categoryTemplates.map((template, index) => {
                        const hasError = imageErrors.has(template.id)
                        const isLoaded = loadedImages.has(template.id)
                        const showImage = template.imageUrl && !hasError && !template.isPending
                        const lockType = getImageLockType(template, index)
                        const isLocked = lockType !== null

                        return (
                          <motion.div
                            key={template.id}
                            ref={(el) => observeImage(el, template.id)}
                            whileHover={{ scale: 1.04, zIndex: 10 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              if (template.isPending) return // 未生成テンプレートはクリック不可
                              if (isLocked) {
                                handleLockedImageClick(template, lockType)
                              } else {
                                setSelectedTemplate(template)
                                setSelectedBanner(null)
                                setSelectedTemplateLockType(null)
                                setIsHeroCollapsed(false)
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                              }
                            }}
                            className={`group relative aspect-[16/10] rounded overflow-hidden ${
                              template.isPending
                                ? 'cursor-default ring-1 ring-gray-800/30 opacity-60'
                                : isLocked
                                  ? 'cursor-pointer opacity-70 hover:opacity-90'
                                  : selectedTemplate?.id === template.id
                                    ? 'cursor-pointer ring-2 ring-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                                    : 'cursor-pointer ring-1 ring-gray-800/50 hover:ring-gray-600'
                            }`}
                          >
                            {template.isPending ? (
                              <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 flex items-center justify-center">
                                <div className="text-center">
                                  <Loader2 className="w-5 h-5 animate-spin text-blue-400/60 mx-auto mb-1.5" />
                                  <p className="text-[9px] text-gray-500 font-medium">画像読み込み中</p>
                                </div>
                              </div>
                            ) : showImage ? (
                              <>
                                {!isLoaded && (
                                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                                  </div>
                                )}
                                <img
                                  key={`${template.id}-r${imageRetryRef.current[template.id] || 0}`}
                                  src={`${template.imageUrl!}${imageRetryRef.current[template.id] ? `&_r=${imageRetryRef.current[template.id]}` : ''}`}
                                  alt={template.displayTitle || template.industry}
                                  loading="lazy"
                                  decoding="async"
                                  onLoad={() => handleImageLoad(template.id)}
                                  onError={() => handleImageError(template.id)}
                                  className={`w-full h-full object-cover transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                                />
                              </>
                            ) : hasError && (imageRetryRef.current[template.id] || 0) >= MAX_IMAGE_RETRY ? (
                              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                                <div className="text-center">
                                  <ImageIcon className="w-4 h-4 text-gray-600 mx-auto mb-1" />
                                  <p className="text-[8px] text-gray-600">読み込み失敗</p>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1 sm:p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[7px] sm:text-[9px] font-bold text-white line-clamp-1 drop-shadow">
                                {template.displayTitle || template.name || template.industry}
                              </p>
                            </div>
                            {selectedTemplate?.id === template.id && !isLocked && (
                              <div className="absolute top-1 left-1 bg-blue-500 px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-bold text-white shadow z-20">
                                選択中
                              </div>
                            )}
                            {isLocked && (
                              <>
                                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                                <div className={`absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold text-white z-20 ${
                                  lockType === 'login' ? 'bg-red-500/90' : 'bg-amber-500/90'
                                }`}>
                                  <Lock className="w-2 h-2" />
                                  {lockType === 'login' ? 'ログイン' : 'PRO'}
                                </div>
                              </>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                {filteredTemplates.map((template) => {
                  const catIndex = getCategoryIndex(template)
                  const hasError = imageErrors.has(template.id)
                  const isLoaded = loadedImages.has(template.id)
                  const showImage = template.imageUrl && !hasError && !template.isPending
                  const lockType = getImageLockType(template, catIndex)
                  const isLocked = lockType !== null

                  return (
                    <motion.div
                      key={template.id}
                      ref={(el) => observeImage(el, template.id)}
                      whileHover={{ scale: 1.04, zIndex: 10 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (template.isPending) return
                        if (isLocked) {
                          handleLockedImageClick(template, lockType)
                        } else {
                          setSelectedTemplate(template)
                          setSelectedBanner(null)
                          setSelectedTemplateLockType(null)
                          setIsHeroCollapsed(false)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }
                      }}
                      className={`group relative aspect-[16/10] rounded overflow-hidden ${
                        template.isPending
                          ? 'cursor-default ring-1 ring-gray-800/30 opacity-60'
                          : isLocked
                            ? 'cursor-pointer opacity-70 hover:opacity-90'
                            : selectedTemplate?.id === template.id
                              ? 'cursor-pointer ring-2 ring-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                              : 'cursor-pointer ring-1 ring-gray-800/50 hover:ring-gray-600'
                      }`}
                    >
                      {template.isPending ? (
                        <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 flex items-center justify-center">
                          <div className="text-center">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-400/60 mx-auto mb-1.5" />
                            <p className="text-[9px] text-gray-500 font-medium">画像読み込み中</p>
                          </div>
                        </div>
                      ) : showImage ? (
                        <>
                          {!isLoaded && (
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                            </div>
                          )}
                          <img
                            key={`${template.id}-r${imageRetryRef.current[template.id] || 0}`}
                            src={`${template.imageUrl!}${imageRetryRef.current[template.id] ? `&_r=${imageRetryRef.current[template.id]}` : ''}`}
                            alt={template.displayTitle || template.industry}
                            loading="lazy"
                            decoding="async"
                            onLoad={() => handleImageLoad(template.id)}
                            onError={() => handleImageError(template.id)}
                            className={`w-full h-full object-cover transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                          />
                        </>
                      ) : hasError && (imageRetryRef.current[template.id] || 0) >= MAX_IMAGE_RETRY ? (
                        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                          <div className="text-center">
                            <ImageIcon className="w-4 h-4 text-gray-600 mx-auto mb-1" />
                            <p className="text-[8px] text-gray-600">読み込み失敗</p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1 sm:p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[7px] sm:text-[9px] font-bold text-white line-clamp-1 drop-shadow">
                          {template.displayTitle || template.name || template.industry}
                        </p>
                      </div>
                      {selectedTemplate?.id === template.id && !isLocked && (
                        <div className="absolute top-1 left-1 bg-blue-500 px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-bold text-white shadow z-20">
                          選択中
                        </div>
                      )}
                      {isLocked && (
                        <>
                          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                          <div className={`absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold text-white z-20 ${
                            lockType === 'login' ? 'bg-red-500/90' : 'bg-amber-500/90'
                          }`}>
                            <Lock className="w-2 h-2" />
                            {lockType === 'login' ? 'ログイン' : 'PRO'}
                          </div>
                        </>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 生成フォーム（選択されたテンプレートに基づく、バナー選択時は非表示） */}
          {selectedTemplate && !selectedBanner && (
            <div 
              ref={formRef}
              id="banner-form"
              data-tour="generation-form"
              className="w-full overflow-x-hidden px-3 sm:px-4 md:px-8 lg:px-12 py-6 sm:py-8 md:py-12 bg-black/95 backdrop-blur-sm scroll-mt-4"
            >
              <div className="max-w-5xl mx-auto w-full">
                <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6 md:mb-8 text-white">バナー情報を入力</h2>
                <div className="bg-gray-900/90 rounded-xl md:rounded-2xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 border border-gray-800">
                  
                  {/* 選択中のテンプレート情報 */}
                  <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 border border-gray-700">
                    <div className="flex items-center gap-3">
                      {selectedTemplate.imageUrl && (
                        <div className="w-20 h-12 sm:w-24 sm:h-14 rounded overflow-hidden flex-shrink-0">
                          <img 
                            src={selectedTemplate.imageUrl} 
                            alt={selectedTemplate.displayTitle || ''} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-gray-400">選択中のスタイル</p>
                        <p className="text-sm sm:text-base font-bold text-white truncate">
                          {selectedTemplate.displayTitle || selectedTemplate.name || selectedTemplate.industry}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* 入れたいテキスト（メイン入力） */}
                  <div>
                    <label className="block text-xs sm:text-sm font-bold mb-2">入れたいテキスト *</label>
                    <input
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="例: 新規事業立ち上げセミナー / 採用強化キャンペーン / 春の新商品発売"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg sm:rounded-xl text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5">
                      選択したスタイルを維持しながら、このテキストを反映したバナーを生成します
                    </p>
                  </div>
                  
                  {/* サイズ選択 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs sm:text-sm font-bold">サイズを選択</label>
                      <span className="text-[10px] sm:text-xs text-gray-400">CANVAS DIMENSIONS</span>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {SIZE_PRESETS.map((size) => {
                        const IconComponent = size.icon
                        return (
                          <button
                            key={size.id}
                            onClick={() => setSelectedSize(size)}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm font-medium ${
                              selectedSize.id === size.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>{size.label}</span>
                            <span className="text-[10px] sm:text-xs opacity-70">{size.ratio}</span>
                          </button>
                        )
                      })}
                    </div>
                    
                    <div className="mt-2 sm:mt-3 flex items-center justify-center">
                      <div className="bg-gray-800 rounded-lg p-3 sm:p-4 flex flex-col items-center">
                        {(() => {
                          const displayWidth = selectedSize.width
                          const displayHeight = selectedSize.height
                          const previewWidth = displayWidth > displayHeight ? 80 : 80 * displayWidth / displayHeight
                          const previewHeight = displayHeight > displayWidth ? 80 : 80 * displayHeight / displayWidth
                          return (
                            <>
                              <div 
                                className="bg-gray-700 rounded border border-gray-600"
                                style={{
                                  width: `${previewWidth}px`,
                                  height: `${previewHeight}px`,
                                }}
                              />
                              <p className="text-xs sm:text-sm font-bold text-white mt-2">{displayWidth}×{displayHeight}</p>
                              <p className="text-[10px] sm:text-xs text-gray-400">ASPECT RATIO PREVIEW</p>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                    {/* 注釈 */}
                    <p className="text-[9px] sm:text-[10px] text-yellow-500/80 mt-2 text-center">
                      ⚠️ AIの仕様により、選択したサイズと異なるサイズで生成される場合があります。ご了承ください。
                    </p>
                  </div>
                  
                  {/* 生成枚数 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs sm:text-sm font-bold">生成枚数</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg sm:text-xl font-bold text-blue-400">{generateCount}枚</span>
                        <span className="text-[10px] sm:text-xs text-gray-400">最大{planLimits.maxCount}枚</span>
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-400 mb-2 sm:mb-3">
                      1〜5枚から選択。
                      {userPlan === 'FREE' ? (
                        <span className="text-yellow-400"> 有料プランは最大5枚まで増やせます。</span>
                      ) : (
                        <span className="text-green-400"> {planLimits.label}で最大{planLimits.maxCount}枚まで生成可能。</span>
                      )}
                      <span className="text-orange-400 font-medium"> 枚数を増やすほど時間がかかります。</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {[1, 2, 3, 4, 5].map((num) => {
                        const isDisabled = num > planLimits.maxCount
                        return (
                          <button
                            key={num}
                            onClick={() => !isDisabled && setGenerateCount(num)}
                            disabled={isDisabled}
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all ${
                              generateCount === num
                                ? 'bg-blue-600 text-white'
                                : isDisabled
                                  ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {num}
                          </button>
                        )
                      })}
                    </div>
                    {userPlan === 'FREE' && (
                      <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-lg border border-yellow-700/50">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-yellow-400" />
                          <p className="text-[10px] sm:text-xs text-yellow-200">
                            <span className="font-bold">PROプラン</span>にアップグレードすると最大5枚まで生成可能
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* トライアル情報（トライアル中の場合） */}
                  {isTrialActive && (
                    <div className="p-3 sm:p-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg sm:rounded-xl border border-purple-500/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                        <span className="text-xs sm:text-sm font-bold text-purple-300">🎉 無料トライアル中</span>
                        <span className="ml-auto bg-purple-600 px-2 py-0.5 rounded-full text-[10px] font-bold text-white">
                          残り {trialRemainingMinutes}分
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-purple-200/80">
                        全機能（エンタープライズ含む）が無料でお試しいただけます！
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 bg-purple-600/30 rounded text-[9px] text-purple-200">✓ 全画像解放</span>
                        <span className="px-2 py-0.5 bg-purple-600/30 rounded text-[9px] text-purple-200">✓ 月1000枚生成</span>
                        <span className="px-2 py-0.5 bg-purple-600/30 rounded text-[9px] text-purple-200">✓ 詳細指示</span>
                      </div>
                    </div>
                  )}
                  
                  {/* 今日の生成状況 */}
                  <div className="p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm font-bold text-gray-300">今月の生成状況</span>
                      <span className={`text-xs sm:text-sm font-bold ${
                        isOverMonthlyLimit ? 'text-red-400' : monthlyGenerationCount > planConfig.monthlyLimit * 0.8 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {monthlyGenerationCount} / {planConfig.monthlyLimit}枚
                        {isTrialActive && <span className="text-purple-400 ml-1">(トライアル)</span>}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          isTrialActive ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                          isOverMonthlyLimit ? 'bg-red-500' : monthlyGenerationCount > planConfig.monthlyLimit * 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((monthlyGenerationCount / planConfig.monthlyLimit) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1.5">
                      {isTrialActive ? 'トライアル' : planConfig.label}：月{planConfig.monthlyLimit}枚まで生成可能
                      {!isTrialActive && currentPlan !== 'ENTERPRISE' && (
                        <> / <a href="/banner/dashboard/plan" className="text-amber-400 hover:underline">上限を増やす</a></>
                      )}
                    </p>
                  </div>
                  
                  {/* ロゴ・人物写真アップロード */}
                  <div>
                    <label className="text-xs sm:text-sm font-bold mb-2 block">ロゴ / 人物写真（任意）</label>
                    <p className="text-[10px] sm:text-xs text-gray-400 mb-2 sm:mb-3">アップロードした画像をバナーに反映します（AIが画像内に合成します）。</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {/* ロゴアップロード */}
                      <div className="bg-gray-800 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700">
                        <p className="text-xs sm:text-sm font-bold mb-2 sm:mb-3">ロゴ</p>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden border border-gray-600 shrink-0">
                            {logoPreview ? (
                              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-[10px] sm:text-xs text-gray-500 font-bold">LOGO</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs text-gray-400 mb-1.5 truncate">{logoFile ? logoFile.name : '未設定'}</p>
                            <label className="cursor-pointer">
                              <span className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-[10px] sm:text-xs font-medium transition-colors inline-flex items-center gap-1">
                                <Upload className="w-3 h-3" />
                                アップロード
                              </span>
                              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      {/* 人物写真アップロード */}
                      <div className="bg-gray-800 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700">
                        <p className="text-xs sm:text-sm font-bold mb-2 sm:mb-3">人物写真</p>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden border border-gray-600 shrink-0">
                            {personPreview ? (
                              <img src={personPreview} alt="Person" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs text-gray-400 mb-1.5 truncate">{personFile ? personFile.name : '未設定'}</p>
                            <label className="cursor-pointer">
                              <span className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-[10px] sm:text-xs font-medium transition-colors inline-flex items-center gap-1">
                                <Upload className="w-3 h-3" />
                                アップロード
                              </span>
                              <input type="file" accept="image/*" onChange={handlePersonUpload} className="hidden" />
                            </label>
                          </div>
                        </div>
                        <p className="text-[8px] sm:text-[10px] text-gray-500 mt-2">※ 人物写真は1名（1枚）のみ対応です</p>
                      </div>
                    </div>
                  </div>

                  {/* カラー指定 */}
                  <div>
                    <label className="text-xs sm:text-sm font-bold mb-2 sm:mb-3 block">
                      カラー指定（任意）
                    </label>
                    <p className="text-[10px] sm:text-xs text-gray-400 mb-3">
                      バナーのメインカラーとサブカラーを指定できます。
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {/* メインカラー */}
                      <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 border border-gray-700">
                        <p className="text-xs sm:text-sm font-bold mb-2">メインカラー</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={mainColor || '#3B82F6'}
                            onChange={(e) => setMainColor(e.target.value)}
                            className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={mainColor}
                            onChange={(e) => setMainColor(e.target.value)}
                            placeholder="#3B82F6"
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {mainColor && (
                          <button
                            type="button"
                            onClick={() => setMainColor('')}
                            className="mt-2 text-[10px] text-gray-400 hover:text-white transition-colors"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                      {/* サブカラー */}
                      <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 border border-gray-700">
                        <p className="text-xs sm:text-sm font-bold mb-2">サブカラー</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={subColor || '#8B5CF6'}
                            onChange={(e) => setSubColor(e.target.value)}
                            className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={subColor}
                            onChange={(e) => setSubColor(e.target.value)}
                            placeholder="#8B5CF6"
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {subColor && (
                          <button
                            type="button"
                            onClick={() => setSubColor('')}
                            className="mt-2 text-[10px] text-gray-400 hover:text-white transition-colors"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* カスタムプロンプト（エンタープライズ限定） */}
                  <div className={`${currentPlan !== 'ENTERPRISE' ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs sm:text-sm font-bold flex items-center gap-2">
                        <span>詳細な生成指示</span>
                        <span className="px-2 py-0.5 bg-purple-600 text-[10px] font-bold rounded-full">ENTERPRISE</span>
                      </label>
                      {currentPlan === 'ENTERPRISE' && (
                        <button
                          type="button"
                          onClick={() => setShowCustomPrompt(!showCustomPrompt)}
                          className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          {showCustomPrompt ? '閉じる' : '開く'}
                        </button>
                      )}
                    </div>
                    
                    {currentPlan !== 'ENTERPRISE' ? (
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center gap-3">
                          <Lock className="w-5 h-5 text-purple-400" />
                          <div>
                            <p className="text-sm text-gray-300">エンタープライズプラン限定機能</p>
                            <p className="text-xs text-gray-500 mt-1">
                              詳細な生成指示を入力して、より細かくバナーをカスタマイズできます
                            </p>
                          </div>
                        </div>
                        <a
                          href="/banner/dashboard/plan"
                          className="mt-3 inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <Crown className="w-3 h-3" />
                          プランをアップグレード
                        </a>
                      </div>
                    ) : showCustomPrompt ? (
                      <div className="space-y-3">
                        <p className="text-[10px] sm:text-xs text-gray-400">
                          選択したスタイルに加えて、追加の指示を入力できます。背景、色、レイアウト、装飾などを細かく指定できます。
                        </p>
                        <textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="例：背景を青いグラデーションに変更、右下にキラキラエフェクトを追加、文字を黄色で縁取り..."
                          className="w-full h-32 px-4 py-3 bg-gray-800 border border-purple-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                        />
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{customPrompt.length} / 500文字</span>
                          {customPrompt && (
                            <button
                              type="button"
                              onClick={() => setCustomPrompt('')}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              クリア
                            </button>
                          )}
                        </div>
                        <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-700/50">
                          <p className="text-[10px] text-purple-300">
                            💡 ヒント：「背景を〇〇に」「文字の色を〇〇に」「〇〇を追加」などの指示が効果的です
                          </p>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCustomPrompt(true)}
                        className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-purple-600/30 rounded-lg text-sm text-purple-300 transition-colors flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        詳細な生成指示を追加
                      </button>
                    )}
                  </div>

                  {/* 生成ボタン / ローディングUI */}
                  {isGenerating ? (
                    <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-xl p-6 border border-blue-700/50">
                      <div className="flex flex-col items-center gap-4">
                        {/* アニメーションアイコン */}
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
                          </div>
                          <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                        </div>
                        
                        {/* メッセージ */}
                        <div className="text-center">
                          <p className="text-lg font-bold text-white mb-1">画像を生成中...</p>
                          <p className="text-sm text-blue-300 animate-pulse">{loadingMessage}</p>
                        </div>
                        
                        {/* プログレスバー */}
                        <div className="w-full max-w-xs">
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${generationProgress}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 text-center mt-2">
                            {generateCount}枚のバナーを生成中... しばらくお待ちください
                          </p>
                        </div>
                        
                        {/* ヒント */}
                        <div className="mt-2 p-3 bg-gray-800/50 rounded-lg max-w-sm">
                          <p className="text-xs text-gray-400 text-center">
                            💡 AIが選択したスタイルを分析し、テキストを反映したバナーを生成しています
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : isOverMonthlyLimit ? (
                    <div className="w-full py-3 sm:py-4 bg-gray-700 text-white rounded-lg sm:rounded-xl text-center">
                      <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm sm:text-base">
                        <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                        今月の生成上限（{planConfig.monthlyLimit}枚）に達しました
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        来月1日にリセットされます
                        {currentPlan !== 'ENTERPRISE' && (
                          <> / <a href="/banner/dashboard/plan" className="text-amber-400 hover:underline">プランをアップグレード</a></>
                        )}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      disabled={!serviceName.trim()}
                      className="w-full py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg sm:rounded-xl transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                      このバナーをベースに{generateCount}種類のバリエーションを生成
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 生成されたバナー一覧（改善版） */}
          {generatedBanners.length > 0 && (
            <div className="px-3 sm:px-4 md:px-8 lg:px-12 py-8 sm:py-10 md:py-14 space-y-6 md:space-y-8 bg-gradient-to-b from-transparent via-gray-900/50 to-gray-900">
              {/* ヘッダー */}
              <div className="flex items-center justify-between px-2 md:px-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">
                      🎉 生成完了！
                    </h2>
                    <p className="text-sm text-gray-400">{generatedBanners.length}枚のバナーが生成されました</p>
                  </div>
                </div>
                {/* 一括ダウンロードボタン */}
                <button
                  onClick={() => {
                    generatedBanners.forEach((banner, idx) => {
                      setTimeout(() => {
                        const link = document.createElement('a')
                        link.href = banner.imageUrl
                        link.download = `banner-${idx + 1}.png`
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }, idx * 500)
                    })
                    toast.success('全画像をダウンロード中...')
                  }}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-blue-500/30"
                >
                  <Download className="w-4 h-4" />
                  全てダウンロード
                </button>
              </div>
              
              {/* バナーグリッド */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {generatedBanners.map((banner, idx) => (
                  <motion.div
                    key={banner.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="group relative bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-500 transition-all shadow-lg hover:shadow-xl"
                  >
                    {/* 画像 - 選択したサイズのアスペクト比に合わせる */}
                    <div 
                      className="relative cursor-pointer"
                      style={{
                        aspectRatio: `${selectedSize.width} / ${selectedSize.height}`,
                      }}
                      onClick={() => {
                        if (currentPlan === 'ENTERPRISE' || isTrialActive) {
                          setEditingBanner(banner)
                          setEditPrompt('')
                          setShowEditModal(true)
                        } else {
                          setZoomImage({ url: banner.imageUrl, title: `バナー ${idx + 1}` })
                        }
                      }}
                    >
                      <img
                        src={banner.imageUrl}
                        alt={`Generated banner ${idx + 1}`}
                        className="w-full h-full object-contain bg-gray-900"
                      />
                      {/* オーバーレイ（ホバー時） */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center gap-2">
                          {(currentPlan === 'ENTERPRISE' || isTrialActive) ? (
                            <>
                              <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-white" />
                              </div>
                              <span className="text-white font-bold text-sm">クリックして修正</span>
                              <span className="px-2 py-0.5 bg-purple-600 text-[10px] font-bold rounded-full text-white">ENTERPRISE</span>
                            </>
                          ) : (
                            <>
                              <Maximize2 className="w-8 h-8 text-white" />
                              <span className="text-white font-bold text-sm">拡大表示</span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* バナー番号 */}
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded-md text-xs font-bold text-white">
                        #{idx + 1}
                      </div>
                    </div>
                    
                    {/* アクションボタン */}
                    <div className="p-3 sm:p-4 space-y-3">
                      {/* ダウンロードボタン（メイン） */}
                      <button
                        onClick={() => handleDownload(banner)}
                        className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-green-500/30"
                      >
                        <Download className="w-5 h-5" />
                        ダウンロード
                      </button>
                      
                      {/* サブアクション */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setZoomImage({ url: banner.imageUrl, title: `バナー ${idx + 1}` })}
                          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Maximize2 className="w-4 h-4" />
                          拡大
                        </button>
                        {(currentPlan === 'ENTERPRISE' || isTrialActive) ? (
                          <button
                            onClick={() => {
                              setEditingBanner(banner)
                              setEditPrompt('')
                              setShowEditModal(true)
                            }}
                            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Sparkles className="w-4 h-4" />
                            修正
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setLockModalType('pro')
                              setShowLockModal(true)
                            }}
                            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Lock className="w-4 h-4" />
                            修正
                          </button>
                        )}
                      </div>
                      
                      {/* プロンプト閲覧ボタン（エンタープライズ限定） */}
                      {(currentPlan === 'ENTERPRISE' || isTrialActive) ? (
                        <button
                          onClick={() => {
                            setViewingPromptBanner(banner)
                            setShowPromptModal(true)
                          }}
                          className="w-full py-2 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5"
                        >
                          <FileText className="w-4 h-4" />
                          プロンプトを見る
                          <span className="px-1.5 py-0.5 bg-white/20 text-[10px] font-bold rounded">ENTERPRISE</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setLockModalType('enterprise')
                            setShowLockModal(true)
                          }}
                          className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Lock className="w-4 h-4" />
                          プロンプトを見る
                          <span className="px-1.5 py-0.5 bg-gray-600 text-[10px] font-bold rounded">ENTERPRISE</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
              
              {/* モバイル用一括ダウンロード */}
              <div className="sm:hidden px-2">
                <button
                  onClick={() => {
                    generatedBanners.forEach((banner, idx) => {
                      setTimeout(() => {
                        const link = document.createElement('a')
                        link.href = banner.imageUrl
                        link.download = `banner-${idx + 1}.png`
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }, idx * 500)
                    })
                    toast.success('全画像をダウンロード中...')
                  }}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  全てダウンロード ({generatedBanners.length}枚)
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Toaster position="top-right" />

      {/* 画像拡大モーダル */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setZoomImage(null)}
          >
            {/* 閉じるボタン */}
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 z-[110] p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              aria-label="閉じる"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* タイトル */}
            <div className="absolute top-4 left-4 z-[110]">
              <h3 className="text-white text-lg font-bold drop-shadow-lg">{zoomImage.title}</h3>
            </div>

            {/* 画像コンテナ */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-[95vw] max-h-[90vh] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={zoomImage.url}
                alt={zoomImage.title}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
              
              {/* 下部の操作ヒント */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
                <p className="text-white/60 text-xs bg-black/50 px-3 py-1 rounded-full">
                  クリックまたは × で閉じる
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎨 生成中モーダル */}
      <AnimatePresence>
        {showGenerationModal && selectedTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          >
            {/* 背景オーバーレイ（グラデーション） */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-blue-900/95 via-purple-900/95 to-black/95 backdrop-blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
            
            {/* パーティクルアニメーション背景 - モバイルでは数を減らす */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/20 rounded-full"
                  initial={{ 
                    x: typeof window !== 'undefined' ? Math.random() * window.innerWidth : 0, 
                    y: typeof window !== 'undefined' ? window.innerHeight + 100 : 800,
                    scale: Math.random() * 0.5 + 0.5
                  }}
                  animate={{ 
                    y: -100,
                    transition: {
                      duration: Math.random() * 10 + 10,
                      repeat: Infinity,
                      ease: "linear",
                      delay: Math.random() * 5
                    }
                  }}
                />
              ))}
            </div>

            {/* メインコンテンツ */}
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="relative z-10 w-[calc(100%-16px)] sm:w-[calc(100%-32px)] max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-4xl mx-2 sm:mx-auto p-3 sm:p-5 md:p-6 lg:p-8 rounded-xl sm:rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
            >
              {!generationComplete ? (
                /* 生成中の表示 */
                <>
                  {/* ヘッダー */}
                  <div className="text-center mb-3 sm:mb-4 md:mb-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="inline-block mb-2 sm:mb-3"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-0.5">
                        <div className="w-full h-full rounded-full bg-black/50 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                        </div>
                      </div>
                    </motion.div>
                    <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white mb-1">
                      🎨 バナーを生成中...
                    </h2>
                    <motion.p 
                      key={loadingMessage}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-blue-200 text-xs sm:text-sm md:text-base"
                    >
                      {loadingMessage}
                    </motion.p>
                  </div>

                  {/* プログレスバー */}
                  <div className="mb-3 sm:mb-4 md:mb-6">
                    <div className="flex justify-between text-[10px] sm:text-xs text-white/70 mb-1">
                      <span>進捗</span>
                      <span>{Math.round(generationProgress)}%</span>
                    </div>
                    <div className="h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${generationProgress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>

                  {/* 入力内容と参考画像 - スマホでは縦並び、コンパクトに */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* 参考画像（スマホでは小さく） */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <h3 className="text-white/80 font-semibold flex items-center gap-1 text-xs sm:text-sm">
                        <ImageLucide className="w-3 h-3 sm:w-4 sm:h-4" />
                        参考スタイル
                      </h3>
                      <div className="relative aspect-video rounded-lg overflow-hidden border border-white/30 shadow-lg">
                        <img
                          src={selectedTemplate.imageUrl || selectedTemplate.previewUrl || ''}
                          alt={selectedTemplate.displayTitle || selectedTemplate.name || '参考画像'}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-1.5 sm:bottom-2 left-1.5 sm:left-2 right-1.5 sm:right-2">
                          <p className="text-white font-bold text-xs sm:text-sm drop-shadow-lg truncate">
                            {selectedTemplate.displayTitle || selectedTemplate.name}
                          </p>
                        </div>
                        {/* パルスアニメーション */}
                        <motion.div
                          className="absolute inset-0 border-2 border-blue-400 rounded-lg"
                          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.02, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                    </div>

                    {/* 入力内容（コンパクト） */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <h3 className="text-white/80 font-semibold flex items-center gap-1 text-xs sm:text-sm">
                        <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                        生成設定
                      </h3>
                      <div className="space-y-1.5 sm:space-y-2 bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10">
                        <div>
                          <p className="text-white/50 text-[9px] sm:text-[10px]">テキスト</p>
                          <p className="text-white font-medium text-xs sm:text-sm truncate">{serviceName}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                          <div>
                            <p className="text-white/50 text-[9px] sm:text-[10px]">サイズ</p>
                            <p className="text-white font-medium text-[10px] sm:text-xs">
                              {`${selectedSize.width}×${selectedSize.height}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/50 text-[9px] sm:text-[10px]">枚数</p>
                            <p className="text-white font-medium text-[10px] sm:text-xs">{generateCount}枚</p>
                          </div>
                        </div>
                        {(logoPreview || personPreview) && (
                          <div className="flex gap-1.5 sm:gap-2 pt-1.5 border-t border-white/10">
                            {logoPreview && (
                              <div className="flex items-center gap-1">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded overflow-hidden bg-white/10">
                                  <img src={logoPreview} alt="ロゴ" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-white/70 text-[9px] sm:text-xs">ロゴ</span>
                              </div>
                            )}
                            {personPreview && (
                              <div className="flex items-center gap-1">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded overflow-hidden bg-white/10">
                                  <img src={personPreview} alt="人物" className="w-full h-full object-cover" />
                                </div>
                                <span className="text-white/70 text-[9px] sm:text-xs">人物</span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* カスタムプロンプト表示（エンタープライズ） */}
                        {customPrompt && (
                          <div className="pt-1.5 border-t border-white/10">
                            <p className="text-white/50 text-[9px] sm:text-[10px] flex items-center gap-1">
                              <span className="px-1 py-0.5 bg-purple-600 text-[6px] sm:text-[7px] font-bold rounded">ENT</span>
                              詳細指示
                            </p>
                            <p className="text-white/80 text-[9px] sm:text-[10px] line-clamp-2">{customPrompt}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 生成中のヒント */}
                  <div className="mt-2 sm:mt-3 md:mt-4 text-center">
                    <p className="text-white/50 text-[9px] sm:text-[10px] md:text-xs px-1">
                      ✨ AIがバナーを生成中...
                      {customPrompt && '（カスタム指示適用中）'}
                    </p>
                  </div>
                </>
              ) : (
                /* 完了時の表示 */
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15, stiffness: 300 }}
                  className="text-center py-4 sm:py-6 md:py-8"
                >
                  {/* 成功アイコン */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.5, times: [0, 0.6, 1] }}
                    className="mb-4 sm:mb-5 md:mb-6"
                  >
                    <div className="inline-block relative">
                      <motion.div
                        className="absolute inset-0 bg-green-500/30 rounded-full"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                        <motion.svg
                          className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        >
                          <motion.path
                            d="M5 13l4 4L19 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </motion.svg>
                      </div>
                    </div>
                  </motion.div>

                  {/* 完了メッセージ */}
                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3"
                  >
                    🎉 生成完了！
                  </motion.h2>
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-base sm:text-lg md:text-xl text-green-300 mb-4 sm:mb-5 md:mb-6"
                  >
                    {generatedBanners.length}枚のバナーが完成しました
                  </motion.p>

                  {/* 生成された画像のプレビュー - 選択したサイズに合わせる */}
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex justify-center gap-2 sm:gap-3 flex-wrap px-2"
                  >
                    {generatedBanners.slice(0, 3).map((banner, idx) => {
                      // アスペクト比に基づいてサイズを計算
                      const ratio = selectedSize.width / selectedSize.height
                      const baseWidth = ratio >= 1 ? 80 : 60 // 横長なら幅を基準、縦長なら小さめ
                      const width = baseWidth
                      const height = baseWidth / ratio
                      return (
                        <motion.div
                          key={banner.id}
                          initial={{ scale: 0, rotate: -10 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: 0.6 + idx * 0.1, type: "spring" }}
                          className="rounded-lg overflow-hidden border-2 border-white/30 shadow-lg"
                          style={{
                            width: `${width}px`,
                            height: `${height}px`,
                          }}
                        >
                          <img
                            src={banner.imageUrl}
                            alt={`生成バナー ${idx + 1}`}
                            className="w-full h-full object-contain bg-gray-900"
                          />
                        </motion.div>
                      )
                    })}
                    {generatedBanners.length > 3 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.9, type: "spring" }}
                        className="rounded-lg bg-white/10 border-2 border-white/30 flex items-center justify-center"
                        style={{
                          width: `${selectedSize.width / selectedSize.height >= 1 ? 80 : 60}px`,
                          height: `${(selectedSize.width / selectedSize.height >= 1 ? 80 : 60) / (selectedSize.width / selectedSize.height)}px`,
                        }}
                      >
                        <span className="text-white font-bold text-xs sm:text-sm md:text-base">+{generatedBanners.length - 3}</span>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* 紙吹雪エフェクト - モバイルでは数を減らす */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(typeof window !== 'undefined' && window.innerWidth < 640 ? 15 : 30)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 sm:w-3 sm:h-3 rounded-sm"
                        style={{
                          background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][i % 6],
                          left: `${Math.random() * 100}%`,
                        }}
                        initial={{ y: -20, rotate: 0, opacity: 1 }}
                        animate={{ 
                          y: typeof window !== 'undefined' ? window.innerHeight + 100 : 800,
                          rotate: Math.random() * 720 - 360,
                          opacity: [1, 1, 0]
                        }}
                        transition={{
                          duration: Math.random() * 2 + 2,
                          delay: Math.random() * 0.5,
                          ease: "easeOut"
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔒 ロックモーダル */}
      <AnimatePresence>
        {showLockModal && lockedTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 overflow-hidden"
            onClick={() => setShowLockModal(false)}
          >
            {/* 背景オーバーレイ */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            {/* モーダルコンテンツ */}
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-[calc(100%-24px)] sm:max-w-md bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-gray-700 max-h-[90vh] overflow-y-auto"
            >
              {/* ヘッダー（ロックタイプに応じた色） */}
              <div className={`p-4 sm:p-6 ${
                lockModalType === 'login' 
                  ? 'bg-gradient-to-r from-red-600 to-red-500' 
                  : lockModalType === 'pro'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500'
                    : 'bg-gradient-to-r from-purple-600 to-purple-500'
              }`}>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-bold text-white">
                      {lockModalType === 'login' 
                        ? 'ログインが必要です' 
                        : lockModalType === 'pro'
                          ? 'PROプランで解放'
                          : 'Enterpriseプランで解放'}
                    </h3>
                    <p className="text-white/80 text-xs sm:text-sm">
                      {lockModalType === 'login' 
                        ? 'この画像を使用するにはログインしてください' 
                        : lockModalType === 'pro'
                          ? 'この画像はPROプランで使用できます'
                          : 'この画像はEnterpriseプランで使用できます'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 画像プレビュー */}
              <div className="p-4 sm:p-6">
                <div className="relative aspect-video rounded-lg overflow-hidden mb-3 sm:mb-4 border border-gray-700">
                  {lockedTemplate.imageUrl ? (
                    <img
                      src={lockedTemplate.imageUrl}
                      alt={lockedTemplate.displayTitle || lockedTemplate.name || ''}
                      className="w-full h-full object-cover opacity-50"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <ImageLucide className="w-8 h-8 sm:w-12 sm:h-12 text-gray-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/60 flex items-center justify-center">
                      <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-300 text-center mb-4 sm:mb-6 text-xs sm:text-sm md:text-base px-2">
                  「{lockedTemplate.displayTitle || lockedTemplate.name || lockedTemplate.industry}」を使用するには
                  {lockModalType === 'login' 
                    ? 'ログインしてください' 
                    : lockModalType === 'pro'
                      ? 'PROプランにアップグレードしてください'
                      : 'Enterpriseプランにアップグレードしてください'}
                </p>
                
                {/* アクションボタン */}
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowLockModal(false)}
                    className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm sm:text-base"
                  >
                    閉じる
                  </button>
                  {lockModalType === 'login' ? (
                    <a
                      href="/auth/doyamarke/signin?callbackUrl=/banner/test"
                      className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
                    >
                      <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
                      ログイン
                    </a>
                  ) : (
                    <a
                      href="/banner/dashboard/plan"
                      className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
                    >
                      <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
                      プランを見る
                    </a>
                  )}
                </div>
              </div>
              
              {/* プラン比較（簡易版） */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 border border-gray-700">
                  <h4 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">プラン別の画像解放数</h4>
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">ゲスト（未ログイン）</span>
                      <span className="text-gray-300">各ジャンル1枚</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">ベーシック（ログイン）</span>
                      <span className="text-gray-300">各ジャンル3枚</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-amber-400 font-medium">PRO</span>
                      <span className="text-amber-300 font-medium">全画像解放 + 1日30枚</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-400 font-medium">Enterprise</span>
                      <span className="text-purple-300 font-medium">全画像解放 + 1日200枚</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎨 画像修正モーダル（エンタープライズ限定） */}
      <AnimatePresence>
        {showEditModal && editingBanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 overflow-hidden"
            onClick={() => !isEditing && setShowEditModal(false)}
          >
            {/* 背景オーバーレイ */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            
            {/* モーダルコンテンツ */}
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-[calc(100%-24px)] sm:max-w-4xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-purple-500/30 max-h-[90vh] overflow-y-auto"
            >
              {/* ヘッダー */}
              <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-r from-purple-600 to-pink-500 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-lg md:text-xl font-bold text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      画像を修正
                      <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 text-[10px] sm:text-xs font-bold rounded-full">ENTERPRISE</span>
                    </h3>
                    <p className="text-white/80 text-[10px] sm:text-xs md:text-sm">AIに指示を出して画像を修正できます</p>
                  </div>
                </div>
                <button
                  onClick={() => !isEditing && setShowEditModal(false)}
                  disabled={isEditing}
                  className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 shrink-0"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </button>
              </div>
              
              {/* コンテンツ */}
              <div className="p-3 sm:p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                {/* 現在の画像 */}
                <div>
                  <h4 className="text-sm font-bold text-gray-300 mb-3">現在の画像</h4>
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-700 shadow-lg">
                    <img
                      src={editingBanner.imageUrl}
                      alt="編集中の画像"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* ダウンロードボタン */}
                  <button
                    onClick={() => handleDownload(editingBanner)}
                    className="mt-3 w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    この画像をダウンロード
                  </button>
                </div>
                
                {/* 修正指示入力 */}
                <div>
                  <h4 className="text-sm font-bold text-gray-300 mb-3">修正指示を入力</h4>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="例：&#10;・背景をもっと明るくして&#10;・文字を大きくして&#10;・右下にロゴを追加して&#10;・全体的にポップな雰囲気に"
                    disabled={isEditing}
                    className="w-full h-40 px-4 py-3 bg-gray-800 border border-gray-600 focus:border-purple-500 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none text-sm disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 mt-2">{editPrompt.length} / 500文字</p>
                  
                  {/* 修正例 */}
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold text-gray-400">クイック修正:</p>
                    <div className="flex flex-wrap gap-2">
                      {['背景を明るく', '文字を大きく', 'コントラストを上げる', 'ポップな雰囲気に', '落ち着いた色合いに'].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setEditPrompt(prev => prev ? `${prev}\n・${suggestion}` : `・${suggestion}`)}
                          disabled={isEditing}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* 修正実行ボタン */}
                  <button
                    onClick={async () => {
                      if (!editPrompt.trim()) {
                        toast.error('修正指示を入力してください')
                        return
                      }
                      
                      setIsEditing(true)
                      try {
                        // 修正APIを呼び出し
                        const res = await fetch('/api/banner/test/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            template: selectedTemplate?.category || 'it',
                            size: `${customWidth}x${customHeight}`,
                            industry: selectedTemplate?.industry || '',
                            mainTitle: serviceName,
                            count: 1,
                            basePrompt: editingBanner.prompt || selectedTemplate?.prompt || '',
                            customPrompt: `【修正指示】\n${editPrompt}\n\n【元の画像の特徴を維持しつつ、上記の修正を適用してください】`,
                          }),
                        })
                        
                        const result = await res.json()
                        
                        if (result.banners && result.banners.length > 0) {
                          // 修正された画像を追加
                          const newBanner: GeneratedBanner = {
                            id: `edited-${Date.now()}`,
                            imageUrl: result.banners[0],
                            prompt: editPrompt,
                            createdAt: new Date(),
                          }
                          setGeneratedBanners(prev => [newBanner, ...prev])
                          setEditingBanner(newBanner)
                          setEditPrompt('')
                          toast.success('画像を修正しました！')
                          incrementGenerationCount(1)
                        } else {
                          throw new Error(result.error || '修正に失敗しました')
                        }
                      } catch (err: any) {
                        console.error('Edit error:', err)
                        toast.error(err.message || '修正に失敗しました')
                      } finally {
                        setIsEditing(false)
                      }
                    }}
                    disabled={isEditing || !editPrompt.trim()}
                    className="mt-4 w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                  >
                    {isEditing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        修正中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        この指示で修正する
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* フッター */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-700/50">
                  <p className="text-xs text-purple-300">
                    💡 ヒント：具体的な指示ほど正確に反映されます。「もっと明るく」より「背景を白に近い明るさに」のように指定してください。
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📝 プロンプト閲覧モーダル（エンタープライズ限定） */}
      <AnimatePresence>
        {showPromptModal && viewingPromptBanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 overflow-hidden"
            onClick={() => setShowPromptModal(false)}
          >
            {/* 背景オーバーレイ */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            
            {/* モーダルコンテンツ */}
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-[calc(100%-24px)] sm:max-w-4xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-indigo-500/30 max-h-[90vh] overflow-y-auto"
            >
              {/* ヘッダー */}
              <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-r from-indigo-600 to-blue-500 flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-lg md:text-xl font-bold text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      プロンプト詳細
                      <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 text-[10px] sm:text-xs font-bold rounded-full">ENTERPRISE</span>
                    </h3>
                    <p className="text-white/80 text-[10px] sm:text-xs md:text-sm">この画像を生成したプロンプトを確認できます</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPromptModal(false)}
                  className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors shrink-0"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </button>
              </div>
              
              {/* コンテンツ */}
              <div className="p-3 sm:p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                {/* 画像プレビュー - 選択したサイズに合わせる */}
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-gray-300 mb-2 sm:mb-3">生成された画像</h4>
                  <div 
                    className="relative rounded-lg sm:rounded-xl overflow-hidden border border-gray-700 shadow-lg bg-gray-900"
                    style={{
                      aspectRatio: `${selectedSize.width} / ${selectedSize.height}`,
                    }}
                  >
                    <img
                      src={viewingPromptBanner.imageUrl}
                      alt="生成画像"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {/* ダウンロードボタン */}
                  <button
                    onClick={() => handleDownload(viewingPromptBanner)}
                    className="mt-2 sm:mt-3 w-full py-2 sm:py-2.5 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    画像をダウンロード
                  </button>
                </div>
                
                {/* プロンプト表示 */}
                <div>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <h4 className="text-xs sm:text-sm font-bold text-gray-300">使用プロンプト</h4>
                    <div className="flex gap-1.5 sm:gap-2">
                      <button
                        onClick={() => {
                          const prompt = viewingPromptBanner.prompt || selectedTemplate?.prompt || '（プロンプト情報なし）'
                          navigator.clipboard.writeText(prompt)
                          toast.success('プロンプトをコピーしました')
                        }}
                        className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-[10px] sm:text-xs font-medium rounded-lg transition-colors flex items-center gap-1 sm:gap-1.5"
                      >
                        <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        コピー
                      </button>
                      <button
                        onClick={() => {
                          const prompt = viewingPromptBanner.prompt || selectedTemplate?.prompt || '（プロンプト情報なし）'
                          const blob = new Blob([prompt], { type: 'text/plain' })
                          const url = URL.createObjectURL(blob)
                          const link = document.createElement('a')
                          link.href = url
                          link.download = `prompt-${viewingPromptBanner.id}.txt`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          URL.revokeObjectURL(url)
                          toast.success('プロンプトをダウンロードしました')
                        }}
                        className="px-2 sm:px-3 py-1 sm:py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs font-medium rounded-lg transition-colors flex items-center gap-1 sm:gap-1.5"
                      >
                        <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        DL
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg sm:rounded-xl p-3 sm:p-4 h-[150px] sm:h-[200px] md:h-[250px] overflow-y-auto">
                    <pre className="text-[10px] sm:text-xs md:text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {viewingPromptBanner.prompt || selectedTemplate?.prompt || '（プロンプト情報なし）'}
                    </pre>
                  </div>
                  
                  {/* プロンプト活用ヒント */}
                  <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-indigo-900/30 rounded-lg border border-indigo-700/50">
                    <h5 className="text-[10px] sm:text-xs font-bold text-indigo-300 mb-1.5 sm:mb-2">💡 プロンプト活用のヒント</h5>
                    <ul className="text-[10px] sm:text-xs text-indigo-200/80 space-y-0.5 sm:space-y-1">
                      <li>• このプロンプトをベースに修正して新しい画像を生成できます</li>
                      <li>• 色やレイアウトの指示を変更して別バリエーションを作成</li>
                      <li>• 他のAI画像生成ツールでも使用可能です</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* フッター：画像＋プロンプト一括ダウンロード */}
              <div className="px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6">
                <button
                  onClick={async () => {
                    const prompt = viewingPromptBanner.prompt || selectedTemplate?.prompt || '（プロンプト情報なし）'
                    
                    // プロンプトをダウンロード
                    const promptBlob = new Blob([prompt], { type: 'text/plain' })
                    const promptUrl = URL.createObjectURL(promptBlob)
                    const promptLink = document.createElement('a')
                    promptLink.href = promptUrl
                    promptLink.download = `prompt-${viewingPromptBanner.id}.txt`
                    document.body.appendChild(promptLink)
                    promptLink.click()
                    document.body.removeChild(promptLink)
                    URL.revokeObjectURL(promptUrl)
                    
                    // 画像をダウンロード
                    setTimeout(() => {
                      handleDownload(viewingPromptBanner)
                    }, 500)
                    
                    toast.success('画像とプロンプトをダウンロードしました')
                  }}
                  className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-bold rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  画像＋プロンプトを一括ダウンロード
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
