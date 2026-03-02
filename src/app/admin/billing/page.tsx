'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Users,
  Download,
  ArrowUpRight,
  Crown,
  RefreshCw,
  Zap,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface ServiceStats {
  id: string
  name: string
  icon: string
  proUsers: number
  revenue: number
  growth: number
}

interface BillingData {
  monthlyRevenue: number
  mrr: number
  premiumUsers: number
  enterpriseUsers: number
  totalUsers: number
  freeUsers: number
  conversionRate: number
  services: ServiceStats[]
}

export default function BillingPage() {
  const router = useRouter()
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState<BillingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchData = async (showToast = false) => {
    try {
      setIsRefreshing(true)
      const response = await fetch('/api/admin/stats', {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('データの取得に失敗しました')
      }

      const result = await response.json()
      setData(result)
      
      if (showToast) {
        toast.success('データを更新しました', { icon: '🔄' })
      }
    } catch (error) {
      console.error('Billing fetch error:', error)
      toast.error('データの取得に失敗しました')
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatCurrency = (value: number) => {
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(1)}万`
    }
    return `¥${value.toLocaleString()}`
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-violet-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  const revenueStats = [
    { label: '今月の売上', value: formatCurrency(data.monthlyRevenue), change: '+0%', up: true, icon: DollarSign },
    { label: 'MRR', value: formatCurrency(data.mrr), change: '実績', up: true, icon: TrendingUp },
    { label: 'プロ会員', value: `${data.premiumUsers}人`, change: `CVR ${data.conversionRate}%`, up: true, icon: Crown },
    { label: 'Stripe連携', value: `${data.enterpriseUsers}人`, change: '実績', up: true, icon: Zap },
  ]

  const planDistribution = [
    { plan: 'Free', count: data.freeUsers, percentage: data.totalUsers > 0 ? (data.freeUsers / data.totalUsers) * 100 : 0, color: 'bg-gray-500' },
    { plan: 'Pro', count: data.premiumUsers, percentage: data.totalUsers > 0 ? (data.premiumUsers / data.totalUsers) * 100 : 0, color: 'bg-amber-500' },
    { plan: 'Stripe連携', count: data.enterpriseUsers, percentage: data.totalUsers > 0 ? (data.enterpriseUsers / data.totalUsers) * 100 : 0, color: 'bg-violet-500' },
  ]

  const arpu = data.premiumUsers > 0 ? Math.round(data.monthlyRevenue / data.premiumUsers) : 0

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
            <h1 className="text-2xl font-bold text-white mb-1">売上・課金管理</h1>
            <p className="text-white/40 text-sm">収益とサブスクリプションの管理（実データ）</p>
          </div>
          <div className="flex gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="month" className="bg-[#0A0A0F]">今月</option>
              <option value="quarter" className="bg-[#0A0A0F]">四半期</option>
              <option value="year" className="bg-[#0A0A0F]">年間</option>
            </select>
            <button className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm text-white flex items-center gap-2 transition-colors">
              <Download className="w-4 h-4" />
              レポート出力
            </button>
            <button 
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg text-sm text-white flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              更新
            </button>
          </div>
        </div>

        {/* 収益統計 */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {revenueStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/[0.02] backdrop-blur rounded-xl p-5 border border-white/5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="flex items-center gap-1 text-sm font-medium text-emerald-400">
                  <ArrowUpRight className="w-4 h-4" />
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-white/40">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* コンプリートパック売上 */}
          <div className="lg:col-span-2 bg-white/[0.02] backdrop-blur rounded-xl border border-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-violet-400" />
                コンプリートパック売上
              </h2>
            </div>
            <div className="p-5">
              {/* コンプリートパック説明 */}
              <div className="p-4 bg-gradient-to-br from-violet-500/10 to-emerald-500/10 rounded-xl border border-violet-500/20 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex -space-x-1">
                    <span className="text-2xl">🎨</span>
                    <span className="text-2xl">✍️</span>
                  </div>
                  <div>
                    <p className="font-medium text-white">コンプリートパック</p>
                    <p className="text-xs text-white/40">ドヤバナーAI ＋ ドヤライティングAI</p>
                  </div>
                </div>
                <p className="text-sm text-white/60">
                  両サービスがセットになったお得なプランです。プラン変更時は両サービスが同時に切り替わります。
                </p>
              </div>

              {/* 料金プラン */}
              <div className="space-y-3 mb-6">
                <div className="p-4 bg-white/5 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                      <span className="text-gray-400 font-bold text-sm">FREE</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">おためしプラン</p>
                      <p className="text-xs text-white/40">バナー9枚/日 + ライティング1件/日</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-white">¥0</p>
                </div>
                <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">プロプラン</p>
                      <p className="text-xs text-white/40">バナー50枚/日 + ライティング5件/日</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-amber-400">¥9,980</p>
                    <p className="text-xs text-white/40">/月</p>
                  </div>
                </div>
                <div className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">エンタープライズ</p>
                      <p className="text-xs text-white/40">バナー500枚/日 + ライティング50件/日</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-rose-400">¥49,980</p>
                    <p className="text-xs text-white/40">/月</p>
                  </div>
                </div>
              </div>

              {/* 月間売上 */}
              <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60">月間売上</span>
                  <span className="text-3xl font-bold text-emerald-400">{formatCurrency(data.monthlyRevenue)}</span>
                </div>
                <div className="text-xs text-white/40 space-y-1">
                  <p>プロ会員 {Math.max(0, data.premiumUsers - data.enterpriseUsers)}人 × ¥9,980</p>
                  <p>エンタープライズ {data.enterpriseUsers}人 × ¥49,980</p>
                </div>
              </div>
            </div>
          </div>

          {/* プラン分布 */}
          <div className="bg-white/[0.02] backdrop-blur rounded-xl p-5 border border-white/5">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-400" />
              プラン分布
            </h2>
            <div className="space-y-4">
              {planDistribution.map((plan) => (
                <div key={plan.plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white">{plan.plan}</span>
                    <span className="text-sm text-white/40">{plan.count}人</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(plan.percentage, 5)}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full ${plan.color} rounded-full`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{formatCurrency(arpu)}</p>
                <p className="text-sm text-white/40">平均顧客単価 (ARPU)</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-400">{data.conversionRate}%</p>
                <p className="text-sm text-white/40">有料転換率 (CVR)</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
