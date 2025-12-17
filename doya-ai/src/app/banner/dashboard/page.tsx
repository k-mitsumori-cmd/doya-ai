'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { 
  Sparkles, Loader2, AlertCircle, ChevronRight, 
  Crown, ArrowRight, CheckCircle, Star, Wand2,
  Home, Clock, Palette, LogOut, Menu, X, ExternalLink, LogIn
} from 'lucide-react'
import toast from 'react-hot-toast'
import ServiceNav, { OtherServicesCard } from '@/components/ServiceNav'

// カテゴリ
const CATEGORIES = [
  { value: 'telecom', label: '通信向け', icon: '📱', desc: '格安SIM・光回線', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', examples: ['格安SIM乗り換え', 'キャッシュバック'] },
  { value: 'marketing', label: 'マーケティング', icon: '📊', desc: 'リード獲得', color: 'from-purple-500 to-pink-500', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', examples: ['ウェビナー集客', '資料ダウンロード'] },
  { value: 'ec', label: 'EC向け', icon: '🛒', desc: 'セール・キャンペーン', color: 'from-amber-500 to-orange-500', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', examples: ['セール告知', '新商品発売'] },
  { value: 'recruit', label: '採用向け', icon: '👥', desc: '求人・説明会', color: 'from-emerald-500 to-green-500', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', examples: ['エンジニア募集', '会社説明会'] },
  { value: 'beauty', label: '美容・コスメ', icon: '💄', desc: 'スキンケア', color: 'from-pink-500 to-rose-500', bgColor: 'bg-pink-50', borderColor: 'border-pink-200', examples: ['スキンケア', '限定セット'] },
  { value: 'food', label: '飲食・フード', icon: '🍽️', desc: 'レストラン', color: 'from-red-500 to-orange-500', bgColor: 'bg-red-50', borderColor: 'border-red-200', examples: ['デリバリー', 'クーポン'] },
]

// サイズプリセット
const SIZE_PRESETS = [
  { value: '1080x1080', label: '1080×1080', desc: 'Instagram', icon: '📱', popular: true },
  { value: '1200x628', label: '1200×628', desc: 'Facebook広告', icon: '🖼️', popular: true },
  { value: '1080x1920', label: '1080×1920', desc: 'ストーリーズ', icon: '📲', popular: false },
  { value: '300x250', label: '300×250', desc: 'ディスプレイ', icon: '🎯', popular: false },
]

// サンプルデータ
const SAMPLE_INPUTS = [
  { category: 'telecom', size: '1080x1080', keyword: '月額990円〜 乗り換えで最大2万円キャッシュバック', label: '格安SIM' },
  { category: 'ec', size: '1200x628', keyword: '決算セール MAX70%OFF 本日限り！', label: 'ECセール' },
  { category: 'recruit', size: '1080x1080', keyword: 'エンジニア積極採用中 リモートOK 年収600万〜', label: '採用' },
]

// ゲストの1日の上限
const GUEST_DAILY_LIMIT = 1
const GUEST_STORAGE_KEY = 'banner_guest_usage'

// ゲスト使用状況を取得
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

// ゲスト使用状況を保存
function setGuestUsage(count: number) {
  if (typeof window === 'undefined') return
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ count, date: today }))
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export default function BannerDashboardPage() {
  const { data: session, status } = useSession()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
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
  const plan = (session?.user as any)?.bannerPlan || 'FREE'
  const isPro = plan === 'PRO'
  const userName = session?.user?.name?.split(' ')[0] || 'ゲスト'

  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest) {
      const usage = getGuestUsage()
      const today = new Date().toISOString().split('T')[0]
      if (usage.date === today) {
        setGuestUsageCount(usage.count)
      } else {
        setGuestUsageCount(0)
      }
    }
  }, [isGuest])

  // サンプル入力
  const handleSampleInput = () => {
    const sample = SAMPLE_INPUTS[Math.floor(Math.random() * SAMPLE_INPUTS.length)]
    setCategory(sample.category)
    setSize(sample.size)
    setKeyword(sample.keyword)
    toast.success(`サンプル「${sample.label}」を入力しました！`, { icon: '✨' })
  }

  // ゲストの残り回数
  const guestRemainingCount = GUEST_DAILY_LIMIT - guestUsageCount
  const canGuestGenerate = guestRemainingCount > 0

  const canGenerate = category !== '' && keyword.trim() !== '' && (session || canGuestGenerate)

  const handleGenerate = async () => {
    setError('')

    if (!category) {
      setError('カテゴリを選択してください')
      return
    }

    if (!keyword.trim()) {
      setError('キーワードを入力してください')
      return
    }

    // ゲストの場合、上限チェック
    if (isGuest && !canGuestGenerate) {
      setError('本日の無料お試しは上限に達しました。ログインするともっと使えます！')
      return
    }

    setIsGenerating(true)

    try {
      // モック生成
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const mockBanners = [
        `https://via.placeholder.com/${size.replace('x', '/')}/8B5CF6/FFFFFF?text=Banner+A`,
        `https://via.placeholder.com/${size.replace('x', '/')}/EC4899/FFFFFF?text=Banner+B`,
        `https://via.placeholder.com/${size.replace('x', '/')}/10B981/FFFFFF?text=Banner+C`,
      ]
      
      setGeneratedBanners(mockBanners)
      toast.success('バナーを生成しました！', { icon: '🎨' })

      // ゲストの使用回数を更新
      if (isGuest) {
        const newCount = guestUsageCount + 1
        setGuestUsageCount(newCount)
        setGuestUsage(newCount)
      }
    } catch (err) {
      setError('エラーが発生しました。しばらくしてからお試しください。')
    } finally {
      setIsGenerating(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">🎨</span>
          </div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* サイドバー */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-gray-200
        transform transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          {/* ロゴ */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
            <Link href="/banner" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-xl">🎨</span>
              </div>
              <span className="font-bold text-gray-800">ドヤバナーAI</span>
            </Link>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* ナビゲーション */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <Link href="/banner/dashboard">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50 text-purple-600 font-medium">
                <Home className="w-5 h-5" />
                <span>バナー生成</span>
              </div>
            </Link>
            <Link href="/banner/dashboard/history">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 font-medium">
                <Clock className="w-5 h-5" />
                <span>生成履歴</span>
              </div>
            </Link>
            <Link href="/banner/dashboard/brand">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 font-medium">
                <Palette className="w-5 h-5" />
                <span>ブランド設定</span>
              </div>
            </Link>

            {/* サービス間リンク */}
            <div className="pt-4">
              <OtherServicesCard currentService="banner" />
            </div>
          </nav>

          {/* ゲスト向け: ログイン誘導 */}
          {isGuest && (
            <div className="p-3">
              <Link href="/auth/signin?service=banner">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-3 text-center hover:opacity-90 transition-opacity">
                  <p className="font-bold text-sm">🔐 ログインして使う</p>
                  <p className="text-xs opacity-80">1日3回まで生成可能に！</p>
                </div>
              </Link>
            </div>
          )}

          {/* プラン表示（ログイン済み） */}
          {session && !isPro && (
            <div className="p-3">
              <Link href="/banner/pricing">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-3 text-center hover:opacity-90 transition-opacity">
                  <p className="font-bold text-sm">✨ プロプランにアップグレード</p>
                  <p className="text-xs opacity-80">無制限に生成可能</p>
                </div>
              </Link>
            </div>
          )}

          {/* ユーザー情報 */}
          <div className="p-3 border-t border-gray-100">
            {session ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-purple-600 font-bold">{session?.user?.name?.[0] || 'U'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate text-sm">{session?.user?.name}</p>
                    <p className="text-xs text-gray-500">{isPro ? 'プロプラン' : '無料プラン'}</p>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/banner' })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500 font-bold">G</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">ゲスト</p>
                    <p className="text-xs text-gray-500">残り{guestRemainingCount}回/日</p>
                  </div>
                </div>
                <Link href="/auth/signin?service=banner">
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors text-sm font-medium">
                    <LogIn className="w-4 h-4" />
                    ログインする
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* オーバーレイ */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* メインコンテンツ */}
      <main className="flex-1">
        {/* モバイルヘッダー */}
        <header className="lg:hidden sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2">
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xl">🎨</span>
              <span className="font-bold text-gray-800">ドヤバナーAI</span>
            </div>
          </div>
          {/* サービス切替ボタン */}
          <ServiceNav currentService="banner" />
        </header>

        {/* PCヘッダー（サービス切替） */}
        <header className="hidden lg:flex sticky top-0 z-30 h-14 bg-white/80 backdrop-blur-md border-b border-gray-200 items-center justify-end px-6">
          <ServiceNav currentService="banner" />
        </header>

        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* ゲストバナー */}
          {isGuest && (
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">🎨 お試しモード</p>
                    <p className="text-sm text-gray-600">
                      残り <span className="font-bold text-purple-600">{guestRemainingCount}回</span> 生成できます（1日{GUEST_DAILY_LIMIT}回まで）
                    </p>
                  </div>
                </div>
                <Link href="/auth/signin?service=banner">
                  <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    ログインで3回に増加
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isGuest ? 'バナーを無料で試す' : 'バナーを生成'}
              </h1>
              <p className="text-gray-600">カテゴリを選んでキーワードを入力してください</p>
            </div>
            <button
              onClick={handleSampleInput}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold rounded-xl shadow-lg transition-all"
            >
              <Wand2 className="w-4 h-4" />
              サンプルで試す
            </button>
          </div>

          {/* モバイル用サンプルボタン */}
          <button
            onClick={handleSampleInput}
            className="sm:hidden w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold rounded-xl shadow-lg mb-6"
          >
            <Wand2 className="w-4 h-4" />
            ワンボタンでサンプルを試す
          </button>

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
                      <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                        ダウンロード
                      </button>
                    </div>
                    <img src={url} alt={`Banner ${String.fromCharCode(65 + index)}`} className="w-full rounded-lg" />
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
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center text-lg",
                          category === cat.value ? `bg-gradient-to-br ${cat.color}` : "bg-gray-100"
                        )}>
                          {cat.icon}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{cat.label}</p>
                          <p className="text-xs text-gray-500">{cat.desc}</p>
                        </div>
                      </div>
                      {category === cat.value && (
                        <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-purple-600" />
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                      <p className="font-bold text-gray-900 text-xs">{preset.label}</p>
                      <p className="text-[10px] text-gray-500">{preset.desc}</p>
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
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

