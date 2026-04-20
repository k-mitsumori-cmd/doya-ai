'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Quote, Target, ArrowRight, Heart } from 'lucide-react'
import type { Persona } from '@/lib/allinone/types'
import { RegenerateButton } from './SiteTab'

export function PersonaTab({
  personas,
  siteUrl,
  onRegenerate,
  isRegenerating,
}: {
  personas: Persona[]
  siteUrl: string
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const enc = encodeURIComponent
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-allinone-primarySoft px-2.5 py-1 text-[10px] font-black text-allinone-primary">
            <Target className="h-3 w-3" />
            TARGET PERSONAS
          </div>
          <h2 className="text-2xl font-black text-allinone-ink">自動生成ペルソナ {personas.length} 名</h2>
        </div>
        <RegenerateButton onClick={onRegenerate} loading={isRegenerating} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {personas.map((p, i) => (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="group relative overflow-hidden rounded-3xl border border-allinone-line bg-white shadow-lg shadow-allinone-primary/5 transition hover:-translate-y-1 hover:shadow-xl"
          >
            {/* 肖像 */}
            <div
              className="relative h-56 w-full bg-gradient-to-br from-allinone-primarySoft via-white to-cyan-50"
              style={p.palette ? { background: `linear-gradient(135deg, ${p.palette}33, white)` } : undefined}
            >
              {p.portraitUrl ? (
                <motion.img
                  key={p.portraitUrl}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  src={p.portraitUrl}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <div className="h-20 w-20 animate-pulse rounded-full bg-white/80" />
                </div>
              )}
              {/* カラーバッジ */}
              {p.palette && (
                <span
                  className="absolute bottom-3 left-3 h-5 w-5 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: p.palette }}
                />
              )}
              {/* 番号 */}
              <div className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-black text-allinone-ink shadow">
                {i + 1}
              </div>
            </div>

            {/* 本文 */}
            <div className="p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xl font-black text-allinone-ink">{p.name}</h3>
                <span className="text-xs font-black text-allinone-muted">
                  {p.age}歳 / {p.gender}
                </span>
              </div>
              <div className="text-sm font-bold text-allinone-inkSoft">{p.occupation}</div>

              {p.quote && (
                <div className="mt-4 relative rounded-2xl bg-allinone-primarySoft/50 p-3 text-sm italic leading-relaxed text-allinone-ink">
                  <Quote className="absolute -top-2 -left-1 h-4 w-4 text-allinone-primary" />
                  「{p.quote}」
                </div>
              )}

              <dl className="mt-4 space-y-2 text-sm">
                <Row label="ライフスタイル" value={p.lifestyle} />
                <Row label="動機" value={p.motivation} />
                <Row label="痛み" value={p.painPoint} danger />
                <Row label="購入トリガー" value={p.buyingTrigger} highlight />
                <Row label="懸念" value={p.objection} />
              </dl>

              {p.informationSource?.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-allinone-muted">
                    情報源
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.informationSource.map((s) => (
                      <span key={s} className="rounded-full bg-allinone-surface px-2 py-0.5 text-[10px] font-bold text-allinone-inkSoft">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href={`/persona?basePersona=${enc(p.id)}&siteUrl=${enc(siteUrl)}`}
                className="mt-5 inline-flex w-full items-center justify-center gap-1 rounded-full bg-allinone-ink py-2 text-xs font-black text-white transition hover:bg-allinone-inkSoft"
              >
                <Heart className="h-3 w-3" />
                ドヤペルソナAIで詳細化
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Glow */}
            <span className="pointer-events-none absolute inset-x-0 -bottom-10 h-20 bg-gradient-to-t from-allinone-primarySoft/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          </motion.article>
        ))}
      </div>
    </div>
  )
}

function Row({ label, value, danger, highlight }: { label: string; value: string; danger?: boolean; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl p-2 ${
        danger ? 'bg-allinone-dangerSoft/50' : highlight ? 'bg-allinone-accentSoft/60' : 'bg-allinone-surface'
      }`}
    >
      <dt className="text-[10px] font-black uppercase tracking-wider text-allinone-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-allinone-ink">{value || '—'}</dd>
    </div>
  )
}
