'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { sfaInit } from '@/lib/sfa/client'

interface Deal { id: string; amount: number; probability: number; status: string; stageId: string | null; lastActivityAt: string | null }
interface Task { id: string; title: string; status: string; dueDate: string | null }

const STALE_DAYS = 14
const yen = (n: number) => '¥' + Math.round(n || 0).toLocaleString('ja-JP')

export default function SfaDashboard() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const { status } = useSession()
  const ready = status === 'authenticated' && !!orgSlug
  const base = `/sfa/${orgSlug}`
  const [deals, setDeals] = useState<Deal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [busy, setBusy] = useState(false)

  const loadTasks = useCallback(() => {
    if (!ready) return
    fetch('/api/sfa/tasks', sfaInit(orgSlug)).then((r) => r.json()).then((d) => setTasks(d.tasks || [])).catch(() => {})
  }, [ready, orgSlug])

  useEffect(() => {
    if (!ready) return
    fetch('/api/sfa/deals', sfaInit(orgSlug)).then((r) => r.json()).then((d) => setDeals(d.deals || [])).catch(() => {})
    loadTasks()
  }, [ready, orgSlug, loadTasks])

  // 売上集計
  const open = deals.filter((d) => d.status === 'open')
  const openTotal = open.reduce((s, d) => s + d.amount, 0)
  const weighted = open.reduce((s, d) => s + (d.amount * d.probability) / 100, 0)
  const wonTotal = deals.filter((d) => d.status === 'won').reduce((s, d) => s + d.amount, 0)
  const staleCount = open.filter(
    (d) => d.lastActivityAt && Date.now() - new Date(d.lastActivityAt).getTime() > STALE_DAYS * 86400000
  ).length
  const openTasks = tasks.filter((t) => t.status !== 'done')

  // 🐻 クマちゃんのひとことコメント（状況に応じて変化）
  const bearComment = (() => {
    if (deals.length === 0) return 'まずは「商談」を登録してみるクマ！カンバンで案件を見える化できるクマよ🐻'
    if (staleCount > 0) return `${staleCount}件の商談が${STALE_DAYS}日以上動いてないクマ…！フォローのチャンスだクマ🐻`
    if (openTasks.length > 0) return `未完了タスクが${openTasks.length}件あるクマ。下のリストから片付けていくクマ！🐻`
    if (wonTotal > 0) return `受注合計 ${yen(wonTotal)} クマ！この調子で行くクマ〜🎉🐻`
    return `パイプラインは確度加重で ${yen(weighted)} クマ。いい感じだクマ！💪🐻`
  })()

  const addTask = async () => {
    if (!newTask.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/sfa/tasks', sfaInit(orgSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTask }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setNewTask('')
      loadTasks()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleTask = async (t: Task) => {
    const next = t.status === 'done' ? 'open' : 'done'
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)))
    try {
      const res = await fetch(`/api/sfa/tasks/${t.id}`, sfaInit(orgSlug, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      }))
      if (!res.ok) throw new Error()
    } catch {
      loadTasks()
    }
  }

  const fmtDue = (s: string | null) => {
    if (!s) return null
    const d = new Date(s)
    const today = new Date()
    const diff = Math.ceil((d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    if (diff < 0) return { label: `${label}（期限切れ）`, cls: 'text-red-500' }
    if (diff === 0) return { label: `${label}（今日）`, cls: 'text-amber-600' }
    return { label, cls: 'text-slate-400' }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#F0FDF4] to-slate-50">
      <div className="p-6 lg:p-10 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-lime-600 flex items-center justify-center text-2xl shadow-lg shadow-green-500/30">
            📈
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">ダッシュボード</h1>
            <p className="text-slate-500 font-bold text-sm">今日の営業状況をひと目で。</p>
          </div>
        </div>

        {/* 🐻 クマちゃんのひとこと */}
        <div className="flex items-start gap-3 bg-white rounded-2xl shadow-sm p-4 mb-6 border border-green-100">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center text-2xl flex-shrink-0 shadow-inner">
            🐻
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-amber-600 mb-0.5">クマちゃん</p>
            <p className="text-sm font-bold text-slate-700 leading-relaxed">{bearComment}</p>
          </div>
        </div>

        {/* 売上サマリー */}
        <h2 className="font-black text-slate-700 mb-3">売上サマリー</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-bold text-slate-500 mb-1">進行中パイプライン</p>
            <p className="text-2xl font-black text-slate-900 leading-none">{yen(openTotal)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-bold text-slate-500 mb-1">確度加重</p>
            <p className="text-2xl font-black text-green-600 leading-none">{yen(weighted)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-bold text-slate-500 mb-1">受注合計</p>
            <p className="text-2xl font-black text-emerald-600 leading-none">{yen(wonTotal)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-bold text-slate-500 mb-1">進行中の商談</p>
            <p className="text-2xl font-black text-slate-900 leading-none">
              {open.length}
              {staleCount > 0 && <span className="ml-1 text-xs font-black text-red-500 align-middle">停滞{staleCount}</span>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          {/* タスク */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-slate-700">タスク</h2>
              <span className="text-xs font-bold text-slate-400">未完了 {openTasks.length}</span>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="例: A社に見積を送る"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 font-bold text-sm"
              />
              <button onClick={addTask} disabled={busy} className="px-4 py-2 rounded-xl bg-green-600 text-white font-black text-sm disabled:opacity-50">
                追加
              </button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {tasks.length === 0 && <p className="text-sm font-bold text-slate-300 text-center py-6">タスクはありません</p>}
              {tasks.map((t) => {
                const due = fmtDue(t.dueDate)
                const done = t.status === 'done'
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTask(t)}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className={`material-symbols-outlined text-[20px] ${done ? 'text-green-600' : 'text-slate-300'}`}>
                      {done ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className={`flex-1 min-w-0 truncate text-sm font-bold ${done ? 'text-slate-300 line-through' : 'text-slate-700'}`}>
                      {t.title}
                    </span>
                    {due && !done && <span className={`text-[11px] font-black flex-shrink-0 ${due.cls}`}>{due.label}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* クイックアクション */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-black text-slate-700 mb-3">クイックアクション</h2>
            <div className="space-y-2">
              <Link href={`${base}/deals`} className="flex items-center gap-3 rounded-xl hover:bg-slate-50 transition-colors p-3">
                <span className="material-symbols-outlined text-2xl text-green-600">view_kanban</span>
                <div>
                  <p className="font-black text-slate-800 text-sm">商談パイプライン</p>
                  <p className="text-[11px] font-bold text-slate-500">カンバンで案件を管理</p>
                </div>
              </Link>
              <Link href={`${base}/accounts`} className="flex items-center gap-3 rounded-xl hover:bg-slate-50 transition-colors p-3">
                <span className="material-symbols-outlined text-2xl text-emerald-600">business</span>
                <div>
                  <p className="font-black text-slate-800 text-sm">取引先を登録</p>
                  <p className="text-[11px] font-bold text-slate-500">会社を一元管理・CSV出力</p>
                </div>
              </Link>
              <Link href={`${base}/members`} className="flex items-center gap-3 rounded-xl hover:bg-slate-50 transition-colors p-3">
                <span className="material-symbols-outlined text-2xl text-lime-600">group</span>
                <div>
                  <p className="font-black text-slate-800 text-sm">メンバー招待・権限</p>
                  <p className="text-[11px] font-bold text-slate-500">チームで営業管理</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
