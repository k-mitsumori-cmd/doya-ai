'use client'

import { useEffect, useState, useCallback } from 'react'
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, CLOCK_TYPE_LABELS } from '@/lib/kintai/types'

const TABS = [
  { key: 'pending', label: '未承認' },
  { key: 'approved', label: '承認済' },
  { key: 'rejected', label: '却下' },
]

function timeAgo(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now.getTime() - then.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'たった今'
  if (diffMin < 60) return `${diffMin}分前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}時間前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD}日前`
  const diffM = Math.floor(diffD / 30)
  return `${diffM}ヶ月前`
}

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [allCounts, setAllCounts] = useState<Record<string, number>>({ pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [actionFeedback, setActionFeedback] = useState<Record<string, { type: 'approved' | 'rejected'; message: string }>>({})

  const fetchRequests = useCallback((status: string) => {
    setLoading(true)
    fetch(`/api/kintai/requests?status=${status}`)
      .then(r => r.json())
      .then(d => {
        setRequests(d.requests || [])
        setAllCounts(prev => ({ ...prev, [status]: (d.requests || []).length }))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    TABS.forEach(t => {
      fetch(`/api/kintai/requests?status=${t.key}`)
        .then(r => r.json())
        .then(d => setAllCounts(prev => ({ ...prev, [t.key]: (d.requests || []).length })))
        .catch(console.error)
    })
  }, [])

  useEffect(() => { fetchRequests(tab) }, [tab, fetchRequests])

  const approve = async (id: string) => {
    if (!window.confirm('この申請を承認しますか？')) return
    try {
      await fetch(`/api/kintai/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      setActionFeedback(prev => ({ ...prev, [id]: { type: 'approved', message: '承認しました' } }))
      setTimeout(() => {
        setActionFeedback(prev => { const n = { ...prev }; delete n[id]; return n })
        fetchRequests(tab)
        setAllCounts(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1), approved: prev.approved + 1 }))
      }, 1500)
    } catch { alert('承認に失敗しました') }
  }

  const reject = async () => {
    if (!rejectingId) return
    const id = rejectingId
    try {
      await fetch(`/api/kintai/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', reviewerComment: rejectComment }),
      })
      setRejectingId(null)
      setRejectComment('')
      setActionFeedback(prev => ({ ...prev, [id]: { type: 'rejected', message: '却下しました' } }))
      setTimeout(() => {
        setActionFeedback(prev => { const n = { ...prev }; delete n[id]; return n })
        fetchRequests(tab)
        setAllCounts(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1), rejected: prev.rejected + 1 }))
      }, 1500)
    } catch { alert('却下に失敗しました') }
  }

  const formatDetails = (r: any) => {
    const d = r.details as any
    if (r.type === 'clock_fix' && d) {
      const dateStr = d.date || ''
      const clockLabel = CLOCK_TYPE_LABELS[d.clockType] || d.clockType || ''
      const time = d.correctedTime || ''
      return { summary: `${dateStr} ${clockLabel}を ${time} に修正`, isDetailed: true }
    }
    if (r.type === 'leave' && d) {
      return { summary: `${d.startDate || ''} 〜 ${d.endDate || ''} ${d.leaveType || '休暇'}`, isDetailed: true }
    }
    if (r.type === 'overtime' && d) {
      return { summary: `${d.date || ''} ${d.hours || ''}時間 残業申請`, isDetailed: true }
    }
    return { summary: r.reason || '-', isDetailed: false }
  }

  const pendingCount = allCounts.pending || 0

  return (
    <>
      <style jsx>{`
        @keyframes bearFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes bearBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes bearWiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes bearSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes feedbackPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .bear-float { animation: bearFloat 3s ease-in-out infinite; }
        .bear-bounce { animation: bearBounce 2s ease-in-out infinite; }
        .bear-wiggle { animation: bearWiggle 2s ease-in-out infinite; }
        .bear-spin { animation: bearSpin 2s linear infinite; }
        .fade-in-up { animation: fadeInUp 0.4s ease-out both; }
        .feedback-pulse { animation: feedbackPulse 0.5s ease-in-out; }
      `}</style>

      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <img src="/kintai/characters/thumbsup_いいね.png" alt="くまさん" width={80} height={80} className="bear-float" />
            <div>
              <h1 className="text-xl font-bold text-slate-800">承認管理</h1>
              <p className="text-xs text-slate-500">申請の承認・却下を管理</p>
            </div>
          </div>
          {tab === 'pending' && pendingCount > 1 && (
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-sm font-bold rounded-lg border border-green-200 cursor-not-allowed opacity-70" disabled>
                <span className="material-symbols-outlined text-base">done_all</span>一括承認
              </button>
              <div className="absolute bottom-full right-0 mb-1 px-2.5 py-1 bg-slate-700 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                準備中
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 max-w-md">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${tab === t.key ? 'bg-white text-[#7f19e6] shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
              {t.label}
              {allCounts[t.key] > 0 && (
                <span className={`text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full font-bold ${
                  t.key === 'pending' && tab !== t.key ? 'bg-red-500 text-white' :
                  tab === t.key ? 'bg-[#7f19e6]/10 text-[#7f19e6]' : 'bg-slate-200 text-slate-600'
                }`}>
                  {allCounts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <img src="/kintai/characters/thinking_考え中.png" alt="読み込み中..." width={80} height={80} className="bear-spin" />
            <p className="text-sm text-slate-500 font-medium">読み込み中...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 fade-in-up space-y-4">
            {tab === 'pending' ? (
              <>
                <img src="/kintai/characters/success_成功.png" alt="" width={120} height={120} className="bear-bounce mx-auto" />
                <p className="text-lg font-bold text-slate-700">すべて承認済みです！</p>
                <p className="text-sm text-slate-400">未承認の申請はありません</p>
              </>
            ) : (
              <>
                <img src="/kintai/characters/thinking_考え中.png" alt="" width={80} height={80} className="bear-wiggle mx-auto" />
                <p className="text-slate-500 font-medium">該当する申請はありません</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r: any) => {
              const details = formatDetails(r)
              const feedback = actionFeedback[r.id]

              return (
                <div key={r.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                  feedback?.type === 'approved' ? 'border-green-300 bg-green-50/50' :
                  feedback?.type === 'rejected' ? 'border-red-300 bg-red-50/50' :
                  'border-slate-200'
                }`}>
                  {/* Feedback overlay with bear */}
                  {feedback && (
                    <div className={`px-4 py-2 text-sm font-bold flex items-center gap-2 feedback-pulse ${
                      feedback.type === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      <img
                        src={feedback.type === 'approved' ? '/kintai/characters/thumbsup_いいね.png' : '/kintai/characters/error_泣き.png'}
                        alt=""
                        width={28}
                        height={28}
                      />
                      {feedback.message}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-slate-800">{r.employee?.name || '-'}</span>
                          {r.employee?.department?.name && (
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{r.employee.department.name}</span>
                          )}
                          <span className="text-xs text-slate-400">{timeAgo(r.submittedAt)}</span>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            r.type === 'clock_fix' ? 'bg-blue-100 text-blue-700' :
                            r.type === 'leave' ? 'bg-green-100 text-green-700' :
                            r.type === 'overtime' ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {REQUEST_TYPE_LABELS[r.type] || r.type}
                          </span>
                          <span className="text-xs text-slate-400">{new Date(r.submittedAt).toLocaleDateString('ja-JP')} 申請</span>
                        </div>

                        <div className={`text-sm rounded-lg px-3 py-2 ${details.isDetailed ? 'bg-slate-50 border border-slate-100' : ''}`}>
                          <p className="text-slate-700">{details.summary}</p>
                        </div>

                        {r.reason && (
                          <div className="mt-2 text-sm text-slate-500 flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-sm mt-0.5 text-slate-400">notes</span>
                            <span>理由: {r.reason}</span>
                          </div>
                        )}

                        {r.reviewerComment && (
                          <div className="mt-2 text-sm text-slate-500 flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-sm mt-0.5 text-slate-400">comment</span>
                            <span>コメント: {r.reviewerComment}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {tab === 'pending' && !feedback && (
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => approve(r.id)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">check</span>
                            承認する
                          </button>
                          <button
                            onClick={() => { setRejectingId(r.id); setRejectComment('') }}
                            className="flex items-center gap-1.5 px-4 py-2 border-2 border-red-300 text-red-600 text-sm font-bold rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                            却下する
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Reject modal */}
        {rejectingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRejectingId(null)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4 fade-in-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <img src="/kintai/characters/error_泣き.png" alt="" width={48} height={48} className="bear-wiggle" />
                <h2 className="text-lg font-bold text-slate-800">申請を却下</h2>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">コメント（任意）</label>
                <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-[#7f19e6] resize-none"
                  placeholder="却下理由を入力..." />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRejectingId(null)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50">キャンセル</button>
                <button onClick={reject} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors">
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-base">close</span>
                    却下する
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
