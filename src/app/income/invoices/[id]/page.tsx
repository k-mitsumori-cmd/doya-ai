'use client'

// 請求書の詳細: 操作バー・消込の状況・印刷用の帳票
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Pencil, Printer, Send, Trash2, Ban } from 'lucide-react'
import InvoiceSheet, { type SheetInvoice } from '@/components/income/InvoiceSheet'
import {
  Card, emptyLine, ErrorText, Field, InvoiceStatusBadge, LineItemsEditor, Loading, Modal, PageShell, PaymentStateBadge, Spinner,
  btnDanger, btnPrimary, btnSecondary, errMsg, fetchJson, inputCls, linesToPayload, ymd, yen, type LineRow,
} from '@/components/income/ui'

type Detail = Omit<SheetInvoice, 'items' | 'client'> & {
  id: string
  clientId: string
  paidAmount: number
  sentAt: string | null
  sentTo: string | null
  client: SheetInvoice['client'] & { id: string; billingEmail: string | null }
  items: (SheetInvoice['items'][number] & { scheduleId: string | null })[]
  allocations: { id: string; amount: number; matchedBy: string; payment: { id: string; receivedOn: string; amount: number; payerName: string | null } }[]
  state: { label: string | null; remaining: number; overdue: boolean }
}

type Dialog = null | 'confirm' | 'send' | 'void'

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [inv, setInv] = useState<Detail | null>(null)
  const [issuer, setIssuer] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState('')
  const [reason, setReason] = useState('')

  // 編集
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<LineRow[]>([emptyLine()])
  const [title, setTitle] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await fetchJson<{ invoice: Detail; issuer: unknown }>(`/api/income/invoices/${id}`)
      setInv(d.invoice)
      setIssuer(d.issuer)
    } catch (e) {
      setError(errMsg(e))
    }
  }, [id])
  useEffect(() => { load() }, [load])

  const startEdit = () => {
    if (!inv) return
    setRows(inv.items.map((i) => ({ name: i.name, quantity: String(i.quantity), unitPrice: String(i.unitPrice), taxRate: i.taxRate, scheduleId: i.scheduleId })))
    setTitle(inv.title ?? '')
    setIssueDate(ymd(inv.issueDate))
    setDueDate(ymd(inv.dueDate))
    setNotes(inv.notes ?? '')
    setError(null)
    setEditing(true)
  }

  const run = async (fn: () => Promise<void>, closeDialog = false) => {
    setBusy(true)
    setError(null)
    setDialogError(null)
    try {
      await fn()
      if (closeDialog) setDialog(null)
    } catch (e) {
      if (closeDialog) setDialogError(errMsg(e))
      else setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inv) return
    run(async () => {
      await fetchJson(`/api/income/invoices/${id}`, {
        method: 'PATCH',
        body: { clientId: inv.clientId, title, issueDate, dueDate: dueDate || null, notes, lines: linesToPayload(rows) },
      })
      await load()
      setEditing(false)
    })
  }

  const confirmIt = () => run(async () => { await fetchJson(`/api/income/invoices/${id}/confirm`, { method: 'POST', body: {} }); await load() }, true)
  const sendIt = () => run(async () => { await fetchJson(`/api/income/invoices/${id}/send`, { method: 'POST', body: { sentTo: sentTo.trim() || null } }); await load() }, true)
  const voidIt = () => run(async () => { await fetchJson(`/api/income/invoices/${id}/void`, { method: 'POST', body: { reason } }); await load() }, true)
  const remove = () => {
    if (!window.confirm('この下書きを削除します。よろしいですか？')) return
    run(async () => { await fetchJson(`/api/income/invoices/${id}`, { method: 'DELETE' }); router.push('/income/invoices') })
  }

  if (!inv) return <PageShell>{error ? <ErrorText message={error} /> : <Loading />}</PageShell>

  const isDraft = inv.status === 'draft'
  const canSend = inv.status === 'confirmed' || inv.status === 'sent'

  return (
    <PageShell>
      <div className="no-print">
        <Link href="/income/invoices" className="mb-3 inline-flex items-center gap-1 text-xs font-black text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" />請求書の一覧</Link>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-black text-slate-900 sm:text-2xl">
              {inv.invoiceNo ?? '請求書（下書き）'}
              <InvoiceStatusBadge status={inv.status} />
              <PaymentStateBadge label={inv.state.label} />
            </h1>
            <p className="mt-1 text-xs font-bold text-slate-500">{inv.client.name} / {yen(inv.totalInclTax)}（税込）</p>
          </div>
          {!editing && (
            <div className="flex flex-wrap items-center gap-2">
              {isDraft && (
                <>
                  <button type="button" className={btnSecondary} onClick={startEdit} disabled={busy}><Pencil className="h-4 w-4" />編集</button>
                  <button type="button" className={btnPrimary} onClick={() => { setDialogError(null); setDialog('confirm') }} disabled={busy}><CheckCircle2 className="h-4 w-4" />確定</button>
                  <button type="button" className={btnDanger} onClick={remove} disabled={busy}><Trash2 className="h-4 w-4" />削除</button>
                </>
              )}
              {canSend && (
                <>
                  <button type="button" className={btnPrimary} onClick={() => { setSentTo(inv.sentTo ?? inv.client.billingEmail ?? ''); setDialogError(null); setDialog('send') }} disabled={busy}><Send className="h-4 w-4" />送付済みにする</button>
                  <button type="button" className={btnDanger} onClick={() => { setReason(''); setDialogError(null); setDialog('void') }} disabled={busy}><Ban className="h-4 w-4" />取消</button>
                </>
              )}
              <button type="button" className={btnSecondary} onClick={() => window.print()}><Printer className="h-4 w-4" />印刷・PDF保存</button>
            </div>
          )}
        </div>
        <ErrorText message={error} />
        {inv.sentAt && <p className="mb-3 text-xs font-bold text-slate-500">送付済み: {ymd(inv.sentAt)}{inv.sentTo ? `（${inv.sentTo}）` : ''}</p>}

        {editing && (
          <form onSubmit={save} className="mb-5 space-y-4">
            <Card title="請求書を編集">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="件名" className="sm:col-span-3"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
                <Field label="請求日"><input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required /></Field>
                <Field label="支払期日" hint="空欄にすると支払条件から自動で決まります"><input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
              </div>
            </Card>
            <Card title="明細"><LineItemsEditor rows={rows} onChange={setRows} hint="値引きは単価にマイナスの金額を入力してください。" /></Card>
            <Card><Field label="備考"><textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field></Card>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary}>{busy && <Spinner />}保存する</button>
              <button type="button" disabled={busy} className={btnSecondary} onClick={() => setEditing(false)}>キャンセル</button>
            </div>
          </form>
        )}

        {!isDraft && inv.status !== 'void' && (
          <Card title="入金の状況" className="mb-5">
            <p className="text-xs font-bold text-slate-600">入金済み {yen(inv.paidAmount)} / 残高 {yen(inv.state.remaining)}</p>
            {inv.allocations.length > 0 ? (
              <ul className="mt-2 divide-y divide-slate-100">
                {inv.allocations.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs font-bold">
                    <span className="text-slate-600">{ymd(a.payment.receivedOn)} {a.payment.payerName ?? ''}</span>
                    <span className="tabular-nums text-slate-900">{yen(a.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs font-bold text-slate-400">消込された入金はまだありません。</p>
            )}
            <Link href="/income/payments" className="mt-2 inline-block text-xs font-black text-[#0f9f6e] hover:underline">入金・消込の画面へ</Link>
          </Card>
        )}
      </div>

      {!editing && <InvoiceSheet invoice={inv} issuer={issuer} />}

      {dialog === 'confirm' && (
        <Modal title="請求書を確定しますか" onClose={() => !busy && setDialog(null)}>
          <p className="text-sm font-bold leading-relaxed text-slate-700">確定すると請求書番号が付き、請求元・請求先の情報がこの時点の内容で固定されます。確定後は編集できません。直すときは取消して作り直します。</p>
          <div className="mt-3"><ErrorText message={dialogError} /></div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setDialog(null)} disabled={busy}>やめる</button>
            <button type="button" className={btnPrimary} onClick={confirmIt} disabled={busy}>{busy && <Spinner />}確定する</button>
          </div>
        </Modal>
      )}
      {dialog === 'send' && (
        <Modal title="送付済みにする" onClose={() => !busy && setDialog(null)}>
          <p className="mb-3 text-xs font-bold text-slate-500">メールの送信は行いません。送付したことを記録します。</p>
          <Field label="送付先メール（任意）"><input type="email" className={inputCls} value={sentTo} onChange={(e) => setSentTo(e.target.value)} /></Field>
          <div className="mt-3"><ErrorText message={dialogError} /></div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setDialog(null)} disabled={busy}>やめる</button>
            <button type="button" className={btnPrimary} onClick={sendIt} disabled={busy}>{busy && <Spinner />}記録する</button>
          </div>
        </Modal>
      )}
      {dialog === 'void' && (
        <Modal title="請求書を取り消す" onClose={() => !busy && setDialog(null)}>
          <p className="mb-3 text-xs font-bold leading-relaxed text-slate-500">取り消すと番号は欠番として残り、紐づく売上予定は未請求に戻ります。入金の消込が付いている場合は先に外してください。</p>
          <Field label="取消の理由（必須）"><textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></Field>
          <div className="mt-3"><ErrorText message={dialogError} /></div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setDialog(null)} disabled={busy}>やめる</button>
            <button type="button" className={btnDanger} onClick={voidIt} disabled={busy || !reason.trim()}>{busy && <Spinner />}取り消す</button>
          </div>
        </Modal>
      )}
    </PageShell>
  )
}
