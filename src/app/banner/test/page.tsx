'use client'

import { Suspense, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Sparkles, Loader2, Download, Check, Image as ImageIcon, Layers, Palette, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'
import DashboardSidebar from '@/components/DashboardSidebar'

// テンプレートサンプル（後で動的に生成できるように拡張可能）
const TEMPLATE_SAMPLES = [
  {
    id: 'dark-tech',
    name: 'ダークテック',
    description: 'ダークトーン × 技術系UI',
    preview: '/banner/templates/dark-tech.jpg', // プレースホルダー
  },
  {
    id: 'minimal-clean',
    name: 'ミニマル',
    description: 'シンプル × 清潔感',
    preview: '/banner/templates/minimal.jpg',
  },
  {
    id: 'gradient-modern',
    name: 'グラデーションモダン',
    description: 'グラデーション × モダン',
    preview: '/banner/templates/gradient.jpg',
  },
]

const SIZE_OPTIONS = [
  { label: 'Instagram正方形（1080×1080）', value: '1080x1080' },
  { label: 'Facebook/OG（1200×628）', value: '1200x628' },
  { label: 'ストーリー（1080×1920）', value: '1080x1920' },
  { label: 'YouTubeサムネ（1280×720）', value: '1280x720' },
  { label: 'GDN横長（728×90）', value: '728x90' },
]

const INDUSTRY_OPTIONS = [
  'Web / IT / スクール / 教育',
  '転職・採用・人材',
  'EC / セール / キャンペーン',
  '美容 / コスメ / 健康 / 食品',
  'SaaS / BtoBサービス',
  '情報商材 / ノウハウ / AIツール',
]

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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [size, setSize] = useState('1200x628')
  const [industry, setIndustry] = useState('')
  const [mainTitle, setMainTitle] = useState('')
  const [subTitle, setSubTitle] = useState('')
  const [accentText, setAccentText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedBanners, setGeneratedBanners] = useState<GeneratedBanner[]>([])
  const [selectedBannerId, setSelectedBannerId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const selectedBanner = useMemo(
    () => generatedBanners.find((b) => b.id === selectedBannerId) || null,
    [generatedBanners, selectedBannerId]
  )

  const handleGenerate = async () => {
    if (!mainTitle.trim()) {
      toast.error('メインタイトルを入力してください')
      return
    }

    setIsGenerating(true)
    setGeneratedBanners([])
    setSelectedBannerId(null)

    try {
      const res = await fetch('/api/banner/test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: selectedTemplate,
          size,
          industry,
          mainTitle,
          subTitle,
          accentText,
          count: 10, // 多様なバリエーションを生成
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
        if (banners.length > 0) {
          setSelectedBannerId(banners[0].id)
        }
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
      <main className="flex-1 ml-0 md:ml-[240px] min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* ヘッダー */}
          <div className="mb-8">
            <h1 className="text-3xl font-black mb-2">バナーテスト（開発中）</h1>
            <p className="text-gray-400 text-sm">
              TVer/Netflix風のUIでバナーを生成・選択・編集できます。将来的に本体に反映予定の機能です。
            </p>
          </div>

          {/* テンプレート選択セクション */}
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5" />
              テンプレートを選択
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {TEMPLATE_SAMPLES.map((template) => (
                <motion.button
                  key={template.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`flex-shrink-0 w-64 h-40 rounded-xl border-2 overflow-hidden transition-all ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 ring-4 ring-blue-500/20'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center gap-2">
                    <Palette className="w-12 h-12 text-gray-600" />
                    <div className="text-center">
                      <p className="text-sm font-bold">{template.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                    </div>
                    {selectedTemplate === template.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </section>

          {/* 入力フォームセクション */}
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              バナー情報を入力
            </h2>
            <div className="bg-gray-900 rounded-2xl p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">サイズ</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SIZE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">業種</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">選択してください</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
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
                    10種類のバリエーションを生成
                  </>
                )}
              </button>
            </div>
          </section>

          {/* 生成結果セクション（TVer/Netflix風） */}
          {generatedBanners.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                生成されたバナー ({generatedBanners.length}枚)
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 左側: 選択されたバナーの詳細プレビュー */}
                <div className="lg:col-span-2">
                  {selectedBanner && (
                    <div className="bg-gray-900 rounded-2xl overflow-hidden">
                      <div className="relative aspect-video bg-gray-800">
                        <img
                          src={selectedBanner.imageUrl}
                          alt="Selected banner"
                          className="w-full h-full object-contain"
                        />
                        <button
                          onClick={() => handleDownload(selectedBanner)}
                          className="absolute top-4 right-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          ダウンロード
                        </button>
                      </div>
                      {selectedBanner.prompt && (
                        <div className="p-4 border-t border-gray-800">
                          <p className="text-xs text-gray-400 mb-1">使用プロンプト:</p>
                          <p className="text-sm text-gray-300">{selectedBanner.prompt.slice(0, 200)}...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 右側: サムネイルグリッド */}
                <div className="lg:col-span-1">
                  <div className="grid grid-cols-2 gap-3">
                    {generatedBanners.map((banner) => (
                      <motion.button
                        key={banner.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedBannerId(banner.id)}
                        className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${
                          selectedBannerId === banner.id
                            ? 'border-blue-500 ring-4 ring-blue-500/20'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <img
                          src={banner.imageUrl}
                          alt={`Banner ${banner.id}`}
                          className="w-full h-full object-cover"
                        />
                        {selectedBannerId === banner.id && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      <Toaster position="top-right" />
    </div>
  )
}
