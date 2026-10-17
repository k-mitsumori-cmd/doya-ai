'use client'

// 請求書の一覧
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import {
  Empty, ErrorText, INVOICE_STATUS_LABEL, InvoiceStatusBadge, Loading, PageHeader, PageShell, PaymentStateBadge,
  btnPrimary, errMsg, fetchJson, ymd, yen,
} from '@/components/income/ui'

type Row = {
  id: string; invoiceNo: string | null; title: string | null; status: string; issueDate: string; dueDate: string; totalInclTax: number
  client: { id: string; name: string }; state: { label: string | null; remaining: number; overdue: boolean }
}

const TABS: [string, string][] = [['', 'すべて'], ...(['draft', 'confirmed', 'sent', 'void'] as const).map((s) => [s, INVOICE_STATUS_LABEL[s]] as [string, string])]

export default function InvoicesPage() {
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows((await fetchJson<{ invoices: Row[] }>(`/api/income/invoices${status ? `?status=${status}` : ''}`)).invoices)
    } catch (e) {
      setError(errMsg(e))
    }
  }, [status])
  useEffect(() => { load() }, [load])

  return (
    <PageShell>
      <PageHeader
        title="請求書"
        sub="下書きを確認して確定すると、請求書番号が付きます"
        actions={<Link href="/income/invoices/new" className={btnPrimary}><Plus className="h-4 w-4" />新規請求書</Link>}
      />
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => { setRows(null); setStatus(k) }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-black ${status === k ? 'bg-[#0f9f6e] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>
      <ErrorText message={error} />
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <Empty>該当する請求書がありません。</Empty>}
      {rows && rows.length > 0 && (
        <>
          {/* PC: 表 */}
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-black text-slate-500">
                  <th className="py-2.5 pl-4 pr-3">番号</th><th className="py-2.5 pr-3">取引先</th><th className="py-2.5 pr-3">請求日</th>
                  <th className="py-2.5 pr-3">支払期日</th><th className="py-2.5 pr-3 text-right">請求額（税込）</th><th className="py-2.5 pr-3">状態</th>
                  <th className="py-2.5 pr-4 text-right">残高</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 pl-4 pr-3"><Link href={`/income/invoices/${i.id}`} className="font-black text-[#0f9f6e] hover:underline">{i.invoiceNo ?? '（下書き）'}</Link></td>
                    <td className="py-2.5 pr-3 font-black text-slate-900">{i.client.name}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 font-bold text-slate-600">{ymd(i.issueDate)}</td>
                    <td className={`whitespace-nowrap py-2.5 pr-3 font-bold ${i.state.overdue ? 'text-red-600' : 'text-slate-600'}`}>{ymd(i.dueDate)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right font-bold tabular-nums">{yen(i.totalInclTax)}</td>
                    <td className="py-2.5 pr-3"><span className="inline-flex gap-1"><InvoiceStatusBadge status={i.status} /><PaymentStateBadge label={i.state.label} /></span></td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-right font-bold tabular-nums">{i.state.label ? yen(i.state.remaining) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* スマホ: カード */}
          <ul className="space-y-2 md:hidden">
            {rows.map((i) => (
              <li key={i.id}>
                <Link href={`/income/invoices/${i.id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-900">{i.invoiceNo ?? '（下書き）'}</span>
                    <span className="inline-flex gap-1"><InvoiceStatusBadge status={i.status} /><PaymentStateBadge label={i.state.label} /></span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-bold text-slate-600">{i.client.name}</p>
                  <div className="mt-1 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>請求 {ymd(i.issueDate)} / 期日 <span className={i.state.overdue ? 'text-red-600' : ''}>{ymd(i.dueDate)}</span></span>
                    <span className="tabular-nums text-slate-900">{yen(i.totalInclTax)}</span>
                  </div>
                  {i.state.label && i.state.remaining > 0 && <p className="mt-0.5 text-right text-[11px] font-bold text-slate-500">残高 {yen(i.state.remaining)}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  )
}
