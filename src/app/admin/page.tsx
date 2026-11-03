'use client'

import { adminComparisonLabel } from '@/lib/admin-stat-comparison'
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
import { Toaster } from 'react-hot-toast'
import { useAdminDashboard } from '@/lib/use-admin-dashboard'
import { useAdminBilling } from '@/lib/use-admin-billing'
import AdminHourlyChart from '@/components/AdminHourlyChart'
import AdminLegacyMeasurementCoverage from '@/components/AdminLegacyMeasurementCoverage'
import { adminLegacyServiceMeasurement } from '@/lib/admin-stats-measurement'
import { planLabel } from '@/lib/plan-utils'

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
  const billing = useAdminBilling('month')
  const { data: stats, isLoading, isRefreshing, error, refresh } = useAdminDashboard()

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
          <p role="status" className="text-white/50">ダッシュボードを読み込み中...</p>
        </div>
      </div>
    )
  }

  // アクティブユーザー（直近生成したユニークユーザー数を概算）
  const activeUsers = stats?.recentGenerations?.length || 0

  return (
    <div className="min-w-0 w-full min-h-screen bg-[#0A0A0F] text-white p-6">
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
              onClick={() => { refresh(); billing.refresh() }}
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
          <motion.div role="alert" variants={itemVariants} className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div><p className="text-red-400">{stats ? '前回取得したデータを表示しています。' : ''}{error}</p>
            <button type="button" onClick={refresh} disabled={isRefreshing} className="min-h-11 px-3 py-2 text-sm underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2">統計を再取得する</button></div>
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
                  label: '本日の保存記録',
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
            <div className="grid grid-cols-1 lg:grid-cols-3 min-w-0 gap-6 mb-8">
              <AdminHourlyChart className="lg:col-span-2" lastUpdated={stats.lastUpdated} values={stats.chartData} />

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
            <AdminLegacyMeasurementCoverage legacyIds={stats.services?.map(service => service.id) ?? []} />
            {stats.services && stats.services.length > 0 && (
              <motion.div variants={itemVariants} className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-violet-400" />
                    サービス別の登録・保存件数
                  </h2>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.services.map((service) => {
                    const measurement = adminLegacyServiceMeasurement(service.id)
                    const retired = service.isRetired === true || measurement?.isRetired === true
                    const dashboardHref = retired ? null : service.dashboardHref
                    return (
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
                                {measurement ? `${measurement.today.label}（本日）：${service.todayGenerations}${measurement.today.unit}` : '集計定義を確認できません。'}
                              </p>
                            </div>
                          </div>
                          {dashboardHref ? <Link href={dashboardHref} aria-label={`${service.name}を開く`} className="min-h-11 min-w-11 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                            <ExternalLink className="w-4 h-4 text-white" />
                          </Link> : retired ? <span className="text-xs text-white/70">提供終了</span> : null}
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <p className="text-lg font-bold text-white">{service.users === null || !measurement?.users ? '未集計' : `${service.users}${measurement.users.unit}`}</p>
                            <p className="text-[10px] text-white/40">{measurement?.users?.label || service.userCountLabel || 'ユーザー'}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-amber-400">{service.proUsers ?? '未集計'}</p>
                            <p className="text-[10px] text-white/40">個別の有料プラン登録</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-white">{measurement ? `${service.generations.toLocaleString()}${measurement.total.unit}` : '集計定義未確認'}</p>
                            <p className="text-[10px] text-white/40">{measurement?.total.label || '集計定義未確認'}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-emerald-400">{service.revenue === null ? '未按分' : formatCurrency(service.revenue)}</p>
                            <p className="text-[10px] text-white/40">売上（セット契約は未按分）</p>
                          </div>
                        </div>

                        {measurement && <p className="mb-3 text-xs text-white/70">{measurement.total.note}</p>}

                        <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                          <span className="text-[10px] text-white/50">今月累計 / 前月全体</span>
                          <div className="text-xs text-white/70">
                            <span className="font-bold">{adminComparisonLabel(service.growth, service.growthStatus)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    )
                  })}
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
