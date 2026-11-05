'use client'

import { useEffect, useState } from 'react'
import type { MediaJobView } from '@/lib/media-jobs/status'
import { MEDIA_JOB_STATUS_LABELS, type MediaJobStatus } from '@/lib/media-jobs/kinds'

// ジョブ1件の進み具合を表示する最小の部品。
// 使い方: <MediaJobProgress jobId={job.id} onDone={(job) => ...} />
// 完了または失敗するまで3秒おきに状態を取得し、完了したら出力のダウンロードリンクを出す。

function formatSize(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

export default function MediaJobProgress({
  jobId,
  onDone,
}: {
  jobId: string
  onDone?: (job: MediaJobView) => void
}) {
  const [job, setJob] = useState<MediaJobView | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      try {
        const res = await fetch(`/api/media-jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('status')
        const { job: next } = (await res.json()) as { job: MediaJobView }
        if (cancelled) return
        setJob(next)
        setLoadError(false)
        if (next.status === 'succeeded' || next.status === 'failed' || next.status === 'canceled') {
          onDone?.(next)
          return
        }
      } catch {
        if (!cancelled) setLoadError(true)
      }
      if (!cancelled) timer = setTimeout(tick, 3000)
    }
    tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // onDone は呼び出し側の再描画で変わるため依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  if (!job) {
    return <p className="text-sm text-slate-500">{loadError ? '状態を取得できませんでした。' : '状態を確認しています。'}</p>
  }

  const statusLabel = MEDIA_JOB_STATUS_LABELS[job.status as MediaJobStatus] ?? job.status
  const active = job.status === 'queued' || job.status === 'running'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-800">{job.kindLabel}</span>
        <span className="text-slate-500">{statusLabel}</span>
      </div>
      {active && (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#0066ff] transition-[width] duration-500" style={{ width: `${job.progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {job.stage ? `${job.stage}（${job.progress}%）` : `${job.progress}%`}
            {job.attempts > 1 ? `　${job.attempts}回目の試行` : ''}
          </p>
        </>
      )}
      {job.status === 'failed' && job.error && <p className="mt-2 text-sm text-red-600">{job.error}</p>}
      {job.status === 'succeeded' && job.outputs.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {job.outputs.map((o) => (
            <li key={o.name}>
              {o.url ? (
                <a className="text-[#0066ff] underline" href={o.url} target="_blank" rel="noopener noreferrer">
                  {o.name}
                </a>
              ) : (
                o.name
              )}
              <span className="ml-2 text-xs text-slate-500">{formatSize(o.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
