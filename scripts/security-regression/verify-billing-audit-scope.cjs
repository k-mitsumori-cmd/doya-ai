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
function fixture({ subs, invoices, subList, invoiceList }) {
  let subscriptionCalls = 0, invoiceCalls = 0
  const stripe = { subscriptions: { list: async (q) => { subscriptionCalls++; return subList ? subList(q) : page(subs, q) } },
    invoices: { list: async (q) => { invoiceCalls++; return invoiceList ? invoiceList(q) : page(invoices, q) } } }
  const module = load('src/lib/billing-audit.ts', {
    '@/lib/stripe': { stripe, ACTIVE_LIKE_STATUSES: new Set(['active','trialing','past_due']),
      isDoyaSubscription: (sub) => sub.metadata.app === 'doya-ai', ALL_SERVICE_IDS: [],
      resolvePlanIdFromSubscription: () => ({ planId: 'banner-pro' }), planTierFromPlanId: () => 'PRO' },
    '@/lib/prisma': { prisma: {} }, '@/lib/billing-manual-grants': { getManualGrantEmails: async () => new Set() },
  })
  return { module, get subscriptionCalls() { return subscriptionCalls }, get invoiceCalls() { return invoiceCalls } }
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
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
