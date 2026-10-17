'use client'

// 契約の一覧
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import {
  BILLING_CYCLE_LABEL, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_ORDER, ContractStatusBadge, Empty, ErrorText, Loading, PageHeader, PageShell,
  btnPrimary, errMsg, fetchJson, ymd, yen,
} from '@/components/income/ui'

type Row = {
  id: string; title: string; status: string; type: string; amountExclTax: number; billingCycle: string
  startDate: string; endDate: string | null; client: { id: string; name: string }
}

export default function ContractsPage() {
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows((await fetchJson<{ contracts: Row[] }>(`/api/income/contracts${status ? `?status=${status}` : ''}`)).contracts)
    } catch (e) {
      setError(errMsg(e))
    }
  }, [status])
  useEffect(() => { load() }, [load])

  const tabs: [string, string][] = [['', 'すべて'], ...CONTRACT_STATUS_ORDER.map((s) => [s, CONTRACT_STATUS_LABEL[s]] as [string, string])]

  return (
    <PageShell>
      <PageHeader
        title="契約"
        sub="有効な契約から、月ごとの売上予定が自動で作られます"
        actions={<Link href="/income/contracts/new" className={btnPrimary}><Plus className="h-4 w-4" />新規契約</Link>}
      />
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => { setRows(null); setStatus(k) }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-black ${status === k ? 'bg-[#0f9f6e] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorText message={error} />
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <Empty>該当する契約がありません。</Empty>}
      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/income/contracts/${c.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-black text-slate-900">{c.title}</p>
                  <ContractStatusBadge status={c.status} />
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
                  <span>{c.client.name}</span>
                  <span className="tabular-nums text-slate-800">
                    {c.type === 'one_time' ? '単発 ' : `${BILLING_CYCLE_LABEL[c.billingCycle] ?? ''} `}{yen(c.amountExclTax)}（税抜）
                  </span>
                  <span>{ymd(c.startDate)} 〜 {ymd(c.endDate) || '期間の定めなし'}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
