'use client'

// ドヤAI質問リンク 結果の詳細（開き直し）。他人のIDは API が 404 を返す
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import RunResult from '@/components/asklink/RunResult'
import { useBannerQueue } from '@/components/asklink/useBannerQueue'
import type { RunDto } from '@/lib/asklink/dto'
import { Button, EmptyState, Skeleton } from '@/components/ds'
import AskLinkErrorNotice from '@/components/asklink/AskLinkErrorNotice'
import { statusError, statusOf } from '@/components/asklink/errors'

export default function AskLinkRunPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  const [run, setRun] = useState<RunDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 新しい見た目では、サーバーの文言ではなく状態から案内を決める（0 は通信の失敗）
  const [errStatus, setErrStatus] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const queue = useBannerQueue(setRun)

  useEffect(() => {
    let alive = true
    if (reloadKey > 0) setError(null)
    fetch(`/api/asklink/runs/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (res.status === 401) {
          // 遷移までのあいだ「0件」「見つかりません」を出さないよう、読み込み中のまま止める
          if (alive) {
            alive = false
            window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(`/asklink/history/${id}`)}`
          }
          return
        }
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.run) throw statusError(data?.error || '見つかりません。', res.ok ? 404 : res.status)
        if (alive) setRun(data.run)
      })
      .catch((e) => {
        if (!alive) return
        setError((e as Error).message)
        setErrStatus(statusOf(e))
      })
    return () => {
      alive = false
    }
  }, [id, reloadKey])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <Link
        href="/asklink/history"
        className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 min-h-11 whitespace-nowrap rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff]"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        これまでの結果に戻る
      </Link>
      {error && errStatus === 404 ? (
        // 他人の結果・消えた結果は、ここから一覧に戻れるようにする
        <div className="rounded-2xl bg-white ring-1 ring-slate-200">
          <EmptyState
            kind="no-results"
            title="この結果は見つかりませんでした"
            description="削除されたか、別のアカウントで作成された結果です。"
            action={<Button href="/asklink/history" icon="History" variant="secondary">これまでの結果を見る</Button>}
          />
        </div>
      ) : error ? (
        <AskLinkErrorNotice status={errStatus} action="load" callbackUrl={`/asklink/history/${id}`} onRetry={() => setReloadKey((k) => k + 1)} retryLabel="読み込み直す" />
      ) : !run ? (
        <div className="space-y-4" aria-busy="true">
          <div className="min-h-[220px] rounded-2xl bg-white p-5 ring-1 ring-slate-200"><Skeleton lines={5} delayMs={0} /></div>
          <div className="grid gap-4 lg:grid-cols-2">
            {[1, 2].map((i) => <div key={i} className="min-h-[260px] rounded-2xl bg-white p-5 ring-1 ring-slate-200"><Skeleton lines={6} delayMs={0} /></div>)}
          </div>
        </div>
      ) : error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>
      ) : !run ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          読み込んでいます…
        </p>
      ) : (
        <>
          {(
            queue.errorStatus !== null && (
              <div className="mb-4">
                <AskLinkErrorNotice status={queue.errorStatus} action="banner" callbackUrl={`/asklink/history/${id}`} />
              </div>
            )
          )}
          <RunResult run={run} onChange={setRun} bannerBusy={queue.busy} onGenerateBanner={(kind) => void queue.generate(run.id, [kind])} />
        </>
      )}
    </div>
  )
}
