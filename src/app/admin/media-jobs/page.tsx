'use client'

// ============================================
// 管理: メディア処理ジョブの一覧
// ============================================
// 失敗しているジョブと、止まっているジョブをすぐ見つけるための画面。
// 先に状態ごとの件数を出し、失敗を押すと失敗だけに絞れる。

import { useCallback, useEffect, useState } from 'react'
import { MEDIA_JOB_KIND_LABELS, MEDIA_JOB_STATUS_LABELS, type MediaJobKind, type MediaJobStatus } from '@/lib/media-jobs/kinds'

interface Row {
  id: string
  kind: string
  status: string
  progress: number
  stage: string | null
  attempts: number
  maxAttempts: number
  error: string | null
  source: string | null
  createdAt: string
  finishedAt: string | null
  inputPath: string
  user: string
}

const STATUSES: MediaJobStatus[] = ['queued', 'running', 'succeeded', 'failed', 'canceled']

export default function AdminMediaJobsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/admin/media-jobs${status ? `?status=${encodeURIComponent(status)}` : ''}`)
      if (r.status === 401) {
        setError('管理者としてログインしてください。')
        return
      }
      const d = await r.json()
      setRows(d.jobs || [])
      setCounts(d.counts || {})
    } catch {
      setError('読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">メディアジョブ</h1>
            <p className="text-xs text-slate-500">動画の変換・音声の抜き出し・文字起こしなど、専用ワーカーで処理している仕事の一覧です。</p>
          </div>
          <button onClick={() => void load()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
            再読み込み
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatus('')}
              className={`rounded-full px-3.5 py-1.5 text-sm ${status === '' ? 'bg-[#0066ff] text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
            >
              すべて
            </button>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-full px-3.5 py-1.5 text-sm ${status === s ? 'bg-[#0066ff] text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
              >
                {MEDIA_JOB_STATUS_LABELS[s]} {counts[s] ?? 0}件
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {loading ? (
            <p className="text-sm text-slate-500">読み込み中...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">該当するジョブはありません。</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((r) => (
                <article key={r.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                      {MEDIA_JOB_KIND_LABELS[r.kind as MediaJobKind] ?? r.kind}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-medium ${
                        r.status === 'failed' ? 'bg-rose-50 text-rose-700' : r.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f2f6ff] text-[#0066ff]'
                      }`}
                    >
                      {MEDIA_JOB_STATUS_LABELS[r.status as MediaJobStatus] ?? r.status}
                      {r.status === 'running' ? ` ${r.progress}%` : ''}
                    </span>
                    <span>{r.attempts}/{r.maxAttempts}回</span>
                    <span>{new Date(r.createdAt).toLocaleString('ja-JP')}</span>
                    <span>{r.user}</span>
                  </div>
                  <p className="mt-2 break-all text-sm text-slate-800">
                    {r.inputPath}
                    {r.stage && r.status !== 'succeeded' ? <span className="ml-2 text-xs text-slate-500">{r.stage}</span> : null}
                  </p>
                  {r.error && r.status !== 'succeeded' && <p className="mt-1 break-all text-xs text-rose-700">{r.error}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    {r.id}
                    {r.source ? `　${r.source}` : ''}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
