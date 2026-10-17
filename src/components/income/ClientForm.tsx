'use client'

// 取引先の入力フォーム（新規・編集で共用）
import { useState } from 'react'
import { Button, CheckRow, ErrorText, Field, inputCls, PaymentTermsFields, errMsg, s, toast, useUnsavedGuard, type Terms } from './ui'

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
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [tried, setTried] = useState(false)
  const { markClean } = useUnsavedGuard({ f, terms })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }))

  // 入力しながら検証する（触った項目か、保存を押したあとだけ出す）
  const errors: Record<string, string | undefined> = {
    name: f.name.trim() === '' ? '取引先名を入力してください' : undefined,
    corporateNumber: f.corporateNumber.trim() !== '' && !/^\d{13}$/.test(f.corporateNumber.normalize('NFKC').trim()) ? '法人番号は13桁の数字で入力してください' : undefined,
    postalCode: f.postalCode.trim() !== '' && !/^\d{3}-?\d{4}$/.test(f.postalCode.normalize('NFKC').trim()) ? '郵便番号は「100-0001」の形で入力してください' : undefined,
    billingEmail: f.billingEmail.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.billingEmail.trim()) ? 'メールアドレスの形式で入力してください' : undefined,
  }
  const err = (k: string) => (touched[k] || tried ? errors[k] : undefined)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) {
      setError('入力に誤りがあります。赤字の項目を直してください。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ ...f, ...terms })
      markClean()
      toast(initial ? '保存しました' : '取引先を登録しました')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="取引先名（必須）" error={err('name')} className="sm:col-span-2">
          <input className={inputCls} value={f.name} onChange={set('name')} onBlur={touch('name')} maxLength={120} placeholder="株式会社サンプル" />
        </Field>
        <Field label="法人番号" error={err('corporateNumber')}>
          <input className={inputCls} value={f.corporateNumber} onChange={set('corporateNumber')} onBlur={touch('corporateNumber')} maxLength={13} inputMode="numeric" />
        </Field>
        <Field label="郵便番号" error={err('postalCode')}>
          <input className={inputCls} value={f.postalCode} onChange={set('postalCode')} onBlur={touch('postalCode')} maxLength={10} placeholder="100-0001" />
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
        <Field label="請求先のメール" error={err('billingEmail')}>
          <input type="email" className={inputCls} value={f.billingEmail} onChange={set('billingEmail')} onBlur={touch('billingEmail')} maxLength={254} />
        </Field>
        <Field label="振込名義（カナ）" hint="入金の照合に使います">
          <input className={inputCls} value={f.payerNameKana} onChange={set('payerNameKana')} maxLength={100} placeholder="カ)サンプル" />
        </Field>
      </div>
      <div>
        <p className={s.label}>支払条件</p>
        <PaymentTermsFields value={terms} onChange={setTerms} allowDefault />
      </div>
      <Field label="メモ">
        <textarea className={inputCls} rows={3} value={f.note} onChange={set('note')} maxLength={2000} />
      </Field>
      {initial && (
        <CheckRow checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })}>
          取引中（外すと新規の選択肢に出ません）
        </CheckRow>
      )}
      <ErrorText message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={busy}>{submitLabel}</Button>
        {onCancel && <Button onClick={onCancel} disabled={busy}>キャンセル</Button>}
      </div>
    </form>
  )
}
