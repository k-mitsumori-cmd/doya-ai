// Income conversation amendments use the same integer-yen and tax-rate rounding as the form.
import { computeInvoiceTotals, MAX_YEN, type TaxRate } from '@/lib/income/tax'
import { yenText } from './today'
import type { AgentFormSnapshot } from './types'

export interface IncomeAmountAmendment {
  amount: number
  rate: TaxRate
  requestedGross: number | null
  subtotal: number
  tax: number
  total: number
}

export function planIncomeAmountAmendment(snap: AgentFormSnapshot, amount: number | null, inclusive: boolean): IncomeAmountAmendment {
  if (snap._amountLineCount !== '1') throw new Error('明細が複数ある場合は、画面で各明細の金額を調整してください。内訳は変更していません。')
  if (!['10', '8', '0'].includes(snap._amountTaxRate)) throw new Error('税率を確認できませんでした。画面で税率と金額を確認してください。')
  const rate = Number(snap._amountTaxRate) as TaxRate
  const base = amount ?? (/^\d+$/.test(snap.subtotal) ? Number(snap.subtotal) : NaN)
  if (!Number.isSafeInteger(base) || base <= 0 || base > MAX_YEN) throw new Error('金額は1円から10億円までの整数で指定してください。')
  let net = base
  if (inclusive) {
    const lower = Math.floor((base * 100) / (100 + rate))
    // Truncation can make the adjacent integer an exact match. Otherwise keep the closest lower total.
    const upper = lower + 1
    const upperTax = Math.trunc((upper * rate) / 100)
    net = upper + upperTax <= base ? upper : lower
  }
  const totals = computeInvoiceTotals([{ quantity: 1, unitPrice: net, taxRate: rate }])
  return { amount: net, rate, requestedGross: inclusive ? base : null, subtotal: totals.subtotalExclTax, tax: totals.taxAmount, total: totals.totalInclTax }
}

/** Only issue a new confirmation when the actual form agrees with the planned values. */
export function incomeAmountAmendmentMessage(plan: IncomeAmountAmendment, snap: AgentFormSnapshot): string {
  if (snap._amountLineCount !== '1' || snap._amountTaxRate !== String(plan.rate) || snap.subtotal !== String(plan.subtotal) || snap.tax !== String(plan.tax) || snap.total !== String(plan.total)) {
    throw new Error('金額の調整中に明細または税率が変わりました。画面の内容を確認して、依頼から始め直してください。')
  }
  if (plan.requestedGross == null) return `税抜の ${yenText(plan.subtotal)} に直しました。消費税は ${yenText(plan.tax)}、確認合計は ${yenText(plan.total)} です。`
  const lead = `税込みの ${yenText(plan.requestedGross)} を、税率${plan.rate}%で税抜の ${yenText(plan.subtotal)} に直しました。消費税は ${yenText(plan.tax)}、確認合計は ${yenText(plan.total)} です。`
  const difference = plan.total - plan.requestedGross
  return difference === 0 ? lead : `${lead} 整数円と消費税の端数処理により、指定した税込額より ${yenText(-difference)} 少なくなります。内容を確認してから登録してください。`
}
