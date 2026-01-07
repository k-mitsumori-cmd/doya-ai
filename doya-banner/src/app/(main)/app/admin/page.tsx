'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Shield, ArrowLeft, Users, Image as ImageIcon, CreditCard, 
  TrendingUp, Loader2, AlertCircle, RefreshCw, Search,
  ChevronRight, Calendar, CheckCircle, XCircle, Clock,
  BarChart3, Zap, Crown
} from 'lucide-react'
import { cn, formatRelativeTime, formatNumber } from '@/lib/utils'

// ダミー統計データ（実際はAPIから取得）
const MOCK_STATS = {
  totalUsers: 1234,
  proUsers: 89,
  todayGenerations: 456,
  totalGenerations: 12345,
  successRate: 99.8,
  avgGenerationTime: 28,
}

// ダミー最近のジョブ（実際はAPIから取得）
const MOCK_RECENT_JOBS = [
  { id: '1', userId: 'user-1', userName: '田中太郎', status: 'completed', keyword: '格安SIM乗り換え', size: '1080x1080', createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: '2', userId: 'user-2', userName: '山田花子', status: 'completed', keyword: 'ウェビナー集客', size: '1200x628', createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: '3', userId: 'user-3', userName: '佐藤一郎', status: 'failed', keyword: 'セール告知', size: '1080x1920', createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: '4', userId: 'user-4', userName: '鈴木美咲', status: 'completed', keyword: 'エンジニア募集', size: '1080x1080', createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
  { id: '5', userId: 'user-5', userName: '高橋健太', status: 'processing', keyword: '新商品発売', size: '300x250', createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString() },
]

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState(MOCK_STATS)
  const [recentJobs, setRecentJobs] = useState(MOCK_RECENT_JOBS)

  const isAdmin = (session?.user as any)?.role === 'admin'

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || !isAdmin) {
      router.push('/app')
      return
    }

    // 統計データを取得（モック）
    const fetchData = async () => {
      // 実際はAPIから取得
      await new Promise(resolve => setTimeout(resolve, 500))
      setIsLoading(false)
    }

    fetchData()
  }, [session, status, isAdmin, router])

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">アクセス権限がありません</h2>
          <p className="text-gray-600 mb-6">この画面は管理者のみアクセスできます。</p>
          <Link href="/app" className="btn-primary">
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link 
              href="/app" 
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium mb-2"
            >
              <ArrowLeft className="w-5 h-5" />
              ダッシュボード
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              管理画面
            </h1>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
        </div>

        {/* 統計カード */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 総ユーザー数 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <span className="badge-success">+12%</span>
            </div>
            <p className="text-sm text-gray-500 mb-1">総ユーザー数</p>
            <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalUsers)}</p>
          </div>

          {/* プロユーザー */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Crown className="w-6 h-6 text-amber-600" />
              </div>
              <span className="badge-success">+8%</span>
            </div>
            <p className="text-sm text-gray-500 mb-1">プロユーザー</p>
            <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.proUsers)}</p>
          </div>

          {/* 本日の生成数 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="badge-primary">本日</span>
            </div>
            <p className="text-sm text-gray-500 mb-1">本日の生成数</p>
            <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.todayGenerations)}</p>
          </div>

          {/* 成功率 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-1">生成成功率</p>
            <p className="text-3xl font-bold text-gray-900">{stats.successRate}%</p>
          </div>
        </div>

        {/* メイングリッド */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* 最近のジョブ */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  最近の生成ジョブ
                </h2>
                <Link href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  すべて見る
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="space-y-4">
                {recentJobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        job.status === 'completed' && "bg-emerald-100",
                        job.status === 'failed' && "bg-red-100",
                        job.status === 'processing' && "bg-amber-100"
                      )}>
                        {job.status === 'completed' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                        {job.status === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
                        {job.status === 'processing' && <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{job.keyword}</p>
                        <p className="text-sm text-gray-500">
                          {job.userName} • {job.size}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "badge",
                        job.status === 'completed' && "badge-success",
                        job.status === 'failed' && "badge-error",
                        job.status === 'processing' && "badge-warning"
                      )}>
                        {job.status === 'completed' && '完了'}
                        {job.status === 'failed' && '失敗'}
                        {job.status === 'processing' && '処理中'}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRelativeTime(job.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            {/* クイック統計 */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gray-400" />
                パフォーマンス
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">総生成数</span>
                    <span className="font-medium text-gray-900">{formatNumber(stats.totalGenerations)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: '75%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">平均生成時間</span>
                    <span className="font-medium text-gray-900">{stats.avgGenerationTime}秒</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill bg-gradient-to-r from-emerald-500 to-green-500" style={{ width: '60%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">成功率</span>
                    <span className="font-medium text-gray-900">{stats.successRate}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${stats.successRate}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* クイックアクション */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-gray-400" />
                クイックアクション
              </h3>
              <div className="space-y-2">
                <button className="w-full btn-secondary justify-start text-sm">
                  <Users className="w-4 h-4" />
                  ユーザー管理
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </button>
                <button className="w-full btn-secondary justify-start text-sm">
                  <ImageIcon className="w-4 h-4" />
                  テンプレート管理
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </button>
                <button className="w-full btn-secondary justify-start text-sm">
                  <CreditCard className="w-4 h-4" />
                  課金管理
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
                  <p className="text-sm text-emerald-700">すべてのサービスが正常に動作しています</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

