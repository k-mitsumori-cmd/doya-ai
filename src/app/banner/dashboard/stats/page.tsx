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
} from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'
import { useSession } from 'next-auth/react'

// 1バナー生成で削減できる推定時間（分）
const ESTIMATED_TIME_SAVED_PER_BANNER = 45 // デザイナーが1バナー作るのに平均45分
const HOURLY_DESIGNER_RATE = 3000 // デザイナー時給の平均（円）

interface HistoryItem {
  id: string
  category: string
  keyword: string
  size: string
  createdAt: string
}

interface DailyStats {
  date: string
  count: number
}

export default function StatsPage() {
  const { data: session, status } = useSession()
  const isGuest = status !== 'loading' && !session
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // ログインユーザーはAPIから、ゲストはlocalStorageから読み込み
  const loadHistory = useCallback(async () => {
    if (status === 'loading') return
    setIsLoading(true)
    try {
      if (isGuest) {
        // ゲストはlocalStorageから取得
        const stored = localStorage.getItem('banner_history')
        if (stored) {
          const parsed = JSON.parse(stored) as any[]
          setHistory(parsed.map((item: any) => ({
            id: item.id || '',
            category: item.category || '',
            keyword: item.keyword || '',
            size: item.size || '',
            createdAt: item.createdAt || new Date().toISOString(),
          })))
        } else {
          setHistory([])
        }
      } else {
        // ログインユーザーはAPIから取得
        const res = await fetch('/api/banner/history?take=200') // 最大200件で集計
        if (res.ok) {
          const data = await res.json()
          const items = Array.isArray(data.items) ? data.items : []
          setHistory(items.map((item: any) => ({
            id: item.id,
            category: item.category || '',
            keyword: item.keyword || '',
            size: item.size || '',
            createdAt: item.createdAt || new Date().toISOString(),
          })))
        } else {
          setHistory([])
        }
      }
    } catch {
      setHistory([])
    } finally {
      setIsLoading(false)
    }
  }, [isGuest, status])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // 統計計算
  const totalGenerations = history.length
  const totalBanners = totalGenerations // 1生成=1画像（グループ化してないので）
  const totalTimeSavedMinutes = totalBanners * ESTIMATED_TIME_SAVED_PER_BANNER
  const totalTimeSavedHours = Math.floor(totalTimeSavedMinutes / 60)
  const totalCostSaved = Math.floor((totalTimeSavedMinutes / 60) * HOURLY_DESIGNER_RATE)

  // 日別統計
  const dailyStats: DailyStats[] = history.reduce((acc, item) => {
    const date = new Date(item.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
    const existing = acc.find(d => d.date === date)
    if (existing) {
      existing.count += 1
    } else {
      acc.push({ date, count: 1 })
    }
    return acc
  }, [] as DailyStats[]).slice(-7).reverse()

  // カテゴリ別統計
  const categoryStats = history.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1
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

  const thisWeekCount = history.filter(item => new Date(item.createdAt) >= oneWeekAgo).length
  const lastWeekCount = history.filter(item => {
    const date = new Date(item.createdAt)
    return date >= twoWeeksAgo && date < oneWeekAgo
  }).length

  const weeklyGrowth = lastWeekCount > 0 
    ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100) 
    : thisWeekCount > 0 ? 100 : 0

  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-blue-50/20">
        <DashboardSidebar />
        <div className="pl-[72px] lg:pl-[240px] flex items-center justify-center min-h-screen">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-blue-50/20">
      <DashboardSidebar />
      <div className="pl-[72px] lg:pl-[240px] transition-all duration-200">
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
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Time Saved</p>
              <p className="text-4xl font-black text-slate-800 tracking-tighter">{totalTimeSavedHours}<span className="text-xl ml-1">h</span></p>
            </div>
          </div>

          {/* Cost Reduction */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-6 group hover:shadow-md transition-all">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-100 group-hover:scale-105 transition-transform">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Cost Reduction</p>
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
