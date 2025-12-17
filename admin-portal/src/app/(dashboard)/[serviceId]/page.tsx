'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, Users, TrendingUp, Zap, Crown, RefreshCw,
  Loader2, Clock, CheckCircle, AlertCircle, UserPlus,
  BarChart3, ExternalLink, Settings, Download,
  ChevronRight
} from 'lucide-react'
import { cn, formatNumber, formatRelativeTime } from '@/lib/utils'
import { 
  SERVICES, 
  ServiceStats, 
  RecentActivity,
  fetchServiceStats,
  fetchRecentActivities,
  getService,
} from '@/lib/services'

export default function ServiceDetailPage() {
  const params = useParams()
  const serviceId = params.serviceId as string
  const service = getService(serviceId)
  
  const [stats, setStats] = useState<ServiceStats | null>(null)
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchData = async () => {
    if (!serviceId) return
    
    try {
      const [statsData, activitiesData] = await Promise.all([
        fetchServiceStats(serviceId),
        fetchRecentActivities(serviceId),
      ])
      
      setStats(statsData)
      setActivities(activitiesData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [serviceId])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchData()
  }

  // アクティビティタイプのアイコン
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'generation': return <Zap className="w-4 h-4 text-blue-500" />
      case 'signup': return <UserPlus className="w-4 h-4 text-green-500" />
      case 'upgrade': return <Crown className="w-4 h-4 text-amber-500" />
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  if (!service) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">サービスが見つかりません</h2>
          <Link href="/" className="text-blue-600 hover:underline">
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link 
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            ダッシュボード
          </Link>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center text-3xl",
              service.bgColor
            )}>
              {service.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
              <p className="text-gray-600">{service.description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={service.apiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <ExternalLink className="w-4 h-4" />
            サービスを開く
          </a>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn-secondary"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            更新
          </button>
        </div>
      </div>

      {/* 統計カード */}
      {stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-1">総ユーザー数</p>
            <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalUsers)}</p>
            <p className="text-sm text-gray-400 mt-1">
              アクティブ: {formatNumber(stats.activeUsers)}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                本日
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-1">本日の生成数</p>
            <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.todayGenerations)}</p>
            <p className="text-sm text-gray-400 mt-1">
              累計: {formatNumber(stats.totalGenerations)}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-1">月間収益</p>
            <p className="text-3xl font-bold text-gray-900">¥{formatNumber(stats.revenue)}</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-1">有料ユーザー</p>
            <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.proUsers)}</p>
            <p className="text-sm text-gray-400 mt-1">
              転換率: {((stats.proUsers / stats.totalUsers) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* メイングリッド */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* 最近のアクティビティ */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                最近のアクティビティ
              </h2>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                すべて表示
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {activities.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    activity.type === 'generation' && "bg-blue-100",
                    activity.type === 'signup' && "bg-green-100",
                    activity.type === 'upgrade' && "bg-amber-100",
                    activity.type === 'error' && "bg-red-100",
                  )}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">
                      {activity.message}
                    </p>
                    {activity.userName && (
                      <p className="text-sm text-gray-500">
                        ユーザー: {activity.userName}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-gray-400 whitespace-nowrap">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* サイドバー */}
        <div className="space-y-6">
          {/* クイックアクション */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-400" />
              クイックアクション
            </h3>
            <div className="space-y-2">
              <Link
                href={`/${serviceId}/users`}
                className="w-full btn-secondary justify-start text-sm"
              >
                <Users className="w-4 h-4" />
                ユーザー管理
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Link>
              <Link
                href={`/${serviceId}/analytics`}
                className="w-full btn-secondary justify-start text-sm"
              >
                <BarChart3 className="w-4 h-4" />
                詳細分析
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Link>
              <button className="w-full btn-secondary justify-start text-sm">
                <Download className="w-4 h-4" />
                レポートをエクスポート
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
            </div>
          </div>

          {/* システムステータス */}
          <div className="card bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <p className="font-bold text-emerald-900">システム正常稼働中</p>
                <p className="text-sm text-emerald-700">
                  すべてのサービスが正常に動作しています
                </p>
              </div>
            </div>
          </div>

          {/* サービス情報 */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4">サービス情報</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">API URL</dt>
                <dd className="text-gray-900 font-mono text-xs truncate max-w-[150px]">
                  {service.apiUrl}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">ステータス</dt>
                <dd className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                  稼働中
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

