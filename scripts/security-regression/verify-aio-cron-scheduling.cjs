const assert = require('node:assert/strict')
const fs = require('node:fs')
const { load, check } = require('./load-typescript.cjs')

const schedule = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).crons.find(job => job.path === '/api/cron/aio-scan')?.schedule
assert.equal(schedule, '0 3,9,15,21 * * *')

const now = Date.now()
const ago = days => new Date(now - days * 86400000)
const organization = (id, scan) => ({ id, slug: id, members: [{ userId: `owner-${id}` }], scans: scan ? [scan] : [] })
const done = days => ({ status: 'done', createdAt: ago(days), updatedAt: ago(days) })
const failed = days => ({ status: 'failed', createdAt: ago(days), updatedAt: ago(days) })
const json = (body, options) => ({ body, status: options?.status || 200 })
const request = token => ({ headers: { get: () => token } })

function fixture(orgs, { usage = {}, preflight = [] } = {}) {
  const calls = []
  let dbReads = 0
  const prisma = {
    aioOrganization: { findMany: async () => { dbReads++; return orgs } },
    user: { findMany: async () => orgs.map(org => ({ id: org.members[0]?.userId, plan: 'PRO' })) },
    aioScan: {
      findMany: async () => orgs.filter(org => org.scans.some(scan => scan.status === 'done' && scan.createdAt > ago(7)))
        .map(org => ({ organizationId: org.id })),
      groupBy: async ({ where }) => {
        assert.equal(where.OR[0].status.in.join(','), 'done,deleted')
        assert.equal(where.OR[1].status, 'processing')
        assert(where.OR[1].updatedAt.gte instanceof Date)
        return Object.entries(usage).map(([organizationId, count]) => ({ organizationId, _count: { _all: count } }))
      },
    },
  }
  const route = load('src/app/api/cron/aio-scan/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/prisma': { prisma },
    '@/lib/aio/run': { runAndPersistScan: async id => {
      calls.push(id)
      if (preflight.includes(id)) return { id: '', status: 'failed', code: 'PROMPT_LIMIT' }
      const org = orgs.find(row => row.id === id)
      org.scans.unshift({ status: 'done', createdAt: new Date(), updatedAt: new Date() })
      return { id: `scan-${id}`, status: 'done' }
    } },
    '@/lib/unified-plan': { isPaidPlan: plan => plan === 'PRO' },
    '@/lib/aio/quota': { scanQuota: () => ({ since: ago(30), limit: 30 }) },
    '@/lib/aio/types': { SCAN_STALE_MS: 600000 },
  }, { process: { env: { CRON_SECRET: 'secret' } } })
  return { route, calls, get dbReads() { return dbReads } }
}

;(async () => {
  await check('AIO cron requires authorization before reading organizations', async () => {
    const f = fixture([organization('a')])
    assert.equal((await f.route.GET(request(null))).status, 401)
    assert.equal(f.dbReads, 0)
  })

  await check('four daily slots rotate through eight paid organizations without repeat scans', async () => {
    const f = fixture(Array.from({ length: 8 }, (_, index) => organization(`org-${index}`)))
    for (let i = 0; i < 8; i++) {
      const response = await f.route.GET(request('Bearer secret'))
      assert.equal(response.body.processed, 1)
      assert.equal(response.body.deferred, 7 - i)
    }
    assert.equal(new Set(f.calls).size, 8)
    const idle = await f.route.GET(request('Bearer secret'))
    assert.equal(idle.body.processed, 0)
    assert.equal(idle.body.due, 0)
  })

  await check('recent success, recent failure and exhausted quota do not block due organizations', async () => {
    const f = fixture([
      organization('quota', done(9)),
      organization('recent', done(2)),
      organization('retry', failed(0.1)),
      organization('due', done(8)),
    ], { usage: { quota: 30 } })
    const response = await f.route.GET(request('Bearer secret'))
    assert.deepEqual(f.calls, ['due'])
    assert.equal(response.body.due, 1)
    assert.equal(response.body.processed, 1)
  })

  await check('a preflight rejection does not consume the only scan slot', async () => {
    const f = fixture([organization('invalid'), organization('valid')], { preflight: ['invalid'] })
    const response = await f.route.GET(request('Bearer secret'))
    assert.deepEqual(f.calls, ['invalid', 'valid'])
    assert.equal(response.body.processed, 1)
    assert.equal(response.body.skippedPreflight, 1)
    assert.equal(response.body.deferred, 0)
  })

  await check('ambiguous billing owners and active scans are skipped while stale scans can retry', async () => {
    const ambiguous = organization('ambiguous')
    ambiguous.members.push({ userId: 'second-owner' })
    const f = fixture([
      ambiguous,
      organization('active', { status: 'processing', createdAt: ago(0.01), updatedAt: ago(0.001) }),
      organization('stale', { status: 'processing', createdAt: ago(1), updatedAt: ago(1) }),
    ])
    const response = await f.route.GET(request('Bearer secret'))
    assert.deepEqual(f.calls, ['stale'])
    assert.equal(response.body.paidCandidates, 2)
    assert.equal(response.body.due, 1)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
