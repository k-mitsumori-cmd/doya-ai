'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { 
  Clock, Download, Search, Filter, Loader2, Image as ImageIcon,
  ChevronLeft, ChevronRight, Eye, Trash2, Calendar, CheckCircle,
  XCircle, AlertCircle, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, formatRelativeTime } from '@/lib/utils'

interface Asset {
  id: string
  variant: string
  url: string
}

interface Job {
  id: string
  status: string
  size: string
  inputData: {
    keyword: string
    categorySlug: string
  }
  templateName?: string
  assets: Asset[]
  createdAt: string
  completedAt?: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ステータスバッジ
function StatusBadge({ status }: { status: string }) {
  const config = {
    completed: { icon: CheckCircle, text: '完了', class: 'badge-success' },
    failed: { icon: XCircle, text: '失敗', class: 'badge-error' },
    processing: { icon: Loader2, text: '処理中', class: 'badge-warning' },
    pending: { icon: Clock, text: '待機中', class: 'badge-warning' },
  }[status] || { icon: AlertCircle, text: '不明', class: 'badge' }

  const Icon = config.icon

  return (
    <span className={cn('flex items-center gap-1', config.class)}>
      <Icon className={cn('w-3 h-3', status === 'processing' && 'animate-spin')} />
      {config.text}
    </span>
  )
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  const fetchHistory = useCallback(async (page = 1) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
      })
      if (statusFilter) {
        params.set('status', statusFilter)
      }

      const response = await fetch(`/api/history?${params}`)
      const data = await response.json()

      if (response.ok) {
        setJobs(data.jobs)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Fetch history error:', error)
      toast.error('履歴の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleDownload = async (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(asset.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `banner-${asset.variant}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('ダウンロードしました', { icon: '📥' })
    } catch (err) {
      toast.error('ダウンロードに失敗しました')
    }
  }

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true
    return job.inputData.keyword.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              生成履歴
            </h1>
            <p className="text-gray-600 mt-1">過去に生成したバナーを確認・ダウンロードできます</p>
          </div>

          <button
            onClick={() => fetchHistory(pagination?.page || 1)}
            className="btn-secondary self-start sm:self-auto"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
        </div>

        {/* 検索・フィルタ */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="キーワードで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-12"
              />
            </div>
            <div className="flex items-center gap-3">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field w-auto"
              >
                <option value="">すべて</option>
                <option value="completed">完了のみ</option>
                <option value="failed">失敗のみ</option>
              </select>
            </div>
          </div>
        </div>

        {/* ローディング */}
        {isLoading ? (
          <div className="text-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
              <ImageIcon className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">履歴がありません</h3>
            <p className="text-gray-600 mb-6">バナーを生成すると、ここに履歴が表示されます</p>
            <Link href="/app" className="btn-primary">
              バナーを生成する
            </Link>
          </div>
        ) : (
          <>
            {/* 履歴グリッド */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredJobs.map((job) => (
                <div 
                  key={job.id} 
                  className="card-hover group"
                  onClick={() => setSelectedJob(job)}
                >
                  {/* サムネイル */}
                  <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden mb-4">
                    {job.assets.length > 0 ? (
                      <div className="grid grid-cols-3 gap-0.5 h-full">
                        {job.assets.slice(0, 3).map((asset) => (
                          <div key={asset.id} className="relative overflow-hidden">
                            <img
                              src={asset.url}
                              alt={`バリエーション ${asset.variant}`}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute top-1 left-1 w-5 h-5 bg-black/50 rounded text-white text-xs flex items-center justify-center font-bold">
                              {asset.variant}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                      </div>
                    )}
                    
                    {/* ホバーオーバーレイ */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* 情報 */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{job.inputData.keyword}</h3>
                      <p className="text-sm text-gray-500">{job.size}</p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>

                  {/* 日時 */}
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatRelativeTime(job.createdAt)}
                    </span>
                    
                    {/* ダウンロードボタン */}
                    {job.status === 'completed' && job.assets.length > 0 && (
                      <div className="flex gap-1">
                        {job.assets.map((asset) => (
                          <button
                            key={asset.id}
                            onClick={(e) => handleDownload(asset, e)}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 flex items-center justify-center transition-colors"
                            title={`${asset.variant}をダウンロード`}
                          >
                            <span className="text-xs font-bold">{asset.variant}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ページネーション */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => fetchHistory(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="btn-ghost disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(page => 
                      page === 1 || 
                      page === pagination.totalPages || 
                      Math.abs(page - pagination.page) <= 1
                    )
                    .map((page, index, arr) => (
                      <div key={page} className="flex items-center">
                        {index > 0 && arr[index - 1] !== page - 1 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => fetchHistory(page)}
                          className={cn(
                            "w-10 h-10 rounded-xl font-medium transition-all",
                            pagination.page === page
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          )}
                        >
                          {page}
                        </button>
                      </div>
                    ))}
                </div>
                
                <button
                  onClick={() => fetchHistory(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="btn-ghost disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* 統計 */}
            <div className="mt-8 text-center text-sm text-gray-400">
              全 {pagination?.total || 0} 件中 {((pagination?.page || 1) - 1) * (pagination?.limit || 12) + 1} - {Math.min((pagination?.page || 1) * (pagination?.limit || 12), pagination?.total || 0)} 件を表示
            </div>
          </>
        )}

        {/* 詳細モーダル（オプション） */}
        {selectedJob && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedJob(null)}
          >
            <div 
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">{selectedJob.inputData.keyword}</h2>
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                {selectedJob.assets.map((asset) => (
                  <div key={asset.id} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                    <img
                      src={asset.url}
                      alt={`バリエーション ${asset.variant}`}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded text-white text-xs font-bold">
                      {asset.variant}
                    </div>
                    <button
                      onClick={(e) => handleDownload(asset, e)}
                      className="absolute bottom-2 right-2 w-8 h-8 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50"
                    >
                      <Download className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
                <span>サイズ: {selectedJob.size}</span>
                <span>{formatRelativeTime(selectedJob.createdAt)}</span>
              </div>

              <div className="flex gap-3">
                <Link 
                  href={`/app/result/${selectedJob.id}`}
                  className="flex-1 btn-primary"
                >
                  詳細を見る
                </Link>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="btn-secondary"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
