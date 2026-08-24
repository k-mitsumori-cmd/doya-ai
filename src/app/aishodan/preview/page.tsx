'use client'

// ============================================
// ドヤAI商談 練習モード（ホスト向け）
// ============================================
// シナリオを詰めるための画面。仕様書 §8 で「品質調整の主戦場」としていた場所。
//
// ⚠️ 練習は**本番と全く同じ商談画面**（/m/{token}）を開く。
//    専用の簡易モードにすると、そこで直したつもりのシナリオが本番で違う挙動をする。
// ⚠️ 練習の商談は指標・無料枠・Slack通知から除外される（ログは残る）。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import OrgSwitcher, { withOrg, type Membership } from '@/components/org/OrgSwitcher'
import { SESSION_STATUS_LABELS } from '@/lib/aishodan/types'
import { notifyError } from '@/lib/ui/notify'
import { DoyaKun } from '@/components/lp'

interface Product {
  id: string
  name: string
  scenarios: Array<{ id: string; name: string }>
}
interface SessionRow {
  id: string
  guestName: string | null
  guestCompany: string | null
  status: string
  createdAt: string
  schedulingClickedAt: string | null
  outcome: { fitScore: number; verdict: string } | null
  _count: { turns: number }
}

export default function AishodanPreviewPage() {
  const [loading, setLoading] = useState(true)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [org, setOrg] = useState<{ slug: string; name: string; role: string } | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])

  const [products, setProducts] = useState<Product[]>([])
  const [scenarioId, setScenarioId] = useState('')
  const [sessions, setSessions] = useState<SessionRow[]>([])

  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(withOrg('aishodan', '/api/aishodan/organizations'))
      if (r.status === 401) {
        setNeedsLogin(true)
        return
      }
      const d = await r.json()
      setOrg(d.current)
      setMemberships(d.memberships || [])
      if (d.current) {
        const [pr, sr] = await Promise.all([
          fetch(withOrg('aishodan', '/api/aishodan/products')).then((x) => x.json()),
          // 練習の商談だけを見る
          fetch(withOrg('aishodan', '/api/aishodan/sessions?scope=preview')).then((x) => x.json()),
        ])
        const ps: Product[] = pr.products || []
        setProducts(ps)
        setSessions(sr.sessions || [])
        const first = ps.find((p) => p.scenarios.length > 0)?.scenarios[0]?.id
        if (first) setScenarioId((prev) => prev || first)
      }
    } catch {
      notifyError(setError, '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const startPractice = useCallback(async () => {
    if (!scenarioId) return
    setStarting(true)
    setError('')
    try {
      const r = await fetch(withOrg('aishodan', `/api/aishodan/scenarios/${scenarioId}/preview`), {
        method: 'POST',
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '練習を開始できませんでした')
      // ⚠️ 別タブで開く。この画面は残しておき、話した後にすぐログを見返せるようにする。
      window.open(`/m/${d.token}`, '_blank', 'noopener')
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '練習を開始できませんでした')
    } finally {
      setStarting(false)
    }
  }, [scenarioId])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-slate-50">
        {/* ⚠️ 規約(§4.3)ではローディングはドヤくん working。テキストだけにしない */}
        <DoyaKun mood="working" size={88} />
        <p className="text-sm font-bold text-slate-400">読み込んでいます…</p>
      </div>
    )
  }

  if (needsLogin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold text-slate-900">ドヤAI商談</h1>
          <p className="mt-2 text-sm text-slate-600 font-semibold">ご利用にはログインが必要です。</p>
          <a
            href={`/auth/signin?callbackUrl=${encodeURIComponent('/aishodan/preview')}`}
            className="mt-5 inline-block w-full rounded-lg bg-[#0066ff] px-4 py-3 text-sm font-bold text-white"
          >
            ログインする
          </a>
        </div>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-slate-600">先に商材を取り込んでください。</p>
        <Link href="/aishodan" className="text-sm text-[#0066ff] underline font-semibold">ダッシュボードへ</Link>
      </div>
    )
  }

  const scenarios = products.flatMap((p) => p.scenarios.map((s) => ({ ...s, productName: p.name })))

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <Link href="/aishodan" className="text-xs text-slate-500 hover:underline font-semibold">← ダッシュボード</Link>
            <h1 className="text-lg font-bold text-slate-900">練習モード</h1>
          </div>
          <div className="flex items-center gap-3">
            <OrgSwitcher
              service="aishodan"
              memberships={memberships}
              currentSlug={org.slug}
              onChange={() => void load()}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-semibold">{error}</div>}

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-bold text-slate-900">自分で商談を受けてみる</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 font-semibold">
            見込み客と同じ画面が開きます。AIの話し方・質問の順番・答えられない質問を、
            実際に話して確かめてください。ここで直したことがそのまま本番に効きます。
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 font-semibold">
            練習の商談は、件数の指標にも無料枠の消費にも入りません。Slack通知も飛びません。
            会話ログだけは残るので、あとから見返せます。
          </p>

          {scenarios.length === 0 ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 font-semibold">
              まだ商材がありません。
              <Link href="/aishodan" className="ml-1 font-bold underline">ダッシュボード</Link>
              でサービスURLを取り込んでください。
            </p>
          ) : (
            <>
              <label className="mt-4 block text-sm font-semibold">
                <span className="mb-1 block text-xs font-bold text-slate-500">試すシナリオ</span>
                <select
                  value={scenarioId}
                  onChange={(e) => setScenarioId(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.productName} — {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={startPractice}
                  disabled={starting || !scenarioId}
                  className="rounded-lg bg-[#0066ff] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  {starting ? '準備中...' : '練習を始める（別タブで開きます）'}
                </button>
                {scenarioId && (
                  <Link
                    href={`/aishodan/scenarios/${scenarioId}`}
                    className="rounded-lg border border-slate-300 px-5 py-3 text-sm text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    シナリオを直す
                  </Link>
                )}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-bold text-slate-900">練習の記録</h2>
          <p className="mt-1 text-sm text-slate-600 font-semibold">
            話し終えたらここから会話ログを開いて、AIの受け答えを確認してください。
          </p>
          {sessions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 font-semibold">まだ練習の記録はありません。</p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {sessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/aishodan/sessions/${s.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {new Date(s.createdAt).toLocaleString('ja-JP')}
                    </p>
                    <p className="text-xs text-slate-500 font-semibold">
                      {s._count.turns}発話
                      {s.guestName ? ` / ${s.guestName}` : ''}
                      {s.schedulingClickedAt ? ' / 日程調整を押した' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.outcome && <span className="text-sm font-bold text-slate-900" title={`適合スコア ${s.outcome.fitScore} / 100`}><span className="mr-1 text-[11px] font-semibold text-slate-500">適合</span>{s.outcome.fitScore}</span>}
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                      {SESSION_STATUS_LABELS[s.status] || s.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
