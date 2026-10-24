'use client'

import { motion } from 'framer-motion'
import { ArrowRight, CalendarClock } from 'lucide-react'
import IsoBooth from './IsoBooth'
import { CountUp, PageHeader, cardIn } from './ui'
import { StackedBar100 } from '@/components/ds/charts'
import type { Section } from './TenjikaiSidebar'
import { BUDGET_META, POSITION_LABEL, boothSize, daysUntil, expectedVisitors, man, type BoothPlan, type BudgetLine, type Creative, type Deadline, type ProjectInput, type SiteAnalysis } from '@/lib/tenjikai/engine'

interface Props {
  input: ProjectInput
  analysis: SiteAnalysis
  plan: BoothPlan
  budget: BudgetLine[]
  deadlines: Deadline[]
  creatives: Creative[]
  go: (s: Section) => void
}

export default function Overview({ input, analysis, plan, budget, deadlines, creatives, go }: Props) {
  const total = budget.reduce((s, b) => s + b.amountYen, 0)
  const diff = input.budgetYen - total
  const { venue, w, d } = boothSize(input)
  const toEvent = daysUntil(input.eventStart)
  const upcoming = deadlines.filter((x) => daysUntil(x.date) >= 0).slice(0, 4)

  const kpis = [
    { label: '見積合計 / 予算', value: total, fmt: man, sub: diff >= 0 ? `予算内（残り ${man(diff)}）` : `${man(-diff)} 超過`, tone: diff >= 0 ? 'text-emerald-600' : 'text-rose-600' },
    { label: '会期まで', value: toEvent, fmt: (n: number) => `${Math.round(n)}日`, sub: `${input.eventStart} から${input.days}日間`, tone: 'text-gray-500' },
    { label: '想定来場者', value: expectedVisitors(input), fmt: (n: number) => `${Math.round(n).toLocaleString()}人`, sub: '小間数・目的・日数から推計', tone: 'text-gray-500' },
    { label: '用意した制作物', value: creatives.length, fmt: (n: number) => `${Math.round(n)}点`, sub: 'ポスター・チラシ・A4ファイルほか', tone: 'text-gray-500' },
  ]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={`${venue.name} / ${POSITION_LABEL[input.position]} / ${w}m × ${d}m`}
        title={input.eventName}
        desc={`${analysis.brand}（${analysis.category}）の出展準備をまとめました。各項目の詳細は、メニューから開いて確かめられます。`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} {...cardIn(i)} className="rounded-[var(--r-sm)] border border-gray-200 bg-white p-4">
            <p className="text-[11px] font-black text-gray-500">{k.label}</p>
            <CountUp value={k.value} format={k.fmt} className="mt-1 block font-mono text-2xl font-semibold text-ink tabular" />
            <p className={`mt-1 text-[11px] font-bold ${k.tone}`}>{k.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <motion.div {...cardIn(4)} className="flex flex-col rounded-[var(--r)] border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black text-doya-500">採用中の設営案 {plan.variant}</p>
              <h2 className="text-lg font-black text-ink">{plan.name}</h2>
            </div>
            <button onClick={() => go('booth')} className="inline-flex items-center gap-1 rounded-xl bg-doya-50 px-3 py-2 text-xs font-black text-doya-600 hover:bg-doya-100">
              ブース設計を開く <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 aspect-[16/10] w-full">
            <IsoBooth plan={plan} analysis={analysis} compact />
          </div>
          <p className="text-xs leading-relaxed text-gray-600">{plan.concept}</p>
        </motion.div>

        <div className="flex flex-col gap-4">
          <motion.div {...cardIn(5)} className="rounded-[var(--r)] border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-ink">予算の内訳</h2>
              <button onClick={() => go('budget')} className="text-xs font-black text-doya-600 hover:underline">調整する</button>
            </div>
            <StackedBar100
                label="予算の内訳"
                showTotal={false}
                format={man}
                categories={[
                  ...budget.map((b) => ({ name: `${BUDGET_META[b.category].label} ${man(b.amountYen)}`, tone: BUDGET_META[b.category].color })),
                  ...(input.budgetYen > total ? [{ name: `残り ${man(input.budgetYen - total)}`, tone: 'muted' }] : []),
                ]}
                rows={[{
                  label: input.budgetYen >= total ? `見積 ${man(total)}／予算 ${man(input.budgetYen)}` : `見積 ${man(total)}（予算を ${man(total - input.budgetYen)} 超過）`,
                  values: [...budget.map((b) => b.amountYen), ...(input.budgetYen > total ? [input.budgetYen - total] : [])],
                }]}
              />
          </motion.div>

          <motion.div {...cardIn(6)} className="rounded-[var(--r)] border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-black text-ink"><CalendarClock className="h-4 w-4 text-doya-500" />次の締切</h2>
              <button onClick={() => go('docs')} className="text-xs font-black text-doya-600 hover:underline">締切表</button>
            </div>
            <ul className="flex flex-col gap-2">
              {upcoming.map((x, i) => (
                <motion.li key={x.id} initial={false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08 }} className="flex items-center gap-3">
                  <span className="w-14 flex-shrink-0 rounded-lg bg-doya-50 py-1 text-center font-mono text-[11px] font-semibold text-doya-700">T-{x.daysBefore}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">{x.title}</span>
                  <span className="font-mono text-[11px] text-gray-500">{x.date.slice(5).replace('-', '/')}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>

      <motion.div {...cardIn(7)} className="grid gap-4 rounded-[var(--r)] border border-gray-200 bg-white p-5 md:grid-cols-[1fr_1fr_auto]">
        <div>
          <p className="text-[11px] font-black text-gray-500">サイトから抽出した訴求点</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {analysis.valueProps.map((v) => (
              <li key={v.title} className="text-sm"><b className="text-ink">{v.title}</b><span className="text-gray-500"> ─ {v.body}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-black text-gray-500">狙う来場者</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {analysis.targets.map((t) => (
              <span key={t} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-ink">{t}</span>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-black text-gray-500">トーン</p>
          <p className="text-sm font-bold text-ink">{analysis.tone}</p>
        </div>
        <div>
          <p className="text-[11px] font-black text-gray-500">ブランドカラー</p>
          <div className="mt-2 flex gap-2">
            {Object.entries(analysis.colors).map(([k, c]) => (
              <div key={k} className="flex flex-col items-center gap-1">
                <span className="h-10 w-10 rounded-xl shadow-inner" style={{ background: c }} />
                <span className="font-mono text-[10px] text-gray-500">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
