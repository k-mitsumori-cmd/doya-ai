'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, CLOCK_TYPE_LABELS } from '@/lib/kintai/types'
import { appendKintaiRequestPage, fetchKintaiRequestPage } from '@/lib/kintai/load-requests'

const TABS = [
  { key: 'pending', label: '未承認' },
  { key: 'approved', label: '承認済' },
  { key: 'rejected', label: '却下' },
  { key: 'withdrawn', label: '取下げ・取消' },
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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [moreError, setMoreError] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [allCounts, setAllCounts] = useState<Record<string, number>>({})
  const requestSeq = useRef(0)
  const invalidateRequests = useCallback(() => { requestSeq.current++ }, [])
  const [actionError, setActionError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [tab, setTab] = useState('pending')
  const tabRef = useRef(tab)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [actionFeedback, setActionFeedback] = useState<Record<string, { type: 'approved' | 'rejected'; message: string }>>({})
  useEffect(() => { tabRef.current = tab }, [tab])

  const load = useCallback(() => {
    if (tabRef.current !== tab) return
    const seq = ++requestSeq.current
    setLoading(true)
    setLoadError(false)
    setMoreLoading(false)
    setMoreError(false)
    setNextCursor(null)
    fetchKintaiRequestPage<any>(tab)
      .then((page) => {
        const rows = appendKintaiRequestPage([], page, page.total)
        if (requestSeq.current !== seq) return
        setRequests(rows)
        setNextCursor(page.nextCursor)
        setTotal(page.total)
        setAllCounts(page.counts)
      })
      .catch(() => { if (requestSeq.current === seq) setLoadError(true) })
      .finally(() => { if (requestSeq.current === seq) setLoading(false) })
  }, [tab])

  useEffect(() => {
    load()
    return invalidateRequests
  }, [load, invalidateRequests])

  const loadMore = async () => {
    if (!nextCursor || moreLoading) return
    const seq = requestSeq.current
    setMoreLoading(true)
    setMoreError(false)
    try {
      const page = await fetchKintaiRequestPage<any>(tab, nextCursor)
      const merged = appendKintaiRequestPage(requests, page, total)
      if (requestSeq.current !== seq) return
      setRequests(merged)
      setNextCursor(page.nextCursor)
    } catch {
      if (requestSeq.current === seq) setMoreError(true)
    } finally {
      if (requestSeq.current === seq) setMoreLoading(false)
    }
  }

  const approve = async (id: string) => {
    const request = requests.find(r => r.id === id)
    const message = request?.type === 'leave'
      ? 'この休暇申請を承認しますか？開始日から終了日までの全日が対象です。休日は自動除外されません。勤怠・打刻が登録済みの場合は承認されません。'
      : 'この申請を承認しますか？'
    if (!window.confirm(message)) return
    try {
      setActionError('')
      const response = await fetch(`/api/kintai/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '承認に失敗しました')
      setActionFeedback(prev => ({ ...prev, [id]: { type: 'approved', message: '承認しました' } }))
      setTimeout(() => {
        setActionFeedback(prev => { const n = { ...prev }; delete n[id]; return n })
        load()
      }, 1500)
    } catch (error) { setActionError(error instanceof Error ? error.message : '承認に失敗しました') }
  }

  const reject = async () => {
    if (!rejectingId) return
    const id = rejectingId
    try {
      setActionError('')
      const response = await fetch(`/api/kintai/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', reviewerComment: rejectComment }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '却下に失敗しました')
      setRejectingId(null)
      setRejectComment('')
      setActionFeedback(prev => ({ ...prev, [id]: { type: 'rejected', message: '却下しました' } }))
      setTimeout(() => {
        setActionFeedback(prev => { const n = { ...prev }; delete n[id]; return n })
        load()
      }, 1500)
    } catch (error) { setActionError(error instanceof Error ? error.message : '却下に失敗しました') }
  }

  const cancelLeave = async (id: string) => {
    if (cancellingId) return
    const reason = window.prompt('休暇を取り消す理由を入力してください（必須・2000文字以内）。')
    if (reason === null) return
    if (!reason.trim() || reason.length > 2000) { setActionError('取消理由を1〜2000文字で入力してください。'); return }
    if (!window.confirm('承認済み休暇を取り消しますか？この申請で作成した休暇実績を削除し、申請履歴と取消理由は残します。日程変更は取消後に本人が再申請してください。')) return
    setCancellingId(id)
    setActionError('')
    try {
      const response = await fetch(`/api/kintai/requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn', reviewerComment: reason.trim() }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '取消に失敗しました')
      load()
    } catch (error) { setActionError(error instanceof Error ? error.message : '取消に失敗しました') }
    finally { setCancellingId(null) }
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
      const leaveLabel: Record<string, string> = { paid: '有給休暇', special: '特別休暇', unpaid: '欠勤' }
      return { summary: `${d.startDate || ''} 〜 ${d.endDate || ''} ${leaveLabel[d.leaveType] || '休暇'}`, isDetailed: true }
    }
    if (r.type === 'overtime' && d) {
      return { summary: `${d.date || ''} ${d.hours || ''}時間 残業申請`, isDetailed: true }
    }
    return { summary: r.reason || '-', isDetailed: false }
  }

  const pendingCount = loading || loadError ? 0 : allCounts.pending || 0

  return (
    <>
      {actionError && <p role="alert" className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}

      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <img src="/kintai/characters/thumbsup_%E3%81%84%E3%81%84%E3%81%AD.png" alt="くまさん" width={80} height={80} className="bear-float" />
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
              {!loading && !loadError && allCounts[t.key] > 0 && (
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
            <img src="/kintai/characters/thinking_%E8%80%83%E3%81%88%E4%B8%AD.png" alt="読み込み中..." width={80} height={80} className="bear-spin" />
            <p className="text-sm text-slate-500 font-medium">読み込み中...</p>
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="font-bold text-red-800">承認申請を読み込めませんでした。時間をおいて再試行してください。</p>
            <button onClick={load} className="mt-4 rounded-xl border border-red-300 bg-white px-5 py-2 text-sm font-bold text-red-700 hover:bg-red-100">再試行</button>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 fade-in-up space-y-4">
            {tab === 'pending' ? (
              <>
                <img src="/kintai/characters/success_%E6%88%90%E5%8A%9F.png" alt="" width={120} height={120} className="bear-bounce mx-auto" />
                <p className="text-lg font-bold text-slate-700">すべて承認済みです！</p>
                <p className="text-sm text-slate-400">未承認の申請はありません</p>
              </>
            ) : (
              <>
                <img src="/kintai/characters/thinking_%E8%80%83%E3%81%88%E4%B8%AD.png" alt="" width={80} height={80} className="bear-wiggle mx-auto" />
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
                        src={feedback.type === 'approved' ? '/kintai/characters/thumbsup_%E3%81%84%E3%81%84%E3%81%AD.png' : '/kintai/characters/error_%E6%B3%A3%E3%81%8D.png'}
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
                          <span className="text-xs text-slate-400">{new Date(r.submittedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })} 申請</span>
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

                      {r.status === 'withdrawn' && r.details?.leaveCancellation && (
                        <p className="text-sm text-slate-600">取消理由: {r.details.leaveCancellation.reason}</p>
                      )}
                      {r.status === 'approved' && r.type === 'leave' && (
                        <button disabled={cancellingId !== null} onClick={() => cancelLeave(r.id)} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50">{cancellingId === r.id ? '取消中...' : '休暇の承認を取り消す'}</button>
                      )}
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

        {!loading && !loadError && nextCursor && (
          <div className="text-center space-y-2">
            <p className="text-xs text-slate-500">{requests.length} / {total}件を表示</p>
            {moreError && <p role="alert" className="text-sm text-red-700">続きの読み込みに失敗しました。再試行するか一覧を更新してください。</p>}
            <div className="flex justify-center gap-2">
              <button onClick={loadMore} disabled={moreLoading} className="rounded-xl border border-purple-300 bg-white px-5 py-2 text-sm font-bold text-purple-700 disabled:opacity-50">{moreLoading ? '読み込み中…' : moreError ? '再試行' : 'さらに読み込む'}</button>
              {moreError && <button onClick={load} className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-700">一覧を更新</button>}
            </div>
          </div>
        )}

        {/* Reject modal */}
        {rejectingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setRejectingId(null)}>
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4 fade-in-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <img src="/kintai/characters/error_%E6%B3%A3%E3%81%8D.png" alt="" width={48} height={48} className="bear-wiggle" />
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
