// ============================================
// ドヤ支出管理: 契約 → 月ごとの支払予定（純粋関数）
// ============================================
// ⚠️ DB に触らない。schedule-sync.ts がこの結果を expense_schedules に書く。
// ⚠️ 金額はすべて Int（円。USD の単価はセント）。端数は税・源泉とも切り捨て。
import {
  addMonthsToYm, clampDay, monthsBetween, payDateFor, parseYmd, ymd, ymOf,
  type PayTerms, type Ym, type Ymd,
} from './dates'
import { withholdingFor } from './withholding'

export type PriceInput = {
  effectiveFrom: Ymd
  unitPrice: number
  quantity: number
  capQuantity: number | null
  taxRate: number
  taxIncluded: boolean
}

export type ContractInput = {
  billingModel: string
  frequencyMonths: number
  anchorDate: Ymd
  startDate: Ymd
  endDate: Ymd | null
  autoRenew: boolean
  status: string
  currency: string
  withholding: boolean
  forecastMode: string
  prices: PriceInput[]
}

export type PaymentMethodInput = {
  type: string
  closingDay: number | null
  withdrawalMonths: number | null
  withdrawalDay: number | null
} | null

export type VendorTermsInput = { closingDay: number; paymentMonths: number; paymentDay: number }

export type PlannedRow = {
  period: Ymd
  eventDate: Ymd
  plannedPayDate: Ymd
  amountExclTax: number
  taxAmount: number
  withholdingAmount: number
  netPayAmount: number
  estimated: boolean
}

export class FxRateMissingError extends Error {
  constructor(readonly month: Ym, readonly currency: string) {
    super(`${month} の ${currency} の為替レートが未設定です。設定画面で登録してください。`)
    this.name = 'FxRateMissingError'
  }
}

/** 支払方法と取引先の支払条件から、出金日の計算規則を決める（設計書 §5.4） */
export function resolvePayTerms(method: PaymentMethodInput, vendor: VendorTermsInput): PayTerms {
  if (method?.type === 'card') {
    return { closingDay: method.closingDay ?? 31, months: method.withdrawalMonths ?? 1, payDay: method.withdrawalDay ?? 27 }
  }
  if (method?.type === 'debit') {
    // 口座振替: 発生した月の引落日（過ぎていれば翌月）
    const day = method.withdrawalDay ?? 27
    return { closingDay: day, months: 0, payDay: day }
  }
  return { closingDay: vendor.closingDay, months: vendor.paymentMonths, payDay: vendor.paymentDay }
}

/** その月に支払が発生する月の一覧（fromYm〜toYm の範囲内） */
export function occurrenceMonths(c: Pick<ContractInput, 'frequencyMonths' | 'anchorDate' | 'startDate' | 'endDate' | 'autoRenew' | 'status'>, fromYm: Ym, toYm: Ym): Ym[] {
  if (c.status !== 'active') return []
  const startYm = ymOf(c.startDate)
  const anchorYm = ymOf(c.anchorDate)
  // 自動更新の契約は終了日を「今の契約期間の終わり」とみなし、その先も続ける
  const endYm = c.endDate && !c.autoRenew ? ymOf(c.endDate) : null
  if (c.frequencyMonths <= 0) {
    const m = anchorYm < startYm ? startYm : anchorYm
    return m >= fromYm && m <= toYm && (!endYm || m <= endYm) ? [m] : []
  }
  const out: Ym[] = []
  let m = fromYm < startYm ? startYm : fromYm
  while (m <= toYm && (!endYm || m <= endYm)) {
    const diff = monthsBetween(anchorYm, m)
    if (((diff % c.frequencyMonths) + c.frequencyMonths) % c.frequencyMonths === 0) out.push(m)
    m = addMonthsToYm(m, 1)
  }
  return out
}

/** その月に有効な単価（effectiveFrom がその月以前で一番新しいもの。無ければ一番古いもの） */
export function priceAt(prices: PriceInput[], ym: Ym): PriceInput | null {
  if (!prices.length) return null
  const sorted = [...prices].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  let hit: PriceInput | null = null
  for (const p of sorted) if (ymOf(p.effectiveFrom) <= ym) hit = p
  return hit ?? sorted[0]
}

/** 税込・税抜の指定から、税抜額と消費税額に分ける */
export function splitTax(amount: number, taxRate: number, taxIncluded: boolean): { exclTax: number; tax: number } {
  if (taxIncluded) {
    const tax = Math.floor((amount * taxRate) / (100 + taxRate))
    return { exclTax: amount - tax, tax }
  }
  return { exclTax: amount, tax: Math.floor((amount * taxRate) / 100) }
}

/** 税抜額と税額から、源泉と実際の出金額を出す */
export function settle(amountExclTax: number, taxAmount: number, withholding: boolean) {
  const withholdingAmount = withholding ? withholdingFor(amountExclTax) : 0
  return { withholdingAmount, netPayAmount: amountExclTax + taxAmount - withholdingAmount }
}

export type PlanContext = {
  fromYm: Ym
  toYm: Ym
  terms: PayTerms
  /** 1 単位あたりの円。未設定なら null */
  fxRate: (ym: Ym, currency: string) => number | null
  /** 直近の実績（税抜・円。新しい順）。avg3 で使う */
  recentActuals: number[]
}

export function planContract(c: ContractInput, ctx: PlanContext): PlannedRow[] {
  const rows: PlannedRow[] = []
  for (const ym of occurrenceMonths(c, ctx.fromYm, ctx.toYm)) {
    const price = priceAt(c.prices, ym)
    if (!price) continue
    const { y, m } = parseYmd(`${ym}-01`)
    let eventDate = ymd(y, m, clampDay(y, m, parseYmd(c.anchorDate).d))
    if (eventDate < c.startDate) eventDate = c.startDate

    const avg = ctx.recentActuals.slice(0, 3)
    const useAvg = c.forecastMode === 'avg3' && avg.length > 0 && (c.billingModel === 'hourly' || c.billingModel === 'variable')
    let exclTax: number
    let tax: number
    let estimated = c.billingModel === 'hourly' || c.billingModel === 'variable' || c.forecastMode === 'avg3'
    if (useAvg) {
      exclTax = Math.floor(avg.reduce((s, v) => s + v, 0) / avg.length)
      tax = Math.floor((exclTax * price.taxRate) / 100)
    } else {
      const qty = c.billingModel === 'hourly' && c.forecastMode === 'cap' ? (price.capQuantity ?? price.quantity) : price.quantity
      let gross = price.unitPrice * qty
      if (c.currency !== 'JPY') {
        const rate = ctx.fxRate(ym, c.currency)
        if (rate == null) throw new FxRateMissingError(ym, c.currency)
        gross = Math.round((gross * rate) / 100) // セント → 円
        estimated = true
      }
      ;({ exclTax, tax } = splitTax(gross, price.taxRate, price.taxIncluded))
    }
    const s = settle(exclTax, tax, c.withholding)
    rows.push({
      period: `${ym}-01`,
      eventDate,
      plannedPayDate: payDateFor(eventDate, ctx.terms),
      amountExclTax: exclTax,
      taxAmount: tax,
      ...s,
      estimated,
    })
  }
  return rows
}

/** 月額に直した金額（ダッシュボードの「固定費（月額）」用。単発は 0） */
export function monthlyEquivalent(amountExclTax: number, frequencyMonths: number): number {
  return frequencyMonths > 0 ? Math.round(amountExclTax / frequencyMonths) : 0
}
