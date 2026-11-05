import { itemAmount, type PriceLike, type TierLike } from '@/lib/pricing-v2/amount'

export type AdminContractPrice =
  | { version: 1; status: 'known'; amount: number; currency: string; interval: 'day' | 'week' | 'month' | 'year'; intervalCount: number }
  | { version: 1; status: 'unavailable' | 'usage-based' }

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const unavailable = (): AdminContractPrice => ({ version: 1, status: 'unavailable' })
const interval = (v: unknown): v is 'day' | 'week' | 'month' | 'year' => typeof v === 'string' && ['day', 'week', 'month', 'year'].includes(v)
const currency = (v: unknown): v is string => typeof v === 'string' && /^[a-z]{3}$/.test(v)
const zeroDecimal = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'])

function unit(raw: unknown, decimal: unknown, nullIsZero = false): number | null {
  if (count(raw)) return raw
  if (raw !== null && raw !== undefined) return null
  if (typeof decimal === 'string' && /^\d+(\.\d{1,12})?$/.test(decimal)) {
    const value = Number(decimal)
    return count(value) ? value : null
  }
  return nullIsZero && (decimal === null || decimal === undefined) ? 0 : null
}

/** Configured recurring subtotal for one common billing period, before discounts
 * or invoice-level tax adjustment. Tax-inclusive configured prices stay intact.
 * Missing prices, incomplete pagination and usage amounts are never zero-filled.
 * Expanded item price tiers are supplied by the existing subscription GET.
 */
export function summarizeAdminContractPrice(subscription: unknown): AdminContractPrice {
  if (!record(subscription) || !currency(subscription.currency) || !record(subscription.items) || subscription.items.has_more !== false || !Array.isArray(subscription.items.data) || !subscription.items.data.length) return unavailable()
  let amount = 0
  let common: { currency: string; interval: 'day' | 'week' | 'month' | 'year'; intervalCount: number } | null = null
  for (const raw of subscription.items.data) {
    if (!record(raw) || !record(raw.price)) return unavailable()
    const p = raw.price
    if (!record(p.recurring)) return unavailable()
    if (p.recurring.usage_type === 'metered') return { version: 1, status: 'usage-based' }
    if (p.recurring.usage_type !== 'licensed' || !currency(p.currency) || p.currency !== subscription.currency || !interval(p.recurring.interval)) return unavailable()
    const intervalCount = p.recurring.interval_count ?? 1
    if (!count(intervalCount) || intervalCount < 1) return unavailable()
    const next = { currency: p.currency, interval: p.recurring.interval, intervalCount }
    if (common && (common.currency !== next.currency || common.interval !== next.interval || common.intervalCount !== next.intervalCount)) return unavailable()
    common = next
    const requestedQuantity = raw.quantity ?? 1
    if (!count(requestedQuantity) || typeof p.id !== 'string' || !p.id) return unavailable()
    let quantity: number = requestedQuantity
    if (p.transform_quantity !== null && p.transform_quantity !== undefined) {
      const transform = p.transform_quantity
      if (p.billing_scheme !== 'per_unit' || !record(transform) || !count(transform.divide_by) || transform.divide_by < 1 || (transform.round !== 'up' && transform.round !== 'down')) return unavailable()
      quantity = transform.round === 'up' ? Math.ceil(quantity / transform.divide_by) : Math.floor(quantity / transform.divide_by)
    }
    let normalized: PriceLike
    if (p.billing_scheme === 'tiered') {
      if ((p.tiers_mode !== 'volume' && p.tiers_mode !== 'graduated') || !Array.isArray(p.tiers) || !p.tiers.length) return unavailable()
      const tiers: TierLike[] = []
      let previous = 0
      for (let index = 0; index < p.tiers.length; index++) {
        const t = p.tiers[index]
        if (!record(t)) return unavailable()
        if (t.up_to === null ? index !== p.tiers.length - 1 : !count(t.up_to) || t.up_to <= previous) return unavailable()
        if ([t.unit_amount, t.unit_amount_decimal, t.flat_amount, t.flat_amount_decimal].every(v => v === null || v === undefined)) return unavailable()
        const unitAmount = unit(t.unit_amount, t.unit_amount_decimal, true)
        const flatAmount = unit(t.flat_amount, t.flat_amount_decimal, true)
        if (unitAmount === null || flatAmount === null) return unavailable()
        tiers.push({ up_to: t.up_to as number | null, unit_amount: unitAmount, flat_amount: flatAmount })
        if (typeof t.up_to === 'number') previous = t.up_to
      }
      const last = tiers[tiers.length - 1]
      if (last.up_to !== null && quantity > last.up_to) return unavailable()
      if (quantity === 0 && tiers.some(t => t.flat_amount !== 0)) return unavailable()
      normalized = { id: p.id, unit_amount: null, billing_scheme: 'tiered', tiers_mode: String(p.tiers_mode), tiers }
    } else if (p.billing_scheme === 'per_unit') {
      const value = unit(p.unit_amount, p.unit_amount_decimal)
      if (value === null) return unavailable()
      normalized = { id: p.id, unit_amount: value, billing_scheme: 'per_unit' }
    } else return unavailable()
    const line = itemAmount({ quantity, price: normalized })
    if (!line.known || !count(line.amount) || !count(amount + line.amount)) return unavailable()
    amount += line.amount
  }
  return common ? { version: 1, status: 'known', amount, ...common } : unavailable()
}

/** Stripe minor units. JPY and the documented zero-decimal currencies use 1.
 * ISK keeps 2 API decimals even though the displayed currency has no decimals.
 */
export function formatAdminContractPrice(value: unknown): string {
  const unknown = '料金を確認できません'
  if (!record(value) || value.version !== 1) return unknown
  if (value.status === 'usage-based') return '利用量に応じて変動します'
  if (value.status !== 'known' || !count(value.amount) || !currency(value.currency) || !interval(value.interval) || !count(value.intervalCount) || value.intervalCount < 1) return unknown
  try {
    const code = value.currency.toUpperCase()
    if (typeof Intl.supportedValuesOf !== 'function' || !Intl.supportedValuesOf('currency').includes(code)) return unknown
    const base = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: code })
    const digits = zeroDecimal.has(value.currency) ? 0 : value.currency === 'isk' ? 2 : base.resolvedOptions().maximumFractionDigits
    if (digits === undefined || (value.currency === 'isk' && value.amount % 100 !== 0)) return unknown
    const money = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: code, ...(zeroDecimal.has(value.currency) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}) }).format(value.amount / 10 ** digits).replace(/^￥/, '¥')
    const labels = { day: '日', week: '週', month: value.intervalCount === 1 ? '月' : 'か月', year: '年' }
    return `${money}/${value.intervalCount === 1 ? '' : value.intervalCount}${labels[value.interval]}`
  } catch { return unknown }
}
