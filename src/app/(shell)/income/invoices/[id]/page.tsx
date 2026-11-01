'use client'

// 請求書の詳細: 操作バー・消込の状況・印刷用の帳票
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Ban, CheckCircle2, Pencil, Printer, Send, Trash2 } from 'lucide-react'
import InvoiceSheet, { type SheetInvoice } from '@/components/income/InvoiceSheet'
import {
  Button, Card, ConfirmDialog, DetailSkeleton, emptyLine, ErrorText, Field, Gate, InvoiceStatusBadge, LineItemsEditor, PageHeader, PageShell,
  PaymentStateBadge, errMsg, fetchJson, inputCls, linesToPayload, s, toast, useIncomePermission, useResource, useUnsavedGuard, ymd, yen, type LineRow,
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
type Loaded = { invoice: Detail; issuer: any }

type Dialog = null | 'confirm' | 'send' | 'void' | 'delete'

function InvoiceView({ inv, issuer, reload }: { inv: Detail; issuer: any; reload: () => Promise<void> }) {
  const { id } = inv
  const router = useRouter()
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
  const { markClean } = useUnsavedGuard(editing ? { title, issueDate, dueDate, notes, rows } : null)
  useEffect(() => { markClean() }, [editing, markClean])

  const startEdit = () => {
    setRows(inv.items.map((i) => ({ name: i.name, quantity: String(i.quantity), unitPrice: String(i.unitPrice), taxRate: i.taxRate, scheduleId: i.scheduleId })))
    setTitle(inv.title ?? '')
    setIssueDate(ymd(inv.issueDate))
    setDueDate(ymd(inv.dueDate))
    setNotes(inv.notes ?? '')
    setError(null)
    setEditing(true)
  }

  const run = async (fn: () => Promise<void>, inDialog = false) => {
    setBusy(true)
    setError(null)
    setDialogError(null)
    try {
      await fn()
      if (inDialog) setDialog(null)
    } catch (e) {
      if (inDialog) setDialogError(errMsg(e))
      else setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const editErrors = {
    issueDate: issueDate ? undefined : '請求日を入力してください',
    dueDate: dueDate && issueDate && dueDate < issueDate ? '支払期日は請求日以降にしてください' : undefined,
  }
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (editErrors.issueDate || editErrors.dueDate) {
      setError('入力に誤りがあります。赤字の項目を直してください。')
      return
    }
    run(async () => {
      await fetchJson(`/api/income/invoices/${id}`, {
        method: 'PATCH',
        body: { clientId: inv.clientId, title, issueDate, dueDate: dueDate || null, notes, lines: linesToPayload(rows) },
      })
      await reload()
      setEditing(false)
      toast('請求書を保存しました')
    })
  }

  const confirmIt = () => run(async () => { await fetchJson(`/api/income/invoices/${id}/confirm`, { method: 'POST', body: {} }); await reload(); toast('請求書を確定しました') }, true)
  const sendIt = () => run(async () => { await fetchJson(`/api/income/invoices/${id}/send`, { method: 'POST', body: { sentTo: sentTo.trim() || null } }); await reload(); toast('送付済みとして記録しました') }, true)
  const voidIt = () => run(async () => { await fetchJson(`/api/income/invoices/${id}/void`, { method: 'POST', body: { reason: reason.trim() } }); await reload(); toast('請求書を取り消しました') }, true)
  const removeIt = () => run(async () => { await fetchJson(`/api/income/invoices/${id}`, { method: 'DELETE' }); toast('下書きを削除しました'); router.push('/income/invoices') }, true)

  const isDraft = inv.status === 'draft'
  const canSend = inv.status === 'confirmed' || inv.status === 'sent'
  const open = (d: Dialog) => { setDialogError(null); setDialog(d) }

  // API と同じ役割で出し分ける（確定・送付の記録は manager 以上、取消は admin 以上。編集と下書きの削除は全員）
  const perm = useIncomePermission()
  const mayConfirm = perm.allows('manager')
  const maySend = perm.allows('manager')
  const mayVoid = perm.allows('admin')
  const roleNote = perm.pending || editing ? null
    : isDraft && !mayConfirm ? '請求書の確定は、マネージャー以上の役割の人ができます。'
    : canSend && !maySend ? '送付の記録はマネージャー以上、取消は管理者以上の役割の人ができます。'
    : canSend && !mayVoid ? '請求書の取消は、管理者以上の役割の人ができます。'
    : null

  return (
    <>
      <div className="no-print">
        <PageHeader
          crumbs={[{ label: '収入管理', href: '/income' }, { label: '請求書', href: '/income/invoices' }, { label: inv.invoiceNo ?? '下書き' }]}
          title={inv.invoiceNo ?? '請求書（下書き）'}
          sub={`${inv.client.name} / ${yen(inv.totalInclTax)}（税込）`}
          actions={
            !editing && (
              <>
                {isDraft && (
                  <>
                    <Button onClick={startEdit} disabled={busy}><Pencil size={16} aria-hidden="true" />編集する</Button>
                    {mayConfirm && <Button variant="primary" onClick={() => open('confirm')} disabled={busy || perm.pending}><CheckCircle2 size={16} aria-hidden="true" />確定する</Button>}
                    <Button variant="danger" onClick={() => open('delete')} disabled={busy}><Trash2 size={16} aria-hidden="true" />削除する</Button>
                  </>
                )}
                {canSend && (
                  <>
                    {maySend && <Button variant="primary" onClick={() => { setSentTo(inv.sentTo ?? inv.client.billingEmail ?? ''); open('send') }} disabled={busy || perm.pending}><Send size={16} aria-hidden="true" />送付済みにする</Button>}
                    {mayVoid && <Button variant="danger" onClick={() => { setReason(''); open('void') }} disabled={busy || perm.pending}><Ban size={16} aria-hidden="true" />取り消す</Button>}
                  </>
                )}
                <Button onClick={() => window.print()}><Printer size={16} aria-hidden="true" />印刷・PDF保存</Button>
              </>
            )
          }
        />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <InvoiceStatusBadge status={inv.status} />
          <PaymentStateBadge label={inv.state.label} />
          {inv.sentAt && <span className={s.sub}>送付済み: {ymd(inv.sentAt)}{inv.sentTo ? `（${inv.sentTo}）` : ''}</span>}
        </div>
        {roleNote && <p className={s.sub} style={{ margin: '0 0 16px' }}>{roleNote}</p>}
        <ErrorText message={error} />

        {editing && (
          <form onSubmit={save} noValidate className="mb-4 mt-4 space-y-4">
            <Card title="請求書を編集">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="件名" className="sm:col-span-3"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
                <Field label="請求日" error={editErrors.issueDate}><input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
                <Field label="支払期日" error={editErrors.dueDate} hint="空欄にすると支払条件から自動で決まります"><input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
              </div>
            </Card>
            <Card title="明細"><LineItemsEditor rows={rows} onChange={setRows} hint="値引きは単価にマイナスの金額を入力してください。" /></Card>
            <Card><Field label="備考"><textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field></Card>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" loading={busy}>保存する</Button>
              <Button disabled={busy} onClick={() => setEditing(false)}>キャンセル</Button>
            </div>
          </form>
        )}

        {inv.state.label === '入金済み' && (
          <Card className="mb-4 mt-4">
            <div className={s.done} role="status">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/income/paid-complete.webp" alt="" width={96} height={96} className={s.doneImg} />
              <div>
                <p className={s.strong} style={{ margin: 0 }}>全額の入金を確認しました</p>
                <p className={s.sub} style={{ margin: '4px 0 0' }}>この請求書の入金は完了しています。</p>
              </div>
            </div>
          </Card>
        )}

        {!isDraft && inv.status !== 'void' && (
          <Card title="入金の状況" className="mb-4 mt-4">
            <p className={s.num} style={{ margin: 0 }}>入金済み {yen(inv.paidAmount)} / 残高 {yen(inv.state.remaining)}</p>
            {inv.allocations.length > 0 ? (
              <ul className={`${s.divided} mt-2`}>
                {inv.allocations.map((a) => (
                  <li key={a.id} className={s.lineRow} style={{ justifyContent: 'space-between' }}>
                    <span className={s.sub}>{ymd(a.payment.receivedOn)} {a.payment.payerName ?? ''}</span>
                    <span className={`${s.num} ${s.strong}`}>{yen(a.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.sub} style={{ margin: '8px 0 0' }}>消込された入金はまだありません。</p>
            )}
            <Link href="/income/payments" className={`${s.link} mt-2 inline-flex min-h-[44px] items-center`}>入金・消込の画面へ</Link>
          </Card>
        )}
      </div>

      {!editing && <InvoiceSheet invoice={inv} issuer={issuer} />}

      {dialog === 'confirm' && (
        <ConfirmDialog
          title="請求書を確定しますか"
          message="確定すると請求書番号が付き、請求元・請求先の情報がこの時点の内容で固定されます。確定後は編集できません。直すときは取消して作り直します。"
          confirmLabel="確定する"
          busy={busy}
          error={dialogError}
          onConfirm={confirmIt}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'send' && (
        <ConfirmDialog
          title="送付済みにする"
          message="メールの送信は行いません。送付したことを記録します。"
          confirmLabel="記録する"
          busy={busy}
          error={dialogError}
          onConfirm={sendIt}
          onClose={() => setDialog(null)}
        >
          <Field label="送付先メール（任意）"><input type="email" className={inputCls} value={sentTo} onChange={(e) => setSentTo(e.target.value)} /></Field>
        </ConfirmDialog>
      )}
      {dialog === 'void' && (
        <ConfirmDialog
          title="請求書を取り消す"
          message="取り消すと番号は欠番として残り、紐づく売上予定は未請求に戻ります。入金の消込が付いている場合は先に外してください。"
          confirmLabel="取り消す"
          danger
          busy={busy}
          error={dialogError}
          confirmDisabled={!reason.trim()}
          onConfirm={voidIt}
          onClose={() => setDialog(null)}
        >
          <Field label="取消の理由（必須）" error={reason.length > 0 && !reason.trim() ? '理由を入力してください' : undefined}>
            <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </Field>
        </ConfirmDialog>
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          title="下書きを削除しますか"
          message="この下書きを削除します。紐づく売上予定は未請求に戻ります。"
          confirmLabel="削除する"
          danger
          busy={busy}
          error={dialogError}
          onConfirm={removeIt}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const res = useResource(() => fetchJson<Loaded>(`/api/income/invoices/${id}`), id)
  return (
    <PageShell>
      <Gate res={res} skeleton={<DetailSkeleton cards={2} />} listHref="/income/invoices" listLabel="請求書の一覧">
        {(d) => <InvoiceView key={d.invoice.id} inv={d.invoice} issuer={d.issuer} reload={res.reload} />}
      </Gate>
    </PageShell>
  )
}
