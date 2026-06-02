'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface KB {
  id: string
  name: string
  description: string | null
  _count: { chunks: number }
}

export default function CunningKnowledgePage() {
  const [bases, setBases] = useState<KB[]>([])
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string>('')
  const [ingestType, setIngestType] = useState<'text' | 'url'>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    fetch('/api/cunning/knowledge', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setBases(d.bases || []))
      .catch(() => {})
  }
  useEffect(load, [])

  const createKB = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/cunning/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setName('')
      toast.success('作成しました')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const ingest = async () => {
    if (!selected) return toast.error('ナレッジを選択してください')
    setBusy(true)
    try {
      const res = await fetch(`/api/cunning/knowledge/${selected}/ingest`, {
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

  const remove = async (id: string) => {
    if (!confirm('このナレッジを削除しますか？')) return
    const res = await fetch(`/api/cunning/knowledge/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('削除しました')
      if (selected === id) setSelected('')
      load()
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900 mb-1">ナレッジ（商談モード）</h1>
      <p className="text-slate-500 font-bold text-sm mb-6">
        自社サービス情報を登録すると、商談中の質問に根拠つきで回答します
      </p>

      {/* 新規作成 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ナレッジ名（例: 自社サービス資料）"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold"
        />
        <button
          onClick={createKB}
          disabled={busy}
          className="px-5 py-3 rounded-xl bg-[#0B5CFF] text-white font-black disabled:opacity-50"
        >
          作成
        </button>
      </div>

      {/* 一覧 */}
      <div className="space-y-2 mb-6">
        {bases.map((b) => (
          <div
            key={b.id}
            className={`flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border-2 cursor-pointer ${
              selected === b.id ? 'border-[#0B5CFF]' : 'border-transparent'
            }`}
            onClick={() => setSelected(b.id)}
          >
            <div>
              <p className="font-black text-slate-800">{b.name}</p>
              <p className="text-xs font-bold text-slate-400">{b._count.chunks}件の情報</p>
            </div>
            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              <Link
                href={`/cunning/knowledge/${b.id}`}
                className="text-xs font-black text-[#0B5CFF] hover:underline"
              >
                管理
              </Link>
              <button onClick={() => remove(b.id)} className="text-slate-300 hover:text-red-500">
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            </div>
          </div>
        ))}
        {bases.length === 0 && <p className="text-slate-400 font-bold text-sm">まだナレッジがありません</p>}
      </div>

      {/* 取り込み */}
      {selected && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="font-black text-slate-700 mb-3">情報を追加</p>
          <div className="flex gap-2 mb-3">
            {(['text', 'url'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setIngestType(t)}
                className={`px-4 py-2 rounded-full text-sm font-black ${
                  ingestType === t ? 'bg-[#0B5CFF] text-white' : 'bg-slate-100 text-slate-500'
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
              rows={6}
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
            className="mt-3 px-5 py-3 rounded-xl bg-[#0B5CFF] text-white font-black disabled:opacity-50"
          >
            {busy ? '取り込み中…' : '取り込む'}
          </button>
        </div>
      )}
    </div>
  )
}
