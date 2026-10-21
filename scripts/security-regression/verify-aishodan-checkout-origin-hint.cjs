const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript')
function load(file, mocks = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + '/' + file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { assert.ok(name in mocks, name); return mocks[name] }, URL, URLSearchParams, decodeURIComponent, encodeURIComponent }, { filename: file })
  return exports
}
const selection = load('src/lib/organization-workspace-selection.ts')
const { parseCheckoutOriginHint, saveCheckoutOriginHint, readCheckoutOriginHint, parsePortalOriginHint, savePortalOriginHint, readPortalOriginHint } = load('src/lib/aishodan/checkout-origin-hint.ts', { '@/lib/organization-workspace-selection': selection })
const operationId = '00000000-0000-4000-8000-000000000001', actorId = 'actor-A'
const valid = { version: 1, actorId, operationId, organizationId: 'org-A', slug: '日本語', returnPath: '/aishodan' }
const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
assert.equal(readCheckoutOriginHint(storage, actorId, operationId), 'missing')
assert.equal(saveCheckoutOriginHint(storage, valid), true)
assert.equal(readCheckoutOriginHint(storage, actorId, operationId).slug, '日本語')
assert.equal(readCheckoutOriginHint(storage, 'actor-B', operationId), 'missing')
assert.equal(readCheckoutOriginHint(storage, actorId, '00000000-0000-4000-8000-000000000002'), 'invalid')
assert.equal(saveCheckoutOriginHint(storage, { ...valid, slug: 'B', organizationId: 'org-B' }), false)
assert.equal(readCheckoutOriginHint(storage, actorId, operationId).slug, '日本語')
for (const bad of [{ ...valid, slug: '..' }, { ...valid, returnPath: '//evil.invalid' }, { ...valid, operationId: 'invalid' }, { ...valid, actorId: 'actor-B', extra: 'x' }]) {
  assert.equal(parseCheckoutOriginHint(bad, bad.actorId, bad.operationId), null)
}
assert.equal(saveCheckoutOriginHint({ getItem() { throw Error('storage denied') }, setItem() { throw Error('storage denied') } }, valid), false)
assert.equal(readCheckoutOriginHint({ getItem() { throw Error('storage denied') } }, actorId, operationId), 'invalid')
const portal = { version: 1, actorId, navigationId: operationId, organizationId: 'org-A', slug: '日本語', returnPath: '/aishodan' }
assert.equal(readPortalOriginHint(storage, actorId, operationId), 'missing')
assert.equal(savePortalOriginHint(storage, portal), true)
assert.equal(readPortalOriginHint(storage, actorId, operationId).slug, '日本語')
assert.equal(readPortalOriginHint(storage, 'actor-B', operationId), 'missing')
assert.equal(readPortalOriginHint(storage, actorId, '00000000-0000-4000-8000-000000000002'), 'missing')
assert.equal(parsePortalOriginHint({ ...portal, slug: '../evil' }, actorId, operationId), null)
assert.equal(savePortalOriginHint({ setItem() { throw Error('storage denied') } }, portal), false)
assert.equal(readPortalOriginHint({ getItem() { throw Error('storage denied') } }, actorId, operationId), 'invalid')
console.log('PASS origin navigation hint checks: exact actor/operation/navigation/org/route, same-handle origin immutable, malformed and storage-denied. No billing authority.')
