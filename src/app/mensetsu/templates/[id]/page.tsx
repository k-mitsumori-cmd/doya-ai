'use client'

// ============================================
// ドヤ面接官 テンプレート編集（F3-5）
// ============================================
// 生成された質問セットは編集できる。構造化面接なので「主質問」は全応募者共通。
// ⚠️ 手で追加した質問も、保存時にサーバ側で就職差別チェックを通す（C3）。
//    違反があれば保存されず、該当箇所が返ってくるので画面に表示する。

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { notifyError } from '@/lib/ui/notify'

interface Branch {
  id: string
  ord: number
  label: string
  matchHint: string
  text: string | null
  skipToOrd: number | null
}
interface Question {
  id?: string
  text: string
  followUpHint: string | null
  targetMin: number
  criterionKeys: string[]
  branches?: Branch[]
}
interface Criterion {
  id: string
  key: string
  name: string
  description: string | null
  rubric: Record<string, string>
  weight: number
}
interface Violation {
  text: string
  label: string
}

export default function TemplateEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])

  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [durationMin, setDurationMin] = useState(20)
  const [status, setStatus] = useState('draft')
  const [intro, setIntro] = useState('')
  const [closing, setClosing] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [openRubric, setOpenRubric] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mensetsu/templates/${id}`)
      const json = await res.json()
      if (!res.ok) {
        notifyError(setError, json?.error || '取得できませんでした')
        return
      }
      const t = json.template
      setName(t.name || '')
      setJobTitle(t.jobTitle || '')
      setDurationMin(t.durationMin || 20)
      setStatus(t.status || 'draft')
      setIntro(t.intro || '')
      setClosing(t.closing || '')
      setQuestions(
        (t.questions || []).map((q: any) => ({
          id: q.id,
          text: q.text,
          followUpHint: q.followUpHint,
          targetMin: q.targetMin,
          criterionKeys: q.criterionKeys || [],
          branches: q.branches || [],
        }))
      )
      setCriteria(t.criteria || [])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const update = (i: number, patch: Partial<Question>) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))

  /** 分岐の編集。AIが作った枝を担当者が調整できるようにする */
  const updateBranch = (qi: number, bi: number, patch: Partial<Branch>) =>
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qi
          ? { ...q, branches: (q.branches || []).map((b, bx) => (bx === bi ? { ...b, ...patch } : b)) }
          : q
      )
    )

  const removeBranch = (qi: number, bi: number) =>
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qi ? { ...q, branches: (q.branches || []).filter((_, bx) => bx !== bi) } : q
      )
    )

  const addBranch = (qi: number) =>
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qi
          ? {
              ...q,
              branches: [
                ...(q.branches || []),
                {
                  id: `new-${Date.now()}`,
                  ord: (q.branches || []).length,
                  label: '',
                  matchHint: '',
                  text: '',
                  skipToOrd: null,
                },
              ],
            }
          : q
      )
    )

  const move = (i: number, dir: -1 | 1) =>
    setQuestions((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const remove = (i: number) => setQuestions((prev) => prev.filter((_, idx) => idx !== i))

  const add = () =>
    setQuestions((prev) => [...prev, { text: '', followUpHint: '', targetMin: 3, criterionKeys: [] }])

  const toggleKey = (i: number, key: string) =>
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === i
          ? {
              ...q,
              criterionKeys: q.criterionKeys.includes(key)
                ? q.criterionKeys.filter((k) => k !== key)
                : [...q.criterionKeys, key],
            }
          : q
      )
    )

  const save = async () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    setViolations([])
    try {
      const cleaned = questions.filter((q) => q.text.trim())
      const res = await fetch(`/api/mensetsu/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          jobTitle: jobTitle.trim(),
          durationMin,
          status,
          intro,
          closing,
          questions: cleaned.map((q) => ({
            text: q.text.trim(),
            followUpHint: q.followUpHint || '',
            targetMin: q.targetMin,
            criterionKeys: q.criterionKeys,
            branches: q.branches,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        notifyError(setError, json?.error || '保存に失敗しました')
        if (Array.isArray(json?.violations)) setViolations(json.violations)
        return
      }
      setNotice('保存しました')
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff]">
        <p className="text-sm font-bold text-[#425071]">読み込んでいます…</p>
      </main>
    )
  }

  const totalMin = questions.reduce((n, q) => n + (q.targetMin || 0), 0)

  return (
    <main className="min-h-screen bg-[#f2f6ff] px-5 py-10 lg:px-8">
      <div className="mx-auto max-w-[900px]">
        <button onClick={() => router.push('/mensetsu')} className="text-xs font-black text-[#0066ff]">
          ← ダッシュボード
        </button>
        <h1 className="mt-3 text-2xl font-black text-[#0a0f3c]">面接テンプレートの編集</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#425071]">
          主質問は<strong className="font-black text-[#0a0f3c]">全応募者に同じ内容で尋ねられます</strong>（構造化面接）。
          深掘りは面接官AIが最大2回まで、ここに書いた方針に沿って行います。
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-[#ffd0de] bg-[#fff2f6] p-4">
            <p className="text-sm font-bold text-[#c2185b]">{error}</p>
            {violations.length > 0 && (
              <ul className="mt-3 space-y-2">
                {violations.map((v, i) => (
                  <li key={i} className="rounded bg-white px-3 py-2 text-xs font-semibold text-[#0a0f3c]">
                    <span className="font-black text-[#c2185b]">{v.label}</span>
                    <span className="mt-0.5 block">{v.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {notice && (
          <div className="mt-5 rounded-lg border border-[#cfe3ff] bg-white p-4 text-sm font-bold text-[#0a0f3c]">
            {notice}
          </div>
        )}

        {/* 基本情報 */}
        <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-black text-[#0a0f3c]">基本情報</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black text-[#0a0f3c]">テンプレート名</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#0066ff]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black text-[#0a0f3c]">職種</span>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#0066ff]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black text-[#0a0f3c]">面接時間</span>
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#0066ff]"
              >
                <option value={10}>10分</option>
                <option value={20}>20分</option>
                <option value={30}>30分</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black text-[#0a0f3c]">状態</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#0066ff]"
              >
                <option value="draft">下書き</option>
                <option value="active">運用中</option>
                <option value="archived">保管</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-black text-[#0a0f3c]">冒頭のあいさつ・進め方</span>
            <span className="ml-2 text-xs font-semibold text-[#8a94ad]">
              AIであること・録音されることを必ず含めてください
            </span>
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold leading-relaxed outline-none focus:border-[#0066ff]"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-black text-[#0a0f3c]">締めの文面</span>
            <textarea
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold leading-relaxed outline-none focus:border-[#0066ff]"
            />
          </label>
        </section>

        {/* 質問 */}
        <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-black text-[#0a0f3c]">主質問（{questions.length}問）</h2>
            <span
              className={`text-xs font-bold ${totalMin > durationMin ? 'text-[#c2185b]' : 'text-[#425071]'}`}
            >
              想定合計 {totalMin}分 / 面接 {durationMin}分
              {totalMin > durationMin && '（超過分は時間切れでスキップされます）'}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="rounded-lg border border-[#eef3ff] p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0066ff] text-xs font-black text-white">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <textarea
                      value={q.text}
                      onChange={(e) => update(i, { text: e.target.value })}
                      rows={2}
                      placeholder="主質問"
                      className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-semibold leading-relaxed outline-none focus:border-[#0066ff]"
                    />
                    <input
                      value={q.followUpHint || ''}
                      onChange={(e) => update(i, { followUpHint: e.target.value })}
                      placeholder="深掘りの方針（例: 具体的な行動と、その結果の数値まで聞く）"
                      className="mt-2 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-[#0066ff]"
                    />
                    {/* 分岐（AIが自動生成。回答に応じてどの深掘りをするか） */}
                    {(!q.branches || q.branches.length === 0) && (
                      <button
                        onClick={() => addBranch(i)}
                        className="mt-2 rounded border border-dashed border-[#cfe3ff] px-3 py-1.5 text-[11px] font-black text-[#0066ff]"
                      >
                        回答による分岐を追加
                      </button>
                    )}
                    {q.branches && q.branches.length > 0 && (
                      <div className="mt-2 space-y-1.5 border-l-2 border-[#cfe3ff] pl-3">
                        <p className="text-[11px] font-black text-[#0066ff]">
                          回答による分岐（{q.branches.length}）
                          <span className="ml-2 font-semibold text-[#8a94ad]">
                            AIが自動生成したものを編集できます
                          </span>
                        </p>
                        {q.branches.map((b, bi) => (
                          <div key={b.id} className="rounded-lg bg-[#f7faff] p-3">
                            <div className="flex items-center gap-2">
                              <input
                                value={b.label}
                                onChange={(e) => updateBranch(i, bi, { label: e.target.value })}
                                placeholder="枝の名前（例: 経験あり）"
                                className="flex-1 rounded border border-[#d8e7ff] bg-white px-2 py-1 text-xs font-black text-[#0a0f3c] outline-none focus:border-[#0066ff]"
                              />
                              <select
                                value={b.skipToOrd ?? ''}
                                onChange={(e) =>
                                  updateBranch(i, bi, {
                                    skipToOrd: e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                                className="rounded border border-[#d8e7ff] bg-white px-2 py-1 text-[11px] font-bold text-[#425071] outline-none focus:border-[#0066ff]"
                                title="前提が崩れて後続が無意味になる場合のみ指定してください"
                              >
                                <option value="">飛ばさない</option>
                                {questions.map((_, qi) =>
                                  qi > i ? (
                                    <option key={qi} value={qi}>
                                      質問{qi + 1}へ
                                    </option>
                                  ) : null
                                )}
                              </select>
                              <button
                                onClick={() => removeBranch(i, bi)}
                                aria-label="この分岐を削除"
                                className="rounded border border-[#ffd0de] px-1.5 py-1 text-[#c2185b]"
                              >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                              </button>
                            </div>
                            <input
                              value={b.matchHint}
                              onChange={(e) => updateBranch(i, bi, { matchHint: e.target.value })}
                              placeholder="どんな回答ならこの枝か"
                              className="mt-1.5 w-full rounded border border-[#d8e7ff] bg-white px-2 py-1 text-[11px] font-semibold text-[#425071] outline-none focus:border-[#0066ff]"
                            />
                            <textarea
                              value={b.text || ''}
                              onChange={(e) => updateBranch(i, bi, { text: e.target.value })}
                              rows={2}
                              placeholder="この枝で尋ねる深掘り質問（空なら質問せず次へ）"
                              className="mt-1.5 w-full rounded border border-[#d8e7ff] bg-white px-2 py-1 text-xs font-semibold leading-relaxed text-[#0a0f3c] outline-none focus:border-[#0066ff]"
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => addBranch(i)}
                          className="rounded border border-dashed border-[#cfe3ff] px-3 py-1.5 text-[11px] font-black text-[#0066ff]"
                        >
                          分岐を追加
                        </button>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-[#0a0f3c]">想定</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={q.targetMin}
                          onChange={(e) => update(i, { targetMin: Number(e.target.value) })}
                          className="w-16 rounded border border-[#d8e7ff] px-2 py-1 text-xs font-semibold outline-none focus:border-[#0066ff]"
                        />
                        <span className="text-xs font-semibold text-[#425071]">分</span>
                      </label>
                      {criteria.map((c) => (
                        <button
                          key={c.key}
                          onClick={() => toggleKey(i, c.key)}
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            q.criterionKeys.includes(c.key)
                              ? 'bg-[#0066ff] text-white'
                              : 'bg-[#f2f6ff] text-[#425071]'
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label="上へ"
                      className="rounded border border-[#d8e7ff] px-2 py-1 text-[#0066ff] disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === questions.length - 1}
                      aria-label="下へ"
                      className="rounded border border-[#d8e7ff] px-2 py-1 text-[#0066ff] disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                    </button>
                    <button
                      onClick={() => remove(i)}
                      aria-label="削除"
                      className="rounded border border-[#ffd0de] px-2 py-1 text-[#c2185b]"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={add}
            className="mt-4 rounded-lg border border-[#d8e7ff] px-4 py-2.5 text-xs font-black text-[#0066ff]"
          >
            質問を追加
          </button>
        </section>

        {/* 評価軸（参照のみ） */}
        <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-base font-black text-[#0a0f3c]">評価軸とルーブリック</h2>
          <p className="mt-1 text-xs font-semibold text-[#8a94ad]">
            採点はこの基準に従って行われます。現在は参照のみです。
          </p>
          <div className="mt-4 space-y-2">
            {criteria.map((c) => (
              <div key={c.id} className="rounded-lg border border-[#eef3ff]">
                <button
                  onClick={() => setOpenRubric(openRubric === c.id ? null : c.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span>
                    <span className="text-sm font-black text-[#0a0f3c]">{c.name}</span>
                    {c.description && (
                      <span className="mt-0.5 block text-xs font-semibold text-[#425071]">{c.description}</span>
                    )}
                  </span>
                  <span className="material-symbols-outlined text-[20px] text-[#0066ff]">
                    {openRubric === c.id ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {openRubric === c.id && (
                  <dl className="border-t border-[#eef3ff] px-4 py-3">
                    {['1', '2', '3', '4', '5'].map((n) => (
                      <div key={n} className="flex gap-3 py-1.5">
                        <dt className="w-6 shrink-0 text-sm font-black text-[#0066ff]">{n}</dt>
                        <dd className="text-xs font-semibold leading-relaxed text-[#425071]">
                          {c.rubric?.[n] || '—'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="sticky bottom-4 mt-6 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[#0066ff] px-8 py-3.5 text-sm font-black text-white shadow-lg disabled:bg-[#b9cdf5]"
          >
            {saving ? '保存中…' : '保存する'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs font-semibold text-[#8a94ad]">
          <Link href="/mensetsu" className="text-[#0066ff]">
            ダッシュボードへ戻る
          </Link>
        </p>
      </div>
    </main>
  )
}
