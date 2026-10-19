'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { CATEGORY_LABEL } from '@/lib/expense/constants'
import { useExpenseQuery } from '@/components/expense/api'
import type { ForecastMatrix } from '@/components/expense/types'
import CashBars from '@/components/expense/CashBars'
import {
  Card, EmptyState, ErrorBox, Loading, PageBody, PageHeader, TableWrap, fmtMonthLabel, formatYen,
  tableCls, tbodyCls, tdCls, theadCls, thCls, trCls, useExpenseOrg,
} from '@/components/expense/ui'

interface Accrual { month: string; total: number; planned: number; confirmed: number }

export default function ForecastPage() {
  const { orgSlug } = useParams() as { orgSlug: string }
  const { base } = useExpenseOrg()
  const [months, setMonths] = useState<6 | 12>(12)
  const { data, error, forbidden, loading, reload } = useExpenseQuery<{ cash: ForecastMatrix; accrual: Accrual[] }>(`/api/expense/forecast?months=${months}`, orgSlug)

  const Amount = ({ amount, estimated }: { amount: number; estimated: number }) => {
    if (!amount) return <span className="text-[var(--muted)]">-</span>
    if (estimated >= amount) return <span className="italic text-[var(--muted)]">{formatYen(amount)}</span>
    return (
      <span className="text-right">
        {formatYen(amount)}
        {estimated > 0 && <span className="block text-[11px] italic text-[var(--muted)]">うち見込み {formatYen(estimated)}</span>}
      </span>
    )
  }

  return (
    <PageBody>
      <PageHeader
        title="予測"
        sub="口座から出る金額を月ごとに表示します。薄い斜体の金額は、請求書が届いていない見込みの額です。"
        actions={
          <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--line-strong)] bg-[var(--paper)] p-1" role="group" aria-label="期間">
            {([6, 12] as const).map((n) => (
              <button key={n} type="button" aria-pressed={months === n} onClick={() => setMonths(n)} className={`min-h-[44px] rounded-[10px] px-4 text-sm font-bold md:min-h-[36px] ${months === n ? 'border border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue-deep)]' : 'text-[var(--sub)]'}`}>{n}か月</button>
            ))}
          </div>
        }
      />
      {loading && !data ? <Loading kpi /> : error ? <ErrorBox forbidden={forbidden} onRetry={reload} /> : !data || data.cash.categories.length === 0 ? (
        <Card><EmptyState image="/expense/empty-calendar.webp" alt="出金の予定はありません" text="この期間の出金予定はまだありません。契約を登録すると、月ごとの金額を表示します。" actionLabel="契約を登録する" href={`${base}/contracts/new`} /></Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-3 text-[18px] font-bold text-[var(--ink)]">出金月 × カテゴリ</h2>
            <TableWrap>
              <table className={tableCls}>
                <thead className={theadCls}>
                  <tr>
                    <th className={thCls}>出金月</th>
                    {data.cash.categories.map((c) => <th key={c} className={`${thCls} text-right`}>{CATEGORY_LABEL[c] ?? c}</th>)}
                    <th className={`${thCls} text-right`}>合計</th>
                  </tr>
                </thead>
                <tbody className={tbodyCls}>
                  {data.cash.months.map((m) => (
                    <tr key={m} className={trCls}>
                      <td data-label="出金月" className={`${tdCls} font-bold`}>{fmtMonthLabel(m)}</td>
                      {data.cash.categories.map((c) => {
                        const cell = data.cash.cells[c]?.[m] ?? { amount: 0, estimated: 0 }
                        return <td key={c} data-label={CATEGORY_LABEL[c] ?? c} className={`${tdCls} md:justify-end md:text-right`}><Amount {...cell} /></td>
                      })}
                      <td data-label="合計" className={`${tdCls} font-bold md:text-right`}><Amount {...(data.cash.totals[m] ?? { amount: 0, estimated: 0 })} /></td>
                    </tr>
                  ))}
                  <tr className={`${trCls} bg-[var(--bg)]`}>
                    <td data-label="期間の合計" className={`${tdCls} font-bold`}>{months}か月の合計</td>
                    {data.cash.categories.map((c) => {
                      const sum = data.cash.months.reduce((a, m) => ({ amount: a.amount + (data.cash.cells[c]?.[m]?.amount ?? 0), estimated: a.estimated + (data.cash.cells[c]?.[m]?.estimated ?? 0) }), { amount: 0, estimated: 0 })
                      return <td key={c} data-label={CATEGORY_LABEL[c] ?? c} className={`${tdCls} font-bold md:text-right`}><Amount {...sum} /></td>
                    })}
                    <td data-label="合計" className={`${tdCls} font-bold md:text-right`}>{formatYen(data.cash.months.reduce((a, m) => a + (data.cash.totals[m]?.amount ?? 0), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <Card>
            <h2 className="mb-3 text-[18px] font-bold text-[var(--ink)]">月ごとの推移</h2>
            <CashBars cash={data.cash} />
          </Card>

          <Card>
            <h2 className="mb-1 text-[18px] font-bold text-[var(--ink)]">計上月ベース（税抜）</h2>
            <p className="mb-3 text-[13px] text-[var(--sub)]">支払日ではなく、費用の対象月で集計しています。源泉税の納付は含みません。</p>
            <TableWrap>
              <table className={tableCls}>
                <thead className={theadCls}><tr>{['計上月', '合計', '確定済み', '見込み'].map((h, i) => <th key={h} className={`${thCls} ${i > 0 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
                <tbody className={tbodyCls}>
                  {data.accrual.map((a) => (
                    <tr key={a.month} className={trCls}>
                      <td data-label="計上月" className={`${tdCls} font-bold`}>{fmtMonthLabel(a.month)}</td>
                      <td data-label="合計" className={`${tdCls} font-bold md:text-right`}>{formatYen(a.total)}</td>
                      <td data-label="確定済み" className={`${tdCls} md:text-right`}>{formatYen(a.confirmed)}</td>
                      <td data-label="見込み" className={`${tdCls} italic text-[var(--muted)] md:text-right`}>{formatYen(a.planned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        </>
      )}
    </PageBody>
  )
}
