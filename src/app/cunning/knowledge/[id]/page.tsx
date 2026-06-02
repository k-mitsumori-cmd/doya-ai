'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Chunk {
  id: string
  content: string
  sourceUrl: string | null
  sourceLabel: string | null
  createdAt: string
}
interface Base {
  id: string
  name: string
  description: string | null
  chunks: Chunk[]
}

export default function CunningKnowledgeDetail() {
  const params = useParams()
  const id = params.id as string
  const [base, setBase] = useState<Base | null>(null)
  const [loading, setLoading] = useState(true)
  const [ingestType, setIngestType] = useState<'text' | 'url'>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/cunning/knowledge/${id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setBase(d.base || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])
  useEffect(load, [load])

  const ingest = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/cunning/knowledge/${id}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingestType === 'url' ? { type: 'url', url } : { type: 'text', text }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setText('')
      setUrl('')
      toast.success(`${d.added}件を取り込みました`)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const removeChunk = async (chunkId: string) => {
    const res = await fetch(`/api/cunning/knowledge/${id}?chunkId=${chunkId}`, { method: 'DELETE' })
    if (res.ok) {
      setBase((b) => (b ? { ...b, chunks: b.chunks.filter((c) => c.id !== chunkId) } : b))
    }
  }

  if (loading) return <div className="p-10 text-slate-400 font-bold">読み込み中…</div>
  if (!base) return <div className="p-10 text-slate-400 font-bold">ナレッジが見つかりません</div>

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/cunning/knowledge" className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-xl font-black text-slate-900">{base.name}</h1>
      </div>
      <p className="text-xs font-bold text-slate-400 mb-6">{base.chunks.length}件の情報</p>

      {/* 取り込み */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <p className="font-black text-slate-700 mb-3">情報を追加</p>
        <div className="flex gap-2 mb-3">
          {(['text', 'url'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setIngestType(t)}
              className={`px-4 py-2 rounded-full text-sm font-black ${
                ingestType === t ? 'bg-[#7f19e6] text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {t === 'text' ? 'テキスト' : 'URL'}
            </button>
          ))}
        </div>
        {ingestType === 'text' ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="サービス概要・料金・FAQ・想定問答などを貼り付け"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium"
          />
        ) : (
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/service"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold"
          />
        )}
        <button
          onClick={ingest}
          disabled={busy}
          className="mt-3 px-5 py-3 rounded-xl bg-[#7f19e6] text-white font-black disabled:opacity-50"
        >
          {busy ? '取り込み中…' : '取り込む'}
        </button>
      </div>

      {/* チャンク一覧 */}
      <h2 className="font-black text-slate-700 mb-3">取り込み済みの情報</h2>
      <div className="space-y-2">
        {base.chunks.length === 0 ? (
          <p className="text-slate-400 font-bold text-sm">まだ情報がありません</p>
        ) : (
          base.chunks.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap flex-1">{c.content}</p>
                <button onClick={() => removeChunk(c.id)} className="text-slate-300 hover:text-red-500 flex-shrink-0">
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
              {c.sourceLabel && (
                <p className="mt-2 text-[11px] font-bold text-slate-400">出典: {c.sourceLabel}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
