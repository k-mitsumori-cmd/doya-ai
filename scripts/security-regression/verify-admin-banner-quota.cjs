const assert = require('node:assert/strict')
require('tsx/cjs')

const { summarizeBannerMonthlyQuota } = require('../../src/lib/admin/banner-quota.ts')
const fs = require('node:fs')
const path = require('node:path')

const now = new Date()
const sub = (plan, monthlyUsage, lastUsageReset = now) => ({ plan, monthlyUsage, lastUsageReset })

assert.deepEqual(summarizeBannerMonthlyQuota(null), { used: 0, limit: 15, remaining: 15 })
assert.deepEqual(summarizeBannerMonthlyQuota(null, 'PRO'), { used: 0, limit: 150, remaining: 150 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('FREE', 15)), { used: 15, limit: 15, remaining: 0 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('LIGHT', 7)), { used: 7, limit: 50, remaining: 43 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('PRO', 50)), { used: 50, limit: 150, remaining: 100 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('ENTERPRISE', 120)), { used: 120, limit: 1000, remaining: 880 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('FREE', 15), 'PRO'), { used: 15, limit: 150, remaining: 135 })
assert.deepEqual(summarizeBannerMonthlyQuota(sub('PRO', 50), 'FREE'), { used: 50, limit: 150, remaining: 100 })
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
assert(page.includes('editingUser.seoQuota'), 'Admin modal must use the authoritative SEO monthly quota')
assert(!page.includes("serviceId: 'writing', 'daily'"), 'Admin must not reset a retired counter presented as SEO usage')
assert(route.includes('getSeoArticleMonthlyUsageForUsers(prisma,'), 'Admin API must read article admission usage')
assert(page.includes('return handleUpdateUser(userId, { plan: newPlan })'), 'Unified plan update must use one API request')
assert(!page.includes("serviceId: 'writing', servicePlan: newPlan"), 'Admin must not send a separate legacy writing-plan update')
assert(page.includes('const currentPlan = user.plan || \'FREE\''), 'Plan selector must show the account plan it edits')
assert(route.includes('bannerQuota: summarizeBannerMonthlyQuota('), 'Admin API must supply the monthly quota')
assert(exportRoute.includes('summarizeBannerMonthlyQuota(bannerSub ?? null, user.plan).used'), 'CSV must export normalized monthly usage')
assert(exportRoute.includes('higherPlan(bannerSub?.plan, user.plan)'), 'CSV must show the same effective plan as the quota')
console.log('PASS admin banner quota matches generation limits, JST month reset, UI, and export')
