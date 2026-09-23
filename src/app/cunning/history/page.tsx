'use client'

import { mergeCunningEntries } from '@/lib/cunning/history-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { EmptyState } from '@/components/EmptyState'

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

  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const busyRef = useRef(false)
  const aliveRef = useRef(true)
  const removedRef = useRef(new Set<string>())
  const deletingRef = useRef(new Set<string>())

  const load = useCallback(async (cursor: string | null = null) => {
    if (busyRef.current) return
    busyRef.current = true
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const query = cursor ? '?' + new URLSearchParams({ cursor }) : ''
      const r = await fetch('/api/cunning/sessions' + query, { cache: 'no-store', signal: controller.signal })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '履歴を取得できませんでした')
      if (!Array.isArray(d.sessions) || !(d.nextCursor === null || typeof d.nextCursor === 'string')) throw new Error('履歴の形式を確認できませんでした')
      if (!aliveRef.current) return
      setSessions((previous) => (cursor ? mergeCunningEntries<SessionRow>(previous, d.sessions) : d.sessions).filter((row: SessionRow) => !removedRef.current.has(row.id)))
      setNextCursor(d.nextCursor)
    } catch (error) {
      if (aliveRef.current) setError(error instanceof Error ? error.message : '履歴を取得できませんでした。再試行してください。')
    } finally {
      clearTimeout(timeout)
      busyRef.current = false
      if (aliveRef.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    aliveRef.current = true
    void load()
    return () => { aliveRef.current = false }
  }, [load])

  const remove = async (id: string) => {
    if (deletingRef.current.has(id) || !confirm('このセッションを削除しますか？文字起こし・回答・議事録が削除されます。使用済みの利用時間は戻りません。')) return
    deletingRef.current.add(id)
    setDeleting(new Set(deletingRef.current))
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(`/api/cunning/sessions/${id}`, { method: 'DELETE', signal: controller.signal })
      if (!res.ok) throw new Error('削除できませんでした。通信状況を確認して再試行してください。')
      removedRef.current.add(id)
      if (!aliveRef.current) return
      toast.success('削除しました', { id: `cunning-delete-${id}` })
      setSessions((rows) => rows.filter((row) => row.id !== id))
    } catch (error) {
      if (aliveRef.current) toast.error(error instanceof Error ? error.message : '削除できませんでした。再試行してください。', { id: `cunning-delete-${id}` })
    } finally {
      clearTimeout(timeout)
      deletingRef.current.delete(id)
      if (aliveRef.current) setDeleting(new Set(deletingRef.current))
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900 mb-6">履歴</h1>
      {error && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p>{error}</p><button onClick={() => void load(nextCursor)} disabled={loading} className="mt-2 font-bold underline">再試行する</button></div>}
      {loading && sessions.length === 0 ? (
        <p className="text-slate-400 font-bold">読み込み中…</p>
      ) : sessions.length === 0 && !error && !nextCursor ? (
        <div className="bg-white rounded-2xl shadow-sm">
          <EmptyState
            kind="not-generated"
            title="まだセッションがありません"
            description="会議を開始すると、相手の質問と回答カンペがここに残ります。"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
              <Link href={`/cunning/history/${s.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                <span>{s.mode === 'interview' ? '🎓' : '💼'}</span>
                <div className="min-w-0">
                  <p className="font-bold text-slate-700 truncate">{s.title}</p>
                  <p className="text-xs font-bold text-slate-400">
                    {new Date(s.createdAt).toLocaleString('ja-JP')} · {s._count.answers}回答 ·{' '}
                    {Math.floor(s.durationSec / 60)}分
                  </p>
                </div>
              </Link>
              <button aria-label={`${s.title}を削除`} disabled={deleting.has(s.id)} onClick={() => remove(s.id)} className="text-slate-300 hover:text-red-500 flex-shrink-0">
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {nextCursor && !error && <button onClick={() => void load(nextCursor)} disabled={loading} className="mt-5 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">{loading ? '読み込み中…' : '以前のセッションを読み込む'}</button>}
    </div>
  )
}
