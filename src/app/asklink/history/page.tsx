'use client'

// ドヤAI質問リンク これまでの結果（自分の分だけ。API側で userId スコープ）
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, History } from 'lucide-react'
import Image from 'next/image'

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

  useEffect(() => {
    let alive = true
    fetch('/api/asklink/runs')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || '読み込みに失敗しました。')
        if (alive) setRuns(data.runs || [])
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <History className="h-6 w-6 text-[#0066ff]" />
        <h1 className="text-2xl font-black text-slate-900">これまでの結果</h1>
      </div>

      {loading ? (
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
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-[#0066ff]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-slate-900">{r.name}</p>
                  <p className="truncate text-xs font-bold text-slate-500">{r.sourceUrl}</p>
                </div>
                <div className="hidden shrink-0 text-right text-xs font-bold text-slate-500 sm:block">
                  <p>{r.audience === 'b2c' ? 'ToC' : 'ToB'}・バナー{r.bannersDone}/3</p>
                  <p>{new Date(r.createdAt).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
