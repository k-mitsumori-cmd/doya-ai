const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load, check, results } = require('./load-typescript.cjs')

const json = (body, options) => ({ body, status: options?.status || 200 })
const request = (path, token = 'Bearer secret') => ({
  url: `https://example.invalid/api/cron/${path}`,
  headers: { get: (name) => name === 'authorization' ? token : null },
})

function feedbackFixture({ fail = false } = {}) {
  const calls = []
  const posts = []
  const alerts = []
  const recent = Array.from({ length: 5 }, (_, i) => ({
    createdAt: new Date('2026-09-30T00:00:00Z'), serviceId: 'banner', text: `feedback ${i}`,
  }))
  const serviceFeedback = {
    count: async (args) => {
      calls.push(['count', args])
      if (fail) throw Error('private database detail')
      return args ? 1200 : 1800
    },
    groupBy: async (args) => {
      calls.push(['groupBy', args])
      return [{ serviceId: 'banner', _count: { _all: 800 } }, { serviceId: 'seo', _count: { _all: 400 } }]
    },
    findMany: async (args) => { calls.push(['findMany', args]); return recent },
    findFirst: async (args) => { calls.push(['findFirst', args]); return { createdAt: recent[0].createdAt } },
  }
  const route = load('src/app/api/cron/feedback-report/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/prisma': { prisma: { serviceFeedback } },
    '@/lib/notifications': { postPlainToSlack: async (message) => { posts.push(message) } },
    '@/lib/alert': { notifyAlert: async (details) => { alerts.push(details) } },
    '@/lib/attribution': { serviceLabelOf: (id) => id },
  }, { process: { env: { CRON_SECRET: 'secret' } } })
  return { route, calls, posts, alerts }
}

;(async () => {
  await check('feedback report aggregates counts in DB and reads only five texts', async () => {
    const f = feedbackFixture()
    const response = await f.route.GET(request('feedback-report?days=30'))
    assert.equal(response.status, 200)
    assert.equal(response.body.received, 1200)
    assert.equal(response.body.total, 1800)
    assert.equal(f.calls.find(([name]) => name === 'findMany')[1].take, 5)
    assert.deepEqual(Array.from(f.calls.find(([name]) => name === 'groupBy')[1].by), ['serviceId'])
    assert.equal(f.posts.length, 1)
    assert.match(f.posts[0], /受信件数: 1200件/)
    assert.match(f.posts[0], /banner: 800件/)
    assert.match(f.posts[0], /seo: 400件/)
    assert.equal((f.posts[0].match(/feedback \d/g) || []).length, 5)
  })
  await check('feedback report rejects invalid periods before reading or posting', async () => {
    for (const days of ['0', '-1', '1.5', 'NaN', '3651']) {
      const f = feedbackFixture()
      const response = await f.route.GET(request(`feedback-report?days=${days}`))
      assert.equal(response.status, 400)
      assert.equal(f.calls.length, 0)
      assert.equal(f.posts.length, 0)
    }
  })
  await check('feedback report keeps private DB errors out of the response', async () => {
    const f = feedbackFixture({ fail: true })
    const response = await f.route.GET(request('feedback-report'))
    assert.equal(response.status, 500)
    assert(!JSON.stringify(response.body).includes('private database detail'))
    assert.equal(f.alerts.length, 1)
    assert.equal(f.posts.length, 0)
  })
  await check('feedback report requires cron authorization before DB access', async () => {
    const f = feedbackFixture()
    assert.equal((await f.route.GET(request('feedback-report', null))).status, 401)
    assert.equal(f.calls.length, 0)
  })
  await check('spend report keeps notification failures out of the response', async () => {
    const alerts = []
    const route = load('src/app/api/cron/spend-report/route.ts', {
      'next/server': { NextResponse: { json } },
      '@/lib/spend-report': { sendSpendReport: async () => { throw Error('private spend detail') } },
      '@/lib/notifications': { sendErrorNotification: async (details) => { alerts.push(details) } },
    }, { process: { env: { CRON_SECRET: 'secret' } } })
    const response = await route.GET(request('spend-report'))
    assert.equal(response.status, 500)
    assert(!JSON.stringify(response.body).includes('private spend detail'))
    assert.equal(alerts.length, 1)
  })
  await check('AIO scan hides per-organization and top-level private errors', async () => {
    const organization = { id: 'org-1', slug: 'brand', members: [{ userId: 'user-1' }], scans: [] }
    let scanThrows = false
    const prisma = {
      aioOrganization: { findMany: async () => [organization] },
      user: { findMany: async () => [{ id: 'user-1', plan: 'PRO' }] },
      aioScan: { findMany: async () => [], groupBy: async () => [] },
    }
    const route = load('src/app/api/cron/aio-scan/route.ts', {
      'next/server': { NextResponse: { json } },
      '@/lib/prisma': { prisma },
      '@/lib/aio/run': { runAndPersistScan: async () => {
        if (scanThrows) throw Error('private provider detail')
        return { id: 'scan-1', status: 'failed', error: 'private model detail' }
      } },
      '@/lib/unified-plan': { isPaidPlan: () => true },
      '@/lib/aio/quota': { scanQuota: () => ({ since: new Date(0), limit: 30 }) },
      '@/lib/aio/types': { SCAN_STALE_MS: 600000 },
    }, { process: { env: { CRON_SECRET: 'secret' } } })
    const response = await route.GET(request('aio-scan'))
    assert.equal(response.status, 200)
    assert.equal(response.body.failed, 1)
    assert(!JSON.stringify(response.body).includes('private model detail'))
    scanThrows = true
    const thrown = await route.GET(request('aio-scan'))
    assert.equal(thrown.status, 200)
    assert(!JSON.stringify(thrown.body).includes('private provider detail'))
    prisma.aioOrganization.findMany = async () => { throw Error('private database detail') }
    const failure = await route.GET(request('aio-scan'))
    assert.equal(failure.status, 500)
    assert(!JSON.stringify(failure.body).includes('private database detail'))
  })
  await check('scheduled reports retain internal diagnostics without returning them', async () => {
    const alerts = []
    const route = load('src/app/api/cron/drip-report-evening/route.ts', {
      'next/server': { NextResponse: { json } },
      '@/lib/notifications': {
        sendDripReport: async () => { throw Error('private provider detail') },
        sendErrorNotification: async (details) => { alerts.push(details) },
      },
      '@/lib/prisma': { withRetry: async (fn) => fn() },
    }, { process: { env: { CRON_SECRET: 'secret' } } })
    const response = await route.GET(request('drip-report-evening'))
    assert.equal(response.status, 500)
    assert(!JSON.stringify(response.body).includes('private provider detail'))
    assert(!Object.hasOwn(response.body, 'stack'))
    assert.match(alerts[0].errorMessage, /private provider detail/)
  })
  await check('no cron route returns raw exception message or stack fields', async () => {
    const cronRoot = path.resolve(__dirname, '../../src/app/api/cron')
    const routeFiles = fs.readdirSync(cronRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(cronRoot, entry.name, 'route.ts'))
      .filter((file) => fs.existsSync(file))
    for (const file of routeFiles) {
      const source = fs.readFileSync(file, 'utf8')
      assert(!/\berror:\s*(?:error|err|e)(?:\?\.)?message\b/.test(source), file)
      assert(!/\bstack:\s*(?:error|err|e)(?:\?\.)?stack\b/.test(source), file)
    }
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
