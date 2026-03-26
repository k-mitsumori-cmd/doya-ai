'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Send,
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Calendar,
  Activity,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface KpiData {
  totalSent: number
  openRate: number
  clickRate: number
  bounceRate: number
}

interface ChartPoint {
  date: string
  sent: number
  opened: number
  clicked: number
}

interface SequencePerformance {
  id: string
  name: string
  status: string
  totalSent: number
  openRate: number
  clickRate: number
  enrolledUsers: number
}

interface DashboardData {
  kpi: KpiData
  chart: ChartPoint[]
  sequences: SequencePerformance[]
}

const RANGE_OPTIONS = [
  { value: '7d', label: '7日間' },
  { value: '30d', label: '30日間' },
  { value: '90d', label: '90日間' },
]

export default function DripDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [range, setRange] = useState('7d')

  const fetchData = useCallback(async (showToast = false) => {
    try {
      setIsRefreshing(true)
      const res = await fetch(`/api/admin/drip/dashboard?range=${range}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('データの取得に失敗しました')
      }
      const result = await res.json()
      setData(result)
      if (showToast) {
        toast.success('データを更新しました')
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      toast.error('データの取得に失敗しました')
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }, [range, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const kpiCards = [
    {
      label: '総配信数',
      value: data?.kpi.totalSent ?? 0,
      format: (v: number) => v.toLocaleString(),
      icon: Send,
      from: 'from-violet-500/10',
      to: 'to-violet-500/5',
      border: 'border-violet-500/20',
      iconColor: 'text-violet-400',
    },
    {
      label: '開封率',
      value: data?.kpi.openRate ?? 0,
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: MailOpen,
      from: 'from-emerald-500/10',
      to: 'to-emerald-500/5',
      border: 'border-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'クリック率',
      value: data?.kpi.clickRate ?? 0,
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: MousePointerClick,
      from: 'from-blue-500/10',
      to: 'to-blue-500/5',
      border: 'border-blue-500/20',
      iconColor: 'text-blue-400',
    },
    {
      label: 'バウンス率',
      value: data?.kpi.bounceRate ?? 0,
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: AlertTriangle,
      from: 'from-rose-500/10',
      to: 'to-rose-500/5',
      border: 'border-rose-500/20',
      iconColor: 'text-rose-400',
    },
  ]

  const maxChartValue = data?.chart
    ? Math.max(...data.chart.map((p) => p.sent), 1)
    : 1

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-violet-400" />
            ドリップマーケティング ダッシュボード
          </h1>
          <p className="text-white/50 text-sm mt-1">メール配信の全体パフォーマンス</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 rounded-lg p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  range === opt.value
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-white/50 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {kpiCards.map((card, i) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`bg-gradient-to-br ${card.from} ${card.to} border ${card.border} rounded-2xl p-6`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-white/50 font-medium">{card.label}</p>
                    <Icon className={`w-5 h-5 ${card.iconColor}`} />
                  </div>
                  <p className="text-3xl font-black text-white mt-2">
                    {card.format(card.value)}
                  </p>
                </motion.div>
              )
            })}
          </div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 mb-8"
          >
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-white/40" />
              <h2 className="text-lg font-bold">配信推移</h2>
              <div className="ml-auto flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-violet-500" /> 送信
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500" /> 開封
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-blue-500" /> クリック
                </span>
              </div>
            </div>
            <div className="flex items-end gap-1 h-48">
              {data?.chart?.map((point, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div className="w-full flex items-end gap-[2px] h-40">
                    <div
                      className="flex-1 bg-violet-500/60 rounded-t-sm transition-all"
                      style={{ height: `${(point.sent / maxChartValue) * 100}%` }}
                      title={`送信: ${point.sent}`}
                    />
                    <div
                      className="flex-1 bg-emerald-500/60 rounded-t-sm transition-all"
                      style={{ height: `${(point.opened / maxChartValue) * 100}%` }}
                      title={`開封: ${point.opened}`}
                    />
                    <div
                      className="flex-1 bg-blue-500/60 rounded-t-sm transition-all"
                      style={{ height: `${(point.clicked / maxChartValue) * 100}%` }}
                      title={`クリック: ${point.clicked}`}
                    />
                  </div>
                  <span className="text-[10px] text-white/30 truncate w-full text-center">
                    {point.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Sequence Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-white/40" />
              <h2 className="text-lg font-bold">シーケンス パフォーマンス</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.sequences?.map((seq) => (
                <div
                  key={seq.id}
                  className="bg-white/[0.02] border border-white/10 rounded-xl p-5 hover:border-violet-500/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/drip/sequences/${seq.id}`)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm truncate">{seq.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        seq.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : seq.status === 'paused'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-white/10 text-white/40'
                      }`}
                    >
                      {seq.status === 'active'
                        ? '配信中'
                        : seq.status === 'paused'
                        ? '一時停止'
                        : '下書き'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-white/40">配信数</p>
                      <p className="text-lg font-bold">{seq.totalSent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">開封率</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {seq.openRate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/40">クリック率</p>
                      <p className="text-lg font-bold text-blue-400">
                        {seq.clickRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/30">
                    登録ユーザー: {seq.enrolledUsers}名
                  </div>
                </div>
              ))}
              {(!data?.sequences || data.sequences.length === 0) && (
                <div className="col-span-full text-center py-12 text-white/30">
                  シーケンスがありません
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
