const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const { checkoutUrls } = load('src/lib/account-lifecycle/checkout-urls.ts')
const origin = 'https://example.invalid'
const session = '{CHECKOUT_SESSION_ID}'
for (const returnPath of ['/', '/pricing', '/all-in-one']) {
  const urls = checkoutUrls({ version: 2, recipe: 'generic_working', origin, returnPath, workingPath: '/home' }, 'banner-pro', 'banner')
  assert.equal(urls.successUrl, `${origin}/home?success=true&plan=pro&session_id=${session}`)
  assert.equal(urls.cancelUrl, `${origin}${returnPath}?payment=cancelled`)
}
const service = checkoutUrls({ version: 2, recipe: 'generic_working', origin, returnPath: '/hr/settings/billing', workingPath: '/hr/dashboard?tab=people&payment=old' }, 'banner-pro', 'hr')
assert.equal(service.successUrl, `${origin}/hr/dashboard?tab=people&success=true&plan=pro&session_id=${session}`)
assert.equal(service.cancelUrl, `${origin}/hr/settings/billing?payment=cancelled`)
const interview = checkoutUrls({ version: 2, recipe: 'generic_working', origin, returnPath: '/interview/pricing', workingPath: '/interview/projects' }, 'interview-pro', 'interview')
assert.equal(interview.successUrl, `${origin}/interview/projects?success=true&plan=pro&session_id=${session}`)
const previous = checkoutUrls({ version: 1, recipe: 'generic', origin, returnPath: '/all-in-one' }, 'banner-pro', 'banner')
assert.equal(previous.successUrl, `${origin}/?success=true&plan=pro&session_id=${session}`, 'stored recipe1 must retain original public-LP meaning')
assert.equal(previous.cancelUrl, `${origin}/all-in-one?payment=cancelled`)
console.log(JSON.stringify({ passed: true, scope: 'Actual versioned URL recipe with synthetic origin; working return and query preservation, old recipe1 unchanged.' }))
