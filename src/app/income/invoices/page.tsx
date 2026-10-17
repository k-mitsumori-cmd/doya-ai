'use client'

// 請求書の一覧
import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import {
  Button, Card, EmptyState, Gate, INVOICE_STATUS_LABEL, InvoiceStatusBadge, ListSkeleton, PageHeader, PageShell, PaymentStateBadge, Tabs,
  fetchJson, s, useResource, ymd, yen,
} from '@/components/income/ui'

type Row = {
  id: string; invoiceNo: string | null; title: string | null; status: string; issueDate: string; dueDate: string; totalInclTax: number
  client: { id: string; name: string }; state: { label: string | null; remaining: number; overdue: boolean }
}

const TABS: [string, string][] = [['', 'すべて'], ...(['draft', 'confirmed', 'sent', 'void'] as const).map((st) => [st, INVOICE_STATUS_LABEL[st]] as [string, string])]

export default function InvoicesPage() {
  const [status, setStatus] = useState('')
  const res = useResource(() => fetchJson<{ invoices: Row[] }>(`/api/income/invoices${status ? `?status=${status}` : ''}`).then((d) => d.invoices), status)
  const empty = !!res.data && res.data.length === 0 && status === ''

  return (
    <PageShell>
      <PageHeader
        crumbs={[{ label: '収入管理', href: '/income' }, { label: '請求書' }]}
        title="請求書"
        sub="下書きを確認して確定すると、請求書番号が付きます"
        actions={!empty && <Button variant="primary" href="/income/invoices/new"><Plus size={16} aria-hidden="true" />新規請求書</Button>}
      />
      <Tabs tabs={TABS} value={status} onChange={setStatus} />
      <Gate res={res} skeleton={<ListSkeleton />}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              image="/income/empty-invoices.webp"
              message={status === '' ? '請求書がまだありません。月次売上から作るか、手入力で作成できます。' : 'この状態の請求書はありません。'}
              action={status === '' ? { label: '請求書を作成する', href: '/income/invoices/new' } : { label: 'すべての請求書を見る', onClick: () => setStatus('') }}
            />
          ) : (
            <Card flush>
              <div className={s.tableWrap}>
                <table className={`${s.table} ${s.tableWide}`}>
                  <thead>
                    <tr>
                      <th>番号</th><th>取引先</th><th>請求日</th><th>支払期日</th><th className={s.r}>請求額（税込）</th><th>状態</th><th className={s.r}>残高</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((i) => (
                      <tr key={i.id}>
                        <td data-label="番号"><Link href={`/income/invoices/${i.id}`} className={s.link}>{i.invoiceNo ?? '（下書き）'}</Link></td>
                        <td data-label="取引先" className={s.strong}>{i.client.name}</td>
                        <td data-label="請求日" style={{ whiteSpace: 'nowrap' }}>{ymd(i.issueDate)}</td>
                        <td data-label="支払期日" className={i.state.overdue ? s.badText : ''} style={{ whiteSpace: 'nowrap' }}>{ymd(i.dueDate)}</td>
                        <td data-label="請求額（税込）" className={s.r} style={{ whiteSpace: 'nowrap' }}>{yen(i.totalInclTax)}</td>
                        <td data-label="状態"><span className="inline-flex flex-wrap gap-1"><InvoiceStatusBadge status={i.status} /><PaymentStateBadge label={i.state.label} /></span></td>
                        <td data-label="残高" className={s.r} style={{ whiteSpace: 'nowrap' }}>{i.state.label ? yen(i.state.remaining) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        }
      </Gate>
    </PageShell>
  )
}
