const assert = require('node:assert/strict')
require('tsx/cjs')

const { summarizeBannerMonthlyQuota } = require('../../src/lib/admin/banner-quota.ts')
const fs = require('node:fs')
const path = require('node:path')

const now = new Date()
const sub = (plan, monthlyUsage, lastUsageReset = now) => ({ plan, monthlyUsage, lastUsageReset })

assert.deepEqual(summarizeBannerMonthlyQuota(null), { used: 0, limit: 15, remaining: 15 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('FREE', 15)), { used: 15, limit: 15, remaining: 0 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('LIGHT', 7)), { used: 7, limit: 50, remaining: 43 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('PRO', 50)), { used: 50, limit: 150, remaining: 100 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('ENTERPRISE', 120)), { used: 120, limit: 1000, remaining: 880 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('FREE', 15, new Date('2020-01-01T00:00:00Z'))), { used: 0, limit: 15, remaining: 15 })

const oldDisable = process.env.BANNER_DISABLE_LIMITS
try {
  process.env.BANNER_DISABLE_LIMITS = '1'
  assert.deepEqual(summarizeBannerMonthlyQuota(sub('PRO', 250)), { used: 250, limit: -1, remaining: null })
} finally {
  if (oldDisable === undefined) delete process.env.BANNER_DISABLE_LIMITS
  else process.env.BANNER_DISABLE_LIMITS = oldDisable
}

const root = path.resolve(__dirname, '../..')
const page = fs.readFileSync(path.join(root, 'src/app/admin/users/page.tsx'), 'utf8')
const route = fs.readFileSync(path.join(root, 'src/app/api/admin/users/route.ts'), 'utf8')
const exportRoute = fs.readFileSync(path.join(root, 'src/app/api/admin/users/export/route.ts'), 'utf8')
assert(page.includes("handleResetUsage(editingUser.id, 'banner', 'monthly')"), 'Banner reset must target the monthly counter')
assert(page.includes('editingUser.bannerQuota.used'), 'Admin modal must use normalized monthly usage')
assert(route.includes('bannerQuota: summarizeBannerMonthlyQuota('), 'Admin API must supply the monthly quota')
assert(exportRoute.includes('summarizeBannerMonthlyQuota(bannerSub ?? null).used'), 'CSV must export normalized monthly usage')
console.log('PASS admin banner quota matches generation limits, JST month reset, UI, and export')
