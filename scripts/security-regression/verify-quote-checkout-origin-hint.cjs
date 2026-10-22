const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript')
function load(file, mocks = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + '/' + file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { assert.ok(name in mocks, name); return mocks[name] }, URL, URLSearchParams, decodeURIComponent, encodeURIComponent }, { filename: file })
  return exports
}
const selection = load('src/lib/organization-workspace-selection.ts')
const { parseQuoteCheckoutHint, saveQuoteCheckoutHint, readQuoteCheckoutHint, parseQuotePortalHint, saveQuotePortalHint, readQuotePortalHint } = load('src/lib/quote/checkout-origin-hint.ts', { '@/lib/organization-workspace-selection': selection })
const operationId = '00000000-0000-4000-8000-000000000001', actorId = 'actor-A'
const valid = { version: 1, actorId, operationId, organizationId: 'org-A', slug: '日本語', returnPath: '/quote' }
const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
assert.equal(readQuoteCheckoutHint(storage, actorId, operationId), 'missing')
assert.equal(saveQuoteCheckoutHint(storage, valid), true)
assert.equal(readQuoteCheckoutHint(storage, actorId, operationId).slug, '日本語')
assert.equal(readQuoteCheckoutHint(storage, 'actor-B', operationId), 'missing')
assert.equal(readQuoteCheckoutHint(storage, actorId, '00000000-0000-4000-8000-000000000002'), 'invalid')
assert.equal(saveQuoteCheckoutHint(storage, { ...valid, slug: 'B', organizationId: 'org-B' }), false)
assert.equal(readQuoteCheckoutHint(storage, actorId, operationId).slug, '日本語')
for (const bad of [{ ...valid, slug: '..' }, { ...valid, returnPath: '//evil.invalid' }, { ...valid, operationId: 'invalid' }, { ...valid, actorId: 'actor-B', extra: 'x' }]) {
  assert.equal(parseQuoteCheckoutHint(bad, bad.actorId, bad.operationId), null)
}
assert.equal(saveQuoteCheckoutHint({ getItem() { throw Error('storage denied') }, setItem() { throw Error('storage denied') } }, valid), false)
assert.equal(readQuoteCheckoutHint({ getItem() { throw Error('storage denied') } }, actorId, operationId), 'invalid')
const portal = { version: 1, actorId, navigationId: operationId, organizationId: 'org-A', slug: '日本語', returnPath: '/quote' }
assert.equal(readQuotePortalHint(storage, actorId, operationId), 'missing')
assert.equal(saveQuotePortalHint(storage, portal), true)
assert.equal(readQuotePortalHint(storage, actorId, operationId).slug, '日本語')
assert.equal(readQuotePortalHint(storage, 'actor-B', operationId), 'missing')
assert.equal(readQuotePortalHint(storage, actorId, '00000000-0000-4000-8000-000000000002'), 'missing')
assert.equal(parseQuotePortalHint({ ...portal, slug: '../evil' }, actorId, operationId), null)
assert.equal(saveQuotePortalHint({ setItem() { throw Error('storage denied') } }, portal), false)
assert.equal(readQuotePortalHint({ getItem() { throw Error('storage denied') } }, actorId, operationId), 'invalid')
console.log('PASS origin navigation hint checks: exact actor/operation/navigation/org/route, same-handle origin immutable, malformed and storage-denied. No billing authority.')
