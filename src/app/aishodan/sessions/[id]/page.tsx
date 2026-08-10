'use client'

// ============================================
// ドヤAI商談 商談詳細
// ============================================
// 全文ログ・要約・ヒアリング結果・答えられなかった質問・適合判定。
// ⚠️ スコアは参考値である旨を必ず画面に出す。人が上書きできるようにする。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { SESSION_STATUS_LABELS, VERDICT_LABELS, type Verdict } from '@/lib/aishodan/types'

interface Detail {
  id: string
  guestName: string | null
  guestCompany: string | null
  guestEmail: string | null
  status: string
  startedAt: string | null
  endedAt: string | null
  schedulingClickedAt: string | null
  roomName: string
  productName: string
  turns: Array<{ id: string; speaker: string; text: string; phase: string | null }>
  slots: Array<{ key: string; label: string; required: boolean; value: string | null }>
  questions: Array<{ id: string; text: string; unanswered: boolean }>
  outcome: {
    fitScore: number
    verdict: string
    reason: string
    nextAction: string | null
    summary: any
    overriddenAt: string | null
  } | null
}

const VERDICT_STYLE: Record<string, string> = {
  hot: 'bg-rose-50 text-rose-700 ring-rose-200',
  warm: 'bg-amber-50 text-amber-700 ring-amber-200',
  cold: 'bg-slate-100 text-slate-600 ring-slate-200',
  unfit: 'bg-slate-100 text-slate-500 ring-slate-200',
}

export default function AishodanSessionDetail() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const r = await fetch(`/api/aishodan/sessions/${id}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || '読み込みに失敗しました')
      setD(j.session)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function override(verdict: Verdict) {
    if (!id) return
    setSaving(true)
    try {
      await fetch(`/api/aishodan/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict }),
      })
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><p className="text-slate-500">読み込み中...</p></div>
  }
  if (!d) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-slate-600">{error || '商談が見つかりません'}</p>
        <Link href="/aishodan/sessions" className="text-sm text-[#0066ff] underline">商談一覧に戻る</Link>
      </div>
    )
  }

  const summary = d.outcome?.summary || {}
  const conditions: Array<{ label: string; met: boolean; weight: number; note: string }> = summary.conditions || []
  const unanswered = d.questions.filter((q) => q.unanswered)

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link href="/aishodan/sessions" className="text-xs text-slate-500 hover:underline">← 商談ログ</Link>
          <h1 className="text-lg font-bold text-slate-900">
            {d.guestCompany || '会社名未取得'} {d.guestName ? `／ ${d.guestName}` : ''}
          </h1>
          <p className="text-xs text-slate-500">
            {d.productName} / {d.startedAt ? new Date(d.startedAt).toLocaleString('ja-JP') : '未実施'}
            {d.guestEmail && ` / ${d.guestEmail}`}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {/* 判定 */}
        {d.outcome ? (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-slate-500">適合スコア</p>
                <p className="text-4xl font-bold text-slate-900">{d.outcome.fitScore}</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${VERDICT_STYLE[d.outcome.verdict]}`}>
                {VERDICT_LABELS[d.outcome.verdict as Verdict]}
              </span>
              {d.outcome.overriddenAt && (
                <span className="text-xs text-slate-500">手動で上書き済み</span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{d.outcome.reason}</p>
            <p className="mt-2 text-[11px] text-slate-500">
              スコアは参考値です。実際に追いかけるかどうかはご担当者がご判断ください。
            </p>

            {conditions.length > 0 && (
              <ul className="mt-4 space-y-2">
                {conditions.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-2.5">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        c.met ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'
                      }`}
                    >
                      {c.met ? '○' : '−'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {c.label} <span className="text-xs font-normal text-slate-500">（{c.weight}点）</span>
                      </p>
                      {c.note && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{c.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* ⚠️ 一次商談の成果はここ。判定スコアより先に目に入る位置に置く。 */}
            <div className={`mt-4 rounded-xl border p-4 ${
              d.schedulingClickedAt ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'
            }`}>
              <p className={`text-sm font-semibold ${d.schedulingClickedAt ? 'text-emerald-800' : 'text-slate-700'}`}>
                {d.schedulingClickedAt
                  ? `日程調整に進みました（${new Date(d.schedulingClickedAt).toLocaleString('ja-JP')}）`
                  : '日程調整には進んでいません'}
              </p>
              {!d.schedulingClickedAt && (
                <p className="mt-1 text-xs text-slate-500">
                  予約ページを開いていないため、こちらから連絡する必要があります。
                </p>
              )}
            </div>

            {d.outcome.nextAction && (
              <div className="mt-4 rounded-xl border border-[#0066ff] bg-[#f2f6ff] p-4">
                <p className="text-xs font-semibold text-[#0066ff]">次のアクション</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-800">{d.outcome.nextAction}</p>
              </div>
            )}

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">判定を変える</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['hot', 'warm', 'cold', 'unfit'] as Verdict[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => override(v)}
                    disabled={saving || d.outcome?.verdict === v}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {VERDICT_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            この商談はまだ判定されていません（状態: {SESSION_STATUS_LABELS[d.status] || d.status}）。
          </section>
        )}

        {/* 要約 */}
        {summary.headline?.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-bold text-slate-900">要約</h2>
            <ul className="mt-3 space-y-1.5">
              {summary.headline.map((h: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="text-[#0066ff]">・</span>
                  {h}
                </li>
              ))}
            </ul>
            {summary.challenge && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500">相手の課題</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{summary.challenge}</p>
              </div>
            )}
            {summary.proposed && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500">提案した内容</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{summary.proposed}</p>
              </div>
            )}
            {summary.objections?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500">示された懸念</p>
                <ul className="mt-1 space-y-1">
                  {summary.objections.map((o: string, i: number) => (
                    <li key={i} className="text-sm text-slate-700">・{o}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ヒアリング結果 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">ヒアリング結果</h2>
          <dl className="mt-3 divide-y divide-slate-100">
            {d.slots.map((s) => (
              <div key={s.key} className="flex gap-4 py-2.5">
                <dt className="w-32 shrink-0 text-xs text-slate-500">
                  {s.label}
                  {s.required && <span className="ml-1 text-rose-500">*</span>}
                </dt>
                <dd className={`text-sm ${s.value ? 'text-slate-800' : 'text-slate-400'}`}>
                  {s.value || '聞き取れず'}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 未回答質問 */}
        {unanswered.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-bold text-slate-900">その場で答えられなかった質問</h2>
            <p className="mt-1 text-xs text-slate-500">
              資料に根拠が無く「確認して折り返す」と回答したものです。ご連絡の際にお答えください。
            </p>
            <ul className="mt-3 space-y-2">
              {unanswered.map((q) => (
                <li key={q.id} className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-800">{q.text}</li>
              ))}
            </ul>
          </section>
        )}

        {/* 全文ログ */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">全文ログ</h2>
          {d.turns.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">発話がありません。</p>
          ) : (
            <div className="mt-4 space-y-3">
              {d.turns.map((t) => (
                <div key={t.id} className={`flex gap-3 ${t.speaker === 'ai' ? '' : 'flex-row-reverse'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      t.speaker === 'ai' ? 'bg-slate-100 text-slate-800' : 'bg-[#0066ff] text-white'
                    }`}
                  >
                    {t.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
