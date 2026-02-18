'use client'

import { Suspense, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Sparkles, Loader2, X, Lock, Play, Maximize2, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'
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
  displayTitle?: string
  name?: string
}

type PlanType = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE'

type PlanConfig = {
  label: string
  maxCountPerGeneration: number
  dailyLimit: number
  imagesPerGenre: number
  allUnlocked: boolean
}

const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  GUEST: { label: 'ゲスト', maxCountPerGeneration: 3, dailyLimit: 5, imagesPerGenre: 1, allUnlocked: false },
  FREE: { label: 'ベーシック', maxCountPerGeneration: 3, dailyLimit: 10, imagesPerGenre: 3, allUnlocked: false },
  PRO: { label: 'PROプラン', maxCountPerGeneration: 5, dailyLimit: 30, imagesPerGenre: Infinity, allUnlocked: true },
  ENTERPRISE: { label: 'Enterpriseプラン', maxCountPerGeneration: 5, dailyLimit: 200, imagesPerGenre: Infinity, allUnlocked: true },
}

type LockType = 'login' | 'pro' | 'enterprise' | null

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

const CATEGORY_ORDER = ['ビジネス / SaaS', 'IT・AI', '採用', 'イベント', 'EC', '高級・ラグジュアリー']

export default function GalleryTestPage() {
  return (
    <Suspense fallback={null}>
      <GalleryTestInner />
    </Suspense>
  )
}

function GalleryTestInner() {
  const { data: session } = useSession()
  const [templates, setTemplates] = useState<BannerTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<BannerTemplate | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('すべて')
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null)

  // プラン判定
  const currentPlan = useMemo((): PlanType => {
    if (!session?.user) return 'GUEST'
    const user = session.user as any
    const plan = user?.bannerPlan || user?.plan || 'FREE'
    const upperPlan = String(plan).toUpperCase()
    if (upperPlan === 'PRO') return 'PRO'
    if (upperPlan === 'ENTERPRISE') return 'ENTERPRISE'
    return 'FREE'
  }, [session])

  const planConfig = useMemo(() => PLAN_CONFIG[currentPlan], [currentPlan])

  const getImageLockType = useCallback((template: BannerTemplate, indexInGenre: number): LockType => {
    if (planConfig.allUnlocked) return null
    if (indexInGenre < planConfig.imagesPerGenre) return null
    if (currentPlan === 'GUEST') return 'login'
    if (currentPlan === 'FREE') return 'pro'
    return null
  }, [currentPlan, planConfig])

  // テンプレート取得
  useEffect(() => {
    const CACHE_KEY = 'banner_templates_cache_v4'
    const CACHE_EXPIRY = 10 * 60 * 1000

    const fetchTemplates = async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached)
            const now = Date.now()
            const hasPrompts = data.templates?.[0]?.prompt && data.templates[0].prompt.length > 50
            if (now - timestamp < CACHE_EXPIRY && data.templates && Array.isArray(data.templates) && hasPrompts) {
              setTemplates(data.templates)
              if (data.templates.length > 0) setSelectedTemplate(data.templates[0])
              setIsLoading(false)
              return
            }
          } catch {
            sessionStorage.removeItem(CACHE_KEY)
          }
        }

        const res = await fetch('/api/banner/test/templates?limit=100', {
          next: { revalidate: 300 },
        })
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const data = await res.json()

        if (data.templates && Array.isArray(data.templates) && data.templates.length > 0) {
          setTemplates(data.templates)
          if (data.templates.length > 0) setSelectedTemplate(data.templates[0])
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
          } catch {}
        }
      } catch (err) {
        console.error('Failed to fetch templates:', err)
        toast.error('テンプレートの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  // カテゴリごとにグループ化
  const templatesByCategory = useMemo((): { [key: string]: BannerTemplate[] } => {
    if (!templates.length) return {}
    const grouped: { [key: string]: BannerTemplate[] } = {}
    templates.forEach((t) => {
      if (!t) return
      const category = categoryMapping[t.industry] || t.industry || 'その他'
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(t)
    })
    const sorted: { [key: string]: BannerTemplate[] } = {}
    CATEGORY_ORDER.forEach((cat) => {
      if (grouped[cat]?.length) sorted[cat] = grouped[cat]
    })
    Object.keys(grouped).forEach((cat) => {
      if (!CATEGORY_ORDER.includes(cat) && grouped[cat]?.length) sorted[cat] = grouped[cat]
    })
    return sorted
  }, [templates])

  // フィルタ適用後のテンプレート
  const filteredTemplates = useMemo(() => {
    if (activeFilter === 'すべて') return templates
    return templatesByCategory[activeFilter] || []
  }, [activeFilter, templates, templatesByCategory])

  // カテゴリ内indexを取得（ロック判定用）
  const getCategoryIndex = useCallback((template: BannerTemplate): number => {
    const category = categoryMapping[template.industry] || template.industry || 'その他'
    const categoryTemplates = templatesByCategory[category] || []
    return categoryTemplates.findIndex((t) => t.id === template.id)
  }, [templatesByCategory])

  const handleImageLoad = useCallback((id: string) => {
    setLoadedImages((prev) => new Set(prev).add(id))
  }, [])

  const handleImageError = useCallback((id: string) => {
    setImageErrors((prev) => new Set(prev).add(id))
  }, [])

  const filterTabs = ['すべて', ...CATEGORY_ORDER]

  return (
    <div className="min-h-screen bg-black text-white">
      <Toaster position="top-center" />

      {/* 選択中バナーのプレビュー（上部） */}
      <AnimatePresence>
        {selectedTemplate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden"
          >
            <div className="relative h-[25vh] sm:h-[30vh] md:h-[35vh] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
              {selectedTemplate.imageUrl && !imageErrors.has(selectedTemplate.id) ? (
                <img
                  src={selectedTemplate.imageUrl}
                  alt={selectedTemplate.displayTitle || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-gray-600" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-5 md:p-8">
                <h2 className="text-lg sm:text-2xl md:text-3xl font-black drop-shadow-2xl">
                  {selectedTemplate.displayTitle || selectedTemplate.name || selectedTemplate.industry}
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 mt-1 line-clamp-1">
                  {categoryMapping[selectedTemplate.industry] || selectedTemplate.industry}
                </p>
                <div className="flex gap-2 mt-2 sm:mt-3">
                  <a
                    href={`/banner/dashboard?template=${selectedTemplate.id}`}
                    className="px-3 sm:px-5 py-1.5 sm:py-2 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition-all flex items-center gap-1.5 text-xs sm:text-sm shadow-lg"
                  >
                    <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
                    このスタイルで生成
                  </a>
                  {selectedTemplate.imageUrl && (
                    <button
                      onClick={() => setZoomImage({ url: selectedTemplate.imageUrl!, title: selectedTemplate.displayTitle || '' })}
                      className="px-3 py-1.5 sm:py-2 bg-gray-800/80 text-white rounded-md hover:bg-gray-700 transition-all flex items-center gap-1.5 text-xs sm:text-sm backdrop-blur-sm border border-white/20"
                    >
                      <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">拡大</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="px-3 py-1.5 sm:py-2 bg-gray-800/80 text-white rounded-md hover:bg-gray-700 transition-all flex items-center gap-1.5 text-xs sm:text-sm backdrop-blur-sm border border-white/20"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">閉じる</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ジャンルフィルタタブ */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-sm border-b border-gray-800/50">
        <div className="flex items-center gap-1 px-2 sm:px-4 py-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {filterTabs.map((tab) => (
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

      {/* グリッドギャラリー */}
      <div className="px-1 sm:px-2 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        ) : activeFilter === 'すべて' ? (
          // カテゴリごとにセクション表示
          Object.entries(templatesByCategory).map(([categoryName, categoryTemplates]) => {
            if (!categoryTemplates?.length) return null
            return (
              <div key={categoryName} className="mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-gray-400 px-1 sm:px-2 py-1.5 flex items-center gap-1.5">
                  <span className="text-blue-400">▶</span> {categoryName}
                  <span className="text-gray-600 text-[10px]">({categoryTemplates.length})</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                  {categoryTemplates.map((template, index) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      index={index}
                      isSelected={selectedTemplate?.id === template.id}
                      isLoaded={loadedImages.has(template.id)}
                      hasError={imageErrors.has(template.id)}
                      lockType={getImageLockType(template, index)}
                      onSelect={setSelectedTemplate}
                      onImageLoad={handleImageLoad}
                      onImageError={handleImageError}
                    />
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          // フィルタ適用時：フラットグリッド
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
            {filteredTemplates.map((template) => {
              const catIndex = getCategoryIndex(template)
              return (
                <TemplateCard
                  key={template.id}
                  template={template}
                  index={catIndex}
                  isSelected={selectedTemplate?.id === template.id}
                  isLoaded={loadedImages.has(template.id)}
                  hasError={imageErrors.has(template.id)}
                  lockType={getImageLockType(template, catIndex)}
                  onSelect={setSelectedTemplate}
                  onImageLoad={handleImageLoad}
                  onImageError={handleImageError}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* 画像拡大モーダル */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setZoomImage(null)}
          >
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full z-50"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <img
              src={zoomImage.url}
              alt={zoomImage.title}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ダッシュボードに戻るリンク */}
      <div className="fixed bottom-4 left-4 z-40">
        <a
          href="/banner/dashboard"
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800/90 hover:bg-gray-700 text-white text-xs sm:text-sm rounded-full backdrop-blur-sm border border-gray-700 transition-all shadow-lg"
        >
          <ChevronLeft className="w-4 h-4" />
          ダッシュボードに戻る
        </a>
      </div>
    </div>
  )
}

// サムネイルカード
function TemplateCard({
  template,
  index,
  isSelected,
  isLoaded,
  hasError,
  lockType,
  onSelect,
  onImageLoad,
  onImageError,
}: {
  template: BannerTemplate
  index: number
  isSelected: boolean
  isLoaded: boolean
  hasError: boolean
  lockType: LockType
  onSelect: (t: BannerTemplate) => void
  onImageLoad: (id: string) => void
  onImageError: (id: string) => void
}) {
  const isLocked = lockType !== null
  const showImage = template.imageUrl && !hasError

  return (
    <motion.div
      whileHover={{ scale: 1.04, zIndex: 10 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(template)}
      className={`relative aspect-[16/10] rounded overflow-hidden cursor-pointer group ${
        isSelected
          ? 'ring-2 ring-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)]'
          : 'ring-1 ring-gray-800/50 hover:ring-gray-600'
      } ${isLocked ? 'opacity-70 hover:opacity-90' : ''}`}
    >
      {showImage ? (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
            </div>
          )}
          <img
            src={template.imageUrl!}
            alt={template.displayTitle || template.industry}
            loading="lazy"
            decoding="async"
            onLoad={() => onImageLoad(template.id)}
            onError={() => onImageError(template.id)}
            className={`w-full h-full object-cover transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-gray-600" />
        </div>
      )}

      {/* ラベル（下部） */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1 sm:p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[7px] sm:text-[9px] font-bold text-white line-clamp-1 drop-shadow">
          {template.displayTitle || template.name || template.industry}
        </p>
      </div>

      {/* 選択中インジケータ */}
      {isSelected && (
        <div className="absolute top-1 left-1 bg-blue-500 px-1.5 py-0.5 rounded text-[7px] sm:text-[8px] font-bold text-white shadow">
          選択中
        </div>
      )}

      {/* ロックUI */}
      {isLocked && (
        <>
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
          <div className={`absolute top-1 right-1 flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-bold text-white ${
            lockType === 'login' ? 'bg-red-500/90' : 'bg-amber-500/90'
          }`}>
            <Lock className="w-2 h-2" />
            {lockType === 'login' ? 'ログイン' : 'PRO'}
          </div>
        </>
      )}
    </motion.div>
  )
}
