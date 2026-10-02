const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ now, monthlyFails = false, weeklyFails = false, deliveryFailsOnce = false } = {}) {
  const posts = []
  const delivered = new Set()
  const reportKeys = []
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
    '@/lib/billing-report-delivery': { deliverBillingReport: async (key, message) => {
      reportKeys.push(key)
      if (delivered.has(key)) return 'already_sent'
      if (deliveryFailsOnce && key.endsWith(':monthly')) { deliveryFailsOnce = false; throw Error('private Slack failure') }
      posts.push(message)
      delivered.add(key)
      return 'sent'
    } },
    '@/lib/alert': { notifyAlert: async (details) => { alerts.push(details) } },
  }, { Date: FixedDate, process: { env: { CRON_SECRET: 'secret' } } })
  const request = (suffix = '') => ({
    url: `https://example.invalid/api/cron/billing-audit${suffix}`,
    headers: { get: (name) => name === 'authorization' ? 'Bearer secret' : null },
  })
  return { route, request, posts, alerts, calls, reportKeys }
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
    assert(!JSON.stringify(f.alerts).includes('private monthly failure'))
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
    assert.equal((await f.route.GET(f.request())).status, 200)
    assert.deepEqual(f.posts, ['audit:昨日', 'monthly report'])
    assert.deepEqual(f.reportKeys, [
      '2026-10-01:daily', '2026-10-01:monthly', '2026-10-01:daily', '2026-10-01:monthly',
    ])
  })
  await check('retry after monthly delivery failure skips the delivered daily report', async () => {
    const f = fixture({ deliveryFailsOnce: true })
    assert.equal((await f.route.GET(f.request())).status, 500)
    assert.deepEqual(f.posts, ['audit:昨日'])
    assert.equal((await f.route.GET(f.request())).status, 200)
    assert.deepEqual(f.posts, ['audit:昨日', 'monthly report'])
  })
  await check('explicit monthly resend preserves manual behavior without repeating the daily report', async () => {
    const f = fixture()
    await f.route.GET(f.request())
    assert.equal((await f.route.GET(f.request('?monthly=1'))).status, 200)
    assert.deepEqual(f.posts, ['audit:昨日', 'monthly report', 'monthly report'])
  })
  await check('invalid manual windows do not become scheduled sends', async () => {
    for (const value of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '87601']) {
      const f = fixture()
      const response = await f.route.GET(f.request(`?window=${value}`))
      assert.equal(response.status, 400)
      assert.deepEqual(f.calls, [])
      assert.deepEqual(f.posts, [])
      assert.deepEqual(f.reportKeys, [])
    }
  })
  await check('valid manual window still sends a manual report', async () => {
    const f = fixture()
    const response = await f.route.GET(f.request('?window=168'))
    assert.equal(response.status, 200)
    assert.deepEqual(f.calls, ['audit:168'])
    assert.deepEqual(f.posts, ['audit:直近168時間'])
    assert.deepEqual(f.reportKeys, [])
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
