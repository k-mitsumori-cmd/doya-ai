const assert = require('node:assert/strict')
require('tsx/cjs')
const fs = require('node:fs')
const path = require('node:path')

const { reserveBannerMonthlyImages, releaseBannerMonthlyImages } = require('../../src/lib/banner/monthly-quota.ts')

function fixture(initial = null, accountPlan = 'FREE') {
  let row = initial ? { ...initial } : null
  let fail = false
  const db = {
    user: { async findUnique() { if (fail) throw new Error('database unavailable'); return { plan: accountPlan } } },
    userServiceSubscription: {
      async upsert({ create }) {
        if (fail) throw new Error('database unavailable')
        row ??= { id: 'banner-sub', ...create }
        return { ...row }
      },
      async findUnique() {
        if (fail) throw new Error('database unavailable')
        return row ? { ...row } : null
      },
      async updateMany({ where, data }) {
        if (fail) throw new Error('database unavailable')
        if (!row || row.id !== where.id) return { count: 0 }
        if (where.plan !== undefined && row.plan !== where.plan) return { count: 0 }
        if (where.monthlyUsage !== undefined) {
          if (typeof where.monthlyUsage === 'number' && row.monthlyUsage !== where.monthlyUsage) return { count: 0 }
          if (where.monthlyUsage.gte !== undefined && row.monthlyUsage < where.monthlyUsage.gte) return { count: 0 }
        }
        if (where.lastUsageReset && row.lastUsageReset.getTime() !== where.lastUsageReset.getTime()) return { count: 0 }
        if (data.monthlyUsage !== undefined) {
          row.monthlyUsage = typeof data.monthlyUsage === 'number' ? data.monthlyUsage
            : row.monthlyUsage + (data.monthlyUsage.increment ?? 0) - (data.monthlyUsage.decrement ?? 0)
        }
        if (data.lastUsageReset) row.lastUsageReset = data.lastUsageReset
        return { count: 1 }
      },
    },
  }
  return { db, get row() { return row }, set fail(value) { fail = value } }
}

;(async () => {
  const free = fixture()
  const claims = await Promise.all(Array.from({ length: 10 }, () => reserveBannerMonthlyImages('u1', 3, free.db)))
  assert.equal(claims.filter(x => x.state === 'reserved').length, 5)
  assert.equal(claims.filter(x => x.state === 'limit').length, 5)
  assert.equal(free.row.monthlyUsage, 15)
  assert.equal(claims.find(x => x.state === 'limit').usage.monthlyRemaining, 0)
  const reservation = claims.find(x => x.state === 'reserved').reservation
  assert.equal((await releaseBannerMonthlyImages(reservation, 2, free.db)).monthlyUsed, reservation.usage.monthlyUsed - 2)
  assert.equal(free.row.monthlyUsage, 13)

  const stale = fixture({ id: 'banner-sub', plan: 'FREE', monthlyUsage: 15, lastUsageReset: new Date('2020-01-01T00:00:00Z') })
  const restarted = await reserveBannerMonthlyImages('u2', 3, stale.db)
  assert.equal(restarted.state, 'reserved')
  assert.equal(stale.row.monthlyUsage, 3)
  assert.equal(restarted.reservation.usage.monthlyRemaining, 12)

  const pro = fixture({ id: 'banner-sub', plan: 'PRO', monthlyUsage: 140, lastUsageReset: new Date() })
  const paid = await reserveBannerMonthlyImages('u3', 50, pro.db)
  assert.equal(paid.state, 'reserved')
  assert.equal(paid.reservation.count, 10)
  assert.equal(pro.row.monthlyUsage, 150)
  assert.equal((await reserveBannerMonthlyImages('u3', 1, pro.db)).state, 'limit')

  const newPaid = fixture(null, 'PRO')
  const paidFirstUse = await reserveBannerMonthlyImages('u6', 10, newPaid.db)
  assert.equal(paidFirstUse.state, 'reserved')
  assert.equal(newPaid.row.plan, 'PRO')
  assert.equal(newPaid.row.monthlyUsage, 10)

  const reset = fixture({ id: 'banner-sub', plan: 'FREE', monthlyUsage: 15, lastUsageReset: new Date() })
  const blocked = await reserveBannerMonthlyImages('u4', 1, reset.db)
  assert.equal(blocked.state, 'limit')
  const before = reset.row.monthlyUsage
  await assert.rejects(() => releaseBannerMonthlyImages(reservation, 4, free.db), /Invalid banner quota release/)
  assert.equal(reset.row.monthlyUsage, before)

  const offline = fixture()
  offline.fail = true
  await assert.rejects(() => reserveBannerMonthlyImages('u5', 3, offline.db), /database unavailable/)
  assert.equal(offline.row, null)
  const root = path.resolve(__dirname, '../..')
  for (const route of ['generate', 'from-url', 'test/generate']) {
    const source = fs.readFileSync(path.join(root, 'src/app/api/banner', route, 'route.ts'), 'utf8')
    assert(source.includes('reserveBannerMonthlyImages('), `${route} must reserve before paid image generation`)
    assert(source.includes('releaseBannerMonthlyImages('), `${route} must return unused reservations`)
    assert(!/monthlyUsage:\s*\{\s*increment:/.test(source), `${route} must not charge after generation`)
  }
  console.log('PASS banner quota atomically limits parallel calls, resets JST month, clamps paid count, and fails closed on DB errors')
})().catch(error => { console.error(error); process.exitCode = 1 })
