'use client'

// ============================================
// ドヤ面接官 評価レポート（採用担当者向け）
// ============================================
// スコア・根拠引用・逐語ログを表示する。
// ⚠️ AIの判定は「推薦度」であり最終決定ではない旨を、画面上に常時明示する（C2）。

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { notifyError } from '@/lib/ui/notify'

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
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBusy, setAudioBusy] = useState(false)
  /** ラベル付け中の発話ID。⚠️ 採点基準そのものを作る操作なので、必ず評価軸を選ばせる */
  const [labeling, setLabeling] = useState<string | null>(null)
  const [labelCriterion, setLabelCriterion] = useState('')
  const [labelBusy, setLabelBusy] = useState(false)
  const [labelDone, setLabelDone] = useState<Record<string, string>>({})
  const [labelError, setLabelError] = useState('')
  /** ドヤHRへの引き渡し */
  const [hr, setHr] = useState<any>(null)
  const [hrOrgId, setHrOrgId] = useState('')
  const [hrBusy, setHrBusy] = useState(false)
  const [hrMsg, setHrMsg] = useState('')

  /**
   * 応募者の回答を「自社の採点例」として登録する（F4-3）。
   * ⚠️ ここで貯めた例は、次回以降の採点プロンプトに few-shot として入る。
   *    貯まるほど自社の基準に寄るが、誤ったラベルは以後の全ての面接を歪める。
   *    そのため評価軸を必ず選ばせ、就職差別に触れる内容はサーバ側で弾く。
   */
  const addSample = useCallback(
    async (turn: any, label: 'good' | 'bad', questionText: string) => {
      if (!labelCriterion) {
        setLabelError('評価軸を選んでください')
        return
      }
      setLabelBusy(true)
      setLabelError('')
      try {
        const r = await fetch('/api/mensetsu/samples', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            criterionKey: labelCriterion,
            questionText,
            answerText: turn.text,
            label,
          }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d?.error || '登録できませんでした')
        setLabelDone((prev) => ({ ...prev, [turn.id]: label }))
        setLabeling(null)
      } catch (e) {
        setLabelError(e instanceof Error ? e.message : '登録できませんでした')
      } finally {
        setLabelBusy(false)
      }
    },
    [labelCriterion]
  )

  // 録音URLは押されたときだけ発行する。15分で失効するため、
  // 画面表示のたびに先読みすると使う頃には切れている。
  const loadRecording = useCallback(async () => {
    setAudioBusy(true)
    try {
      const res = await fetch(`/api/mensetsu/sessions/${id}/recording`)
      const json = await res.json()
      if (res.ok && json?.url) setAudioUrl(json.url)
    } finally {
      setAudioBusy(false)
    }
  }, [id])

  const [evaluating, setEvaluating] = useState(false)

  /** この画面から直接評価を実行する（一覧に戻らせない） */
  const runEvaluate = useCallback(async () => {
    setEvaluating(true)
    setError(null)
    try {
      const res = await fetch(`/api/mensetsu/sessions/${id}/evaluate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        notifyError(setError, json?.error || '評価に失敗しました')
        return
      }
      const r = await fetch(`/api/mensetsu/sessions/${id}`)
      setData(await r.json())
    } finally {
      setEvaluating(false)
    }
  }, [id])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mensetsu/sessions/${id}`)
      const json = await res.json()
      if (!res.ok) {
        notifyError(setError, json?.error || '取得できませんでした')
        return
      }
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [id])

  // 引き渡し先の候補を読む（採用が決まった方をドヤHRの従業員として登録する）
  useEffect(() => {
    if (!id) return
    fetch(`/api/mensetsu/sessions/${id}/hr-handoff`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setHr(d)
        if (d.organizations?.[0]) setHrOrgId(d.organizations[0].id)
      })
      .catch(() => {})
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
        <p className="mt-1 text-sm font-semibold text-[#425071]">
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

        {!s.evaluatedAt && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-[#dfe6f3] bg-white p-5 shadow-sm">
            <span className="rounded-full bg-[#f1f3f4] px-4 py-1.5 text-sm font-black text-[#3c4043]">
              未評価
            </span>
            <span className="text-sm font-semibold text-[#425071]">
              逐語ログ{s.turns.length}件 / この面接はまだ採点していません
            </span>
          </div>
        )}

        {s.verdict && (
          /* ⚠️ 結果は一目で読めることが最優先。以前は判定も平均も本文と同じ
               文字サイズで並んでいて、どれが結論なのか分からなかった。 */
          <div className="mt-5 rounded-2xl bg-white p-6 shadow-sm ring-2 ring-[#d8e7ff] sm:p-8">
            <div className="flex flex-wrap items-center gap-4">
              {data.average != null && (
                <div className="rounded-2xl bg-[#f7faff] px-6 py-4">
                  <p className="text-xs font-black text-[#425071]">平均スコア</p>
                  <p className="mt-1 text-5xl font-black leading-none text-[#0066ff] sm:text-6xl">
                    {data.average}
                    <span className="ml-1 text-2xl font-black text-[#8a94ad]">/ 5</span>
                  </p>
                  <p className="mt-1.5 text-sm font-black text-[#425071]">
                    5段階中 {data.average}
                  </p>
                </div>
              )}
              <span
                className={`rounded-2xl px-6 py-4 text-2xl font-black sm:text-3xl ${VERDICT_STYLE[s.verdict] || 'bg-slate-100 text-slate-700'}`}
              >
                {VERDICT_LABEL[s.verdict] || s.verdict}
              </span>
            </div>
            <p className="mt-5 text-base font-semibold leading-relaxed text-[#425071]">{s.overallComment}</p>
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

        {/* 録音（保存されている面接のみ） */}
        {s.recordingPath && (
          <section className="mt-4 rounded-lg bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[#0a0f3c]">面接の録音</p>
                <p className="mt-0.5 text-xs font-semibold text-[#8a94ad]">
                  再生用リンクは15分で失効します。ダウンロードして共有しないでください。
                </p>
              </div>
              {!audioUrl && (
                <button
                  onClick={loadRecording}
                  disabled={audioBusy}
                  className="flex items-center gap-1.5 rounded-lg border border-[#d8e7ff] px-4 py-2 text-xs font-black text-[#0066ff] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">play_circle</span>
                  {audioBusy ? '準備中…' : '録音を再生'}
                </button>
              )}
            </div>
            {audioUrl && (
              <audio controls src={audioUrl} className="mt-3 w-full" controlsList="nodownload" />
            )}
          </section>
        )}

        {tab === 'report' && !s.evaluatedAt ? (
          // ⚠️ 未評価の面接で評価軸を「情報不足」で埋めて表示しない。
          //    まだ採点していないだけなのに、AIがそう判定したように見えてしまう。
          <section className="mt-4 rounded-lg bg-white p-8 text-center shadow-sm">
            <span className="material-symbols-outlined text-3xl text-[#8a94ad] font-medium">fact_check</span>
            <p className="mt-2 text-sm font-black text-[#0a0f3c]">まだ評価していません</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-[#425071]">
              {s.turns.length > 0
                ? `逐語ログ${s.turns.length}件をもとに評価します。数十秒かかります。`
                : '発話が記録されていないため評価できません。'}
            </p>
            {s.turns.length > 0 && (
              <button
                onClick={runEvaluate}
                disabled={evaluating}
                className="mt-4 rounded-lg bg-[#0066ff] px-6 py-2.5 text-sm font-black text-white disabled:bg-[#b9cdf5]"
              >
                {evaluating ? '評価中…' : '評価する'}
              </button>
            )}
          </section>
        ) : tab === 'report' ? (
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
                          <p className="mt-1 text-xs font-semibold text-[#425071]">{c.description}</p>
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
                      <p className="mt-3 text-sm font-semibold leading-relaxed text-[#425071]">{sc.rationale}</p>
                    )}
                    {sc?.quotes?.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {sc.quotes.map((q: string, i: number) => (
                          <li
                            key={i}
                            className="border-l-2 border-[#cfe3ff] bg-[#f7faff] px-3 py-2 text-xs font-semibold leading-relaxed text-[#0a0f3c]"
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
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#0a0f3c]">
                      {s.recruiterReport}
                    </p>
                  </div>
                )}
                {s.candidateFeedback && (
                  <div className="rounded-lg bg-white p-5 shadow-sm">
                    <p className="text-xs font-black text-[#0066ff]">応募者向け（送付する場合）</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#0a0f3c]">
                      {s.candidateFeedback}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* ドヤHRへの引き渡し。
                ⚠️ 面接AIが出すのは推薦度であって採用の決定ではない。
                   担当者が採用を決めたときだけ押す導線にしてある（自動同期はしない）。 */}
            {hr?.canHandoff && (
              <section className="mt-4 rounded-lg bg-white p-6 shadow-sm">
                <h2 className="text-base font-black text-[#0a0f3c]">採用が決まったら</h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-[#8a94ad]">
                  この方をドヤHRの従業員として登録します。AIの判定は関係なく、
                  採用をご判断されたときにお使いください。
                </p>
                {hr.alreadyHandedOff ? (
                  <p className="mt-3 text-sm font-bold text-[#137333]">ドヤHRへ登録済みです。</p>
                ) : (
                  <>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <select
                        value={hrOrgId}
                        onChange={(e) => setHrOrgId(e.target.value)}
                        className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#0066ff] font-medium"
                      >
                        {hr.organizations.map((o: any) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={async () => {
                          setHrBusy(true)
                          setHrMsg('')
                          try {
                            const r = await fetch(`/api/mensetsu/sessions/${id}/hr-handoff`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ hrOrganizationId: hrOrgId }),
                            })
                            const d = await r.json()
                            if (!r.ok) throw new Error(d?.error || '登録できませんでした')
                            setHr((prev: any) => ({ ...prev, alreadyHandedOff: true }))
                            setHrMsg('ドヤHRへ登録しました。')
                          } catch (e) {
                            setHrMsg(e instanceof Error ? e.message : '登録できませんでした')
                          } finally {
                            setHrBusy(false)
                          }
                        }}
                        disabled={hrBusy || !hrOrgId}
                        className="rounded-lg bg-[#0066ff] px-6 py-2.5 text-sm font-black text-white disabled:bg-[#b9cdf5]"
                      >
                        {hrBusy ? '登録中…' : 'ドヤHRへ登録'}
                      </button>
                    </div>
                    {hrMsg && <p className="mt-2 text-xs font-bold text-[#425071]">{hrMsg}</p>}
                    <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#8a94ad]">
                      お名前とメールアドレスのみを引き渡します。生年月日・性別は面接で
                      収集していないため登録されません。
                    </p>
                  </>
                )}
              </section>
            )}
          </>
        ) : (
          <section className="mt-4 rounded-lg bg-white p-6 shadow-sm">
            {s.turns.length === 0 ? (
              <p className="text-sm font-semibold text-[#425071]">発話ログがありません。</p>
            ) : (
              s.turns.map((t: any, i: number) => {
                // 直前の面接官の発話＝その回答が答えている質問
                const askedIdx = s.turns.slice(0, i).map((x: any) => x.speaker).lastIndexOf('interviewer')
                const questionText = askedIdx >= 0 ? s.turns[askedIdx].text : ''
                const done = labelDone[t.id]
                return (
                  <div key={t.id} className="mb-2.5">
                    <p className="text-sm leading-relaxed font-medium">
                      <span
                        className={
                          t.speaker === 'interviewer' ? 'font-black text-[#0066ff]' : 'font-black text-[#0a0f3c]'
                        }
                      >
                        {t.speaker === 'interviewer' ? '面接官' : '応募者'}:{' '}
                      </span>
                      <span className="font-semibold text-[#425071]">{t.text}</span>
                    </p>

                    {/* 応募者の回答にだけラベルを付けられる */}
                    {t.speaker === 'candidate' && (
                      done ? (
                        <p className="mt-1 text-[11px] font-bold text-[#137333]">
                          採点例に登録しました（{done === 'good' ? '良い例' : '良くない例'}）
                        </p>
                      ) : labeling === t.id ? (
                        <div className="mt-1.5 rounded-lg bg-[#f7faff] p-3">
                          <p className="text-[11px] font-bold text-[#425071]">どの評価軸の例にしますか</p>
                          <select
                            value={labelCriterion}
                            onChange={(e) => setLabelCriterion(e.target.value)}
                            className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0066ff] font-medium"
                          >
                            <option value="">選んでください</option>
                            {criteria.map((c: any) => (
                              <option key={c.key} value={c.key}>{c.name}</option>
                            ))}
                          </select>
                          {labelError && <p className="mt-1 text-[11px] font-bold text-[#c5221f]">{labelError}</p>}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              onClick={() => addSample(t, 'good', questionText)}
                              disabled={labelBusy}
                              className="rounded-lg bg-[#137333] px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
                            >
                              良い例として登録
                            </button>
                            <button
                              onClick={() => addSample(t, 'bad', questionText)}
                              disabled={labelBusy}
                              className="rounded-lg bg-[#c5221f] px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
                            >
                              良くない例として登録
                            </button>
                            <button
                              onClick={() => { setLabeling(null); setLabelError('') }}
                              className="rounded-lg border border-[#d8e7ff] px-3 py-1.5 text-xs font-bold text-[#425071]"
                            >
                              やめる
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setLabeling(t.id); setLabelError('') }}
                          className="mt-0.5 text-[11px] font-bold text-[#0066ff] hover:underline"
                        >
                          この回答を採点例にする
                        </button>
                      )
                    )}
                  </div>
                )
              })
            )}
          </section>
        )}
      </div>
    </main>
  )
}
