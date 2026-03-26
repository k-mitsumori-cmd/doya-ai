'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Search,
  Mail,
  MailOpen,
  MousePointerClick,
  AlertTriangle,
  X,
  Clock,
  ChevronRight,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface DripUser {
  id: string
  name: string | null
  email: string | null
  plan: string
  status: string
  lastLogin: string | null
  enrollmentsCount: number
}

interface TimelineEntry {
  id: string
  sequenceName: string
  stepLabel: string
  sentAt: string
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
  subject: string
}

const STATUS_TABS = [
  { value: 'all', label: '全て' },
  { value: 'active', label: 'アクティブ' },
  { value: 'dormant', label: '休眠' },
]

const LOG_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  sent: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '送信済' },
  delivered: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '配信済' },
  opened: { bg: 'bg-violet-500/20', text: 'text-violet-400', label: '開封済' },
  clicked: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'クリック済' },
  bounced: { bg: 'bg-rose-500/20', text: 'text-rose-400', label: 'バウンス' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: '失敗' },
}

export default function DripUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<DripUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/drip/users', {
        credentials: 'include',
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error()
      }
      const data = await res.json()
      setUsers(data.users ?? data ?? [])
    } catch {
      toast.error('ユーザーの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const fetchTimeline = async (userId: string) => {
    setSelectedUserId(userId)
    setIsLoadingTimeline(true)
    try {
      const res = await fetch(`/api/admin/drip/logs?userId=${userId}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTimeline(data.logs ?? data ?? [])
    } catch {
      toast.error('タイムラインの取得に失敗しました')
    } finally {
      setIsLoadingTimeline(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    if (filter === 'active' && u.status !== 'active') return false
    if (filter === 'dormant' && u.status !== 'dormant') return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (u.name?.toLowerCase().includes(q) ?? false) ||
        (u.email?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-violet-400" />
          ドリップ ユーザー管理
        </h1>
        <p className="text-white/50 text-sm mt-1">
          ドリップメールに登録されたユーザーの配信状況
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* User List */}
        <div className={`flex-1 ${selectedUserId ? 'lg:max-w-[60%]' : ''}`}>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex bg-white/5 rounded-lg p-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    filter === tab.value
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="名前・メールで検索..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1fr_80px_80px_100px_40px] gap-2 px-4 py-3 border-b border-white/5 text-xs text-white/40 font-medium">
                <span>名前</span>
                <span>メール</span>
                <span>プラン</span>
                <span>ステータス</span>
                <span>最終ログイン</span>
                <span></span>
              </div>

              {/* Table body */}
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">
                  該当するユーザーがいません
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => fetchTimeline(user.id)}
                    className={`grid grid-cols-[1fr_1fr_80px_80px_100px_40px] gap-2 px-4 py-3 border-b border-white/5 text-sm cursor-pointer transition-colors ${
                      selectedUserId === user.id
                        ? 'bg-violet-500/10'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <span className="truncate">{user.name ?? '(未設定)'}</span>
                    <span className="truncate text-white/50">{user.email ?? '-'}</span>
                    <span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          user.plan === 'PRO'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {user.plan}
                      </span>
                    </span>
                    <span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          user.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/10 text-white/40'
                        }`}
                      >
                        {user.status === 'active' ? 'アクティブ' : '休眠'}
                      </span>
                    </span>
                    <span className="text-xs text-white/30">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString('ja-JP')
                        : '-'}
                    </span>
                    <span>
                      <ChevronRight className="w-4 h-4 text-white/20" />
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Side Panel - Timeline */}
        <AnimatePresence>
          {selectedUserId && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:w-[40%] bg-white/[0.02] border border-white/10 rounded-2xl p-5 self-start sticky top-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-violet-400" />
                  配信タイムライン
                </h3>
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>

              {isLoadingTimeline ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">
                  配信履歴がありません
                </div>
              ) : (
                <div className="space-y-0 relative">
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-white/5" />
                  {timeline.map((entry, i) => {
                    const style =
                      LOG_STATUS_STYLES[entry.status] ?? LOG_STATUS_STYLES.sent
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="relative pl-8 py-3"
                      >
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-1.5 top-4 w-3 h-3 rounded-full border-2 ${
                            entry.status === 'opened' || entry.status === 'clicked'
                              ? 'bg-violet-500 border-violet-400'
                              : entry.status === 'bounced' || entry.status === 'failed'
                              ? 'bg-rose-500 border-rose-400'
                              : 'bg-white/20 border-white/30'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-white/30">
                              {new Date(entry.sentAt).toLocaleString('ja-JP')}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}
                            >
                              {style.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium truncate">{entry.subject}</p>
                          <p className="text-xs text-white/30 mt-0.5">
                            {entry.sequenceName} / {entry.stepLabel}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
