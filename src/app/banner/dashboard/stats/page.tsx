'use client'

import { useState, useEffect } from 'react'
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
  ChevronRight
} from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'

// 1バナー生成で削減できる推定時間（分）
const ESTIMATED_TIME_SAVED_PER_BANNER = 45 // デザイナーが1バナー作るのに平均45分
const HOURLY_DESIGNER_RATE = 3000 // デザイナー時給の平均（円）

interface HistoryItem {
  id: string
  category: string
  keyword: string
  size: string
  createdAt: string
  banners: string[]
}

interface DailyStats {
  date: string
  count: number
}

export default function StatsPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('banner_history')
      if (stored) {
        const parsed = JSON.parse(stored) as HistoryItem[]
        setHistory(parsed)
      }
    } catch {
      setHistory([])
    }
    setIsLoading(false)
  }, [])

  // 統計計算
  const totalGenerations = history.length
  const totalBanners = history.reduce((acc, item) => acc + (item.banners?.length || 0), 0)
  const totalTimeSavedMinutes = totalBanners * ESTIMATED_TIME_SAVED_PER_BANNER
  const totalTimeSavedHours = Math.floor(totalTimeSavedMinutes / 60)
  const totalCostSaved = Math.floor((totalTimeSavedMinutes / 60) * HOURLY_DESIGNER_RATE)

  // 日別統計
  const dailyStats: DailyStats[] = history.reduce((acc, item) => {
    const date = new Date(item.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
    const existing = acc.find(d => d.date === date)
    if (existing) {
      existing.count += item.banners?.length || 0
    } else {
      acc.push({ date, count: item.banners?.length || 0 })
    }
    return acc
  }, [] as DailyStats[]).slice(-7).reverse()

  // カテゴリ別統計
  const categoryStats = history.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + (item.banners?.length || 0)
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

  if (isLoading) {
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
              <div className="flex items-center gap-3 pl-2">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-800 leading-none">田中 太郎</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Admin</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                  <span className="text-blue-600 font-black text-xs">TT</span>
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
                  const maxCount = topCategories[0]?.[1] || 1
                  const percentage = (count / maxCount) * 100
                  const colors = [
                    'from-orange-500 to-amber-400',
                    'from-blue-500 to-blue-600',
                    'from-amber-400 to-yellow-300',
                    'from-blue-400 to-blue-500',
                    'from-slate-400 to-slate-500',
                  ]
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${colors[i]} flex items-center justify-center text-white text-xs font-bold shadow-md`}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {categoryLabels[cat] || cat}
                          </span>
                          <span className="text-sm font-bold text-gray-900">{count}枚</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                            className={`h-full bg-gradient-to-r ${colors[i]} rounded-full`}
                          />
                        </div>
                      </div>
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

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-lg"
        >
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-amber-500" />
            達成バッジ
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { 
                title: 'はじめの一歩', 
                desc: '初めてバナーを生成', 
                icon: Sparkles, 
                unlocked: totalBanners >= 1,
                color: 'from-blue-500 to-blue-500'
              },
              { 
                title: '量産モード', 
                desc: '10枚以上生成', 
                icon: Zap, 
                unlocked: totalBanners >= 10,
                color: 'from-amber-500 to-orange-500'
              },
              { 
                title: '時短マスター', 
                desc: '5時間以上削減', 
                icon: Clock, 
                unlocked: totalTimeSavedHours >= 5,
                color: 'from-blue-500 to-blue-500'
              },
              { 
                title: 'プロフェッショナル', 
                desc: '50枚以上生成', 
                icon: Target, 
                unlocked: totalBanners >= 50,
                color: 'from-blue-500 to-blue-500'
              },
            ].map((badge, i) => {
              const Icon = badge.icon
              return (
                <div 
                  key={i}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    badge.unlocked 
                      ? 'bg-gradient-to-br from-white to-gray-50 border-gray-200 shadow-md' 
                      : 'bg-gray-50 border-gray-100 opacity-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl mb-2 flex items-center justify-center ${
                    badge.unlocked 
                      ? `bg-gradient-to-br ${badge.color} shadow-lg` 
                      : 'bg-gray-200'
                  }`}>
                    <Icon className={`w-5 h-5 ${badge.unlocked ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <h3 className={`font-bold text-sm ${badge.unlocked ? 'text-gray-900' : 'text-gray-400'}`}>
                    {badge.title}
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">{badge.desc}</p>
                  {badge.unlocked && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6 sm:mt-8 text-center"
        >
          <Link href="/banner">
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-[1.02] transition-all">
              <Sparkles className="w-5 h-5" />
              新しいバナーを生成する
            </button>
          </Link>
        </motion.div>
        </main>
      </div>
    </div>
  )
}

