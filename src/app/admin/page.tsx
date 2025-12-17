'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  FileText,
  Activity,
  TrendingUp,
  Crown,
  Settings,
  RefreshCw,
  Zap,
  Target,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Shield,
  Database,
  Server,
  Image,
  ExternalLink,
  ArrowUpRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { SERVICES } from '@/lib/services'

interface ServiceStats {
  id: string
  name: string
  icon: string
  gradient: string
  users: number
  proUsers: number
  generations: number
  todayGenerations: number
  revenue: number
  growth: number
}

interface Stats {
  totalUsers: number
  totalRevenue: number
  totalGenerations: number
  services: ServiceStats[]
  recentActivities: Array<{
    id: string
    service: string
    userName: string
    action: string
    createdAt: string
  }>
  lastUpdated: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [adminUser, setAdminUser] = useState<{ name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async (showToast = false) => {
    try {
      setIsRefreshing(true)
      
      // モックデータ（実際のAPIに置き換え）
      const mockStats: Stats = {
        totalUsers: 1247,
        totalRevenue: 498000,
        totalGenerations: 8934,
        services: [
          {
            id: 'kantan',
            name: 'カンタンドヤAI',
            icon: '📝',
            gradient: 'from-blue-500 to-cyan-500',
            users: 892,
            proUsers: 45,
            generations: 6234,
            todayGenerations: 342,
            revenue: 134100,
            growth: 12.5,
          },
          {
            id: 'banner',
            name: 'ドヤバナーAI',
            icon: '🎨',
            gradient: 'from-purple-500 to-pink-500',
            users: 355,
            proUsers: 38,
            generations: 2700,
            todayGenerations: 89,
            revenue: 379240,
            growth: 28.3,
          },
        ],
        recentActivities: [
          { id: '1', service: 'kantan', userName: '田中太郎', action: 'ビジネスメールを生成', createdAt: new Date().toISOString() },
          { id: '2', service: 'banner', userName: '佐藤花子', action: 'ECバナーを生成', createdAt: new Date(Date.now() - 300000).toISOString() },
          { id: '3', service: 'kantan', userName: '鈴木一郎', action: 'ブログ記事を生成', createdAt: new Date(Date.now() - 600000).toISOString() },
          { id: '4', service: 'banner', userName: '高橋美咲', action: '採用バナーを生成', createdAt: new Date(Date.now() - 900000).toISOString() },
          { id: '5', service: 'kantan', userName: '渡辺健太', action: 'SNS投稿を生成', createdAt: new Date(Date.now() - 1200000).toISOString() },
        ],
        lastUpdated: new Date().toISOString(),
      }
      
      setStats(mockStats)
      setError(null)
      if (showToast) {
        toast.success('データを更新しました')
      }
    } catch (err) {
      console.error('Stats load error:', err)
      setError('統計データの取得中にエラーが発生しました')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/admin/auth/session', {
          credentials: 'include',
          cache: 'no-store',
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated && data.adminUser) {
            setAdminUser({ name: data.adminUser.name || data.adminUser.username })
          } else {
            router.push('/admin/login')
            return
          }
        } else {
          router.push('/admin/login')
          return
        }
      } catch (error) {
        console.error('Session check error:', error)
        router.push('/admin/login')
        return
      }

      await fetchStats()
      setIsLoading(false)
    }

    checkSession()
  }, [router])

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      toast.success('ログアウトしました')
    } catch (error) {
      console.error('Logout error:', error)
    }
    router.push('/admin/login')
  }

  const formatCurrency = (value: number) => {
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(1)}万`
    }
    return `¥${value.toLocaleString()}`
  }

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-400">ダッシュボードを読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* トップバー */}
      <header className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">ドヤAI 統合管理</h1>
                <p className="text-xs text-gray-400">
                  ようこそ、{adminUser?.name || '管理者'}さん
                </p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => fetchStats(true)}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* エラー表示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {stats && (
          <>
            {/* 全体統計 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-5 border border-gray-700/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-white mb-1">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-xs text-gray-400">総ユーザー数（全サービス）</p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-5 border border-gray-700/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-3">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {stats.services.reduce((sum, s) => sum + s.proUsers, 0)}
                </p>
                <p className="text-xs text-gray-400">プロプラン会員</p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-5 border border-gray-700/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-white mb-1">{stats.totalGenerations.toLocaleString()}</p>
                <p className="text-xs text-gray-400">総生成数</p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-5 border border-gray-700/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-3">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-white mb-1">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs text-gray-400">月間売上（合計）</p>
              </div>
            </div>

            {/* サービス別統計 */}
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              サービス別統計
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {stats.services.map((service) => (
                <div
                  key={service.id}
                  className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden"
                >
                  {/* サービスヘッダー */}
                  <div className={`p-5 bg-gradient-to-br ${service.gradient}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{service.icon}</span>
                        <div>
                          <h3 className="text-xl font-bold text-white">{service.name}</h3>
                          <p className="text-white/80 text-sm">
                            今日の生成: {service.todayGenerations}件
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/${service.id}`}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-5 h-5 text-white" />
                      </Link>
                    </div>
                  </div>

                  {/* サービス統計 */}
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-2xl font-bold text-white">{service.users.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">ユーザー数</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-400">{service.proUsers}</p>
                        <p className="text-xs text-gray-400">プロユーザー</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{service.generations.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">総生成数</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-400">{formatCurrency(service.revenue)}</p>
                        <p className="text-xs text-gray-400">月間売上</p>
                      </div>
                    </div>

                    {/* 成長率 */}
                    <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl">
                      <span className="text-sm text-gray-400">前月比成長率</span>
                      <div className="flex items-center gap-1 text-green-400">
                        <ArrowUpRight className="w-4 h-4" />
                        <span className="font-bold">+{service.growth}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 最近のアクティビティ & クイックアクション */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* 最近のアクティビティ */}
              <div className="lg:col-span-2 bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
                <h2 className="font-bold flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-green-400" />
                  最近のアクティビティ
                </h2>
                <div className="space-y-3">
                  {stats.recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-700/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          activity.service === 'kantan' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {activity.service === 'kantan' ? <FileText className="w-4 h-4" /> : <Image className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{activity.userName}</p>
                          <p className="text-xs text-gray-400">{activity.action}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(activity.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* クイックアクション */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
                <h2 className="font-bold flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-amber-400" />
                  クイックアクション
                </h2>
                <div className="space-y-3">
                  {[
                    { label: 'ユーザー管理', icon: Users, href: '/admin/users', color: 'bg-blue-500' },
                    { label: 'テンプレート管理', icon: FileText, href: '/admin/templates', color: 'bg-green-500' },
                    { label: '課金管理', icon: DollarSign, href: '/admin/billing', color: 'bg-purple-500' },
                    { label: '設定', icon: Settings, href: '/admin/settings', color: 'bg-gray-500' },
                  ].map((action, index) => (
                    <Link key={index} href={action.href}>
                      <div className="flex items-center gap-3 p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl transition-colors cursor-pointer">
                        <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center`}>
                          <action.icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium">{action.label}</span>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* ポータルへのリンク */}
                <div className="mt-6 pt-4 border-t border-gray-700/50">
                  <Link href="/">
                    <div className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-500/30 rounded-xl transition-colors cursor-pointer">
                      <Sparkles className="w-5 h-5 text-blue-400" />
                      <span className="font-medium text-blue-400">ドヤAIポータルを開く</span>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
