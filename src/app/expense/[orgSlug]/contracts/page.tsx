'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ds'
import { BILLING_MODEL_LABEL, CATEGORIES, CATEGORY_LABEL, CONTRACT_STATUSES, CONTRACT_STATUS_LABEL, FREQUENCY_LABEL, type BillingModel } from '@/lib/expense/constants'
import { useExpenseQuery } from '@/components/expense/api'
import type { Contract } from '@/components/expense/types'
import {
  Badge, Card, EmptyState, ErrorBox, Loading, PageBody, PageHeader, TableWrap, fmtDate, formatMoney, inputCls, priceSummary,
  tableCls, tbodyCls, tdCls, theadCls, thCls, trCls, useExpenseOrg,
} from '@/components/expense/ui'

export default function ContractsPage() {
  const { orgSlug } = useParams() as { orgSlug: string }
  const { canManage, base } = useExpenseOrg()
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const qs = new URLSearchParams()
  if (category) qs.set('category', category)
  if (status) qs.set('status', status)
  const { data, error, forbidden, loading, reload } = useExpenseQuery<{ contracts: Contract[] }>(`/api/expense/contracts${qs.size ? `?${qs}` : ''}`, orgSlug)

  return (
    <PageBody>
      <PageHeader
        title="支出契約"
        sub="SaaS、業務委託、家賃など、定期的に払う契約の一覧です。"
        actions={canManage ? <Button href={`${base}/contracts/new`} icon={Plus}>契約を追加</Button> : undefined}
      />
      <div className="flex flex-wrap gap-3">
        <select aria-label="カテゴリで絞り込む" className={`${inputCls} !w-auto`} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">すべてのカテゴリ</option>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <select aria-label="状態で絞り込む" className={`${inputCls} !w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">すべての状態</option>{CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      <Card>
        {loading && !data ? <Loading /> : error ? <ErrorBox forbidden={forbidden} onRetry={reload} /> : !data || data.contracts.length === 0 ? (
          <EmptyState image="/expense/empty-contracts.webp" alt="契約はまだありません" text={category || status ? '条件に合う契約はありません。絞り込みを変えてみてください。' : '契約はまだ登録されていません。最初の契約を登録すると、支払予定が自動で作成されます。'} actionLabel={canManage && !category && !status ? '契約を登録する' : undefined} href={`${base}/contracts/new`} />
        ) : (
          <TableWrap>
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>{['名称', '取引先', 'カテゴリ', '周期', '金額', '次回の支払', '終了日', '状態'].map((h, i) => <th key={h} className={`${thCls} ${i === 4 ? 'text-right' : ''}`}>{h}</th>)}</tr>
              </thead>
              <tbody className={tbodyCls}>
                {data.contracts.map((c) => (
                  <tr key={c.id} className={trCls}>
                    <td data-label="名称" className={`${tdCls} md:min-w-[200px]`}><Link href={`${base}/contracts/${c.id}`} className="font-bold text-[var(--blue)] hover:underline">{c.title}</Link></td>
                    <td data-label="取引先" className={`${tdCls} md:min-w-[140px]`}>{c.vendor.name}</td>
                    <td data-label="カテゴリ" className={`${tdCls} whitespace-nowrap`}>{CATEGORY_LABEL[c.category] ?? c.category}</td>
                    <td data-label="周期" className={`${tdCls} whitespace-nowrap`}>{BILLING_MODEL_LABEL[c.billingModel as BillingModel] ?? c.billingModel} / {FREQUENCY_LABEL[c.frequencyMonths]}</td>
                    <td data-label="金額" className={`${tdCls} whitespace-nowrap md:text-right`}>{priceSummary(c)}</td>
                    <td data-label="次回の支払" className={`${tdCls} whitespace-nowrap`}>{c.nextPayment ? `${fmtDate(c.nextPayment.date)} ${formatMoney(c.nextPayment.netPayAmount, 'JPY')}` : '-'}</td>
                    <td data-label="終了日" className={`${tdCls} whitespace-nowrap`}>{c.endDate ? fmtDate(c.endDate) : c.autoRenew ? '自動更新' : '-'}</td>
                    <td data-label="状態" className={`${tdCls} whitespace-nowrap`}><Badge tone={c.status === 'active' ? 'green' : 'slate'}>{CONTRACT_STATUS_LABEL[c.status] ?? c.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </PageBody>
  )
}
