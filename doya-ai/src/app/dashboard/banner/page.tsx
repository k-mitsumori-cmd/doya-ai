'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { 
  Sparkles, Loader2, AlertCircle, ChevronRight, 
  Zap, Palette, Crown, ArrowRight, ArrowLeft,
  CheckCircle, Star, Wand2, Image as ImageIcon
} from 'lucide-react'
import toast from 'react-hot-toast'

// サイズプリセット
const SIZE_PRESETS = [
  { value: '1080x1080', label: '1080×1080', desc: 'Instagram / Facebook', icon: '📱', popular: true },
  { value: '1200x628', label: '1200×628', desc: 'Facebook広告 / OGP', icon: '🖼️', popular: true },
  { value: '1080x1920', label: '1080×1920', desc: 'ストーリーズ / リール', icon: '📲', popular: false },
  { value: '300x250', label: '300×250', desc: 'ディスプレイ広告', icon: '🎯', popular: false },
  { value: '728x90', label: '728×90', desc: 'リーダーボード', icon: '📰', popular: false },
  { value: '160x600', label: '160×600', desc: 'スカイスクレイパー', icon: '🗼', popular: false },
]

// カテゴリ
const CATEGORIES = [
  { 
    value: 'telecom', 
    label: '通信向け', 
    icon: '📱', 
    desc: '格安SIM・光回線・WiFi',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    examples: ['格安SIM乗り換え', 'キャッシュバック', '月額割引'],
  },
  { 
    value: 'marketing', 
    label: 'マーケティング', 
    icon: '📊', 
    desc: 'リード獲得・ウェビナー',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    examples: ['ウェビナー集客', '資料ダウンロード', '無料相談'],
  },
  { 
    value: 'ec', 
    label: 'EC向け', 
    icon: '🛒', 
    desc: 'セール・新商品・キャンペーン',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    examples: ['セール告知', '新商品発売', '送料無料'],
  },
  { 
    value: 'recruit', 
    label: '採用向け', 
    icon: '👥', 
    desc: '求人・説明会・インターン',
    color: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    examples: ['エンジニア募集', '新卒採用', '会社説明会'],
  },
  { 
    value: 'beauty', 
    label: '美容・コスメ', 
    icon: '💄', 
    desc: 'スキンケア・化粧品・エステ',
    color: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    examples: ['スキンケア', 'コスメ新作', '限定セット'],
  },
  { 
    value: 'food', 
    label: '飲食・フード', 
    icon: '🍽️', 
    desc: 'レストラン・デリバリー・食品',
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    examples: ['デリバリー', '限定メニュー', 'クーポン'],
  },
]

// 目的
const PURPOSES = [
  { value: 'ctr', label: 'CTR重視', icon: '👆', desc: 'クリック率を最大化' },
  { value: 'cv', label: 'CV重視', icon: '🎯', desc: 'コンバージョン重視' },
  { value: 'awareness', label: '認知重視', icon: '👁️', desc: 'ブランド認知向上' },
]

// トーン
const TONES = [
  { value: 'trust', label: '信頼感', icon: '🏢' },
  { value: 'friendly', label: '親しみやすさ', icon: '😊' },
  { value: 'luxury', label: '高級感', icon: '✨' },
  { value: 'deal', label: 'お得感', icon: '💰' },
  { value: 'urgent', label: '緊急感', icon: '⏰' },
]

// サンプルデータ
const SAMPLE_INPUTS = [
  { category: 'telecom', size: '1080x1080', keyword: '月額990円〜 乗り換えで最大2万円キャッシュバック', purpose: 'cv', tone: 'deal', label: '格安SIM' },
  { category: 'ec', size: '1200x628', keyword: '決算セール MAX70%OFF 本日限り！', purpose: 'ctr', tone: 'urgent', label: 'ECセール' },
  { category: 'recruit', size: '1080x1080', keyword: 'エンジニア積極採用中 リモートOK 年収600万〜', purpose: 'awareness', tone: 'trust', label: '採用' },
  { category: 'beauty', size: '1080x1920', keyword: '美肌の秘密 92%が効果を実感 初回50%OFF', purpose: 'cv', tone: 'luxury', label: '美容' },
  { category: 'marketing', size: '1200x628', keyword: '無料ウェビナー開催 AIで売上2倍に', purpose: 'ctr', tone: 'trust', label: 'ウェビナー' },
]

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export default function BannerPage() {
  const { data: session, status } = useSession()
  
  // フォーム状態
  const [category, setCategory] = useState('')
  const [size, setSize] = useState('1080x1080')
  const [keyword, setKeyword] = useState('')
  const [purpose, setPurpose] = useState('')
  const [tone, setTone] = useState('')
  
  // UI状態
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [generatedBanners, setGeneratedBanners] = useState<string[]>([])

  const plan = (session?.user as any)?.plan || 'FREE'
  const isPro = plan === 'PRO' || plan === 'PREMIUM'

  // サンプル入力
  const handleSampleInput = () => {
    const sample = SAMPLE_INPUTS[Math.floor(Math.random() * SAMPLE_INPUTS.length)]
    setCategory(sample.category)
    setSize(sample.size)
    setKeyword(sample.keyword)
    setPurpose(sample.purpose)
    setTone(sample.tone)
    setShowAdvanced(true)
    toast.success(`サンプル「${sample.label}」を入力しました！`, { icon: '✨' })
  }

  const canGenerate = category !== '' && keyword.trim() !== ''

  const handleGenerate = async () => {
    setError('')

    if (!category) {
      setError('カテゴリを選択してください')
      return
    }

    if (!keyword.trim()) {
      setError('キーワード/キャッチコピーを入力してください')
      return
    }

    setIsGenerating(true)

    try {
      // モック生成（実際のAPI接続前）
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // デモ用のプレースホルダー画像
      const mockBanners = [
        `https://via.placeholder.com/${size.replace('x', '/')}/3B82F6/FFFFFF?text=Banner+A`,
        `https://via.placeholder.com/${size.replace('x', '/')}/8B5CF6/FFFFFF?text=Banner+B`,
        `https://via.placeholder.com/${size.replace('x', '/')}/10B981/FFFFFF?text=Banner+C`,
      ]
      
      setGeneratedBanners(mockBanners)
      toast.success('バナーを生成しました！', { icon: '🎨' })
    } catch (err) {
      console.error('Generation error:', err)
      setError('エラーが発生しました。しばらくしてからお試しください。')
    } finally {
      setIsGenerating(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ImageIcon className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-white lg:bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            ツール一覧に戻る
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-2xl">🎨</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">バナー生成</h1>
                  <p className="text-gray-600">AIがA/B/Cの3案を自動生成</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleSampleInput}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-bold rounded-xl shadow-lg transition-all"
            >
              <Wand2 className="w-4 h-4" />
              サンプルで試す
            </button>
          </div>
          
          {/* モバイル用サンプルボタン */}
          <button
            onClick={handleSampleInput}
            className="sm:hidden w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold rounded-xl shadow-lg mt-4"
          >
            <Wand2 className="w-4 h-4" />
            ワンボタンでサンプルを試す
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* 生成結果 */}
        {generatedBanners.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl p-6 border-2 border-green-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              生成完了！A/B/Cの3案
            </h2>
            <div className="grid gap-4">
              {generatedBanners.map((url, index) => (
                <div key={index} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-700">
                      {['A案（ベネフィット訴求）', 'B案（緊急性訴求）', 'C案（社会的証明）'][index]}
                    </span>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      ダウンロード
                    </button>
                  </div>
                  <img 
                    src={url} 
                    alt={`Banner ${String.fromCharCode(65 + index)}`}
                    className="w-full rounded-lg"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => setGeneratedBanners([])}
              className="w-full mt-4 py-3 text-gray-600 hover:text-gray-800 font-medium rounded-xl border-2 border-gray-200 hover:bg-gray-50 transition-colors"
            >
              新しいバナーを作成
            </button>
          </div>
        )}

        {/* 入力フォーム */}
        {generatedBanners.length === 0 && (
          <div className="space-y-6">
            {/* Step 1: カテゴリ選択 */}
            <div className="bg-white rounded-2xl p-5 border-2 border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <h2 className="font-bold text-gray-900">カテゴリを選択</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={cn(
                      "relative p-4 rounded-xl border-2 text-left transition-all",
                      category === cat.value
                        ? `${cat.bgColor} ${cat.borderColor} ring-2 ring-offset-2 ring-purple-500`
                        : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-xl",
                        category === cat.value 
                          ? `bg-gradient-to-br ${cat.color}` 
                          : "bg-gray-100"
                      )}>
                        {cat.icon}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{cat.label}</p>
                        <p className="text-sm text-gray-500">{cat.desc}</p>
                      </div>
                    </div>
                    {category === cat.value && (
                      <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-purple-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: サイズ選択 */}
            <div className="bg-white rounded-2xl p-5 border-2 border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <h2 className="font-bold text-gray-900">サイズを選択</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setSize(preset.value)}
                    className={cn(
                      "relative p-3 rounded-xl border-2 text-center transition-all",
                      size === preset.value
                        ? "border-purple-500 bg-purple-50 ring-2 ring-offset-2 ring-purple-500"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {preset.popular && (
                      <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                        人気
                      </span>
                    )}
                    <span className="text-xl block mb-1">{preset.icon}</span>
                    <p className="font-bold text-gray-900 text-sm">{preset.label}</p>
                    <p className="text-xs text-gray-500">{preset.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: キーワード入力 */}
            <div className="bg-white rounded-2xl p-5 border-2 border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <h2 className="font-bold text-gray-900">訴求内容を入力</h2>
              </div>

              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="例: 乗り換えで月額990円、業界最安"
                className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                maxLength={200}
              />

              {/* 例文サジェスト */}
              {category && !keyword && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">クリックして入力:</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.find(c => c.value === category)?.examples.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setKeyword(ex)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 詳細オプション */}
            <div className="bg-white rounded-2xl p-5 border-2 border-gray-200">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-gray-400" />
                  <span className="font-bold text-gray-900">詳細オプション（任意）</span>
                </div>
                <ChevronRight className={cn(
                  "w-5 h-5 text-gray-400 transition-transform",
                  showAdvanced && "rotate-90"
                )} />
              </button>

              {showAdvanced && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                  {/* 目的 */}
                  <div>
                    <p className="font-medium text-gray-700 mb-2">目的</p>
                    <div className="flex flex-wrap gap-2">
                      {PURPOSES.map((p) => (
                        <button
                          key={p.value}
                          onClick={() => setPurpose(purpose === p.value ? '' : p.value)}
                          className={cn(
                            "px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                            purpose === p.value
                              ? "border-purple-500 bg-purple-50 text-purple-700"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          )}
                        >
                          {p.icon} {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* トーン */}
                  <div>
                    <p className="font-medium text-gray-700 mb-2">トーン</p>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTone(tone === t.value ? '' : t.value)}
                          className={cn(
                            "px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                            tone === t.value
                              ? "border-purple-500 bg-purple-50 text-purple-700"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          )}
                        >
                          {t.icon} {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 生成ボタン */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className={cn(
                "w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3",
                canGenerate && !isGenerating
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-xl shadow-purple-500/30"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>AIが生成中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  <span>バナーを生成する（A/B/C 3案）</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {!canGenerate && (
              <p className="text-center text-sm text-gray-500">
                カテゴリを選択し、キーワードを入力してください
              </p>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 p-5 bg-purple-50 rounded-2xl border border-purple-100">
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-purple-900 mb-2">💡 より良いバナーを作るコツ</h3>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• <strong>短く刺さる一言</strong>を入力すると効果的です</li>
                <li>• <strong>具体的な数字</strong>（月額990円、30%OFF など）を入れると訴求力UP</li>
                <li>• 目的・トーンを指定すると、より最適化されたバナーが生成されます</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

