const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript')
function load(file, mocks = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + '/' + file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { assert.ok(name in mocks, name); return mocks[name] }, URL, URLSearchParams, decodeURIComponent, encodeURIComponent }, { filename: file })
  return exports
}
const selection = load('src/lib/organization-workspace-selection.ts')
const { parseMensetsuCheckoutHint, saveMensetsuCheckoutHint, readMensetsuCheckoutHint, parseMensetsuPortalHint, saveMensetsuPortalHint, readMensetsuPortalHint } = load('src/lib/mensetsu/checkout-origin-hint.ts', { '@/lib/organization-workspace-selection': selection })
const operationId = '00000000-0000-4000-8000-000000000001', actorId = 'actor-A'
const valid = { version: 1, actorId, operationId, organizationId: 'org-A', slug: '日本語', returnPath: '/mensetsu' }
const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
assert.equal(readMensetsuCheckoutHint(storage, actorId, operationId), 'missing')
assert.equal(saveMensetsuCheckoutHint(storage, valid), true)
assert.equal(readMensetsuCheckoutHint(storage, actorId, operationId).slug, '日本語')
assert.equal(readMensetsuCheckoutHint(storage, 'actor-B', operationId), 'missing')
assert.equal(readMensetsuCheckoutHint(storage, actorId, '00000000-0000-4000-8000-000000000002'), 'invalid')
assert.equal(saveMensetsuCheckoutHint(storage, { ...valid, slug: 'B', organizationId: 'org-B' }), false)
assert.equal(readMensetsuCheckoutHint(storage, actorId, operationId).slug, '日本語')
for (const bad of [{ ...valid, slug: '..' }, { ...valid, returnPath: '//evil.invalid' }, { ...valid, operationId: 'invalid' }, { ...valid, actorId: 'actor-B', extra: 'x' }]) {
  assert.equal(parseMensetsuCheckoutHint(bad, bad.actorId, bad.operationId), null)
}
assert.equal(saveMensetsuCheckoutHint({ getItem() { throw Error('storage denied') }, setItem() { throw Error('storage denied') } }, valid), false)
assert.equal(readMensetsuCheckoutHint({ getItem() { throw Error('storage denied') } }, actorId, operationId), 'invalid')
const portal = { version: 1, actorId, navigationId: operationId, organizationId: 'org-A', slug: '日本語', returnPath: '/mensetsu' }
assert.equal(readMensetsuPortalHint(storage, actorId, operationId), 'missing')
assert.equal(saveMensetsuPortalHint(storage, portal), true)
assert.equal(readMensetsuPortalHint(storage, actorId, operationId).slug, '日本語')
assert.equal(readMensetsuPortalHint(storage, 'actor-B', operationId), 'missing')
assert.equal(readMensetsuPortalHint(storage, actorId, '00000000-0000-4000-8000-000000000002'), 'missing')
assert.equal(parseMensetsuPortalHint({ ...portal, slug: '../evil' }, actorId, operationId), null)
assert.equal(saveMensetsuPortalHint({ setItem() { throw Error('storage denied') } }, portal), false)
assert.equal(readMensetsuPortalHint({ getItem() { throw Error('storage denied') } }, actorId, operationId), 'invalid')
console.log('PASS origin navigation hint checks: exact actor/operation/navigation/org/route, same-handle origin immutable, malformed and storage-denied. No billing authority.')
