const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture() {
  const rows = new Map()
  const calls = { watch: 0, reviews: 0, daily: 0, claims: 0, releases: 0 }
  let clockMs = Date.parse('2026-10-01T00:00:00Z')
  class FixedDate extends Date { static now() { return clockMs } }
  const route = load('src/app/api/cron/service-operations/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/service-operations-daily': {
      collectDailyOperations: async () => { calls.daily++; return 'daily' },
      weeklyOperations: async () => 'weekly',
      dailyOperationsSection: async () => 'travel',
    },
    '@/lib/service-operations-monitor': { monitorReportDelivery: async () => { calls.watch++; return 'watch' } },
    '@/lib/service-operations-reviews': { pollStoreReviews: async () => { calls.reviews++; return 'reviews' } },
    '@/lib/service-operations-cost': { monitorCost: async () => 'cost' },
    '@/lib/service-operations-state': {
      claimOps: async () => { calls.claims++; return true },
      releaseOps: async () => { calls.releases++ },
      writeOps: async (key, value) => { rows.set(key, value) },
      readOps: async (key) => rows.get(key) ?? null,
      sendOps: async () => true,
    },
    '@/lib/service-operations-data': { jstDay: () => '2026-10-01' },
  }, { Date: FixedDate, process: { env: { CRON_SECRET: 'secret' } } })
  const request = (mode, dry = false) => ({
    url: `https://example.invalid/api/cron/service-operations?mode=${mode}${dry ? '&dry=1' : ''}`,
    headers: { get: (name) => name === 'authorization' ? 'Bearer secret' : null },
  })
  return { route, rows, calls, request, advance: (ms) => { clockMs += ms }, currentSlot: () => String(Math.floor(clockMs / 900000)) }
}

;(async () => {
  await check('watch uses one rolling completion marker across 15-minute slots', async () => {
    const f = fixture()
    assert.equal((await f.route.GET(f.request('watch'))).status, 200)
    assert.equal((await f.route.GET(f.request('watch'))).body.skipped, true)
    assert.equal(f.calls.watch, 1)
    assert.equal(f.rows.get('done:job:watch').slot, f.currentSlot())
    f.advance(900000)
    assert.equal((await f.route.GET(f.request('watch'))).status, 200)
    assert.equal(f.calls.watch, 2)
    assert.equal(f.rows.get('done:job:watch').slot, f.currentSlot())
    assert.equal(f.rows.size, 1)
  })
  await check('old per-slot completion marker prevents a duplicate during migration', async () => {
    const f = fixture()
    f.rows.set(`done:job:watch:${f.currentSlot()}`, { at: 'old' })
    assert.equal((await f.route.GET(f.request('watch'))).body.skipped, true)
    assert.equal(f.calls.watch, 0)
    assert.equal(f.calls.claims, 0)
  })
  await check('review polling also uses one rolling marker', async () => {
    const f = fixture()
    await f.route.GET(f.request('reviews'))
    assert.equal((await f.route.GET(f.request('reviews'))).body.skipped, true)
    f.advance(14400000)
    await f.route.GET(f.request('reviews'))
    assert.equal(f.calls.reviews, 2)
    assert.equal(f.rows.size, 1)
    assert(f.rows.has('done:job:reviews'))
  })
  await check('daily completion marker and dry-run behavior remain unchanged', async () => {
    const f = fixture()
    await f.route.GET(f.request('daily', true))
    assert.equal(f.rows.size, 0)
    await f.route.GET(f.request('daily'))
    assert.equal((await f.route.GET(f.request('daily'))).body.skipped, true)
    assert.equal(f.calls.daily, 2)
    assert(f.rows.has('done:job:daily:2026-10-01'))
  })
  await check('invalid manual mode or dry-run values do not send or claim', async () => {
    const f = fixture()
    for (const query of ['mode=', 'mode=unknown', 'mode=watch&dry=yes', 'mode=watch&dry=']) {
      const response = await f.route.GET({
        url: `https://example.invalid/api/cron/service-operations?${query}`,
        headers: { get: (name) => name === 'authorization' ? 'Bearer secret' : null },
      })
      assert.equal(response.status, 400)
    }
    assert.equal(f.calls.watch, 0)
    assert.equal(f.calls.claims, 0)
    assert.equal(f.rows.size, 0)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
