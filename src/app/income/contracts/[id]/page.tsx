'use client'

// 契約の詳細・編集・売上予定の一覧
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import ContractForm, { type ContractDto } from '@/components/income/ContractForm'
import {
  Card, ContractStatusBadge, Empty, ErrorText, Loading, PageHeader, PageShell, ScheduleStatusBadge, Spinner,
  btnDanger, errMsg, fetchJson, periodText, ymdW, yen,
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
  const [c, setC] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setC((await fetchJson<{ contract: Detail }>(`/api/income/contracts/${id}`)).contract)
    } catch (e) {
      setError(errMsg(e))
    }
  }, [id])
  useEffect(() => { load() }, [load])

  const remove = async () => {
    if (!window.confirm('この契約と、未請求の売上予定を削除します。よろしいですか？')) return
    setBusy(true)
    setError(null)
    try {
      await fetchJson(`/api/income/contracts/${id}`, { method: 'DELETE' })
      router.push('/income/contracts')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!c) return <PageShell>{error ? <ErrorText message={error} /> : <Loading />}</PageShell>

  return (
    <PageShell>
      <Link href="/income/contracts" className="mb-3 inline-flex items-center gap-1 text-xs font-black text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" />契約の一覧
      </Link>
      <PageHeader
        title={c.title}
        sub={c.client.name}
        actions={
          <>
            <ContractStatusBadge status={c.status} />
            <button type="button" onClick={remove} disabled={busy} className={btnDanger}>{busy && <Spinner />}削除</button>
          </>
        }
      />
      <ErrorText message={error} />
      <div className="mt-3 space-y-4">
        <ContractForm key={id} initial={c} onSaved={load} />

        <Card title={`売上予定（${c.schedules.length}）`}>
          {c.schedules.length === 0 ? (
            <Empty>売上予定はありません。状態を「有効」にして保存すると作られます。</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] font-black text-slate-500">
                    <th className="py-2 pr-3">計上月</th><th className="py-2 pr-3">請求予定日</th><th className="py-2 pr-3 text-right">金額（税抜）</th>
                    <th className="py-2 pr-3">状態</th><th className="py-2">請求書</th>
                  </tr>
                </thead>
                <tbody>
                  {c.schedules.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-black text-slate-800">{periodText(s.period)}</td>
                      <td className="py-2 pr-3 font-bold text-slate-600">{ymdW(s.plannedIssueDate)}</td>
                      <td className="py-2 pr-3 text-right font-bold tabular-nums text-slate-900">{yen(s.amountExclTax)}</td>
                      <td className="py-2 pr-3">
                        <ScheduleStatusBadge status={s.status} />
                        {s.skipReason && <span className="ml-1 text-[11px] font-bold text-slate-400">{s.skipReason}</span>}
                      </td>
                      <td className="py-2">
                        {s.invoiceItem ? (
                          <Link href={`/income/invoices/${s.invoiceItem.invoice.id}`} className="font-black text-[#0f9f6e] hover:underline">
                            {s.invoiceItem.invoice.invoiceNo ?? '下書き'}
                          </Link>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  )
}
