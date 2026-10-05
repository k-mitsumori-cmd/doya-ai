const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const { safeSignInCallbackUrl, signInPublicIntroUrl } = load('src/lib/safe-signin-callback.ts')

for (const input of [null, '', 'seo', 'https://external.example/steal', '//external.example/steal', '/\\external.example/steal']) {
  assert.equal(safeSignInCallbackUrl(input), '/seo', String(input))
}
assert.equal(safeSignInCallbackUrl('/banner/dashboard/create'), '/banner/dashboard/create')
assert.equal(safeSignInCallbackUrl('/hr/invite/token-1'), '/hr/invite/token-1')
assert.equal(safeSignInCallbackUrl('/seo/articles/1?tab=outline'), '/seo/articles/1?tab=outline')
console.log('PASS sign-in callback: external and protocol-relative destinations rejected; local article and banner paths retained')

const { getPublicServices } = load('src/lib/services.ts', { './unified-plan': { UNIFIED_PRO_PRICE: 9980 } })
for (const service of getPublicServices()) {
  const privateReturn = `${service.href}/dashboard/item?tab=private#details`
  assert.equal(signInPublicIntroUrl(privateReturn), service.id === 'banner' ? '/banner/landing' : service.href)
  assert.equal(safeSignInCallbackUrl(privateReturn), privateReturn, 'Google return destination must remain intact')
}
assert.equal(signInPublicIntroUrl('/hr/invite/token-1?email=private'), '/hr')
assert.equal(safeSignInCallbackUrl('/hr/invite/token-1?email=private'), '/hr/invite/token-1?email=private')
assert.equal(signInPublicIntroUrl('/doyaslide/new'), '/doyaslide')
for (const input of ['/admin/users', '/auth/signin', '/hr-other/dashboard', '/video/private', '/unknown/item']) {
  assert.equal(signInPublicIntroUrl(input), '/', 'unknown or retired destinations must lead to the public catalog')
}
console.log('PASS sign-in introduction: all current public services use public entry pages; private paths and invitations stay only in the login callback')
