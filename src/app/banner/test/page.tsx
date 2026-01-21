'use client'

import { Suspense, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Sparkles, Loader2, Download, ChevronLeft, ChevronRight, Play, ImageIcon } from 'lucide-react'
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
}

type GeneratedBanner = {
  id: string
  imageUrl: string
  prompt: string
  createdAt: Date
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

  // フォーム状態（簡素化：サービス名 / トーン / 任意テキスト）
  const [serviceName, setServiceName] = useState('')
  const [tone, setTone] = useState('')
  const [customText, setCustomText] = useState('')

  const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  
  // 各カテゴリごとの表示数を管理（初期は4枚、スクロール時に追加）
  const [visibleCounts, setVisibleCounts] = useState<{ [key: string]: number }>({})
  const INITIAL_VISIBLE_COUNT = 4 // 初期表示数
  const LOAD_MORE_COUNT = 8 // 追加読み込み数

  // 画像読み込み完了ハンドラ
  const handleImageLoad = useCallback((id: string) => {
    setLoadedImages(prev => new Set(prev).add(id))
  }, [])

  // 画像エラーハンドラ
  const handleImageError = useCallback((id: string) => {
    setImageErrors(prev => new Set(prev).add(id))
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

  // テンプレートを取得（接続数を最小限にするため、クライアント側キャッシュを活用）
  useEffect(() => {
    const CACHE_KEY = 'banner_templates_cache'
    const CACHE_EXPIRY = 5 * 60 * 1000 // 5分間キャッシュ
    
    const fetchTemplates = async () => {
      try {
        // クライアント側キャッシュをチェック
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
          const { data, timestamp } = JSON.parse(cached)
          const now = Date.now()
          
          // キャッシュが有効な場合は使用
          if (now - timestamp < CACHE_EXPIRY) {
            if (data.templates) {
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
            }
            setIsLoadingTemplates(false)
            return
          }
        }
        
        // キャッシュが無効または存在しない場合はAPIから取得
        const res = await fetch('/api/banner/test/templates', {
          // 接続数を最小限にするため、キャッシュヘッダーを追加
          headers: {
            'Cache-Control': 'max-age=300', // 5分間キャッシュ
          },
        })
        const data = await res.json()
        
        if (data.templates) {
          // すべてのテンプレートを設定（画像URLがないものも含む）
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
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now(),
          }))
          
          // featuredTemplateを優先的に選択、なければ最初のテンプレート
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
  const templatesByCategory = useMemo(() => {
    const grouped: { [key: string]: BannerTemplate[] } = {}
    const categoryOrder = ['ビジネス / SaaS', 'IT・AI', '採用', 'イベント', 'EC', '高級・ラグジュアリー']
    
    // すべてのテンプレートを処理（画像URLがないものも含む）
    templates.forEach((template) => {
      // カテゴリマッピングを使用、なければ元の業種名を使用
      const category = categoryMapping[template.industry] || template.industry
      
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(template)
    })
    
    // カテゴリ順序に従ってソート
    const sorted: { [key: string]: BannerTemplate[] } = {}
    categoryOrder.forEach((cat) => {
      if (grouped[cat]) {
        sorted[cat] = grouped[cat]
      }
    })
    
    // その他のカテゴリも追加
    Object.keys(grouped).forEach((cat) => {
      if (!categoryOrder.includes(cat)) {
        sorted[cat] = grouped[cat]
      }
    })
    
    // 各カテゴリの表示数を制限（遅延読み込み）
    const limited: { [key: string]: BannerTemplate[] } = {}
    Object.keys(sorted).forEach((cat) => {
      const visibleCount = visibleCounts[cat] || INITIAL_VISIBLE_COUNT
      limited[cat] = sorted[cat].slice(0, visibleCount)
    })
    
    return limited
  }, [templates, visibleCounts])
  
  // カテゴリごとの全テンプレート数（「もっと見る」ボタンの表示判定用）
  const totalTemplatesByCategory = useMemo(() => {
    const grouped: { [key: string]: BannerTemplate[] } = {}
    templates.forEach((template) => {
      const category = categoryMapping[template.industry] || template.industry
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

  // 横スクロール関数
  const scroll = (direction: 'left' | 'right', industry: string) => {
    const container = scrollRefs.current[industry]
    if (container) {
      const scrollAmount = 400
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  // バナー生成
  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast.error('テンプレートを選択してください')
      return
    }

    if (!serviceName.trim()) {
      toast.error('サービス名を入力してください')
      return
    }

    setIsGenerating(true)
    setGeneratedBanners([])

    try {
      // 既存APIをラップして使用（本番APIは変更しない）
      const res = await fetch('/api/banner/test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: selectedTemplate.category,
          size: '1200x628', // 固定サイズ
          industry: selectedTemplate.industry,
          mainTitle: serviceName, // サービス名をメインタイトルとして使用
          subTitle: tone ? `トーン: ${tone}` : undefined, // トーンをサブタイトルとして使用
          accentText: customText || undefined, // 任意テキストをアクセントとして使用
          count: 10,
          basePrompt: selectedTemplate.prompt, // ベースプロンプトを渡す（既存のプロンプトを参照）
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || '生成に失敗しました')
      }

      if (result.banners && Array.isArray(result.banners) && result.banners.length > 0) {
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
      setIsGenerating(false)
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
      <main className="flex-1 ml-0 md:ml-[240px] min-h-screen bg-black">
        {/* Netflix風のメインコンテンツ */}
        <div className="relative">
          {/* 大きなヒーロー画像（選択されたバナーまたはテンプレート） */}
          <div className="relative h-[70vh] md:h-[85vh] w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-black/50 z-10" />
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
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-16 z-20">
              <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl md:text-5xl lg:text-7xl font-black mb-4 drop-shadow-2xl leading-tight">
                  {selectedBanner 
                    ? serviceName || '生成されたバナー'
                    : selectedTemplate?.prompt.split('、')[0] || selectedTemplate?.prompt || 'バナーテンプレート'
                  }
                </h1>
                <p className="text-base md:text-lg lg:text-xl text-gray-300 mb-4 max-w-3xl drop-shadow-lg line-clamp-2">
                  {selectedBanner 
                    ? (tone ? `トーン: ${tone}` : '') || selectedBanner.prompt
                    : selectedTemplate?.industry || '様々なスタイルのバナーテンプレートから選択'
                  }
                </p>
                {!selectedBanner && selectedTemplate && (
                  <p className="text-sm md:text-base text-gray-400 mb-6 max-w-3xl drop-shadow-lg line-clamp-2">
                    {selectedTemplate.prompt}
                  </p>
                )}
                <div className="flex gap-3 md:gap-4 flex-wrap">
                  {!selectedBanner && selectedTemplate && (
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="px-6 md:px-8 py-2.5 md:py-3.5 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition-all flex items-center gap-2 disabled:opacity-50 text-sm md:text-base shadow-lg hover:shadow-xl"
                    >
                      <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                      {isGenerating ? '生成中...' : 'このスタイルで生成'}
                    </button>
                  )}
                  {selectedBanner && (
                    <>
                      <button
                        onClick={() => handleDownload(selectedBanner)}
                        className="px-6 md:px-8 py-2.5 md:py-3.5 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition-all flex items-center gap-2 text-sm md:text-base shadow-lg hover:shadow-xl"
                      >
                        <Download className="w-4 h-4 md:w-5 md:h-5" />
                        ダウンロード
                      </button>
                      <button 
                        onClick={() => setSelectedBanner(null)}
                        className="px-6 md:px-8 py-2.5 md:py-3.5 bg-gray-600/80 text-white font-bold rounded-md hover:bg-gray-600 transition-all flex items-center gap-2 text-sm md:text-base backdrop-blur-sm"
                      >
                        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                        テンプレートに戻る
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* テンプレート一覧（Netflix風の横スクロール） */}
          <div className="px-4 md:px-8 lg:px-12 -mt-20 md:-mt-32 relative z-30 space-y-6 md:space-y-8">
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : (
              Object.entries(templatesByCategory).map(([categoryName, categoryTemplates]) => {
                if (categoryTemplates.length === 0) return null
                
                return (
                  <div key={categoryName} className="space-y-3 md:space-y-4">
                    <h2 className="text-xl md:text-2xl lg:text-3xl font-bold px-2 md:px-4 text-white">
                      ▶ {categoryName}
                    </h2>
                    <div className="relative group">
                      {/* 左スクロールボタン */}
                      <button
                        onClick={() => scroll('left', categoryName)}
                        className="absolute left-0 top-0 bottom-0 z-10 w-10 md:w-14 bg-gradient-to-r from-black via-black/80 to-transparent hover:from-black/90 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white" />
                      </button>
                      
                      {/* 横スクロールコンテナ */}
                      <div
                        ref={(el) => { scrollRefs.current[categoryName] = el }}
                        className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-10 md:px-14 py-2 md:py-4"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {categoryTemplates.map((template) => {
                          const hasError = imageErrors.has(template.id)
                          const isLoaded = loadedImages.has(template.id)
                          const showImage = template.imageUrl && !hasError
                          
                          return (
                            <motion.div
                              key={template.id}
                              whileHover={{ scale: 1.08, y: -12, zIndex: 10 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setSelectedTemplate(template)
                                setSelectedBanner(null)
                              }}
                              className={`flex-shrink-0 w-48 h-28 md:w-64 md:h-36 lg:w-80 lg:h-44 rounded-md md:rounded-lg overflow-hidden cursor-pointer transition-all duration-300 relative ${
                                selectedTemplate?.id === template.id
                                  ? 'ring-3 ring-white scale-105 shadow-2xl'
                                  : 'ring-1 ring-gray-800 hover:ring-gray-600'
                              }`}
                            >
                              {showImage ? (
                                <>
                                  {/* 読み込み中のプレースホルダー */}
                                  {!isLoaded && (
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center">
                                      <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                                    </div>
                                  )}
                                  <img
                                    src={template.imageUrl!}
                                    alt={template.prompt}
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={() => handleImageLoad(template.id)}
                                    onError={() => handleImageError(template.id)}
                                    className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                                  />
                                </>
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black flex flex-col items-center justify-center p-3 md:p-4 relative overflow-hidden">
                                  <div className="absolute inset-0 opacity-20">
                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
                                  </div>
                                  <ImageIcon className="w-8 h-8 md:w-12 md:h-12 text-gray-500 mb-2 relative z-10" />
                                  <p className="text-xs md:text-sm text-gray-500 text-center relative z-10 line-clamp-2 px-2">
                                    {template.prompt.split('、')[0] || template.industry}
                                  </p>
                                </div>
                              )}
                              {selectedTemplate?.id === template.id && (
                                <div className="absolute inset-0 bg-white/5 flex items-center justify-center backdrop-blur-sm">
                                  <div className="bg-black/80 px-3 py-1.5 md:px-4 md:py-2 rounded-md">
                                    <p className="text-xs md:text-sm font-bold text-white">選択中</p>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )
                        })}
                        
                        {/* 「もっと見る」ボタン（残りのテンプレートがある場合のみ表示） */}
                        {(() => {
                          const totalCount = totalTemplatesByCategory[categoryName]?.length || 0
                          const visibleCount = visibleCounts[categoryName] || INITIAL_VISIBLE_COUNT
                          const hasMore = totalCount > visibleCount
                          
                          if (!hasMore) return null
                          
                          return (
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="flex-shrink-0 w-48 h-28 md:w-64 md:h-36 lg:w-80 lg:h-44 rounded-md md:rounded-lg overflow-hidden cursor-pointer"
                            >
                              <button
                                onClick={() => loadMoreTemplates(categoryName)}
                                className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black border-2 border-gray-700 hover:border-gray-500 transition-all flex flex-col items-center justify-center gap-2 md:gap-3 group"
                              >
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 group-hover:bg-white/20 transition-all flex items-center justify-center">
                                  <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
                                </div>
                                <p className="text-xs md:text-sm font-bold text-white">
                                  もっと見る
                                </p>
                                <p className="text-[10px] md:text-xs text-gray-400">
                                  {totalCount - visibleCount}件のテンプレート
                                </p>
                              </button>
                            </motion.div>
                          )
                        })()}
                      </div>

                      {/* 右スクロールボタン */}
                      <button
                        onClick={() => scroll('right', categoryName)}
                        className="absolute right-0 top-0 bottom-0 z-10 w-10 md:w-14 bg-gradient-to-l from-black via-black/80 to-transparent hover:from-black/90 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white" />
                      </button>
                    </div>
                  </div>
                )
              }).filter(Boolean)
            )}
          </div>

          {/* 生成フォーム（選択されたテンプレートに基づく、バナー選択時は非表示） */}
          {selectedTemplate && !selectedBanner && (
            <div className="px-4 md:px-8 lg:px-12 py-8 md:py-12 bg-black/95 backdrop-blur-sm">
              <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-white">バナー情報を入力</h2>
                <div className="bg-gray-900/90 rounded-xl md:rounded-2xl p-6 md:p-8 space-y-6 border border-gray-800">
                  <div>
                    <label className="block text-sm font-bold mb-2">サービス名 *</label>
                    <input
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="例: AIライティングツール"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2">トーン</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">選択してください</option>
                      <option value="プロフェッショナル">プロフェッショナル</option>
                      <option value="カジュアル">カジュアル</option>
                      <option value="高級感">高級感</option>
                      <option value="ポップ">ポップ</option>
                      <option value="ミニマル">ミニマル</option>
                      <option value="エネルギッシュ">エネルギッシュ</option>
                      <option value="上品">上品</option>
                      <option value="親しみやすい">親しみやすい</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2">任意テキスト</label>
                    <input
                      type="text"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="例: 2026年最新版 / SEO重視"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !serviceName.trim()}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        このバナーをベースに10種類のバリエーションを生成
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 生成されたバナー一覧（グリッド表示） */}
          {generatedBanners.length > 0 && (
            <div className="px-4 md:px-8 lg:px-12 py-8 md:py-12 space-y-4 md:space-y-6">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold px-2 md:px-4 text-white">生成結果</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {generatedBanners.map((banner) => (
                  <motion.div
                    key={banner.id}
                    whileHover={{ scale: 1.05, zIndex: 10 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedBanner(banner)}
                    className={`relative aspect-[16/9] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
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
                    {selectedBanner?.id === banner.id && (
                      <div className="absolute inset-0 bg-white/5 flex items-center justify-center backdrop-blur-sm">
                        <div className="bg-black/80 px-3 py-1.5 md:px-4 md:py-2 rounded-md">
                          <p className="text-xs md:text-sm font-bold text-white">選択中</p>
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
    </div>
  )
}
