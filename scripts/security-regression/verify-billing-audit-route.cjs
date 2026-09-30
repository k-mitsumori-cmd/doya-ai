const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ now, monthlyFails = false, weeklyFails = false } = {}) {
  const posts = []
  const alerts = []
  const calls = []
  const timestamp = Date.parse(now || '2026-10-01T00:00:00Z')
  class FixedDate extends Date { static now() { return timestamp } }
  const audit = { webhookOk: true, subscriptions: [], newInWindow: [], mismatched: [], tierDrift: [],
    unmappedPlans: [], serviceDrift: [], overGranted: [], duplicates: [] }
  const route = load('src/app/api/cron/billing-audit/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/billing-audit': {
      runBillingAudit: async (hours) => { calls.push(`audit:${hours}`); if (weeklyFails && hours === 168) throw Error('private weekly failure'); return audit },
      formatBillingAuditMessage: (_audit, { windowLabel }) => `audit:${windowLabel}`,
      runMonthlyRevenue: async () => { calls.push('monthly'); if (monthlyFails) throw Error('private monthly failure'); return {} },
      formatMonthlyRevenueMessage: () => 'monthly report',
    },
    '@/lib/notifications': { postPlainToSlack: async (message) => { posts.push(message) } },
    '@/lib/alert': { notifyAlert: async (details) => { alerts.push(details) } },
  }, { Date: FixedDate, process: { env: { CRON_SECRET: 'secret' } } })
  const request = (suffix = '') => ({
    url: `https://example.invalid/api/cron/billing-audit${suffix}`,
    headers: { get: (name) => name === 'authorization' ? 'Bearer secret' : null },
  })
  return { route, request, posts, alerts, calls }
}

;(async () => {
  await check('monthly calculation failure sends no partial daily report and keeps the response private', async () => {
    const f = fixture({ monthlyFails: true })
    const response = await f.route.GET(f.request())
    assert.equal(response.status, 500)
    assert.deepEqual(f.posts, [])
    assert.deepEqual(f.calls, ['audit:24', 'monthly'])
    assert.equal(f.alerts.length, 1)
    assert(!JSON.stringify(response.body).includes('private monthly failure'))
  })
  await check('weekly calculation failure sends no partial daily report', async () => {
    const f = fixture({ now: '2026-10-05T00:00:00Z', weeklyFails: true })
    assert.equal((await f.route.GET(f.request())).status, 500)
    assert.deepEqual(f.posts, [])
    assert.deepEqual(f.calls, ['audit:24', 'audit:168'])
  })
  await check('successful first-of-month report sends daily then monthly once', async () => {
    const f = fixture()
    assert.equal((await f.route.GET(f.request())).status, 200)
    assert.deepEqual(f.posts, ['audit:昨日', 'monthly report'])
  })
  await check('unauthorized cron exits before any reads or posts', async () => {
    const f = fixture()
    const request = f.request()
    request.headers.get = () => null
    assert.equal((await f.route.GET(request)).status, 401)
    assert.deepEqual(f.calls, [])
    assert.deepEqual(f.posts, [])
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
