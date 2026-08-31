'use client'

// ============================================
// ドヤ広告画像AI
// ============================================
// URLを貼る → コピー候補が出る → 配置を選ぶ → 各サイズが揃った広告画像が出る
//   → ボタンひとつで改善する
// 中心的な体験は「URLだけで始まること」なので、他の入力は全て任意にする。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { APPEAL_LABELS, type AdCopy, type AppealAxis, type BrandProfile, type RefineDirective } from '@/lib/adimage/types'
import AdImageLp from './Lp'
import { notifyError } from '@/lib/ui/notify'
import LoadingProgress from '@/components/LoadingProgress'

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

export default function AdImageTool() {
  const [step, setStep] = useState<Step>('input')
  const [error, setError] = useState('')

  // 入力
  /**
   * 入力したサービスURL。
   * ⚠️ 履歴画面へ移動して戻るとコンポーネントが作り直され、入力が消えていた。
   *    打ち直させるのは無駄なので sessionStorage に持たせる。
   *    タブを閉じれば消える（localStorage にはしない。他人の端末に残さない）。
   */
  const [url, setUrl] = useState('')
  const [appeal, setAppeal] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  // 解析結果
  const [brandId, setBrandId] = useState('')
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [drafts, setDrafts] = useState<ConceptDraft[]>([])
  const [selected, setSelected] = useState(0)
  const [copy, setCopy] = useState<AdCopy>({ headline: '', sub: '', cta: '' })

  // ロゴ（本サービスで唯一「合成」する要素）
  const [logoPos, setLogoPos] = useState('bottom-right')
  const [logoName, setLogoName] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)

  // 配置
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [chips, setChips] = useState<Array<{ key: string; label: string }>>([])
  const [unsupported, setUnsupported] = useState<Array<{ name: string; size: string; ratio: string }>>([])
  /**
   * 出力する配置。
   * ⚠️ 既定は1枚だけ。多く選ぶほど生成に時間がかかるので、
   *    increase は利用者が明示的に選んだぶんだけにする。
   */
  const [chosen, setChosen] = useState<string[]>([])

  // 生成結果
  const [generating, setGenerating] = useState(false)
  const [conceptId, setConceptId] = useState('')
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [needsReview, setNeedsReview] = useState(false)
  /** 生成できなかった配置。⚠️ 黙って短い結果を出さないための表示 */
  const [failedPlacements, setFailedPlacements] = useState<string[]>([])
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
        // ⚠️ 既定は1枚。サーバの defaults をそのまま入れると複数枚が最初から
        //    選ばれた状態になり、初回から生成が長くかかる
        setChosen((d.defaults || []).slice(0, 1))
        setChips(d.chips || [])
        setUnsupported(d.unsupported || [])
      })
      .catch(() => {})
  }, [])

  /** 未ログインを検知したらログイン画面へ促す（APIが401を返す） */
  const [needsLogin, setNeedsLogin] = useState(false)

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
      if (r.status === 401) {
        setNeedsLogin(true)
        return
      }
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '解析に失敗しました')
      setBrandId(d.brandId)
      setBrand(d.brand)
      setDrafts(d.concepts || [])
      setSelected(0)
      if (d.concepts?.[0]) setCopy(d.concepts[0].copy)
      setStep('concepts')
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '解析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }, [appeal, url])

  async function uploadLogo(file: File) {
    if (!brandId) return
    setLogoBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('pos', logoPos)
      const r = await fetch(`/api/adimage/brands/${brandId}/logo`, { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'ロゴを登録できませんでした')
      setLogoName(file.name)
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : 'ロゴを登録できませんでした')
    } finally {
      setLogoBusy(false)
    }
  }

  async function removeLogo() {
    if (!brandId) return
    setLogoBusy(true)
    try {
      await fetch(`/api/adimage/brands/${brandId}/logo`, { method: 'DELETE' })
      setLogoName('')
    } finally {
      setLogoBusy(false)
    }
  }

  function pickDraft(i: number) {
    setSelected(i)
    if (drafts[i]) setCopy(drafts[i].copy)
  }

  const URL_KEY = 'adimage:url'
  // 復元は初回だけ
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(URL_KEY)
      if (saved) setUrl(saved)
    } catch {
      // プライベートモード等で読めなくても動作に影響は無い
    }
  }, [])
  useEffect(() => {
    try {
      if (url) sessionStorage.setItem(URL_KEY, url)
      else sessionStorage.removeItem(URL_KEY)
    } catch {
      /* ignore */
    }
  }, [url])

  /** 一度に出せる配置の上限。⚠️ 増やすと maxDuration(300秒) に収まらなくなる */
  const MAX_PLACEMENTS = 10

  function togglePlacement(key: string) {
    setChosen((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      if (prev.length >= MAX_PLACEMENTS) {
        notifyError(setError, `一度に選べるのは${MAX_PLACEMENTS}枚までです`)
        return prev
      }
      return [...prev, key]
    })
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
      setFailedPlacements(d.failedPlacements || [])
      setGeneration(1)
      setStep('result')
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '生成に失敗しました')
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
      notifyError(setError, e instanceof Error ? e.message : '採点に失敗しました')
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
      setFailedPlacements(d.failedPlacements || [])
      setGeneration(d.generation)
      setScores(null)
      setAdvice('')
      setDirectives([])
      setSelectedChips([])
      setNote('')
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '改善に失敗しました')
    } finally {
      setRefining(false)
    }
  }, [conceptId, note, selectedChips])

  const byMedia = placements.reduce<Record<string, PlacementRow[]>>((acc, p) => {
    ;(acc[p.media] = acc[p.media] || []).push(p)
    return acc
  }, {})

  // ⚠️ 未ログインの方にはLPを見せる。以前は「ログインが必要です」の小さな箱だけで、
  //    何をするサービスなのか説明する面がどこにも無かった。
  if (needsLogin) {
    return <AdImageLp />
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* ⚠️ AI処理中は全画面で「何をしているか」を出す。無言で待たせない */}
      <LoadingProgress
        isLoading={analyzing}
        operationKey="adimage-analyzing"
        title="ブランドを読み取っています"
        subtitle="サービスページから訴求のトーンとコピー案を組み立てています。"
        tips={['Tip: ロゴを登録すると画像に合成できます', 'Tip: 配置を多く選んでも1コンセプトとして数えます', 'Tip: 気に入らなければAIが採点して作り直します']}
      />
      <LoadingProgress
        isLoading={generating}
        operationKey="adimage-generating"
        title="広告画像を生成しています"
        subtitle="媒体ごとの実寸で、文字を画像に描き込んでいます。"
        tips={['Tip: 目標比率のまま生成するので文字が切れません', 'Tip: 描かれた文字は自動で検査され、不合格なら作り直します', 'Tip: 媒体別に整理したZIPでまとめて落とせます']}
      />
      <LoadingProgress
        isLoading={refining}
        operationKey="adimage-refining"
        title="改善版を作っています"
        subtitle="AIが出来上がった画像を見て採点し、次の案に反映しています。"
        tips={['Tip: 気になる点をチップで選ぶほど狙いが伝わります', 'Tip: 改善のたびに履歴として残ります']}
      />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">ドヤ広告画像AI</h1>
            <p className="text-xs text-slate-500 font-semibold">サービスURLから、媒体ごとにサイズの揃った広告画像を作ります。</p>
          </div>
          {/* ⚠️ 履歴への導線をここに置くこと。無いと作った画像を見返す手段が
               画面から消え、実装済みの一覧APIが誰にも使われないまま残る */}
          <Link
            href="/adimage/history"
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            これまでの画像
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-semibold">{error}</div>}

        {/* ⚠️ 2〜4のセクションは入力が進むまで描画されない。この行が無いと
             初回は「1.」だけの画面になり、全部で何工程あるのか分からなくなる。 */}
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-slate-400">
          {['サービスのURLを入れる', 'コピーを選ぶ', '出力する配置を選ぶ', '受け取る'].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className={i === 0 || (i === 1 && !!brand) || (i === 2 && drafts.length > 0) || (i === 3 && creatives.length > 0) ? 'text-[#0066ff]' : ''}>
                {i + 1}. {label}
              </span>
              {i < 3 && <span aria-hidden="true">›</span>}
            </li>
          ))}
        </ol>

        {/* --- 1. URL入力 --- */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-bold text-slate-900">1. サービスのURLを入れる</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            ページを読み取って、広告のコピー案を作ります。このあと配置を選ぶと、媒体ごとの入稿サイズで画像が揃います。
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
            />
            <button
              onClick={analyze}
              disabled={analyzing || !url.trim()}
              className="rounded-lg bg-[#0066ff] hover:bg-[#0052cc] shadow-lg shadow-[#0066ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
            >
              {analyzing ? '読み取り中...' : '広告コピーを作る'}
            </button>
          </div>
          <input
            value={appeal}
            onChange={(e) => setAppeal(e.target.value)}
            placeholder="特に伝えたいこと（任意）"
            className="mt-2 w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
          />
          {brand && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold">
              <p className="font-semibold text-slate-900">{brand.name}</p>
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
            <p className="mt-1 text-sm text-slate-600 font-semibold">
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
                  <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                    {APPEAL_LABELS[d.appealAxis]}
                  </span>
                  <p className="mt-2 text-base font-bold leading-snug text-slate-900">{d.copy.headline}</p>
                  <p className="mt-1 text-sm text-slate-600 font-semibold">{d.copy.sub}</p>
                  <p className="mt-2 inline-block rounded-lg bg-[#0066ff] px-3 py-1 text-xs font-bold text-white">
                    {d.copy.cta}
                  </p>
                  {d.warnings.length > 0 && (
                    <p className="mt-2 text-[11px] text-amber-700">確認: {d.warnings.join(' / ')}</p>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-bold text-slate-500">文言を直す</p>
              <CopyField label="大見出し" limit={13} value={copy.headline} onChange={(v) => setCopy({ ...copy, headline: v })} />
              <CopyField label="サブコピー" limit={16} value={copy.sub} onChange={(v) => setCopy({ ...copy, sub: v })} />
              <CopyField label="CTA" limit={8} value={copy.cta} onChange={(v) => setCopy({ ...copy, cta: v })} />
            </div>
          </section>
        )}

        {/* --- ロゴ（任意） --- */}
        {step !== 'input' && brandId && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-900">ロゴを載せる（任意）</h2>
            <p className="mt-1 text-sm text-slate-600 font-semibold">
              ロゴだけは生成AIに描かせず、実際の画像を重ねます。形や色が変わってしまうためです。
              SNS広告は配信時にアカウント名が出るので、載せなくても成立します。
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm font-semibold">
                <span className="mb-1 block text-xs font-bold text-slate-500">ロゴ画像（3MBまで）</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={logoBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadLogo(f)
                  }}
                  className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:text-slate-700 font-semibold"
                />
              </label>
              <label className="text-sm font-semibold">
                <span className="mb-1 block text-xs font-bold text-slate-500">置く位置</span>
                <select
                  value={logoPos}
                  onChange={(e) => setLogoPos(e.target.value)}
                  className="rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
                >
                  <option value="bottom-right">右下</option>
                  <option value="bottom-left">左下</option>
                  <option value="top-right">右上</option>
                  <option value="top-left">左上</option>
                  <option value="center-top">上部中央</option>
                </select>
              </label>
              {logoName && (
                <button
                  onClick={removeLogo}
                  disabled={logoBusy}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0 font-semibold"
                >
                  ロゴを外す
                </button>
              )}
            </div>
            {logoName && (
              <p className="mt-2 text-xs text-emerald-700 font-semibold">
                {logoName} を登録しました。位置を変えたときは、もう一度ロゴを選び直してください。
              </p>
            )}
          </section>
        )}

        {/* --- 3. 配置を選ぶ --- */}
        {step !== 'input' && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-900">3. 出力する配置を選ぶ</h2>
            <p className="mt-1 text-sm text-slate-600 font-semibold">
              同じ比率の配置はまとめて作られます。
            </p>
            <p className="mt-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
              ⚠️ 枚数が多ければ多いほど時間がかかります（1枚あたり40〜90秒）。まずは1枚でお試しください。
            </p>
            <p className="mt-2 text-xs font-bold text-slate-500">
              選択中 {chosen.length} / {MAX_PLACEMENTS}枚（上限）
            </p>
            <div className="mt-4 space-y-4">
              {Object.entries(byMedia).map(([media, rows]) => (
                <div key={media}>
                  <p className="text-xs font-bold text-slate-500">{media}</p>
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
                        <span className="block font-semibold">{p.name}</span>
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
              className="mt-5 w-full rounded-lg bg-[#0066ff] hover:bg-[#0052cc] shadow-lg shadow-[#0066ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
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
                広告画像{generation > 1 && <span className="ml-2 text-xs font-normal text-slate-500 font-semibold">改善 {generation - 1} 回目</span>}
              </h2>
              <a
                href={`/api/adimage/concepts/${conceptId}/export`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold"
              >
                すべてダウンロード（ZIP）
              </a>
            </div>

            {failedPlacements.length > 0 && (
              <p className="mt-3 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-800 font-semibold">
                次の配置は作成できませんでした: {failedPlacements.join('、')}。
                お手数ですが、もう一度お試しください。
              </p>
            )}

            {needsReview && (
              <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-900 font-semibold">
                一部の画像で、指定した文字が正しく描かれたかを確認できませんでした。入稿前に文字をご確認ください。
              </p>
            )}

            {/* ⚠️ 3列だと1枚320px程度にしかならず、焼き込んだ文字が読めない。
                 入稿前に文字を確認する画面なので2列までにし、押せば原寸で開くようにする。 */}
            <p className="mt-4 text-xs font-semibold text-slate-500">
              画像をクリックすると原寸で開きます。入稿前に文字をご確認ください。
            </p>
            <div className="mt-2 grid gap-5 sm:grid-cols-2">
              {creatives.map((c) => (
                <div key={c.id} className="overflow-hidden rounded-xl border border-slate-200">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" title="クリックで原寸表示">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.url} alt={c.placementName} className="w-full cursor-zoom-in bg-slate-100 object-contain" />
                    </a>
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-slate-100 text-xs text-slate-400 font-semibold">
                      読み込めませんでした
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">{c.placementName}</p>
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
                className="mt-3 w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none font-semibold"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={runFeedback}
                  disabled={scoring}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0 font-semibold"
                >
                  {scoring ? '採点中...' : 'AIに見てもらう'}
                </button>
                <button
                  onClick={refine}
                  disabled={refining || (selectedChips.length === 0 && !note.trim() && directives.length === 0)}
                  className="rounded-lg bg-[#0066ff] hover:bg-[#0052cc] shadow-lg shadow-[#0066ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
                >
                  {refining ? '作り直し中...' : 'この内容で作り直す'}
                </button>
              </div>

              {scores && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="flex flex-wrap gap-4 text-sm font-semibold">
                    <ScoreItem label="視認性" v={scores.visibility} />
                    <ScoreItem label="訴求力" v={scores.appeal} />
                    <ScoreItem label="行動喚起" v={scores.cta} />
                    <ScoreItem label="配置適合" v={scores.fit} />
                    <ScoreItem label="ブランド" v={scores.brand} />
                  </div>
                  {advice && <p className="mt-3 text-sm leading-relaxed text-slate-700 font-semibold">{advice}</p>}
                  {directives.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {directives.map((d, i) => (
                        <li key={i} className="text-xs leading-relaxed text-slate-600 font-semibold">
                          <span className="font-bold text-slate-800">改善案: </span>
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
      <span className="mb-1 flex items-baseline justify-between text-xs font-semibold">
        <span className="font-bold text-slate-500">{label}</span>
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
        <span className="text-xs font-normal text-slate-400 font-semibold"> / 5</span>
      </p>
    </div>
  )
}
