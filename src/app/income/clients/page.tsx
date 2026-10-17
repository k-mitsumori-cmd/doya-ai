'use client'

// 取引先の一覧と登録
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import ClientForm, { type ClientDto } from '@/components/income/ClientForm'
import { btnPrimary, Card, Empty, ErrorText, Loading, PageHeader, PageShell, errMsg, fetchJson } from '@/components/income/ui'
import { describePaymentTerms } from '@/lib/income/dates'

type Row = ClientDto & { _count: { contracts: number; invoices: number } }

export default function ClientsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const d = await fetchJson<{ clients: Row[] }>(`/api/income/clients${showAll ? '?all=1' : ''}`)
      setRows(d.clients)
    } catch (e) {
      setError(errMsg(e))
    }
  }, [showAll])
  useEffect(() => { load() }, [load])

  return (
    <PageShell>
      <PageHeader
        title="取引先"
        sub="請求先の情報と支払条件を管理します"
        actions={!creating && <button type="button" className={btnPrimary} onClick={() => setCreating(true)}><Plus className="h-4 w-4" />新規取引先</button>}
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
      <ErrorText message={error} />
      <label className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-600">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 accent-[#0f9f6e]" />
        取引終了の取引先も表示する
      </label>
      {!rows && !error && <Loading />}
      {rows && rows.length === 0 && <Empty>取引先がまだありません。「新規取引先」から登録してください。</Empty>}
      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/income/clients/${c.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-black text-slate-900">
                    {c.name}
                    {!c.isActive && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">取引終了</span>}
                  </p>
                  <p className="text-xs font-bold text-slate-500">契約 {c._count.contracts} 件 / 請求書 {c._count.invoices} 件</p>
                </div>
                <p className="mt-1 truncate text-xs font-bold text-slate-500">
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
      )}
    </PageShell>
  )
}
