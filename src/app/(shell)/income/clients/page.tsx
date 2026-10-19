'use client'

// 取引先の一覧と登録
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import ClientForm, { type ClientDto } from '@/components/income/ClientForm'
import {
  Button, Card, CheckRow, EmptyState, Gate, ListSkeleton, PageHeader, PageShell, fetchJson, s, useResource,
} from '@/components/income/ui'
import { describePaymentTerms } from '@/lib/income/dates'

type Row = ClientDto & { _count: { contracts: number; invoices: number } }

export default function ClientsPage() {
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)
  const [creating, setCreating] = useState(false)
  const res = useResource(() => fetchJson<{ clients: Row[] }>(`/api/income/clients${showAll ? '?all=1' : ''}`).then((d) => d.clients), String(showAll))

  const empty = !!res.data && res.data.length === 0 && !showAll
  return (
    <PageShell>
      <PageHeader
        crumbs={[{ label: '収入管理', href: '/income' }, { label: '取引先' }]}
        title="取引先"
        sub="請求先の情報と支払条件を管理します"
        actions={!creating && !empty && <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" />新規取引先</Button>}
      />
      {creating && (
        <Card title="取引先を登録" className="mb-4">
          <ClientForm
            submitLabel="登録する"
            onCancel={() => setCreating(false)}
            onSubmit={async (payload) => {
              const d = await fetchJson<{ client: { id: string } }>('/api/income/clients', { method: 'POST', body: payload })
              router.push(`/income/clients/${d.client.id}`)
            }}
          />
        </Card>
      )}
      <div className="mb-2">
        <CheckRow checked={showAll} onChange={setShowAll}>取引終了の取引先も表示する</CheckRow>
      </div>
      <Gate res={res} skeleton={<ListSkeleton />}>
        {(rows) =>
          rows.length === 0 ? (
            creating ? null : (
              <EmptyState
                image="/income/empty-clients.webp"
                message="取引先がまだありません。最初の取引先を登録すると、契約と請求書を作れます。"
                action={{ label: '取引先を登録する', onClick: () => setCreating(true) }}
              />
            )
          ) : (
            <ul className="m-0 space-y-3 p-0" style={{ listStyle: 'none' }}>
              {rows.map((c) => (
                <li key={c.id}>
                  <Link href={`/income/clients/${c.id}`} className={s.rowLink}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`${s.strong} ${s.truncate}`} style={{ margin: 0 }}>
                        {c.name}
                        {!c.isActive && <span className={`${s.badge} ${s.bNeutral}`} style={{ marginLeft: 8 }}>取引終了</span>}
                      </p>
                      <p className={`${s.sub} ${s.num}`} style={{ margin: 0 }}>契約 {c._count.contracts} 件 / 請求書 {c._count.invoices} 件</p>
                    </div>
                    <p className={`${s.sub} ${s.truncate}`} style={{ margin: '4px 0 0' }}>
                      {[c.billingDepartment, c.billingContactName].filter(Boolean).join(' ') || '担当者未登録'}
                      {' / '}
                      {c.closingDay !== null && c.paymentMonths !== null && c.paymentDay !== null
                        ? describePaymentTerms({ closingDay: c.closingDay, paymentMonths: c.paymentMonths, paymentDay: c.paymentDay })
                        : '支払条件: 設定の既定'}
                    </p>
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
