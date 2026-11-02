import { itemAmount, type PriceLike, type TierLike } from '@/lib/pricing-v2/amount'

interface Coupon {
  duration: 'forever' | 'repeating' | 'once'
  percent_off: number | null
  amount_off: number | null
  currency: string | null
  applies_to?: { products?: string[] }
  currency_options?: { [currency: string]: { amount_off: number } }
}
interface Discount {
  id: string
  start: number
  end: number | null
  coupon: Coupon
  deleted?: boolean | void
}
interface TaxRate { inclusive: boolean; percentage: number }
interface MrrTier extends TierLike { unit_amount_decimal?: string | null; flat_amount_decimal?: string | null }
interface ContractPrice extends PriceLike {
  currency: string
  unit_amount_decimal?: string | null
  product: string | { id: string }
  transform_quantity?: { divide_by: number; round: 'up' | 'down' } | null
  recurring?: { interval?: string | null; interval_count?: number | null; usage_type?: string | null } | null
  tiers?: MrrTier[] | null
}
interface ContractItem {
  quantity?: number | null
  price: ContractPrice
  discounts?: Array<Discount | string>
  tax_rates?: TaxRate[] | null
}
export interface MrrContract {
  status: string
  items: { data: ContractItem[]; has_more: boolean }
  discount?: Discount | null
  discounts?: Array<Discount | string>
  customer: string | { id?: string; discount?: Discount | null; deleted?: boolean | void }
  default_tax_rates?: TaxRate[] | null
  automatic_tax?: { enabled: boolean }
}
export interface MrrDiscountPolicy {
  subtractRecurringDiscounts: boolean
  subtractOneTimeDiscounts: boolean
}
interface Line { amount: number; months: number; productId: string; inclusiveFactor: number }

function finiteMoney(n: number): number {
  if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) throw new Error('Unresolved MRR amount')
  return n
}
function decimalAmount(raw: number | null, decimal?: string | null): number {
  if (raw !== null) return finiteMoney(raw)
  if (typeof decimal !== 'string' || !/^\d+(\.\d{1,12})?$/.test(decimal)) throw new Error('Unresolved MRR price')
  return finiteMoney(Number(decimal))
}
function normalizedTiers(tiers: MrrTier[]): TierLike[] {
  if (!tiers.length) throw new Error('Unresolved MRR tiers')
  let previous = 0
  return tiers.map((tier, index) => {
    if (tier.up_to === null) {
      if (index !== tiers.length - 1) throw new Error('Unresolved MRR tier boundary')
    } else {
      if (!Number.isSafeInteger(tier.up_to) || tier.up_to <= previous) throw new Error('Unresolved MRR tier boundary')
      previous = tier.up_to
    }
    return {
      up_to: tier.up_to,
      unit_amount: tier.unit_amount !== null ? finiteMoney(tier.unit_amount) : tier.unit_amount_decimal != null ? decimalAmount(null, tier.unit_amount_decimal) : 0,
      flat_amount: tier.flat_amount !== null ? finiteMoney(tier.flat_amount) : tier.flat_amount_decimal != null ? decimalAmount(null, tier.flat_amount_decimal) : 0,
    }
  })
}
function activeDiscounts(raw: Array<Discount | string>, seconds: number, policy: MrrDiscountPolicy): Discount[] {
  const unique = new Map<string, Discount>()
  for (const d of raw) {
    if (typeof d === 'string' || !d?.coupon || !d.id) throw new Error('Unresolved MRR discount')
    if (d.deleted) continue
    if (!Number.isSafeInteger(d.start) || d.start < 0 || (d.end !== null && (!Number.isSafeInteger(d.end) || d.end < d.start))) throw new Error('Unresolved MRR discount dates')
    if (d.start > seconds || (d.end !== null && d.end <= seconds)) continue
    if (!['forever', 'repeating', 'once'].includes(d.coupon.duration)) throw new Error('Unresolved MRR coupon duration')
    if (d.coupon.duration === 'repeating' && !policy.subtractRecurringDiscounts) continue
    if (d.coupon.duration === 'once' && !policy.subtractOneTimeDiscounts) continue
    // 永続割引は設定にかかわらず控除する（StripeのMRR定義）。
    unique.set(d.id, d)
  }
  return [...unique.values()]
}
function applyDiscounts(lines: Line[], discounts: Discount[]): void {
  for (const d of discounts) {
    const products = d.coupon.applies_to?.products
    if (products !== undefined && (!Array.isArray(products) || products.some(id => typeof id !== 'string' || !id))) throw new Error('Unresolved MRR coupon products')
    const eligible = lines.filter(line => !products || products.includes(line.productId))
    if (!eligible.length) continue
    const subtotal = eligible.reduce((sum, line) => finiteMoney(sum + line.amount), 0)
    const percent = d.coupon.percent_off
    const amount = d.coupon.amount_off
    if ((percent === null) === (amount === null)) throw new Error('Unresolved MRR coupon amount')
    if (percent !== null) {
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Unresolved MRR coupon percent')
      for (const line of eligible) line.amount = finiteMoney(line.amount * (1 - percent / 100))
    } else {
      const yenAmount = d.coupon.currency === 'jpy' ? amount! : d.coupon.currency_options?.jpy?.amount_off
      if (yenAmount === undefined) throw new Error('Unresolved MRR coupon currency')
      finiteMoney(yenAmount)
      if (new Set(eligible.map(line => line.months)).size > 1) throw new Error('Unresolved MRR mixed-cycle fixed discount')
      if (!subtotal) continue
      const deduction = Math.min(yenAmount, subtotal)
      for (const line of eligible) line.amount = finiteMoney(line.amount - deduction * line.amount / subtotal)
    }
  }
}

/** 円建ての有効な契約を月額へ換算。全明細・数量・段階別価格・割引・手動の内税に対応。DB/Stripe通信なし。 */
export function calculateContractMrr(contracts: MrrContract[], at: Date, policy: MrrDiscountPolicy, tiersByPrice = new Map<string, MrrTier[]>()) {
  if (!Number.isFinite(at.getTime()) || typeof policy?.subtractRecurringDiscounts !== 'boolean' || typeof policy?.subtractOneTimeDiscounts !== 'boolean') throw new Error('Invalid MRR calculation context')
  const seconds = Math.floor(at.getTime() / 1000)
  let mrr = 0
  let contributingContracts = 0
  let excludedMeteredItems = 0
  const activeCustomerIds = new Set<string>()
  let unknownCustomer = false
  for (const contract of contracts) {
    if (contract.status !== 'active' && contract.status !== 'past_due') continue
    if (contract.items.has_more !== false) throw new Error('Unresolved MRR item pagination')
    if (!contract.items.data.length) throw new Error('Unresolved MRR empty items')
    const lines: Line[] = []
    for (const item of contract.items.data) {
      const p = item.price
      if (p.recurring?.usage_type === 'metered') { excludedMeteredItems++; continue }
      if (p.recurring?.usage_type != null && p.recurring.usage_type !== 'licensed') throw new Error('Unresolved MRR usage type')
      if (typeof contract.automatic_tax?.enabled !== 'boolean') throw new Error('Unresolved MRR tax mode')
      if (contract.automatic_tax?.enabled) throw new Error('Unresolved MRR automatic tax')
      if (p.currency !== 'jpy') throw new Error('Unresolved MRR currency')
      if (p.billing_scheme !== undefined && !['per_unit', 'tiered'].includes(String(p.billing_scheme))) throw new Error('Unresolved MRR billing scheme')
      const rec = p.recurring
      if (!rec || !['month', 'year'].includes(String(rec.interval)) || !Number.isSafeInteger(rec.interval_count) || rec.interval_count! <= 0) throw new Error('Unresolved MRR interval')
      let quantity = item.quantity ?? 1
      if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Unresolved MRR quantity')
      if (p.transform_quantity) {
        const t = p.transform_quantity
        if (!Number.isSafeInteger(t.divide_by) || t.divide_by <= 0 || !['up', 'down'].includes(t.round) || p.billing_scheme === 'tiered') throw new Error('Unresolved MRR transformed quantity')
        quantity = t.round === 'up' ? Math.ceil(quantity / t.divide_by) : Math.floor(quantity / t.divide_by)
      }
      const price: PriceLike = p.billing_scheme === 'tiered'
        ? { ...p, tiers: normalizedTiers(p.tiers ?? tiersByPrice.get(p.id) ?? []) }
        : { ...p, unit_amount: decimalAmount(p.unit_amount, p.unit_amount_decimal) }
      if (p.billing_scheme === 'tiered' && !['graduated', 'volume'].includes(String(p.tiers_mode))) throw new Error('Unresolved MRR tier mode')
      const calculated = itemAmount({ price, quantity })
      if (!calculated.known) throw new Error('Unresolved MRR price')
      if (p.billing_scheme === 'tiered') {
        const final = price.tiers![price.tiers!.length - 1]
        if (final.up_to !== null && quantity > final.up_to) throw new Error('Unresolved MRR tier coverage')
      }
      if (item.tax_rates != null && !Array.isArray(item.tax_rates)) throw new Error('Unresolved MRR item tax rates')
      const taxRates = item.tax_rates?.length ? item.tax_rates : contract.default_tax_rates ?? []
      let inclusivePercent = 0
      for (const tax of taxRates) {
        if (typeof tax.inclusive !== 'boolean' || !Number.isFinite(tax.percentage) || tax.percentage < 0 || tax.percentage > 100) throw new Error('Unresolved MRR tax')
        if (tax.inclusive) inclusivePercent += tax.percentage
      }
      const productId = typeof p.product === 'string' ? p.product : p.product?.id
      if (typeof productId !== 'string' || !productId) throw new Error('Unresolved MRR product')
      const months = rec.interval_count! * (rec.interval === 'year' ? 12 : 1)
      if (!Number.isSafeInteger(months)) throw new Error('Unresolved MRR interval size')
      const line = { amount: finiteMoney(calculated.amount), months, productId, inclusiveFactor: 1 + inclusivePercent / 100 }
      applyDiscounts([line], activeDiscounts(item.discounts ?? [], seconds, policy))
      lines.push(line)
    }
    if (!lines.length) continue
    let discounts = [...(contract.discounts ?? []), ...(contract.discount ? [contract.discount] : [])]
    if (!discounts.length) {
      if (typeof contract.customer === 'string' || contract.customer.deleted || !Object.hasOwn(contract.customer, 'discount')) throw new Error('Unresolved MRR customer discount')
      if (contract.customer.discount) discounts = [contract.customer.discount]
    }
    applyDiscounts(lines, activeDiscounts(discounts, seconds, policy))
    const monthly = lines.reduce((sum, line) => finiteMoney(sum + line.amount / line.inclusiveFactor / line.months), 0)
    if (monthly > 0) {
      contributingContracts++
      const customerId = typeof contract.customer === 'string' ? contract.customer : contract.customer.id
      if (typeof customerId === 'string' && customerId.length > 0 && customerId.trim() === customerId) activeCustomerIds.add(customerId)
      else unknownCustomer = true
    }
    mrr = finiteMoney(mrr + monthly)
  }
  const activeCustomers = unknownCustomer ? null : activeCustomerIds.size
  return { mrr, currency: 'jpy' as const, contributingContracts, activeCustomers, arpu: activeCustomers === null ? null : activeCustomers > 0 ? mrr / activeCustomers : 0, excludedMeteredItems, discountPolicy: { ...policy } }
}
