'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { aioGet } from '@/lib/aio/client'

type ScanRow = {
  id: string; status: string; awarenessPct: number | null; shareOfVoice: number | null
  ownCitationPct: number | null; createdAt: string
}
type ScanPage = { items: ScanRow[]; nextCursor: string | null }

export default function AioHistoryPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const generation = useRef(0)
  const [items, setItems] = useState<ScanRow[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(next?: string) {
    if (next ? moreLoading : loading && items.length > 0) return
    const request = ++generation.current
    if (next) setMoreLoading(true)
    else setLoading(true)
    setError(null)
    try {
      const path = next ? `/api/aio/scans?cursor=${encodeURIComponent(next)}` : '/api/aio/scans'
      const page = await aioGet<ScanPage>(path, orgSlug)
      if (!Array.isArray(page.items) || !(page.nextCursor === null || typeof page.nextCursor === 'string') || page.items.some(row => !row || typeof row.id !== 'string' || typeof row.createdAt !== 'string')) throw new Error('履歴の応答を確認できませんでした。')
      if (request !== generation.current) return
      setItems(previous => next ? [...new Map([...previous, ...page.items].map(row => [row.id, row])).values()] : page.items)
      setCursor(page.nextCursor)
    } catch (cause) {
      if (request === generation.current) setError(cause instanceof Error ? cause.message : '履歴を読み込めませんでした。')
    } finally {
      if (request === generation.current) { setLoading(false); setMoreLoading(false) }
    }
  }

  useEffect(() => {
    generation.current++
    setItems([]); setCursor(null); setLoading(true); setError(null)
    void load()
    return () => { generation.current++ }
  }, [orgSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  const base = `/aio/${encodeURIComponent(orgSlug)}`
  const metric = (value: number | null) => typeof value === 'number' && Number.isFinite(value) ? `${value}%` : '—'
  return <div className="mx-auto max-w-5xl p-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-black text-slate-900">スキャン履歴</h1><p className="mt-1 text-sm text-slate-600">保存済みの測定結果を新しい順に確認できます。</p></div>
      <Link href={base} className="text-sm font-bold text-purple-700 underline">ダッシュボードに戻る</Link>
    </div>
    {loading && items.length === 0 ? <p role="status">履歴を読み込み中…</p> : null}
    {error && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}<button type="button" className="ml-3 font-bold underline" onClick={() => void load(cursor || undefined)}>再試行</button></div>}
    {!loading && !error && items.length === 0 && <p className="rounded-xl border bg-white p-6 text-slate-600">保存済みのスキャンはありません。</p>}
    <ol className="space-y-3">{items.map(row => <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-bold text-slate-900">{new Date(row.createdAt).toLocaleString('ja-JP')}</p><p className="mt-1 text-sm text-slate-600">{row.status === 'done' ? `言及率 ${metric(row.awarenessPct)} ・ SoV ${metric(row.shareOfVoice)} ・ 自社引用 ${metric(row.ownCitationPct)}` : row.status === 'failed' ? '測定失敗' : '処理中'}</p></div>
        <Link href={`${base}/history/${encodeURIComponent(row.id)}`} className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-bold text-white">結果を見る</Link>
      </div>
    </li>)}</ol>
    {cursor && !error && <button type="button" disabled={moreLoading} onClick={() => void load(cursor)} className="mt-5 rounded-lg border border-purple-300 px-5 py-2 text-sm font-bold text-purple-800 disabled:opacity-50">{moreLoading ? '読み込み中…' : '古い履歴をさらに表示'}</button>}
  </div>
}
