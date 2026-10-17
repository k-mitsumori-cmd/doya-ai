'use client'

// 請求書の帳票（適格請求書）。画面表示と印刷・PDF 保存の両方に使う
import { ACCOUNT_TYPE_LABEL, ymdW, yen } from './ui'

type Issuer = {
  companyName?: string | null; postalCode?: string | null; address?: string | null; tel?: string | null; personName?: string | null
  invoiceRegNo?: string | null; bankName?: string | null; bankBranch?: string | null; bankAccountType?: string | null
  bankAccountNo?: string | null; bankAccountHolder?: string | null; invoiceNotes?: string | null
}
type ClientSnap = { name?: string | null; postalCode?: string | null; address?: string | null; department?: string | null; contactName?: string | null }

export type SheetInvoice = {
  status: string
  invoiceNo: string | null
  title: string | null
  issueDate: string
  dueDate: string
  notes: string | null
  voidReason?: string | null
  subtotalExclTax: number
  taxAmount: number
  totalInclTax: number
  taxBreakdown: { rate: number; base: number; tax: number }[] | null
  issuerSnapshot: Issuer | null
  clientSnapshot: ClientSnap | null
  client: { name: string; postalCode: string | null; address: string | null; billingDepartment: string | null; billingContactName: string | null }
  items: { id?: string; name: string; quantity: number; unitPrice: number; taxRate: number; amountExclTax: number }[]
}

export const PRINT_CSS = `
@media print {
  aside, nav, header, .no-print { display: none !important; }
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  .h-screen { height: auto !important; }
  .overflow-hidden, .overflow-y-auto, .overflow-auto { overflow: visible !important; }
  .invoice-sheet { box-shadow: none !important; border: none !important; border-radius: 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
  @page { size: A4; margin: 14mm; }
}
`

export default function InvoiceSheet({ invoice, issuer }: { invoice: SheetInvoice; issuer: Issuer | null }) {
  const confirmed = invoice.status !== 'draft'
  const iss: Issuer = (confirmed ? invoice.issuerSnapshot : issuer) ?? {}
  const cl: ClientSnap = confirmed && invoice.clientSnapshot
    ? invoice.clientSnapshot
    : { name: invoice.client.name, postalCode: invoice.client.postalCode, address: invoice.client.address, department: invoice.client.billingDepartment, contactName: invoice.client.billingContactName }
  const hasReduced = invoice.items.some((i) => i.taxRate === 8)
  const hasBank = iss.bankName || iss.bankBranch || iss.bankAccountNo || iss.bankAccountHolder

  return (
    <div className="invoice-sheet relative mx-auto w-full max-w-[820px] rounded-lg border border-slate-300 bg-white p-6 text-slate-900 shadow-sm sm:p-10">
      <style>{PRINT_CSS}</style>

      {invoice.status === 'void' && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-center text-sm font-black text-red-700">
          この請求書は取消済みです{invoice.voidReason ? `（${invoice.voidReason}）` : ''}
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-2xl font-black tracking-widest">請求書</h2>
        <div className="text-right text-xs font-bold leading-relaxed">
          {invoice.invoiceNo ? <p>請求書番号 {invoice.invoiceNo}</p> : <p className="text-sm font-black text-amber-600">下書き（社内確認用）</p>}
          <p>請求日 {ymdW(invoice.issueDate)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="text-sm">
          <p className="border-b border-slate-800 pb-1 text-lg font-black">{cl.name} 御中</p>
          {(cl.department || cl.contactName) && <p className="mt-1 text-xs font-bold">{[cl.department, cl.contactName ? `${cl.contactName} 様` : ''].filter(Boolean).join(' ')}</p>}
          {(cl.postalCode || cl.address) && <p className="mt-1 text-xs text-slate-600">{[cl.postalCode ? `〒${cl.postalCode}` : '', cl.address].filter(Boolean).join(' ')}</p>}
          {invoice.title && <p className="mt-3 text-xs font-bold">件名: {invoice.title}</p>}
        </div>
        <div className="text-xs leading-relaxed sm:text-right">
          <p className="text-sm font-black">{iss.companyName ?? '（請求元が未登録です）'}</p>
          {(iss.postalCode || iss.address) && <p>{[iss.postalCode ? `〒${iss.postalCode}` : '', iss.address].filter(Boolean).join(' ')}</p>}
          {iss.tel && <p>TEL {iss.tel}</p>}
          {iss.personName && <p>担当 {iss.personName}</p>}
          <p className="font-bold">登録番号 {iss.invoiceRegNo || '（未登録）'}</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3">
        <p className="text-xs font-bold text-slate-600">ご請求金額（税込）</p>
        <p className="text-3xl font-black tabular-nums">{yen(invoice.totalInclTax)}</p>
        <p className="mt-1 text-xs font-bold text-slate-700">お支払期日 {ymdW(invoice.dueDate)}</p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-xs">
          <thead>
            <tr className="border-y border-slate-800 bg-slate-50 text-left font-black">
              <th className="px-2 py-1.5">品目</th><th className="px-2 py-1.5 text-right">数量</th><th className="px-2 py-1.5 text-right">単価</th>
              <th className="px-2 py-1.5 text-right">税率</th><th className="px-2 py-1.5 text-right">金額（税抜）</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={it.id ?? i} className="border-b border-slate-200">
                <td className="px-2 py-1.5 font-bold">{it.name}{it.taxRate === 8 ? ' ※' : ''}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{it.quantity.toLocaleString('ja-JP')}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{yen(it.unitPrice)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{it.taxRate}%</td>
                <td className="px-2 py-1.5 text-right font-bold tabular-nums">{yen(it.amountExclTax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasReduced && <p className="mt-1 text-[11px] font-bold text-slate-600">※は軽減税率（8%）対象</p>}
      </div>

      <div className="mt-4 ml-auto w-full max-w-xs text-xs">
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
          {(invoice.taxBreakdown ?? []).map((b) => (
            <div key={b.rate} className="col-span-2 flex justify-between gap-4 text-slate-600">
              <dt>{b.rate}%対象 {yen(b.base)}</dt><dd className="text-right">消費税 {yen(b.tax)}</dd>
            </div>
          ))}
          <dt className="mt-1 border-t border-slate-300 pt-1 font-bold">小計（税抜）</dt><dd className="mt-1 border-t border-slate-300 pt-1 text-right font-bold">{yen(invoice.subtotalExclTax)}</dd>
          <dt className="font-bold">消費税</dt><dd className="text-right font-bold">{yen(invoice.taxAmount)}</dd>
          <dt className="border-t border-slate-800 pt-1 text-sm font-black">合計（税込）</dt><dd className="border-t border-slate-800 pt-1 text-right text-sm font-black">{yen(invoice.totalInclTax)}</dd>
        </dl>
      </div>

      {hasBank && (
        <div className="mt-6 rounded-lg border border-slate-300 px-4 py-3 text-xs leading-relaxed">
          <p className="font-black">お振込先</p>
          <p className="font-bold">
            {[iss.bankName, iss.bankBranch].filter(Boolean).join(' ')}
            {iss.bankAccountType ? ` ${ACCOUNT_TYPE_LABEL[iss.bankAccountType] ?? iss.bankAccountType}` : ''}
            {iss.bankAccountNo ? ` ${iss.bankAccountNo}` : ''}
          </p>
          {iss.bankAccountHolder && <p>口座名義 {iss.bankAccountHolder}</p>}
          <p className="text-slate-500">お振込手数料はお客様のご負担でお願いいたします。</p>
        </div>
      )}

      {(invoice.notes || iss.invoiceNotes) && (
        <div className="mt-4 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
          <p className="font-black text-slate-900">備考</p>
          {[invoice.notes, iss.invoiceNotes].filter(Boolean).join('\n')}
        </div>
      )}
    </div>
  )
}
