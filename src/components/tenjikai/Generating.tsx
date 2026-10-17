'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { boothSize, expectedVisitors, type ProjectInput, type SiteAnalysis } from '@/lib/tenjikai/engine'
import { ds } from '@/lib/tenjikai/tokens'

const STEP_MS = 520

export default function Generating({ analysis, input, onDone }: { analysis: SiteAnalysis; input: ProjectInput; onDone: () => void }) {
  const { w, d, venue } = boothSize(input)
  const steps = [
    `${analysis.domain} を読み込み`,
    '訴求点とターゲットを抽出',
    'ブランドカラーを取得',
    `${venue.name} の規定を確認（高さ ${venue.maxHeightM}m）`,
    `${w}m × ${d}m のブースを3案設計`,
    '制作物6点のコピーと構成を作成',
    `来場 ${expectedVisitors(input).toLocaleString()} 人分のノベルティを試算`,
    '費目別に予算を配分',
    '業者候補をマッチング',
    '会期から締切を逆算',
  ]
  const [done, setDone] = useState(0)

  useEffect(() => {
    if (done >= steps.length) {
      const t = setTimeout(onDone, 650)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setDone((n) => n + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [done, steps.length, onDone])

  const pct = Math.round((done / steps.length) * 100)

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:px-8 md:py-16">
      <div className="relative overflow-hidden rounded-[var(--r)] border border-gray-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          <span className="ml-2 truncate rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500">{input.serviceUrl}</span>
        </div>
        <div className="space-y-3">
          <div className="h-5 w-1/3 rounded bg-gray-100" />
          <p className="whitespace-pre-line font-display text-2xl leading-snug" style={{ color: analysis.colors.secondary }}>
            {analysis.headline}
          </p>
          <div className="grid grid-cols-3 gap-2 pt-2">
            {analysis.valueProps.map((v, i) => (
              <motion.div key={v.title} initial={{ opacity: 0.4 }} animate={{ opacity: done > 1 ? 1 : 0.4, borderColor: done > 1 ? analysis.colors.primary : ds.line }} transition={{ delay: i * 0.1 }} className="rounded-xl border-2 p-2">
                <p className="text-[11px] font-black text-ink">{v.title}</p>
                <div className="mt-1 h-1.5 w-full rounded bg-gray-100" />
                <div className="mt-1 h-1.5 w-2/3 rounded bg-gray-100" />
              </motion.div>
            ))}
          </div>
          <div className="h-24 rounded-xl bg-gray-50" />
        </div>
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-doya-500/20 to-transparent"
          initial={{ top: '-20%' }}
          animate={{ top: ['-20%', '100%'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <AnimatePresence>
          {done > 2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-4 right-4 flex gap-1.5 rounded-full bg-white/90 p-1.5 shadow-lg backdrop-blur">
              {Object.values(analysis.colors).map((c, i) => (
                <motion.span key={c} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.08, type: 'spring' }} className="h-6 w-6 rounded-full ring-2 ring-white" style={{ background: c }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 44 44" className="h-16 w-16 -rotate-90" aria-hidden="true">
            <circle cx="22" cy="22" r="19" fill="none" stroke={ds.blueSoft} strokeWidth="4" />
            <motion.circle cx="22" cy="22" r="19" fill="none" stroke={ds.blue} strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 19} animate={{ strokeDashoffset: 2 * Math.PI * 19 * (1 - pct / 100) }} transition={{ duration: 0.4 }} />
          </svg>
          <div>
            <p className="font-mono text-3xl font-semibold text-ink tabular">{pct}%</p>
            <p className="text-sm font-bold text-gray-500">展示会の準備一式を作成しています</p>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5">
          {steps.map((s, i) => {
            const state = i < done ? 'done' : i === done ? 'run' : 'wait'
            return (
              <motion.li key={s} initial={{ opacity: 0, x: 12 }} animate={{ opacity: state === 'wait' ? 0.35 : 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2 text-sm font-bold text-ink">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full" style={{ background: state === 'done' ? ds.blue : ds.track }}>
                  {state === 'done' ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
                      <Check className="h-3.5 w-3.5 text-white" />
                    </motion.span>
                  ) : state === 'run' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-doya-500" />
                  ) : null}
                </span>
                {s}
              </motion.li>
            )
          })}
        </ul>
        <p className="text-[11px] text-gray-400">プロトタイプのため、AI呼び出しは行わずルールで生成しています。</p>
      </div>
    </div>
  )
}
