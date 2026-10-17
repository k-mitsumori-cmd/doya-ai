'use client'

// 取引先の入力フォーム（新規・編集で共用）
import { useState } from 'react'
import { btnPrimary, btnSecondary, ErrorText, Field, inputCls, PaymentTermsFields, Spinner, errMsg, type Terms } from './ui'

export type ClientDto = {
  id: string
  name: string
  corporateNumber: string | null
  postalCode: string | null
  address: string | null
  billingDepartment: string | null
  billingContactName: string | null
  billingEmail: string | null
  payerNameKana: string | null
  closingDay: number | null
  paymentMonths: number | null
  paymentDay: number | null
  note: string | null
  updatedAt?: string
  isActive: boolean
}

export default function ClientForm({
  initial, submitLabel, onSubmit, onCancel,
}: { initial?: ClientDto; submitLabel: string; onSubmit: (payload: Record<string, unknown>) => Promise<void>; onCancel?: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    corporateNumber: initial?.corporateNumber ?? '',
    postalCode: initial?.postalCode ?? '',
    address: initial?.address ?? '',
    billingDepartment: initial?.billingDepartment ?? '',
    billingContactName: initial?.billingContactName ?? '',
    billingEmail: initial?.billingEmail ?? '',
    payerNameKana: initial?.payerNameKana ?? '',
    note: initial?.note ?? '',
    isActive: initial?.isActive ?? true,
  })
  const [terms, setTerms] = useState<Terms>({
    closingDay: initial?.closingDay ?? null,
    paymentMonths: initial?.paymentMonths ?? null,
    paymentDay: initial?.paymentDay ?? null,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ ...f, ...terms })
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="取引先名（必須）" className="sm:col-span-2">
          <input className={inputCls} value={f.name} onChange={set('name')} maxLength={120} required placeholder="株式会社サンプル" />
        </Field>
        <Field label="法人番号">
          <input className={inputCls} value={f.corporateNumber} onChange={set('corporateNumber')} maxLength={13} inputMode="numeric" />
        </Field>
        <Field label="郵便番号">
          <input className={inputCls} value={f.postalCode} onChange={set('postalCode')} maxLength={10} placeholder="100-0001" />
        </Field>
        <Field label="住所" className="sm:col-span-2">
          <input className={inputCls} value={f.address} onChange={set('address')} maxLength={300} />
        </Field>
        <Field label="請求先の部署">
          <input className={inputCls} value={f.billingDepartment} onChange={set('billingDepartment')} maxLength={100} />
        </Field>
        <Field label="請求先の担当者">
          <input className={inputCls} value={f.billingContactName} onChange={set('billingContactName')} maxLength={60} />
        </Field>
        <Field label="請求先のメール">
          <input type="email" className={inputCls} value={f.billingEmail} onChange={set('billingEmail')} maxLength={254} />
        </Field>
        <Field label="振込名義（カナ）" hint="入金の照合に使います">
          <input className={inputCls} value={f.payerNameKana} onChange={set('payerNameKana')} maxLength={100} placeholder="カ)サンプル" />
        </Field>
      </div>
      <Field label="支払条件">
        <PaymentTermsFields value={terms} onChange={setTerms} allowDefault />
      </Field>
      <Field label="メモ">
        <textarea className={inputCls} rows={3} value={f.note} onChange={set('note')} maxLength={2000} />
      </Field>
      {initial && (
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="h-4 w-4 accent-[#0f9f6e]" />
          取引中（外すと新規の選択肢に出ません）
        </label>
      )}
      <ErrorText message={error} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy && <Spinner />}
          {submitLabel}
        </button>
        {onCancel && <button type="button" onClick={onCancel} disabled={busy} className={btnSecondary}>キャンセル</button>}
      </div>
    </form>
  )
}
