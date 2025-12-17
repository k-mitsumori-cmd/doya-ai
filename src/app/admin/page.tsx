'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Users,
  FileText,
  Activity,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Crown,
  BarChart3,
  Calendar,
  Settings,
  Bell,
  Download,
  RefreshCw,
  Zap,
  Target,
  MessageSquare,
  Mail,
  Phone,
  Briefcase,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Shield,
  Database,
  Server,
  Megaphone,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Stats {
  totalUsers: number
  premiumUsers: number
  enterpriseUsers: number
  freeUsers: number
  totalGenerations: number
  todayGenerations: number
  monthGenerations: number
  lastMonthGenerations: number
  generationGrowth: number
  avgGenerationsPerUser: number
  monthlyRevenue: number
  mrr: number
  churnRate: number
  avgSessionTime: number
  conversionRate: number
  activeTemplates: number
  recentUsers: number
  recentGenerations: Array<{
    id: string
    userName: string
    templateName: string
    createdAt: string
  }>
  adminLoginAttempts: number
  lastUpdated: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [adminUser, setAdminUser] = useState<{ name: string; username: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async (showToast = false) => {
    try {
      setIsRefreshing(true)
      const statsResponse = await fetch('/api/admin/stats', {
        credentials: 'include',
        cache: 'no-store',
      })
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
        setError(null)
        if (showToast) {
          toast.success('データを更新しました')
        }
      } else {
        const errorData = await statsResponse.json()
        setError(errorData.error || '統計データの取得に失敗しました')
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
            setAdminUser({
              name: data.adminUser.name || data.adminUser.username,
              username: data.adminUser.username,
            })
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

      // 統計データをロード
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
    router.refresh()
  }

  const handleRefresh = () => {
    fetchStats(true)
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

  const quickActions = [
    { label: 'ユーザー管理', icon: Users, href: '/admin/users', color: 'bg-blue-500', description: 'ユーザー一覧・編集' },
    { label: 'テンプレート管理', icon: FileText, href: '/admin/templates', color: 'bg-green-500', description: 'テンプレート編集' },
    { label: 'バナー管理', icon: Megaphone, href: '/admin/banners', color: 'bg-purple-500', description: 'プロモバナー設定' },
    { label: '設定', icon: Settings, href: '/admin/settings', color: 'bg-gray-500', description: 'システム設定' },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4" />
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
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg">DOYA-AI 管理画面</h1>
              <p className="text-xs text-gray-400 hidden sm:block">
                ようこそ、{adminUser?.name || '管理者'}さん
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="データを更新"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="px-3 sm:px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* エラー表示 */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">{error}</p>
              <p className="text-sm text-red-300 mt-1">
                データベース接続を確認してください。
              </p>
            </div>
          </motion.div>
        )}

        {/* 統計カード */}
        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              {/* 総ユーザー数 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-gray-700/50"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white mb-1">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mb-2">総ユーザー数</p>
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <ArrowUpRight className="w-3 h-3" />
                  +{stats.recentUsers} (7日間)
                </div>
              </motion.div>

              {/* プレミアム会員 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-gray-700/50"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-3">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white mb-1">{stats.premiumUsers.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mb-2">プレミアム会員</p>
                <div className="flex items-center gap-1 text-xs text-blue-400">
                  <Target className="w-3 h-3" />
                  {stats.conversionRate}% 転換率
                </div>
              </motion.div>

              {/* 今日の生成数 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-gray-700/50"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white mb-1">{stats.todayGenerations.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mb-2">今日の生成数</p>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Database className="w-3 h-3" />
                  累計 {stats.totalGenerations.toLocaleString()}
                </div>
              </motion.div>

              {/* 月間売上 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-gray-700/50"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-3">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white mb-1">{formatCurrency(stats.monthlyRevenue)}</p>
                <p className="text-xs text-gray-400 mb-2">月間売上（推定）</p>
                <div className={`flex items-center gap-1 text-xs ${stats.generationGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.generationGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stats.generationGrowth >= 0 ? '+' : ''}{stats.generationGrowth}% 前月比
                </div>
              </motion.div>
            </div>

            {/* クイックアクション */}
            <div className="mb-6 sm:mb-8">
              <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                クイックアクション
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quickActions.map((action, index) => (
                  <Link key={index} href={action.href}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 rounded-xl p-4 cursor-pointer transition-all group"
                    >
                      <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <action.icon className="w-5 h-5 text-white" />
                      </div>
                      <p className="font-medium text-sm mb-1">{action.label}</p>
                      <p className="text-xs text-gray-500">{action.description}</p>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
              {/* 最近のアクティビティ */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-2 bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-gray-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-400" />
                    最近の生成アクティビティ
                  </h2>
                  <span className="text-xs text-gray-500">24時間以内</span>
                </div>
                
                {stats.recentGenerations.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recentGenerations.map((generation, index) => (
                      <div key={generation.id} className="flex items-center justify-between py-3 border-b border-gray-700/50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{generation.userName}</p>
                            <p className="text-xs text-gray-400">
                              テンプレート使用: {generation.templateName}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(generation.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>最近のアクティビティはありません</p>
                  </div>
                )}
              </motion.div>

              {/* システム状態 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-gray-700/50"
              >
                <h2 className="font-bold flex items-center gap-2 mb-4">
                  <Server className="w-5 h-5 text-cyan-400" />
                  システム状態
                </h2>
                <div className="space-y-4">
                  {/* データベース接続 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">データベース</span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      接続中
                    </span>
                  </div>

                  {/* アクティブテンプレート */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">テンプレート</span>
                    </div>
                    <span className="text-sm text-white">{stats.activeTemplates} 件</span>
                  </div>

                  {/* 平均生成数/ユーザー */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">平均生成数/ユーザー</span>
                    </div>
                    <span className="text-sm text-white">{stats.avgGenerationsPerUser}</span>
                  </div>

                  {/* 管理者ログイン試行 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">管理者ログイン試行</span>
                    </div>
                    <span className="text-sm text-white">{stats.adminLoginAttempts} 回/24h</span>
                  </div>

                  {/* 最終更新 */}
                  <div className="pt-4 border-t border-gray-700/50">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>最終更新</span>
                      <span>{formatDate(stats.lastUpdated)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ユーザー内訳 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-gray-700/50"
            >
              <h2 className="font-bold flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-purple-400" />
                ユーザー内訳
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-700/30 rounded-xl">
                  <p className="text-2xl sm:text-3xl font-bold text-gray-400">{stats.freeUsers}</p>
                  <p className="text-xs text-gray-500 mt-1">無料ユーザー</p>
                  <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gray-500" 
                      style={{ width: `${stats.totalUsers > 0 ? (stats.freeUsers / stats.totalUsers * 100) : 0}%` }} 
                    />
                  </div>
                </div>
                <div className="text-center p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <p className="text-2xl sm:text-3xl font-bold text-amber-400">{stats.premiumUsers}</p>
                  <p className="text-xs text-amber-300 mt-1">プレミアム</p>
                  <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500" 
                      style={{ width: `${stats.totalUsers > 0 ? (stats.premiumUsers / stats.totalUsers * 100) : 0}%` }} 
                    />
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <p className="text-2xl sm:text-3xl font-bold text-purple-400">{stats.enterpriseUsers}</p>
                  <p className="text-xs text-purple-300 mt-1">エンタープライズ</p>
                  <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500" 
                      style={{ width: `${stats.totalUsers > 0 ? (stats.enterpriseUsers / stats.totalUsers * 100) : 0}%` }} 
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* データがない場合 */}
        {!stats && !error && (
          <div className="text-center py-16">
            <Database className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-bold text-gray-400 mb-2">データを読み込んでいます</h2>
            <p className="text-gray-500">しばらくお待ちください...</p>
          </div>
        )}
      </div>
    </div>
  )
}
