import 'server-only'
import { stripe, isDoyaSubscription } from '@/lib/stripe'
import { runRevenueForRange, type BillingRevenueReader } from '@/lib/billing-audit'
import { readContractMrr } from '@/lib/admin-contract-mrr-reader'
import { adminBillingPeriodRange, type AdminBillingPeriod } from '@/lib/admin-billing-period'
import { isAdminBillingData, type AdminBillingData } from '@/lib/admin-billing-contract'

const cache = new Map<string, { value: AdminBillingData; expiresAt: number }>()
const inFlight = new Map<string, Promise<AdminBillingData>>()
const discountPolicy = { subtractRecurringDiscounts: true, subtractOneTimeDiscounts: false } as const

function boundedReader(deadline: number) {
  const options = (prior?: { timeout?: number }) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('Billing read deadline exceeded')
    return { timeout: Math.min(remaining, prior?.timeout ?? 10_000, 10_000), maxNetworkRetries: 0 }
  }
  const reader: BillingRevenueReader & Parameters<typeof readContractMrr>[0] = {
    subscriptions: { list: (params, prior) => stripe.subscriptions.list(params, { ...prior, ...options(prior) }) },
    subscriptionItems: { list: (params, prior) => stripe.subscriptionItems.list(params, { ...prior, ...options(prior) }) },
    invoices: { list: (params, prior) => stripe.invoices.list(params, { ...prior, ...options(prior) }) },
    refunds: { list: (params, prior) => stripe.refunds.list(params, { ...prior, ...options(prior) }) },
    prices: { retrieve: (id, params, prior) => stripe.prices.retrieve(id, params, { ...prior, ...options(prior) }) },
    charges: { retrieve: (id, params, prior) => stripe.charges.retrieve(id, params, { ...prior, ...options(prior) }) },
    paymentIntents: { retrieve: (id, params, prior) => stripe.paymentIntents.retrieve(id, params, { ...prior, ...options(prior) }) },
  }
  return reader
}

async function collect(period: AdminBillingPeriod, at: Date): Promise<AdminBillingData> {
  const range = adminBillingPeriodRange(period, at)
  const deadline = Date.now() + 25_000
  const reader = boundedReader(deadline)
  // 失敗した要求だけ先に返して、別の読取を残さない。いずれも更新APIは使用しない。
  const [cash, recurring] = await Promise.allSettled([
    runRevenueForRange(range, { reader, includeUpcoming: false }),
    readContractMrr(reader, isDoyaSubscription, at, discountPolicy),
  ])
  if (cash.status !== 'fulfilled' || recurring.status !== 'fulfilled' || Date.now() >= deadline) throw new Error('Billing data unavailable')
  const data: AdminBillingData = {
    version: 1, currency: 'jpy', timeZone: 'Asia/Tokyo',
    period, label: range.label, since: range.since.toISOString(), until: range.until.toISOString(), updatedAt: at.toISOString(),
    paidInvoiceCount: cash.value.paidCount, paidTotal: cash.value.paidTotal, refundTotal: cash.value.refundTotal,
    pendingRefundCount: cash.value.pendingRefundCount, pendingRefundTotal: cash.value.pendingRefundTotal, netRevenue: cash.value.netTotal,
    mrr: recurring.value.mrr, activeSubscriptions: recurring.value.eligibleDoyaContracts, mrrSubscriptions: recurring.value.contributingContracts,
    activeCustomers: recurring.value.activeCustomers, arpu: recurring.value.arpu, trialingSubscriptions: cash.value.trialingCount,
    discountPolicy: { ...discountPolicy },
  }
  if (!isAdminBillingData(data, period)) throw new Error('Billing result contract is invalid')
  Object.freeze(data.discountPolicy)
  return Object.freeze(data)
}

export function readAdminBillingData(period: AdminBillingPeriod, refresh = false): Promise<AdminBillingData> {
  const at = new Date()
  const range = adminBillingPeriodRange(period, at)
  const key = `${period}:${range.since.toISOString()}`
  const now = at.getTime()
  for (const [name, entry] of cache) if (entry.expiresAt <= now) cache.delete(name)
  if (refresh) cache.delete(key)
  const active = inFlight.get(key)
  if (active) return active
  const entry = cache.get(key)
  if (!refresh && entry && entry.expiresAt > now) return Promise.resolve(entry.value)
  const request = collect(period, at).then(value => {
    cache.set(key, { value, expiresAt: at.getTime() + 60_000 })
    return value
  }).finally(() => { if (inFlight.get(key) === request) inFlight.delete(key) })
  inFlight.set(key, request)
  return request
}
