'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface SessionRow {
  id: string
  mode: string
  title: string
  status: string
  durationSec: number
  createdAt: string
  _count: { answers: number }
}

export default function CunningHistoryPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    fetch('/api/cunning/sessions', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const remove = async (id: string) => {
    if (!confirm('このセッションを削除しますか？')) return
    const res = await fetch(`/api/cunning/sessions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('削除しました')
      setSessions((p) => p.filter((s) => s.id !== id))
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900 mb-6">履歴</h1>
      {loading ? (
        <p className="text-slate-400 font-bold">読み込み中…</p>
      ) : sessions.length === 0 ? (
        <p className="text-slate-400 font-bold">まだセッションがありません</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
              <Link href={`/cunning/live/${s.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                <span>{s.mode === 'interview' ? '🎓' : '💼'}</span>
                <div className="min-w-0">
                  <p className="font-bold text-slate-700 truncate">{s.title}</p>
                  <p className="text-xs font-bold text-slate-400">
                    {new Date(s.createdAt).toLocaleString('ja-JP')} · {s._count.answers}回答 ·{' '}
                    {Math.floor(s.durationSec / 60)}分
                  </p>
                </div>
              </Link>
              <button onClick={() => remove(s.id)} className="text-slate-300 hover:text-red-500 flex-shrink-0">
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
