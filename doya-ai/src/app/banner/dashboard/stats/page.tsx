'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Clock, 
  Zap, 
  TrendingUp, 
  Sparkles, 
  Calendar,
  Target,
  DollarSign,
  BarChart3,
  Award,
  Timer,
  Layers,
  ChevronRight,
  RefreshCw,
  Info,
} from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'
import { useSession } from 'next-auth/react'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

// 1バナー生成で削減できる推定時間（分）
const ESTIMATED_TIME_SAVED_PER_BANNER = 45 // デザイナーが1バナー作るのに平均45分
const HOURLY_DESIGNER_RATE = 3000 // デザイナー時給の平均（円）

interface HistoryItem {
  id: string
  category: string
  keyword: string
  size: string
  createdAt: string
  bannerCount: number // バッチ内の画像枚数
}

interface DailyStats {
  date: string
  count: number
}

const STATS_CACHE_KEY = 'doya-banner-stats-cache'
const STATS_CACHE_TTL_MS = 5 * 60 * 1000 // 5分

function readStatsCache(): { items: HistoryItem[]; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(STATS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.items)) return null
    return { items: parsed.items, ts: parsed.ts || 0 }
  } catch {
    return null
  }
}

function writeStatsCache(items: HistoryItem[]) {
  try {
    sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ items, ts: Date.now() }))
  } catch {
    // ignore
  }
}

export default function StatsPage() {
  const { data: session, status } = useSession()
  const isGuest = status !== 'loading' && !session
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [requiresUpgrade, setRequiresUpgrade] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tipIndex, setTipIndex] = useState(0)
  const [isStale, setIsStale] = useState(false)

  const LOADING_TIPS = [
    '統計は直近6ヶ月分の履歴から集計しています',
    'A/B/Cを作り分けると勝ちパターンが見つかりやすいです',
    'YouTubeは「短い強い言葉＋表情」で伸びやすいです',
    '表示が重い場合は少し待ってから再試行してください',
  ]

  useEffect(() => {
    if (!isLoading && isLoaded) return
    const t = window.setInterval(() => setTipIndex((v) => (v + 1) % LOADING_TIPS.length), 1800)
    return () => window.clearInterval(t)
  }, [isLoading, isLoaded])

  // ログインユーザーはAPIから、ゲストは統計閲覧不可
  const loadHistory = useCallback(async () => {
    if (status === 'loading') return

    // stale-while-revalidate: キャッシュがあれば即表示→期限切れなら裏で更新
    const cached = readStatsCache()
    if (cached && cached.items.length > 0) {
      setHistory(cached.items)
      setIsLoaded(true)
      const expired = Date.now() - cached.ts > STATS_CACHE_TTL_MS
      if (!expired) return
      setIsStale(true)
    }

    setIsLoading(true)
    setRequiresUpgrade(false)
    setErrorMessage(null)
    try {
      if (isGuest) {
        // ゲストは統計閲覧不可（有料プラン限定）
        setHistory([])
        setRequiresUpgrade(true)
      } else {
        // ログインユーザーはAPIから取得
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 15_000)
        // 統計は画像不要なので軽量モードで取得
        const res = await fetch('/api/banner/history?take=200&images=0', { signal: controller.signal }) // 最大200バッチで集計
        window.clearTimeout(timeout)
        if (res.ok) {
          const data = await res.json()
          // 有料プラン限定チェック
          if (data.requiresUpgrade) {
            setHistory([])
            setRequiresUpgrade(true)
          } else {
            const items = Array.isArray(data.items) ? data.items : []
            const mapped: HistoryItem[] = items.map((item: any) => ({
              id: item.id,
              category: item.category || '',
              keyword: item.keyword || '',
              size: item.size || '',
              createdAt: item.createdAt || new Date().toISOString(),
              bannerCount: Number(item.bannerCount) > 0 ? Number(item.bannerCount) : 1,
            }))
            setHistory(mapped)
            writeStatsCache(mapped)
          }
        } else {
          setHistory([])
          setErrorMessage('統計の取得に失敗しました（再読み込み/再試行してください）')
        }
      }
    } catch (e: any) {
      setHistory([])
      if (e?.name === 'AbortError') {
        setErrorMessage('統計の取得がタイムアウトしました（通信状況をご確認のうえ再試行してください）')
      } else {
        setErrorMessage('統計の取得に失敗しました（再読み込み/再試行してください）')
      }
    } finally {
      setIsLoaded(true)
      setIsLoading(false)
      setIsStale(false)
    }
  }, [isGuest, status])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // セッションが「loading」のまま固まった時でも無限ローディングにしない（UX救済）
  useEffect(() => {
    if (status !== 'loading') return
    const t = window.setTimeout(() => {
      setIsLoaded(true)
      setIsLoading(false)
      setHistory([])
      setRequiresUpgrade(true)
      setErrorMessage('ログイン状態の確認に時間がかかっています。再読み込みすると解消する場合があります。')
    }, 8000)
    return () => window.clearTimeout(t)
  }, [status])

  // 統計計算
  const totalGenerations = history.length
  const totalBanners = history.reduce((sum, item) => sum + item.bannerCount, 0)
  const totalTimeSavedMinutes = totalBanners * ESTIMATED_TIME_SAVED_PER_BANNER
  const totalTimeSavedHours = Math.floor(totalTimeSavedMinutes / 60)
  const totalCostSaved = Math.floor((totalTimeSavedMinutes / 60) * HOURLY_DESIGNER_RATE)

  const estimateBasisText = `根拠：\n- 1枚あたりの制作時間を ${ESTIMATED_TIME_SAVED_PER_BANNER} 分と仮定\n- デザイナー時給を ${HOURLY_DESIGNER_RATE.toLocaleString()} 円と仮定\n\n計算：\n- 推定削減時間 = 累計生成枚数 × ${ESTIMATED_TIME_SAVED_PER_BANNER} 分 ÷ 60\n- 推定コスト削減 = 推定削減時間（時間）× ${HOURLY_DESIGNER_RATE.toLocaleString()} 円`

  // 日別統計（バナー枚数ベース）
  const dailyStats: DailyStats[] = history.reduce((acc, item) => {
    const date = new Date(item.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
    const existing = acc.find(d => d.date === date)
    if (existing) {
      existing.count += item.bannerCount
    } else {
      acc.push({ date, count: item.bannerCount })
    }
    return acc
  }, [] as DailyStats[]).slice(-7).reverse()

  // カテゴリ別統計（バナー枚数ベース）
  const categoryStats = history.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.bannerCount
    return acc
  }, {} as Record<string, number>)

  const topCategories = Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const categoryLabels: Record<string, string> = {
    telecom: '通信',
    marketing: 'マーケ',
    ec: 'EC',
    recruit: '採用',
    beauty: '美容',
    food: '飲食',
    realestate: '不動産',
    education: '教育',
    finance: '金融',
    health: '医療',
    it: 'IT',
    other: 'その他',
  }

  // 今週と先週の比較
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const thisWeekCount = history.filter(item => new Date(item.createdAt) >= oneWeekAgo).reduce((s, i) => s + i.bannerCount, 0)
  const lastWeekCount = history.filter(item => {
    const date = new Date(item.createdAt)
    return date >= twoWeeksAgo && date < oneWeekAgo
  }).reduce((s, i) => s + i.bannerCount, 0)

  const weeklyGrowth = lastWeekCount > 0 
    ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100) 
    : thisWeekCount > 0 ? 100 : 0

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-blue-50/20">
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>
        <div className="md:pl-[240px] flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="mx-auto animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            <p className="mt-4 text-xs font-bold text-slate-500">{LOADING_TIPS[tipIndex]}</p>
          </div>
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-blue-50/20">
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>
        <div className="md:pl-[240px] transition-all duration-200">
          <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
              <div className="h-16 sm:h-20 flex items-center gap-4">
                <Link href="/banner/dashboard" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 text-slate-400" />
                </Link>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  パフォーマンス分析
                </h1>
              </div>
            </div>
          </header>
          <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm"
            >
              <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100">
                <BarChart3 className="w-12 h-12 text-slate-300" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3">統計を読み込めませんでした</h2>
              <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">{errorMessage}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => loadHistory()}
                  disabled={isLoading}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-100 hover:scale-105 disabled:opacity-60"
                >
                  再試行
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all"
                >
                  再読み込み
                </button>
                <a
                  href={SUPPORT_CONTACT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-8 py-4 bg-white border border-gray-200 text-slate-800 font-black rounded-2xl transition-all hover:bg-slate-50"
                >
                  お問い合わせ
                </a>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    )
  }

  // 有料プラン限定
  if (requiresUpgrade) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-blue-50/20">
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>
        <div className="md:pl-[240px] transition-all duration-200">
          <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
              <div className="h-16 sm:h-20 flex items-center gap-4">
                <Link href="/banner/dashboard" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 text-slate-400" />
                </Link>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  パフォーマンス分析
                </h1>
              </div>
            </div>
          </header>
          <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24 bg-white rounded-3xl border border-amber-200 shadow-sm"
            >
              <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-100">
                <BarChart3 className="w-12 h-12 text-amber-400" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3">有料プラン限定機能</h2>
              <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
                パフォーマンス分析は有料プラン限定です。<br />
                プランをアップグレードすると、6ヶ月分の<br />
                生成統計・削減効果を確認できます。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <CheckoutButton
                  planId="banner-pro"
                  loginCallbackUrl="/banner/dashboard/stats"
                  variant="secondary"
                  className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-amber-100 hover:scale-105"
                >
                  プランをアップグレード（Stripeへ）
                </CheckoutButton>
                <Link href="/banner/dashboard">
                  <button className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all">
                    バナーを生成する
                  </button>
                </Link>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-blue-50/20">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>
      <div className="md:pl-[240px] transition-all duration-200">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
          <div className="h-16 sm:h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/banner/dashboard" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </Link>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                パフォーマンス分析
              </h1>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-6">
              <button
                onClick={() => loadHistory()}
                disabled={isLoading}
                className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                title="更新"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <div className="flex items-center gap-3 pl-2">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-800 leading-none">{session?.user?.name || 'ゲスト'}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{isGuest ? 'Guest' : 'User'}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-blue-600 font-black text-xs">{session?.user?.name?.[0]?.toUpperCase() || 'G'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8">
        {/* Summary Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Total Banners */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-6 group hover:shadow-md transition-all">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-100 group-hover:scale-105 transition-transform">
              <Layers className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Banners</p>
              <p className="text-4xl font-black text-slate-800 tracking-tighter">{totalBanners}</p>
            </div>
          </div>

          {/* Time Saved */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-6 group hover:shadow-md transition-all">
            <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-100 group-hover:scale-105 transition-transform">
              <Timer className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Time Saved</p>
                <span className="relative group/tt">
                  <Info className="w-4 h-4 text-slate-400 cursor-help" aria-label="根拠" />
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[260px] whitespace-pre-line rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-xl opacity-0 group-hover/tt:opacity-100 transition-opacity"
                  >
                    {estimateBasisText}
                  </span>
                </span>
              </div>
              <p className="text-4xl font-black text-slate-800 tracking-tighter">{totalTimeSavedHours}<span className="text-xl ml-1">h</span></p>
            </div>
          </div>

          {/* Cost Reduction */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-6 group hover:shadow-md transition-all">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-100 group-hover:scale-105 transition-transform">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cost Reduction</p>
                <span className="relative group/tt">
                  <Info className="w-4 h-4 text-slate-400 cursor-help" aria-label="根拠" />
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[260px] whitespace-pre-line rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-xl opacity-0 group-hover/tt:opacity-100 transition-opacity"
                  >
                    {estimateBasisText}
                  </span>
                </span>
              </div>
              <p className="text-4xl font-black text-slate-800 tracking-tighter">¥{totalCostSaved.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* 週間グラフ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                週間生成推移
              </h2>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
                weeklyGrowth >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
              }`}>
                <TrendingUp className={`w-3 h-3 ${weeklyGrowth < 0 ? 'rotate-180' : ''}`} />
                {weeklyGrowth >= 0 ? '+' : ''}{weeklyGrowth}%
              </div>
            </div>
            
            {dailyStats.length > 0 ? (
              <div className="flex items-end justify-between gap-2 h-40">
                {dailyStats.map((day, i) => {
                  const maxCount = Math.max(...dailyStats.map(d => d.count), 1)
                  const height = (day.count / maxCount) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '120px' }}>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-500 to-amber-400 rounded-t-lg"
                        />
                        {day.count > 0 && (
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-600">
                            {day.count}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500">{day.date}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                まだデータがありません
              </div>
            )}
          </motion.div>

          {/* カテゴリ別 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-lg"
          >
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-blue-500" />
              業種別ランキング
            </h2>
            
            {topCategories.length > 0 ? (
              <div className="space-y-3">
                {topCategories.map(([cat, count], i) => {
                  const maxCount = Math.max(...topCategories.map(([_, c]) => c), 1)
                  const width = (count / maxCount) * 100
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center text-xs font-black text-gray-400 bg-gray-100 rounded-full">{i + 1}</span>
                      <span className="w-20 text-sm font-bold text-gray-700 truncate">{categoryLabels[cat] || cat}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                          className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                        />
                      </div>
                      <span className="text-xs font-black text-gray-600 w-8 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                まだデータがありません
              </div>
            )}
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-center mt-12"
        >
          <Link href="/banner/dashboard">
            <button className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-100 hover:scale-105 transition-all">
              新しいバナーを生成する
              <ChevronRight className="w-5 h-5" />
            </button>
          </Link>
        </motion.div>
      </main>
      </div>
    </div>
  )
}
