'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminComparisonLabel, type AdminComparisonStatus } from '@/lib/admin-stat-comparison'
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
  Clock,
  ChevronRight,
  Calendar,
  Target,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { useAdminBilling } from '@/lib/use-admin-billing'
import { planLabel } from '@/lib/plan-utils'

interface ServiceStats {
  dashboardHref?: string | null
  isRetired?: boolean
  id: string
  name: string
  icon: string
  gradient: string
  users: number | null
  userCountLabel?: string
  proUsers: number | null
  generations: number
  todayGenerations: number
  revenue: number | null
  growth: number | null
  growthStatus: AdminComparisonStatus
}

interface Stats {
  // 基本統計
  totalUsers: number
  registeredPlanTiers?: Record<'GUEST' | 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE', number>
  premiumUsers: number
  enterpriseUsers: number
  freeUsers: number
  
  // 生成統計
  totalGenerations: number
  todayGenerations: number
  monthGenerations: number
  lastMonthGenerations: number
  generationGrowth: number | null
  generationGrowthStatus: AdminComparisonStatus
  avgGenerationsPerUser: number
  
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
  const billing = useAdminBilling('month')
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
      console.error('Stats load error:')
      setError(err instanceof Error ? err.message : '統計データの取得中にエラーが発生しました')
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const formatCurrency = (value: number) => `¥${value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`

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
              onClick={() => { void fetchStats(true); billing.refresh() }}
              disabled={isRefreshing || billing.isRefreshing}
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

        <section aria-label="入金・契約指標" className="mb-6 rounded-xl border border-white/10 bg-[#1F1F1F] p-4">
          {billing.error && <p role="alert" className="mb-3 text-sm text-red-300">{billing.error}{billing.data ? ' 前回取得したデータを表示しています。' : ''}</p>}
          {billing.isLoading && <p role="status" className="text-sm text-white/70">入金・契約指標を取得しています。</p>}
          {billing.data && <div className="space-y-2 text-sm text-white/70">
            <p>{billing.data.label}の返金控除後入金：{formatCurrency(billing.data.netRevenue)}。ドヤAIの定期契約に紐づくJPYが対象です。単発購入・他事業は含みません。</p>
            <p>取得時点のMRR（税抜の月額換算）：{formatCurrency(billing.data.mrr)}。期間内の入金額とは異なります。</p>
            <p>取得基準：{new Date(billing.data.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）。サービス別の売上は按分していません。</p>
          </div>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={billing.refresh} disabled={billing.isRefreshing}
              className="min-h-11 whitespace-nowrap rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-50">入金・契約指標を再取得</button>
            <Link href="/admin/billing" className="inline-flex min-h-11 items-center px-3 py-2 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">割引・返金の内訳を見る</Link>
          </div>
        </section>

        {stats && (
          <>
            {/* KPI Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {[
                { 
                  label: '総ユーザー', 
                  value: stats.totalUsers.toLocaleString(), 
                  subValue: `過去7日 +${stats.recentUsers}人`,
                  icon: Users, 
                  gradient: 'from-blue-500 to-cyan-500',
                  trend: null,
                  trendUp: true
                },
                { 
                  label: '有料プラン登録',
                  value: stats.premiumUsers.toString(), 
                  subValue: `登録比率 ${stats.conversionRate}%`,
                  icon: Crown, 
                  gradient: 'from-amber-500 to-orange-500',
                  trend: null,
                  trendUp: false
                },
                { 
                  label: '本日の生成', 
                  value: stats.todayGenerations.toLocaleString(), 
                  subValue: `総計 ${stats.totalGenerations.toLocaleString()}`,
                  icon: Zap, 
                  gradient: 'from-emerald-500 to-green-500',
                  trend: null,
                  trendUp: (stats.generationGrowth ?? 0) > 0
                },
                { 
                  label: '当月の返金控除後入金',
                  value: billing.data ? formatCurrency(billing.data.netRevenue) : billing.error ? '取得失敗' : '取得中',
                  subValue: '定期契約・JPY',
                  icon: DollarSign,
                  gradient: 'from-violet-500 to-fuchsia-500',
                  trend: null,
                  trendUp: false
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
                <h2 className="font-bold text-lg text-white mb-4">登録状況</h2>
                <p className="mb-4 text-sm text-white/70">プラン登録には手動付与を含みます。Stripe ID登録は他の登録数と重複するため、合計しないでください。支払済みの人数は表していません。</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Crown className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm text-white">有料プラン登録</span>
                    </div>
                    <span className="font-bold text-amber-400">{stats.premiumUsers}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm text-white">Stripe ID登録</span>
                    </div>
                    <span className="font-bold text-violet-400">{stats.enterpriseUsers}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-white/60" />
                      </div>
                      <span className="text-sm text-white">その他の登録</span>
                    </div>
                    <span className="font-bold text-white/60">{stats.freeUsers}</span>
                  </div>
                </div>

                {stats.registeredPlanTiers && <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-white">登録プランの内訳</h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm text-white/70">
                    {(['GUEST', 'FREE', 'LIGHT', 'PRO', 'ENTERPRISE'] as const).map(tier => <div key={tier}>
                      <dt>{planLabel(tier)}{tier === 'GUEST' || tier === 'FREE' ? '相当' : ''}</dt>
                      <dd className="font-semibold text-white">{stats.registeredPlanTiers![tier]}人</dd>
                    </div>)}
                  </dl>
                  <p className="text-xs text-white/70">共通のプラン分類で集計しています。未認識の値は無料相当に含まれます。支払済みの人数は表していません。</p>
                </div>}

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
            <p className="mb-4 text-sm text-white/70">サービスごとのプラン登録数を表示します。共通プランによる利用権や実際の利用者数とは異なります。未集計の人数は0人に置き換えていません。</p>
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
                          {service.dashboardHref ? <Link href={service.dashboardHref} aria-label={`${service.name}を開く`} className="min-h-11 min-w-11 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                            <ExternalLink className="w-4 h-4 text-white" />
                          </Link> : service.isRetired ? <span className="text-xs text-white/70">提供終了</span> : null}
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <p className="text-lg font-bold text-white">{service.users ?? '未集計'}</p>
                            <p className="text-[10px] text-white/40">{service.userCountLabel || 'ユーザー'}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-amber-400">{service.proUsers ?? '未集計'}</p>
                            <p className="text-[10px] text-white/40">個別の有料プラン登録</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-white">{service.generations.toLocaleString()}</p>
                            <p className="text-[10px] text-white/40">総生成数</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-emerald-400">{service.revenue === null ? '未按分' : formatCurrency(service.revenue)}</p>
                            <p className="text-[10px] text-white/40">売上（セット契約は未按分）</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                          <span className="text-[10px] text-white/50">今月累計 / 前月全体</span>
                          <div className="text-xs text-white/70">
                            <span className="font-bold">{adminComparisonLabel(service.growth, service.growthStatus)}</span>
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
