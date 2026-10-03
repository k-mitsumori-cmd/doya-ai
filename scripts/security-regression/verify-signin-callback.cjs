const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const { safeSignInCallbackUrl } = load('src/lib/safe-signin-callback.ts')

for (const input of [null, '', 'seo', 'https://external.example/steal', '//external.example/steal', '/\\external.example/steal']) {
  assert.equal(safeSignInCallbackUrl(input), '/seo', String(input))
}
assert.equal(safeSignInCallbackUrl('/banner/dashboard/create'), '/banner/dashboard/create')
assert.equal(safeSignInCallbackUrl('/hr/invite/token-1'), '/hr/invite/token-1')
assert.equal(safeSignInCallbackUrl('/seo/articles/1?tab=outline'), '/seo/articles/1?tab=outline')
console.log('PASS sign-in callback: external and protocol-relative destinations rejected; local article and banner paths retained')
