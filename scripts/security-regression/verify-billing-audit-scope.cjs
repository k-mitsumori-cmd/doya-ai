const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const created = Math.floor(Date.parse('2026-09-15T00:00:00Z') / 1000)
const subscription = (id, app = 'another-app') => ({ id, status: 'active', created, ended_at: null,
  metadata: { app }, customer: { id: 'customer-'+id, email: id+'@example.invalid' },
  current_period_end: created + 30*86400, trial_end: null, cancel_at_period_end: false,
  items: { data: [{ price: { id: 'price_'+id, unit_amount: 9980, currency: 'jpy' } }] } })
const invoice = (id, subscriptionId, amount) => ({ id, subscription: subscriptionId, status: 'paid', amount_paid: amount,
  post_payment_credit_notes_amount: 0 })
function page(rows, query) {
  const index = query.starting_after ? rows.findIndex((row) => row.id === query.starting_after) : -1
  if (query.starting_after && index < 0) throw Error('unknown cursor')
  const start = index + 1
  const data = rows.slice(start, start+100)
  return { data, has_more: start+data.length < rows.length }
}
function fixture({ subs, invoices, subList, invoiceList, endpoints = [], webhookList }) {
  let subscriptionCalls = 0, invoiceCalls = 0, webhookCalls = 0
  const stripe = { subscriptions: { list: async (q) => { subscriptionCalls++; return subList ? subList(q) : page(subs, q) } },
    invoices: { list: async (q) => { invoiceCalls++; return invoiceList ? invoiceList(q) : page(invoices, q) } },
    webhookEndpoints: { list: async (q) => { webhookCalls++; return webhookList ? webhookList(q) : page(endpoints, q) } } }
  const module = load('src/lib/billing-audit.ts', {
    '@/lib/stripe': { stripe, ACTIVE_LIKE_STATUSES: new Set(['active','trialing','past_due']),
      isDoyaSubscription: (sub) => sub.metadata.app === 'doya-ai', ALL_SERVICE_IDS: [],
      resolvePlanIdFromSubscription: () => ({ planId: 'banner-pro' }), planTierFromPlanId: () => 'PRO' },
    '@/lib/prisma': { prisma: { user: { findMany: async () => [] } } },
    '@/lib/billing-manual-grants': { getManualGrantEmails: async () => new Set() },
  })
  return { module, get subscriptionCalls() { return subscriptionCalls }, get invoiceCalls() { return invoiceCalls }, get webhookCalls() { return webhookCalls } }
}

;(async () => {
  const now = new Date('2026-10-15T00:00:00Z')
  await check('monthly revenue reads page 21 and excludes shared-account apps and one-off invoices', async () => {
    const subs = Array.from({ length: 2000 }, (_, i) => subscription('foreign-'+i))
    subs.push(subscription('doya', 'doya-ai'))
    const invoices = Array.from({ length: 2000 }, (_, i) => invoice('foreign-invoice-'+i, 'foreign-'+i, 100000))
    invoices.push(invoice('doya-invoice', 'doya', 9980), invoice('one-off', null, 5000))
    const f = fixture({ subs, invoices })
    const report = await f.module.runMonthlyRevenue(now)
    assert.equal(report.paidCount, 1); assert.equal(report.paidTotal, 9980); assert.equal(report.netTotal, 9980)
    assert.equal(report.activeCount, 1); assert.equal(report.newSubscriptions, 1)
    assert.equal(f.subscriptionCalls, 21); assert.equal(f.invoiceCalls, 21)
    assert.equal(f.module.formatMonthlyRevenueMessage(report).includes('毎月 ¥9,980 の見込み'), false)
  })
  await check('monthly invoice repeated cursor fails instead of publishing partial totals', async () => {
    const f = fixture({ subs: [], invoices: [], invoiceList: async () => ({ data: [invoice('same', 'doya', 9980)], has_more: true }) })
    await assert.rejects(f.module.runMonthlyRevenue(now), /pagination did not advance/)
  })
  await check('subscription repeated cursor fails instead of publishing partial contract counts', async () => {
    const f = fixture({ subs: [], invoices: [], subList: async () => ({ data: [subscription('same', 'doya-ai')], has_more: true }) })
    await assert.rejects(f.module.runMonthlyRevenue(now), /pagination did not advance/)
  })
  await check('billing audit normalizes annual prices and flags unknown billing intervals', async () => {
    const monthly = subscription('monthly', 'doya-ai'); monthly.items.data[0].price.recurring = { interval: 'month', interval_count: 1 }
    const yearly = subscription('yearly', 'doya-ai'); yearly.items.data[0].price.unit_amount = 119760
    yearly.items.data[0].price.recurring = { interval: 'year', interval_count: 1 }
    const unknown = subscription('unknown', 'doya-ai'); unknown.items.data[0].price.recurring = { interval: 'week', interval_count: 1 }
    for (const sub of [monthly, yearly, unknown]) sub.created = Math.floor(Date.now()/1000) - 86400
    const f = fixture({ subs: [monthly, yearly, unknown], invoices: [] })
    const audit = await f.module.runBillingAudit(48)
    assert.equal(audit.mrr, 19960); assert.equal(audit.unknownBillingIntervals.length, 1)
    const message = f.module.formatBillingAuditMessage(audit, { windowLabel: '直近24時間' })
    assert(message.includes('¥119,760/年')); assert(message.includes('月次売上見込 ¥19,960'))
    assert(message.includes('請求周期を確認できない契約'))
  })
  await check('webhook endpoint check reaches page two', async () => {
    const endpoints = Array.from({ length: 100 }, (_, i) => ({ id: 'endpoint-'+i, url: 'https://other.example/'+i, status: 'enabled', enabled_events: [] }))
    endpoints.push({ id: 'target', url: 'https://doya-ai.surisuta.jp/api/stripe/webhook', status: 'enabled',
      enabled_events: ['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'] })
    const f = fixture({ subs: [], invoices: [], endpoints })
    assert.equal((await f.module.checkWebhookEndpoint()).ok, true); assert.equal(f.webhookCalls, 2)
  })
  await check('webhook endpoint repeating cursor reports failure', async () => {
    const f = fixture({ subs: [], invoices: [], webhookList: async () => ({ data: [{ id: 'same', url: 'https://other.example', status: 'enabled', enabled_events: [] }], has_more: true }) })
    const result = await f.module.checkWebhookEndpoint(); assert.equal(result.ok, false)
    assert(result.detail.includes('pagination did not advance'))
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
