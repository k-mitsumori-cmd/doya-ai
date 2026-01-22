'use client'

import { Suspense, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Sparkles, Loader2, Download, ChevronLeft, ChevronRight, Play, ImageIcon, Maximize2, X, Upload, User, Image as ImageLucide, Square, RectangleHorizontal, RectangleVertical, Crown, Menu } from 'lucide-react'
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

// プラン別の生成枚数上限
const PLAN_LIMITS = {
  FREE: { maxCount: 3, label: '無料プラン' },
  PRO: { maxCount: 10, label: 'PROプラン' },
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
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
  
  // 生成中のローディング状態
  const [loadingMessage, setLoadingMessage] = useState('')
  const [generationProgress, setGenerationProgress] = useState(0)
  
  // ユーザープラン
  const userPlan = useMemo(() => {
    const user = session?.user as any
    const plan = user?.bannerPlan || user?.plan || 'FREE'
    return String(plan).toUpperCase() as 'FREE' | 'PRO' | 'ENTERPRISE'
  }, [session])
  
  const planLimits = useMemo(() => PLAN_LIMITS[userPlan] || PLAN_LIMITS.FREE, [userPlan])
  
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
            
            // キャッシュが有効な場合は使用
            if (now - timestamp < CACHE_EXPIRY && data.templates && Array.isArray(data.templates)) {
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
        
        // APIから取得（最小限モードで高速化）
        const res = await fetch('/api/banner/test/templates?minimal=true&limit=100', {
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
  
  // マウスホイール/トラックパッドでの横スクロール（Netflix風）- 軽快なスワイプ
  const handleWheel = useCallback((e: React.WheelEvent, category: string) => {
    const container = scrollRefs.current[category]
    if (!container) return
    
    const hasHorizontalScroll = container.scrollWidth > container.clientWidth
    if (!hasHorizontalScroll) return
    
    // トラックパッドの横スワイプを検出
    // deltaXが0でない場合は横スワイプ
    if (e.deltaX !== 0) {
      // 横スワイプの場合は感度を上げて適用（2倍速）
      container.scrollLeft += e.deltaX * 2
      updateScrollPosition(category)
      return
    }
    
    // Shiftキー + 縦スクロールの場合
    if (e.shiftKey && e.deltaY !== 0) {
      e.preventDefault()
      container.scrollLeft += e.deltaY * 2
      updateScrollPosition(category)
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
        toast.success(`${banners.length}枚のバナーを生成しました`)
      } else {
        throw new Error('バナーが生成されませんでした')
      }
    } catch (err: any) {
      console.error('Generate error:', err)
      toast.error(err.message || '生成に失敗しました')
    } finally {
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
      <DashboardSidebar isMobile={false} />
      
      {/* モバイル用サイドバーオーバーレイ */}
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
        
        {/* Netflix風のメインコンテンツ */}
        <div className="relative pt-12 md:pt-0">
          {/* 大きなヒーロー画像（選択されたバナーまたはテンプレート）- スティッキー */}
          <div className="sticky top-0 z-20 h-[28vh] sm:h-[35vh] md:h-[45vh] lg:h-[50vh] w-full overflow-hidden">
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
                        className="flex gap-2 sm:gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-0 sm:px-10 md:px-16 py-1.5 sm:py-2 md:py-4 cursor-grab active:cursor-grabbing select-none scroll-smooth"
                        style={{ 
                          scrollbarWidth: 'none', 
                          msOverflowStyle: 'none',
                          WebkitOverflowScrolling: 'touch',
                          scrollPaddingLeft: '12px',
                          scrollPaddingRight: '12px',
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
                          
                          return (
                            <motion.div
                              key={template.id}
                              ref={(el) => observeImage(el, template.id)}
                              whileHover={{ scale: 1.08, y: -12, zIndex: 10 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setSelectedTemplate(template)
                                setSelectedBanner(null)
                              }}
                              className={`group flex-shrink-0 w-36 h-20 sm:w-48 sm:h-28 md:w-64 md:h-36 lg:w-80 lg:h-44 rounded-md md:rounded-lg overflow-hidden cursor-pointer transition-all duration-300 relative ${
                                isFirst ? 'ml-3 sm:ml-0' : ''
                              } ${
                                isLast ? 'mr-3 sm:mr-0' : ''
                              } ${
                                selectedTemplate?.id === template.id
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
                              {selectedTemplate?.id === template.id && (
                                <div className="absolute inset-0 ring-4 ring-blue-500 rounded-lg pointer-events-none z-20">
                                  <div className="absolute top-2 left-2 bg-blue-500 px-2 py-0.5 rounded-full">
                                    <p className="text-[10px] font-bold text-white whitespace-nowrap">選択中</p>
                                  </div>
                                </div>
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
                      placeholder="例: AIライティングツール比較2026"
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

          {/* 生成されたバナー一覧（グリッド表示） */}
          {generatedBanners.length > 0 && (
            <div className="px-3 sm:px-4 md:px-8 lg:px-12 py-6 sm:py-8 md:py-12 space-y-4 md:space-y-6">
              <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold px-2 md:px-4 text-white">生成結果</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
                {generatedBanners.map((banner) => (
                  <motion.div
                    key={banner.id}
                    whileHover={{ scale: 1.05, zIndex: 10 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedBanner(banner)}
                    className={`group relative aspect-[16/9] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
                      selectedBanner?.id === banner.id
                        ? 'ring-3 ring-white shadow-2xl'
                        : 'ring-1 ring-gray-800 hover:ring-gray-600'
                    }`}
                  >
                    <img
                      src={banner.imageUrl}
                      alt="Generated banner"
                      className="w-full h-full object-cover"
                    />
                    {/* 拡大ボタン（ホバー時に表示） */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setZoomImage({
                          url: banner.imageUrl,
                          title: '生成されたバナー'
                        })
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      title="画像を拡大表示"
                    >
                      <Maximize2 className="w-4 h-4 text-white" />
                    </button>
                    {selectedBanner?.id === banner.id && (
                      <div className="absolute inset-0 ring-4 ring-blue-500 rounded-lg pointer-events-none">
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-blue-500 px-3 py-1 rounded-full">
                          <p className="text-xs font-bold text-white whitespace-nowrap">選択中</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
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
    </div>
  )
}
