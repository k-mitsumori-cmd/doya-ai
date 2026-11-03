'use client'

import AdminAnalyticsPeriod from '@/components/AdminAnalyticsPeriod'
import { adminComparisonLabel } from '@/lib/admin-stat-comparison'
import { adminHourlyChartTimes } from '@/lib/admin-hourly-chart'
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
    { label: '総生成数', value: data.totalGenerations.toLocaleString(), change: '累計', up: true, neutral: true, icon: FileText },
    { label: '本日生成', value: data.todayGenerations.toLocaleString(), change: '実績', up: true, neutral: true, icon: Zap },
    { label: '総ユーザー', value: data.totalUsers.toLocaleString(), change: `登録比率 ${data.conversionRate}%`, up: true, neutral: true, icon: Users },
    { label: '有料プラン登録', value: data.premiumUsers.toLocaleString(), change: `登録比率 ${data.conversionRate}%`, up: true, neutral: true, icon: TrendingUp },
  ]

  const chartHours = adminHourlyChartTimes(data.lastUpdated)
  const maxChartValue = Math.max(...(data.chartData || [1]), 1)

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

        <div className="grid grid-cols-1 lg:grid-cols-2 min-w-0 gap-6">
          {/* 時間別生成数グラフ */}
          <div className="min-w-0 bg-white/[0.02] backdrop-blur rounded-xl p-6 border border-white/5">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <BarChart3 aria-hidden="true" className="w-5 h-5 text-violet-400" />
              時間別生成数（過去12時間・日本時間）
            </h2>
            <p className="text-sm text-white/70 mb-4">取得基準：<time dateTime={data.lastUpdated}>{new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'medium', hourCycle: 'h23' }).format(new Date(data.lastUpdated))}</time>（日本時間）。最後の区間は取得時点までの集計です。</p>
            <div role="region" aria-label="時間別グラフ（日本時間）" tabIndex={0} className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
              <ol className="flex items-end gap-2 h-48 min-w-[36rem]" aria-label="時間別の件数">
                {data.chartData.map((value, index) => {
                  const bucket = chartHours[index]
                  const description = `${bucket.date} ${bucket.label} 日本時間：${value}件${bucket.partial ? '（取得時点まで）' : ''}`
                  return (
                    <li key={bucket.since} aria-label={description} className="flex-1 min-w-0 h-full flex flex-col items-center gap-2">
                      <span className="text-xs text-white/70">{value}件</span>
                      <div className="flex-1 min-h-0 w-full flex items-end" aria-hidden="true">
                        <div className={`w-full rounded-t-lg ${index === 11 ? 'bg-violet-500' : 'bg-white/20'}`} style={{ height: `${(value / maxChartValue) * 100}%` }} />
                      </div>
                      <time dateTime={bucket.since} title={description} className="text-xs text-white/70">{bucket.label}</time>
                    </li>
                  )
                })}
              </ol>
            </div>
            <p className="text-xs text-white/70 mt-2">横にスクロールすると全12区間を確認できます。日付は各時刻の説明で確認できます。</p>
          </div>

          {/* サービス別パフォーマンス */}
          <div className="bg-white/[0.02] backdrop-blur rounded-xl p-6 border border-white/5">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-400" />
              サービス別パフォーマンス
            </h2>
            <div className="space-y-4">
              {(data.services || []).map((service) => {
                const maxGen = Math.max(...data.services.map(s => s.generations), 1)
                const percentage = (service.generations / maxGen) * 100
                return (
                  <div key={service.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{service.icon}</span>
                        <span className="text-sm text-white font-medium">{service.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-white font-bold">{service.generations.toLocaleString()}</span>
                        <span className="text-xs text-white/40 ml-1">回</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-white/40">
                      <span>今日: {service.todayGenerations}回</span>
                      <span className="text-white/70">
                        {adminComparisonLabel(service.growth, service.growthStatus)}
                      </span>
                    </div>
                  </div>
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
              <p className="text-sm text-white/40 mt-1">今月の生成数（途中累計）</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <p className="text-3xl font-bold text-white/60">{data.lastMonthGenerations.toLocaleString()}</p>
              <p className="text-sm text-white/40 mt-1">先月の生成数（月全体）</p>
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
