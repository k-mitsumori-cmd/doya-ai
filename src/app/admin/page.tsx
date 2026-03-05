'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Users,
  FileText,
  Activity,
  Crown,
  RefreshCw,
  Zap,
  DollarSign,
  AlertTriangle,
  Image,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
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
  // 基本統計
  totalUsers: number
  premiumUsers: number
  enterpriseUsers: number
  freeUsers: number
  
  // 生成統計
  totalGenerations: number
  todayGenerations: number
  monthGenerations: number
  lastMonthGenerations: number
  generationGrowth: number
  avgGenerationsPerUser: number
  
  // 収益統計
  monthlyRevenue: number
  mrr: number
  
  // KPI
  conversionRate: number
  
  // サービス別
  services: ServiceStats[]
  
  // 時系列
  chartData: number[]
  
  // 最近のアクティビティ
  recentUsers: number
  recentGenerations: Array<{
    id: string
    userName: string
    service: string
    action: string
    createdAt: string
  }>
  
  // セキュリティ
  adminLoginAttempts: number
  
  // メタ情報
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
      setError(null)
      
      const response = await fetch('/api/admin/stats', {
        credentials: 'include',
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('統計データの取得に失敗しました')
      }
      
      const data = await response.json()
      setStats(data)
      
      if (showToast) {
        toast.success('データを更新しました', { icon: '🔄' })
      }
    } catch (err) {
      console.error('Stats load error:', err)
      setError(err instanceof Error ? err.message : '統計データの取得中にエラーが発生しました')
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

  // アクティブユーザー（直近生成したユニークユーザー数を概算）
  const activeUsers = stats?.recentGenerations?.length || 0

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
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {[
                { 
                  label: '総ユーザー', 
                  value: stats.totalUsers.toLocaleString(), 
                  subValue: `+${stats.recentUsers} 今週`,
                  icon: Users, 
                  gradient: 'from-blue-500 to-cyan-500',
                  trend: stats.recentUsers > 0 ? stats.recentUsers : null,
                  trendUp: true
                },
                { 
                  label: 'プロ会員', 
                  value: stats.premiumUsers.toString(), 
                  subValue: `CVR ${stats.conversionRate}%`,
                  icon: Crown, 
                  gradient: 'from-amber-500 to-orange-500',
                  trend: stats.conversionRate > 0 ? stats.conversionRate : null,
                  trendUp: stats.conversionRate > 0
                },
                { 
                  label: '本日の生成', 
                  value: stats.todayGenerations.toLocaleString(), 
                  subValue: `総計 ${stats.totalGenerations.toLocaleString()}`,
                  icon: Zap, 
                  gradient: 'from-emerald-500 to-green-500',
                  trend: stats.generationGrowth !== 0 ? stats.generationGrowth : null,
                  trendUp: stats.generationGrowth > 0
                },
                { 
                  label: '月間売上', 
                  value: formatCurrency(stats.monthlyRevenue), 
                  subValue: 'MRR',
                  icon: DollarSign, 
                  gradient: 'from-violet-500 to-fuchsia-500',
                  trend: stats.mrr > 0 ? 100 : null,
                  trendUp: stats.mrr > 0
                },
              ].map((kpi, index) => (
                <motion.div
                  key={index}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="relative overflow-hidden bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-5"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                    <kpi.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">{kpi.value}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/40">{kpi.label}</p>
                    {kpi.trend !== null && (
                      <div className={`flex items-center gap-0.5 text-xs font-medium ${kpi.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                        {kpi.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {typeof kpi.trend === 'number' ? kpi.trend.toFixed(1) : kpi.trend}%
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">{kpi.subValue}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Chart + Active Users Grid */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              {/* Chart */}
              <motion.div variants={itemVariants} className="lg:col-span-2 bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-bold text-lg text-white">生成数の推移</h2>
                    <p className="text-xs text-white/40">過去12時間（実データ）</p>
                  </div>
                </div>
                
                {/* Bar Chart */}
                <div className="h-48 flex items-end gap-2">
                  {(stats.chartData || []).map((value, index) => {
                    const maxValue = Math.max(...(stats.chartData || [1]), 1)
                    const height = maxValue > 0 ? (value / maxValue) * 100 : 0
                    const isLast = index === (stats.chartData?.length || 0) - 1
                    return (
                      <motion.div
                        key={index}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(height, 2)}%` }}
                        transition={{ delay: index * 0.05, duration: 0.5 }}
                        className={`flex-1 rounded-t-lg ${
                          isLast 
                            ? 'bg-gradient-to-t from-violet-500 to-fuchsia-500' 
                            : 'bg-white/10 hover:bg-white/20'
                        } transition-colors relative group cursor-pointer min-h-[4px]`}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/10 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {value}件
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-white/30">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const hour = new Date(Date.now() - (11 - i * 2) * 60 * 60 * 1000).getHours()
                    return <span key={i}>{hour}:00</span>
                  })}
                </div>
              </motion.div>

              {/* Active Users / User Breakdown */}
              <motion.div variants={itemVariants} className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-6">
                <h2 className="font-bold text-lg text-white mb-4">ユーザー内訳</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Crown className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm text-white">有料会員</span>
                    </div>
                    <span className="font-bold text-amber-400">{stats.premiumUsers}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm text-white">Stripe連携</span>
                    </div>
                    <span className="font-bold text-violet-400">{stats.enterpriseUsers}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-white/60" />
                      </div>
                      <span className="text-sm text-white">無料ユーザー</span>
                    </div>
                    <span className="font-bold text-white/60">{stats.freeUsers}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <Link 
                    href="/admin/users" 
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-500/20 border border-violet-500/30 rounded-xl text-violet-400 hover:bg-violet-500/30 transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    ユーザー管理
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            </div>

            {/* Service Cards */}
            {stats.services && stats.services.length > 0 && (
              <motion.div variants={itemVariants} className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-violet-400" />
                    サービス別パフォーマンス
                  </h2>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.services.map((service) => (
                    <motion.div
                      key={service.id}
                      whileHover={{ y: -4 }}
                      className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 overflow-hidden"
                    >
                      <div className={`p-4 bg-gradient-to-r ${service.gradient}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{service.icon}</span>
                            <div>
                              <h3 className="text-base font-bold text-white">{service.name}</h3>
                              <p className="text-white/70 text-xs flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                今日 {service.todayGenerations} 生成
                              </p>
                            </div>
                          </div>
                          <Link href={`/${service.id}/dashboard`} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                            <ExternalLink className="w-4 h-4 text-white" />
                          </Link>
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <p className="text-lg font-bold text-white">{service.users}</p>
                            <p className="text-[10px] text-white/40">ユーザー</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-amber-400">{service.proUsers}</p>
                            <p className="text-[10px] text-white/40">有料</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-white">{service.generations.toLocaleString()}</p>
                            <p className="text-[10px] text-white/40">総生成数</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-emerald-400">{formatCurrency(service.revenue)}</p>
                            <p className="text-[10px] text-white/40">売上</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                          <span className="text-[10px] text-white/50">前月比</span>
                          <div className={`flex items-center gap-1 text-xs ${service.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {service.growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            <span className="font-bold">{service.growth >= 0 ? '+' : ''}{service.growth}%</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Recent Activity */}
            <motion.div variants={itemVariants} className="bg-white/[0.02] backdrop-blur rounded-2xl border border-white/5 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-lg text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  最近のアクティビティ
                </h2>
                <span className="text-xs text-white/40">過去24時間</span>
              </div>

              {stats.recentGenerations && stats.recentGenerations.length > 0 ? (
                <div className="space-y-1">
                  {stats.recentGenerations.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          activity.service === 'banner' 
                            ? 'bg-violet-500/20' 
                            : activity.service === 'seo'
                            ? 'bg-emerald-500/20'
                            : 'bg-blue-500/20'
                        }`}>
                          {activity.service === 'banner' 
                            ? <Image className="w-5 h-5 text-violet-400" /> 
                            : <FileText className="w-5 h-5 text-blue-400" />
                          }
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{activity.userName}</p>
                          <p className="text-xs text-white/40">{activity.action}</p>
                        </div>
                      </div>
                      <span className="text-xs text-white/30 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(activity.createdAt)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/40">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">過去24時間のアクティビティはありません</p>
                </div>
              )}
            </motion.div>

            {/* Last Updated */}
            <motion.div variants={itemVariants} className="mt-4 text-center">
              <p className="text-xs text-white/30">
                最終更新: {new Date(stats.lastUpdated).toLocaleString('ja-JP')} | 管理者ログイン試行(24h): {stats.adminLoginAttempts}回
              </p>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  )
}
