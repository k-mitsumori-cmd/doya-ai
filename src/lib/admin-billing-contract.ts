import { adminBillingPeriodRange, type AdminBillingPeriod } from './admin-billing-period'

export interface AdminBillingData {
  version: 1
  currency: 'jpy'
  timeZone: 'Asia/Tokyo'
  period: AdminBillingPeriod
  label: string
  since: string
  until: string
  updatedAt: string
  paidInvoiceCount: number
  paidTotal: number
  refundTotal: number
  pendingRefundCount: number
  pendingRefundTotal: number
  netRevenue: number
  mrr: number
  activeSubscriptions: number
  mrrSubscriptions: number
  activeCustomers: number | null
  arpu: number | null
  trialingSubscriptions: number
  discountPolicy: { subtractRecurringDiscounts: boolean; subtractOneTimeDiscounts: boolean }
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const money = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER
const iso = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v

/** 読み取れない金額や別の期間の応答を、正常な0円として扱わない。 */
export function isAdminBillingData(value: unknown, expectedPeriod: AdminBillingPeriod): value is AdminBillingData {
  if (!record(value) || value.version !== 1 || value.currency !== 'jpy' || value.timeZone !== 'Asia/Tokyo' || value.period !== expectedPeriod) return false
  if (!iso(value.since) || !iso(value.until) || !iso(value.updatedAt)) return false
  const range = adminBillingPeriodRange(expectedPeriod, new Date(value.updatedAt))
  if (value.since !== range.since.toISOString() || value.until !== range.until.toISOString() || value.label !== range.label) return false
  for (const key of ['paidInvoiceCount', 'paidTotal', 'refundTotal', 'pendingRefundCount', 'pendingRefundTotal', 'activeSubscriptions', 'mrrSubscriptions', 'trialingSubscriptions']) if (!count(value[key])) return false
  if ((value.paidInvoiceCount === 0) !== (value.paidTotal === 0) || Number(value.paidTotal) < Number(value.paidInvoiceCount)) return false
  if ((value.pendingRefundCount === 0) !== (value.pendingRefundTotal === 0) || Number(value.pendingRefundTotal) < Number(value.pendingRefundCount)) return false
  if (typeof value.netRevenue !== 'number' || !Number.isSafeInteger(value.netRevenue) || value.netRevenue !== Number(value.paidTotal) - Number(value.refundTotal) || !money(value.mrr)) return false
  if (Number(value.mrrSubscriptions) > Number(value.activeSubscriptions) || (value.mrr === 0) !== (value.mrrSubscriptions === 0)) return false
  if (value.activeCustomers === null) {
    if (value.arpu !== null) return false
  } else {
    if (!count(value.activeCustomers) || value.activeCustomers > Number(value.mrrSubscriptions) || !money(value.arpu)) return false
    if (value.activeCustomers === 0) {
      if (value.mrr !== 0 || value.arpu !== 0) return false
    } else {
      const expectedArpu = value.mrr / value.activeCustomers
      if (Math.abs(value.arpu - expectedArpu) > Math.max(1e-8, Number.EPSILON * Math.abs(expectedArpu) * 8)) return false
    }
  }
  if (!record(value.discountPolicy) || typeof value.discountPolicy.subtractRecurringDiscounts !== 'boolean' || typeof value.discountPolicy.subtractOneTimeDiscounts !== 'boolean') return false
  return true
}
