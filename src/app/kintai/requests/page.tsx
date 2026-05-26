'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, CLOCK_TYPE_LABELS } from '@/lib/kintai/types'

const TABS = [
  { key: '', label: 'すべて' },
  { key: 'pending', label: '承認待ち' },
  { key: 'approved', label: '承認済' },
  { key: 'rejected', label: '却下' },
  { key: 'withdrawn', label: '取下げ' },
]

function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function getRequestSummary(r: any): string {
  if (r.type === 'clock_fix' && r.details) {
    const d = r.details as any
    const clockLabel = CLOCK_TYPE_LABELS[d.clockType] || d.clockType || ''
    const date = d.date ? formatDateJa(d.date) : ''
    const time = d.correctedTime || ''
    if (date && clockLabel && time) return `${date} ${clockLabel} → ${time}`
    if (date && clockLabel) return `${date} ${clockLabel}の修正`
  }
  if (r.type === 'leave' && r.details) {
    const d = r.details as any
    if (d.startDate) return `${formatDateJa(d.startDate)}〜`
  }
  return ''
}

function getInitials(name: string): string {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

export default function RequestsPage() {
  const [allRequests, setAllRequests] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('')

  const fetchRequests = (status: string) => {
    setLoading(true)
    const qs = status ? `?status=${status}` : ''
    fetch(`/api/kintai/requests${qs}`)
      .then((r) => r.json())
      .then((d) => {
        const reqs = d.requests || []
        setRequests(reqs)
        if (!status) setAllRequests(reqs)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  // Fetch all once for counts
  useEffect(() => {
    fetch('/api/kintai/requests')
      .then((r) => r.json())
      .then((d) => setAllRequests(d.requests || []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchRequests(tab) }, [tab])

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { '': allRequests.length }
    allRequests.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1
    })
    return counts
  }, [allRequests])

  const withdraw = async (id: string) => {
    if (!window.confirm('この申請を取り下げますか？')) return
    try {
      await fetch(`/api/kintai/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn' }),
      })
      fetchRequests(tab)
      // Refresh counts
      fetch('/api/kintai/requests')
        .then((r) => r.json())
        .then((d) => setAllRequests(d.requests || []))
        .catch(() => {})
    } catch {
      alert('取下げに失敗しました')
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#7f19e6]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#7f19e6] text-xl">description</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">申請一覧</h1>
            <p className="text-xs text-slate-500">打刻修正や休暇の申請を管理</p>
          </div>
        </div>
        <Link
          href="/kintai/requests/new"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#7f19e6] text-white text-sm font-bold rounded-xl hover:bg-[#6a14c2] transition-colors shadow-sm shadow-[#7f19e6]/20"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          新規申請
        </Link>
      </div>

      {/* Tabs with counts */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((t) => {
          const count = tabCounts[t.key] || 0
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t.key ? 'bg-white text-[#7f19e6] shadow-sm' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                  tab === t.key ? 'bg-[#7f19e6]/10 text-[#7f19e6]' : 'bg-slate-200 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        /* Empty state with illustration and CTA */
        <div className="text-center py-16 space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-slate-300">inbox</span>
          </div>
          <div>
            <p className="text-slate-600 font-medium">申請がありません</p>
            <p className="text-sm text-slate-400 mt-1">
              {tab === 'pending' ? '承認待ちの申請はありません' : '表示する申請が見つかりませんでした'}
            </p>
          </div>
          <Link
            href="/kintai/requests/new"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#7f19e6] text-white text-sm font-bold rounded-xl hover:bg-[#6a14c2] transition-colors"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            新規申請を作成
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => {
            const summary = getRequestSummary(r)
            return (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* Type icon as avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    r.type === 'clock_fix' ? 'bg-blue-50 text-blue-600' :
                    r.type === 'leave' ? 'bg-green-50 text-green-600' :
                    r.type === 'overtime' ? 'bg-orange-50 text-orange-600' :
                    'bg-slate-50 text-slate-600'
                  }`}>
                    <span className="material-symbols-outlined text-xl">
                      {r.type === 'clock_fix' ? 'edit_clock' :
                       r.type === 'leave' ? 'event_busy' :
                       r.type === 'overtime' ? 'more_time' :
                       'work_history'}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">
                        {REQUEST_TYPE_LABELS[r.type] || r.type}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>

                    {summary && (
                      <p className="text-xs text-[#7f19e6] mt-1 font-medium">{summary}</p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_today</span>
                        {formatDateJa(r.submittedAt)}
                      </span>
                      {r.reason && (
                        <span className="truncate max-w-[200px]" title={r.reason}>
                          {r.reason}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0">
                    {r.status === 'pending' && (
                      <button
                        onClick={() => withdraw(r.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>undo</span>
                        取下げ
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; icon: string }> = {
    pending: { bg: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: 'hourglass_top' },
    approved: { bg: 'bg-green-50 text-green-700 border-green-200', icon: 'check_circle' },
    rejected: { bg: 'bg-red-50 text-red-700 border-red-200', icon: 'cancel' },
    withdrawn: { bg: 'bg-slate-100 text-slate-500 border-slate-200', icon: 'remove_circle' },
  }
  const c = config[status] || { bg: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'help' }

  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full font-medium border ${c.bg}`}>
      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{c.icon}</span>
      {REQUEST_STATUS_LABELS[status] || status}
    </span>
  )
}
