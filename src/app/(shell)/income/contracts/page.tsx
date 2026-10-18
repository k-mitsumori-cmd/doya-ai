'use client'

// 契約の一覧
import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import {
  BILLING_CYCLE_LABEL, Button, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_ORDER, ContractStatusBadge, EmptyState, Gate, ListSkeleton, PageHeader, PageShell, Tabs,
  fetchJson, s, useResource, ymd, yen,
} from '@/components/income/ui'

type Row = {
  id: string; title: string; status: string; type: string; amountExclTax: number; billingCycle: string
  startDate: string; endDate: string | null; client: { id: string; name: string }
}

const TABS: [string, string][] = [['', 'すべて'], ...CONTRACT_STATUS_ORDER.map((st) => [st, CONTRACT_STATUS_LABEL[st]] as [string, string])]

export default function ContractsPage() {
  const [status, setStatus] = useState('')
  const res = useResource(() => fetchJson<{ contracts: Row[] }>(`/api/income/contracts${status ? `?status=${status}` : ''}`).then((d) => d.contracts), status)
  const empty = !!res.data && res.data.length === 0 && status === ''

  return (
    <PageShell>
      <PageHeader
        crumbs={[{ label: '収入管理', href: '/income' }, { label: '契約' }]}
        title="契約"
        sub="有効な契約から、月ごとの売上予定が自動で作られます"
        actions={!empty && <Button variant="primary" href="/income/contracts/new"><Plus size={16} aria-hidden="true" />新規契約</Button>}
      />
      <Tabs tabs={TABS} value={status} onChange={setStatus} />
      <Gate res={res} skeleton={<ListSkeleton />}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              image="/income/empty-contracts.webp"
              message={status === '' ? '契約がまだありません。契約を登録すると、月ごとの売上予定が自動で作られます。' : 'この状態の契約はありません。'}
              action={status === '' ? { label: '契約を登録する', href: '/income/contracts/new' } : { label: 'すべての契約を見る', onClick: () => setStatus('') }}
            />
          ) : (
            <ul className="m-0 space-y-3 p-0" style={{ listStyle: 'none' }}>
              {rows.map((c) => (
                <li key={c.id}>
                  <Link href={`/income/contracts/${c.id}`} className={s.rowLink}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`${s.strong} ${s.truncate}`} style={{ margin: 0 }}>{c.title}</p>
                      <ContractStatusBadge status={c.status} />
                    </div>
                    <div className={`${s.sub} mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1`}>
                      <span>{c.client.name}</span>
                      <span className={`${s.num} ${s.strong}`}>
                        {c.type === 'one_time' ? '単発 ' : `${BILLING_CYCLE_LABEL[c.billingCycle] ?? ''} `}{yen(c.amountExclTax)}（税抜）
                      </span>
                      <span>{ymd(c.startDate)} 〜 {ymd(c.endDate) || '期間の定めなし'}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </Gate>
    </PageShell>
  )
}
