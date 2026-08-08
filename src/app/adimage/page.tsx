'use client'

// ============================================
// ドヤ広告画像AI
// ============================================
// URLを貼る → コピー候補が出る → 配置を選ぶ → 各サイズが揃った広告画像が出る
//   → ボタンひとつで改善する
// 中心的な体験は「URLだけで始まること」なので、他の入力は全て任意にする。

import { useCallback, useEffect, useState } from 'react'
import { APPEAL_LABELS, type AdCopy, type AppealAxis, type BrandProfile, type RefineDirective } from '@/lib/adimage/types'

interface PlacementRow {
  key: string
  media: string
  name: string
  size: string
  genSize: string
  note: string | null
}
interface ConceptDraft {
  label: string
  appealAxis: AppealAxis
  tone: string
  copy: AdCopy
  warnings: string[]
}
interface Creative {
  id: string
  placementKey: string
  placementName: string
  media: string
  size: string
  url: string | null
  verify: { ocrMatch?: boolean; needsReview?: boolean; extraText?: string[]; safeAreaOk?: boolean } | null
}
interface Scores {
  visibility: number
  appeal: number
  cta: number
  fit: number
  brand: number
  total: number
}

type Step = 'input' | 'concepts' | 'result'

export default function AdImagePage() {
  const [step, setStep] = useState<Step>('input')
  const [error, setError] = useState('')

  // 入力
  const [url, setUrl] = useState('')
  const [appeal, setAppeal] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  // 解析結果
  const [brandId, setBrandId] = useState('')
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [drafts, setDrafts] = useState<ConceptDraft[]>([])
  const [selected, setSelected] = useState(0)
  const [copy, setCopy] = useState<AdCopy>({ headline: '', sub: '', cta: '' })

  // 配置
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [chips, setChips] = useState<Array<{ key: string; label: string }>>([])
  const [unsupported, setUnsupported] = useState<Array<{ name: string; size: string; ratio: string }>>([])
  const [chosen, setChosen] = useState<string[]>([])

  // 生成結果
  const [generating, setGenerating] = useState(false)
  const [conceptId, setConceptId] = useState('')
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [needsReview, setNeedsReview] = useState(false)
  const [generation, setGeneration] = useState(1)

  // 改善
  const [scoring, setScoring] = useState(false)
  const [scores, setScores] = useState<Scores | null>(null)
  const [advice, setAdvice] = useState('')
  const [directives, setDirectives] = useState<RefineDirective[]>([])
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [refining, setRefining] = useState(false)

  useEffect(() => {
    fetch('/api/adimage/placements')
      .then((r) => r.json())
      .then((d) => {
        setPlacements(d.placements || [])
        setChosen(d.defaults || [])
        setChips(d.chips || [])
        setUnsupported(d.unsupported || [])
      })
      .catch(() => {})
  }, [])

  const analyze = useCallback(async () => {
    if (!url.trim()) return
    setAnalyzing(true)
    setError('')
    try {
      const r = await fetch('/api/adimage/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), appeal: appeal.trim() || undefined }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '解析に失敗しました')
      setBrandId(d.brandId)
      setBrand(d.brand)
      setDrafts(d.concepts || [])
      setSelected(0)
      if (d.concepts?.[0]) setCopy(d.concepts[0].copy)
      setStep('concepts')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }, [appeal, url])

  function pickDraft(i: number) {
    setSelected(i)
    if (drafts[i]) setCopy(drafts[i].copy)
  }

  function togglePlacement(key: string) {
    setChosen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const generate = useCallback(async () => {
    if (!brandId || chosen.length === 0) return
    setGenerating(true)
    setError('')
    setScores(null)
    setDirectives([])
    try {
      const draft = drafts[selected]
      const r = await fetch('/api/adimage/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          copy,
          placements: chosen,
          label: draft?.label,
          appealAxis: draft?.appealAxis,
          tone: draft?.tone,
          appeal: appeal.trim() || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '生成に失敗しました')
      setConceptId(d.conceptId)
      setCreatives(d.creatives || [])
      setNeedsReview(Boolean(d.needsReview))
      setGeneration(1)
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }, [appeal, brandId, chosen, copy, drafts, selected])

  const runFeedback = useCallback(async () => {
    if (!conceptId) return
    setScoring(true)
    setError('')
    try {
      const r = await fetch(`/api/adimage/concepts/${conceptId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chips: selectedChips, note: note.trim() || undefined }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '採点に失敗しました')
      setScores(d.scores)
      setAdvice(d.advice)
      setDirectives(d.directives || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '採点に失敗しました')
    } finally {
      setScoring(false)
    }
  }, [conceptId, note, selectedChips])

  const refine = useCallback(async () => {
    if (!conceptId) return
    setRefining(true)
    setError('')
    try {
      const r = await fetch(`/api/adimage/concepts/${conceptId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chips: selectedChips, note: note.trim() || undefined }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '改善に失敗しました')
      setConceptId(d.conceptId)
      setCreatives(d.creatives || [])
      setNeedsReview(Boolean(d.needsReview))
      setGeneration(d.generation)
      setScores(null)
      setAdvice('')
      setDirectives([])
      setSelectedChips([])
      setNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '改善に失敗しました')
    } finally {
      setRefining(false)
    }
  }, [conceptId, note, selectedChips])

  const byMedia = placements.reduce<Record<string, PlacementRow[]>>((acc, p) => {
    ;(acc[p.media] = acc[p.media] || []).push(p)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-lg font-bold text-slate-900">ドヤ広告画像AI</h1>
          <p className="text-xs text-slate-500">サービスURLから、媒体ごとにサイズの揃った広告画像を作ります。</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        {/* --- 1. URL入力 --- */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-bold text-slate-900">1. サービスのURLを入れる</h2>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-[#0066ff] focus:outline-none"
            />
            <button
              onClick={analyze}
              disabled={analyzing || !url.trim()}
              className="rounded-lg bg-[#0066ff] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {analyzing ? '解析中...' : 'コピーを作る'}
            </button>
          </div>
          <input
            value={appeal}
            onChange={(e) => setAppeal(e.target.value)}
            placeholder="特に伝えたいこと（任意）"
            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
          />
          {brand && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">{brand.name}</p>
              {brand.description && <p className="mt-1 text-slate-600">{brand.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {brand.colors.map((c) => (
                  <span key={c} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c }} />
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* --- 2. コピーを選ぶ --- */}
        {step !== 'input' && drafts.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-900">2. コピーを選ぶ</h2>
            <p className="mt-1 text-sm text-slate-600">
              選んだコピーは全サイズ共通で画像に描き込まれます。文字数が多いと崩れやすいため上限を設けています。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {drafts.map((d, i) => (
                <button
                  key={i}
                  onClick={() => pickDraft(i)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selected === i ? 'border-[#0066ff] bg-[#f2f6ff] ring-1 ring-[#0066ff]' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-medium text-white">
                    {APPEAL_LABELS[d.appealAxis]}
                  </span>
                  <p className="mt-2 text-base font-bold leading-snug text-slate-900">{d.copy.headline}</p>
                  <p className="mt-1 text-sm text-slate-600">{d.copy.sub}</p>
                  <p className="mt-2 inline-block rounded-lg bg-[#0066ff] px-3 py-1 text-xs font-semibold text-white">
                    {d.copy.cta}
                  </p>
                  {d.warnings.length > 0 && (
                    <p className="mt-2 text-[11px] text-amber-700">確認: {d.warnings.join(' / ')}</p>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold text-slate-500">文言を直す</p>
              <CopyField label="大見出し" limit={13} value={copy.headline} onChange={(v) => setCopy({ ...copy, headline: v })} />
              <CopyField label="サブコピー" limit={16} value={copy.sub} onChange={(v) => setCopy({ ...copy, sub: v })} />
              <CopyField label="CTA" limit={8} value={copy.cta} onChange={(v) => setCopy({ ...copy, cta: v })} />
            </div>
          </section>
        )}

        {/* --- 3. 配置を選ぶ --- */}
        {step !== 'input' && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-900">3. 出力する配置を選ぶ</h2>
            <p className="mt-1 text-sm text-slate-600">
              同じ比率の配置はまとめて作られるため、多く選んでも生成回数はあまり増えません。
            </p>
            <div className="mt-4 space-y-4">
              {Object.entries(byMedia).map(([media, rows]) => (
                <div key={media}>
                  <p className="text-xs font-semibold text-slate-500">{media}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rows.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => togglePlacement(p.key)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                          chosen.includes(p.key)
                            ? 'border-[#0066ff] bg-[#f2f6ff] text-[#0066ff]'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block font-medium">{p.name}</span>
                        <span className="block text-[10px] opacity-70">{p.size}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {unsupported.length > 0 && (
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                {unsupported.map((u) => `${u.name}（${u.size}）`).join('、')}
                は横長すぎるため現在は生成できません。Google のレスポンシブ広告に 1.91:1 / 1:1 / 4:5 を入稿すると、これらの枠にも自動で配信されます。
              </p>
            )}

            <button
              onClick={generate}
              disabled={generating || chosen.length === 0 || !copy.headline || !copy.cta}
              className="mt-5 w-full rounded-lg bg-[#0066ff] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {generating ? '生成中...（1〜2分かかります）' : `広告画像を作る（${chosen.length}配置）`}
            </button>
          </section>
        )}

        {/* --- 4. 結果 --- */}
        {step === 'result' && creatives.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                広告画像{generation > 1 && <span className="ml-2 text-xs font-normal text-slate-500">改善 {generation - 1} 回目</span>}
              </h2>
              <a
                href={`/api/adimage/concepts/${conceptId}/export`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                すべてダウンロード（ZIP）
              </a>
            </div>

            {needsReview && (
              <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                一部の画像で、指定した文字が正しく描かれたかを確認できませんでした。入稿前に文字をご確認ください。
              </p>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {creatives.map((c) => (
                <div key={c.id} className="overflow-hidden rounded-xl border border-slate-200">
                  {c.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.url} alt={c.placementName} className="w-full bg-slate-100 object-contain" />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-slate-100 text-xs text-slate-400">
                      読み込めませんでした
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-900">{c.placementName}</p>
                      <p className="text-[10px] text-slate-500">{c.media} / {c.size}</p>
                    </div>
                    {c.verify?.needsReview ? (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">要確認</span>
                    ) : c.verify?.ocrMatch ? (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">文字OK</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* 改善 */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-900">気になるところを直す</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    onClick={() =>
                      setSelectedChips((prev) => (prev.includes(c.key) ? prev.filter((k) => k !== c.key) : [...prev, c.key]))
                    }
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                      selectedChips.includes(c.key)
                        ? 'border-[#0066ff] bg-[#0066ff] text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="その他の要望（任意）"
                className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={runFeedback}
                  disabled={scoring}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  {scoring ? '採点中...' : 'AIに見てもらう'}
                </button>
                <button
                  onClick={refine}
                  disabled={refining || (selectedChips.length === 0 && !note.trim() && directives.length === 0)}
                  className="rounded-lg bg-[#0066ff] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {refining ? '作り直し中...' : 'この内容で作り直す'}
                </button>
              </div>

              {scores && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <ScoreItem label="視認性" v={scores.visibility} />
                    <ScoreItem label="訴求力" v={scores.appeal} />
                    <ScoreItem label="行動喚起" v={scores.cta} />
                    <ScoreItem label="配置適合" v={scores.fit} />
                    <ScoreItem label="ブランド" v={scores.brand} />
                  </div>
                  {advice && <p className="mt-3 text-sm leading-relaxed text-slate-700">{advice}</p>}
                  {directives.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {directives.map((d, i) => (
                        <li key={i} className="text-xs leading-relaxed text-slate-600">
                          <span className="font-semibold text-slate-800">改善案: </span>
                          {d.instruction}
                          {d.reason && <span className="text-slate-500">（{d.reason}）</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function CopyField({
  label, limit, value, onChange,
}: {
  label: string
  limit: number
  value: string
  onChange: (v: string) => void
}) {
  const over = value.length > limit
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-500">{label}</span>
        <span className={over ? 'text-rose-600' : 'text-slate-400'}>
          {value.length} / {limit}
        </span>
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none ${
          over ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-[#0066ff]'
        }`}
      />
      {over && <span className="mt-1 block text-[11px] text-rose-600">上限を超えた分は自動で短くされます。</span>}
    </label>
  )
}

function ScoreItem({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">
        {v}
        <span className="text-xs font-normal text-slate-400"> / 5</span>
      </p>
    </div>
  )
}
