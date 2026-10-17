// ============================================
// ドヤ支出管理: 取引先・契約・単価の入力を DB の形にする
// ============================================
import type { Prisma } from '@prisma/client'
import { ExpenseHttpError } from './access'
import {
  BILLING_MODELS, CATEGORIES, CONTRACT_STATUSES, CURRENCIES, FORECAST_MODES, FREQUENCIES, PAYMENT_METHOD_TYPES,
} from './constants'
import { toDbDate } from './dates'
import { normalizeVendorName } from './normalize'
import { bool, date, day, int, invoiceRegNo, money, oneOf, str } from './validate'

type Body = Record<string, unknown>

/** 取引先。partial=true なら送られてきた項目だけ */
export function vendorInput(b: Body, partial = false): Omit<Prisma.ExpenseVendorUncheckedCreateInput, 'organizationId'> {
  const has = (k: string) => !partial || k in b
  const out: Record<string, unknown> = {}
  if (has('name')) {
    out.name = str(b.name, '取引先名', 120)
    out.nameNormalized = normalizeVendorName(out.name as string)
  }
  if (has('kind')) out.kind = oneOf(b.kind, ['company', 'individual'] as const, '取引先の種類', 'company')
  if (has('role')) out.role = str(b.role, '担当業務', 80, false)
  if (has('invoiceRegNo')) out.invoiceRegNo = invoiceRegNo(b.invoiceRegNo)
  if (has('withholdingDefault')) out.withholdingDefault = bool(b.withholdingDefault)
  if (has('closingDay')) out.closingDay = day(b.closingDay, '締め日', false) ?? 31
  if (has('paymentMonths')) out.paymentMonths = int(b.paymentMonths, '支払月', 0, 3, false) ?? 1
  if (has('paymentDay')) out.paymentDay = day(b.paymentDay, '支払日', false) ?? 31
  if (has('note')) out.note = str(b.note, 'メモ', 1000, false)
  for (const [k, label, max] of [
    ['bankName', '銀行名', 60], ['bankBranch', '支店名', 60], ['bankAccountType', '口座種別', 10],
    ['bankAccountNo', '口座番号', 20], ['bankAccountHolder', '口座名義', 80],
  ] as const) {
    if (has(k)) out[k] = str(b[k], label, max, false)
  }
  return out as Omit<Prisma.ExpenseVendorUncheckedCreateInput, 'organizationId'>
}

export const BANK_FIELDS = ['bankName', 'bankBranch', 'bankAccountType', 'bankAccountNo', 'bankAccountHolder'] as const

/** 契約の条件（金額以外）。partial=true なら送られてきた項目だけ */
export function contractInput(b: Body, partial = false) {
  const has = (k: string) => !partial || k in b
  const out: Record<string, unknown> = {}
  if (has('title')) out.title = str(b.title, '名称', 120)
  if (has('category')) out.category = oneOf(b.category, CATEGORIES, 'カテゴリ')
  if (has('billingModel')) out.billingModel = oneOf(b.billingModel, BILLING_MODELS, '契約の形', 'fixed')
  if (has('frequencyMonths')) out.frequencyMonths = oneOf(typeof b.frequencyMonths === 'string' ? Number(b.frequencyMonths) : b.frequencyMonths, FREQUENCIES, '支払周期', 1)
  if (has('startDate')) out.startDate = toDbDate(date(b.startDate, '開始日')!)
  if (has('anchorDate')) {
    const a = date(b.anchorDate, '支払の起点日', false)
    if (a) out.anchorDate = toDbDate(a)
  }
  if (has('endDate')) {
    const e = date(b.endDate, '終了日', false)
    out.endDate = e ? toDbDate(e) : null
  }
  if (has('autoRenew')) out.autoRenew = bool(b.autoRenew)
  if (has('renewalNoticeDays')) out.renewalNoticeDays = int(b.renewalNoticeDays, '更新の通知日数', 0, 365, false) ?? 30
  if (has('currency')) out.currency = oneOf(b.currency, CURRENCIES, '通貨', 'JPY')
  if (has('withholding')) out.withholding = bool(b.withholding)
  if (has('forecastMode')) out.forecastMode = oneOf(b.forecastMode, FORECAST_MODES, '予測の方法', 'planned')
  if (has('status')) out.status = oneOf(b.status, CONTRACT_STATUSES, '状態', 'active')
  if (has('note')) out.note = str(b.note, 'メモ', 1000, false)
  // 起点日が無ければ開始日を起点にする（毎月なら開始日の日付が支払の基準日）
  if (!partial && !out.anchorDate) out.anchorDate = out.startDate
  if (out.endDate && out.startDate && (out.endDate as Date) < (out.startDate as Date)) {
    throw new ExpenseHttpError(400, '終了日は開始日より後の日付にしてください')
  }
  return out
}

/** 単価 */
export function priceInput(b: Body, fallbackEffectiveFrom?: string) {
  return {
    effectiveFrom: toDbDate(date(b.effectiveFrom ?? fallbackEffectiveFrom, '適用開始日')!),
    unitPrice: money(b.unitPrice, '単価')!,
    quantity: int(b.quantity, '数量', 0, 100_000, false) ?? 1,
    capQuantity: int(b.capQuantity, '上限', 0, 100_000, false),
    taxRate: oneOf(typeof b.taxRate === 'string' ? Number(b.taxRate) : b.taxRate, [10, 8, 0] as const, '税率', 10),
    taxIncluded: bool(b.taxIncluded),
  }
}

/** 支払方法（カードは締め日・引落月・引落日、口座振替は引落日、振込は取引先の条件を使う） */
export function paymentMethodInput(b: Body) {
  const type = oneOf(b.type, PAYMENT_METHOD_TYPES, '支払方法の種類')
  return {
    type,
    label: str(b.label, '名前', 60)!,
    closingDay: type === 'card' ? day(b.closingDay, '締め日') : null,
    withdrawalMonths: type === 'card' ? int(b.withdrawalMonths, '引落月', 0, 3) : null,
    withdrawalDay: type === 'transfer' ? null : day(b.withdrawalDay, '引落日'),
  }
}
