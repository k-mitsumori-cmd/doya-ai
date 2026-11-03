'use client'

import { useState } from 'react'
import { adminComparisonLabel } from '@/lib/admin-stat-comparison'
import { useAdminAnalytics } from '@/lib/use-admin-analytics'
import { motion } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Calendar,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react'
import { Toaster } from 'react-hot-toast'

export default function AnalyticsPage() {
  const { data, error, isLoading, isRefreshing, refresh } = useAdminAnalytics()
  const [period, setPeriod] = useState('week')
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

  const maxChartValue = Math.max(...(data.chartData || [1]), 1)

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto min-h-screen bg-[#0A0A0F]">
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
          <div className="flex gap-3">
            <select
              aria-label="表示期間"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="week" className="bg-[#0A0A0F]">過去7日</option>
              <option value="month" className="bg-[#0A0A0F]">過去30日</option>
              <option value="year" className="bg-[#0A0A0F]">過去1年</option>
            </select>
            <button className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm text-white flex items-center gap-2 transition-colors">
              <Download className="w-4 h-4" />
              エクスポート
            </button>
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

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 時間別生成数グラフ */}
          <div className="bg-white/[0.02] backdrop-blur rounded-xl p-6 border border-white/5">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-400" />
              時間別生成数（過去12時間）
            </h2>
            <div className="flex items-end gap-2 h-48">
              {(data.chartData || []).map((value, index) => {
                const height = maxChartValue > 0 ? (value / maxChartValue) * 100 : 0
                const isLast = index === (data.chartData?.length || 0) - 1
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(height, 2)}%` }}
                      transition={{ delay: index * 0.05, duration: 0.5 }}
                      className={`w-full rounded-t-lg ${
                        isLast 
                          ? 'bg-gradient-to-t from-violet-500 to-fuchsia-500' 
                          : 'bg-white/10 hover:bg-white/20'
                      } transition-colors relative group cursor-pointer min-h-[4px]`}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/10 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {value}件
                      </div>
                    </motion.div>
                    <span className="text-[10px] text-white/30">
                      {new Date(Date.now() - (11 - index) * 60 * 60 * 1000).getHours()}:00
                    </span>
                  </div>
                )
              })}
            </div>
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
