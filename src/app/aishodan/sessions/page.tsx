'use client'

// ============================================
// ドヤAI商談 商談一覧
// ============================================

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { withOrg } from '@/components/org/OrgSwitcher'
import { SESSION_STATUS_LABELS, VERDICT_LABELS, type Verdict } from '@/lib/aishodan/types'

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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = verdict ? `?verdict=${encodeURIComponent(verdict)}` : ''
      const r = await fetch(withOrg('aishodan', `/api/aishodan/sessions${q}`))
      const d = await r.json()
      setSessions(d.sessions || [])
    } finally {
      setLoading(false)
    }
  }, [verdict])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link href="/aishodan" className="text-xs text-slate-500 hover:underline">← ダッシュボード</Link>
          <h1 className="text-lg font-bold text-slate-900">商談ログ</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setVerdict(f.key)}
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
            <p className="text-sm text-slate-500">読み込み中...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-500">該当する商談はありません。</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <Link key={s.id} href={`/aishodan/sessions/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {s.guestCompany || '会社名未取得'} {s.guestName ? `／ ${s.guestName}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleString('ja-JP')} / {s.room.name} / {s._count.turns}発話
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.room.isPreview && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                        練習
                      </span>
                    )}
                    {s.schedulingClickedAt && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        日程調整済み
                      </span>
                    )}
                    {s.outcome ? (
                      <>
                        <span className="text-sm font-semibold text-slate-900">{s.outcome.fitScore}</span>
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
        </div>
      </main>
    </div>
  )
}
