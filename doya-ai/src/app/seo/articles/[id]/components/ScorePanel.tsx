'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, AlertTriangle, CheckCircle2, Zap, ThumbsUp, Wrench, Loader2 } from 'lucide-react'

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
}

type Improvement = {
  id: 'ADD_TLDR' | 'ADD_FAQ' | 'ADD_CONCLUSION' | 'ADD_GLOSSARY' | 'OPEN_EDIT'
  title: string
  detail: string
  kind: 'quick' | 'manual'
}

export function ScorePanel({ articleId, article, onUpdated, onGoEdit }: ScorePanelProps) {
  const [selected, setSelected] = useState<Improvement | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

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

  return (
    <div className="space-y-4">
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
            {analysis.score}
            <span className="text-sm text-gray-400">/100</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded-xl bg-white/60">
            <p className="text-lg font-black text-gray-900">{analysis.charCount.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 font-bold">文字数</p>
          </div>
          <div className="p-2 rounded-xl bg-white/60">
            <p className="text-lg font-black text-gray-900">{analysis.h2Count}</p>
            <p className="text-[10px] text-gray-500 font-bold">H2見出し</p>
          </div>
          <div className="p-2 rounded-xl bg-white/60">
            <p className="text-lg font-black text-gray-900">{analysis.h3Count}</p>
            <p className="text-[10px] text-gray-500 font-bold">H3見出し</p>
          </div>
        </div>
      </motion.div>

      {/* 良い点 / 改善点 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
          <div className="flex items-center gap-2 mb-3">
            <ThumbsUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Good（うまくいってる）</span>
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
          </div>
          <div className="space-y-2">
            {(analysis.improvements.length ? analysis.improvements : []).map((it) => {
              const active = selected?.id === it.id && selected?.title === it.title
              return (
                <button
                  key={`${it.id}_${it.title}`}
                  onClick={() => { setSelected(it); setApplyError(null) }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    active ? 'bg-white border-amber-300 shadow-sm' : 'bg-white/60 border-amber-100 hover:bg-white hover:border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-amber-900">{it.title}</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      it.kind === 'quick' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-50 text-gray-600 border border-gray-100'
                    }`}>
                      {it.kind === 'quick' ? '自動修正' : '手動'}
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
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-end">
            {selected.kind === 'manual' ? (
              <button
                onClick={() => onGoEdit?.()}
                className="h-11 px-5 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Wrench className="w-4 h-4" />
                本文編集で対応する
              </button>
            ) : (
              <button
                disabled={applying}
                onClick={async () => {
                  setApplying(true)
                  setApplyError(null)
                  try {
                    const res = await fetch(`/api/seo/articles/${articleId}/autofix`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fix: selected.id }),
                    })
                    const json = await res.json().catch(() => ({}))
                    if (!res.ok || json?.success === false) throw new Error(json?.error || `API Error: ${res.status}`)
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
                この改善を自動で適用
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
    </div>
  )
}

