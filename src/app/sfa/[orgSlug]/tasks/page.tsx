'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { sfaJson, isSfaClientTask, isSfaClientActivity, type SfaClientTask } from '@/lib/sfa/client-response'
import { useSfaClientMutations, useSfaDraftSnapshot } from '@/lib/sfa/use-client-mutations'
import MutationRecovery from '@/components/sfa/MutationRecovery'
import { isJstOverdue, jstDateKey } from '@/lib/sfa/task-date'
import { ACTIVITY_TYPE_LABEL } from '@/lib/sfa/constants'
import type { ActivityType } from '@/lib/sfa/types'

type Task = SfaClientTask

interface SfaActivityRow {
  id: string
  type: string
  subject: string | null
  body: string | null
  occurredAt: string
}

const isOverdue = (t: Task) => t.status !== 'done' && isJstOverdue(t.dueDate)

export default function SfaTasksPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const mutations = useSfaClientMutations(orgSlug, () => { void load(); void loadActs() })
  const ready = mutations.allowed
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadedPage, setLoadedPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const loadSequenceRef = useRef(0)
  const listRequest = useRef<AbortController | null>(null)
  const taskDraft = useSfaDraftSnapshot([title, dueDate])
  useEffect(() => { setBusy(false); setActBusy(false); return () => listRequest.current?.abort() }, [mutations.key])

  const load = useCallback(async (page = 1) => {
    if (!ready || !mutations.active()) return
    listRequest.current?.abort()
    const controller = new AbortController()
    listRequest.current = controller
    const sequence = ++loadSequenceRef.current
    setListLoading(true)
    setListError(null)
    try {
      const data = await sfaJson(`/api/sfa/tasks?page=${page}`, orgSlug, { signal: controller.signal })
      if (!Array.isArray(data.tasks) || !data.tasks.every(isSfaClientTask) || data.page !== page || typeof data.hasMore !== 'boolean') {
        throw new Error( 'タスク一覧を取得できませんでした')
      }
      if (sequence !== loadSequenceRef.current || !mutations.active()) return
      const rows = data.tasks
      setTasks(prev => page === 1 ? rows : [...prev, ...rows.filter((t: Task) => !prev.some(p => p.id === t.id))])
      setLoadedPage(page)
      setHasMore(data.hasMore)
    } catch (error) {
      if (sequence === loadSequenceRef.current && mutations.active()) setListError(error instanceof Error ? error.message : 'タスク一覧を取得できませんでした')
    } finally {
      if (sequence === loadSequenceRef.current && mutations.active()) setListLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, mutations.key])
  useEffect(() => { setTasks([]); setLoadedPage(0); setHasMore(false); load(); return () => { listRequest.current?.abort() } }, [load])

  // ===== 活動タイムライン（活動ページをタスクに統合） =====
  const [acts, setActs] = useState<SfaActivityRow[]>([])
  const [actType, setActType] = useState<ActivityType>('note')
  const [actSubject, setActSubject] = useState('')
  const [actBusy, setActBusy] = useState(false)
  const [actsCursor, setActsCursor] = useState<string | null>(null)
  const [actsTotal, setActsTotal] = useState(0)
  const [actsLoading, setActsLoading] = useState(true)
  const [actsError, setActsError] = useState<string | null>(null)
  const [actsRetryCursor, setActsRetryCursor] = useState<string | null>(null)
  const actsRequest = useRef<AbortController | null>(null)
  const activityDraft = useSfaDraftSnapshot([actType, actSubject])

  const loadActs = useCallback(async (cursor?: string) => {
    if (!ready || !mutations.active()) return
    actsRequest.current?.abort()
    const controller = new AbortController()
    actsRequest.current = controller
    setActsLoading(true)
    setActsError(null)
    try {
      const url = cursor ? `/api/sfa/activities?cursor=${encodeURIComponent(cursor)}` : '/api/sfa/activities'
      const data = await sfaJson(url, orgSlug, { signal: controller.signal })
      if (!Array.isArray(data.activities) || !data.activities.every(isSfaClientActivity) || typeof data.totalCount !== 'number' ||
          !(data.nextCursor === null || typeof data.nextCursor === 'string')) {
        throw new Error( '活動を取得できませんでした')
      }
      if (controller.signal.aborted || !mutations.active()) return
      const rows = data.activities
      setActs((previous) => cursor
        ? [...previous, ...rows.filter((activity: SfaActivityRow) => !previous.some((item) => item.id === activity.id))]
        : rows)
      setActsCursor(data.nextCursor)
      setActsTotal(data.totalCount)
      setActsRetryCursor(null)
    } catch (error) {
      if (!controller.signal.aborted && mutations.active()) {
        setActsError(error instanceof Error ? error.message : '活動を取得できませんでした')
        setActsRetryCursor(cursor || null)
      }
    } finally {
      if (!controller.signal.aborted && mutations.active()) setActsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, mutations.key])
  useEffect(() => { loadActs(); return () => { actsRequest.current?.abort() } }, [loadActs])

  const addActivity = async () => {
    if (!actSubject.trim() || !mutations.active() || mutations.creationBlocked('activity')) return
    const revision = activityDraft.current.revision
    setActBusy(true)
    const row = await mutations.create('activity', 'tasks:activity', { type: actType, subject: actSubject })
    if (!mutations.active()) return
    setActBusy(false)
    if (!row) return
    if (activityDraft.current.revision === revision) setActSubject('')
    toast.success('活動を記録しました')
    void loadActs()
  }

  const fmtActDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const create = async () => {
    if (!title.trim() || !mutations.active() || mutations.creationBlocked('task')) return
    const revision = taskDraft.current.revision
    setBusy(true)
    const row = await mutations.create('task', 'tasks:create', { title, dueDate: dueDate || null })
    if (!mutations.active()) return
    setBusy(false)
    if (!row) return
    if (taskDraft.current.revision === revision) { setTitle(''); setDueDate('') }
    toast.success('タスクを追加しました')
    void load()
  }

  const updateTask = async (t: Task, patch: { status?: string; dueDate?: string }) => {
    const result = await mutations.mutateTask(t, patch)
    if (!result || !mutations.active()) return
    ++loadSequenceRef.current; listRequest.current?.abort()
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...(result.task as Task) } : x))
    void load()
  }

  const toggle = async (t: Task) => {
    await updateTask(t, { status: t.status === 'done' ? 'open' : 'done' })
  }

  const remove = async (t: Task) => {
    const result = await mutations.mutateTask(t, null)
    if (!result || !mutations.active()) return
    ++loadSequenceRef.current; listRequest.current?.abort()
    setTasks(prev => prev.filter(x => x.id !== t.id))
    void load()
  }

  // 期日のインライン変更（'' でクリア）
  const changeDue = async (t: Task, value: string) => {
    await updateTask(t, { dueDate: value })
  }

  // 'YYYY-MM-DD'（<input type="date"> 用、日本時間の暦日）
  const toDateInput = (iso: string | null) => {
    return jstDateKey(iso) || ''
  }

  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  const row = (t: Task) => (
    <div key={t.id} className="bg-white rounded-xl shadow-sm p-3.5 flex items-center gap-3">
      <button
        onClick={() => toggle(t)}
        disabled={mutations.blocked('task:' + t.id)}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          t.status === 'done' ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-green-500'
        }`}
      >
        {t.status === 'done' && <span className="material-symbols-outlined text-[16px]">check</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-black truncate ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {t.dealName && (
            <span className="text-[10px] font-black text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 truncate max-w-[12rem]">
              📈 {t.dealName}
            </span>
          )}
          {t.dueDate && isOverdue(t) && <span className="text-[11px] font-bold text-red-500">期限切れ</span>}
        </div>
      </div>
      <input
        type="date"
        disabled={mutations.blocked('task:' + t.id)}
        value={toDateInput(t.dueDate)}
        onChange={(e) => changeDue(t, e.target.value)}
        title="締め切り日"
        className={`rounded-lg border px-2 py-1.5 text-xs font-bold flex-shrink-0 w-[8.5rem] ${
          isOverdue(t) ? 'border-red-300 text-red-600 bg-red-50' : 'border-slate-200 text-slate-600'
        }`}
      />
      <button onClick={() => remove(t)} disabled={mutations.blocked('task:' + t.id)} aria-busy={mutations.blocked('task:' + t.id)} aria-label="タスクを削除" className="text-slate-300 hover:text-red-500 flex-shrink-0 disabled:opacity-40">
        <span className="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  )

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <MutationRecovery mutations={mutations} />
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">タスク・活動</h1>
        <p className="text-slate-500 font-bold text-sm">やること・期日と、活動の記録をまとめて管理</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && create()}
          placeholder="やることを入力（例: 見積を送る）"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-bold"
        />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 font-bold text-sm" />
        <button onClick={create} disabled={busy || mutations.creationBlocked('task') || !ready} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black disabled:opacity-50 whitespace-nowrap">追加</button>
      </div>

      <div className="space-y-2">
        {open.length === 0 && done.length === 0 && loadedPage > 0 && !listLoading && !listError && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-slate-400 font-bold">タスクがありません。上から追加しましょう。</div>
        )}
        {open.map(row)}
        {done.length > 0 && (
          <>
            <p className="text-xs font-black text-slate-400 pt-4 pb-1">完了（{done.length}）</p>
            {done.map(row)}
          </>
        )}
      </div>

      <div className="mt-4 space-y-2 text-sm">
        {listLoading && <p role="status">タスクを読み込んでいます…</p>}
        {listError && <p role="alert" className="text-red-600">{listError}。表示内容が最新でない可能性があります。</p>}
        {loadedPage > 0 && <p className="text-slate-500">{tasks.length}件を表示中{hasMore ? '（続きがあります）' : ''}</p>}
        <button onClick={() => load()} disabled={listLoading} className="rounded-lg border px-3 py-2 disabled:opacity-50">一覧を再読み込み</button>
        {hasMore && <button onClick={() => load(loadedPage + 1)} disabled={listLoading || !!listError} className="ml-2 rounded-lg border px-3 py-2 disabled:opacity-50">次の200件を表示</button>}
      </div>

      {/* ===== 活動タイムライン（旧・活動ページを統合。タスクと同じ操作感） ===== */}
      <div className="mt-10">
        <h2 className="text-lg font-black text-slate-900 mb-1 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[20px]">history</span>活動タイムライン
        </h2>
        <p className="text-slate-500 font-bold text-xs mb-3">電話・商談・メールなどの記録（商談に紐づく活動は商談カードの詳細からも追加できます）</p>

        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 flex flex-col sm:flex-row gap-2">
          <select value={actType} onChange={(e) => setActType(e.target.value as ActivityType)} className="rounded-xl border border-slate-200 px-3 py-2.5 font-bold text-sm">
            {(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[]).map((k) => (
              <option key={k} value={k}>{ACTIVITY_TYPE_LABEL[k]}</option>
            ))}
          </select>
          <input
            value={actSubject}
            onChange={(e) => setActSubject(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && addActivity()}
            placeholder="活動内容を入力（例: 株式会社サンプルへ初回ヒアリング）"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-bold"
          />
          <button onClick={addActivity} disabled={actBusy || mutations.creationBlocked('activity') || !ready || !actSubject.trim()} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black disabled:opacity-50 whitespace-nowrap">記録</button>
        </div>

        <div className="space-y-2">
          {acts.length === 0 && !actsLoading && !actsError && (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-slate-400 font-bold">活動はまだ記録されていません。</div>
          )}
          {acts.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3">
              <span className="text-[10px] font-black text-white bg-slate-400 rounded px-1.5 py-0.5 flex-shrink-0">
                {ACTIVITY_TYPE_LABEL[a.type as ActivityType] || a.type}
              </span>
              <span className="text-sm font-bold text-slate-700 flex-1 truncate">{a.subject || a.body}</span>
              <span className="text-[11px] font-black text-slate-400 flex-shrink-0">{fmtActDate(a.occurredAt)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {actsLoading && <p role="status">活動を読み込んでいます…</p>}
          {actsError && <p role="alert" className="text-red-600">{actsError}。<button type="button" onClick={() => loadActs(actsRetryCursor || undefined)} className="underline">再試行</button></p>}
          {!actsLoading && !actsError && <p className="text-slate-500">{acts.length} / {actsTotal}件を表示</p>}
          {actsCursor && <button type="button" onClick={() => loadActs(actsCursor)} disabled={actsLoading} className="rounded-lg border px-3 py-2 disabled:opacity-50">次の200件を表示</button>}
        </div>
      </div>
    </div>
  )
}
