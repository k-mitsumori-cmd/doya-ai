import type Stripe from 'stripe'
import { calculateContractMrr, type MrrDiscountPolicy } from './admin-contract-mrr'
import { tieredPriceIdsMissingTiers, type TierLike } from '@/lib/pricing-v2/amount'

type ReadonlyMrrApi = {
  subscriptions: { list: (params: Stripe.SubscriptionListParams, options?: Stripe.RequestOptions) => Promise<Stripe.ApiList<Stripe.Subscription>> }
  subscriptionItems: { list: (params: Stripe.SubscriptionItemListParams, options?: Stripe.RequestOptions) => Promise<Stripe.ApiList<Stripe.SubscriptionItem>> }
  prices: { retrieve: (id: string, params?: Stripe.PriceRetrieveParams, options?: Stripe.RequestOptions) => Promise<Stripe.Price> }
}

async function allPages<T extends { id: string }>(read: (cursor?: string) => Promise<{ data: T[]; has_more: boolean }>) {
  const rows: T[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  while (true) {
    const page = await read(cursor)
    if (!Array.isArray(page.data) || typeof page.has_more !== 'boolean') throw new Error('Unresolved MRR page')
    for (const row of page.data) {
      if (!row.id || seen.has(row.id)) throw new Error('Unresolved MRR duplicate record')
      seen.add(row.id)
      rows.push(row)
    }
    if (!page.has_more) return rows
    const next = page.data[page.data.length - 1]?.id
    if (!next || next === cursor) throw new Error('Unresolved MRR pagination')
    cursor = next
  }
}

/** 読取APIのみを受け取り、全契約・必要な全明細・段階表を取得する。秘密や顧客情報は返さない。 */
export async function readContractMrr(api: ReadonlyMrrApi, isDoya: (sub: Stripe.Subscription) => boolean, at: Date, policy: MrrDiscountPolicy) {
  calculateContractMrr([], at, policy)
  const deadline = Date.now() + 25_000
  const options = () => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('MRR read deadline exceeded')
    return { timeout: Math.min(remaining, 10_000), maxNetworkRetries: 0 }
  }
  const catalog = await allPages(cursor => api.subscriptions.list({
    status: 'all', limit: 100,
    expand: ['data.customer', 'data.discounts', 'data.items.data.discounts'],
    ...(cursor ? { starting_after: cursor } : {}),
  }, options()))
  const contracts = catalog.filter(sub => isDoya(sub) && (sub.status === 'active' || sub.status === 'past_due'))
    .map(sub => ({ ...sub, items: { ...sub.items } }))
  const tiersByPrice = new Map<string, TierLike[]>()
  for (const sub of contracts) {
    if (sub.items.has_more) {
      const items = await allPages(cursor => api.subscriptionItems.list({
        subscription: sub.id, limit: 100, expand: ['data.discounts'],
        ...(cursor ? { starting_after: cursor } : {}),
      }, options()))
      sub.items = { ...sub.items, data: items, has_more: false }
    }
    for (const id of tieredPriceIdsMissingTiers(sub.items.data)) {
      if (tiersByPrice.has(id)) continue
      const price = await api.prices.retrieve(id, { expand: ['tiers'] }, options())
      if (price.id !== id || !Array.isArray(price.tiers) || !price.tiers.length) throw new Error('Unresolved MRR price tiers')
      tiersByPrice.set(id, price.tiers)
    }
  }
  if (Date.now() >= deadline) throw new Error('MRR read deadline exceeded')
  const result = calculateContractMrr(contracts, at, policy, tiersByPrice)
  return { ...result, observedAt: at.toISOString(), source: 'stripe' as const, catalogContracts: catalog.length, eligibleDoyaContracts: contracts.length }
}
