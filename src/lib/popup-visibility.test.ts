import assert from 'node:assert/strict'
import { shouldHideMarketingPopup, isPricingPath } from './popup-visibility'

const servicePaths = ['/banner', '/seo', '/sfa']
const hide = (pathname: string, status: 'loading' | 'authenticated' | 'unauthenticated') =>
  shouldHideMarketingPopup({ pathname, status, servicePaths })

assert.equal(isPricingPath('/pricing'), true)
assert.equal(isPricingPath('/seo/pricing'), true)
assert.equal(isPricingPath('/seo/pricingx'), false)
// 料金ページは未ログインでも出さない
assert.equal(hide('/pricing', 'unauthenticated'), true)
assert.equal(hide('/seo/pricing', 'unauthenticated'), true)
assert.equal(hide('/seo/pricing/', 'authenticated'), true)
// LP は今のまま出す
assert.equal(hide('/', 'unauthenticated'), false)
assert.equal(hide('/seo', 'unauthenticated'), false)
assert.equal(hide('/banner/landing', 'unauthenticated'), false)
// ログインした画面（枠の中を含む）では出さない
assert.equal(hide('/seo/new', 'authenticated'), true)
assert.equal(hide('/home', 'authenticated'), true)
assert.equal(hide('/income', 'authenticated'), true)
assert.equal(hide('/', 'authenticated'), false)
// 確認中は紹介ページでも隠す
assert.equal(hide('/seo', 'loading'), true)
assert.equal(hide('/m/abc', 'unauthenticated'), true)
// ログインの画面には、ログインの有無に関係なく出さない（2026-10-24）
assert.equal(hide('/auth/signin', 'unauthenticated'), true)
assert.equal(hide('/auth/signin', 'loading'), true)
assert.equal(hide('/auth/error', 'unauthenticated'), true)
assert.equal(hide('/auth', 'unauthenticated'), true)
assert.equal(hide('/authors', 'unauthenticated'), false)
console.log('popup-visibility ok')
