'use client'

// 入金・消込: 入金の手入力、候補からの消込、手動の消込
import { useState } from 'react'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { todayJst } from '@/lib/income/dates'
import {
  Button, Card, ConfirmDialog, DetailSkeleton, EmptyState, ErrorText, Field, Gate, ListSkeleton, PageHeader, PageShell, PaymentMatchBadge,
  errMsg, fetchJson, inputCls, parseYenInput, s, toast, useIncomePermission, useResource, useUnsavedGuard, ymd, yen,
} from '@/components/income/ui'

type OpenInvoice = { id: string; invoiceNo: string | null; clientName: string; remaining: number; dueDate: string; totalInclTax: number }
type Payment = {
  id: string; receivedOn: string; amount: number; feeDeducted: number; payerName: string | null; memo: string | null; status: string
  allocations: { id: string; amount: number; invoice: { id: string; invoiceNo: string | null; client: { name: string } } }[]
  candidates: { invoiceId: string; score: number; reason: string }[]
}
type Data = { payments: Payment[]; openInvoices: OpenInvoice[] }

/** 入金の登録・削除・消込は API で manager 以上。権限の無い人には操作のボタンを出さない */
const MANAGER_ONLY_NOTE = '入金の登録と消込は、マネージャー以上の役割の人ができます。'

function PaymentCard({ p, open, onChanged, canEdit, pending }: { p: Payment; open: OpenInvoice[]; onChanged: () => Promise<void>; canEdit: boolean; pending: boolean }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickId, setPickId] = useState('')
  const [pickAmount, setPickAmount] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const allocated = p.allocations.reduce((a, x) => a + x.amount, 0)
  const unallocated = Math.max(0, p.amount + p.feeDeducted - allocated)
  const invById = (iid: string) => open.find((o) => o.id === iid)

  const call = async (key: string, fn: () => Promise<void>, done: string) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await onChanged()
      toast(done)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }
  const allocate = (invoiceId: string, amount: number, matchedBy: 'rule' | 'manual') =>
    call(`a-${invoiceId}`, () => fetchJson(`/api/income/payments/${p.id}/allocate`, { method: 'POST', body: { allocations: [{ invoiceId, amount, matchedBy }] } }).then(() => undefined), '消込しました')

  const removePayment = async () => {
    setBusy('del')
    setDeleteError(null)
    try {
      await fetchJson(`/api/income/payments/${p.id}`, { method: 'DELETE' })
      setDeleting(false)
      await onChanged()
      toast('入金を削除しました')
    } catch (e) {
      setDeleteError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const pickAmountNum = parseYenInput(pickAmount)
  const pickError = pickAmount.trim() !== '' && (Number.isNaN(pickAmountNum) || pickAmountNum <= 0) ? '消込額は1以上の整数で入力してください' : undefined

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 flex flex-wrap items-center gap-2">
              <span className={`${s.num} ${s.strong}`} style={{ fontSize: 18 }}>{yen(p.amount)}</span>
              <PaymentMatchBadge status={p.status} />
            </p>
            <p className={s.sub} style={{ margin: '4px 0 0' }}>
              {ymd(p.receivedOn)} {p.payerName ? `/ ${p.payerName}` : ''}
              {p.feeDeducted > 0 ? ` / 手数料差引 ${yen(p.feeDeducted)}` : ''}
              {p.memo ? ` / ${p.memo}` : ''}
            </p>
          </div>
          {canEdit && (
            <Button variant="danger" size="sm" disabled={!!busy || pending} onClick={() => { setDeleteError(null); setDeleting(true) }}>
              <Trash2 size={14} aria-hidden="true" />削除する
            </Button>
          )}
        </div>

        {p.allocations.length > 0 && (
          <ul className={s.divided} style={{ marginTop: 16 }}>
            {p.allocations.map((a) => (
              <li key={a.id} className={s.lineRow} style={{ justifyContent: 'space-between' }}>
                <Link href={`/income/invoices/${a.invoice.id}`} className={s.link}>{a.invoice.invoiceNo ?? '請求書'} {a.invoice.client.name}</Link>
                <span className="flex flex-wrap items-center gap-3">
                  <span className={`${s.num} ${s.strong}`}>{yen(a.amount)}</span>
                  {canEdit && (
                    <Button size="sm" disabled={!!busy || pending} loading={busy === `u-${a.invoice.id}`}
                      onClick={() => call(`u-${a.invoice.id}`, () => fetchJson(`/api/income/payments/${p.id}/allocate?invoiceId=${encodeURIComponent(a.invoice.id)}`, { method: 'DELETE' }).then(() => undefined), '消込を外しました')}>
                      外す
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {p.status !== 'matched' && (
          <div className="mt-4 space-y-4">
            <p className={s.sub} style={{ margin: 0 }}>未消込 <span className={s.num}>{yen(unallocated)}</span>（手数料差引を含む）</p>
            {p.candidates.length > 0 && (
              <div>
                <p className={s.label}>照合候補</p>
                <ul className="m-0 space-y-2 p-0" style={{ listStyle: 'none' }}>
                  {p.candidates.map((c) => {
                    const inv = invById(c.invoiceId)
                    if (!inv) return null
                    const amt = Math.min(inv.remaining, unallocated)
                    return (
                      <li key={c.invoiceId} className={`${s.lineCard} flex flex-wrap items-center justify-between gap-3`}>
                        <div className="min-w-0">
                          <p className={s.strong} style={{ margin: 0 }}>{inv.invoiceNo ?? '請求書'} {inv.clientName}</p>
                          <p className={s.sub} style={{ margin: 0 }}>残高 <span className={s.num}>{yen(inv.remaining)}</span> / 期日 {inv.dueDate} / {c.reason}</p>
                        </div>
                        {canEdit && (
                          <Button size="sm" disabled={!!busy || pending || amt <= 0} loading={busy === `a-${c.invoiceId}`} onClick={() => allocate(c.invoiceId, amt, 'rule')}>
                            {yen(amt)}を消込する
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {canEdit && <div>
              <p className={s.label}>手動で消込する</p>
              <div className="flex flex-wrap items-start gap-3">
                <Field label="請求書" className="min-w-[12rem] flex-1">
                  <select className={inputCls} value={pickId} onChange={(e) => { setPickId(e.target.value); const inv = invById(e.target.value); setPickAmount(inv ? String(Math.min(inv.remaining, unallocated)) : '') }}>
                    <option value="">選択してください</option>
                    {open.map((o) => <option key={o.id} value={o.id}>{o.invoiceNo ?? '請求書'} {o.clientName}（残高 {yen(o.remaining)}）</option>)}
                  </select>
                </Field>
                <Field label="消込額（円）" error={pickError} className="w-full sm:w-40">
                  <input className={inputCls} inputMode="numeric" value={pickAmount} onChange={(e) => setPickAmount(e.target.value)} />
                </Field>
                <div className="w-full self-end sm:w-auto">
                  <Button disabled={!!busy || pending || !pickId || !(pickAmountNum > 0)} loading={busy === `a-${pickId}`} onClick={() => allocate(pickId, pickAmountNum, 'manual')}>
                    消込する
                  </Button>
                </div>
              </div>
            </div>}
          </div>
        )}
        <div className="mt-3"><ErrorText message={error} /></div>
      </Card>

      {deleting && (
        <ConfirmDialog
          title="入金を削除しますか"
          message="この入金を削除します。消込も外れます。元に戻せません。"
          confirmLabel="削除する"
          danger
          busy={busy === 'del'}
          error={deleteError}
          onConfirm={removePayment}
          onClose={() => setDeleting(false)}
        />
      )}
    </li>
  )
}

function PaymentForm({ onCreated, pending }: { onCreated: () => Promise<void>; pending: boolean }) {
  const [f, setF] = useState({ receivedOn: todayJst(), amount: '', feeDeducted: '', payerName: '', memo: '' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [tried, setTried] = useState(false)
  const { markClean } = useUnsavedGuard(f)
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }))

  const amount = parseYenInput(f.amount)
  const fee = f.feeDeducted.trim() === '' ? 0 : parseYenInput(f.feeDeducted)
  const errors: Record<string, string | undefined> = {
    receivedOn: f.receivedOn ? undefined : '入金日を入力してください',
    amount: f.amount.trim() === '' ? '入金額を入力してください' : Number.isNaN(amount) || amount <= 0 ? '入金額は1以上の整数で入力してください' : undefined,
    feeDeducted: Number.isNaN(fee) || fee < 0 ? '振込手数料の差引は0以上の整数で入力してください' : undefined,
  }
  const err = (k: string) => (touched[k] || tried ? errors[k] : undefined)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (busy || pending) return
    if (Object.values(errors).some(Boolean)) {
      setFormError('入力に誤りがあります。赤字の項目を直してください。')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await fetchJson('/api/income/payments', { method: 'POST', body: { receivedOn: f.receivedOn, amount, feeDeducted: fee, payerName: f.payerName, memo: f.memo } })
      setF({ ...f, amount: '', feeDeducted: '', payerName: '', memo: '' })
      setTouched({})
      setTried(false)
      markClean()
      await onCreated()
      toast('入金を登録しました')
    } catch (er) {
      setFormError(errMsg(er))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="入金を登録">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="入金日（必須）" error={err('receivedOn')}><input type="date" className={inputCls} value={f.receivedOn} onChange={(e) => setF({ ...f, receivedOn: e.target.value })} onBlur={touch('receivedOn')} /></Field>
          <Field label="入金額（円・必須）" error={err('amount')}><input id="income-payment-amount" className={inputCls} inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} onBlur={touch('amount')} placeholder="330000" /></Field>
          <Field label="振込手数料の差引（円）" error={err('feeDeducted')} hint="先方が差し引いた手数料"><input className={inputCls} inputMode="numeric" value={f.feeDeducted} onChange={(e) => setF({ ...f, feeDeducted: e.target.value })} onBlur={touch('feeDeducted')} placeholder="0" /></Field>
          <Field label="振込名義"><input className={inputCls} value={f.payerName} onChange={(e) => setF({ ...f, payerName: e.target.value })} maxLength={100} placeholder="カ)サンプル" /></Field>
          <Field label="メモ" className="sm:col-span-4"><input className={inputCls} value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} maxLength={500} /></Field>
        </div>
        <ErrorText message={formError} />
        <Button type="submit" variant="primary" loading={busy} disabled={pending}>入金を登録する</Button>
      </form>
    </Card>
  )
}

export default function PaymentsPage() {
  const res = useResource(() => fetchJson<Data>('/api/income/payments'), 'payments')
  const perm = useIncomePermission()
  const canEdit = perm.allows('manager')
  return (
    <PageShell>
      <PageHeader
        crumbs={[{ label: '収入管理', href: '/income' }, { label: '入金・消込' }]}
        title="入金・消込"
        sub="入金を登録し、請求書に紐づけます。候補は金額と振込名義から出しますが、確定は人が行います"
      />
      <Gate res={res} skeleton={<><DetailSkeleton cards={1} /><div style={{ height: 16 }} /><ListSkeleton rows={2} /></>}>
        {(data) => (
          <div className={s.stackY}>
            {canEdit ? <PaymentForm onCreated={res.reload} pending={perm.pending} /> : <Card><p className={s.sub} style={{ margin: 0 }}>{MANAGER_ONLY_NOTE}</p></Card>}
            {data.payments.length === 0 ? (
              <EmptyState
                image="/income/empty-payments.webp"
                message="入金がまだ登録されていません。入金を登録すると、請求書との照合候補が出ます。"
                action={canEdit ? { label: '入金を登録する', onClick: () => document.getElementById('income-payment-amount')?.focus() } : undefined}
              />
            ) : (
              <ul className="m-0 space-y-4 p-0" style={{ listStyle: 'none' }}>
                {data.payments.map((p) => <PaymentCard key={p.id} p={p} open={data.openInvoices} onChanged={res.reload} canEdit={canEdit} pending={perm.pending} />)}
              </ul>
            )}
          </div>
        )}
      </Gate>
    </PageShell>
  )
}
