'use client'

// ============================================
// ドヤ広告画像AI
// ============================================
// URLを貼る → コピー候補が出る → 配置を選ぶ → 各サイズが揃った広告画像が出る
//   → ボタンひとつで改善する
// 中心的な体験は「URLだけで始まること」なので、他の入力は全て任意にする。

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Sparkles } from 'lucide-react'
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
  /** 採点のたびに増やし、key に混ぜて登場演出を再生させる */
  const [feedbackSeq, setFeedbackSeq] = useState(0)
  /** 同じサイズで何パターン作るか（1 or 3） */
  const [variations, setVariations] = useState(1)
  /** 自分で書いたプロンプト。空なら自動組み立て */
  const [customPrompt, setCustomPrompt] = useState('')
  /** 生成が完了した直後だけ出す「完成しました」 */
  const [justFinished, setJustFinished] = useState(false)
  /**
   * 改善前の画像。
   * ⚠️ 改善すると元が画面から消え、良くなったのか判断できなかった（2026-09-02）。
   *    改善後は必ず前後を並べる。
   */
  const [previousCreatives, setPreviousCreatives] = useState<Creative[]>([])
  const [previousGeneration, setPreviousGeneration] = useState<number | null>(null)
  /**
   * デザインの参考候補（ドヤバナーAIのテンプレートを流用）。
   * ⚠️ 選ばなくても生成できる。必須にすると手数が増えるだけ。
   */
  const [designRefs, setDesignRefs] = useState<Array<{ id: string; industry: string; imageUrl: string; matched: boolean }>>([])
  const [designRefId, setDesignRefId] = useState('')
  const [refsMatched, setRefsMatched] = useState(0)
  const [showAllRefs, setShowAllRefs] = useState(false)
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
  // ⚠️ ブランドが確定してから引く。業種で並べ替えるため brandId が要る
  useEffect(() => {
    if (!brandId) return
    let aborted = false
    ;(async () => {
      try {
        const r = await fetch(`/api/adimage/design-refs?brandId=${encodeURIComponent(brandId)}`)
        if (!r.ok || aborted) return
        const d = await r.json()
        if (aborted) return
        setDesignRefs(d.refs || [])
        setRefsMatched(Number(d.matchedCount) || 0)
      } catch {
        // 取れなくても生成はできる（参考なしで作る）
      }
    })()
    return () => {
      aborted = true
    }
  }, [brandId])

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
          variations,
          customPrompt: customPrompt.trim() || undefined,
          designRefId: designRefId || undefined,
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
      // 新しく作り直したので、前回との比較は消す
      setPreviousCreatives([])
      setPreviousGeneration(null)
      setJustFinished(true)
      window.setTimeout(() => setJustFinished(false), 6000)
      // サイドバーの残枚数を取り直させる（画面は移動しないので合図が要る）
      window.dispatchEvent(new Event('adimage:generated'))
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }, [appeal, brandId, chosen, copy, customPrompt, designRefId, drafts, selected, variations])

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
      setFeedbackSeq((n) => n + 1)
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
      // ⚠️ setCreatives より先に入れる。順序を逆にすると一瞬だけ前後が同じに見える
      setPreviousCreatives(d.previousCreatives || [])
      setPreviousGeneration(typeof d.previousGeneration === 'number' ? d.previousGeneration : null)
      setCreatives(d.creatives || [])
      setNeedsReview(Boolean(d.needsReview))
      setFailedPlacements(d.failedPlacements || [])
      setGeneration(d.generation)
      setScores(null)
      setAdvice('')
      setDirectives([])
      setSelectedChips([])
      setNote('')
      // 改善でも枚数は増える
      window.dispatchEvent(new Event('adimage:generated'))
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

        {/* --- デザインの参考を選ぶ ---
             ⚠️ ドヤバナーAIのテンプレート498枚をそのまま流用している。
                広告画像AI用に別のデザイン資産を作らない（二重に持たない）。 */}
        {step !== 'input' && designRefs.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-slate-900">デザインの雰囲気を選ぶ（任意）</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              ドヤバナーAIのテンプレートから、このサイトに合いそうなものを並べています。
              選ぶと、その配色・質感・レイアウトに寄せて生成します。
              {refsMatched > 0
                ? `（業種が近いもの ${refsMatched}件を先頭に表示）`
                : '（業種を絞り込めなかったため、全件を表示しています）'}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(showAllRefs ? designRefs : designRefs.slice(0, 12)).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setDesignRefId((prev) => (prev === r.id ? '' : r.id))}
                  className={`overflow-hidden rounded-xl border-2 text-left transition ${
                    designRefId === r.id
                      ? 'border-[#0066ff] ring-2 ring-[#0066ff]'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.imageUrl} alt={r.industry} loading="lazy" className="aspect-[1200/628] w-full bg-slate-100 object-cover" />
                  <span className="block truncate px-2 py-1.5 text-[10px] font-bold text-slate-600">
                    {designRefId === r.id ? '選択中 / ' : ''}
                    {r.industry}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowAllRefs((v) => !v)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
              >
                {showAllRefs ? '先頭12件だけ表示' : `すべて表示（${designRefs.length}件）`}
              </button>
              {designRefId && (
                <button
                  onClick={() => setDesignRefId('')}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  選択を解除する
                </button>
              )}
              <span className="text-xs font-bold text-slate-500">
                {designRefId ? '選んだ雰囲気に寄せて生成します' : '選ばなくても生成できます'}
              </span>
            </div>
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

            {/* ⚠️ 同じサイズで見比べたいという要望。構図を変えて3枚作る。
                 枚数の枠も3倍消費するので、その旨を明示する。 */}
            <div className="mt-5 flex flex-wrap gap-2">
              {[1, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setVariations(n)}
                  className={`rounded-xl border-2 px-5 py-3 text-sm font-black transition ${
                    variations === n
                      ? 'border-[#0066ff] bg-[#f2f6ff] text-[#0066ff]'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {n === 1 ? '1パターン' : '3パターン（構図違い）'}
                </button>
              ))}
            </div>
            {variations === 3 && (
              <p className="mt-2 text-xs font-bold text-amber-700">
                1サイズにつき3枚作ります。時間も枚数の消費も3倍になります。
              </p>
            )}

            {/* 上級者向け: プロンプトを自分で書く */}
            <details className="mt-4 rounded-xl bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-black text-slate-700">
                プロンプトを自分で書く（上級者向け）
              </summary>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">
                入力すると、こちらで組み立てているプロンプト（文字の指定・禁止事項・配置ルールを含む）を
                <strong>完全に置き換えます</strong>。文字化けや余計な文字の混入もそのまま出るのでご注意ください。
                空にすれば自動組み立てに戻ります。
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={8}
                placeholder="例: Japanese web ad banner, 1:1. …（英語でも日本語でも可）"
                className="mt-3 w-full resize-y rounded-xl border-2 border-slate-200 px-4 py-3 font-mono text-xs focus:border-[#0066ff] focus:outline-none"
              />
              {customPrompt.trim() && (
                <p className="mt-2 text-xs font-black text-amber-700">
                  自動組み立てを使わず、この内容で生成します
                </p>
              )}
            </details>

            <button
              onClick={generate}
              disabled={generating || chosen.length === 0 || !copy.headline || !copy.cta}
              className="mt-5 w-full rounded-lg bg-[#0066ff] hover:bg-[#0052cc] shadow-lg shadow-[#0066ff]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0 disabled:hover:bg-slate-200 disabled:hover:translate-y-0"
            >
              {generating
                ? '生成中...（1〜2分かかります）'
                : `広告画像を作る（${chosen.length}配置${variations > 1 ? ` × ${variations}パターン = ${chosen.length * variations}枚` : ''}）`}
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
            {justFinished && (
              <div className="animate-ai-feedback mt-4 rounded-2xl bg-[#e6f7ee] p-5 text-center ring-2 ring-[#7ddaa8]">
                <p className="text-2xl font-black text-[#0a6b3d]">完成しました</p>
                <p className="mt-1 text-sm font-bold text-[#0a6b3d]">
                  下のAIフィードバックで採点すると、直すべき点が分かります
                </p>
              </div>
            )}
            <p className="mt-4 text-xs font-semibold text-slate-500">
              画像をクリックすると原寸で開きます。入稿前に文字をご確認ください。
            </p>
            {/* 改善したときは前後を並べる。
                 ⚠️ 元が消えると、良くなったのか悪くなったのか判断できない。 */}
            {previousCreatives.length > 0 && (
              <div className="mt-4 rounded-2xl bg-[#f7faff] p-5 ring-2 ring-[#d8e7ff]">
                <p className="text-base font-black text-[#0a0f3c]">改善の前後をくらべる</p>
                <p className="mt-1 text-xs font-bold text-[#8a94ad]">
                  左が改善前{previousGeneration ? `（${previousGeneration}回目）` : ''}、右が改善後です。
                  気に入らなければ、もう一度フィードバックして直せます。
                </p>
                <div className="mt-4 space-y-5">
                  {previousCreatives.map((before) => {
                    // 同じ配置どうしで並べる。対応が無いものは出さない
                    const after = creatives.find((c) => c.placementKey === before.placementKey)
                    if (!after) return null
                    return (
                      <div key={before.placementKey}>
                        <p className="mb-2 text-xs font-black text-[#425071]">
                          {before.placementName}（{before.size}）
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: '改善前', c: before },
                            { label: '改善後', c: after },
                          ].map(({ label, c }) => (
                            <div key={label} className="overflow-hidden rounded-xl bg-white ring-1 ring-[#e3edff]">
                              <div className="flex items-center justify-between gap-2 px-3 py-1.5">
                                <span className="text-[11px] font-black text-[#425071]">{label}</span>
                                {/* 検査結果は改善後だけ出す。前のものに付けても直しようがない */}
                                {label === '改善後' && c.verify?.needsReview ? (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">要確認</span>
                                ) : label === '改善後' && c.verify?.ocrMatch ? (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">文字OK</span>
                                ) : null}
                              </div>
                              {c.url ? (
                                <a href={c.url} target="_blank" rel="noopener noreferrer" title="クリックで原寸表示">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={c.url} alt={label} className="w-full cursor-zoom-in bg-slate-100 object-contain" />
                                </a>
                              ) : (
                                <div className="flex h-32 items-center justify-center text-xs text-slate-400">読み込めません</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 text-xs font-semibold text-[#8a94ad]">
                  画像をクリックすると原寸で開きます。ダウンロードは上の「すべてダウンロード（ZIP）」からどうぞ。
                </p>
              </div>
            )}

            {/* ⚠️ 比較を出しているときは、この一覧を出さない。
                 同じ改善後の画像が下にもう一度並び、3枚に見えてしまう（2026-09-02の指摘）。 */}
            {previousCreatives.length === 0 && (
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
            )}

            {/* --- AIフィードバック ---
                 ⚠️ このサービスの中心はここ。作って終わりではなく、AIに見てもらって
                    直すのが価値なので、他のどのボタンより大きく・目立たせる。 */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <button
                onClick={runFeedback}
                disabled={scoring}
                /* ⚠️ 常時アニメーションだと、押した後に動いているのかが分からない。
                     待機中は止めて落ち着かせ、処理中だけ虹色を流す。 */
                className={`w-full rounded-2xl px-6 py-6 text-center text-xl font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.99] disabled:cursor-not-allowed disabled:hover:translate-y-0 sm:text-2xl ${
                  scoring ? 'animate-ai-button' : ''
                }`}
                style={{
                  backgroundImage: scoring
                    ? 'linear-gradient(90deg, #0066ff, #7f19e6, #ff1e72, #ffd400, #00e0ff, #0066ff)'
                    : 'linear-gradient(90deg, #0066ff, #7f19e6, #ff1e72)',
                  opacity: scoring ? 1 : undefined,
                }}
              >
                {scoring ? (
                  <span className="inline-flex items-center gap-3">
                    <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
                    AIが画像を見ています…（20〜40秒）
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-3">
                    <Sparkles className="h-7 w-7" />
                    AIフィードバックをもらう
                  </span>
                )}
              </button>
              <p className="mt-2 text-center text-xs font-bold text-slate-500">
                視認性・訴求力・行動喚起・配置適合・ブランド整合の5つで採点し、直すべき点を出します
              </p>

              {/* 採点結果。⚠️ 待たされた末に出るので、出た瞬間が分かるよう順に現れる */}
              {scores && (
                <div
                  key={feedbackSeq}
                  className="animate-ai-feedback mt-6 rounded-2xl bg-gradient-to-br from-[#f7faff] to-[#fef6ff] p-6 ring-2 ring-[#d8e7ff]"
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <p className="text-lg font-black text-[#0a0f3c]">AIの採点</p>
                    <p className="text-3xl font-black leading-none text-[#0066ff]">
                      {scores.total}
                      <span className="ml-1 text-base font-black text-[#8a94ad]">/ 5</span>
                    </p>
                  </div>

                  <div className="mt-5 space-y-3">
                    {[
                      ['視認性', scores.visibility],
                      ['訴求力', scores.appeal],
                      ['行動喚起', scores.cta],
                      ['配置適合', scores.fit],
                      ['ブランド整合', scores.brand],
                    ].map(([label, v], idx) => (
                      <div key={label as string} className="animate-ai-feedback" style={{ ['--stagger' as string]: `${idx * 70}ms` } as CSSProperties}>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-black text-[#425071]">{label}</span>
                          <span className="text-sm font-black text-[#0a0f3c]">{v} / 5</span>
                        </div>
                        <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-[#e3edff]">
                          <div
                            className="animate-score-bar h-full rounded-full"
                            style={{
                              ['--score-w' as string]: `${(Number(v) / 5) * 100}%`,
                              ['--stagger' as string]: `${idx * 70 + 120}ms`,
                              backgroundImage: 'linear-gradient(90deg, #0066ff, #00e0ff)',
                            } as CSSProperties}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {advice && (
                    <p
                      className="animate-ai-feedback mt-5 rounded-xl bg-white p-4 text-sm font-semibold leading-relaxed text-[#0a0f3c] ring-1 ring-[#e3edff]"
                      style={{ ['--stagger' as string]: '420ms' } as CSSProperties}
                    >
                      {advice}
                    </p>
                  )}

                  {directives.length > 0 && (
                    <div
                      className="animate-ai-feedback mt-4"
                      style={{ ['--stagger' as string]: '500ms' } as CSSProperties}
                    >
                      <p className="text-sm font-black text-[#425071]">直すべき点</p>
                      <ul className="mt-2 space-y-2">
                        {directives.map((d, i2) => (
                          <li key={i2} className="rounded-xl bg-white p-3 text-sm font-semibold leading-relaxed text-[#0a0f3c] ring-1 ring-[#e3edff]">
                            {d.instruction}
                            {d.reason && <span className="block text-xs font-bold text-[#8a94ad]">（{d.reason}）</span>}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs font-bold text-[#0066ff]">
                        この内容はそのまま作り直しに反映されます
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 追加の要望。⚠️ AIの指摘だけで足りるならここは触らなくてよい */}
              <details className="mt-5 rounded-xl bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-black text-slate-700">
                  自分でも直したいところを指定する（任意）
                </summary>
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
              </details>

              <button
                onClick={refine}
                disabled={refining || (selectedChips.length === 0 && !note.trim() && directives.length === 0)}
                className="mt-5 w-full rounded-2xl bg-[#0066ff] px-6 py-5 text-lg font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#0052cc] hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0 sm:text-xl"
              >
                {refining ? '作り直し中…（1〜2分かかります）' : 'この内容で作り直す'}
              </button>
              {!scores && directives.length === 0 && (
                <p className="mt-2 text-center text-xs font-bold text-slate-500">
                  先に「AIフィードバックをもらう」を押すと、指摘を反映して作り直せます
                </p>
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
