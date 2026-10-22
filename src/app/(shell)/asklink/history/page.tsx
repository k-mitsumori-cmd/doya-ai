'use client'

// ドヤAI質問リンク これまでの結果（自分の分だけ。API側で userId スコープ）
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, History } from 'lucide-react'
import Image from 'next/image'
import { useUiNext } from '@/components/shell/ui-next-context'
import { Button, EmptyState, Skeleton } from '@/components/ds'
import AskLinkErrorNotice from '@/components/asklink/AskLinkErrorNotice'
import { statusError, statusOf } from '@/components/asklink/errors'

interface RunRow {
  id: string
  sourceUrl: string
  audience: string
  name: string
  bannersDone: number
  createdAt: string
}

export default function AskLinkHistoryPage() {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 新しい見た目では、サーバーの文言ではなく状態から案内を決める（0 は通信の失敗）
  const [errStatus, setErrStatus] = useState(0)
  // 「やり直す」で読み込み直す（ページ全体は開き直さない）
  const [reloadKey, setReloadKey] = useState(0)
  const uiNext = useUiNext()

  useEffect(() => {
    let alive = true
    if (reloadKey > 0) {
      setLoading(true)
      setError(null)
    }
    fetch('/api/asklink/runs')
      .then(async (res) => {
        if (res.status === 401) {
          // 遷移までのあいだ「0件」「見つかりません」を出さないよう、読み込み中のまま止める
          if (alive) {
            alive = false
            window.location.href = '/auth/signin?callbackUrl=/asklink/history'
          }
          return
        }
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw statusError(data?.error || '読み込みに失敗しました。', res.status)
        if (alive) setRuns(data.runs || [])
      })
      .catch((e) => {
        if (!alive) return
        setError((e as Error).message)
        setErrStatus(statusOf(e))
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [reloadKey])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <History aria-hidden className="h-6 w-6 shrink-0 text-[#0066ff]" />
        {/* 新しい見た目では、h1 は枠（ToolFrame）の見出しだけにする */}
        {uiNext
          ? <h2 className="text-2xl font-black text-slate-900">これまでの結果</h2>
          : <h1 className="text-2xl font-black text-slate-900">これまでの結果</h1>}
      </div>

      {loading && uiNext ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3].map((i) => <div key={i} className="min-h-[76px] rounded-2xl bg-white p-4 ring-1 ring-slate-200"><Skeleton lines={2} delayMs={0} /></div>)}
        </div>
      ) : error && uiNext ? (
        <AskLinkErrorNotice status={errStatus} action="load" callbackUrl="/asklink/history" onRetry={() => setReloadKey((k) => k + 1)} retryLabel="読み込み直す" />
      ) : runs.length === 0 && !loading && uiNext ? (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200">
          <EmptyState
            kind="not-generated"
            art="/asklink/empty-links.webp"
            title="最初の質問リンクをつくりましょう"
            description="サイトのURLを入れると、「AIに聞く」リンクとポップアップ用のバナーを作れます。"
            action={<Button href="/asklink" icon="Link2">質問リンクをつくる</Button>}
          />
        </div>
      ) : loading ? (
        <p className="py-16 text-center text-sm font-semibold text-slate-500">読み込んでいます…</p>
      ) : error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-slate-200">
          <Image src="/asklink/empty.webp" alt="" width={800} height={600} className="h-auto w-full max-w-[320px]" />
          <p className="mt-4 text-lg font-black text-slate-900">最初の質問リンクをつくりましょう</p>
          <p className="mt-1 text-sm font-bold text-slate-500">サイトのURLを入れると、「AIに聞く」リンクとポップアップ用バナーを作れます。</p>
          <Link href="/asklink" className="mt-5 inline-block rounded-lg bg-[#0066ff] px-5 py-2.5 text-sm font-bold text-white">
            質問リンクをつくる
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {runs.map((r) => (
            <li key={r.id}>
              <Link
                href={`/asklink/history/${r.id}`}
                className={`flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-[#0066ff]${
                  uiNext ? ' min-h-[76px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff] focus-visible:ring-offset-0 motion-reduce:transition-none' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate !whitespace-nowrap text-base font-black text-slate-900">{r.name}</p>
                  <p className="truncate !whitespace-nowrap text-xs font-bold text-slate-500">{r.sourceUrl}</p>
                  {/* 375px では右の列を隠すので、種類と日付をここに出す（新しい見た目だけ） */}
                  {uiNext ? (
                    <p className="mt-0.5 truncate !whitespace-nowrap text-xs font-bold text-slate-400 sm:hidden">
                      {r.audience === 'b2c' ? 'ToC' : 'ToB'}・バナー{r.bannersDone}/3・{new Date(r.createdAt).toLocaleDateString('ja-JP', { dateStyle: 'medium' })}
                    </p>
                  ) : null}
                </div>
                <div className="hidden shrink-0 text-right text-xs font-bold text-slate-500 sm:block">
                  <p>{r.audience === 'b2c' ? 'ToC' : 'ToB'}・バナー{r.bannersDone}/3</p>
                  <p>{new Date(r.createdAt).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
