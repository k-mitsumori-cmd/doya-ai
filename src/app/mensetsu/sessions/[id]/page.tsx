'use client'

// ============================================
// ドヤ面接官 評価レポート（採用担当者向け）
// ============================================
// スコア・根拠引用・逐語ログを表示する。
// ⚠️ AIの判定は「推薦度」であり最終決定ではない旨を、画面上に常時明示する（C2）。

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

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

export default function MensetsuReportPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'report' | 'transcript'>('report')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mensetsu/sessions/${id}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || '取得できませんでした')
        return
      }
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff]">
        <p className="text-sm font-bold text-[#425071]">読み込んでいます…</p>
      </main>
    )
  }
  if (error || !data?.session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff] px-5">
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold text-[#425071]">{error || '見つかりません'}</p>
          <Link href="/mensetsu" className="mt-4 inline-block text-sm font-black text-[#0066ff]">
            一覧へ戻る
          </Link>
        </div>
      </main>
    )
  }

  const s = data.session
  const criteria: any[] = s.template?.criteria || []
  const scoreByCriterion = new Map<string, any>(s.scores.map((x: any) => [x.criterionId, x]))

  return (
    <main className="min-h-screen bg-[#f2f6ff] px-5 py-10 lg:px-8">
      <div className="mx-auto max-w-[900px]">
        <Link href="/mensetsu" className="text-xs font-black text-[#0066ff]">
          ← 面接一覧
        </Link>

        <h1 className="mt-3 text-2xl font-black text-[#0a0f3c]">
          {s.candidateName || '（名前未入力）'}
        </h1>
        <p className="mt-1 text-sm font-medium text-[#425071]">
          {s.template.jobTitle} / {s.template.durationMin}分 /{' '}
          {s.endedAt ? new Date(s.endedAt).toLocaleString('ja-JP') : '未実施'}
        </p>

        {/* AI判定の位置づけを常時明示（C2） */}
        <div className="mt-5 rounded-lg border border-[#ffe0b2] bg-[#fff8e1] p-4">
          <p className="text-sm font-bold leading-relaxed text-[#7a5200]">
            以下はAIによる<strong className="font-black">推薦度</strong>であり、合否ではありません。
            AIの評価のみで不合格を確定させず、必ず担当者が内容を確認して判断してください。
          </p>
        </div>

        {s.verdict && (
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg bg-white p-6 shadow-sm">
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-black ${VERDICT_STYLE[s.verdict] || 'bg-slate-100 text-slate-700'}`}
            >
              {VERDICT_LABEL[s.verdict] || s.verdict}
            </span>
            {data.average != null && (
              <span className="text-sm font-bold text-[#0a0f3c]">
                平均スコア {data.average} / 5
              </span>
            )}
            <p className="w-full text-sm font-medium leading-relaxed text-[#425071]">{s.overallComment}</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(['report', 'transcript'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-xs font-black ${
                tab === t ? 'bg-[#0066ff] text-white' : 'bg-white text-[#425071]'
              }`}
            >
              {t === 'report' ? '評価' : '逐語ログ'}
            </button>
          ))}

          {/* PDFは評価済みのときだけ。未評価だとAPIが400を返すため、押せるのに進まないボタンにしない */}
          {s.evaluatedAt && (
            <div className="ml-auto flex items-center gap-2">
              <a
                href={`/api/mensetsu/sessions/${id}/pdf`}
                className="flex items-center gap-1.5 rounded-lg border border-[#d8e7ff] bg-white px-4 py-2 text-xs font-black text-[#0066ff]"
              >
                <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                レポートPDF
              </a>
              <a
                href={`/api/mensetsu/sessions/${id}/pdf?transcript=1`}
                className="rounded-lg border border-[#d8e7ff] bg-white px-4 py-2 text-xs font-black text-[#425071]"
                title="応募者の発言そのものが綴じ込まれます。取り扱いにご注意ください。"
              >
                逐語ログ付き
              </a>
            </div>
          )}
        </div>

        {tab === 'report' ? (
          <>
            <section className="mt-4 space-y-3">
              {criteria.map((c) => {
                const sc = scoreByCriterion.get(c.id)
                return (
                  <div key={c.id} className="rounded-lg bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-[#0a0f3c]">{c.name}</p>
                        {c.description && (
                          <p className="mt-1 text-xs font-medium text-[#425071]">{c.description}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-2xl font-black text-[#0066ff]">
                        {sc?.insufficient || sc?.score == null ? (
                          <span className="text-sm font-black text-[#8a94ad]">情報不足</span>
                        ) : (
                          `${sc.score}`
                        )}
                      </span>
                    </div>
                    {sc?.rationale && (
                      <p className="mt-3 text-sm font-medium leading-relaxed text-[#425071]">{sc.rationale}</p>
                    )}
                    {sc?.quotes?.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {sc.quotes.map((q: string, i: number) => (
                          <li
                            key={i}
                            className="border-l-2 border-[#cfe3ff] bg-[#f7faff] px-3 py-2 text-xs font-medium leading-relaxed text-[#0a0f3c]"
                          >
                            「{q}」
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </section>

            {(s.recruiterReport || s.candidateFeedback) && (
              <section className="mt-6 grid gap-4 lg:grid-cols-2">
                {s.recruiterReport && (
                  <div className="rounded-lg bg-white p-5 shadow-sm">
                    <p className="text-xs font-black text-[#0066ff]">採用担当者向け</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#0a0f3c]">
                      {s.recruiterReport}
                    </p>
                  </div>
                )}
                {s.candidateFeedback && (
                  <div className="rounded-lg bg-white p-5 shadow-sm">
                    <p className="text-xs font-black text-[#0066ff]">応募者向け（送付する場合）</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#0a0f3c]">
                      {s.candidateFeedback}
                    </p>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <section className="mt-4 rounded-lg bg-white p-6 shadow-sm">
            {s.turns.length === 0 ? (
              <p className="text-sm font-medium text-[#425071]">発話ログがありません。</p>
            ) : (
              s.turns.map((t: any) => (
                <p key={t.id} className="mb-2.5 text-sm leading-relaxed">
                  <span
                    className={
                      t.speaker === 'interviewer' ? 'font-black text-[#0066ff]' : 'font-black text-[#0a0f3c]'
                    }
                  >
                    {t.speaker === 'interviewer' ? '面接官' : '応募者'}:{' '}
                  </span>
                  <span className="font-medium text-[#425071]">{t.text}</span>
                </p>
              ))
            )}
          </section>
        )}
      </div>
    </main>
  )
}
