'use client'

import { Suspense, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Sparkles, Loader2, Download, ChevronLeft, ChevronRight, Play, ImageIcon, Maximize2, X, Upload, User, Image as ImageLucide, Square, RectangleHorizontal, RectangleVertical, Crown, Lock, LogIn, FileText, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/DashboardLayout'
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
}

type GeneratedBanner = {
  id: string
  imageUrl: string
  prompt: string
  createdAt: Date
}

// サイズプリセット
const SIZE_PRESETS = [
  { id: 'feed', label: 'フィード', ratio: '1:1', width: 1080, height: 1080, icon: Square },
  { id: 'link', label: 'リンク', ratio: '1.91:1', width: 1200, height: 628, icon: RectangleHorizontal },
  { id: 'story', label: 'ストーリー', ratio: '9:16', width: 1080, height: 1920, icon: RectangleVertical },
  { id: 'custom', label: 'カスタム', ratio: 'カスタム', width: 1200, height: 628, icon: Square },
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
  dailyLimit: number // 1日の生成上限
  imagesPerGenre: number // 各ジャンルで使える画像数（左から何枚目まで）
  allUnlocked: boolean // 全画像解放かどうか
}

const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  GUEST: {
    label: 'ゲスト',
    maxCountPerGeneration: 3,
    dailyLimit: 5,
    imagesPerGenre: 1, // 各ジャンル左から1枚目のみ
    allUnlocked: false,
  },
  FREE: {
    label: 'ベーシック',
    maxCountPerGeneration: 3,
    dailyLimit: 10,
    imagesPerGenre: 3, // 各ジャンル左から3枚目まで
    allUnlocked: false,
  },
  PRO: {
    label: 'PROプラン',
    maxCountPerGeneration: 5,
    dailyLimit: 30,
    imagesPerGenre: Infinity, // 全画像
    allUnlocked: true,
  },
  ENTERPRISE: {
    label: 'Enterpriseプラン',
    maxCountPerGeneration: 10,
    dailyLimit: 200,
    imagesPerGenre: Infinity, // 全画像
    allUnlocked: true,
  },
}

// ロック状態の種類
type LockType = 'login' | 'pro' | 'enterprise' | null

// 後方互換性のためのPLAN_LIMITS
const PLAN_LIMITS = {
  FREE: { maxCount: 3, label: '無料プラン' },
  PRO: { maxCount: 5, label: 'PROプラン' },
  ENTERPRISE: { maxCount: 10, label: 'Enterpriseプラン' },
}

export default function BannerTestPage() {
  return (
    <Suspense fallback={null}>
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
  
  // 画像拡大モーダル用の状態
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null)

  // フォーム状態（拡張版）
  const [serviceName, setServiceName] = useState('')
  const [tone, setTone] = useState('')
  const [customText, setCustomText] = useState('')
  
  // 新しいフォーム状態
  const [selectedSize, setSelectedSize] = useState(SIZE_PRESETS[1]) // デフォルト: リンク (1200x628)
  const [customWidth, setCustomWidth] = useState(1200)
  const [customHeight, setCustomHeight] = useState(628)
  const [generateCount, setGenerateCount] = useState(3)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [personFile, setPersonFile] = useState<File | null>(null)
  const [personPreview, setPersonPreview] = useState<string | null>(null)
  
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
  
  // 今日の生成数（ローカルストレージから取得）
  const [todayGenerationCount, setTodayGenerationCount] = useState(0)
  
  // トライアル状態（ログイン後1時間は全機能解放）
  const [isTrialActive, setIsTrialActive] = useState(false)
  const [trialRemainingMinutes, setTrialRemainingMinutes] = useState(0)
  
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
  
  // 今日の生成数をローカルストレージから読み込み
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const stored = localStorage.getItem('bannerGenerationCount')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.date === today) {
          setTodayGenerationCount(data.count || 0)
        } else {
          // 日付が変わったらリセット
          localStorage.setItem('bannerGenerationCount', JSON.stringify({ date: today, count: 0 }))
          setTodayGenerationCount(0)
        }
      } catch {
        setTodayGenerationCount(0)
      }
    }
  }, [])
  
  // 画像のロック状態を判定する関数
  const getImageLockType = useCallback((template: BannerTemplate, indexInGenre: number): LockType => {
    // PRO以上は全解放
    if (planConfig.allUnlocked) return null
    
    // ジャンル内のインデックスで判定
    if (indexInGenre < planConfig.imagesPerGenre) {
      return null // 解放済み
    }
    
    // ロックされている場合、どのプランで解放されるか
    if (currentPlan === 'GUEST') {
      return 'login' // ログインで解放
    }
    if (currentPlan === 'FREE') {
      return 'pro' // PROで解放
    }
    return null
  }, [currentPlan, planConfig])
  
  // ロック画像クリック時のハンドラ
  const handleLockedImageClick = useCallback((template: BannerTemplate, lockType: LockType) => {
    setLockedTemplate(template)
    setLockModalType(lockType)
    setShowLockModal(true)
  }, [])
  
  // 1日の生成上限チェック
  const isOverDailyLimit = useMemo(() => {
    return todayGenerationCount >= planConfig.dailyLimit
  }, [todayGenerationCount, planConfig.dailyLimit])
  
  // 生成数を更新する関数
  const incrementGenerationCount = useCallback((count: number) => {
    const today = new Date().toISOString().split('T')[0]
    const newCount = todayGenerationCount + count
    setTodayGenerationCount(newCount)
    localStorage.setItem('bannerGenerationCount', JSON.stringify({ date: today, count: newCount }))
  }, [todayGenerationCount])
  
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

  // 画像読み込み完了ハンドラ
  const handleImageLoad = useCallback((id: string) => {
    setLoadedImages(prev => new Set(prev).add(id))
  }, [])

  // 画像エラーハンドラ
  const handleImageError = useCallback((id: string) => {
    setImageErrors(prev => new Set(prev).add(id))
  }, [])
  
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
        rootMargin: '200px', // 200px手前から読み込み開始
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
    'ビジネス / ブランディング': 'ビジネス / SaaS',
    'UX / デザイン / テクノロジー': 'IT・AI',
    'Web / IT / スクール / 教育': 'IT・AI',
    '転職・採用・人材': '採用',
    '人物写真 / ポートレート': '採用',
    '季節感 / イベント': 'イベント',
    'セール / キャンペーン': 'イベント',
    'EC・小売業のデジタルマーケティング戦略': 'EC',
    'カジュアル / 親しみやすい': 'EC',
    'にぎやか / ポップ': 'EC',
    '高級感 / きれいめ': '高級・ラグジュアリー',
    'かわいい / ポップ': '高級・ラグジュアリー',
    'ナチュラル / 爽やか': '高級・ラグジュアリー',
  }

  // テンプレートを取得（高速化: 最小限のデータを最初に取得）
  useEffect(() => {
    const CACHE_KEY = 'banner_templates_cache_v4'
    const CACHE_EXPIRY = 10 * 60 * 1000 // 10分間キャッシュ（延長）
    
    const fetchTemplates = async () => {
      const startTime = Date.now()
      
      try {
        // クライアント側キャッシュをチェック
        const cached = sessionStorage.getItem(CACHE_KEY)
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
                } else if (data.templates.length > 0) {
                  setSelectedTemplate(data.templates[0])
                }
              } else if (data.templates.length > 0) {
                setSelectedTemplate(data.templates[0])
              }
              
              setIsLoadingTemplates(false)
              console.log(`[Templates] Loaded from cache in ${Date.now() - startTime}ms`)
              return
            }
          } catch (e) {
            // キャッシュが壊れている場合は無視
            sessionStorage.removeItem(CACHE_KEY)
          }
        }
        
        // APIから取得（完全なプロンプトを含む）
        // minimal=falseで完全なプロンプトを取得（スタイル維持のため必須）
        const res = await fetch('/api/banner/test/templates?limit=100', {
          next: { revalidate: 300 }, // Next.js ISR: 5分間キャッシュ
        })
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        
        const data = await res.json()
        
        if (data.templates && Array.isArray(data.templates)) {
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
          
          // クライアント側キャッシュに保存
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
              data,
              timestamp: Date.now(),
            }))
          } catch (e) {
            // sessionStorageが満杯の場合は無視
          }
          
          // featuredTemplateを優先的に選択
          if (data.featuredTemplateId) {
            const featured = data.templates.find((t: BannerTemplate) => t.id === data.featuredTemplateId)
            if (featured) {
              setSelectedTemplate(featured)
            } else if (data.templates.length > 0) {
              setSelectedTemplate(data.templates[0])
            }
          } else if (data.templates.length > 0) {
            setSelectedTemplate(data.templates[0])
          }
          
          console.log(`[Templates] Loaded ${data.templates.length} templates in ${Date.now() - startTime}ms (API: ${data.loadTime}ms)`)
        }
      } catch (err) {
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
    const categoryOrder = ['ビジネス / SaaS', 'IT・AI', '採用', 'イベント', 'EC', '高級・ラグジュアリー']
    
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
      // サイズ文字列を生成（カスタムサイズの場合はカスタム値を使用）
      const finalWidth = selectedSize.id === 'custom' ? customWidth : selectedSize.width
      const finalHeight = selectedSize.id === 'custom' ? customHeight : selectedSize.height
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
    <DashboardLayout>
      <div className="min-h-screen bg-black text-white -m-4 sm:-m-6 md:-m-8">
        {/* トライアルバナー（ログイン後1時間） */}
        {isTrialActive && (
          <div className="fixed top-16 left-0 md:left-[240px] right-0 z-40 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium shadow-lg">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>🎉 全機能無料トライアル中！</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
              残り {trialRemainingMinutes}分
            </span>
            <span className="hidden sm:inline text-white/80">- エンタープライズ機能をお試しください</span>
          </div>
        )}
        
        {/* Netflix風のメインコンテンツ */}
        <div className={`relative ${isTrialActive ? 'pt-20 md:pt-8' : 'pt-12 md:pt-0'}`}>
          {/* 大きなヒーロー画像（選択されたバナーまたはテンプレート）- スティッキー */}
          <div className={`sticky ${isTrialActive ? 'top-20 md:top-8' : 'top-12 md:top-0'} z-20 h-[32vh] sm:h-[40vh] md:h-[50vh] lg:h-[55vh] w-full overflow-hidden`}>
            {/* グラデーション: 下は黒、上は明るく */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent z-10" />
            {selectedBanner ? (
              <img
                src={selectedBanner.imageUrl}
                alt="Selected banner"
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : selectedTemplate?.imageUrl && !imageErrors.has(selectedTemplate.id) ? (
              <img
                src={selectedTemplate.imageUrl}
                alt={selectedTemplate.prompt}
                loading="eager"
                decoding="async"
                onError={() => handleImageError(selectedTemplate.id)}
                className="w-full h-full object-cover"
              />
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
            
            {/* オーバーレイ情報（Netflix風） */}
            <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-4 md:p-6 lg:p-8 z-20">
              <div className="max-w-6xl mx-auto">
                {/* メインタイトル：日本語の短いタイトルを優先表示 */}
                <h1 className="text-base sm:text-xl md:text-3xl lg:text-4xl font-black mb-0.5 sm:mb-2 drop-shadow-2xl leading-tight">
                  {selectedBanner 
                    ? serviceName || '生成されたバナー'
                    : selectedTemplate?.displayTitle || selectedTemplate?.name || selectedTemplate?.industry || 'バナーテンプレート'
                  }
                </h1>
                {/* サブタイトル：ジャンル名 */}
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-200 mb-1 drop-shadow-lg font-medium">
                  {selectedBanner 
                    ? (tone ? `トーン: ${tone}` : '')
                    : selectedTemplate?.industry || ''
                  }
                </p>
                {/* プロンプト表示：アイコン付きで分かりやすく（スマホでは非表示） */}
                {!selectedBanner && selectedTemplate && (
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
                <div className="flex gap-2 flex-wrap">
                  {!selectedBanner && selectedTemplate && (
                    <>
                      <button
                        onClick={() => {
                          const formElement = document.getElementById('banner-form')
                          if (formElement) {
                            formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }
                        }}
                        className="px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition-all flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm shadow-lg hover:shadow-xl"
                      >
                        <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
                        <span className="whitespace-nowrap">このスタイルで生成</span>
                      </button>
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
              </div>
            </div>
          </div>

          {/* テンプレート一覧（Netflix風の横スクロール） */}
          <div className="w-full overflow-x-hidden px-0 sm:px-4 md:px-8 lg:px-12 pt-3 sm:pt-6 md:pt-8 relative z-10 space-y-4 sm:space-y-6 md:space-y-10 bg-black pb-6 sm:pb-8">
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : (
              Object.entries(templatesByCategory).map(([categoryName, categoryTemplates]) => {
                if (!categoryTemplates || categoryTemplates.length === 0) return null
                
                return (
                  <div key={categoryName} className="space-y-1.5 sm:space-y-3">
                    <h2 className="text-sm sm:text-lg md:text-2xl lg:text-3xl font-bold px-3 sm:px-2 md:px-4 text-white flex items-center gap-1.5 sm:gap-2">
                      <span className="text-blue-400 text-xs sm:text-base">▶</span> {categoryName}
                    </h2>
                    <div className="relative group/scroll">
                      {/* 左側グラデーションオーバーレイ（スクロール可能な場合のみ表示） */}
                      {scrollPositions[categoryName]?.canScrollLeft && (
                        <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 md:w-20 bg-gradient-to-r from-black via-black/50 to-transparent z-10 pointer-events-none" />
                      )}
                      
                      {/* 左スクロールボタン（スクロール可能な場合のみ表示） */}
                      <button
                        onClick={() => scroll('left', categoryName)}
                        className={`absolute left-0 top-0 bottom-0 z-20 w-8 sm:w-10 md:w-16 bg-transparent flex items-center justify-center transition-all duration-300 ${
                          scrollPositions[categoryName]?.canScrollLeft
                            ? 'opacity-60 sm:opacity-40 md:opacity-0 group-hover/scroll:opacity-100'
                            : 'opacity-0 pointer-events-none'
                        }`}
                        aria-label="左にスクロール"
                      >
                        <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110 shadow-lg border border-white/20">
                          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-8 md:h-8 text-white" />
                        </div>
                      </button>
                      
                      {/* 横スクロールコンテナ（タッチ/マウススワイプ対応） */}
                      <div
                        ref={(el) => { scrollRefs.current[categoryName] = el }}
                        className="flex gap-2 sm:gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-0 sm:px-10 md:px-16 py-1.5 sm:py-2 md:py-4 cursor-grab active:cursor-grabbing select-none"
                        style={{ 
                          scrollbarWidth: 'none', 
                          msOverflowStyle: 'none',
                          WebkitOverflowScrolling: 'touch',
                          scrollPaddingLeft: '12px',
                          scrollPaddingRight: '12px',
                          willChange: 'scroll-position',
                        }}
                        onScroll={() => handleScroll(categoryName)}
                        onTouchStart={(e) => handleTouchStart(e, categoryName)}
                        onTouchMove={(e) => handleTouchMove(e, categoryName)}
                        onTouchEnd={(e) => handleTouchEnd(e, categoryName)}
                        onMouseDown={(e) => handleMouseDown(e, categoryName)}
                        onMouseMove={(e) => handleMouseMove(e, categoryName)}
                        onMouseUp={() => handleMouseUp(categoryName)}
                        onMouseLeave={() => handleMouseLeave(categoryName)}
                        onWheel={(e) => handleWheel(e, categoryName)}
                      >
                        {categoryTemplates.map((template, index) => {
                          const hasError = imageErrors.has(template.id)
                          const isLoaded = loadedImages.has(template.id)
                          const isVisible = visibleImages.has(template.id)
                          const showImage = template.imageUrl && !hasError
                          const isFirst = index === 0
                          const isLast = index === categoryTemplates.length - 1
                          
                          // ロック状態を判定
                          const lockType = getImageLockType(template, index)
                          const isLocked = lockType !== null
                          
                          return (
                            <motion.div
                              key={template.id}
                              ref={(el) => observeImage(el, template.id)}
                              whileHover={{ scale: isLocked ? 1.02 : 1.08, y: isLocked ? -4 : -12, zIndex: 10 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                if (isLocked) {
                                  handleLockedImageClick(template, lockType)
                                } else {
                                  setSelectedTemplate(template)
                                  setSelectedBanner(null)
                                }
                              }}
                              className={`group flex-shrink-0 w-36 h-20 sm:w-48 sm:h-28 md:w-64 md:h-36 lg:w-80 lg:h-44 rounded-md md:rounded-lg overflow-hidden cursor-pointer transition-all duration-300 relative ${
                                isFirst ? 'ml-3 sm:ml-0' : ''
                              } ${
                                isLast ? 'mr-3 sm:mr-0' : ''
                              } ${
                                isLocked
                                  ? 'ring-1 ring-gray-700 opacity-70 hover:opacity-90'
                                  : selectedTemplate?.id === template.id
                                    ? 'ring-3 ring-white scale-105 shadow-2xl'
                                    : 'ring-1 ring-gray-800 hover:ring-gray-600'
                              }`}
                            >
                              {showImage && isVisible ? (
                                <>
                                  {/* 読み込み中のプレースホルダー */}
                                  {!isLoaded && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center">
                                      <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                                    </div>
                                  )}
                                  <img
                                    src={template.imageUrl!}
                                    alt={template.displayTitle || template.industry}
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={() => handleImageLoad(template.id)}
                                    onError={() => handleImageError(template.id)}
                                    className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                </>
                              ) : showImage && !isVisible ? (
                                // ビューポート外：プレースホルダー表示（画像は読み込まない）
                                <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center">
                                  <div className="w-8 h-8 rounded-full bg-gray-700/50" />
                                </div>
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black flex flex-col items-center justify-center p-3 md:p-4 relative overflow-hidden">
                                  <div className="absolute inset-0 opacity-20">
                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
                                  </div>
                                  <ImageIcon className="w-8 h-8 md:w-12 md:h-12 text-gray-500 mb-2 relative z-10" />
                                  <p className="text-xs md:text-sm text-gray-500 text-center relative z-10 line-clamp-2 px-2">
                                    {template.displayTitle || template.industry}
                                  </p>
                                </div>
                              )}
                              {/* 画像名ラベル（常に表示） */}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-1.5 sm:p-2 md:p-3 z-10">
                                <p className="text-[8px] sm:text-[10px] md:text-sm font-bold text-white line-clamp-1 drop-shadow-lg">
                                  {template.displayTitle || template.name || template.industry}
                                </p>
                                <p className="text-[6px] sm:text-[8px] md:text-[10px] text-gray-300 line-clamp-1 hidden sm:block">
                                  {categoryMapping[template.industry] || template.industry}
                                </p>
                              </div>
                              {/* 拡大ボタン（ホバー時に表示） */}
                              {showImage && isLoaded && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (template.imageUrl) {
                                      setZoomImage({
                                        url: template.imageUrl,
                                        title: template.displayTitle || template.name || template.industry
                                      })
                                    }
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                  title="画像を拡大表示"
                                >
                                  <Maximize2 className="w-4 h-4 text-white" />
                                </button>
                              )}
                              {selectedTemplate?.id === template.id && !isLocked && (
                                <div className="absolute -inset-2 ring-4 ring-blue-400 rounded-xl pointer-events-none z-20 shadow-[0_0_30px_rgba(59,130,246,0.6)] animate-pulse">
                                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-1.5 rounded-full shadow-lg">
                                    <p className="text-xs font-bold text-white whitespace-nowrap flex items-center gap-1">
                                      <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                                      選択中
                                    </p>
                                  </div>
                                </div>
                              )}
                              
                              {/* ロックUI */}
                              {isLocked && (
                                <>
                                  {/* 暗いオーバーレイ */}
                                  <div className="absolute inset-0 bg-black/50 z-15 pointer-events-none" />
                                  
                                  {/* ロックアイコン（右上） */}
                                  <div className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-20 flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md ${
                                    lockType === 'login' 
                                      ? 'bg-red-500/90' 
                                      : lockType === 'pro'
                                        ? 'bg-amber-500/90'
                                        : 'bg-purple-500/90'
                                  }`}>
                                    <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                                    <span className="text-[8px] sm:text-[10px] font-bold text-white">
                                      {lockType === 'login' ? 'ログイン' : lockType === 'pro' ? 'PRO' : 'ENTERPRISE'}
                                    </span>
                                  </div>
                                  
                                  {/* ホバー時のメッセージ */}
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                    <div className="bg-black/80 px-3 py-2 rounded-lg text-center max-w-[90%]">
                                      <p className="text-[10px] sm:text-xs text-white font-medium">
                                        {lockType === 'login' 
                                          ? 'ログインすると使えます' 
                                          : lockType === 'pro'
                                            ? 'PROプランで解放されます'
                                            : 'Enterpriseで解放されます'}
                                      </p>
                                    </div>
                                  </div>
                                </>
                              )}
                            </motion.div>
                          )
                        })}
                        
                        {/* 「もっと見る」ボタン（残りのテンプレートがある場合のみ表示） */}
                        {(() => {
                          const totalCount = (totalTemplatesByCategory[categoryName] || []).length
                          const visibleCount = visibleCounts[categoryName] || INITIAL_VISIBLE_COUNT
                          const hasMore = totalCount > visibleCount
                          
                          if (!hasMore) return null
                          
                          return (
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="flex-shrink-0 w-36 h-20 sm:w-48 sm:h-28 md:w-64 md:h-36 lg:w-80 lg:h-44 rounded-md md:rounded-lg overflow-hidden cursor-pointer mr-3 sm:mr-0"
                            >
                              <button
                                onClick={() => loadMoreTemplates(categoryName)}
                                className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black border-2 border-gray-700 hover:border-gray-500 transition-all flex flex-col items-center justify-center gap-1 sm:gap-2 md:gap-3 group"
                              >
                                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-white/10 group-hover:bg-white/20 transition-all flex items-center justify-center">
                                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                                </div>
                                <p className="text-[10px] sm:text-xs md:text-sm font-bold text-white">
                                  もっと見る
                                </p>
                                <p className="text-[8px] sm:text-[10px] md:text-xs text-gray-400">
                                  +{totalCount - visibleCount}件
                                </p>
                              </button>
                            </motion.div>
                          )
                        })()}
                      </div>

                      {/* 右側グラデーションオーバーレイ（スクロール可能な場合のみ表示） */}
                      {scrollPositions[categoryName]?.canScrollRight && (
                        <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 md:w-20 bg-gradient-to-l from-black via-black/50 to-transparent z-10 pointer-events-none" />
                      )}
                      
                      {/* 右スクロールボタン（スクロール可能な場合のみ表示） */}
                      <button
                        onClick={() => scroll('right', categoryName)}
                        className={`absolute right-0 top-0 bottom-0 z-20 w-8 sm:w-10 md:w-16 bg-transparent flex items-center justify-center transition-all duration-300 ${
                          scrollPositions[categoryName]?.canScrollRight
                            ? 'opacity-60 sm:opacity-40 md:opacity-0 group-hover/scroll:opacity-100'
                            : 'opacity-0 pointer-events-none'
                        }`}
                        aria-label="右にスクロール"
                      >
                        <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110 shadow-lg border border-white/20">
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-8 md:h-8 text-white" />
                        </div>
                      </button>
                    </div>
                  </div>
                )
              }).filter(Boolean)
            )}
          </div>

          {/* 生成フォーム（選択されたテンプレートに基づく、バナー選択時は非表示） */}
          {selectedTemplate && !selectedBanner && (
            <div id="banner-form" className="w-full overflow-x-hidden px-3 sm:px-4 md:px-8 lg:px-12 py-6 sm:py-8 md:py-12 bg-black/95 backdrop-blur-sm scroll-mt-4">
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
                            {size.id !== 'custom' && (
                              <span className="text-[10px] sm:text-xs opacity-70">{size.ratio}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    
                    {/* カスタムサイズ入力（カスタムが選択されている場合のみ表示） */}
                    {selectedSize.id === 'custom' && (
                      <div className="mt-3 p-3 sm:p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-xs sm:text-sm font-bold mb-3 text-white">カスタムサイズを入力</p>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] sm:text-xs text-gray-400 mb-1 block">幅 (px)</label>
                            <input
                              type="number"
                              value={customWidth}
                              onChange={(e) => setCustomWidth(Math.max(100, Math.min(4096, parseInt(e.target.value) || 100)))}
                              min={100}
                              max={4096}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <span className="text-gray-400 font-bold mt-5">×</span>
                          <div className="flex-1">
                            <label className="text-[10px] sm:text-xs text-gray-400 mb-1 block">高さ (px)</label>
                            <input
                              type="number"
                              value={customHeight}
                              onChange={(e) => setCustomHeight(Math.max(100, Math.min(4096, parseInt(e.target.value) || 100)))}
                              min={100}
                              max={4096}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">※ 100〜4096pxの範囲で指定できます</p>
                      </div>
                    )}
                    
                    <div className="mt-2 sm:mt-3 flex items-center justify-center">
                      <div className="bg-gray-800 rounded-lg p-3 sm:p-4 flex flex-col items-center">
                        {(() => {
                          const displayWidth = selectedSize.id === 'custom' ? customWidth : selectedSize.width
                          const displayHeight = selectedSize.id === 'custom' ? customHeight : selectedSize.height
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
                      デフォルトは3枚（A/B/C）。
                      {userPlan === 'FREE' ? (
                        <span className="text-yellow-400"> 有料プランは最大10枚まで増やせます。</span>
                      ) : (
                        <span className="text-green-400"> {planLimits.label}で最大{planLimits.maxCount}枚まで生成可能。</span>
                      )}
                      <span className="text-orange-400 font-medium"> 枚数を増やすほど時間がかかります。</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {[3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
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
                            <span className="font-bold">PROプラン</span>にアップグレードすると最大10枚まで生成可能
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
                        <span className="px-2 py-0.5 bg-purple-600/30 rounded text-[9px] text-purple-200">✓ 1日200枚生成</span>
                        <span className="px-2 py-0.5 bg-purple-600/30 rounded text-[9px] text-purple-200">✓ 詳細指示</span>
                      </div>
                    </div>
                  )}
                  
                  {/* 今日の生成状況 */}
                  <div className="p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm font-bold text-gray-300">今日の生成状況</span>
                      <span className={`text-xs sm:text-sm font-bold ${
                        isOverDailyLimit ? 'text-red-400' : todayGenerationCount > planConfig.dailyLimit * 0.8 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {todayGenerationCount} / {planConfig.dailyLimit}枚
                        {isTrialActive && <span className="text-purple-400 ml-1">(トライアル)</span>}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          isTrialActive ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                          isOverDailyLimit ? 'bg-red-500' : todayGenerationCount > planConfig.dailyLimit * 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((todayGenerationCount / planConfig.dailyLimit) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1.5">
                      {isTrialActive ? 'トライアル' : planConfig.label}：1日{planConfig.dailyLimit}枚まで生成可能
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
                  ) : isOverDailyLimit ? (
                    <div className="w-full py-3 sm:py-4 bg-gray-700 text-white rounded-lg sm:rounded-xl text-center">
                      <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm sm:text-base">
                        <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                        本日の生成上限（{planConfig.dailyLimit}枚）に達しました
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        明日0時にリセットされます
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
                    {/* 画像 */}
                    <div 
                      className="relative aspect-[16/9] cursor-pointer"
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
                        className="w-full h-full object-cover"
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
            className="fixed inset-0 z-[200] flex items-center justify-center"
          >
            {/* 背景オーバーレイ（グラデーション） */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-blue-900/95 via-purple-900/95 to-black/95 backdrop-blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
            
            {/* パーティクルアニメーション背景 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-white/20 rounded-full"
                  initial={{ 
                    x: Math.random() * window.innerWidth, 
                    y: window.innerHeight + 100,
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
              className="relative z-10 w-full max-w-4xl mx-4 p-6 sm:p-8 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl"
            >
              {!generationComplete ? (
                /* 生成中の表示 */
                <>
                  {/* ヘッダー */}
                  <div className="text-center mb-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="inline-block mb-4"
                    >
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-1">
                        <div className="w-full h-full rounded-full bg-black/50 flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    </motion.div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                      🎨 バナーを生成中...
                    </h2>
                    <motion.p 
                      key={loadingMessage}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-blue-200 text-lg"
                    >
                      {loadingMessage}
                    </motion.p>
                  </div>

                  {/* プログレスバー */}
                  <div className="mb-8">
                    <div className="flex justify-between text-sm text-white/70 mb-2">
                      <span>進捗</span>
                      <span>{Math.round(generationProgress)}%</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${generationProgress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>

                  {/* 入力内容と参考画像 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 参考画像（大きく表示） */}
                    <div className="space-y-3">
                      <h3 className="text-white/80 font-semibold flex items-center gap-2">
                        <ImageLucide className="w-5 h-5" />
                        参考スタイル
                      </h3>
                      <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-white/30 shadow-lg">
                        <img
                          src={selectedTemplate.imageUrl || selectedTemplate.previewUrl || ''}
                          alt={selectedTemplate.displayTitle || selectedTemplate.name || '参考画像'}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="text-white font-bold text-lg drop-shadow-lg">
                            {selectedTemplate.displayTitle || selectedTemplate.name}
                          </p>
                          <p className="text-white/70 text-sm">{selectedTemplate.industry}</p>
                        </div>
                        {/* パルスアニメーション */}
                        <motion.div
                          className="absolute inset-0 border-4 border-blue-400 rounded-xl"
                          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.02, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                    </div>

                    {/* 入力内容 */}
                    <div className="space-y-4">
                      <h3 className="text-white/80 font-semibold flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        生成設定
                      </h3>
                      <div className="space-y-3 bg-white/5 rounded-xl p-4 border border-white/10">
                        <div>
                          <p className="text-white/50 text-xs mb-1">入れたいテキスト</p>
                          <p className="text-white font-medium text-lg">{serviceName}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-white/50 text-xs mb-1">サイズ</p>
                            <p className="text-white font-medium">
                              {selectedSize.id === 'custom' 
                                ? `${customWidth}×${customHeight}` 
                                : `${selectedSize.width}×${selectedSize.height}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/50 text-xs mb-1">生成枚数</p>
                            <p className="text-white font-medium">{generateCount}枚</p>
                          </div>
                        </div>
                        {(logoPreview || personPreview) && (
                          <div className="flex gap-3 pt-2 border-t border-white/10">
                            {logoPreview && (
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10">
                                  <img src={logoPreview} alt="ロゴ" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-white/70 text-sm">ロゴ</span>
                              </div>
                            )}
                            {personPreview && (
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10">
                                  <img src={personPreview} alt="人物" className="w-full h-full object-cover" />
                                </div>
                                <span className="text-white/70 text-sm">人物</span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* カスタムプロンプト表示（エンタープライズ） */}
                        {customPrompt && (
                          <div className="pt-2 border-t border-white/10">
                            <p className="text-white/50 text-xs mb-1 flex items-center gap-1">
                              <span className="px-1.5 py-0.5 bg-purple-600 text-[8px] font-bold rounded">ENTERPRISE</span>
                              詳細指示
                            </p>
                            <p className="text-white/80 text-xs line-clamp-2">{customPrompt}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 生成中のヒント */}
                  <div className="mt-6 text-center">
                    <p className="text-white/50 text-sm">
                      ✨ AIが選択したスタイルを分析し、あなたのテキストに合わせてバナーを生成しています
                      {customPrompt && '（カスタム指示を適用中）'}
                    </p>
                  </div>
                </>
              ) : (
                /* 完了時の表示 */
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15, stiffness: 300 }}
                  className="text-center py-8"
                >
                  {/* 成功アイコン */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.5, times: [0, 0.6, 1] }}
                    className="mb-6"
                  >
                    <div className="inline-block relative">
                      <motion.div
                        className="absolute inset-0 bg-green-500/30 rounded-full"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <div className="relative w-24 h-24 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                        <motion.svg
                          className="w-12 h-12 text-white"
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
                    className="text-3xl sm:text-4xl font-bold text-white mb-3"
                  >
                    🎉 生成完了！
                  </motion.h2>
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-xl text-green-300 mb-6"
                  >
                    {generatedBanners.length}枚のバナーが完成しました
                  </motion.p>

                  {/* 生成された画像のプレビュー */}
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex justify-center gap-3 flex-wrap"
                  >
                    {generatedBanners.slice(0, 3).map((banner, idx) => (
                      <motion.div
                        key={banner.id}
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.6 + idx * 0.1, type: "spring" }}
                        className="w-32 h-20 rounded-lg overflow-hidden border-2 border-white/30 shadow-lg"
                      >
                        <img
                          src={banner.imageUrl}
                          alt={`生成バナー ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </motion.div>
                    ))}
                    {generatedBanners.length > 3 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.9, type: "spring" }}
                        className="w-32 h-20 rounded-lg bg-white/10 border-2 border-white/30 flex items-center justify-center"
                      >
                        <span className="text-white font-bold">+{generatedBanners.length - 3}</span>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* 紙吹雪エフェクト */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(30)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-3 h-3 rounded-sm"
                        style={{
                          background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][i % 6],
                          left: `${Math.random() * 100}%`,
                        }}
                        initial={{ y: -20, rotate: 0, opacity: 1 }}
                        animate={{ 
                          y: window.innerHeight + 100,
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
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
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
              className="relative z-10 w-full max-w-md bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-700"
            >
              {/* ヘッダー（ロックタイプに応じた色） */}
              <div className={`p-6 ${
                lockModalType === 'login' 
                  ? 'bg-gradient-to-r from-red-600 to-red-500' 
                  : lockModalType === 'pro'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500'
                    : 'bg-gradient-to-r from-purple-600 to-purple-500'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {lockModalType === 'login' 
                        ? 'ログインが必要です' 
                        : lockModalType === 'pro'
                          ? 'PROプランで解放'
                          : 'Enterpriseプランで解放'}
                    </h3>
                    <p className="text-white/80 text-sm">
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
              <div className="p-6">
                <div className="relative aspect-video rounded-lg overflow-hidden mb-4 border border-gray-700">
                  {lockedTemplate.imageUrl ? (
                    <img
                      src={lockedTemplate.imageUrl}
                      alt={lockedTemplate.displayTitle || lockedTemplate.name || ''}
                      className="w-full h-full object-cover opacity-50"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <ImageLucide className="w-12 h-12 text-gray-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-300 text-center mb-6">
                  「{lockedTemplate.displayTitle || lockedTemplate.name || lockedTemplate.industry}」を使用するには
                  {lockModalType === 'login' 
                    ? 'ログインしてください' 
                    : lockModalType === 'pro'
                      ? 'PROプランにアップグレードしてください'
                      : 'Enterpriseプランにアップグレードしてください'}
                </p>
                
                {/* アクションボタン */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLockModal(false)}
                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                  >
                    閉じる
                  </button>
                  {lockModalType === 'login' ? (
                    <a
                      href="/auth/doyamarke/signin?callbackUrl=/banner/test"
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-5 h-5" />
                      ログイン
                    </a>
                  ) : (
                    <a
                      href="/banner/dashboard/plan"
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Crown className="w-5 h-5" />
                      プランを見る
                    </a>
                  )}
                </div>
              </div>
              
              {/* プラン比較（簡易版） */}
              <div className="px-6 pb-6">
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm font-bold text-white mb-3">プラン別の画像解放数</h4>
                  <div className="space-y-2 text-sm">
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
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
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
              className="relative z-10 w-full max-w-4xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-purple-500/30"
            >
              {/* ヘッダー */}
              <div className="p-4 sm:p-6 bg-gradient-to-r from-purple-600 to-pink-500 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      画像を修正
                      <span className="px-2 py-0.5 bg-white/20 text-xs font-bold rounded-full">ENTERPRISE</span>
                    </h3>
                    <p className="text-white/80 text-sm">AIに指示を出して画像を修正できます</p>
                  </div>
                </div>
                <button
                  onClick={() => !isEditing && setShowEditModal(false)}
                  disabled={isEditing}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              {/* コンテンツ */}
              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
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
              className="relative z-10 w-full max-w-4xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-indigo-500/30"
            >
              {/* ヘッダー */}
              <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-600 to-blue-500 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      プロンプト詳細
                      <span className="px-2 py-0.5 bg-white/20 text-xs font-bold rounded-full">ENTERPRISE</span>
                    </h3>
                    <p className="text-white/80 text-sm">この画像を生成したプロンプトを確認できます</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPromptModal(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              {/* コンテンツ */}
              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 画像プレビュー */}
                <div>
                  <h4 className="text-sm font-bold text-gray-300 mb-3">生成された画像</h4>
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-700 shadow-lg">
                    <img
                      src={viewingPromptBanner.imageUrl}
                      alt="生成画像"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* ダウンロードボタン */}
                  <button
                    onClick={() => handleDownload(viewingPromptBanner)}
                    className="mt-3 w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    画像をダウンロード
                  </button>
                </div>
                
                {/* プロンプト表示 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-300">使用プロンプト</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const prompt = viewingPromptBanner.prompt || selectedTemplate?.prompt || '（プロンプト情報なし）'
                          navigator.clipboard.writeText(prompt)
                          toast.success('プロンプトをコピーしました')
                        }}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
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
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        DL
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 h-[200px] sm:h-[250px] overflow-y-auto">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {viewingPromptBanner.prompt || selectedTemplate?.prompt || '（プロンプト情報なし）'}
                    </pre>
                  </div>
                  
                  {/* プロンプト活用ヒント */}
                  <div className="mt-4 p-3 bg-indigo-900/30 rounded-lg border border-indigo-700/50">
                    <h5 className="text-xs font-bold text-indigo-300 mb-2">💡 プロンプト活用のヒント</h5>
                    <ul className="text-xs text-indigo-200/80 space-y-1">
                      <li>• このプロンプトをベースに修正して新しい画像を生成できます</li>
                      <li>• 色やレイアウトの指示を変更して別バリエーションを作成</li>
                      <li>• 他のAI画像生成ツールでも使用可能です</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* フッター：画像＋プロンプト一括ダウンロード */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
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
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  画像＋プロンプトを一括ダウンロード
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
