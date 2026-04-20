'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Search, TrendingUp, Sparkles, FileText, AlertCircle } from 'lucide-react'
import type { SeoAnalysis } from '@/lib/allinone/types'
import { RegenerateButton } from './SiteTab'

export function SeoTab({
  seo,
  siteUrl,
  onRegenerate,
  isRegenerating,
  verbose,
}: {
  seo: SeoAnalysis | null
  siteUrl: string
  onRegenerate: () => void
  isRegenerating: boolean
  verbose: boolean
}) {
  if (!seo) return null
  const enc = encodeURIComponent

  return (
    <div className="space-y-6">
      {/* 概要カード */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 sm:grid-cols-3"
      >
        <div className="rounded-3xl border border-allinone-line bg-white p-5">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-allinone-muted">
            想定キーワード
          </div>
          <div className="text-3xl font-black text-allinone-ink">{seo.estimatedTargetKeywords.length}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {seo.estimatedTargetKeywords.slice(0, 5).map((k) => (
              <span key={k} className="rounded-full bg-allinone-primarySoft px-2 py-0.5 text-[10px] font-bold text-allinone-primary">
                {k}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-allinone-line bg-gradient-to-br from-allinone-warnSoft to-white p-5">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-allinone-muted">
            不足キーワード
          </div>
          <div className="text-3xl font-black text-allinone-warn">{seo.missingKeywords.length}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {seo.missingKeywords.slice(0, 5).map((k) => (
              <span key={k} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-allinone-warn">
                {k}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-allinone-line bg-white p-5">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-allinone-muted">
            内部リンクスコア
          </div>
          <div
            className={`text-3xl font-black ${
              seo.internalLinkScore >= 70
                ? 'text-allinone-accent'
                : seo.internalLinkScore >= 40
                ? 'text-allinone-warn'
                : 'text-allinone-danger'
            }`}
          >
            {seo.internalLinkScore}
          </div>
          <div className="mt-2 text-xs text-allinone-muted">/100</div>
        </div>
      </motion.div>

      <RegenerateButton onClick={onRegenerate} loading={isRegenerating} />

      {/* コンテンツギャップ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-allinone-line bg-white p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-allinone-primary" />
          <h3 className="text-lg font-black text-allinone-ink">コンテンツギャップ</h3>
          <span className="ml-2 rounded-full bg-allinone-primarySoft px-2 py-0.5 text-[10px] font-black text-allinone-primary">
            作るべきコンテンツ {seo.contentGaps.length} 件
          </span>
        </div>

        <div className="space-y-3">
          {seo.contentGaps.map((gap, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group rounded-2xl border border-allinone-line bg-allinone-surface p-4 transition hover:border-allinone-primary"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    gap.severity === 'high'
                      ? 'bg-allinone-dangerSoft text-allinone-danger'
                      : gap.severity === 'medium'
                      ? 'bg-allinone-warnSoft text-allinone-warn'
                      : 'bg-white text-allinone-muted'
                  }`}
                >
                  {gap.severity === 'high' ? '緊急' : gap.severity === 'medium' ? '中優先' : '低優先'}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-allinone-muted">
                  {gap.type}
                </span>
              </div>
              <div className="mt-2 font-black text-allinone-ink">{gap.title}</div>
              <div className="mt-1 text-sm text-allinone-inkSoft">{gap.description}</div>
              <div className="mt-3 rounded-xl border border-dashed border-allinone-accent/40 bg-white p-3 text-sm">
                <span className="inline-flex items-center gap-1 font-black text-allinone-accent">
                  <Sparkles className="h-3.5 w-3.5" /> 提案
                </span>
                <p className="mt-1 leading-relaxed text-allinone-ink">{gap.suggestion}</p>
              </div>
              {gap.relatedService === 'seo' && (
                <Link
                  href={`/seo?topic=${enc(gap.title)}&siteUrl=${enc(siteUrl)}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-black text-allinone-primary hover:text-allinone-primaryDeep"
                >
                  <FileText className="h-3 w-3" />
                  ドヤ記事AIで記事を書く
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* クイックウィン */}
      {seo.quickWins?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-allinone-line bg-gradient-to-br from-allinone-primarySoft via-white to-cyan-50 p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-allinone-primary" />
            <h3 className="text-lg font-black text-allinone-ink">クイックウィン</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {seo.quickWins.map((qw, i) => (
              <div key={i} className="rounded-2xl border border-allinone-line bg-white p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-allinone-accentSoft px-2 py-0.5 text-[10px] font-black text-allinone-accent">
                    効果 {qw.impact}
                  </span>
                  <span className="rounded-full bg-allinone-surface px-2 py-0.5 text-[10px] font-black text-allinone-muted">
                    手間 {qw.effort}
                  </span>
                </div>
                <div className="font-black text-allinone-ink">{qw.title}</div>
                <div className="mt-1 text-sm text-allinone-inkSoft">{qw.detail}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* トピッククラスタ */}
      {seo.topicClusters?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-allinone-line bg-white p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-5 w-5 text-allinone-primary" />
            <h3 className="text-lg font-black text-allinone-ink">トピッククラスタ</h3>
          </div>
          <div className="space-y-3">
            {seo.topicClusters.map((tc, i) => (
              <div key={i} className="rounded-2xl border border-allinone-line bg-allinone-surface p-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      tc.priority === 'high'
                        ? 'bg-allinone-primarySoft text-allinone-primary'
                        : tc.priority === 'medium'
                        ? 'bg-allinone-warnSoft text-allinone-warn'
                        : 'bg-white text-allinone-muted'
                    }`}
                  >
                    {tc.priority}
                  </span>
                  <span className="font-black text-allinone-ink">{tc.theme}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tc.keywords.map((k) => (
                    <span
                      key={k}
                      className="rounded-full border border-allinone-line bg-white px-2 py-0.5 text-[11px] font-bold text-allinone-inkSoft"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
