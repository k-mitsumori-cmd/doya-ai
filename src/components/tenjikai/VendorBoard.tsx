'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ClipboardCopy, ExternalLink, FileText } from 'lucide-react'
import { clsx } from 'clsx'
import IsoBooth from './IsoBooth'
import { Modal, PageHeader, cardIn } from './ui'
import { BUDGET_META, KIND_LABEL, POSITION_LABEL, PRINT_PARTNERS, VENDORS, boothSize, generateDeadlines, man, recommendPrinters, yen, type BoothPlan, type BudgetLine, type Creative, type ProjectInput, type SiteAnalysis, type Vendor } from '@/lib/tenjikai/engine'
import type { FullTenjikaiWorkspace } from '@/lib/tenjikai/workspace-dto'

const CATS: Vendor['category'][] = ['装飾・施工', '印刷', 'ノベルティ', '人材']

function specText(input: ProjectInput, plan: BoothPlan, creatives: Creative[], analysis: SiteAnalysis, picked: Vendor[], savedWorkspace?: FullTenjikaiWorkspace) {
  const venue = savedWorkspace?.venueSnapshot ?? boothSize(input).venue
  const dl = savedWorkspace?.deadlines ?? generateDeadlines(input)
  return [
    `【発注仕様書】${input.eventName} 出展ブース`,
    `出展社：${analysis.brand}`,
    `会場：${venue.name} / 会期：${input.eventStart} から${input.days}日間`,
    `小間：${input.komaCols * input.komaRows}小間（${plan.widthM}m × ${plan.depthM}m）${POSITION_LABEL[input.position]} / 高さ制限 ${venue.maxHeightM}m`,
    `設営案：${plan.variant} ${plan.name} ─ ${plan.concept}`,
    '',
    '■ 部材',
    ...plan.elements.map((e) => `・${e.label}（${KIND_LABEL[e.kind]}）W${Math.round(e.w * 1000)} × D${Math.round(e.d * 1000)} × H${Math.round(e.h * 1000)}mm`),
    '',
    '■ 制作物',
    ...creatives.map((c) => `・${c.name} ${c.size} × ${c.qty.toLocaleString()}`),
    '',
    '■ 電気',
    `・モニター ${plan.elements.filter((e) => e.kind === 'monitor').length}台、デモ機・照明用にコンセント 4口以上`,
    '',
    '■ スケジュール',
    ...dl.filter((d) => ['装飾業者', '印刷・ノベルティ'].includes(d.owner)).map((d) => `・${d.date} ${d.title}`),
    '',
    `■ 見積依頼先：${picked.map((v) => v.name).join('、') || '未選択'}`,
  ].join('\n')
}

export default function VendorBoard({ input, plan, creatives, analysis, budget, savedWorkspace }: { input: ProjectInput; plan: BoothPlan; creatives: Creative[]; analysis: SiteAnalysis; budget: BudgetLine[]; savedWorkspace?: FullTenjikaiWorkspace }) {
  const [cat, setCat] = useState<Vendor['category']>('装飾・施工')
  const [picked, setPicked] = useState<string[]>(['v1', 'v4', 'v5'])
  const [specOpen, setSpecOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const pickedVendors = VENDORS.filter((v) => picked.includes(v.id))
  const buildBudget = budget.find((b) => b.category === 'build')?.amountYen ?? 0
  const text = specText(input, plan, creatives, analysis, pickedVendors, savedWorkspace)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const partnerKind = cat === '印刷' ? 'flyer' : cat === 'ノベルティ' ? 'novelty' : null

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <PageHeader
        title="業者選定・発注"
        desc="設営そのものは業者に依頼します。予算と納期から候補を絞り、図面と部材表をまとめた発注仕様書を作って相見積を取ります。"
        right={
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setSpecOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-doya-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-doya-500/30">
            <FileText className="h-4 w-4" /> 発注仕様書を作成（{picked.length}社）
          </motion.button>
        }
      />

      <div className="flex gap-1 overflow-x-auto rounded-[var(--r-sm)] border border-gray-200 bg-white p-1">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={clsx('relative flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black', cat === c ? 'text-white' : 'text-ink hover:bg-gray-50')}>
            {cat === c && <motion.span layoutId="vendorTab" className="absolute inset-0 rounded-xl bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="relative">{c}</span>
          </button>
        ))}
      </div>

      {partnerKind && (
        <motion.div key={cat} {...cardIn(0)} className="rounded-[var(--r)] border-2 border-amber-300 bg-amber-50/60 p-5">
          <p className="mb-3 text-sm font-black text-ink">おすすめのネット{cat === '印刷' ? '印刷' : 'ノベルティ'}サービス</p>
          <div className="grid gap-3 md:grid-cols-3">
            {(partnerKind === 'novelty' ? recommendPrinters('novelty') : PRINT_PARTNERS).map((p, i) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-1 rounded-[var(--r-sm)] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-black text-ink">
                    {i === 0 && <span className="rounded bg-amber-400 px-1 text-[9px] text-amber-950">おすすめ</span>}
                    {p.name}
                  </span>
                  <ExternalLink className="h-4 w-4 text-doya-600 transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="text-[11px] leading-relaxed text-gray-500">{p.strength}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {p.kinds.map((k) => (
                    <span key={k} className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600">{k === 'novelty' ? 'ノベルティ' : creatives.find((c) => c.kind === k)?.name ?? k}</span>
                  ))}
                </span>
              </a>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {VENDORS.filter((v) => v.category === cat).map((v, i) => {
          const on = picked.includes(v.id)
          const fits = v.category !== '装飾・施工' || v.minYen <= buildBudget
          return (
            <motion.button key={v.id} {...cardIn(i + 1)} onClick={() => setPicked(on ? picked.filter((x) => x !== v.id) : [...picked, v.id])} className={clsx('flex flex-col gap-3 rounded-[var(--r)] border-2 bg-white p-5 text-left transition-colors', on ? 'border-doya-500' : 'border-gray-200 hover:border-doya-200')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-black text-ink">{v.name}</h3>
                  <p className="text-[11px] font-bold text-gray-500">{v.area}</p>
                </div>
                <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full border-2', on ? 'border-doya-500 bg-doya-500' : 'border-gray-300')}>{on && <Check className="h-3.5 w-3.5 text-white" />}</span>
              </div>
              <p className="text-xs leading-relaxed text-gray-600">{v.strength}</p>
              <div>
                <div className="mb-1 flex justify-between text-[11px] font-black"><span className="text-gray-500">条件との合致</span><span className="font-mono text-doya-600">{v.match}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-doya-500 to-amber-400" initial={{ width: 0 }} animate={{ width: `${v.match}%` }} transition={{ delay: 0.2 + i * 0.1, duration: 0.8 }} />
                </div>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-3 font-mono text-[11px]">
                <span className="text-gray-500">最低 {man(v.minYen)}</span>
                <span className="text-gray-500">納期 {v.leadDays}日</span>
                <span className={fits ? 'text-emerald-600' : 'text-rose-600'}>{fits ? '予算内' : '予算超過'}</span>
              </div>
            </motion.button>
          )
        })}
      </div>
      <p className="text-[11px] text-gray-400">装飾業者と人材会社の候補は見本です。実在の業者ではありません。</p>

      <Modal open={specOpen} onClose={() => setSpecOpen(false)} title="発注仕様書プレビュー">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
            <div className="aspect-[4/3] rounded-[var(--r-sm)] border border-gray-200 bg-gray-50 p-2">
              <IsoBooth plan={plan} analysis={analysis} compact />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              <dt className="font-black text-gray-500">展示会</dt><dd className="font-bold text-ink">{input.eventName}</dd>
              <dt className="font-black text-gray-500">小間</dt><dd className="font-bold text-ink">{plan.widthM}m × {plan.depthM}m / {POSITION_LABEL[input.position]}</dd>
              <dt className="font-black text-gray-500">設営案</dt><dd className="font-bold text-ink">{plan.variant} {plan.name}</dd>
              <dt className="font-black text-gray-500">装飾予算</dt><dd className="font-mono text-ink">{yen(buildBudget)}</dd>
              <dt className="font-black text-gray-500">依頼先</dt><dd className="font-bold text-ink">{pickedVendors.map((v) => v.name).join('、') || '未選択'}</dd>
              <dt className="font-black text-gray-500">予算配分</dt>
              <dd className="flex h-2 overflow-hidden rounded-full">
                {budget.map((b) => (
                  <span key={b.category} style={{ flex: b.amountYen, background: BUDGET_META[b.category].color }} />
                ))}
              </dd>
            </dl>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[var(--r-sm)] bg-gray-50 p-4 font-mono text-[11px] leading-relaxed text-ink">{text}</pre>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-[11px] text-gray-400">業者へ送る機能はまだありません。仕様書をコピーして、メールに貼って送ってください。</span>
            <button onClick={copy} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-black text-white">
              {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              {copied ? 'コピーしました' : '仕様書をコピー'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
