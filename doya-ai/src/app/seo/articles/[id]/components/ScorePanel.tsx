'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TrendingUp, AlertTriangle, CheckCircle2, Zap, ThumbsUp, Wrench, Loader2, Activity, ScanSearch, ListChecks, Sparkles, Brain, PenTool, RefreshCw } from 'lucide-react'

type ScorePanelProps = {
  articleId: string
  article: {
    finalMarkdown?: string | null
    targetChars?: number
    keywords?: string[]
    checkResults?: any
  }
  onUpdated?: () => void
  onGoEdit?: () => void
  onGoOutline?: () => void
}

type Improvement = {
  id: 'ADD_TLDR' | 'ADD_FAQ' | 'ADD_CONCLUSION' | 'ADD_GLOSSARY' | 'OPEN_EDIT'
  title: string
  detail: string
  kind: 'quick' | 'manual'
}

function isHeadingRelated(title: string) {
  return /H2|H3|見出し|章立て/.test(title)
}

function useCountUp(target: number, durationMs: number, enabled: boolean) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const lastTargetRef = useRef<number>(target)

  useEffect(() => {
    if (!enabled) {
      setValue(target)
      lastTargetRef.current = target
      return
    }
    // targetが変わったら0から再カウント（見た目の期待感を作る）
    if (lastTargetRef.current !== target) {
      setValue(0)
      lastTargetRef.current = target
    }
    startRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts
      const t = Math.min(1, (ts - startRef.current) / Math.max(1, durationMs))
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs, enabled])

  return value
}

export function ScorePanel({ articleId, article, onUpdated, onGoEdit, onGoOutline }: ScorePanelProps) {
  const [selected, setSelected] = useState<Improvement | null>(null)
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [needTarget, setNeedTarget] = useState<null | { headings: string[] }>(null)
  const [targetHeading, setTargetHeading] = useState<string>('')
  const [analyzing, setAnalyzing] = useState(true)
  const [phase, setPhase] = useState(0)
  const [applyPhase, setApplyPhase] = useState(0)
  const [applyPhaseText, setApplyPhaseText] = useState('')

  // 自動修正中のフェーズ進行
  useEffect(() => {
    if (!applying) {
      setApplyPhase(0)
      setApplyPhaseText('')
      return
    }
    const phases = [
      { text: '記事を解析中...', duration: 1500 },
      { text: '改善ポイントを特定中...', duration: 2000 },
      { text: 'AIが文章を修正中...', duration: 3000 },
      { text: '最適化を適用中...', duration: 2500 },
      { text: '最終チェック中...', duration: 2000 },
    ]
    let idx = 0
    setApplyPhase(0)
    setApplyPhaseText(phases[0].text)
    
    const advance = () => {
      idx++
      if (idx < phases.length) {
        setApplyPhase(idx)
        setApplyPhaseText(phases[idx].text)
      }
    }
    
    let timeout: NodeJS.Timeout
    const scheduleNext = (i: number) => {
      if (i >= phases.length - 1) return
      timeout = setTimeout(() => {
        advance()
        scheduleNext(i + 1)
      }, phases[i].duration)
    }
    scheduleNext(0)
    
    return () => clearTimeout(timeout)
  }, [applying])

  const analysis = useMemo(() => {
    const content = article.finalMarkdown || ''
    const charCount = content.length
    const targetChars = article.targetChars || 10000

    // 見出し数をカウント
    const h2Count = (content.match(/^##\s+/gm) || []).length
    const h3Count = (content.match(/^###\s+/gm) || []).length
    const hasFaq = /よくある質問|FAQ/i.test(content)
    const hasConclusion = /(^##\s*まとめ\s*$)|(^##\s*結論\s*$)/m.test(content) || content.includes('まとめ')
    const hasGlossary = /(^##\s*用語集\s*$)/m.test(content) || content.includes('用語集')
    const hasTldr = /(^##\s*結論（先に）\s*$)|(^##\s*結論\s*$)|(^##\s*TL;DR\s*$)/m.test(content)

    // スコア計算（簡易版）
    let score = 50

    // 文字数スコア（目標の80%〜120%が理想）
    const charRatio = charCount / targetChars
    if (charRatio >= 0.8 && charRatio <= 1.2) score += 15
    else if (charRatio >= 0.6 && charRatio <= 1.4) score += 8

    // 見出し数スコア
    if (h2Count >= 5) score += 10
    if (h3Count >= 8) score += 10

    // キーワード含有率
    const keywords = article.keywords || []
    const keywordHits = keywords.filter((kw) => content.toLowerCase().includes(kw.toLowerCase())).length
    const keywordScore = keywords.length > 0 ? Math.round((keywordHits / keywords.length) * 15) : 10
    score += keywordScore

    // 上限100
    score = Math.min(100, score)

    // 良い点 / 改善点（UI用）
    const good: Array<{ title: string; detail: string }> = []
    const improvements: Improvement[] = []

    // charRatio は上で定義済み
    if (charRatio >= 0.8 && charRatio <= 1.2) {
      good.push({ title: '文字数が狙い通り', detail: '目標の80〜120%に収まっています（SEO的に安定）。' })
    } else if (charRatio >= 0.6 && charRatio <= 1.4) {
      good.push({ title: '文字数は概ねOK', detail: '目標から少しズレていますが許容範囲です。' })
    } else {
      improvements.push({
        id: 'OPEN_EDIT',
        kind: 'manual',
        title: '文字数を調整',
        detail: '目標の80〜120%を目安に加筆/削減するとスコアが安定します（本文編集で対応）。',
      })
    }

    if (h2Count >= 5) good.push({ title: 'H2構成がある', detail: `H2が${h2Count}個。章立ての骨格ができています。` })
    else improvements.push({ id: 'OPEN_EDIT', kind: 'manual', title: '章立て（H2）を増やす', detail: '網羅性を上げるため、H2を最低5つ以上に。' })

    if (h3Count >= 8) good.push({ title: 'H3で深掘りできている', detail: `H3が${h3Count}個。比較軸や手順が伝わりやすい状態です。` })
    else improvements.push({ id: 'OPEN_EDIT', kind: 'manual', title: 'H3を追加して具体化', detail: '各H2の下にH3（具体例/手順/注意点）を入れると読みやすくなります。' })

    // keywords, keywordHits は上で定義済み
    if (keywords.length === 0) {
      good.push({ title: 'キーワード設定', detail: 'キーワードが設定されています（入力側で設定）。' })
    } else if (keywordHits >= Math.max(1, Math.ceil(keywords.length * 0.6))) {
      good.push({ title: 'キーワードの網羅', detail: `${keywordHits}/${keywords.length}のキーワードが本文に含まれています。` })
    } else {
      improvements.push({ id: 'OPEN_EDIT', kind: 'manual', title: 'キーワードを自然に追加', detail: '見出しや導入・まとめに自然に含めると評価が上がりやすいです。' })
    }

    if (hasTldr) good.push({ title: '結論が先に読める', detail: '読者が迷子になりにくい構造です。' })
    else improvements.push({ id: 'ADD_TLDR', kind: 'quick', title: '結論（先に）を追加', detail: '冒頭に「結論（先に）」を差し込みます（自動修正）。' })

    if (hasFaq) good.push({ title: 'FAQがある', detail: '検索意図の取りこぼしを防げます。' })
    else improvements.push({ id: 'ADD_FAQ', kind: 'quick', title: 'FAQを追加', detail: '末尾に「よくある質問（FAQ）」を追加します（自動修正）。' })

    if (hasConclusion) good.push({ title: 'まとめがある', detail: '行動導線の締めができています。' })
    else improvements.push({ id: 'ADD_CONCLUSION', kind: 'quick', title: 'まとめを追加', detail: '末尾に「まとめ」セクションを追加します（自動修正）。' })

    if (hasGlossary) good.push({ title: '用語の補助がある', detail: '初心者にも優しい設計です。' })
    else improvements.push({ id: 'ADD_GLOSSARY', kind: 'quick', title: '用語集を追加', detail: '末尾に「用語集」を追加します（自動修正）。' })

    return {
      score,
      charCount,
      targetChars,
      h2Count,
      h3Count,
      good,
      improvements,
    }
  }, [article])

  const goodCount = useMemo(() => analysis.good.length, [analysis.good.length])
  const improveCount = useMemo(() => analysis.improvements.length, [analysis.improvements.length])

  const scoreColor = useMemo(() => {
    if (analysis.score >= 80) return 'text-emerald-600'
    if (analysis.score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }, [analysis.score])

  const scoreBg = useMemo(() => {
    if (analysis.score >= 80) return 'from-emerald-50 to-emerald-100/50'
    if (analysis.score >= 60) return 'from-yellow-50 to-yellow-100/50'
    return 'from-red-50 to-red-100/50'
  }, [analysis.score])

  // 「めっちゃ分析してそう」演出（タブを開いた直後に短い解析アニメを見せる）
  useEffect(() => {
    // reduce motion が好みのユーザーは演出を短くする
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const totalMs = prefersReduced ? 350 : 1200
    const steps = 4
    setAnalyzing(true)
    setPhase(0)

    const t0 = window.setInterval(() => {
      setPhase((p) => Math.min(steps, p + 1))
    }, Math.max(120, Math.floor(totalMs / steps)))

    const t1 = window.setTimeout(() => {
      setAnalyzing(false)
      setPhase(steps)
    }, totalMs)

    return () => {
      window.clearInterval(t0)
      window.clearTimeout(t1)
    }
  }, [])

  const scoreCount = useCountUp(analysis.score, 900, !analyzing)
  const charCount = useCountUp(analysis.charCount, 950, !analyzing)
  const h2Count = useCountUp(analysis.h2Count, 850, !analyzing)
  const h3Count = useCountUp(analysis.h3Count, 850, !analyzing)
  const goodCountUp = useCountUp(goodCount, 900, !analyzing)
  const improveCountUp = useCountUp(improveCount, 900, !analyzing)

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {analyzing ? (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-5 rounded-3xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ScanSearch className="w-5 h-5 text-blue-600" />
                <p className="text-sm font-black text-gray-900">SEOスコアを分析中…</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-black text-gray-500">
                <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                動いています
              </div>
            </div>

            <div className="mt-4">
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (phase / 4) * 100)}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-gray-500">
                <span>構造/網羅性/読みやすさ</span>
                <span>{Math.round(Math.min(100, (phase / 4) * 100))}%</span>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-white border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="w-4 h-4 text-indigo-600" />
                <p className="text-xs font-black text-gray-700 uppercase tracking-widest">解析ステップ</p>
              </div>
              <div className="space-y-2">
                {[
                  '本文の構造を解析',
                  '見出し設計（H2/H3）を評価',
                  'キーワードの自然な含有を確認',
                  '改善ポイントを抽出',
                ].map((label, i) => {
                  const done = phase >= i + 1
                  const active = !done && phase === i
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                          done ? 'bg-emerald-50 border-emerald-200' : active ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Loader2 className={`w-4 h-4 ${active ? 'text-blue-600 animate-spin' : 'text-gray-400'}`} />
                        )}
                      </div>
                      <p className={`text-sm font-black ${done ? 'text-gray-900' : active ? 'text-blue-700' : 'text-gray-500'}`}>
                        {label}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="mt-3 text-[11px] font-bold text-gray-500 leading-relaxed">
              いま“伸びしろ”を抽出しています。結果が出たら <span className="text-gray-900">改善の打ち手</span> がすぐ分かります。
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
      {/* スコア */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-5 rounded-2xl bg-gradient-to-br ${scoreBg} border border-gray-100`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-5 h-5 ${scoreColor}`} />
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">SEOスコア</span>
          </div>
          <div className={`text-3xl font-black ${scoreColor}`}>
            {scoreCount}
            <span className="text-sm text-gray-400">/100</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 text-center">
          <div className="p-2 rounded-xl bg-white/60">
            <p className="text-lg font-black text-gray-900 tabular-nums">{charCount.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 font-bold">文字数</p>
          </div>
          <div className="p-2 rounded-xl bg-white/60">
            <p className="text-lg font-black text-gray-900 tabular-nums">{h2Count}</p>
            <p className="text-[10px] text-gray-500 font-bold">H2見出し</p>
          </div>
          <div className="p-2 rounded-xl bg-white/60">
            <p className="text-lg font-black text-gray-900 tabular-nums">{h3Count}</p>
            <p className="text-[10px] text-gray-500 font-bold">H3見出し</p>
          </div>
          <div className="p-2 rounded-xl bg-white/60">
            <p className="text-lg font-black text-emerald-700 tabular-nums">{goodCountUp}</p>
            <p className="text-[10px] text-gray-500 font-bold">Good</p>
          </div>
          <div className="p-2 rounded-xl bg-white/60">
            <p className="text-lg font-black text-amber-700 tabular-nums">{improveCountUp}</p>
            <p className="text-[10px] text-gray-500 font-bold">改善</p>
          </div>
        </div>
      </motion.div>

      {/* 良い点 / 改善点 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
          <div className="flex items-center gap-2 mb-3">
            <ThumbsUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Good（うまくいってる）</span>
            <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full bg-white/80 border border-emerald-200 text-emerald-800 tabular-nums">
              {goodCountUp}件
            </span>
          </div>
          <div className="space-y-2">
            {(analysis.good.length ? analysis.good : [{ title: 'ベースはOK', detail: '大枠は整っています。あとは改善点を潰すだけです。' }]).map((g, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/70 border border-emerald-100">
                <p className="text-sm font-black text-emerald-900">{g.title}</p>
                <p className="text-[11px] font-bold text-emerald-800/80 mt-1 leading-relaxed">{g.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-black text-amber-800 uppercase tracking-widest">改善できる（伸びしろ）</span>
            <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full bg-white/80 border border-amber-200 text-amber-900 tabular-nums">
              {improveCountUp}件
            </span>
          </div>
          <div className="space-y-2">
            {(analysis.improvements.length ? analysis.improvements : []).map((it) => {
              const active = selected?.id === it.id && selected?.title === it.title
              return (
                <button
                  key={`${it.id}_${it.title}`}
                  disabled={applying}
                  onClick={() => {
                    setSelected(it)
                    setApplyError(null)
                    setNeedTarget(null)
                    setTargetHeading('')
                    setMode(it.kind === 'manual' ? 'manual' : 'auto')
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    active ? 'bg-white border-amber-300 shadow-sm' : 'bg-white/60 border-amber-100 hover:bg-white hover:border-amber-200'
                  } disabled:opacity-70 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-amber-900">{it.title}</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      'bg-white text-gray-700 border border-gray-200'
                    }`}>
                      手動/自動どちらも可
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-amber-900/70 mt-1 leading-relaxed">{it.detail}</p>
                </button>
              )
            })}
            {analysis.improvements.length === 0 && (
              <div className="p-3 rounded-xl bg-white/70 border border-amber-100">
                <p className="text-sm font-black text-amber-900">改善点は見当たりません</p>
                <p className="text-[11px] font-bold text-amber-900/70 mt-1">このままでも十分強い記事です。</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 選択した改善点の実行 */}
      {selected && (
        <div className="p-4 rounded-2xl bg-white border border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">選択中</p>
              <p className="text-base font-black text-gray-900 mt-1">{selected.title}</p>
              <p className="text-xs font-bold text-gray-500 mt-2 leading-relaxed">{selected.detail}</p>
            </div>
          </div>
          {applyError && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold">
              {applyError}
            </div>
          )}
          {needTarget?.headings?.length ? (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-xs font-black text-amber-900">長文のため、修正対象の見出しを選んでください</p>
              <p className="text-[10px] font-bold text-amber-800/80 mt-1">安全に反映するため、部分修正で適用します。</p>
              <select
                value={targetHeading}
                onChange={(e) => setTargetHeading(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-xl bg-white border border-amber-200 text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-500"
              >
                <option value="">見出しを選択…</option>
                {needTarget.headings.slice(0, 50).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-gray-50 border border-gray-100">
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`px-3 py-2 rounded-lg text-[11px] font-black transition-all ${
                  mode === 'manual' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-white'
                }`}
              >
                手動で対応
              </button>
              <button
                type="button"
                onClick={() => setMode('auto')}
                className={`px-3 py-2 rounded-lg text-[11px] font-black transition-all ${
                  mode === 'auto' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-white'
                }`}
                title="有料プランの場合はAIで自動修正できます"
              >
                AIで自動修正
              </button>
            </div>
            <div className="text-[10px] font-bold text-gray-400">
              ※自動修正は有料機能のため、プランによっては利用できません
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-end">
            {mode === 'manual' ? (
              <button
                onClick={() => {
                  if (isHeadingRelated(selected.title)) onGoOutline?.()
                  else onGoEdit?.()
                }}
                className="h-11 px-5 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Wrench className="w-4 h-4" />
                {isHeadingRelated(selected.title) ? '見出し編集で対応する' : '本文編集で対応する'}
              </button>
            ) : (
              <button
                disabled={applying || (needTarget?.headings?.length ? !targetHeading : false)}
                onClick={async () => {
                  setApplying(true)
                  setApplyError(null)
                  try {
                    // 1) 軽い改善は既存autofixで即適用
                    if (selected.id !== 'OPEN_EDIT' && selected.kind === 'quick') {
                      const res = await fetch(`/api/seo/articles/${articleId}/autofix`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fix: selected.id }),
                      })
                      const json = await res.json().catch(() => ({}))
                      if (!res.ok || json?.success === false) throw new Error(json?.error || `API Error: ${res.status}`)
                      onUpdated?.()
                      return
                    }

                    // 2) それ以外は chat-edit で自動修正（有料）
                    const message = [
                      `次の改善を行ってください: ${selected.title}`,
                      selected.detail ? `背景: ${selected.detail}` : '',
                      '',
                      '制約:',
                      '- できるだけ既存の構成と見出しは保つ（必要最小限の変更）',
                      '- 事実は捏造しない。数字や固有名詞は元の内容にないなら追加しない。',
                      '- 日本語として自然な文章にする。',
                    ].join('\n')

                    const res = await fetch(`/api/seo/articles/${articleId}/chat-edit`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message,
                        targetHeading: targetHeading || undefined,
                      }),
                    })
                    const json = await res.json().catch(() => ({}))
                    if (json?.code === 'NEED_TARGET' && Array.isArray(json?.headings)) {
                      setNeedTarget({ headings: json.headings })
                      throw new Error('長文のため見出し指定が必要です（見出しを選んで再実行してください）。')
                    }
                    if (!res.ok || json?.success === false) {
                      throw new Error(json?.error || `API Error: ${res.status}`)
                    }

                    const proposed = String(json?.proposedMarkdown || '')
                    if (!proposed.trim()) throw new Error('自動修正の結果が空でした')

                    // 3) 提案Markdownを保存
                    const saveRes = await fetch(`/api/seo/articles/${articleId}/content`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ finalMarkdown: proposed, normalize: true }),
                    })
                    const saveJson = await saveRes.json().catch(() => ({}))
                    if (!saveRes.ok || saveJson?.success === false) {
                      throw new Error(saveJson?.error || `保存に失敗しました (${saveRes.status})`)
                    }

                    onUpdated?.()
                  } catch (e: any) {
                    setApplyError(e?.message || '自動修正に失敗しました')
                  } finally {
                    setApplying(false)
                  }
                }}
                className="h-11 px-5 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                AIで自動修正する
              </button>
            )}
          </div>
        </div>
      )}

      {/* スコアが高い場合 */}
      {analysis.score >= 80 && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-bold text-emerald-700">
              SEO対策が十分な記事です！
            </p>
          </div>
        </div>
      )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI自動修正中のポップアップモーダル */}
      <AnimatePresence>
        {applying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* グラデーションヘッダー */}
              <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
                <motion.div
                  className="h-full bg-white/30"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              </div>

              <div className="p-8 text-center">
                {/* AIアイコンアニメーション */}
                <div className="relative w-24 h-24 mx-auto mb-6">
                  {/* 外側の回転リング */}
                  <motion.div
                    className="absolute inset-0 rounded-full border-4 border-blue-200"
                    style={{ borderTopColor: '#2563EB', borderRightColor: '#8B5CF6' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* 内側のパルス */}
                  <motion.div
                    className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Brain className="w-10 h-10 text-white" />
                    </motion.div>
                  </motion.div>
                  {/* 周囲のパーティクル */}
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full bg-blue-400"
                      style={{
                        top: '50%',
                        left: '50%',
                      }}
                      animate={{
                        x: [0, Math.cos((i * 60 * Math.PI) / 180) * 50],
                        y: [0, Math.sin((i * 60 * Math.PI) / 180) * 50],
                        opacity: [0, 1, 0],
                        scale: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-2">
                  AIが記事を修正中
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  しばらくお待ちください...
                </p>

                {/* フェーズ表示 */}
                <div className="space-y-3 mb-6">
                  {['記事を解析中...', '改善ポイントを特定中...', 'AIが文章を修正中...', '最適化を適用中...', '最終チェック中...'].map((text, i) => (
                    <motion.div
                      key={i}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${
                        applyPhase === i
                          ? 'bg-blue-50 border border-blue-200'
                          : applyPhase > i
                            ? 'bg-emerald-50 border border-emerald-200'
                            : 'bg-gray-50 border border-gray-100'
                      }`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                        {applyPhase > i ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : applyPhase === i ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          >
                            <RefreshCw className="w-5 h-5 text-blue-600" />
                          </motion.div>
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-gray-300" />
                        )}
                      </div>
                      <span className={`text-sm font-bold ${
                        applyPhase === i
                          ? 'text-blue-700'
                          : applyPhase > i
                            ? 'text-emerald-700'
                            : 'text-gray-400'
                      }`}>
                        {text}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* ヒント */}
                <div className="text-xs text-gray-400 flex items-center justify-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  <span>SEO最適化を自動で行っています</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

