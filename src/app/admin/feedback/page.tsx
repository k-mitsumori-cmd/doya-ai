'use client'

// ============================================
// 管理: 集まった改善点・要望
// ============================================
// ⚠️ 集めることが目的ではなく開発に反映することが目的。
//    「どのサービスに何件・満足度いくつ」を先に出して、
//    どこから手を付けるかが判断できる並びにする。

import { useCallback, useEffect, useState } from 'react'

interface Row {
  id: string
  serviceId: string
  serviceLabel: string
  rating: number | null
  text: string
  usageCount: number
  createdAt: string
  user: string
  plan: string
}
interface Summary {
  serviceId: string
  serviceLabel: string
  count: number
  avgRating: number | null
}

export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary[]>([])
  const [service, setService] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = service ? `?service=${encodeURIComponent(service)}` : ''
      const r = await fetch(`/api/admin/feedback${q}`)
      if (r.status === 401) {
        setError('管理者としてログインしてください。')
        return
      }
      const d = await r.json()
      setRows(d.feedback || [])
      setSummary(d.byService || [])
    } catch {
      setError('読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [service])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <h1 className="text-lg font-bold text-slate-900">改善点・要望</h1>
          <p className="text-xs text-slate-500">
            無料プランの方が 1 / 5 / 20 回目の利用時に書いてくださった内容です。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        {summary.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-bold text-slate-900">サービス別</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setService('')}
                className={`rounded-full px-3.5 py-1.5 text-sm ${
                  service === '' ? 'bg-[#0066ff] text-white' : 'border border-slate-300 bg-white text-slate-700'
                }`}
              >
                すべて
              </button>
              {summary.map((s) => (
                <button
                  key={s.serviceId}
                  onClick={() => setService(s.serviceId)}
                  className={`rounded-full px-3.5 py-1.5 text-sm ${
                    service === s.serviceId ? 'bg-[#0066ff] text-white' : 'border border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {s.serviceLabel} {s.count}件
                  {s.avgRating != null && <span className="ml-1 opacity-70">（満足度 {s.avgRating}）</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {loading ? (
            <p className="text-sm text-slate-500">読み込み中...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">まだ届いていません。</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((r) => (
                <article key={r.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                      {r.serviceLabel}
                    </span>
                    {r.rating != null && (
                      <span className="rounded-full bg-[#f2f6ff] px-2.5 py-0.5 font-medium text-[#0066ff]">
                        満足度 {r.rating}/5
                      </span>
                    )}
                    <span>{r.usageCount}回目の利用</span>
                    <span>{new Date(r.createdAt).toLocaleString('ja-JP')}</span>
                    <span>{r.user}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{r.text}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
