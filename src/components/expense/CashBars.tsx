'use client'

// 月ごとの出金をカテゴリ別に積み上げた棒グラフ（div だけで描く。見込み分は薄い色）
import { CATEGORY_LABEL } from '@/lib/expense/constants'
import type { ForecastMatrix } from './types'
import { formatYen } from './ui'

export const CATEGORY_COLOR: Record<string, string> = {
  saas: 'var(--blue)',
  contractor: 'var(--navy)',
  rent: 'var(--blue-deep)',
  ads: 'var(--muted)',
  payroll: 'var(--sub)',
  utility: 'var(--line-strong)',
  other: 'var(--blue-line)',
  withholding_tax: 'var(--pink)',
}
const colorOf = (c: string) => CATEGORY_COLOR[c] ?? 'var(--blue-line)'

export default function CashBars({ cash }: { cash: ForecastMatrix }) {
  const max = Math.max(1, ...cash.months.map((m) => cash.totals[m]?.amount ?? 0))
  const H = 160
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex min-w-[560px] items-end gap-2" style={{ height: H + 40 }}>
          {cash.months.map((m) => {
            const total = cash.totals[m]?.amount ?? 0
            return (
              <div key={m} className="flex flex-1 flex-col items-center justify-end" title={`${m} 合計 ${formatYen(total)}`}>
                <span className="mb-1 text-[10px] font-bold text-[var(--sub)]">{total ? `${Math.round(total / 1000).toLocaleString('ja-JP')}千` : ''}</span>
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: Math.round((total / max) * H) }}>
                  {cash.categories.map((c) => {
                    const cell = cash.cells[c]?.[m]
                    if (!cell || cell.amount <= 0) return null
                    const sure = cell.amount - cell.estimated
                    return (
                      <div key={c} className="flex w-full flex-col-reverse" style={{ height: `${(cell.amount / total) * 100}%` }} title={`${CATEGORY_LABEL[c] ?? c}: ${formatYen(cell.amount)}（うち見込み ${formatYen(cell.estimated)}）`}>
                        {sure > 0 && <div style={{ background: colorOf(c), height: `${(sure / cell.amount) * 100}%` }} />}
                        {cell.estimated > 0 && <div style={{ background: colorOf(c), opacity: 0.4, height: `${(cell.estimated / cell.amount) * 100}%` }} />}
                      </div>
                    )
                  })}
                </div>
                <span className="mt-1 text-[10px] font-bold text-[var(--sub)]">{Number(m.slice(5))}月</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {cash.categories.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--sub)]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(c) }} />
            {CATEGORY_LABEL[c] ?? c}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--sub)]">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--sub)] opacity-40" />
          薄い色は見込み
        </span>
      </div>
    </div>
  )
}
