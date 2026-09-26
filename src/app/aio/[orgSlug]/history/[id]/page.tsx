'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { aioGet } from '@/lib/aio/client'
import type { ScanSummary, Recommendation } from '@/lib/aio/types'

type StoredScan = { id: string; status: string; createdAt: string; summary: (ScanSummary & { recommendations?: Recommendation[] }) | null }

export default function AioHistoryDetailPage() {
  const { orgSlug, id } = useParams<{ orgSlug: string; id: string }>()
  const [scan, setScan] = useState<StoredScan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true); setError(null); setScan(null)
    void aioGet<{ scan: StoredScan }>(`/api/aio/scans/${encodeURIComponent(id)}`, orgSlug).then(data => {
      if (!data.scan || data.scan.id !== id) throw new Error('スキャン結果を確認できませんでした。')
      if (active) setScan(data.scan)
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'スキャン結果を読み込めませんでした。') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, orgSlug])

  const summary = scan?.summary
  const metric = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? `${value}%` : '—'
  const history = `/aio/${encodeURIComponent(orgSlug)}/history`
  return <div className="mx-auto max-w-5xl p-6">
    <Link href={history} className="text-sm font-bold text-purple-700 underline">← スキャン履歴に戻る</Link>
    <h1 className="mt-4 text-2xl font-black text-slate-900">測定結果</h1>
    {loading && <p role="status" className="mt-6">読み込み中…</p>}
    {error && <p role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p>}
    {scan && <p className="mt-2 text-sm text-slate-600">{new Date(scan.createdAt).toLocaleString('ja-JP')} ・ {scan.status === 'done' ? '測定完了' : scan.status === 'failed' ? '測定失敗' : '処理中'}</p>}
    {scan && !summary && <p className="mt-6 rounded-xl border bg-white p-5 text-slate-600">この測定には保存済みの分析結果がありません。</p>}
    {summary && <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">{[['言及率', summary.awarenessPct], ['シェア・オブ・ボイス', summary.shareOfVoice], ['自社引用率', summary.ownCitationPct]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-black text-purple-800">{metric(value as number)}</p></div>)}</div>
      {summary.coverage && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">測定成功 {summary.coverage.succeeded} / 試行 {summary.coverage.attempted}、失敗 {summary.coverage.failed}</p>}
      {Array.isArray(summary.perEngine) && <section><h2 className="text-lg font-bold">AIエンジン別</h2><div className="mt-2 grid gap-2 sm:grid-cols-2">{summary.perEngine.map(row => <p key={row.engine} className="rounded-lg border bg-white p-3">{row.engine}: {metric(row.awarenessPct)}</p>)}</div></section>}
      {Array.isArray(summary.sov) && <section><h2 className="text-lg font-bold">言及ブランド</h2><ul className="mt-2 space-y-2">{summary.sov.map(row => <li key={row.brand} className="rounded-lg border bg-white p-3">{row.brand}: {metric(row.pct)}（{row.mentions}回）</li>)}</ul></section>}
      {Array.isArray(summary.citations) && <section><h2 className="text-lg font-bold">引用元</h2><ul className="mt-2 space-y-2">{summary.citations.map((row, index) => <li key={`${row.domain}-${index}`} className="rounded-lg border bg-white p-3">{row.domain} ・ {row.count}回</li>)}</ul></section>}
      {Array.isArray(summary.recommendations) && <section><h2 className="text-lg font-bold">改善アクション</h2><ul className="mt-2 space-y-2">{summary.recommendations.map((row, index) => <li key={index} className="rounded-lg border bg-white p-4"><p className="font-bold">{row.title}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{row.detail}</p></li>)}</ul></section>}
      {Array.isArray(summary.promptBreakdown) && <section><h2 className="text-lg font-bold">質問ごとの回答</h2><div className="mt-2 space-y-3">{summary.promptBreakdown.map((row, index) => <div key={`${row.promptId}-${index}`} className="rounded-xl border bg-white p-4"><p className="font-bold">{row.text}</p>{Array.isArray(row.samples) && row.samples.map((sample, sampleIndex) => <div key={sampleIndex} className="mt-3 border-t pt-3 text-sm"><p className="font-bold text-purple-800">{sample.engine} ・ {sample.brandMentioned ? '自社言及あり' : '自社言及なし'}</p><p className="mt-1 whitespace-pre-wrap text-slate-700">{sample.answer}</p></div>)}</div>)}</div></section>}
    </div>}
  </div>
}
