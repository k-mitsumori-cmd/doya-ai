'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Users,
  FileText,
  Activity,
  TrendingUp,
  Crown,
  RefreshCw,
  Zap,
  DollarSign,
  AlertTriangle,
  Sparkles,
  Image,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Eye,
  MousePointer,
  MoreHorizontal,
  ChevronRight,
  Calendar,
  Target,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface ServiceStats {
  id: string
  name: string
  icon: string
  gradient: string
  users: number
  proUsers: number
  generations: number
  todayGenerations: number
  revenue: number
  growth: number
}

interface Stats {
  totalUsers: number
  totalRevenue: number
  totalGenerations: number
  todayGenerations: number
  newUsersToday: number
  activeUsers: number
  conversionRate: number
  services: ServiceStats[]
  recentActivities: Array<{
    id: string
    service: string
    userName: string
    action: string
    createdAt: string
  }>
  chartData: number[]
  lastUpdated: string
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async (showToast = false) => {
    try {
      setIsRefreshing(true)
      
      // モックデータ
      const mockStats: Stats = {
        totalUsers: 1247,
        totalRevenue: 498000,
        totalGenerations: 8934,
        todayGenerations: 431,
        newUsersToday: 12,
        activeUsers: 342,
        conversionRate: 6.8,
        services: [
          {
            id: 'kantan',
            name: 'カンタンドヤAI',
            icon: '📝',
            gradient: 'from-blue-500 to-cyan-500',
            users: 892,
            proUsers: 45,
            generations: 6234,
            todayGenerations: 342,
            revenue: 134100,
            growth: 12.5,
          },
          {
            id: 'banner',
            name: 'ドヤバナーAI',
            icon: '🎨',
            gradient: 'from-violet-500 to-fuchsia-500',
            users: 355,
            proUsers: 38,
            generations: 2700,
            todayGenerations: 89,
            revenue: 379240,
            growth: 28.3,
          },
        ],
        recentActivities: [
          { id: '1', service: 'kantan', userName: '田中太郎', action: 'ビジネスメールを生成', createdAt: new Date().toISOString() },
          { id: '2', service: 'banner', userName: '佐藤花子', action: 'ECバナーを生成', createdAt: new Date(Date.now() - 300000).toISOString() },
          { id: '3', service: 'kantan', userName: '鈴木一郎', action: 'ブログ記事を生成', createdAt: new Date(Date.now() - 600000).toISOString() },
          { id: '4', service: 'banner', userName: '高橋美咲', action: '採用バナーを生成', createdAt: new Date(Date.now() - 900000).toISOString() },
          { id: '5', service: 'kantan', userName: '渡辺健太', action: 'SNS投稿を生成', createdAt: new Date(Date.now() - 1200000).toISOString() },
        ],
        chartData: [120, 180, 150, 210, 280, 320, 290, 350, 380, 420, 390, 431],
        lastUpdated: new Date().toISOString(),
      }
      
      setStats(mockStats)
      setError(null)
      if (showToast) {
        toast.success('データを更新しました', { icon: '🔄' })
      }
    } catch (err) {
      console.error('Stats load error:', err)
      setError('統計データの取得中にエラーが発生しました')
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const formatCurrency = (value: number) => {
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(1)}万`
    }
    return `¥${value.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return 'たった今'
    if (minutes < 60) return `${minutes}分前`
    if (hours < 24) return `${hours}時間前`
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-violet-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-white/50">ダッシュボードを読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6">
      <Toaster position="top-right" />
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">ダッシュボード</h1>
            <p className="text-white/40 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => fetchStats(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm">更新</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-xl hover:opacity-90 transition-all">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-bold">レポート出力</span>
            </button>
          </div>
        </motion.div>

        {/* Error Alert */}
        {error && (
          <motion.div variants={itemVariants} className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
          </motion.div>
        )}

        {stats && (
          <>
            {/* KPI Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { 
                  label: '総ユーザー', 
                  value: stats.totalUsers.toLocaleString(), 
                  subValue: `+${stats.newUsersToday} 今日`,
                  icon: Users, 
                  gradient: 'from-blue-500 to-cyan-500',
                  trend: 12.5,
                  trendUp: true
                },
                { 
                  label: 'プロ会員', 
                  value: stats.services.reduce((sum, s) => sum + s.proUsers, 0).toString(), 
                  subValue: `CVR ${stats.conversionRate}%`,
                  icon: Crown, 
                  gradient: 'from-amber-500 to-orange-500',
                  trend: 8.2,
                  trendUp: true
                },
                { 
                  label: '本日の生成', 
                  value: stats.todayGenerations.toLocaleString(), 
                  subValue: `総計 ${stats.totalGenerations.toLocaleString()}`,
                  icon: Zap, 
                  gradient: 'from-emerald-500 to-green-500',
                  trend: 15.3,
                  trendUp: true
                },
                { 
                  label: '月間売上', 
                  value: formatCurrency(stats.totalRevenue), 
                  subValue: 'MRR',
                  icon: DollarSign, 
                  gradient: 'from-violet-500 to-fuchsia-500',
                  trend: 22.1,
                  trendUp: true
                },
              ].map((kpi, index) => (
                <motion.div
                  key={index}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="relative overflow-hidden bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-5"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-10 rounded-full blur-2xl"
                    style={{ background: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }}
                  />
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                    <kpi.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">{kpi.value}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/40">{kpi.label}</p>
                    <div className={`flex items-center gap-0.5 text-xs font-medium ${kpi.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {kpi.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {kpi.trend}%
                    </div>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">{kpi.subValue}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Chart + Services Grid */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              {/* Mini Chart */}
              <motion.div variants={itemVariants} className="lg:col-span-2 bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-bold text-lg text-white">生成数の推移</h2>
                    <p className="text-xs text-white/40">過去12時間</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {['1H', '12H', '7D', '30D'].map((period) => (
                      <button
                        key={period}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          period === '12H' 
                            ? 'bg-violet-500/20 text-violet-300' 
                            : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Simple Bar Chart */}
                <div className="h-48 flex items-end gap-2">
                  {stats.chartData.map((value, index) => {
                    const maxValue = Math.max(...stats.chartData)
                    const height = (value / maxValue) * 100
                    const isLast = index === stats.chartData.length - 1
                    return (
                      <motion.div
                        key={index}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: index * 0.05, duration: 0.5 }}
                        className={`flex-1 rounded-t-lg ${
                          isLast 
                            ? 'bg-gradient-to-t from-violet-500 to-fuchsia-500' 
                            : 'bg-white/10 hover:bg-white/20'
                        } transition-colors relative group cursor-pointer`}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/10 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {value}件
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  {['12:00', '14:00', '16:00', '18:00', '20:00', '22:00'].map((time) => (
                    <span key={time} className="text-[10px] text-white/30">{time}</span>
                  ))}
                </div>
              </motion.div>

              {/* Active Users */}
              <motion.div variants={itemVariants} className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-6">
                <h2 className="font-bold text-lg text-white mb-4">アクティブユーザー</h2>
                <div className="text-center py-6">
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="none" className="text-white/5" />
                      <circle cx="64" cy="64" r="56" stroke="url(#activeGradient)" strokeWidth="12" fill="none" strokeLinecap="round"
                        strokeDasharray={`${(stats.activeUsers / stats.totalUsers) * 352} 352`}
                      />
                      <defs>
                        <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#D946EF" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-white">{stats.activeUsers}</span>
                      <span className="text-xs text-white/40">オンライン</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">カンタンドヤAI</span>
                    <span className="text-sm font-medium text-white">{Math.floor(stats.activeUsers * 0.65)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">ドヤバナーAI</span>
                    <span className="text-sm font-medium text-white">{Math.floor(stats.activeUsers * 0.35)}</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Service Cards */}
            <motion.div variants={itemVariants} className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-400" />
                  サービス別パフォーマンス
                </h2>
                <Link href="/admin/analytics" className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1">
                  詳細を見る <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                {stats.services.map((service) => (
                  <motion.div
                    key={service.id}
                    whileHover={{ y: -4 }}
                    className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 overflow-hidden"
                  >
                    <div className={`p-5 bg-gradient-to-r ${service.gradient}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl">{service.icon}</span>
                          <div>
                            <h3 className="text-lg font-bold text-white">{service.name}</h3>
                            <p className="text-white/70 text-sm flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              今日 {service.todayGenerations} 生成
                            </p>
                          </div>
                        </div>
                        <Link href={`/${service.id}/dashboard`} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                          <ExternalLink className="w-5 h-5 text-white" />
                        </Link>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xl font-bold text-white">{service.users.toLocaleString()}</p>
                          <p className="text-[10px] text-white/40">ユーザー</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-amber-400">{service.proUsers}</p>
                          <p className="text-[10px] text-white/40">プロ</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-white">{(service.generations / 1000).toFixed(1)}K</p>
                          <p className="text-[10px] text-white/40">生成数</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-emerald-400">{formatCurrency(service.revenue)}</p>
                          <p className="text-[10px] text-white/40">売上</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <span className="text-xs text-white/50">前月比成長率</span>
                        <div className="flex items-center gap-1 text-emerald-400">
                          <ArrowUpRight className="w-4 h-4" />
                          <span className="font-bold">+{service.growth}%</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div variants={itemVariants} className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-lg text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  最近のアクティビティ
                </h2>
                <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <MoreHorizontal className="w-5 h-5 text-white/50" />
                </button>
              </div>

              <div className="space-y-1">
                {stats.recentActivities.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        activity.service === 'kantan' 
                          ? 'bg-blue-500/20' 
                          : 'bg-violet-500/20'
                      }`}>
                        {activity.service === 'kantan' 
                          ? <FileText className="w-5 h-5 text-blue-400" /> 
                          : <Image className="w-5 h-5 text-violet-400" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{activity.userName}</p>
                        <p className="text-xs text-white/40">{activity.action}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/30 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(activity.createdAt)}
                      </span>
                      <button className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg transition-all">
                        <Eye className="w-4 h-4 text-white/50" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 text-center">
                <Link href="/admin/analytics" className="text-sm text-violet-400 hover:text-violet-300">
                  すべてのアクティビティを表示 →
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  )
}
