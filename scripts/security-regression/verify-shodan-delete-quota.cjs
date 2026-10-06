const assert = require('node:assert/strict')
const fs = require('node:fs')
const { load, check } = require('./load-typescript.cjs')

const json = (body, options = {}) => ({ body, status: options.status || 200 })
const nullToken = Symbol('DbNull')

function fixture(status, leaseValue = null, updatedAt = new Date()) {
  let row = { id: 'prep-1', organizationId: 'org-1', status, updatedAt,
    targetUrl: 'https://example.test', research: { private: 'source' },
    slidesJson: [{ title: 'Proposal' }], slideImages: [{ imagePath: 'private' }] }
  let deleted = false
  let orgLocks = 0
  let leaseLocks = 0
  const tx = {
    $queryRaw: async () => { orgLocks++; return row ? [{ id: row.id }] : [] },
    $executeRaw: async () => { leaseLocks++; return 1 },
    systemSetting: { findUnique: async () => leaseValue ? { value: leaseValue } : null },
    shodanPreparation: {
      findFirst: async () => row,
      update: async ({ data }) => { Object.assign(row, data); return row },
      delete: async () => { deleted = true; row = null },
    },
  }
  const prisma = { $transaction: async (fn) => fn(tx) }
  const route = load('src/app/api/shodan/preparations/[id]/route.ts', {
      ...require('./shodan-editor-test-helpers.cjs'),
    'next/server': { NextResponse: { json } },
    '@prisma/client': { Prisma: { DbNull: nullToken } },
    '@/lib/prisma': { prisma },
    '@/lib/shodan/access': { getShodanContext: async () => ({ organizationId: 'org-1' }), orgSlugFrom: () => 'org' },
    '@/lib/shodan/types': { effectivePrepStatus: (s, t) => s === 'processing' && Date.now() - new Date(t).getTime() > 360000 ? 'failed' : s },
    '@/lib/shodan/storage': { signedUrl: async () => '' },
    '@/lib/shodan/slide-generation-lease': { shodanSlideLeaseKey: () => 'shodan-slide-generation:v1:prep-1' },
  })
  return { remove: (id = 'prep-1') => route.DELETE({}, { params: Promise.resolve({ id }) }), get row() { return row }, get deleted() { return deleted }, get orgLocks() { return orgLocks }, get leaseLocks() { return leaseLocks } }
}

;(async () => {
  await check('successful research deletion erases content but retains the monthly usage marker', async () => {
    const f = fixture('researched')
    const response = await f.remove()
    assert.equal(response.status, 200)
    assert.equal(f.deleted, false)
    assert.equal(f.row.status, 'deleted')
    assert.equal(f.row.targetUrl, '')
    assert.equal(f.row.research, nullToken)
    assert.equal(f.row.slidesJson, nullToken)
    assert.equal(f.row.slideImages, nullToken)
    assert(f.orgLocks >= 2 && f.leaseLocks === 1)
  })
  await check('failed research can be removed without consuming quota', async () => {
    const f = fixture('failed')
    assert.equal((await f.remove()).status, 200)
    assert.equal(f.deleted, true)
  })
  await check('active research and generation cannot be deleted', async () => {
    const active = fixture('processing')
    assert.equal((await active.remove()).status, 409)
    assert.equal(active.row.status, 'processing')
    const generating = fixture('done', `${Date.now() + 300000}:token`)
    assert.equal((await generating.remove()).status, 409)
    assert.equal(generating.row.status, 'done')
    const malformedLease = fixture('done', 'invalid')
    assert.equal((await malformedLease.remove()).status, 409)
  })
  await check('malformed IDs return not found before acquiring locks', async () => {
    const f = fixture('done')
    assert.equal((await f.remove('bad/id')).status, 404)
    assert.equal(f.orgLocks, 0)
  })
  await check('deleted preparations are hidden from detail/list and still count toward the monthly cap', () => {
    const route = fs.readFileSync('src/app/api/shodan/preparations/route.ts', 'utf8')
    const detail = fs.readFileSync('src/app/api/shodan/preparations/[id]/route.ts', 'utf8')
    const usage = fs.readFileSync('src/lib/usage-summary.ts', 'utf8')
    assert.match(route, /const where = \{ organizationId: ctx\.organizationId, status: \{ not: 'deleted' \} \}/)
    assert.match(route, /\{ status: 'deleted' \}/)
    assert.match(detail, /status: \{ not: 'deleted' \}/)
    assert.match(usage, /\{ status: 'deleted' \}/)
    assert.match(usage, /status: \{ not: 'deleted' \}/)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
