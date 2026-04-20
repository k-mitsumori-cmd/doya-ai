'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import { ArrowRight, Sparkles, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export function DashboardSummary({ analysis }: { analysis: any }) {
  const score = analysis.overallScore ?? 0
  const summary = analysis.summary || {}
  const radar = analysis.radar || {}

  const radarData = [
    { metric: 'サイト力', value: radar.site ?? 0 },
    { metric: 'SEO', value: radar.seo ?? 0 },
    { metric: 'コンテンツ', value: radar.content ?? 0 },
    { metric: 'ターゲティング', value: radar.targeting ?? 0 },
    { metric: '訴求力', value: radar.appeal ?? 0 },
  ]

  const topThree: { title: string; why: string }[] = summary.topThreeActions || []

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* スコア */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative overflow-hidden rounded-3xl border border-allinone-line bg-gradient-to-br from-white via-allinone-primarySoft/40 to-cyan-50 p-8"
      >
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-black text-allinone-primary">
          <Sparkles className="h-3 w-3" />
          OVERALL SCORE
        </div>
        {summary.headline && (
          <div className="mb-6 text-lg font-black leading-snug text-allinone-ink sm:text-xl">
            {summary.headline}
          </div>
        )}
        <div className="flex items-center gap-6">
          <ScoreCircle score={score} />
          <div className="flex-1">
            {summary.elevatorPitch && (
              <p className="text-sm leading-relaxed text-allinone-inkSoft sm:text-base">
                {summary.elevatorPitch}
              </p>
            )}
            {summary.competitorHint && (
              <div className="mt-3 rounded-xl border border-allinone-line bg-white p-3 text-xs text-allinone-muted">
                <span className="font-black text-allinone-ink">競合傾向: </span>
                {summary.competitorHint}
              </div>
            )}
          </div>
        </div>

        {/* Top 3 actions */}
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-allinone-muted">
            <TrendingUp className="h-3 w-3" /> 最優先で直すべき3つ
          </div>
          <div className="space-y-2">
            {topThree.slice(0, 3).map((act, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="group flex gap-3 rounded-2xl border border-allinone-line bg-white p-4 transition hover:border-allinone-primary"
              >
                <div
                  className={`grid h-9 w-9 flex-none place-items-center rounded-xl text-sm font-black ${
                    i === 0
                      ? 'bg-allinone-primary text-white'
                      : i === 1
                      ? 'bg-allinone-primarySoft text-allinone-primary'
                      : 'bg-allinone-surface text-allinone-inkSoft'
                  }`}
                >
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-allinone-ink">{act.title}</div>
                  <div className="mt-1 text-xs text-allinone-muted">{act.why}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <span className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-allinone-primary/10 blur-3xl" />
      </motion.div>

      {/* レーダー */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="rounded-3xl border border-allinone-line bg-white p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-allinone-muted">
              5-AXIS RADAR
            </div>
            <h3 className="text-xl font-black text-allinone-ink">5軸スコア</h3>
          </div>
        </div>
        <div className="aspect-square max-h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="80%">
              <defs>
                <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7C5CFF" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
              <PolarGrid stroke="#E6E8F0" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#1E2240', fontSize: 12, fontWeight: 700 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#7C5CFF"
                fill="url(#radarFill)"
                fillOpacity={0.5}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2 text-center">
          {radarData.map((r) => (
            <div key={r.metric} className="rounded-xl bg-allinone-surface p-2">
              <div className="text-[9px] font-black text-allinone-muted">{r.metric}</div>
              <div className="mt-1 bg-gradient-to-br from-allinone-primary to-allinone-cyan bg-clip-text text-lg font-black text-transparent">
                {r.value}
              </div>
            </div>
          ))}
        </div>

        <Link
          href="#"
          onClick={(e) => {
            e.preventDefault()
            document.querySelector<HTMLButtonElement>('button[data-tab="action"]')?.click()
          }}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-allinone-ink py-3 text-sm font-black text-white transition hover:bg-allinone-inkSoft"
        >
          アクションプランを見る
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  )
}

function ScoreCircle({ score }: { score: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const duration = 1400
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(score * eased))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [score])

  const circumference = 2 * Math.PI * 54
  const offset = circumference - (display / 100) * circumference

  return (
    <div className="relative h-36 w-36 flex-none">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7C5CFF" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="54" stroke="#EEF0F8" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r="54"
          stroke="url(#scoreGrad)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="bg-gradient-to-br from-allinone-primary to-allinone-cyan bg-clip-text text-4xl font-black leading-none text-transparent">
            {display}
          </div>
          <div className="mt-1 text-[10px] font-black tracking-wider text-allinone-muted">
            /100 SCORE
          </div>
        </div>
      </div>
    </div>
  )
}
