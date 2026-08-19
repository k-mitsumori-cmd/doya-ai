'use client'

// ============================================
// ドヤ広告画像AI 履歴
// ============================================
// ⚠️ これまで一問一答の生成画面しか無く、作った広告画像はブラウザを閉じたら
//    二度と見返せなかった。GET /api/adimage/concepts は実装されていたのに
//    どの画面からも呼ばれていない状態だった（2026-08-17 に追加）。
// ⚠️ ログイン必須（2026-08-17〜）。サーバ側で userId にスコープされるため、
//    ここでの絞り込みは不要。未ログインなら 401 が返るのでログインを促す。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { notifyError } from '@/lib/ui/notify'

interface Creative {
  id: string
  placementKey: string
  placementName: string
  media: string
  size: string
  verify: { ocrMatch?: boolean; needsReview?: boolean } | null
  url: string | null
}

interface Concept {
  id: string
  label: string
  copy: { headline?: string; sub?: string; cta?: string } | null
  generation: number
  createdAt: string
  campaignName: string
  brandName: string
  creatives: Creative[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdImageHistoryPage() {
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/adimage/concepts')
      if (res.status === 401) {
        notifyError(setError, '履歴のご確認にはログインが必要です。')
        return
      }
      if (!res.ok) {
        notifyError(setError, '履歴を読み込めませんでした')
        return
      }
      const data = await res.json()
      const list: Concept[] = data?.concepts || []
      setConcepts(list)
      // 最新のものは開いた状態で見せる（1件も開いていないと何があるか分からない）
      if (list[0]) setOpenId(list[0].id)
    } catch {
      notifyError(setError, '通信に失敗しました。時間をおいてお試しください。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">これまでに作った広告画像</h1>
            <p className="text-xs text-slate-500 font-semibold">直近50件を新しい順に表示します。</p>
          </div>
          <Link
            href="/adimage"
            className="rounded-lg bg-[#0066ff] px-4 py-2 text-xs font-bold text-white"
          >
            新しく作る
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-semibold">{error}</div>
        )}

        {loading ? (
          <p className="py-16 text-center text-sm text-slate-500 font-semibold">読み込んでいます…</p>
        ) : concepts.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-600 font-semibold">まだ広告画像がありません。</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 font-semibold">
              サービスのURLを入れると、媒体ごとにサイズの揃った広告画像を作れます。
            </p>
            <Link
              href="/adimage"
              className="mt-5 inline-block rounded-lg bg-[#0066ff] px-5 py-2.5 text-sm font-bold text-white"
            >
              広告画像を作る
            </Link>
          </div>
        ) : (
          concepts.map((c) => {
            const open = openId === c.id
            const thumb = c.creatives.find((cr) => cr.url)
            return (
              <section key={c.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <button
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {thumb?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {c.brandName}
                      <span className="ml-2 text-xs font-normal text-slate-500 font-semibold">{c.label}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 font-semibold">
                      {formatDate(c.createdAt)} / {c.creatives.length}点
                      {c.generation > 1 && ` / 改善${c.generation - 1}回目`}
                    </p>
                  </div>
                  <span className="material-symbols-outlined shrink-0 text-slate-400">
                    {open ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                    {c.copy?.headline && (
                      <p className="text-sm font-bold text-slate-900">{c.copy.headline}</p>
                    )}
                    {c.copy?.sub && <p className="mt-0.5 text-xs text-slate-600 font-semibold">{c.copy.sub}</p>}

                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {c.creatives.map((cr) => (
                        <div key={cr.id} className="overflow-hidden rounded-xl border border-slate-200">
                          {cr.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cr.url}
                              alt={cr.placementName}
                              className="w-full bg-slate-100 object-contain"
                            />
                          ) : (
                            <div className="flex h-40 items-center justify-center bg-slate-100 text-xs text-slate-400 font-semibold">
                              読み込めませんでした
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-900">{cr.placementName}</p>
                              <p className="text-[10px] text-slate-500">{cr.media} / {cr.size}</p>
                            </div>
                            {cr.verify?.needsReview ? (
                              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                                要確認
                              </span>
                            ) : cr.verify?.ocrMatch ? (
                              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                                文字OK
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>

                    {c.creatives.length > 0 && (
                      <a
                        href={`/api/adimage/concepts/${c.id}/export`}
                        className="mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold"
                      >
                        すべてダウンロード（ZIP）
                      </a>
                    )}
                  </div>
                )}
              </section>
            )
          })
        )}
      </main>
    </div>
  )
}
