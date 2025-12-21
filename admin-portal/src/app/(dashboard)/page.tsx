'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Users, TrendingUp, Zap, Crown, ArrowRight, RefreshCw,
  Loader2, Clock, CheckCircle, AlertCircle, UserPlus,
  ArrowUpRight, Sparkles, Wand2
} from 'lucide-react'
import { cn, formatNumber, formatRelativeTime } from '@/lib/utils'
import { 
  SERVICES, 
  ServiceStats, 
  RecentActivity,
  fetchServiceStats,
  fetchRecentActivities,
} from '@/lib/services'

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, ServiceStats>>({})
  const [activities, setActivities] = useState<Record<string, RecentActivity[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchData = async () => {
    try {
      const statsData: Record<string, ServiceStats> = {}
      const activitiesData: Record<string, RecentActivity[]> = {}
      
      for (const service of SERVICES) {
        statsData[service.id] = await fetchServiceStats(service.id)
        activitiesData[service.id] = await fetchRecentActivities(service.id)
      }
      
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
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchData()
  }

  // デモデータをシミュレート（ランダムに数値を変動させる）
  const handleSimulateActivity = () => {
    setStats(prev => {
      const newStats = { ...prev }
      for (const serviceId of Object.keys(newStats)) {
        const randomIncrease = Math.floor(Math.random() * 10) + 1
        newStats[serviceId] = {
          ...newStats[serviceId],
          todayGenerations: newStats[serviceId].todayGenerations + randomIncrease,
          totalUsers: newStats[serviceId].totalUsers + Math.floor(Math.random() * 3),
        }
      }
      return newStats
    })
    
    setActivities(prev => {
      const newActivities = { ...prev }
      const sampleMessages = [
        { type: 'generation', messages: ['バナーを生成', 'メールを生成', '記事を生成', 'キャッチコピーを生成'] },
        { type: 'signup', messages: ['新規ユーザー登録'] },
        { type: 'upgrade', messages: ['プレミアムにアップグレード', 'プロプランにアップグレード'] },
      ]
      const sampleNames = ['田中太郎', '山田花子', '佐藤一郎', '鈴木美咲', '高橋健太', '伊藤誠', '渡辺真理']
      
      for (const serviceId of Object.keys(newActivities)) {
        const typeGroup = sampleMessages[Math.floor(Math.random() * sampleMessages.length)]
        const message = typeGroup.messages[Math.floor(Math.random() * typeGroup.messages.length)]
        const userName = sampleNames[Math.floor(Math.random() * sampleNames.length)]
        
        const newActivity = {
          id: Date.now().toString(),
          type: typeGroup.type as 'generation' | 'signup' | 'upgrade' | 'error',
          message,
          userName,
          timestamp: new Date().toISOString(),
        }
        
        newActivities[serviceId] = [newActivity, ...newActivities[serviceId].slice(0, 4)]
      }
      return newActivities
    })
  }

  // 合計統計
  const totalStats = {
    totalUsers: Object.values(stats).reduce((sum, s) => sum + s.totalUsers, 0),
    todayGenerations: Object.values(stats).reduce((sum, s) => sum + s.todayGenerations, 0),
    revenue: Object.values(stats).reduce((sum, s) => sum + s.revenue, 0),
    proUsers: Object.values(stats).reduce((sum, s) => sum + s.proUsers, 0),
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
          <h1 className="text-2xl font-bold text-gray-900">統合ダッシュボード</h1>
          <p className="text-gray-600">全サービスの状況を一覧で確認</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulateActivity}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all shadow-sm"
          >
            <Wand2 className="w-4 h-4" />
            デモ動作
          </button>
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

      {/* 全体サマリー */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              +12%
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-1">総ユーザー数</p>
          <p className="text-3xl font-bold text-gray-900">{formatNumber(totalStats.totalUsers)}</p>
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
          <p className="text-3xl font-bold text-gray-900">{formatNumber(totalStats.todayGenerations)}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              +8%
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-1">月間収益</p>
          <p className="text-3xl font-bold text-gray-900">¥{formatNumber(totalStats.revenue)}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Crown className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">有料ユーザー</p>
          <p className="text-3xl font-bold text-gray-900">{formatNumber(totalStats.proUsers)}</p>
        </div>
      </div>

      {/* サービス別詳細 */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">サービス別</h2>
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {SERVICES.map((service) => {
          const serviceStats = stats[service.id]
          const serviceActivities = activities[service.id] || []
          
          return (
            <div key={service.id} className="card">
              {/* サービスヘッダー */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                    service.bgColor
                  )}>
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-500">{service.description}</p>
                  </div>
                </div>
                <Link 
                  href={`/${service.id}`}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  詳細
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* 統計グリッド */}
              {serviceStats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(serviceStats.totalUsers)}</p>
                    <p className="text-xs text-gray-500">ユーザー</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(serviceStats.todayGenerations)}</p>
                    <p className="text-xs text-gray-500">本日の生成</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900">{serviceStats.proUsers}</p>
                    <p className="text-xs text-gray-500">有料ユーザー</p>
                  </div>
                </div>
              )}

              {/* 最近のアクティビティ */}
              <div>
                <p className="text-sm font-medium text-gray-500 mb-3">最近のアクティビティ</p>
                <div className="space-y-2">
                  {serviceActivities.slice(0, 4).map((activity) => (
                    <div 
                      key={activity.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">
                          {activity.userName && (
                            <span className="font-medium">{activity.userName}</span>
                          )}
                          {activity.userName && ' - '}
                          {activity.message}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatRelativeTime(activity.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* クイックアクション */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">クイックアクション</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link 
          href="/users"
          className="card hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">ユーザー管理</p>
            <p className="text-sm text-gray-500">全ユーザーを表示</p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-gray-400" />
        </Link>

        <Link 
          href="/revenue"
          className="card hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">収益レポート</p>
            <p className="text-sm text-gray-500">詳細な収益分析</p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-gray-400" />
        </Link>

        <a 
          href={SERVICES[0].apiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="card hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">カンタンドヤAI</p>
            <p className="text-sm text-gray-500">サービスを開く</p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-gray-400" />
        </a>

        <a 
          href={SERVICES[1].apiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="card hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <span className="text-lg">🎨</span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">Bunridge AI</p>
            <p className="text-sm text-gray-500">サービスを開く</p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-gray-400" />
        </a>
      </div>
    </div>
  )
}

