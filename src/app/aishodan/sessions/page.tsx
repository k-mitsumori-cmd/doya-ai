'use client'

// ============================================
// ドヤAI商談 商談一覧
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ensureSelectedOrg, withOrg } from '@/components/org/OrgSwitcher'
import { SESSION_STATUS_LABELS, VERDICT_LABELS, type Verdict } from '@/lib/aishodan/types'
import { DoyaKun } from '@/components/lp'
import { EmptyState } from '@/components/EmptyState'
import { appendAishodanPage, parseAishodanPage } from '@/lib/aishodan/list-pages'

interface SessionRow {
  id: string
  guestName: string | null
  guestCompany: string | null
  status: string
  createdAt: string
  startedAt: string | null
  endedAt: string | null
  room: { name: string; isPreview: boolean }
  schedulingClickedAt: string | null
  outcome: { fitScore: number; verdict: string } | null
  _count: { turns: number }
}

const VERDICT_STYLE: Record<string, string> = {
  hot: 'bg-rose-50 text-rose-700',
  warm: 'bg-amber-50 text-amber-700',
  cold: 'bg-slate-100 text-slate-600',
  unfit: 'bg-slate-100 text-slate-500',
}

const FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'すべて' },
  { key: 'hot', label: '有望' },
  { key: 'warm', label: '見込みあり' },
  { key: 'cold', label: '時期尚早' },
  { key: 'unfit', label: '不適合' },
]

export default function AishodanSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [verdict, setVerdict] = useState('')
  const [error, setError] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadVersion = useRef(0)

  const load = useCallback(async () => {
    const version = ++loadVersion.current
    setLoading(true)
    setError('')
    setSessions([])
    setNextCursor(null)
    try {
      await ensureSelectedOrg('aishodan')
      const q = verdict ? `?verdict=${encodeURIComponent(verdict)}` : ''
      const r = await fetch(withOrg('aishodan', `/api/aishodan/sessions${q}`))
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(r.status === 403
        ? '選択中の組織にアクセスできません。ダッシュボードで組織を選び直してください。'
        : d?.error || '商談ログを取得できませんでした')
      const page = parseAishodanPage<SessionRow>(d, 'sessions', 200)
      if (version !== loadVersion.current) return
      setSessions(page.items)
      setNextCursor(page.nextCursor)
      setTotal(page.total)
    } catch (e) {
      if (version === loadVersion.current) setError(e instanceof Error ? e.message : '商談ログを取得できませんでした')
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }, [verdict])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    const version = loadVersion.current
    setLoadingMore(true)
    setError('')
    try {
      await ensureSelectedOrg('aishodan')
      const params = new URLSearchParams({ cursor: nextCursor })
      if (verdict) params.set('verdict', verdict)
      const r = await fetch(withOrg('aishodan', `/api/aishodan/sessions?${params}`))
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || '商談ログの続きを取得できませんでした')
      const page = parseAishodanPage<SessionRow>(d, 'sessions', 200)
      if (version !== loadVersion.current) return
      setSessions(appendAishodanPage(sessions, page, total))
      setNextCursor(page.nextCursor)
    } catch (e) {
      if (version === loadVersion.current) setError(e instanceof Error ? e.message : '商談ログの続きを取得できませんでした')
    } finally {
      if (version === loadVersion.current) setLoadingMore(false)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link href="/aishodan" className="text-xs text-slate-500 hover:underline font-semibold">← ダッシュボード</Link>
          <h1 className="text-lg font-bold text-slate-900">商談ログ</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { if (f.key !== verdict) { loadVersion.current++; setVerdict(f.key) } }}
              className={`rounded-full px-3.5 py-1.5 text-sm ${
                verdict === f.key ? 'bg-[#0066ff] text-white' : 'border border-slate-300 bg-white text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6"><DoyaKun mood="working" size={72} /><p className="text-sm font-bold text-slate-400">読み込んでいます…</p></div>
          ) : error && sessions.length === 0 ? (
            <div role="alert" className="py-6 text-center">
              <p className="text-sm font-semibold text-red-700">{error}</p>
              <button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">再読み込みする</button>
              <Link href="/aishodan" className="ml-3 inline-block text-sm font-bold text-blue-700 underline">組織を確認する</Link>
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              kind="not-generated"
              title="まだ商談がありません"
              description="シナリオを用意して商談を開始すると、ログと適合判定がここに残ります。"
            />
          ) : (
            <div>
            {error && <div role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <Link key={s.id} href={`/aishodan/sessions/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {s.guestCompany || '会社名未取得'} {s.guestName ? `／ ${s.guestName}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 font-semibold">
                      {new Date(s.createdAt).toLocaleString('ja-JP')} / {s.room.name} / {s._count.turns}発話
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.room.isPreview && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                        練習
                      </span>
                    )}
                    {s.schedulingClickedAt && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        日程調整済み
                      </span>
                    )}
                    {s.outcome ? (
                      <>
                        <span className="text-sm font-bold text-slate-900" title={`適合スコア ${s.outcome.fitScore} / 100`}><span className="mr-1 text-[11px] font-semibold text-slate-500">適合</span>{s.outcome.fitScore}</span>
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
            {nextCursor && <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="mt-4 rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-50">{loadingMore ? '読み込み中…' : `さらに表示（${sessions.length}/${total}件）`}</button>}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
