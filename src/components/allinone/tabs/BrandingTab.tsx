'use client'

import { motion } from 'framer-motion'
import { Palette, Sparkles, Type, CheckCircle2 } from 'lucide-react'
import type { BrandingAnalysis } from '@/lib/allinone/types'
import { RegenerateButton } from './SiteTab'

export function BrandingTab({
  branding,
  heroImage,
  ogImage,
  onRegenerate,
  isRegenerating,
}: {
  branding: BrandingAnalysis | null
  heroImage?: string | null
  ogImage?: string | null
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  if (!branding) return null
  return (
    <div className="space-y-6">
      {/* トーン + 一貫性 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="relative overflow-hidden rounded-3xl border border-allinone-line bg-gradient-to-br from-white to-allinone-primarySoft/40 p-6">
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-allinone-primary">
            <Sparkles className="h-3 w-3" /> BRAND TONE
          </div>
          <h3 className="mt-2 text-xl font-black text-allinone-ink sm:text-2xl">{branding.tone}</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {branding.toneTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-allinone-line bg-white px-2 py-0.5 text-xs font-black text-allinone-inkSoft"
              >
                {tag}
              </span>
            ))}
          </div>
          <RegenerateButton onClick={onRegenerate} loading={isRegenerating} />
        </div>

        <div className="rounded-3xl border border-allinone-line bg-white p-6">
          <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-allinone-muted">
            CONSISTENCY
          </div>
          <div className="flex items-center gap-6">
            <div className="relative h-28 w-28 flex-none">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="50" stroke="#EEF0F8" strokeWidth="12" fill="none" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke={branding.consistency >= 80 ? '#00E5A0' : branding.consistency >= 50 ? '#FFB547' : '#FF5C7C'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 50}
                  strokeDashoffset={2 * Math.PI * 50 * (1 - branding.consistency / 100)}
                  fill="none"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-2xl font-black text-allinone-ink">{branding.consistency}</div>
                  <div className="text-[10px] text-allinone-muted">/100</div>
                </div>
              </div>
            </div>
            <p className="text-sm text-allinone-inkSoft">{branding.visualStyle}</p>
          </div>
        </div>
      </motion.div>

      {/* パレット + フォント */}
      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-allinone-line bg-white p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <Palette className="h-5 w-5 text-allinone-primary" />
            <h3 className="text-lg font-black text-allinone-ink">カラーパレット</h3>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {branding.palette.slice(0, 12).map((hex, i) => (
              <motion.div
                key={hex + i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group relative"
              >
                <div
                  className="aspect-square w-full rounded-xl border border-allinone-line shadow-sm transition group-hover:scale-105"
                  style={{ backgroundColor: hex }}
                />
                <div className="mt-1 text-center font-mono text-[10px] text-allinone-muted">{hex}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-allinone-line bg-white p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <Type className="h-5 w-5 text-allinone-primary" />
            <h3 className="text-lg font-black text-allinone-ink">タイポグラフィの印象</h3>
          </div>
          <p className="text-sm leading-relaxed text-allinone-inkSoft">{branding.fontImpression}</p>
          {(heroImage || ogImage) && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-allinone-line">
              <img
                src={heroImage || ogImage || ''}
                alt="hero/og"
                className="h-36 w-full object-cover"
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* 改善案 */}
      {branding.improvements?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-allinone-line bg-gradient-to-br from-allinone-primarySoft via-white to-cyan-50 p-6"
        >
          <h3 className="mb-3 text-lg font-black text-allinone-ink">ブランド強化の提案</h3>
          <ul className="space-y-2 text-sm text-allinone-inkSoft">
            {branding.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-allinone-accent" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  )
}
