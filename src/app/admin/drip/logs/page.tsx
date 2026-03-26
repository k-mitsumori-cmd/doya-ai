'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface LogEntry {
  id: string
  sentAt: string
  userName: string | null
  userEmail: string | null
  sequenceName: string
  stepLabel: string
  subject: string
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
}

interface LogsResponse {
  logs: LogEntry[]
  total: number
  page: number
  limit: number
}

const STATUS_TABS = [
  { value: '', label: '全て' },
  { value: 'sent', label: '送信済' },
  { value: 'opened', label: '開封済' },
  { value: 'clicked', label: 'クリック済' },
  { value: 'bounced', label: 'バウンス' },
]

const STATUS_BADGE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  sent: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '送信済' },
  delivered: { bg: 'bg-teal-500/20', text: 'text-teal-400', label: '配信済' },
  opened: { bg: 'bg-violet-500/20', text: 'text-violet-400', label: '開封済' },
  clicked: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'クリック済' },
  bounced: { bg: 'bg-rose-500/20', text: 'text-rose-400', label: 'バウンス' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: '失敗' },
}

const LIMIT = 20

export default function DripLogsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      })
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/drip/logs?${params}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error()
      }
      const data: LogsResponse = await res.json()
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
    } catch {
      toast.error('ログの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, router])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleStatusChange = (status: string) => {
    setStatusFilter(status)
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-violet-400" />
            配信ログ
          </h1>
          <p className="text-white/50 text-sm mt-1">
            全メール配信の詳細ログ（{total.toLocaleString()}件）
          </p>
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={isLoading}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 text-white/50 ${isLoading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex bg-white/5 rounded-lg p-1 mb-6 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-all ${
              statusFilter === tab.value
                ? 'bg-violet-500/20 text-violet-300'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[140px_1fr_1fr_1fr_100px] gap-2 px-4 py-3 border-b border-white/5 text-xs text-white/40 font-medium">
          <span>日時</span>
          <span>ユーザー</span>
          <span>シーケンス / ステップ</span>
          <span>件名</span>
          <span>ステータス</span>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-sm">
            ログがありません
          </div>
        ) : (
          logs.map((log, i) => {
            const badge = STATUS_BADGE[log.status] ?? STATUS_BADGE.sent
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="grid grid-cols-[140px_1fr_1fr_1fr_100px] gap-2 px-4 py-3 border-b border-white/5 text-sm hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-xs text-white/40">
                  {new Date(log.sentAt).toLocaleString('ja-JP', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="truncate">
                  <span className="text-white/80">
                    {log.userName ?? '(不明)'}
                  </span>
                  <br />
                  <span className="text-xs text-white/30">{log.userEmail}</span>
                </span>
                <span className="truncate text-white/50">
                  {log.sequenceName}
                  <br />
                  <span className="text-xs text-white/30">{log.stepLabel}</span>
                </span>
                <span className="truncate text-white/60">{log.subject}</span>
                <span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                  >
                    {badge.label}
                  </span>
                </span>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-white/50">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
