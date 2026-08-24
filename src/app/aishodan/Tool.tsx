'use client'

// ============================================
// ドヤAI商談 ダッシュボード（ホスト向け）
// ============================================
// 商材登録 → ルーム発行 → 商談ログ確認 を1画面で回す。
// 設定を全部埋めないと始められない作りにすると、最初の商談に到達しない。
// URLを1本入れれば、既定のシナリオまで自動で用意される。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import OrgSwitcher, { withOrg, type Membership } from '@/components/org/OrgSwitcher'
import MemberPanel from '@/components/org/MemberPanel'
import { SESSION_STATUS_LABELS, VERDICT_LABELS, type Verdict } from '@/lib/aishodan/types'
import AishodanLp from './Lp'
import { notifyError } from '@/lib/ui/notify'
import { DoyaKun } from '@/components/lp'
import LoadingProgress from '@/components/LoadingProgress'

interface Product {
  id: string
  name: string
  sourceUrl: string | null
  scenarios: Array<{ id: string; name: string }>
  _count: { chunks: number; sources: number }
}
interface Room {
  id: string
  name: string
  token: string
  isActive: boolean
  expiresAt: string | null
  sessionCount: number
  maxSessions: number
  scenario: { id: string; name: string; product: { name: string } }
  _count: { sessions: number }
}
interface SessionRow {
  id: string
  guestName: string | null
  guestCompany: string | null
  status: string
  createdAt: string
  room: { name: string }
  outcome: { fitScore: number; verdict: string } | null
  _count: { turns: number }
}
interface Stats {
  total: number
  evaluated: number
  completionRate: number
  scheduled: number
  schedulingRate: number
  avgMin: number
  byVerdict: Record<string, number>
  unanswered: Array<{ id: string; text: string }>
}

const VERDICT_STYLE: Record<string, string> = {
  hot: 'bg-rose-50 text-rose-700',
  warm: 'bg-amber-50 text-amber-700',
  cold: 'bg-slate-100 text-slate-600',
  unfit: 'bg-slate-100 text-slate-500',
}

export default function AishodanTool() {
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<{ slug: string; name: string; role: string } | null>(null)
  const [orgName, setOrgName] = useState('')
  const [memberships, setMemberships] = useState<Membership[]>([])
  /** 未ログイン。⚠️ 組織が無いのか、そもそもログインしていないのかを区別する。
   *  区別しないと、未ログインの人に「組織を作成」フォームを見せてしまい、
   *  押しても401で何も起きない（何が悪いのか分からない画面になる）。 */
  const [needsLogin, setNeedsLogin] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  const [issuing, setIssuing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
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
        const [pr, rr, sr, st] = await Promise.all([
          fetch(withOrg('aishodan', '/api/aishodan/products')).then((x) => x.json()),
          fetch(withOrg('aishodan', '/api/aishodan/rooms')).then((x) => x.json()),
          fetch(withOrg('aishodan', '/api/aishodan/sessions')).then((x) => x.json()),
          fetch(withOrg('aishodan', '/api/aishodan/stats')).then((x) => x.json()),
        ])
        setProducts(pr.products || [])
        setRooms(rr.rooms || [])
        setSessions(sr.sessions || [])
        setStats(st)
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

  async function createOrg() {
    if (!orgName.trim()) return
    setError('')
    const r = await fetch(withOrg('aishodan', '/api/aishodan/organizations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName.trim() }),
    })
    if (!r.ok) {
      setError((await r.json().catch(() => ({})))?.error || '作成に失敗しました')
      return
    }
    await load()
  }

  async function importProduct() {
    if (!url.trim()) return
    setImporting(true)
    setError('')
    setImportResult(null)
    try {
      const r = await fetch(withOrg('aishodan', '/api/aishodan/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '取り込みに失敗しました')
      setImportResult(`「${d.product.name}」を取り込みました（${d.pageCount}ページ / ${d.chunkCount}件のナレッジ）`)
      setUrl('')
      await load()
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '取り込みに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  async function issueRoom(scenarioId: string) {
    setIssuing(true)
    setError('')
    try {
      const r = await fetch(withOrg('aishodan', '/api/aishodan/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'ルームを発行できませんでした')
      await load()
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : 'ルームを発行できませんでした')
    } finally {
      setIssuing(false)
    }
  }

  async function toggleRoom(room: Room) {
    await fetch(withOrg('aishodan', `/api/aishodan/rooms/${room.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !room.isActive }),
    })
    await load()
  }

  function roomUrl(token: string) {
    return typeof window !== 'undefined' ? `${window.location.origin}/m/${token}` : `/m/${token}`
  }

  async function copyUrl(token: string) {
    try {
      await navigator.clipboard.writeText(roomUrl(token))
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      notifyError(setError, 'コピーできませんでした。URLを選択してコピーしてください。')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-slate-50">
        {/* ⚠️ 規約(§4.3)ではローディングはドヤくん working。テキストだけにしない */}
        <DoyaKun mood="working" size={88} />
        <p className="text-sm font-bold text-slate-400">読み込んでいます…</p>
      </div>
    )
  }

  // ⚠️ 未ログインの方にはLPを見せる。以前は「ログインが必要です」の小さな箱だけで、
  //    何をするサービスなのか説明する面がどこにも無かった。
  if (needsLogin) {
    return <AishodanLp />
  }

  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold text-slate-900">ドヤAI商談</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 font-semibold">
            はじめに、商談を行う組織を作成してください。
          </p>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="株式会社スリスタ"
            className="mt-5 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
          />
          {error && <p className="mt-3 text-sm text-rose-600 font-semibold">{error}</p>}
          <button
            onClick={createOrg}
            disabled={!orgName.trim()}
            className="mt-4 w-full rounded-lg bg-[#0066ff] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
          >
            組織を作成する
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* ⚠️ AI処理中は全画面で「何をしているか」を出す。無言で待たせない */}
      <LoadingProgress
        isLoading={importing}
        operationKey="aishodan-import"
        title="商材を読み取っています"
        subtitle="サービスページから商材ナレッジと商談シナリオを組み立てています。"
        tips={['Tip: 資料を足すほど、答えられる質問の範囲が広がります', 'Tip: 根拠が無い質問には推測で答えず記録に残します', 'Tip: シナリオは生成後に編集できます']}
      />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">ドヤAI商談</h1>
            <p className="text-xs text-slate-500 font-semibold">{org.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <OrgSwitcher
              service="aishodan"
              memberships={memberships}
              currentSlug={org.slug}
              onChange={() => void load()}
            />
            {/* ⚠️ 「練習モード」「商談ログ」はサイドバーにある。ここに同じ導線を
                 並べると同じ場所へ行くボタンが2つになるので置かないこと。
                 商材カード側の「練習する」はその商材で練習する別の導線。 */}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-semibold">{error}</div>}

        {/* 指標 */}
        {stats && stats.total > 0 && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="商談数" value={`${stats.total}件`} />
            <Metric label="完了率" value={`${stats.completionRate}%`} />
            <Metric label="平均所要" value={`${stats.avgMin}分`} />
            <Metric label="日程調整" value={`${stats.scheduled}件 / ${stats.schedulingRate}%`} />
          </section>
        )}

        {/* 1. 商材を取り込む */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-bold text-slate-900">1. 商材を取り込む</h2>
          <p className="mt-1 text-sm text-slate-600 font-semibold">
            自社サービスのURLを入力すると、サイトを読み取ってナレッジを作り、既定の商談シナリオまで用意します。
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/service"
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
            />
            <button
              onClick={importProduct}
              disabled={importing || !url.trim()}
              className="rounded-lg bg-[#0066ff] hover:bg-[#0052cc] shadow-lg shadow-[#0066ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
            >
              {importing ? '取り込み中...' : '取り込む'}
            </button>
          </div>
          {importResult && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 font-semibold">{importResult}</p>
          )}

          {products.length > 0 && (
            <div className="mt-5 divide-y divide-slate-100">
              {products.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500 font-semibold">
                      ナレッジ {p._count.chunks}件 / {p._count.sources}ページ
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {p.scenarios[0] && (
                      <>
                        <Link
                          href={`/aishodan/scenarios/${p.scenarios[0].id}`}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold"
                        >
                          シナリオを編集
                        </Link>
                        <Link
                          href="/aishodan/preview"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold"
                        >
                          練習する
                        </Link>
                        <button
                          onClick={() => issueRoom(p.scenarios[0].id)}
                          disabled={issuing}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
                        >
                          商談URLを発行
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. 商談ルーム */}
        {rooms.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-900">2. 商談URL</h2>
            <p className="mt-1 text-sm text-slate-600 font-semibold">
              このURLをメール・LP・広告のリンク先に置くと、相手がログイン不要で商談を始められます。
            </p>
            <div className="mt-4 space-y-3">
              {rooms.map((room) => (
                <div key={room.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{room.name}</p>
                      <p className="text-xs text-slate-500 font-semibold">
                        {room.scenario.product.name} / 実施 {room._count.sessions}件
                        {room.expiresAt && ` / ${new Date(room.expiresAt).toLocaleDateString('ja-JP')}まで`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        room.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {room.isActive ? '公開中' : '停止中'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 font-semibold">
                      {roomUrl(room.token)}
                    </code>
                    <button
                      onClick={() => copyUrl(room.token)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold"
                    >
                      {copied === room.token ? 'コピーしました' : 'URLをコピー'}
                    </button>
                    <a
                      href={roomUrl(room.token)}
                      target="_blank"
                      rel="noopener"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold"
                    >
                      試す
                    </a>
                    <button
                      onClick={() => toggleRoom(room)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold"
                    >
                      {room.isActive ? '公開を停止' : '公開する'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. 直近の商談 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-slate-900">直近の商談</h2>
            <Link href="/aishodan/sessions" className="text-xs text-[#0066ff] hover:underline font-semibold">
              すべて見る
            </Link>
          </div>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 font-semibold">まだ商談はありません。</p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {sessions.slice(0, 8).map((s) => (
                <Link key={s.id} href={`/aishodan/sessions/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {s.guestCompany || '会社名未取得'} {s.guestName ? `／ ${s.guestName}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 font-semibold">
                      {new Date(s.createdAt).toLocaleString('ja-JP')} / {s._count.turns}発話
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.outcome ? (
                      <>
                        <span className="text-sm font-bold text-slate-900">{s.outcome.fitScore}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${VERDICT_STYLE[s.outcome.verdict]}`}>
                          {VERDICT_LABELS[s.outcome.verdict as Verdict]}
                        </span>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                        {SESSION_STATUS_LABELS[s.status] || s.status}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <MemberPanel
          basePath="/api/aishodan"
          service="aishodan"
          description="招待した方は、この組織の商材・商談シナリオと商談ログを扱えるようになります。"
        />

        {/* 未回答質問 = ナレッジ拡充の優先順位 */}
        {stats && stats.unanswered.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-900">その場で答えられなかった質問</h2>
            <p className="mt-1 text-sm text-slate-600 font-semibold">
              資料に根拠が無く「確認して折り返す」と回答したものです。ここを埋めると商談の質が上がります。
            </p>
            <ul className="mt-4 space-y-2">
              {stats.unanswered.slice(0, 12).map((q) => (
                <li key={q.id} className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-700 font-semibold">
                  {q.text}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs text-slate-500 font-semibold">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
