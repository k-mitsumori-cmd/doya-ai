'use client'

// 取引先の入力欄（契約の新規登録と、業務委託の詳細の編集で共用）
import type { Vendor } from './types'
import { Check, Field, inputCls } from './ui'

export interface VendorDraft {
  name: string
  kind: 'company' | 'individual'
  role: string
  invoiceRegNo: string
  withholdingDefault: boolean
  closingDay: string
  paymentMonths: string
  paymentDay: string
  bankName: string
  bankBranch: string
  bankAccountType: string
  bankAccountNo: string
  bankAccountHolder: string
  note: string
}

export const emptyVendor = (over: Partial<VendorDraft> = {}): VendorDraft => ({
  name: '', kind: 'company', role: '', invoiceRegNo: '', withholdingDefault: false,
  closingDay: '31', paymentMonths: '1', paymentDay: '31',
  bankName: '', bankBranch: '', bankAccountType: '普通', bankAccountNo: '', bankAccountHolder: '', note: '',
  ...over,
})

export function vendorToDraft(v: Vendor): VendorDraft {
  return emptyVendor({
    name: v.name, kind: v.kind, role: v.role ?? '', invoiceRegNo: v.invoiceRegNo ?? '', withholdingDefault: v.withholdingDefault,
    closingDay: String(v.closingDay), paymentMonths: String(v.paymentMonths), paymentDay: String(v.paymentDay),
    bankName: v.bank?.bankName ?? '', bankBranch: v.bank?.bankBranch ?? '', bankAccountType: v.bank?.bankAccountType ?? '普通',
    bankAccountNo: v.bank?.bankAccountNo ?? '', bankAccountHolder: v.bank?.bankAccountHolder ?? '', note: v.note ?? '',
  })
}

/** API に送る形。空文字は null にする */
export function draftToPayload(d: VendorDraft, withBank: boolean) {
  const n = (v: string) => (v.trim() ? v.trim() : null)
  return {
    name: d.name, kind: d.kind, role: n(d.role), invoiceRegNo: n(d.invoiceRegNo), withholdingDefault: d.withholdingDefault,
    closingDay: Number(d.closingDay), paymentMonths: Number(d.paymentMonths), paymentDay: Number(d.paymentDay), note: n(d.note),
    ...(withBank ? { bankName: n(d.bankName), bankBranch: n(d.bankBranch), bankAccountType: n(d.bankAccountType), bankAccountNo: n(d.bankAccountNo), bankAccountHolder: n(d.bankAccountHolder) } : {}),
  }
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const dayLabel = (d: number) => (d === 31 ? '月末' : `${d}日`)

export default function VendorFields({ value, onChange, showBank, hideKind }: { value: VendorDraft; onChange: (v: VendorDraft) => void; showBank: boolean; hideKind?: boolean }) {
  const set = <K extends keyof VendorDraft>(k: K, v: VendorDraft[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="取引先名"><input className={inputCls} value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="例: デザイナーAさん" /></Field>
        {!hideKind && (
          <Field label="取引先の種類">
            <select className={inputCls} value={value.kind} onChange={(e) => set('kind', e.target.value as VendorDraft['kind'])}>
              <option value="company">会社</option>
              <option value="individual">個人</option>
            </select>
          </Field>
        )}
        <Field label="担当業務" hint="例: デザイン、開発、記事制作"><input className={inputCls} value={value.role} onChange={(e) => set('role', e.target.value)} /></Field>
        <Field label="インボイス登録番号" hint="T から始まる14文字"><input className={inputCls} value={value.invoiceRegNo} onChange={(e) => set('invoiceRegNo', e.target.value)} placeholder="T1234567890123" /></Field>
      </div>
      <Check checked={value.withholdingDefault} onChange={(v) => set('withholdingDefault', v)} label="源泉徴収の対象にする（既定）" hint="契約ごとに変更できます。判断に迷う場合は、税理士に確認してください。" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="締め日">
          <select className={inputCls} value={value.closingDay} onChange={(e) => set('closingDay', e.target.value)}>{DAYS.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}</select>
        </Field>
        <Field label="支払月">
          <select className={inputCls} value={value.paymentMonths} onChange={(e) => set('paymentMonths', e.target.value)}>
            <option value="0">当月</option><option value="1">翌月</option><option value="2">翌々月</option><option value="3">3か月後</option>
          </select>
        </Field>
        <Field label="支払日">
          <select className={inputCls} value={value.paymentDay} onChange={(e) => set('paymentDay', e.target.value)}>{DAYS.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}</select>
        </Field>
      </div>
      {showBank && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="銀行名"><input className={inputCls} value={value.bankName} onChange={(e) => set('bankName', e.target.value)} /></Field>
          <Field label="支店名"><input className={inputCls} value={value.bankBranch} onChange={(e) => set('bankBranch', e.target.value)} /></Field>
          <Field label="口座種別">
            <select className={inputCls} value={value.bankAccountType} onChange={(e) => set('bankAccountType', e.target.value)}><option>普通</option><option>当座</option></select>
          </Field>
          <Field label="口座番号"><input className={inputCls} value={value.bankAccountNo} onChange={(e) => set('bankAccountNo', e.target.value)} /></Field>
          <Field label="口座名義" className="sm:col-span-2"><input className={inputCls} value={value.bankAccountHolder} onChange={(e) => set('bankAccountHolder', e.target.value)} /></Field>
        </div>
      )}
      <Field label="メモ"><textarea className={inputCls} rows={2} value={value.note} onChange={(e) => set('note', e.target.value)} /></Field>
    </div>
  )
}
