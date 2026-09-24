'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { sfaInit } from '@/lib/sfa/client'
import { ACTIVITY_TYPE_LABEL } from '@/lib/sfa/constants'
import type { ActivityType } from '@/lib/sfa/types'

interface Task {
  id: string
  title: string
  status: string
  dueDate: string | null
  dealId: string | null
  dealName: string | null
  createdAt: string
}

interface SfaActivityRow {
  id: string
  type: string
  subject: string | null
  body: string | null
  occurredAt: string
}

const isOverdue = (t: Task) =>
  t.status !== 'done' && t.dueDate && new Date(t.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)

export default function SfaTasksPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const ready = !!orgSlug
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const pendingRef = useRef(new Set<string>())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [loadedPage, setLoadedPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const loadSequenceRef = useRef(0)

  const load = useCallback(async (page = 1) => {
    if (!ready) return
    const sequence = ++loadSequenceRef.current
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetch(`/api/sfa/tasks?page=${page}`, sfaInit(orgSlug))
      const data = await res.json()
      if (!res.ok || !Array.isArray(data.tasks) || data.page !== page || typeof data.hasMore !== 'boolean') {
        throw new Error(data.error || 'タスク一覧を取得できませんでした')
      }
      if (sequence !== loadSequenceRef.current) return
      setTasks(prev => page === 1 ? data.tasks : [...prev, ...data.tasks.filter((t: Task) => !prev.some(p => p.id === t.id))])
      setLoadedPage(page)
      setHasMore(data.hasMore)
    } catch (error) {
      if (sequence === loadSequenceRef.current) setListError(error instanceof Error ? error.message : 'タスク一覧を取得できませんでした')
    } finally {
      if (sequence === loadSequenceRef.current) setListLoading(false)
    }
  }, [ready, orgSlug])
  useEffect(() => { setTasks([]); setLoadedPage(0); setHasMore(false); load(); return () => { ++loadSequenceRef.current } }, [load])

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

  const loadActs = useCallback(async (cursor?: string) => {
    if (!ready) return
    actsRequest.current?.abort()
    const controller = new AbortController()
    actsRequest.current = controller
    setActsLoading(true)
    setActsError(null)
    try {
      const url = cursor ? `/api/sfa/activities?cursor=${encodeURIComponent(cursor)}` : '/api/sfa/activities'
      const res = await fetch(url, sfaInit(orgSlug, { signal: controller.signal }))
      const data = await res.json()
      if (!res.ok || !Array.isArray(data.activities) || typeof data.totalCount !== 'number' ||
          !(data.nextCursor === null || typeof data.nextCursor === 'string')) {
        throw new Error(data.error || '活動を取得できませんでした')
      }
      if (controller.signal.aborted) return
      setActs((previous) => cursor
        ? [...previous, ...data.activities.filter((activity: SfaActivityRow) => !previous.some((item) => item.id === activity.id))]
        : data.activities)
      setActsCursor(data.nextCursor)
      setActsTotal(data.totalCount)
      setActsRetryCursor(null)
    } catch (error) {
      if (!controller.signal.aborted) {
        setActsError(error instanceof Error ? error.message : '活動を取得できませんでした')
        setActsRetryCursor(cursor || null)
      }
    } finally {
      if (!controller.signal.aborted) setActsLoading(false)
    }
  }, [ready, orgSlug])
  useEffect(() => { loadActs(); return () => { actsRequest.current?.abort() } }, [loadActs])

  const addActivity = async () => {
    if (!actSubject.trim()) return
    setActBusy(true)
    try {
      const res = await fetch('/api/sfa/activities', sfaInit(orgSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: actType, subject: actSubject }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setActSubject('')
      toast.success('活動を記録しました')
      loadActs()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setActBusy(false)
    }
  }

  const fmtActDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const create = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/sfa/tasks', sfaInit(orgSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, dueDate: dueDate || null }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setTitle(''); setDueDate('')
      toast.success('タスクを追加しました')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const updateTask = async (t: Task, patch: { status?: string; dueDate?: string }) => {
    if (pendingRef.current.has(t.id)) return
    pendingRef.current.add(t.id)
    setPendingIds(new Set(pendingRef.current))
    try {
      const res = await fetch(`/api/sfa/tasks/${t.id}`, sfaInit(orgSlug, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      }))
      const result = await res.json().catch(() => null)
      if (!res.ok) throw new Error(result?.error || '更新に失敗しました')
      const updated = result?.task
      if (!updated || updated.id !== t.id || !['open', 'done'].includes(updated.status) ||
          !(updated.dueDate === null || (typeof updated.dueDate === 'string' && Number.isFinite(new Date(updated.dueDate).getTime())))) {
        throw new Error('更新結果を確認できませんでした。再読み込みして状態をご確認ください。')
      }
      setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, ...updated } : x))
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新結果を確認できませんでした。再読み込みして状態をご確認ください。')
    } finally {
      pendingRef.current.delete(t.id)
      setPendingIds(new Set(pendingRef.current))
    }
  }

  const toggle = async (t: Task) => {
    await updateTask(t, { status: t.status === 'done' ? 'open' : 'done' })
  }

  const remove = async (t: Task) => {
    if (pendingRef.current.has(t.id)) return
    pendingRef.current.add(t.id)
    setPendingIds(new Set(pendingRef.current))
    try {
      const res = await fetch(`/api/sfa/tasks/${t.id}`, sfaInit(orgSlug, { method: 'DELETE' }))
      const result = await res.json().catch(() => null)
      if (!res.ok) throw new Error(result?.error || '削除に失敗しました')
      if (result?.ok !== true) throw new Error('削除結果を確認できませんでした。再読み込みして状態をご確認ください。')
      setTasks((prev) => prev.filter((x) => x.id !== t.id))
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '削除結果を確認できませんでした。再読み込みして状態をご確認ください。')
    } finally {
      pendingRef.current.delete(t.id)
      setPendingIds(new Set(pendingRef.current))
    }
  }

  // 期日のインライン変更（'' でクリア）
  const changeDue = async (t: Task, value: string) => {
    await updateTask(t, { dueDate: value })
  }

  // 'YYYY-MM-DD'（<input type="date"> 用、ローカル日付）
  const toDateInput = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  const row = (t: Task) => (
    <div key={t.id} className="bg-white rounded-xl shadow-sm p-3.5 flex items-center gap-3">
      <button
        onClick={() => toggle(t)}
        disabled={pendingIds.has(t.id)}
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
        disabled={pendingIds.has(t.id)}
        value={toDateInput(t.dueDate)}
        onChange={(e) => changeDue(t, e.target.value)}
        title="締め切り日"
        className={`rounded-lg border px-2 py-1.5 text-xs font-bold flex-shrink-0 w-[8.5rem] ${
          isOverdue(t) ? 'border-red-300 text-red-600 bg-red-50' : 'border-slate-200 text-slate-600'
        }`}
      />
      <button onClick={() => remove(t)} disabled={pendingIds.has(t.id)} aria-busy={pendingIds.has(t.id)} aria-label="タスクを削除" className="text-slate-300 hover:text-red-500 flex-shrink-0 disabled:opacity-40">
        <span className="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  )

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">タスク・活動</h1>
        <p className="text-slate-500 font-bold text-sm">やること・期日と、活動の記録をまとめて管理</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="やることを入力（例: 見積を送る）"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-bold"
        />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 font-bold text-sm" />
        <button onClick={create} disabled={busy} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black disabled:opacity-50 whitespace-nowrap">追加</button>
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
            onKeyDown={(e) => e.key === 'Enter' && addActivity()}
            placeholder="活動内容を入力（例: 株式会社サンプルへ初回ヒアリング）"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-bold"
          />
          <button onClick={addActivity} disabled={actBusy || !actSubject.trim()} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black disabled:opacity-50 whitespace-nowrap">記録</button>
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
