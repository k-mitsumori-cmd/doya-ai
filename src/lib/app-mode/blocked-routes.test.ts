import test from 'node:test'
import assert from 'node:assert/strict'
import { APP_UNAVAILABLE_PATH, BLOCKED_API_PREFIXES, BLOCKED_PAGE_PREFIXES, BLOCKED_PAGE_SEGMENTS, classifyBlockedPath, normalizePath } from './blocked-routes'

// 止める経路の一覧を固定する試験。一覧を変えたら、ここと docs/architecture/2026-11-18-app/app-mode-web.md の表も直す。
test('止める経路の一覧（固定）', () => {
  assert.deepEqual([...BLOCKED_PAGE_PREFIXES], ['/pricing', '/tokushoho', '/billing', '/banner/dashboard/plan', '/seo/dashboard/plan', '/kantan/dashboard/plan'])
  assert.deepEqual([...BLOCKED_PAGE_SEGMENTS], ['pricing', 'billing'])
  assert.deepEqual([...BLOCKED_API_PREFIXES], [
    '/api/stripe/checkout',
    '/api/stripe/portal',
    '/api/stripe/sync',
    '/api/stripe/trial-eligibility',
    '/api/pricing/billing',
    '/api/pricing/checkout-recovery',
    '/api/pricing/power-pack',
    '/api/pricing/seats',
    '/api/pricing/upsell',
    '/api/pricing/status',
    '/api/hr/billing',
    '/api/organization-billing',
    '/api/admin/doya-power/purchase',
  ])
  assert.equal(APP_UNAVAILABLE_PATH, '/app-unavailable')
})

test('画面: 料金・特商法・契約の管理は page。各ツールの /xxx/pricing も、名前で止まる', () => {
  for (const p of [
    '/pricing', '/pricing/join', '/tokushoho', '/billing/portal-unavailable',
    '/seo/pricing', '/banner/pricing', '/hr/pricing', '/hr/settings/billing', '/kantan/dashboard/pricing', '/nagusame/pricing',
    '/doyaslide/pricing', '/sfa/pricing', '/adbanner/pricing', '/interviewx/pricing', '/admin/billing',
    '/banner/dashboard/plan', '/seo/dashboard/plan', '/kantan/dashboard/plan', '/Banner/Dashboard/Plan/',
  ]) assert.equal(classifyBlockedPath(p), 'page', p)
})

test('API: 契約・購入・追加購入・ポータル・組織の契約は api', () => {
  for (const p of [
    '/api/stripe/checkout', '/api/stripe/portal', '/api/stripe/sync', '/api/stripe/sync/latest', '/api/stripe/trial-eligibility',
    '/api/pricing/billing', '/api/pricing/checkout-recovery', '/api/pricing/power-pack', '/api/pricing/power-pack/confirm',
    '/api/pricing/seats', '/api/pricing/upsell', '/api/pricing/status',
    '/api/hr/billing/checkout', '/api/hr/billing/portal', '/api/organization-billing/sfa', '/api/admin/doya-power/purchase',
  ]) assert.equal(classifyBlockedPath(p), 'api', p)
})

test('通常の経路は止まらない（/seo、認証、ツールの API、Stripe の webhook、中立のページ自身）', () => {
  for (const p of [
    '/', '/seo', '/seo/dashboard', '/banner/dashboard', '/home', '/auth/signin', '/settings/devices', '/privacy', '/terms',
    '/api/auth/session', '/api/seo/articles', '/api/doya-power/balance', '/api/stripe/webhook', '/api/pricing/members',
    '/api/cron/billing-audit', '/api/app/auth/refresh', APP_UNAVAILABLE_PATH, '/pricingx', '/xpricing', '/seo/pricing-tips-article',
    '/api/stripe', '/api/stripes/checkout',
  ]) assert.equal(classifyBlockedPath(p), 'none', p)
})

test('パスの正規化で迂回できない（パーセント表記、//、/./、/../、末尾の /、大文字、; の付属、クエリ）', () => {
  for (const p of [
    '/%70ricing', '/%2570ricing', '/%252570ricing', '//pricing', '///pricing', '/./pricing', '/seo/../pricing', '/pricing/', '/pricing//',
    '/Pricing', '/PRICING', '/pricing;x=1', '/pricing?plan=pro', '/pricing#a', '\\pricing', '/seo/%2e%2e/pricing', '/%2e/pricing',
    '/seo/pricing/', '/SEO/Pricing', '/hr/settings//billing', '/hr/./settings/billing',
  ]) assert.equal(classifyBlockedPath(p), 'page', p)
  for (const p of [
    '/api/%73tripe/checkout', '/api//stripe/checkout', '/api/stripe/checkout/', '/api/./stripe/checkout', '/api/stripe/../stripe/checkout',
    '/API/Stripe/Checkout', '/api/stripe/checkout?x=1', '/api/stripe/%63heckout', '/api/stripe/checkout;a=b', '/api/pricing//power-pack/confirm',
  ]) assert.equal(classifyBlockedPath(p), 'api', p)
})

test('正規化できないパスは、止める側に倒す（/api/ なら api、それ以外は page）', () => {
  assert.equal(normalizePath('/%E0%A4%A'), null)
  assert.equal(classifyBlockedPath('/%E0%A4%A'), 'page')
  assert.equal(classifyBlockedPath('/api/%E0%A4%A'), 'api')
  assert.equal(classifyBlockedPath('/pricing%00'), 'page')
  assert.equal(classifyBlockedPath('/%25252525252570ricing'), 'page')
})
