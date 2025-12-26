'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, AlertTriangle, CheckCircle2, Zap } from 'lucide-react'

type ScorePanelProps = {
  article: {
    finalMarkdown?: string | null
    targetChars?: number
    keywords?: string[]
    checkResults?: any
  }
}

export function ScorePanel({ article }: ScorePanelProps) {
  const analysis = useMemo(() => {
    const content = article.finalMarkdown || ''
    const charCount = content.length
    const targetChars = article.targetChars || 10000

    // 見出し数をカウント
    const h2Count = (content.match(/^##\s+/gm) || []).length
    const h3Count = (content.match(/^###\s+/gm) || []).length

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

    // 不足トピックの推定（ダミー）
    const missingTopics: string[] = []
    if (h2Count < 8) missingTopics.push('見出し数が少ない（網羅性）')
    if (charCount < targetChars * 0.8) missingTopics.push('文字数が目標未満')
    if (!content.includes('FAQ') && !content.includes('よくある質問')) missingTopics.push('FAQ/よくある質問がない')
    if (!content.includes('まとめ')) missingTopics.push('まとめセクションがない')

    // 強化すべき見出し（ダミー）
    const weakHeadings: string[] = []
    if (h3Count < 5) weakHeadings.push('各H2の下にH3を追加')

    return {
      score,
      charCount,
      targetChars,
      h2Count,
      h3Count,
      missingTopics,
      weakHeadings,
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

      {/* 不足トピック */}
      {analysis.missingTopics.length > 0 && (
        <div className="p-4 rounded-2xl bg-yellow-50 border border-yellow-100">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-xs font-black text-yellow-700 uppercase tracking-widest">不足トピック</span>
          </div>
          <ul className="space-y-2">
            {analysis.missingTopics.map((topic, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-yellow-800 font-medium">
                <span className="text-yellow-500 mt-0.5">•</span>
                {topic}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 強化すべき見出し */}
      {analysis.weakHeadings.length > 0 && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-black text-blue-700 uppercase tracking-widest">改善ポイント</span>
          </div>
          <ul className="space-y-2">
            {analysis.weakHeadings.map((heading, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-800 font-medium">
                <span className="text-blue-500 mt-0.5">•</span>
                {heading}
              </li>
            ))}
          </ul>
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

