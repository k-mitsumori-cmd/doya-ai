'use client'

import { Suspense, useState, useMemo, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Sparkles, Loader2, Download, ChevronLeft, ChevronRight, Play, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'
import DashboardSidebar from '@/components/DashboardSidebar'

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
  
  // フォーム状態
  const [mainTitle, setMainTitle] = useState('')
  const [subTitle, setSubTitle] = useState('')
  const [accentText, setAccentText] = useState('')
  const [size, setSize] = useState('1200x628')
  const [industry, setIndustry] = useState('')

  const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // テンプレートを取得
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/banner/test/templates')
        const data = await res.json()
        if (data.templates) {
          setTemplates(data.templates)
          
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

  // 業種ごとにテンプレートをグループ化
  const templatesByIndustry = useMemo(() => {
    const grouped: { [key: string]: BannerTemplate[] } = {}
    templates.forEach((template) => {
      if (!grouped[template.industry]) {
        grouped[template.industry] = []
      }
      grouped[template.industry].push(template)
    })
    return grouped
  }, [templates])

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

    if (!mainTitle.trim()) {
      toast.error('メインタイトルを入力してください')
      return
    }

    setIsGenerating(true)
    setGeneratedBanners([])

    try {
      const res = await fetch('/api/banner/test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: selectedTemplate.category,
          size,
          industry: selectedTemplate.industry,
          mainTitle,
          subTitle,
          accentText,
          count: 10,
          basePrompt: selectedTemplate.prompt, // ベースプロンプトを渡す
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
                className="w-full h-full object-cover"
              />
            ) : selectedTemplate?.imageUrl ? (
              <img
                src={selectedTemplate.imageUrl}
                alt={selectedTemplate.prompt}
                className="w-full h-full object-cover"
              />
            ) : templates.length > 0 && templates[0]?.imageUrl ? (
              <img
                src={templates[0].imageUrl}
                alt="Featured template"
                className="w-full h-full object-cover"
              />
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
                    ? mainTitle || '生成されたバナー'
                    : selectedTemplate?.prompt.split('、')[0] || selectedTemplate?.prompt || 'バナーテンプレート'
                  }
                </h1>
                <p className="text-base md:text-lg lg:text-xl text-gray-300 mb-4 max-w-3xl drop-shadow-lg line-clamp-2">
                  {selectedBanner 
                    ? subTitle || selectedBanner.prompt
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
              Object.entries(templatesByIndustry).map(([industryName, industryTemplates]) => (
                <div key={industryName} className="space-y-3 md:space-y-4">
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-bold px-2 md:px-4 text-white">
                    {industryName}
                  </h2>
                  <div className="relative group">
                    {/* 左スクロールボタン */}
                    <button
                      onClick={() => scroll('left', industryName)}
                      className="absolute left-0 top-0 bottom-0 z-10 w-10 md:w-14 bg-gradient-to-r from-black via-black/80 to-transparent hover:from-black/90 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </button>
                    
                    {/* 横スクロールコンテナ */}
                    <div
                      ref={(el) => (scrollRefs.current[industryName] = el)}
                      className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-10 md:px-14 py-2 md:py-4"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {industryTemplates.map((template) => (
                        <motion.div
                          key={template.id}
                          whileHover={{ scale: 1.08, y: -12, zIndex: 10 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedTemplate(template)
                            setSelectedBanner(null)
                          }}
                          className={`flex-shrink-0 w-48 h-28 md:w-64 md:h-36 lg:w-80 lg:h-44 rounded-md md:rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
                            selectedTemplate?.id === template.id
                              ? 'ring-3 ring-white scale-105 shadow-2xl'
                              : 'ring-1 ring-gray-800 hover:ring-gray-600'
                          }`}
                        >
                          {template.imageUrl ? (
                            <img
                              src={template.imageUrl}
                              alt={template.prompt}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black flex flex-col items-center justify-center p-3 md:p-4 relative overflow-hidden">
                              <div className="absolute inset-0 opacity-20">
                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
                              </div>
                              <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-gray-400 mb-2 relative z-10" />
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
                      ))}
                    </div>

                    {/* 右スクロールボタン */}
                    <button
                      onClick={() => scroll('right', industryName)}
                      className="absolute right-0 top-0 bottom-0 z-10 w-10 md:w-14 bg-gradient-to-l from-black via-black/80 to-transparent hover:from-black/90 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 生成フォーム（選択されたテンプレートに基づく、バナー選択時は非表示） */}
          {selectedTemplate && !selectedBanner && (
            <div className="px-4 md:px-8 lg:px-12 py-8 md:py-12 bg-black/95 backdrop-blur-sm">
              <div className="max-w-5xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-white">バナー情報を入力</h2>
                <div className="bg-gray-900/90 rounded-xl md:rounded-2xl p-6 md:p-8 space-y-6 border border-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold mb-2">サイズ</label>
                      <select
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="1080x1080">Instagram正方形（1080×1080）</option>
                        <option value="1200x628">Facebook/OG（1200×628）</option>
                        <option value="1080x1920">ストーリー（1080×1920）</option>
                        <option value="1280x720">YouTubeサムネ（1280×720）</option>
                        <option value="728x90">GDN横長（728×90）</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">業種</label>
                      <input
                        type="text"
                        value={industry || selectedTemplate.industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={selectedTemplate.industry}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2">メインタイトル *</label>
                    <input
                      type="text"
                      value={mainTitle}
                      onChange={(e) => setMainTitle(e.target.value)}
                      placeholder="例: AIライティングツール おすすめ30選"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2">サブタイトル</label>
                    <input
                      type="text"
                      value={subTitle}
                      onChange={(e) => setSubTitle(e.target.value)}
                      placeholder="例: SEO重視の選び方と徹底比較"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2">アクセントテキスト</label>
                    <input
                      type="text"
                      value={accentText}
                      onChange={(e) => setAccentText(e.target.value)}
                      placeholder="例: 2026年最新版 / SEO重視"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !mainTitle.trim()}
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
                        このスタイルで10種類のバリエーションを生成
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 生成されたバナー一覧（Netflix風の横スクロール） */}
          {generatedBanners.length > 0 && (
            <div className="px-4 md:px-8 lg:px-12 py-8 md:py-12 space-y-4 md:space-y-6">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold px-2 md:px-4 text-white">生成されたバナー</h2>
              <div className="relative group">
                {/* 左スクロールボタン */}
                <button
                  onClick={() => {
                    const container = scrollRefs.current['generated']
                    if (container) {
                      container.scrollBy({ left: -400, behavior: 'smooth' })
                    }
                  }}
                  className="absolute left-0 top-0 bottom-0 z-10 w-10 md:w-14 bg-gradient-to-r from-black via-black/80 to-transparent hover:from-black/90 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </button>
                
                {/* 横スクロールコンテナ */}
                <div
                  ref={(el) => (scrollRefs.current['generated'] = el)}
                  className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-10 md:px-14 py-2 md:py-4"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {generatedBanners.map((banner) => (
                    <motion.div
                      key={banner.id}
                      whileHover={{ scale: 1.08, y: -12, zIndex: 10 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedBanner(banner)}
                      className={`flex-shrink-0 w-48 h-28 md:w-64 md:h-36 lg:w-80 lg:h-44 rounded-md md:rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
                        selectedBanner?.id === banner.id
                          ? 'ring-3 ring-white scale-105 shadow-2xl'
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

                {/* 右スクロールボタン */}
                <button
                  onClick={() => {
                    const container = scrollRefs.current['generated']
                    if (container) {
                      container.scrollBy({ left: 400, behavior: 'smooth' })
                    }
                  }}
                  className="absolute right-0 top-0 bottom-0 z-10 w-10 md:w-14 bg-gradient-to-l from-black via-black/80 to-transparent hover:from-black/90 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Toaster position="top-right" />
    </div>
  )
}
