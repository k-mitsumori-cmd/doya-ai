'use client'

// ============================================
// ドヤ面接官 候補者の横並び比較（F4-4）
// ============================================
// 同じテンプレート（同じ主質問・同じ評価基準）で受けた候補者だけを並べる。
// ⚠️ 点数の高い順に並べているが、これは意思決定そのものではない。
//    情報不足の軸があると平均は上振れするため、必ず個別レポートを確認してもらう。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { notifyError } from '@/lib/ui/notify'

interface Criterion {
  key: string
  name: string
  weight: number
}
interface Candidate {
  templateName?: string
  jobTitle?: string
  id: string
  name: string | null
  verdict: string | null
  endedAt: string | null
  overallComment: string | null
  average: number | null
  scores: Record<string, number | null>
}
interface TemplateRow {
  id: string
  name: string
  _count?: { sessions: number }
}

const VERDICT_LABEL: Record<string, string> = {
  recommend: '推奨',
  conditional: '条件付き推奨',
  hold: '保留',
  reject: '見送り',
}
const VERDICT_STYLE: Record<string, string> = {
  recommend: 'bg-[#e6f4ea] text-[#137333]',
  conditional: 'bg-[#fef7e0] text-[#a06800]',
  hold: 'bg-[#f1f3f4] text-[#3c4043]',
  reject: 'bg-[#fce8e6] text-[#c5221f]',
}

/** 中央値との差で色を変える。絶対値ではなく相対で見るのが比較の目的なので。 */
function cellStyle(v: number | null, median: number | null): string {
  if (v == null) return 'text-[#8a94ad]'
  if (median == null) return 'text-[#0a0f3c]'
  if (v >= median + 1) return 'bg-[#e6f4ea] text-[#137333] font-black'
  if (v <= median - 1) return 'bg-[#fce8e6] text-[#c5221f] font-black'
  return 'text-[#0a0f3c]'
}

export default function ComparePage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  // ⚠️ 既定は「すべて」。以前は最初のテンプレートを選ぶまで何も出ず、
  //    「選ばないと表示されない」状態だった。
  const [templateId, setTemplateId] = useState('all')
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [medians, setMedians] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/mensetsu/templates')
        const json = await res.json()
        const list: TemplateRow[] = json?.templates || []
        setTemplates(list)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/mensetsu/compare?templateId=${encodeURIComponent(templateId)}`)
    const json = await res.json()
    if (!res.ok) {
      notifyError(setError, json?.error || '取得できませんでした')
      setCandidates([])
      return
    }
    setCriteria(json.template.criteria || [])
    setCandidates(json.candidates || [])
    setMedians(json.medians || {})
  }, [templateId])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = [...candidates].sort((a, b) => (b.average ?? -1) - (a.average ?? -1))

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff]">
        <p className="text-sm font-bold text-[#425071]">読み込んでいます…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f2f6ff] px-5 py-10 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <Link href="/mensetsu" className="text-xs font-black text-[#0066ff]">
          ← ダッシュボード
        </Link>
        <h1 className="mt-3 text-2xl font-black text-[#0a0f3c]">候補者の比較</h1>
        <p className="mt-2 max-w-[68ch] text-sm font-semibold leading-relaxed text-[#425071]">
          同じテンプレートで面接した候補者を並べます。色は<strong className="font-black text-[#0a0f3c]">その軸の中央値との差</strong>で、
          絶対的な良し悪しではありません。
        </p>

        <div className="mt-5 rounded-lg border border-[#ffe0b2] bg-[#fff8e1] p-4">
          <p className="text-sm font-bold leading-relaxed text-[#7a5200]">
            スコアは判断材料であり、順位そのものが結論ではありません。
            情報不足の軸があると平均は実態より高く出ます。気になる候補者は個別のレポートを確認してください。
          </p>
        </div>

        {templates.length === 0 ? (
          <p className="mt-6 text-sm font-semibold text-[#425071]">テンプレートがまだありません。</p>
        ) : (
          <>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mt-5 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#0066ff]"
            >
              <option value="all">すべて（全職種を横断して順位を出す）</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {error && <p className="mt-4 text-sm font-bold text-[#c2185b]">{error}</p>}

            {templateId === 'all' && (
              <p className="mt-3 text-xs font-semibold leading-relaxed text-[#8a94ad]">
                ⚠️ 職種をまたぐと評価軸そのものが違うため、横並びにできるのは「平均スコア」と「判定」だけです。
                評価軸ごとの点数を見比べたいときは、上の欄で職種を選んでください。
              </p>
            )}

            {sorted.length === 0 ? (
              <p className="mt-6 text-sm font-semibold text-[#425071]">
                評価済みの面接はまだありません。
              </p>
            ) : (
              <>
              {/* ⚠️ 表だけだと誰が上位なのか一目で分からない。
                   順位・平均スコア・判定を大きなカードで先に見せる。 */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map((c, i) => (
                  <div
                    key={c.id}
                    className={`rounded-2xl bg-white p-5 shadow-sm ring-2 ${
                      i === 0 ? 'ring-[#0066ff]' : 'ring-[#e8eefb]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-[#0a0f3c]">
                          {c.name || '（名前未入力）'}
                        </p>
                        {c.jobTitle && (
                          <p className="truncate text-xs font-bold text-[#8a94ad]">{c.jobTitle}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-sm font-black ${
                          i === 0 ? 'bg-[#0066ff] text-white' : 'bg-[#eef3ff] text-[#425071]'
                        }`}
                      >
                        {i + 1}位
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl bg-[#f7faff] px-4 py-3">
                      <p className="text-xs font-black text-[#425071]">平均スコア</p>
                      <p className="mt-0.5 text-3xl font-black leading-none text-[#0066ff]">
                        {c.average ?? '—'}
                        <span className="ml-1 text-base font-black text-[#8a94ad]">/ 5</span>
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#8a94ad]">5段階中 {c.average ?? '—'}</p>
                    </div>

                    {c.verdict && (
                      <span
                        className={`mt-3 inline-block rounded-full px-3 py-1.5 text-sm font-black ${
                          VERDICT_STYLE[c.verdict] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {VERDICT_LABEL[c.verdict] || c.verdict}
                      </span>
                    )}

                    <Link
                      href={`/mensetsu/sessions/${c.id}`}
                      className="mt-4 block rounded-xl border-2 border-[#d8e7ff] py-2.5 text-center text-sm font-black text-[#0066ff]"
                    >
                      評価の詳細を見る
                    </Link>
                  </div>
                ))}
              </div>

              <div className="mt-5 overflow-x-auto rounded-lg bg-white shadow-sm">
                <table className="w-full min-w-[720px] border-collapse text-sm font-medium">
                  <thead>
                    <tr className="border-b border-[#eef3ff]">
                      <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-xs font-black text-[#0a0f3c]">
                        候補者
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-black text-[#0a0f3c]">判定</th>
                      <th className="px-3 py-3 text-right text-xs font-black text-[#0a0f3c]">平均</th>
                      {criteria.map((c) => (
                        <th key={c.key} className="px-3 py-3 text-center text-xs font-black text-[#425071]">
                          {c.name}
                          <span className="mt-0.5 block text-[10px] font-semibold text-[#8a94ad]">
                            中央値 {medians[c.key] ?? '—'}
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((c) => (
                      <tr key={c.id} className="border-b border-[#f5f8ff]">
                        <td className="sticky left-0 z-10 bg-white px-4 py-3">
                          <p className="font-black text-[#0a0f3c]">{c.name || '（名前未入力）'}</p>
                          <p className="text-[11px] font-semibold text-[#8a94ad]">
                            {c.endedAt ? new Date(c.endedAt).toLocaleDateString('ja-JP') : '—'}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          {c.verdict && (
                            <span
                              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ${
                                VERDICT_STYLE[c.verdict] || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {VERDICT_LABEL[c.verdict] || c.verdict}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-black text-[#0066ff]">
                          {c.average ?? '—'}
                        </td>
                        {criteria.map((cr) => {
                          const v = c.scores[cr.key] ?? null
                          return (
                            <td
                              key={cr.key}
                              className={`px-3 py-3 text-center ${cellStyle(v, medians[cr.key] ?? null)}`}
                            >
                              {v ?? '情報不足'}
                            </td>
                          )
                        })}
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/mensetsu/sessions/${c.id}`}
                            className="whitespace-nowrap rounded-lg border border-[#d8e7ff] px-3 py-1.5 text-[11px] font-black text-[#0066ff]"
                          >
                            詳細
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
