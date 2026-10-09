'use client'

// ドヤAI質問リンク 結果の詳細（開き直し）。他人のIDは API が 404 を返す
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import RunResult from '@/components/asklink/RunResult'
import { useBannerQueue } from '@/components/asklink/useBannerQueue'
import type { RunDto } from '@/lib/asklink/dto'

export default function AskLinkRunPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  const [run, setRun] = useState<RunDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const queue = useBannerQueue(setRun)

  useEffect(() => {
    let alive = true
    fetch(`/api/asklink/runs/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(`/asklink/history/${id}`)}`
          return
        }
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.run) throw new Error(data?.error || '見つかりません。')
        if (alive) setRun(data.run)
      })
      .catch((e) => alive && setError((e as Error).message))
    return () => {
      alive = false
    }
  }, [id])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <Link href="/asklink/history" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        これまでの結果に戻る
      </Link>
      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>
      ) : !run ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          読み込んでいます…
        </p>
      ) : (
        <>
          {queue.error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{queue.error}</p>}
          <RunResult run={run} onChange={setRun} bannerBusy={queue.busy} onGenerateBanner={(kind) => void queue.generate(run.id, [kind])} />
        </>
      )}
    </div>
  )
}
