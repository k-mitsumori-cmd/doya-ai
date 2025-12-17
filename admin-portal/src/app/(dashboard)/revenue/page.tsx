'use client'

import { useState, useEffect } from 'react'
import { 
  TrendingUp, Calendar, Download, Loader2, ArrowUpRight, ArrowDownRight,
  DollarSign, Users, Crown, CreditCard, FileText
} from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { SERVICES } from '@/lib/services'

interface MonthlyRevenue {
  month: string
  revenue: number
  previousRevenue: number
  newSubscribers: number
  churned: number
}

interface RevenueByService {
  serviceId: string
  revenue: number
  subscribers: number
  arpu: number
  growth: number
}

// モックデータ
const MOCK_MONTHLY_REVENUE: MonthlyRevenue[] = [
  { month: '2024-01', revenue: 380000, previousRevenue: 350000, newSubscribers: 28, churned: 5 },
  { month: '2024-02', revenue: 420000, previousRevenue: 380000, newSubscribers: 35, churned: 8 },
  { month: '2024-03', revenue: 457200, previousRevenue: 420000, newSubscribers: 42, churned: 6 },
]

const MOCK_REVENUE_BY_SERVICE: RevenueByService[] = [
  { serviceId: 'kantan-doya', revenue: 298000, subscribers: 89, arpu: 3348, growth: 12.5 },
  { serviceId: 'doya-banner', revenue: 159200, subscribers: 42, arpu: 3790, growth: 8.3 },
]

export default function RevenuePage() {
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([])
  const [serviceData, setServiceData] = useState<RevenueByService[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  useEffect(() => {
    setTimeout(() => {
      setMonthlyData(MOCK_MONTHLY_REVENUE)
      setServiceData(MOCK_REVENUE_BY_SERVICE)
      setIsLoading(false)
    }, 500)
  }, [])

  // 合計計算
  const totalRevenue = serviceData.reduce((sum, s) => sum + s.revenue, 0)
  const totalSubscribers = serviceData.reduce((sum, s) => sum + s.subscribers, 0)
  const averageArpu = totalSubscribers > 0 ? totalRevenue / totalSubscribers : 0
  const latestMonth = monthlyData[monthlyData.length - 1]
  const revenueGrowth = latestMonth 
    ? ((latestMonth.revenue - latestMonth.previousRevenue) / latestMonth.previousRevenue * 100)
    : 0

  const getServiceInfo = (serviceId: string) => {
    return SERVICES.find(s => s.id === serviceId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            収益レポート
          </h1>
          <p className="text-gray-600">全サービスの収益状況を分析</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            {(['month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  period === p 
                    ? "bg-blue-600 text-white" 
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {p === 'month' ? '月次' : p === 'quarter' ? '四半期' : '年次'}
              </button>
            ))}
          </div>
          <button className="btn-secondary">
            <Download className="w-4 h-4" />
            エクスポート
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <span className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              revenueGrowth >= 0 
                ? "text-green-700 bg-green-50"
                : "text-red-700 bg-red-50"
            )}>
              {revenueGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(revenueGrowth).toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-1">今月の収益</p>
          <p className="text-3xl font-bold text-gray-900">¥{formatNumber(totalRevenue)}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Crown className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">有料会員数</p>
          <p className="text-3xl font-bold text-gray-900">{formatNumber(totalSubscribers)}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">平均ARPU</p>
          <p className="text-3xl font-bold text-gray-900">¥{formatNumber(Math.round(averageArpu))}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
              +{latestMonth?.newSubscribers || 0}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-1">今月の新規会員</p>
          <p className="text-3xl font-bold text-gray-900">{latestMonth?.newSubscribers || 0}</p>
        </div>
      </div>

      {/* サービス別収益 */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-6">サービス別収益</h2>
          <div className="space-y-4">
            {serviceData.map((data) => {
              const service = getServiceInfo(data.serviceId)
              const percentage = (data.revenue / totalRevenue) * 100
              return (
                <div key={data.serviceId}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{service?.icon}</span>
                      <span className="font-medium text-gray-900">{service?.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">¥{formatNumber(data.revenue)}</p>
                      <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        data.serviceId === 'kantan-doya' 
                          ? "bg-gradient-to-r from-blue-500 to-blue-600" 
                          : "bg-gradient-to-r from-purple-500 to-purple-600"
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 月次推移 */}
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-6">月次推移</h2>
          <div className="space-y-4">
            {monthlyData.map((data) => {
              const growth = ((data.revenue - data.previousRevenue) / data.previousRevenue * 100)
              return (
                <div key={data.month} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{data.month}</p>
                      <p className="text-sm text-gray-500">
                        新規 +{data.newSubscribers} / 解約 -{data.churned}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">¥{formatNumber(data.revenue)}</p>
                    <span className={cn(
                      "text-xs font-medium",
                      growth >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* サービス詳細テーブル */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">サービス詳細</h2>
          <button className="btn-secondary text-sm">
            <FileText className="w-4 h-4" />
            詳細レポート
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">サービス</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">月間収益</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">有料会員</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">ARPU</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">成長率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {serviceData.map((data) => {
                const service = getServiceInfo(data.serviceId)
                return (
                  <tr key={data.serviceId} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center text-lg",
                          service?.bgColor
                        )}>
                          {service?.icon}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{service?.name}</p>
                          <p className="text-sm text-gray-500">{service?.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-bold text-gray-900">¥{formatNumber(data.revenue)}</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-medium text-gray-900">{data.subscribers}人</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-medium text-gray-900">¥{formatNumber(data.arpu)}</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                        data.growth >= 0 
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      )}>
                        {data.growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(data.growth).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

