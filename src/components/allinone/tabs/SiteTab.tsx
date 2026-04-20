'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Gauge, RefreshCw, TrendingUp, XCircle } from 'lucide-react'
import type { SiteAnalysis } from '@/lib/allinone/types'

export function SiteTab({
  site,
  onRegenerate,
  isRegenerating,
}: {
  site: SiteAnalysis | null
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  if (!site) {
    return <EmptyState message="サイト診断はまだ生成されていません" />
  }

  const psMobile = site.pageSpeedMobile
  const psDesktop = site.pageSpeedDesktop

  return (
    <div className="space-y-6">
      {/* 第一印象 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-allinone-line bg-gradient-to-br from-white to-allinone-primarySoft/30 p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-allinone-primary">
              FIRST IMPRESSION
            </div>
            <div className="text-lg font-black text-allinone-ink sm:text-xl">{site.firstImpression}</div>
          </div>
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md">
            <div>
              <div className="bg-gradient-to-br from-allinone-primary to-allinone-cyan bg-clip-text text-center text-2xl font-black leading-none text-transparent">
                {site.firstImpressionScore}
              </div>
              <div className="text-center text-[9px] font-black text-allinone-muted">/100</div>
            </div>
          </div>
        </div>
        <RegenerateButton onClick={onRegenerate} loading={isRegenerating} />
      </motion.div>

      {/* 強み / 弱み */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SWCard title="強み" items={site.strengths} positive />
        <SWCard title="弱み" items={site.weaknesses} />
      </div>

      {/* PageSpeed */}
      {(psMobile || psDesktop) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-allinone-line bg-white p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-allinone-primary" />
            <h3 className="text-lg font-black text-allinone-ink">PageSpeed Insights</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {psMobile && <PsPanel label="モバイル" data={psMobile} />}
            {psDesktop && <PsPanel label="デスクトップ" data={psDesktop} />}
          </div>
        </motion.div>
      )}

      {/* 課題一覧 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-allinone-line bg-white p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-allinone-warn" />
          <h3 className="text-lg font-black text-allinone-ink">
            課題 ({site.issues.length}件)
          </h3>
        </div>
        <div className="space-y-3">
          {site.issues.map((iss, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i }}
              className="rounded-2xl border border-allinone-line bg-allinone-surface p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <SeverityBadge severity={iss.severity} />
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-allinone-muted">
                  {iss.category}
                </span>
              </div>
              <div className="font-black text-allinone-ink">{iss.title}</div>
              <div className="mt-1 text-sm text-allinone-inkSoft">{iss.description}</div>
              <div className="mt-3 rounded-xl border border-dashed border-allinone-primary/40 bg-white p-3 text-sm text-allinone-ink">
                <span className="inline-flex items-center gap-1 font-black text-allinone-primary">
                  <TrendingUp className="h-3.5 w-3.5" /> 直し方
                </span>
                <p className="mt-1 leading-relaxed">{iss.suggestion}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* CTA & 信頼要素 */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-allinone-line bg-white p-6"
        >
          <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-allinone-muted">
            CTA EVALUATION
          </div>
          <p className="text-sm font-bold text-allinone-ink">{site.ctaEvaluation || '評価未取得'}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-allinone-line bg-white p-6"
        >
          <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-allinone-muted">
            TRUST SIGNALS
          </div>
          {site.trustSignals?.length ? (
            <ul className="space-y-1 text-sm font-bold text-allinone-ink">
              {site.trustSignals.map((t, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-allinone-accent" />
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-allinone-muted">信頼要素は検出されませんでした</div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const label = severity === 'high' ? '重要度 高' : severity === 'medium' ? '中' : '低'
  const cls =
    severity === 'high'
      ? 'bg-allinone-dangerSoft text-allinone-danger'
      : severity === 'medium'
      ? 'bg-allinone-warnSoft text-allinone-warn'
      : 'bg-allinone-surface text-allinone-muted'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${cls}`}>{label}</span>
}

function SWCard({ title, items, positive }: { title: string; items: string[]; positive?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-allinone-line bg-white p-6"
    >
      <h4 className="mb-4 text-sm font-black text-allinone-ink">{title}</h4>
      <ul className="space-y-2 text-sm">
        {items.length === 0 && <li className="text-allinone-muted">なし</li>}
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            {positive ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-allinone-accent" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 flex-none text-allinone-danger" />
            )}
            <span className="text-allinone-inkSoft">{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

function PsPanel({ label, data }: { label: string; data: NonNullable<SiteAnalysis['pageSpeedMobile']> }) {
  const scores = [
    { k: 'Performance', v: data.performanceScore },
    { k: 'Accessibility', v: data.accessibilityScore },
    { k: 'Best Practices', v: data.bestPracticesScore },
    { k: 'SEO', v: data.seoScore },
  ]
  return (
    <div className="rounded-2xl border border-allinone-line bg-allinone-surface p-4">
      <div className="mb-3 text-xs font-black text-allinone-muted">{label}</div>
      <div className="grid grid-cols-4 gap-2">
        {scores.map((s) => (
          <div key={s.k} className="rounded-xl bg-white p-2 text-center">
            <div className="text-[9px] font-black text-allinone-muted">{s.k}</div>
            <div
              className={`mt-1 text-xl font-black ${
                s.v == null
                  ? 'text-allinone-muted'
                  : s.v >= 80
                  ? 'text-allinone-accent'
                  : s.v >= 50
                  ? 'text-allinone-warn'
                  : 'text-allinone-danger'
              }`}
            >
              {s.v ?? '-'}
            </div>
          </div>
        ))}
      </div>
      {data.opportunities.length > 0 && (
        <div className="mt-3 text-[10px] text-allinone-muted">
          改善機会: {data.opportunities.slice(0, 3).map((o) => o.title).join(' / ')}
        </div>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-allinone-line bg-white p-10 text-center text-sm text-allinone-muted">
      {message}
    </div>
  )
}

export function RegenerateButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-allinone-line bg-white px-3 py-1.5 text-xs font-black text-allinone-inkSoft transition hover:border-allinone-primary hover:text-allinone-primary disabled:opacity-60"
    >
      <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
      {loading ? '再生成中…' : 'AIで再生成'}
    </button>
  )
}
