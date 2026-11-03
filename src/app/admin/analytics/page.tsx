'use client'

import AdminAnalyticsPeriod from '@/components/AdminAnalyticsPeriod'
import { adminComparisonLabel } from '@/lib/admin-stat-comparison'
import AdminHourlyChart from '@/components/AdminHourlyChart'
import AdminLegacyMeasurementCoverage from '@/components/AdminLegacyMeasurementCoverage'
import { adminLegacyServiceMeasurement } from '@/lib/admin-stats-measurement'
import { useAdminAnalytics } from '@/lib/use-admin-analytics'
import { motion } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react'
import { Toaster } from 'react-hot-toast'

export default function AnalyticsPage() {
  const { data, error, isLoading, isRefreshing, refresh } = useAdminAnalytics()
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-violet-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (!data) return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <AdminAnalyticsPeriod />
      <div role="alert" className="p-4 bg-white/5 rounded-xl text-white">
        <p>{error || '利用統計を取得できませんでした。'}</p>
        <button type="button" onClick={refresh} className="min-h-11 px-4 py-2 text-sm underline focus-visible:outline focus-visible:outline-2">再取得する</button>
      </div>
    </div>
  )

  const statsData = [
    { label: '累計の保存記録', value: data.totalGenerations.toLocaleString(), change: '累計', up: true, neutral: true, icon: FileText },
    { label: '本日の保存記録', value: data.todayGenerations.toLocaleString(), change: '実績', up: true, neutral: true, icon: Zap },
    { label: '総ユーザー', value: data.totalUsers.toLocaleString(), change: `登録比率 ${data.conversionRate}%`, up: true, neutral: true, icon: Users },
    { label: '有料プラン登録', value: data.premiumUsers.toLocaleString(), change: `登録比率 ${data.conversionRate}%`, up: true, neutral: true, icon: TrendingUp },
  ]


  return (
    <div className="w-full min-w-0 p-6 sm:p-8 max-w-7xl mx-auto min-h-screen bg-[#0A0A0F]">
      <Toaster position="top-right" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">利用統計</h1>
            <p className="text-white/40 text-sm">サービスの利用状況を確認（実データ）</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={refresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg text-sm text-white flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              更新
            </button>
          </div>
        </div>

        {error && <div role="alert" className="p-4 mb-6 bg-white/5 rounded-xl text-white">
          <p>前回取得したデータを表示しています。{error}</p>
          <button type="button" onClick={refresh} disabled={isRefreshing} className="min-h-11 px-4 py-2 text-sm underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2">再取得する</button>
        </div>}

        <AdminAnalyticsPeriod />
        <h2 className="text-lg font-bold text-white mb-2">現在の累計・本日・暦月の統計</h2>
        <p className="text-sm text-white/70 mb-6">以下は上の期間選択とCSVの対象外です。各見出しに示す期間の数値です。</p>

        {/* 統計カード */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsData.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/[0.02] backdrop-blur rounded-xl p-5 border border-white/5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-violet-400" />
                </div>
                <span className={`flex items-center gap-1 text-sm font-medium ${stat.neutral ? 'text-white/70' : stat.up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {!stat.neutral && (stat.up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />)}
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-white/40">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <AdminLegacyMeasurementCoverage legacyIds={data.services.map(service => service.id)} />

        <div className="grid grid-cols-1 lg:grid-cols-2 min-w-0 gap-6">
          <AdminHourlyChart lastUpdated={data.lastUpdated} values={data.chartData} />

          {/* サービス別の登録・保存件数 */}
          <div className="bg-white/[0.02] backdrop-blur rounded-xl p-6 border border-white/5">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-400" />
              サービス別の登録・保存件数
            </h2>
            <div className="space-y-4">
              {(data.services || []).map(service => {
                const measurement = adminLegacyServiceMeasurement(service.id)
                return (
                  <section key={service.id} aria-label={`${service.name}の件数`} className="min-w-0 rounded-xl border border-white/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white">{service.name}</h3>
                      {measurement?.isRetired && <span className="text-xs text-white/70">提供終了</span>}
                    </div>
                    {measurement ? <>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div><dt className="text-white/70">{measurement.total.label}（累計）</dt><dd className="mt-2 font-semibold text-white">{service.generations.toLocaleString()}{measurement.total.unit}</dd></div>
                        <div><dt className="text-white/70">{measurement.today.label}（本日）</dt><dd className="mt-2 font-semibold text-white">{service.todayGenerations.toLocaleString()}{measurement.today.unit}</dd></div>
                      </dl>
                      <p className="mt-3 text-xs text-white/70">{measurement.total.note}</p>
                      {measurement.total.category !== measurement.today.category && <p className="mt-2 text-xs text-white/70">本日：{measurement.today.note}</p>}
                      <p className="mt-3 text-xs text-white/70">月次比較（今月累計 / 前月全体）：{adminComparisonLabel(service.growth, service.growthStatus)}</p>
                    </> : <p className="mt-3 text-sm text-white/70">集計定義を確認できません。</p>}
                  </section>
                )
              })}
            </div>
          </div>
        </div>

        {/* 月間比較 */}
        <div className="mt-6 bg-white/[0.02] backdrop-blur rounded-xl p-6 border border-white/5">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-violet-400" />
            月間比較
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <p className="text-3xl font-bold text-white">{data.monthGenerations.toLocaleString()}</p>
              <p className="text-sm text-white/40 mt-1">今月の保存記録（途中累計）</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <p className="text-3xl font-bold text-white/60">{data.lastMonthGenerations.toLocaleString()}</p>
              <p className="text-sm text-white/40 mt-1">先月の保存記録（月全体）</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <p className="text-xl font-bold text-white/70">
                {adminComparisonLabel(data.generationGrowth, data.generationGrowthStatus)}
              </p>
              <p className="text-sm text-white/40 mt-1">今月累計 / 前月全体（日本時間）</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
