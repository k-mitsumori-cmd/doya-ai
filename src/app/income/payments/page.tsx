'use client'

// 入金・消込: 入金の手入力、候補からの消込、手動の消込
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { todayJst } from '@/lib/income/dates'
import {
  Card, Empty, ErrorText, Field, Loading, PAYMENT_STATUS_LABEL, PageHeader, PageShell, Spinner,
  btnDanger, btnPrimary, btnSecondary, btnSmall, errMsg, fetchJson, inputCls, parseYenInput, ymd, yen,
} from '@/components/income/ui'

type OpenInvoice = { id: string; invoiceNo: string | null; clientName: string; remaining: number; dueDate: string; totalInclTax: number }
type Payment = {
  id: string; receivedOn: string; amount: number; feeDeducted: number; payerName: string | null; memo: string | null; status: string
  allocations: { id: string; amount: number; invoice: { id: string; invoiceNo: string | null; client: { name: string } } }[]
  candidates: { invoiceId: string; score: number; reason: string }[]
}

function statusCls(s: string) {
  return s === 'matched' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : s === 'partial' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'
}

function PaymentCard({ p, open, onChanged }: { p: Payment; open: OpenInvoice[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickId, setPickId] = useState('')
  const [pickAmount, setPickAmount] = useState('')
  const allocated = p.allocations.reduce((a, x) => a + x.amount, 0)
  const unallocated = Math.max(0, p.amount + p.feeDeducted - allocated)
  const invById = (iid: string) => open.find((o) => o.id === iid)

  const call = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await onChanged()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }
  const allocate = (invoiceId: string, amount: number, matchedBy: 'rule' | 'manual') =>
    call(`a-${invoiceId}`, () => fetchJson(`/api/income/payments/${p.id}/allocate`, { method: 'POST', body: { allocations: [{ invoiceId, amount, matchedBy }] } }).then(() => undefined))

  const pickAmountNum = parseYenInput(pickAmount)

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">
            <span className="tabular-nums">{yen(p.amount)}</span>
            <span className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${statusCls(p.status)}`}>{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</span>
          </p>
          <p className="mt-0.5 text-xs font-bold text-slate-500">
            {ymd(p.receivedOn)} {p.payerName ? `/ ${p.payerName}` : ''}
            {p.feeDeducted > 0 ? ` / 手数料差引 ${yen(p.feeDeducted)}` : ''}
            {p.memo ? ` / ${p.memo}` : ''}
          </p>
        </div>
        <button
          type="button"
          disabled={!!busy}
          className={`${btnDanger} ${btnSmall}`}
          onClick={() => { if (window.confirm('この入金を削除します。消込も外れます。よろしいですか？')) call('del', () => fetchJson(`/api/income/payments/${p.id}`, { method: 'DELETE' }).then(() => undefined)) }}
        >
          <Trash2 className="h-3.5 w-3.5" />削除
        </button>
      </div>

      {p.allocations.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl bg-slate-50 px-3">
          {p.allocations.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs font-bold">
              <Link href={`/income/invoices/${a.invoice.id}`} className="text-[#0f9f6e] hover:underline">{a.invoice.invoiceNo ?? '請求書'} {a.invoice.client.name}</Link>
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-slate-900">{yen(a.amount)}</span>
                <button type="button" disabled={!!busy} className={`${btnSecondary} ${btnSmall}`}
                  onClick={() => call(`u-${a.invoice.id}`, () => fetchJson(`/api/income/payments/${p.id}/allocate?invoiceId=${encodeURIComponent(a.invoice.id)}`, { method: 'DELETE' }).then(() => undefined))}>
                  {busy === `u-${a.invoice.id}` && <Spinner />}外す
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {p.status !== 'matched' && (
        <div className="mt-3 space-y-3">
          <p className="text-xs font-bold text-slate-500">未消込 {yen(unallocated)}（手数料差引を含む）</p>
          {p.candidates.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-black text-slate-600">照合候補</p>
              <ul className="space-y-1.5">
                {p.candidates.map((c) => {
                  const inv = invById(c.invoiceId)
                  if (!inv) return null
                  const amt = Math.min(inv.remaining, unallocated)
                  return (
                    <li key={c.invoiceId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                      <div className="min-w-0 text-xs font-bold">
                        <p className="truncate text-slate-900">{inv.invoiceNo ?? '請求書'} {inv.clientName}（残高 {yen(inv.remaining)} / 期日 {inv.dueDate}）</p>
                        <p className="text-slate-500">{c.reason}</p>
                      </div>
                      <button type="button" disabled={!!busy || amt <= 0} className={`${btnPrimary} ${btnSmall}`} onClick={() => allocate(c.invoiceId, amt, 'rule')}>
                        {busy === `a-${c.invoiceId}` && <Spinner />}{yen(amt)}を消込する
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-1 text-[11px] font-black text-slate-600">手動で消込する</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="請求書" className="min-w-[12rem] flex-1">
                <select className={inputCls} value={pickId} onChange={(e) => { setPickId(e.target.value); const inv = invById(e.target.value); setPickAmount(inv ? String(Math.min(inv.remaining, unallocated)) : '') }}>
                  <option value="">選択してください</option>
                  {open.map((o) => <option key={o.id} value={o.id}>{o.invoiceNo ?? '請求書'} {o.clientName}（残高 {yen(o.remaining)}）</option>)}
                </select>
              </Field>
              <Field label="消込額（円）" className="w-36">
                <input className={inputCls} inputMode="numeric" value={pickAmount} onChange={(e) => setPickAmount(e.target.value)} />
              </Field>
              <button type="button" disabled={!!busy || !pickId || !(pickAmountNum > 0)} className={btnPrimary} onClick={() => allocate(pickId, pickAmountNum, 'manual')}>
                {busy === `a-${pickId}` && <Spinner />}消込する
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-2"><ErrorText message={error} /></div>
    </li>
  )
}

export default function PaymentsPage() {
  const [data, setData] = useState<{ payments: Payment[]; openInvoices: OpenInvoice[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState({ receivedOn: todayJst(), amount: '', feeDeducted: '', payerName: '', memo: '' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await fetchJson(`/api/income/payments`))
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    }
  }, [])
  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      const amount = parseYenInput(f.amount)
      const fee = f.feeDeducted.trim() === '' ? 0 : parseYenInput(f.feeDeducted)
      if (Number.isNaN(amount)) throw new Error('入金額は整数で入力してください')
      if (Number.isNaN(fee)) throw new Error('振込手数料の差引は整数で入力してください')
      await fetchJson('/api/income/payments', { method: 'POST', body: { receivedOn: f.receivedOn, amount, feeDeducted: fee, payerName: f.payerName, memo: f.memo } })
      setF({ ...f, amount: '', feeDeducted: '', payerName: '', memo: '' })
      await load()
    } catch (err) {
      setFormError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <PageHeader title="入金・消込" sub="入金を登録し、請求書に紐づけます。候補は金額と振込名義から出しますが、確定は人が行います" />
      <Card title="入金を登録" className="mb-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="入金日（必須）"><input type="date" className={inputCls} value={f.receivedOn} onChange={(e) => setF({ ...f, receivedOn: e.target.value })} required /></Field>
            <Field label="入金額（円・必須）"><input className={inputCls} inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required placeholder="330000" /></Field>
            <Field label="振込手数料の差引（円）" hint="先方が差し引いた手数料"><input className={inputCls} inputMode="numeric" value={f.feeDeducted} onChange={(e) => setF({ ...f, feeDeducted: e.target.value })} placeholder="0" /></Field>
            <Field label="振込名義"><input className={inputCls} value={f.payerName} onChange={(e) => setF({ ...f, payerName: e.target.value })} maxLength={100} placeholder="カ)サンプル" /></Field>
            <Field label="メモ" className="sm:col-span-4"><input className={inputCls} value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} maxLength={500} /></Field>
          </div>
          <ErrorText message={formError} />
          <button type="submit" disabled={busy} className={btnPrimary}>{busy && <Spinner />}入金を登録する</button>
        </form>
      </Card>

      <ErrorText message={error} />
      {!data && !error && <Loading />}
      {data && data.payments.length === 0 && <Empty>入金がまだ登録されていません。</Empty>}
      {data && data.payments.length > 0 && (
        <ul className="space-y-3">
          {data.payments.map((p) => <PaymentCard key={p.id} p={p} open={data.openInvoices} onChanged={load} />)}
        </ul>
      )}
    </PageShell>
  )
}
