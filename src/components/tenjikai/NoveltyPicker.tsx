'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, ExternalLink, Gift } from 'lucide-react'
import { clsx } from 'clsx'
import { CountUp, PageHeader, cardIn } from './ui'
import { expectedVisitors, noveltyQty, recommendPrinters, yen, type Novelty, type ProjectInput } from '@/lib/tenjikai/engine'
import { ds } from '@/lib/tenjikai/tokens'

const TIERS: Novelty['tier'][] = ['商談者', '名刺交換者', '来場者全員']

export default function NoveltyPicker({ input, novelties, selected, setSelected }: { input: ProjectInput; novelties: Novelty[]; selected: string[]; setSelected: (s: string[]) => void }) {
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const total = novelties.filter((n) => selected.includes(n.id)).reduce((s, n) => s + n.unitYen * noveltyQty(n, input), 0)
  const partners = recommendPrinters('novelty')

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <PageHeader
        title="ノベルティ"
        desc={`想定の来場者は ${expectedVisitors(input).toLocaleString()} 人です。商談者・名刺交換者・来場者全員の3段に分けて、渡すものと数量を提案します。`}
        right={
          <div className="rounded-[var(--r-sm)] border border-gray-200 bg-white px-4 py-3 text-right">
            <p className="text-[11px] font-black text-gray-500">選択中の合計</p>
            <CountUp value={total} format={yen} className="font-mono text-xl font-semibold text-ink tabular" />
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        {TIERS.map((tier, ti) => (
          <div key={tier} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-black text-white">{tier}向け</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {novelties.filter((n) => n.tier === tier).map((n, i) => {
                const on = selected.includes(n.id)
                const qty = noveltyQty(n, input)
                return (
                  <motion.button
                    key={n.id}
                    {...cardIn(ti * 2 + i)}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggle(n.id)}
                    className={clsx('relative flex flex-col gap-2 rounded-[var(--r)] border-2 bg-white p-5 text-left transition-colors', on ? 'border-doya-500 shadow-[0_14px_40px_-24px_rgba(0,102,255,.8)]' : 'border-gray-200 hover:border-doya-200')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[var(--r-sm)] bg-doya-50 text-doya-600">
                        <Gift className="h-5 w-5" />
                      </div>
                      <motion.span animate={{ scale: on ? 1 : 0.8, backgroundColor: on ? ds.blue : ds.paper }} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-doya-500">
                        <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="h-3.5 w-3.5 text-white" /></motion.span>}</AnimatePresence>
                      </motion.span>
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-ink">{n.name}</h3>
                      {n.recommended && <span className="flex-shrink-0 whitespace-nowrap rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-amber-950">おすすめ</span>}
                    </div>
                    <p className="text-xs leading-relaxed text-gray-600">{n.reason}</p>
                    <div className="mt-auto grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 font-mono text-[11px]">
                      <div><p className="text-gray-400">単価</p><p className="font-semibold text-ink">{yen(n.unitYen)}</p></div>
                      <div><p className="text-gray-400">数量</p><p className="font-semibold text-ink">{qty.toLocaleString()}</p></div>
                      <div><p className="text-gray-400">納期</p><p className="font-semibold text-ink">{n.leadDays}日</p></div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--r)] border border-gray-200 bg-white p-5 md:flex-row md:items-center">
        <p className="text-sm font-black text-ink">名入れノベルティの発注先</p>
        {partners.map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-[var(--r-sm)] bg-gray-50 px-4 py-3 hover:bg-doya-50">
            <span className="min-w-0">
              <span className="block text-sm font-black text-ink">{p.name}</span>
              <span className="block text-[11px] text-gray-500">{p.strength}</span>
            </span>
            <ExternalLink className="h-4 w-4 flex-shrink-0 text-doya-600" />
          </a>
        ))}
      </div>
    </div>
  )
}
