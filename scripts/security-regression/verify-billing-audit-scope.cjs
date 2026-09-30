const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const created = Math.floor(Date.parse('2026-09-15T00:00:00Z') / 1000)
const subscription = (id, app = 'another-app') => ({ id, status: 'active', created, ended_at: null,
  metadata: { app }, customer: { id: 'customer-'+id, email: id+'@example.invalid' },
  current_period_end: created + 30*86400, trial_end: null, cancel_at_period_end: false,
  items: { data: [{ price: { id: 'price_'+id, unit_amount: 9980, currency: 'jpy' } }] } })
const invoice = (id, subscriptionId, amount) => ({ id, subscription: subscriptionId, status: 'paid', amount_paid: amount,
  created, currency: 'jpy', status_transitions: { paid_at: created }, post_payment_credit_notes_amount: 0 })
function page(rows, query) {
  const index = query.starting_after ? rows.findIndex((row) => row.id === query.starting_after) : -1
  if (query.starting_after && index < 0) throw Error('unknown cursor')
  const start = index + 1
  const data = rows.slice(start, start+100)
  return { data, has_more: start+data.length < rows.length }
}
function fixture({ subs, invoices, refunds = [], charges = {}, paymentIntents = {}, subList, invoiceList, refundList,
  endpoints = [], webhookList, users = [], serviceRows = [], manualGrants = [] }) {
  let subscriptionCalls = 0, invoiceCalls = 0, refundCalls = 0, webhookCalls = 0
  const invoiceQueries = []
  const refundQueries = []
  const stripe = { subscriptions: { list: async (q) => { subscriptionCalls++; return subList ? subList(q) : page(subs, q) } },
    invoices: { list: async (q) => { invoiceCalls++; invoiceQueries.push(q); return invoiceList ? invoiceList(q) : page(invoices, q) } },
    refunds: { list: async (q) => { refundCalls++; refundQueries.push(q); return refundList ? refundList(q) : page(refunds, q) } },
    charges: { retrieve: async (id) => charges[id] },
    paymentIntents: { retrieve: async (id) => paymentIntents[id] },
    webhookEndpoints: { list: async (q) => { webhookCalls++; return webhookList ? webhookList(q) : page(endpoints, q) } } }
  const module = load('src/lib/billing-audit.ts', {
    '@/lib/stripe': { stripe, ACTIVE_LIKE_STATUSES: new Set(['active','trialing','past_due']),
      isDoyaSubscription: (sub) => sub.metadata.app === 'doya-ai', ALL_SERVICE_IDS: ['banner'],
      resolvePlanIdFromSubscription: (sub) => ({ planId: Object.hasOwn(sub.metadata, 'planId') ? sub.metadata.planId : 'banner-pro' }),
      planTierFromPlanId: (id) => !id ? 'FREE' : id === 'bundle' ? 'BUNDLE' : id.endsWith('-light') ? 'LIGHT' : id.endsWith('-enterprise') ? 'ENTERPRISE' : 'PRO' },
    '@/lib/prisma': { prisma: {
      user: { findMany: async ({ where }) => {
        if (where.id) return users.filter((user) => where.id.in.includes(user.id))
        if (where.email) return users.filter((user) => where.email.in.includes(user.email.toLowerCase()))
        return users.filter((user) => !['FREE', 'GUEST'].includes(user.plan))
      } },
      userServiceSubscription: { findMany: async ({ where }) => serviceRows.filter((row) => where.userId.in.includes(row.userId)) },
    } },
    '@/lib/billing-manual-grants': { getManualGrantEmails: async () => new Set(manualGrants) },
  })
  return { module, invoiceQueries, refundQueries, get subscriptionCalls() { return subscriptionCalls },
    get invoiceCalls() { return invoiceCalls }, get refundCalls() { return refundCalls }, get webhookCalls() { return webhookCalls } }
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
    assert.equal(f.refundCalls, 1)
    assert.equal(f.invoiceQueries[0].status, 'paid')
    assert.equal(f.module.formatMonthlyRevenueMessage(report).includes('毎月 ¥9,980 の見込み'), false)
  })
  await check('monthly revenue uses paid date across invoice creation months and JST boundaries', async () => {
    const sepStart = Math.floor(Date.parse('2026-08-31T15:00:00Z') / 1000)
    const octStart = Math.floor(Date.parse('2026-09-30T15:00:00Z') / 1000)
    const late = invoice('late', 'doya', 3000); late.created = sepStart - 86400; late.status_transitions.paid_at = sepStart
    const onTime = invoice('on-time', 'doya', 4000); onTime.created = sepStart + 1; onTime.status_transitions.paid_at = octStart - 1
    const nextMonth = invoice('next-month', 'doya', 5000); nextMonth.created = sepStart + 2; nextMonth.status_transitions.paid_at = octStart
    const previousMonth = invoice('previous-month', 'doya', 6000); previousMonth.created = sepStart - 86401; previousMonth.status_transitions.paid_at = sepStart - 1
    const rows = [late, onTime, nextMonth, previousMonth]
    const f = fixture({ subs: [subscription('doya', 'doya-ai')], invoices: [],
      invoiceList: async (query) => ({ data: rows.filter((row) =>
        row.created < query.created.lt && (query.created.gte === undefined || row.created >= query.created.gte)), has_more: false }) })
    const report = await f.module.runMonthlyRevenue(now)
    assert.equal(report.paidCount, 2)
    assert.equal(report.paidTotal, 7000)
    assert.equal(report.netTotal, 7000)
    assert.equal(f.invoiceQueries[0].created.gte, undefined)
  })
  await check('paid Doya invoice without payment timestamp stops the monthly report', async () => {
    const missing = invoice('missing-paid-at', 'doya', 9980)
    missing.status_transitions.paid_at = null
    const f = fixture({ subs: [subscription('doya', 'doya-ai')], invoices: [missing] })
    await assert.rejects(f.module.runMonthlyRevenue(now), /payment timestamp/i)
  })
  await check('monthly revenue subtracts successful refunds in their own month, not invoice credit-note totals', async () => {
    const oldInvoice = invoice('old-invoice', 'doya', 5000)
    oldInvoice.created = Math.floor(Date.parse('2026-08-01T00:00:00Z') / 1000)
    oldInvoice.status_transitions.paid_at = oldInvoice.created + 30
    oldInvoice.post_payment_credit_notes_amount = 2000 // 残高クレジット等は現金返金ではない
    const currentInvoice = invoice('current-invoice', 'doya', 4000)
    const refunds = [
      { id: 'old-refund', amount: 1200, currency: 'jpy', status: 'succeeded', charge: { invoice: oldInvoice.id } },
      { id: 'pending-refund', amount: 500, currency: 'jpy', status: 'pending', charge: { invoice: currentInvoice.id } },
      { id: 'foreign-refund', amount: 3000, currency: 'jpy', status: 'succeeded', charge: { invoice: 'foreign-invoice' } },
      { id: 'non-invoice-refund', amount: 900, currency: 'jpy', status: 'succeeded', charge: { invoice: null } },
      { id: 'other-currency', amount: 200, currency: 'usd', status: 'succeeded', charge: { invoice: currentInvoice.id } },
    ]
    const f = fixture({ subs: [subscription('doya', 'doya-ai')], invoices: [oldInvoice, currentInvoice], refunds })
    const report = await f.module.runMonthlyRevenue(now)
    assert.equal(report.paidCount, 1)
    assert.equal(report.paidTotal, 4000)
    assert.equal(report.refundTotal, 1200)
    assert.equal(report.netTotal, 2800)
    assert.equal(report.pendingRefundCount, 1)
    assert.equal(report.pendingRefundTotal, 500)
    assert.equal(f.refundQueries[0].created.gte, Math.floor(Date.parse('2026-08-31T15:00:00Z') / 1000))
    assert.equal(f.refundQueries[0].created.lt, Math.floor(Date.parse('2026-09-30T15:00:00Z') / 1000))
    assert(f.module.formatMonthlyRevenueMessage(report).includes('処理中の返金 1件'))
  })
  await check('monthly refunds resolve invoice from a referenced charge or payment intent', async () => {
    const refunds = [
      { id: 'charge-refund', amount: 100, currency: 'jpy', status: 'succeeded', charge: 'ch_1', payment_intent: null },
      { id: 'intent-refund', amount: 200, currency: 'jpy', status: 'succeeded', charge: { invoice: null }, payment_intent: 'pi_1' },
    ]
    const f = fixture({ subs: [subscription('doya', 'doya-ai')], invoices: [invoice('doya-invoice', 'doya', 9980)], refunds,
      charges: { ch_1: { invoice: 'doya-invoice' } }, paymentIntents: { pi_1: { invoice: 'doya-invoice' } } })
    assert.equal((await f.module.runMonthlyRevenue(now)).refundTotal, 300)
  })
  await check('monthly refund repeated cursor fails instead of publishing partial totals', async () => {
    const f = fixture({ subs: [], invoices: [], refundList: async () => ({ data: [{ id: 'same', currency: 'usd' }], has_more: true }) })
    await assert.rejects(f.module.runMonthlyRevenue(now), /refund pagination did not advance/)
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
  await check('billing audit maps owner ID across changed customer email and split customers', async () => {
    const first = subscription('first', 'doya-ai')
    const second = subscription('second', 'doya-ai')
    first.metadata.userId = second.metadata.userId = 'user-1'
    first.customer.email = 'old@example.invalid'
    second.customer.email = 'second@example.invalid'
    const users = [{ id: 'user-1', email: 'current@example.invalid', name: 'Current', plan: 'PRO' }]
    const f = fixture({ subs: [first, second], invoices: [], users,
      serviceRows: [{ userId: 'user-1', serviceId: 'banner', plan: 'PRO' }] })
    const audit = await f.module.runBillingAudit()
    assert.equal(audit.mismatched.length, 0)
    assert.equal(audit.overGranted.length, 0)
    assert.equal(audit.serviceDrift.length, 0)
    assert.equal(audit.duplicates.length, 1)
    assert(audit.subscriptions.every((sub) => sub.userId === 'user-1' && sub.email === 'current@example.invalid'))
  })
  await check('billing audit does not attach a missing owner ID to a customer-email match', async () => {
    const wrong = subscription('wrong', 'doya-ai')
    wrong.metadata.userId = 'missing-user'
    wrong.customer.email = 'paid@example.invalid'
    const users = [{ id: 'user-2', email: 'paid@example.invalid', name: 'Unrelated', plan: 'PRO' }]
    const f = fixture({ subs: [wrong], invoices: [], users })
    const audit = await f.module.runBillingAudit()
    assert.equal(audit.subscriptions[0].declaredUserId, 'missing-user')
    assert.equal(audit.subscriptions[0].dbUserFound, false)
    assert.equal(audit.mismatched.length, 1)
    assert.equal(audit.overGranted.length, 1)
  })
  await check('billing audit retains customer-email fallback for legacy subscriptions', async () => {
    const legacy = subscription('legacy', 'doya-ai')
    legacy.customer.email = 'legacy@example.invalid'
    const users = [{ id: 'legacy-user', email: 'legacy@example.invalid', name: 'Legacy', plan: 'PRO' }]
    const f = fixture({ subs: [legacy], invoices: [], users,
      serviceRows: [{ userId: 'legacy-user', serviceId: 'banner', plan: 'PRO' }] })
    const audit = await f.module.runBillingAudit()
    assert.equal(audit.subscriptions[0].userId, 'legacy-user')
    assert.equal(audit.mismatched.length, 0)
    assert.equal(audit.overGranted.length, 0)
  })
  await check('billing audit detects paid tier drift in both directions', async () => {
    const under = subscription('under', 'doya-ai'); under.metadata.userId = 'under-user'
    const over = subscription('over', 'doya-ai'); over.metadata.userId = 'over-user'; over.metadata.planId = 'banner-light'
    const users = [
      { id: 'under-user', email: 'under@example.invalid', name: 'Under', plan: 'LIGHT' },
      { id: 'over-user', email: 'over@example.invalid', name: 'Over', plan: 'PRO' },
    ]
    const serviceRows = users.map((u) => ({ userId: u.id, serviceId: 'banner', plan: u.plan }))
    const audit = await fixture({ subs: [under, over], invoices: [], users, serviceRows }).module.runBillingAudit()
    assert.equal(audit.mismatched.length, 0)
    assert.equal(audit.serviceDrift.length, 0)
    assert.equal(audit.tierDrift.length, 2)
    assert.deepEqual(JSON.parse(JSON.stringify(audit.tierDrift.map((d) => [d.email, d.stripeTier, d.dbPlan]))), [
      ['under@example.invalid', 'PRO', 'LIGHT'], ['over@example.invalid', 'LIGHT', 'PRO'],
    ])
  })
  await check('billing audit compares highest active tier once and honors only higher manual grants', async () => {
    const light = subscription('light', 'doya-ai'); light.metadata.userId = 'same-user'; light.metadata.planId = 'banner-light'
    const pro = subscription('pro', 'doya-ai'); pro.metadata.userId = 'same-user'
    const manual = subscription('manual', 'doya-ai'); manual.metadata.userId = 'manual-user'; manual.metadata.planId = 'banner-light'
    const users = [
      { id: 'same-user', email: 'same@example.invalid', name: 'Same', plan: 'PRO' },
      { id: 'manual-user', email: 'manual@example.invalid', name: 'Manual', plan: 'ENTERPRISE' },
    ]
    const audit = await fixture({ subs: [light, pro, manual], invoices: [], users,
      serviceRows: users.map((u) => ({ userId: u.id, serviceId: 'banner', plan: u.plan })),
      manualGrants: ['manual@example.invalid'] }).module.runBillingAudit()
    assert.equal(audit.duplicates.length, 1)
    assert.equal(audit.tierDrift.length, 0)
  })
  await check('manual-grant list never hides a FREE account or a paid tier above its grant', async () => {
    const free = subscription('free', 'doya-ai'); free.metadata.userId = 'free-user'
    const under = subscription('under-manual', 'doya-ai'); under.metadata.userId = 'under-manual-user'
    const users = [
      { id: 'free-user', email: 'free@example.invalid', name: 'Free', plan: 'FREE' },
      { id: 'under-manual-user', email: 'under-manual@example.invalid', name: 'Under', plan: 'LIGHT' },
    ]
    const audit = await fixture({ subs: [free, under], invoices: [], users,
      manualGrants: users.map((u) => u.email),
      serviceRows: [{ userId: 'under-manual-user', serviceId: 'banner', plan: 'LIGHT' }] }).module.runBillingAudit()
    assert.equal(audit.mismatched.length, 1)
    assert.equal(audit.mismatched[0].email, 'free@example.invalid')
    assert.equal(audit.tierDrift.length, 1)
    assert.equal(audit.tierDrift[0].email, 'under-manual@example.invalid')
  })
  await check('a marked Doya contract with an unmapped price cannot pass as healthy', async () => {
    const unknown = subscription('unmapped', 'doya-ai')
    unknown.metadata.userId = 'known-user'; unknown.metadata.planId = ''
    const users = [{ id: 'known-user', email: 'known@example.invalid', name: 'Known', plan: 'PRO' }]
    const audit = await fixture({ subs: [unknown], invoices: [], users,
      serviceRows: [{ userId: 'known-user', serviceId: 'banner', plan: 'PRO' }] }).module.runBillingAudit()
    assert.equal(audit.unmappedPlans.length, 1)
    assert.equal(audit.unmappedPlans[0].id, 'unmapped')
    assert(fixture({ subs: [], invoices: [] }).module.formatBillingAuditMessage(audit, { windowLabel: '24時間' }).includes('プランを特定できない契約'))
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
