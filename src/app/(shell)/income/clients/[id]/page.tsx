'use client'

// 取引先の詳細・編集
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import ClientForm, { type ClientDto } from '@/components/income/ClientForm'
import {
  BILLING_CYCLE_LABEL, Button, Card, ConfirmDialog, ContractStatusBadge, DetailSkeleton, EmptyState, ErrorText, Gate, InvoiceStatusBadge, PageHeader, PageShell,
  PaymentStateBadge, errMsg, fetchJson, s, toast, useResource, yen, ymd,
} from '@/components/income/ui'

type Detail = ClientDto & {
  contracts: { id: string; title: string; status: string; amountExclTax: number; billingCycle: string; startDate: string; endDate: string | null }[]
  invoices: { id: string; invoiceNo: string | null; title: string | null; status: string; issueDate: string; totalInclTax: number; state: { label: string | null; remaining: number } }[]
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const res = useResource(() => fetchJson<{ client: Detail }>(`/api/income/clients/${id}`).then((d) => d.client), id)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await fetchJson<{ deactivated?: boolean }>(`/api/income/clients/${id}`, { method: 'DELETE' })
      setConfirming(false)
      if (r.deactivated) {
        await res.reload()
        toast('取引終了にしました')
      } else {
        toast('取引先を削除しました')
        router.push('/income/clients')
      }
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <Gate res={res} skeleton={<DetailSkeleton cards={3} />} listHref="/income/clients" listLabel="取引先の一覧">
        {(client) => {
          const hasHistory = client.contracts.length + client.invoices.length > 0
          return (
            <>
              <PageHeader
                crumbs={[{ label: '収入管理', href: '/income' }, { label: '取引先', href: '/income/clients' }, { label: client.name }]}
                title={client.name}
                actions={
                  <>
                    <Button href={`/income/contracts/new?clientId=${client.id}`}><Plus size={16} aria-hidden="true" />契約を登録</Button>
                    <Button variant="danger" onClick={() => { setError(null); setConfirming(true) }}>{hasHistory ? '取引終了にする' : '削除'}</Button>
                  </>
                }
              />
              <div className={s.stackY}>
                <Card title="基本情報">
                  <ClientForm
                    key={client.updatedAt}
                    initial={client}
                    submitLabel="保存する"
                    onSubmit={async (payload) => {
                      await fetchJson(`/api/income/clients/${id}`, { method: 'PATCH', body: payload })
                      await res.reload()
                    }}
                  />
                </Card>

                <Card title={`契約（${client.contracts.length}）`}>
                  {client.contracts.length === 0 ? (
                    <EmptyState image="/income/empty-contracts.webp" message="この取引先の契約はまだありません。契約を登録すると、月ごとの売上予定が作られます。" action={{ label: '契約を登録する', href: `/income/contracts/new?clientId=${client.id}` }} />
                  ) : (
                    <ul className={s.divided}>
                      {client.contracts.map((c) => (
                        <li key={c.id}>
                          <Link href={`/income/contracts/${c.id}`} className={s.lineRow}>
                            <span className={`${s.grow} ${s.strong} ${s.truncate}`}>{c.title}</span>
                            <ContractStatusBadge status={c.status} />
                            <span className={s.num}>{yen(c.amountExclTax)}（{BILLING_CYCLE_LABEL[c.billingCycle] ?? ''}）</span>
                            <span className={s.sub}>{ymd(c.startDate)} 〜 {ymd(c.endDate) || '期間の定めなし'}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card title={`請求書（直近${client.invoices.length}件）`}>
                  {client.invoices.length === 0 ? (
                    <EmptyState image="/income/empty-invoices.webp" message="この取引先の請求書はまだありません。売上予定から請求書を作れます。" action={{ label: '月次売上を開く', href: '/income/revenue' }} />
                  ) : (
                    <ul className={s.divided}>
                      {client.invoices.map((i) => (
                        <li key={i.id}>
                          <Link href={`/income/invoices/${i.id}`} className={s.lineRow}>
                            <span className={`${s.grow} ${s.strong} ${s.truncate}`}>{i.invoiceNo ?? '（下書き）'} {i.title}</span>
                            <InvoiceStatusBadge status={i.status} />
                            <PaymentStateBadge label={i.state.label} />
                            <span className={s.sub}>{ymd(i.issueDate)}</span>
                            <span className={s.num}>{yen(i.totalInclTax)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              {confirming && (
                <ConfirmDialog
                  title={hasHistory ? '取引終了にしますか' : '取引先を削除しますか'}
                  message={hasHistory ? '契約や請求書があるため、削除ではなく「取引終了」にします。新しい契約の選択肢には出なくなりますが、過去の記録は残ります。' : 'この取引先を削除します。元に戻せません。'}
                  confirmLabel={hasHistory ? '取引終了にする' : '削除する'}
                  danger
                  busy={busy}
                  error={error}
                  onConfirm={remove}
                  onClose={() => setConfirming(false)}
                />
              )}
              {!confirming && <div style={{ marginTop: 16 }}><ErrorText message={error} /></div>}
            </>
          )
        }}
      </Gate>
    </PageShell>
  )
}
