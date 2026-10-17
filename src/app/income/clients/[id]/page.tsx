'use client'

// 取引先の詳細・編集
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import ClientForm, { type ClientDto } from '@/components/income/ClientForm'
import {
  Card, ContractStatusBadge, Empty, ErrorText, InvoiceStatusBadge, Loading, PageHeader, PageShell, PaymentStateBadge, Spinner,
  btnDanger, btnPrimary, btnSecondary, errMsg, fetchJson, ymd, yen, BILLING_CYCLE_LABEL,
} from '@/components/income/ui'

type Detail = ClientDto & {
  contracts: { id: string; title: string; status: string; amountExclTax: number; billingCycle: string; startDate: string; endDate: string | null }[]
  invoices: { id: string; invoiceNo: string | null; title: string | null; status: string; issueDate: string; totalInclTax: number; state: { label: string | null; remaining: number } }[]
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setClient((await fetchJson<{ client: Detail }>(`/api/income/clients/${id}`)).client)
    } catch (e) {
      setError(errMsg(e))
    }
  }, [id])
  useEffect(() => { load() }, [load])

  const remove = async () => {
    if (!client) return
    const hasHistory = client.contracts.length + client.invoices.length > 0
    const msg = hasHistory ? '契約や請求書があるため、削除ではなく「取引終了」にします。よろしいですか？' : 'この取引先を削除します。よろしいですか？'
    if (!window.confirm(msg)) return
    setBusy(true)
    setError(null)
    try {
      const r = await fetchJson<{ deactivated?: boolean }>(`/api/income/clients/${id}`, { method: 'DELETE' })
      if (r.deactivated) await load()
      else router.push('/income/clients')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!client) {
    return <PageShell>{error ? <ErrorText message={error} /> : <Loading />}</PageShell>
  }

  return (
    <PageShell>
      <Link href="/income/clients" className="mb-3 inline-flex items-center gap-1 text-xs font-black text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" />取引先の一覧
      </Link>
      <PageHeader
        title={client.name}
        actions={
          <>
            <Link href={`/income/contracts/new?clientId=${client.id}`} className={btnPrimary}><Plus className="h-4 w-4" />契約を登録</Link>
            <button type="button" onClick={remove} disabled={busy} className={btnDanger}>
              {busy && <Spinner />}
              {client.contracts.length + client.invoices.length > 0 ? '取引終了にする' : '削除'}
            </button>
          </>
        }
      />
      <ErrorText message={error} />
      <div className="mt-3 space-y-4">
        <Card title="基本情報">
          <ClientForm
            key={client.updatedAt}
            initial={client}
            submitLabel="保存する"
            onSubmit={async (payload) => {
              setSaved(false)
              await fetchJson(`/api/income/clients/${id}`, { method: 'PATCH', body: payload })
              await load()
              setSaved(true)
            }}
          />
          {saved && <p className="mt-2 text-xs font-black text-[#0f9f6e]">保存しました</p>}
        </Card>

        <Card title={`契約（${client.contracts.length}）`}>
          {client.contracts.length === 0 ? (
            <Empty>この取引先の契約はまだありません。</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {client.contracts.map((c) => (
                <li key={c.id}>
                  <Link href={`/income/contracts/${c.id}`} className="flex flex-wrap items-center gap-2 py-2.5 hover:bg-slate-50">
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-900">{c.title}</span>
                    <ContractStatusBadge status={c.status} />
                    <span className="text-xs font-bold tabular-nums text-slate-700">{yen(c.amountExclTax)}（{BILLING_CYCLE_LABEL[c.billingCycle] ?? ''}）</span>
                    <span className="text-xs font-bold text-slate-400">{ymd(c.startDate)} 〜 {ymd(c.endDate) || '期間の定めなし'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`請求書（直近${client.invoices.length}件）`}>
          {client.invoices.length === 0 ? (
            <Empty>この取引先の請求書はまだありません。</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {client.invoices.map((i) => (
                <li key={i.id}>
                  <Link href={`/income/invoices/${i.id}`} className="flex flex-wrap items-center gap-2 py-2.5 hover:bg-slate-50">
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-900">{i.invoiceNo ?? '（下書き）'} {i.title}</span>
                    <InvoiceStatusBadge status={i.status} />
                    <PaymentStateBadge label={i.state.label} />
                    <span className="text-xs font-bold text-slate-400">{ymd(i.issueDate)}</span>
                    <span className="text-xs font-bold tabular-nums text-slate-700">{yen(i.totalInclTax)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="mt-4"><Link href="/income/clients" className={btnSecondary}>一覧に戻る</Link></div>
    </PageShell>
  )
}
