'use client'

import { useEffect, useState, useCallback } from 'react'
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

  const load = useCallback(() => {
    if (!ready) return
    fetch('/api/sfa/tasks', sfaInit(orgSlug))
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => {})
  }, [ready, orgSlug])
  useEffect(() => { load() }, [load])

  // ===== 活動タイムライン（活動ページをタスクに統合） =====
  const [acts, setActs] = useState<SfaActivityRow[]>([])
  const [actType, setActType] = useState<ActivityType>('note')
  const [actSubject, setActSubject] = useState('')
  const [actBusy, setActBusy] = useState(false)

  const loadActs = useCallback(() => {
    if (!ready) return
    fetch('/api/sfa/activities', sfaInit(orgSlug))
      .then((r) => r.json())
      .then((d) => setActs(d.activities || []))
      .catch(() => {})
  }, [ready, orgSlug])
  useEffect(() => { loadActs() }, [loadActs])

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

  const toggle = async (t: Task) => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: x.status === 'done' ? 'open' : 'done' } : x)))
    try {
      const res = await fetch(`/api/sfa/tasks/${t.id}`, sfaInit(orgSlug, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }))
      if (!res.ok) throw new Error()
      load()
    } catch {
      toast.error('更新に失敗しました')
      load()
    }
  }

  const remove = async (t: Task) => {
    setTasks((prev) => prev.filter((x) => x.id !== t.id))
    try {
      await fetch(`/api/sfa/tasks/${t.id}`, sfaInit(orgSlug, { method: 'DELETE' }))
    } catch {
      load()
    }
  }

  // 期日のインライン変更（'' でクリア）
  const changeDue = async (t: Task, value: string) => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, dueDate: value || null } : x)))
    try {
      const res = await fetch(`/api/sfa/tasks/${t.id}`, sfaInit(orgSlug, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: value }),
      }))
      if (!res.ok) throw new Error()
      load()
    } catch {
      toast.error('期日の変更に失敗しました')
      load()
    }
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
        value={toDateInput(t.dueDate)}
        onChange={(e) => changeDue(t, e.target.value)}
        title="締め切り日"
        className={`rounded-lg border px-2 py-1.5 text-xs font-bold flex-shrink-0 w-[8.5rem] ${
          isOverdue(t) ? 'border-red-300 text-red-600 bg-red-50' : 'border-slate-200 text-slate-600'
        }`}
      />
      <button onClick={() => remove(t)} className="text-slate-300 hover:text-red-500 flex-shrink-0">
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
        {open.length === 0 && done.length === 0 && (
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
          {acts.length === 0 && (
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
      </div>
    </div>
  )
}
