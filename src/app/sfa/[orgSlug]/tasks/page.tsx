'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { sfaInit } from '@/lib/sfa/client'

interface Task {
  id: string
  title: string
  status: string
  dueDate: string | null
  createdAt: string
}

const fmtDate = (d: string | null) => {
  if (!d) return null
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
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
        {t.dueDate && (
          <p className={`text-[11px] font-bold ${isOverdue(t) ? 'text-red-500' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined text-[12px] align-middle">event</span> {fmtDate(t.dueDate)}{isOverdue(t) ? '（期限切れ）' : ''}
          </p>
        )}
      </div>
      <button onClick={() => remove(t)} className="text-slate-300 hover:text-red-500 flex-shrink-0">
        <span className="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  )

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">タスク</h1>
        <p className="text-slate-500 font-bold text-sm">やること・期日を管理</p>
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
    </div>
  )
}
