'use client'

// 契約の詳細・編集・売上予定の一覧
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import ContractForm, { type ContractDto } from '@/components/income/ContractForm'
import {
  Button, Card, ConfirmDialog, ContractStatusBadge, DetailSkeleton, EmptyState, Gate, PageHeader, PageShell, ScheduleStatusBadge,
  errMsg, fetchJson, periodText, s, toast, useResource, ymdW, yen,
} from '@/components/income/ui'

type Detail = ContractDto & {
  client: { id: string; name: string }
  schedules: {
    id: string; period: string; plannedIssueDate: string; amountExclTax: number; status: string; skipReason: string | null
    invoiceItem: { invoice: { id: string; invoiceNo: string | null; status: string } } | null
  }[]
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const res = useResource(() => fetchJson<{ contract: Detail }>(`/api/income/contracts/${id}`).then((d) => d.contract), id)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await fetchJson(`/api/income/contracts/${id}`, { method: 'DELETE' })
      toast('契約を削除しました')
      router.push('/income/contracts')
    } catch (e) {
      setError(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <Gate res={res} skeleton={<DetailSkeleton cards={3} />} listHref="/income/contracts" listLabel="契約の一覧">
        {(c) => (
          <>
            <PageHeader
              crumbs={[{ label: '収入管理', href: '/income' }, { label: '契約', href: '/income/contracts' }, { label: c.title }]}
              title={c.title}
              sub={c.client.name}
              actions={
                <>
                  <ContractStatusBadge status={c.status} />
                  <Button variant="danger" onClick={() => { setError(null); setConfirming(true) }}>削除</Button>
                </>
              }
            />
            <div className={s.stackY}>
              <ContractForm key={id} initial={c} onSaved={() => { void res.reload() }} />

              <Card title={`売上予定（${c.schedules.length}）`}>
                {c.schedules.length === 0 ? (
                  <EmptyState image="/income/empty-revenue.webp" message="売上予定はありません。状態を「有効」にして保存すると作られます。" />
                ) : (
                  <div className={s.tableWrap}>
                    <table className={`${s.table} ${s.tableMid}`}>
                      <thead>
                        <tr><th>計上月</th><th>請求予定日</th><th className={s.r}>金額（税抜）</th><th>状態</th><th>請求書</th></tr>
                      </thead>
                      <tbody>
                        {c.schedules.map((sc) => (
                          <tr key={sc.id}>
                            <td data-label="計上月" className={s.strong}>{periodText(sc.period)}</td>
                            <td data-label="請求予定日">{ymdW(sc.plannedIssueDate)}</td>
                            <td data-label="金額（税抜）" className={s.r}>{yen(sc.amountExclTax)}</td>
                            <td data-label="状態">
                              <span>
                                <ScheduleStatusBadge status={sc.status} />
                                {sc.skipReason && <span className={s.sub} style={{ marginLeft: 4 }}>{sc.skipReason}</span>}
                              </span>
                            </td>
                            <td data-label="請求書">
                              {sc.invoiceItem ? (
                                <Link href={`/income/invoices/${sc.invoiceItem.invoice.id}`} className={s.link}>{sc.invoiceItem.invoice.invoiceNo ?? '下書き'}</Link>
                              ) : <span className={s.muted}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            {confirming && (
              <ConfirmDialog
                title="契約を削除しますか"
                message="この契約と、未請求の売上予定を削除します。元に戻せません。"
                confirmLabel="削除する"
                danger
                busy={busy}
                error={error}
                onConfirm={remove}
                onClose={() => setConfirming(false)}
              />
            )}
          </>
        )}
      </Gate>
    </PageShell>
  )
}
