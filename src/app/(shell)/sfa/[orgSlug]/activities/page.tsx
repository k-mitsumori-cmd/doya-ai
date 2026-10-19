'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { sfaJson, isSfaClientActivity } from '@/lib/sfa/client-response'
import { useSfaClientMutations, useSfaDraftSnapshot } from '@/lib/sfa/use-client-mutations'
import MutationRecovery from '@/components/sfa/MutationRecovery'
import { ACTIVITY_TYPE_LABEL, ACTIVITY_TYPE_ICON } from '@/lib/sfa/constants'
import type { ActivityType } from '@/lib/sfa/types'

interface Activity {
  id: string
  type: ActivityType
  subject: string | null
  body: string | null
  occurredAt: string
}

const TYPES: ActivityType[] = ['call', 'meeting', 'email', 'note']
const TYPE_COLOR: Record<ActivityType, string> = {
  call: 'bg-sky-100 text-sky-600',
  meeting: 'bg-green-100 text-green-600',
  email: 'bg-violet-100 text-violet-600',
  note: 'bg-amber-100 text-amber-600',
}
const fmtDateTime = (d: string) => {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

export default function SfaActivitiesPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const mutations = useSfaClientMutations(orgSlug, () => { void load() })
  const ready = mutations.allowed
  const [activities, setActivities] = useState<Activity[]>([])
  const [type, setType] = useState<ActivityType>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryCursor, setRetryCursor] = useState<string | null>(null)
  const draft = useSfaDraftSnapshot([type, subject, body])
  useEffect(() => { setBusy(false); setActivities([]); setNextCursor(null); setTotalCount(0) }, [mutations.key])
  const requestRef = useRef<AbortController | null>(null)

  const load = useCallback(async (cursor?: string) => {
    if (!ready || !mutations.active()) return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setLoadError(null)
    try {
      const url = cursor ? `/api/sfa/activities?cursor=${encodeURIComponent(cursor)}` : '/api/sfa/activities'
      const data = await sfaJson(url, orgSlug, { signal: controller.signal })
      if (!Array.isArray(data.activities) || !data.activities.every(isSfaClientActivity) || typeof data.totalCount !== 'number' ||
          !(data.nextCursor === null || typeof data.nextCursor === 'string')) {
        throw new Error( '活動を取得できませんでした')
      }
      if (controller.signal.aborted || !mutations.active()) return
      const rows = data.activities
      setActivities((previous) => cursor
        ? [...previous, ...rows.filter((activity: Activity) => !previous.some((item) => item.id === activity.id))]
        : rows)
      setNextCursor(data.nextCursor)
      setTotalCount(data.totalCount)
      setRetryCursor(null)
    } catch (error) {
      if (!controller.signal.aborted && mutations.active()) {
        setLoadError(error instanceof Error ? error.message : '活動を取得できませんでした')
        setRetryCursor(cursor || null)
      }
    } finally {
      if (!controller.signal.aborted && mutations.active()) setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, mutations.key])
  useEffect(() => { load(); return () => { requestRef.current?.abort() } }, [load])

  const create = async () => {
    if ((!subject.trim() && !body.trim()) || !mutations.active() || mutations.creationBlocked('activity')) return
    const revision = draft.current.revision
    setBusy(true)
    const row = await mutations.create('activity', 'activities:create', { type, subject, body })
    if (!mutations.active()) return
    setBusy(false)
    if (!row) return
    if (draft.current.revision === revision) { setSubject(''); setBody('') }
    toast.success('活動を記録しました')
    void load()
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <MutationRecovery mutations={mutations} />
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">活動タイムライン</h1>
        <p className="text-slate-500 font-bold text-sm">電話・商談・メール・メモを時系列で記録</p>
      </div>

      {/* クイック入力 */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {TYPES.map((t) => (
            <button key={t} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1 transition-colors ${type === t ? 'bg-[#7f19e6] text-white' : 'bg-slate-100 text-slate-500'}`}>
              <span className="material-symbols-outlined text-[14px]">{ACTIVITY_TYPE_ICON[t]}</span>{ACTIVITY_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="件名（例: 定例MTG / 折り返し電話）" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-bold mb-2" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="メモ・要点（任意）" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm" />
        <button onClick={create} disabled={busy || mutations.creationBlocked('activity') || !ready} className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black disabled:opacity-50">{busy ? '記録中…' : '記録する'}</button>
      </div>

      {/* タイムライン */}
      <div className="space-y-2">
        {activities.length === 0 && !loading && !loadError ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-slate-400 font-bold">活動がありません。上から記録しましょう。</div>
        ) : (
          activities.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm p-4 flex items-start gap-3">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[a.type]}`}>
                <span className="material-symbols-outlined text-[20px]">{ACTIVITY_TYPE_ICON[a.type]}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-slate-800 truncate">{a.subject || ACTIVITY_TYPE_LABEL[a.type]}</p>
                  <span className="text-[10px] font-bold text-slate-300 ml-auto whitespace-nowrap">{fmtDateTime(a.occurredAt)}</span>
                </div>
                {a.body && <p className="text-sm font-bold text-slate-500 mt-0.5 whitespace-pre-wrap">{a.body}</p>}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {loading && <p role="status">活動を読み込んでいます…</p>}
        {loadError && <p role="alert" className="text-red-600">{loadError}。<button type="button" onClick={() => load(retryCursor || undefined)} className="underline">再試行</button></p>}
        {!loading && !loadError && <p className="text-slate-500">{activities.length} / {totalCount}件を表示</p>}
        {nextCursor && <button type="button" onClick={() => load(nextCursor)} disabled={loading} className="rounded-lg border px-3 py-2 disabled:opacity-50">次の200件を表示</button>}
      </div>
    </div>
  )
}
