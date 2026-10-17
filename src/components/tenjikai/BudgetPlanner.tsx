'use client'

import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { CountUp, PageHeader, cardIn } from './ui'
import { BUDGET_META, man, yen, type BudgetLine, type ProjectInput } from '@/lib/tenjikai/engine'
import { ds } from '@/lib/tenjikai/tokens'

function Donut({ lines, total }: { lines: BudgetLine[]; total: number }) {
  const r = 70
  const circ = 2 * Math.PI * r
  let acc = 0
  return (
    <svg viewBox="0 0 200 200" className="h-56 w-56" role="img" aria-label="予算内訳の円グラフ">
      <circle cx="100" cy="100" r={r} fill="none" stroke={ds.track} strokeWidth="26" />
      {lines.map((l, i) => {
        const frac = l.amountYen / total
        const offset = acc
        acc += frac
        return (
          <motion.circle
            key={l.category}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={BUDGET_META[l.category].color}
            strokeWidth="26"
            strokeDasharray={`${Math.max(0, frac * circ - 2)} ${circ}`}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: -offset * circ }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            transform="rotate(-90 100 100)"
          />
        )
      })}
      <text x="100" y="94" textAnchor="middle" fontSize="11" fill={ds.sub} fontWeight={700}>見積合計</text>
      <text x="100" y="116" textAnchor="middle" fontSize="18" fill={ds.ink} style={{ fontVariantNumeric: 'tabular-nums' }} fontWeight={600}>{man(total)}</text>
    </svg>
  )
}

export default function BudgetPlanner({ input, setInput, budget }: { input: ProjectInput; setInput: (i: ProjectInput) => void; budget: BudgetLine[] }) {
  const total = budget.reduce((s, b) => s + b.amountYen, 0)
  const diff = input.budgetYen - total
  const usage = Math.min(1.3, total / input.budgetYen)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <PageHeader title="予算シミュレーター" desc="小間料・装飾・電気・制作物・ノベルティ・人件費を、会場の料金と単価表から積み上げています。設営案やノベルティを変えると即座に再計算されます。" />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <motion.div {...cardIn(0)} className="flex flex-col items-center gap-4 rounded-[var(--r)] border border-gray-200 bg-white p-6">
          <Donut lines={budget} total={total} />
          <div className="w-full">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-black text-gray-500">総予算</span>
              <CountUp value={input.budgetYen} format={man} className="font-mono text-lg font-semibold text-ink tabular" />
            </div>
            <input id="budget-slider" type="range" min={500000} max={10000000} step={100000} value={input.budgetYen} onChange={(e) => setInput({ ...input, budgetYen: Number(e.target.value) })} className="w-full accent-doya-500" />
            <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
              <motion.div animate={{ width: `${Math.min(100, usage * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className={clsx('h-full rounded-full', diff >= 0 ? 'bg-emerald-500' : 'bg-rose-500')} />
            </div>
            <p className={clsx('mt-2 text-center text-sm font-black', diff >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {diff >= 0 ? `予算内です。残り ${man(diff)}` : `予算を ${man(-diff)} 超えています。設営案かノベルティを見直してください。`}
            </p>
          </div>
        </motion.div>

        <motion.div {...cardIn(1)} className="overflow-hidden rounded-[var(--r)] border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left font-mono text-[10px] uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">費目</th>
                <th className="px-5 py-3">内訳</th>
                <th className="px-5 py-3 text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              {budget.map((b, i) => (
                <motion.tr key={b.category} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-5 py-3 font-black text-ink">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BUDGET_META[b.category].color }} />
                    {BUDGET_META[b.category].label}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {b.detail}
                    <div className="mt-1 h-1 rounded-full bg-gray-100">
                      <motion.div className="h-full rounded-full" style={{ background: BUDGET_META[b.category].color }} initial={{ width: 0 }} animate={{ width: `${(b.amountYen / total) * 100}%` }} transition={{ delay: 0.3 + i * 0.05, duration: 0.6 }} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-mono tabular text-ink">{yen(b.amountYen)}</td>
                </motion.tr>
              ))}
              <tr className="border-t-2 border-ink">
                <td className="px-5 py-3 font-black text-ink" colSpan={2}>合計</td>
                <td className="px-5 py-3 text-right font-mono text-base font-semibold tabular text-ink">{yen(total)}</td>
              </tr>
            </tbody>
          </table>
        </motion.div>
      </div>
      <p className="text-[11px] text-gray-400">小間料と単価は目安です。実際の金額は、主催者の料金表と業者の見積で確かめてください。</p>
    </div>
  )
}
