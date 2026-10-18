'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ds'
import { BILLING_MODEL_LABEL, type BillingModel } from '@/lib/expense/constants'
import { useExpenseQuery } from '@/components/expense/api'
import type { Vendor } from '@/components/expense/types'
import {
  Badge, Card, EmptyState, ErrorBox, Loading, MonthSwitcher, PageBody, PageHeader, StatusBadge, TableWrap,
  currentYm, fmtMonthLabel, formatYen, isYm, tableCls, tbodyCls, tdCls, theadCls, thCls, trCls, useExpenseOrg,
} from '@/components/expense/ui'

interface Row {
  vendor: Vendor
  contractCount: number
  billingModel: string | null
  frequencyMonths: number | null
  withholding: boolean
  endDate: string | null
  autoRenew: boolean
  month: { netPayAmount: number; status: string | null; payDate: string | null }
  flags: string[]
}
const FLAG: Record<string, string> = { bill_missing: '請求書待ち', overdue: '支払日超過', amount_diff: '金額差異' }

function form(r: Row) {
  if (!r.billingModel) return '-'
  if (r.billingModel === 'fixed' && r.frequencyMonths === 6) return '半年まとめ'
  return BILLING_MODEL_LABEL[r.billingModel as BillingModel] ?? r.billingModel
}

function Inner() {
  const { orgSlug } = useParams() as { orgSlug: string }
  const { canManage, base } = useExpenseOrg()
  const router = useRouter()
  const q = useSearchParams().get('month')
  const month = isYm(q) ? q : currentYm()
  const { data, error, forbidden, loading, reload } = useExpenseQuery<{ contractors: Row[]; total: number }>(`/api/expense/contractors?month=${month}`, orgSlug)
  const addHref = `${base}/contracts/new?preset=contractor`

  return (
    <PageBody>
      <PageHeader
        title="業務委託"
        sub={data ? `${fmtMonthLabel(month)}の支払予定 合計 ${formatYen(data.total)}` : undefined}
        actions={
          <>
            <MonthSwitcher value={month} onChange={(m) => router.replace(`?month=${m}`)} />
            {canManage && <Button href={addHref} icon="Plus">業務委託を追加</Button>}
          </>
        }
      />
      <Card>
        {loading && !data ? <Loading /> : error ? <ErrorBox forbidden={forbidden} onRetry={reload} /> : !data || data.contractors.length === 0 ? (
          <EmptyState image="/expense/empty-contractors.webp" alt="業務委託はまだ登録されていません" text="業務委託の方はまだ登録されていません。契約を登録すると、人ごとの支払状況をこの画面で確認できます。" actionLabel={canManage ? '業務委託を追加' : undefined} href={addHref} />
        ) : (
          <TableWrap>
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>{['名前', '担当', '契約の形', `${Number(month.slice(5))}月の支払`, '状態', '契約終了'].map((h, i) => <th key={h} className={`${thCls} ${i === 3 ? 'text-right' : ''}`}>{h}</th>)}</tr>
              </thead>
              <tbody className={tbodyCls}>
                {data.contractors.map((r) => (
                  <tr key={r.vendor.id} className={trCls}>
                    <td data-label="名前" className={tdCls}>
                      <Link href={`${base}/contractors/${r.vendor.id}`} className="font-bold text-[var(--blue)] hover:underline">{r.vendor.name}さん</Link>
                    </td>
                    <td data-label="担当" className={tdCls}>{r.vendor.role ?? '-'}</td>
                    <td data-label="契約の形" className={tdCls}>{form(r)}{r.withholding && <Badge tone="slate">源泉あり</Badge>}</td>
                    <td data-label="今月の支払" className={`${tdCls} md:text-right`}>{r.month.status ? formatYen(r.month.netPayAmount) : '-'}</td>
                    <td data-label="状態" className={tdCls}>
                      <span className="flex flex-wrap justify-end gap-1 md:justify-start">
                        <StatusBadge status={r.month.status} />
                        {r.flags.map((f) => <Badge key={f} tone={f === 'overdue' ? 'red' : 'amber'}>{FLAG[f] ?? f}</Badge>)}
                      </span>
                    </td>
                    <td data-label="契約終了" className={tdCls}>{r.autoRenew ? '自動更新' : r.endDate ? r.endDate.slice(0, 7).replace('-', '/') : '期限なし'}</td>
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

export default function ContractorsPage() {
  return <Suspense fallback={<Loading />}><Inner /></Suspense>
}
