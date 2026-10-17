'use client'

// 月次売上: その月に請求すべき一覧。チェックして請求書を下書きでまとめて作る
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { todayJst } from '@/lib/income/dates'
import {
  Card, Empty, ErrorText, Field, Loading, MonthSwitcher, PageHeader, PageShell, ScheduleStatusBadge, Spinner,
  btnPrimary, btnSecondary, btnSmall, errMsg, fetchJson, inputCls, ymd, ymdW, yen,
} from '@/components/income/ui'

type Sched = {
  id: string; period: string; plannedIssueDate: string; amountExclTax: number; status: string; skipReason: string | null
  client: { id: string; name: string }
  contract: { id: string; title: string; items: { taxRate: number }[] }
  invoiceItem: { invoice: { id: string; invoiceNo: string | null; status: string } } | null
}

function Inner() {
  const router = useRouter()
  const sp = useSearchParams()
  const initial = sp.get('month')
  const [month, setMonth] = useState(initial && /^\d{4}-(0[1-9]|1[0-2])$/.test(initial) ? initial : todayJst().slice(0, 7))
  const [data, setData] = useState<{ today: string; schedules: Sched[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [issueDate, setIssueDate] = useState(todayJst())
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const d = await fetchJson<{ today: string; schedules: Sched[] }>(`/api/income/revenue?month=${month}`)
      setData(d)
      setSelected(new Set())
    } catch (e) {
      setError(errMsg(e))
    }
  }, [month])
  useEffect(() => { setData(null); load() }, [load])

  const changeMonth = (m: string) => {
    setMonth(m)
    router.replace(`/income/revenue?month=${m}`)
  }

  const rows = data?.schedules ?? []
  const planned = rows.filter((r) => r.status === 'planned')
  const isLeak = (r: Sched) => r.status === 'planned' && !!data && ymd(r.plannedIssueDate) <= data.today
  const total = useMemo(() => rows.filter((r) => r.status !== 'skipped').reduce((a, r) => a + r.amountExclTax, 0), [rows])
  const selectedTotal = useMemo(() => rows.filter((r) => selected.has(r.id)).reduce((a, r) => a + r.amountExclTax, 0), [rows, selected])
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allSelected = planned.length > 0 && planned.every((r) => selected.has(r.id))

  const create = async () => {
    setBusy('create')
    setError(null)
    try {
      const d = await fetchJson<{ invoiceIds: string[] }>('/api/income/invoices/bulk-create', { method: 'POST', body: { scheduleIds: Array.from(selected), issueDate } })
      router.push(d.invoiceIds.length === 1 ? `/income/invoices/${d.invoiceIds[0]}` : '/income/invoices')
    } catch (e) {
      setError(errMsg(e))
      setBusy(null)
    }
  }

  const skip = async (r: Sched, doSkip: boolean) => {
    let reason: string | null = null
    if (doSkip) {
      reason = window.prompt(`${r.client.name} の${r.contract.title}を請求しない理由を入力してください`, '')
      if (reason === null) return
      if (!reason.trim()) { setError('請求しない理由を入力してください'); return }
    }
    setBusy(r.id)
    setError(null)
    try {
      await fetchJson(`/api/income/revenue/${r.id}`, { method: 'PATCH', body: doSkip ? { skip: true, reason } : { skip: false } })
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <PageShell>
      <PageHeader title="月次売上" sub="その月に計上する売上予定です。請求予定日を過ぎた未請求は請求漏れとして赤く表示します" actions={<MonthSwitcher month={month} onChange={changeMonth} />} />
      <ErrorText message={error} />
      {!data && !error && <Loading />}
      {data && rows.length === 0 && <Empty>この月の売上予定はありません。<Link href="/income/contracts" className="ml-1 text-[#0f9f6e] underline">契約を確認する</Link></Empty>}
      {data && rows.length > 0 && (
        <div className="mt-3 space-y-3">
          <Card className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] font-black text-slate-500">
                    <th className="w-10 py-2.5 pl-4">
                      <input type="checkbox" aria-label="未請求をすべて選ぶ" className="h-4 w-4 accent-[#0f9f6e]" checked={allSelected} disabled={planned.length === 0}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(planned.map((r) => r.id)))} />
                    </th>
                    <th className="py-2.5 pr-3">取引先 / 契約</th><th className="py-2.5 pr-3">請求予定日</th>
                    <th className="py-2.5 pr-3 text-right">金額（税抜）</th><th className="py-2.5 pr-3">状態</th><th className="py-2.5 pr-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const leak = isLeak(r)
                    return (
                      <tr key={r.id} className={`border-b border-slate-100 ${leak ? 'bg-red-50' : ''} ${r.status === 'skipped' ? 'text-slate-400' : ''}`}>
                        <td className="py-2.5 pl-4">
                          {r.status === 'planned' && <input type="checkbox" aria-label={`${r.client.name}を選ぶ`} className="h-4 w-4 accent-[#0f9f6e]" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Link href={`/income/clients/${r.client.id}`} className="block font-black text-slate-900 hover:underline">{r.client.name}</Link>
                          <Link href={`/income/contracts/${r.contract.id}`} className="block font-bold text-slate-500 hover:underline">{r.contract.title}</Link>
                        </td>
                        <td className={`whitespace-nowrap py-2.5 pr-3 font-bold ${leak ? 'text-red-700' : 'text-slate-600'}`}>
                          {ymdW(r.plannedIssueDate)}
                          {leak && <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700">請求漏れ</span>}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-right font-bold tabular-nums">{yen(r.amountExclTax)}</td>
                        <td className="py-2.5 pr-3">
                          <ScheduleStatusBadge status={r.status} />
                          {r.skipReason && <span className="mt-0.5 block text-[11px] font-bold text-slate-400">{r.skipReason}</span>}
                          {r.invoiceItem && (
                            <Link href={`/income/invoices/${r.invoiceItem.invoice.id}`} className="mt-0.5 block text-[11px] font-black text-[#0f9f6e] hover:underline">{r.invoiceItem.invoice.invoiceNo ?? '下書きを開く'}</Link>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          {r.status === 'planned' && <button type="button" disabled={busy === r.id} onClick={() => skip(r, true)} className={`${btnSecondary} ${btnSmall}`}>請求しない</button>}
                          {r.status === 'skipped' && <button type="button" disabled={busy === r.id} onClick={() => skip(r, false)} className={`${btnSecondary} ${btnSmall}`}>戻す</button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-xs font-black text-slate-800">
                    <td colSpan={3} className="py-2.5 pl-4">合計（請求しないを除く）{rows.length} 件</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">{yen(total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="請求日">
                <input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </Field>
              <button type="button" onClick={create} disabled={selected.size === 0 || !issueDate || busy === 'create'} className={btnPrimary}>
                {busy === 'create' && <Spinner />}
                選んだ売上の請求書を作成
              </button>
              <p className="pb-2 text-xs font-bold text-slate-500">選択中 {selected.size} 件 / {yen(selectedTotal)}（税抜）。取引先ごとに1枚の下書きを作ります</p>
            </div>
          </Card>
        </div>
      )}
    </PageShell>
  )
}

export default function RevenuePage() {
  return (
    <Suspense fallback={<PageShell><Loading /></PageShell>}>
      <Inner />
    </Suspense>
  )
}
