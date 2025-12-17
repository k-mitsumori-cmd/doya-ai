'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { 
  Sparkles, Loader2, AlertCircle,
  ArrowRight, CheckCircle, Wand2,
  ArrowLeft, LogIn
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

// カテゴリ
const CATEGORIES = [
  { value: 'telecom', label: '通信・SIM', icon: '📱', gradient: 'from-blue-500 to-cyan-500' },
  { value: 'marketing', label: 'マーケ', icon: '📊', gradient: 'from-purple-500 to-pink-500' },
  { value: 'ec', label: 'EC・セール', icon: '🛒', gradient: 'from-amber-500 to-orange-500' },
  { value: 'recruit', label: '採用', icon: '👥', gradient: 'from-emerald-500 to-green-500' },
  { value: 'beauty', label: '美容', icon: '💄', gradient: 'from-pink-500 to-rose-500' },
  { value: 'food', label: '飲食', icon: '🍽️', gradient: 'from-red-500 to-orange-500' },
]

// サイズプリセット
const SIZE_PRESETS = [
  { value: '1080x1080', label: 'スクエア', desc: 'Instagram', popular: true },
  { value: '1200x628', label: '横長', desc: 'Facebook広告', popular: true },
  { value: '1080x1920', label: '縦長', desc: 'ストーリーズ', popular: false },
]

// サンプルデータ
const SAMPLE_INPUTS = [
  { category: 'telecom', keyword: '月額990円〜 乗り換えで最大2万円キャッシュバック' },
  { category: 'ec', keyword: '決算セール MAX70%OFF 本日限り！' },
  { category: 'recruit', keyword: 'エンジニア積極採用中 リモートOK 年収600万〜' },
  { category: 'beauty', keyword: '今だけ初回50%OFF 美肌ケアキット' },
]

// ゲストの1日の上限
const GUEST_DAILY_LIMIT = 1
const GUEST_STORAGE_KEY = 'banner_guest_usage'

function getGuestUsage(): { count: number; date: string } {
  if (typeof window === 'undefined') return { count: 0, date: '' }
  const stored = localStorage.getItem(GUEST_STORAGE_KEY)
  if (!stored) return { count: 0, date: '' }
  try {
    return JSON.parse(stored)
  } catch {
    return { count: 0, date: '' }
  }
}

function setGuestUsage(count: number) {
  if (typeof window === 'undefined') return
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ count, date: today }))
}

export default function BannerDashboardPage() {
  const { data: session, status } = useSession()
  
  // フォーム状態
  const [category, setCategory] = useState('')
  const [size, setSize] = useState('1080x1080')
  const [keyword, setKeyword] = useState('')
  
  // UI状態
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [generatedBanners, setGeneratedBanners] = useState<string[]>([])
  const [guestUsageCount, setGuestUsageCount] = useState(0)

  const isGuest = !session
  const userName = session?.user?.name?.split(' ')[0] || 'ゲスト'

  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      const usage = getGuestUsage()
      const today = new Date().toISOString().split('T')[0]
      if (usage.date === today) {
        setGuestUsageCount(usage.count)
      } else {
        setGuestUsageCount(0)
      }
    }
  }, [isGuest])

  const guestRemainingCount = GUEST_DAILY_LIMIT - guestUsageCount
  const canGuestGenerate = guestRemainingCount > 0
  const canGenerate = category !== '' && keyword.trim() !== '' && (session || canGuestGenerate)

  // サンプル入力
  const handleSampleInput = () => {
    const sample = SAMPLE_INPUTS[Math.floor(Math.random() * SAMPLE_INPUTS.length)]
    setCategory(sample.category)
    setKeyword(sample.keyword)
    toast.success('サンプルを入力しました！', { icon: '✨' })
  }

  const handleGenerate = async () => {
    setError('')

    if (!category) {
      setError('カテゴリを選択してください')
      return
    }

    if (!keyword.trim()) {
      setError('訴求内容を入力してください')
      return
    }

    if (isGuest && !canGuestGenerate) {
      setError('本日の無料お試しは上限に達しました。ログインでもっと使えます！')
      return
    }

    setIsGenerating(true)

    try {
      // モック生成
      await new Promise(resolve => setTimeout(resolve, 2500))
      
      const mockBanners = [
        `https://via.placeholder.com/${size.replace('x', '/')}/8B5CF6/FFFFFF?text=A`,
        `https://via.placeholder.com/${size.replace('x', '/')}/EC4899/FFFFFF?text=B`,
        `https://via.placeholder.com/${size.replace('x', '/')}/10B981/FFFFFF?text=C`,
      ]
      
      setGeneratedBanners(mockBanners)
      toast.success('バナー生成完了！', { icon: '🎨' })

      // ゲストの使用回数を更新
      if (isGuest) {
        const newCount = guestUsageCount + 1
        setGuestUsageCount(newCount)
        setGuestUsage(newCount)
      }
    } catch (err) {
      setError('エラーが発生しました。')
    } finally {
      setIsGenerating(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-fuchsia-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">🎨</span>
          </div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Toaster position="top-center" />
      
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm hidden sm:inline">ポータル</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <span className="text-lg">🎨</span>
            </div>
            <span className="font-bold text-gray-800">ドヤバナーAI</span>
          </div>
          
          {session ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                <span className="text-violet-600 text-sm font-bold">{userName[0]}</span>
              </div>
            </div>
          ) : (
            <Link href="/auth/signin?service=banner" className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-full hover:bg-violet-700 transition-colors">
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">ログイン</span>
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* ゲストバナー */}
        {isGuest && (
          <div className="mb-6 p-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200 rounded-2xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">🆓 お試しモード</p>
                  <p className="text-sm text-gray-600">
                    残り <span className="font-bold text-violet-600">{guestRemainingCount}回</span>（1日{GUEST_DAILY_LIMIT}回まで）
                  </p>
                </div>
              </div>
              <Link href="/auth/signin?service=banner">
                <button className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-full transition-colors flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  ログインで3回に！
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* 生成結果 */}
        {generatedBanners.length > 0 ? (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-4">
                <CheckCircle className="w-4 h-4" />
                生成完了！
              </div>
              <h1 className="text-2xl font-bold text-gray-900">A/B/C 3案できました！</h1>
            </div>

            <div className="space-y-4 mb-6">
              {generatedBanners.map((url, index) => (
                <div key={index} className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-gray-700">
                      {['A案', 'B案', 'C案'][index]}
                    </span>
                    <button className="px-3 py-1.5 bg-violet-100 text-violet-700 text-sm font-medium rounded-lg hover:bg-violet-200 transition-colors">
                      ダウンロード
                    </button>
                  </div>
                  <img src={url} alt={`Banner ${String.fromCharCode(65 + index)}`} className="w-full rounded-xl" />
                </div>
              ))}
            </div>

            <button
              onClick={() => setGeneratedBanners([])}
              className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors"
            >
              新しいバナーを作成
            </button>
          </div>
        ) : (
          <>
            {/* タイトル */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
                バナーを作ろう！ 🎨
              </h1>
              <p className="text-gray-600">
                カテゴリと訴求内容を入力するだけ
              </p>
            </div>

            {/* サンプルボタン */}
            <button
              onClick={handleSampleInput}
              className="w-full mb-6 py-3 px-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"
            >
              <Wand2 className="w-5 h-5" />
              ワンボタンでサンプル入力
            </button>

            {/* エラー */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Step 1: カテゴリ */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">① カテゴリを選択</h2>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`
                      p-3 rounded-xl text-center transition-all
                      ${category === cat.value 
                        ? `bg-gradient-to-br ${cat.gradient} text-white shadow-lg scale-105` 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }
                    `}
                  >
                    <span className="text-2xl block mb-1">{cat.icon}</span>
                    <span className="text-xs font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: サイズ */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">② サイズを選択</h2>
              <div className="grid grid-cols-3 gap-2">
                {SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setSize(preset.value)}
                    className={`
                      p-3 rounded-xl text-center transition-all relative
                      ${size === preset.value 
                        ? 'bg-violet-100 border-2 border-violet-500 text-violet-700' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-2 border-transparent'
                      }
                    `}
                  >
                    {preset.popular && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                        人気
                      </span>
                    )}
                    <span className="font-bold text-sm block">{preset.label}</span>
                    <span className="text-xs text-gray-500">{preset.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: 訴求内容 */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-3">③ 訴求内容を入力</h2>
              <textarea
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="例: 月額990円〜 乗り換えで最大2万円キャッシュバック"
                className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all resize-none"
                rows={3}
                maxLength={200}
              />
              <p className="text-right text-xs text-gray-400 mt-1">{keyword.length}/200</p>
            </div>

            {/* 生成ボタン */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className={`
                w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3
                ${canGenerate && !isGenerating
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-xl shadow-violet-500/25 hover:shadow-2xl'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  AIが生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  バナーを生成する（A/B/C 3案）
                </>
              )}
            </button>
          </>
        )}

        {/* 文章作成への誘導 */}
        {generatedBanners.length === 0 && (
          <Link href="/kantan/dashboard" className="block mt-8">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-5 flex items-center gap-4 hover:shadow-xl transition-all">
              <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">📝</span>
              </div>
              <div className="flex-1">
                <p className="text-white/80 text-sm">文章も作れる！</p>
                <h3 className="text-lg font-bold text-white">カンタンドヤAI</h3>
              </div>
              <ArrowRight className="w-5 h-5 text-white/70" />
            </div>
          </Link>
        )}
      </main>

      {/* フッター */}
      <footer className="py-6 px-4 border-t border-gray-100 mt-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">ドヤAI</Link>
          <div className="flex items-center gap-4">
            <Link href="/banner/dashboard/history" className="hover:text-gray-700">履歴</Link>
            <Link href="/banner/pricing" className="hover:text-gray-700">料金</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
