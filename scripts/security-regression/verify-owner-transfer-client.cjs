// Actual owner-transfer client/parser with synthetic storage and bounded HTTP transport.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const crypto = require('node:crypto')
const ts = require('typescript')
const source = 'src/lib/owner-transfer-client.ts'
const cases = []
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
async function check(name, run) { await run(); cases.push(name); console.log('PASS', name) }
function fixture(fetch) {
  const timers = new Map(), signals = []
  let timerId = 0
  const clock = {
    setTimeout: (fn, ms) => { assert.equal(ms, 15000); const id = ++timerId; timers.set(id, fn); return id },
    clearTimeout: id => { timers.delete(id) },
    fire: () => { const [id, fn] = [...timers][0] || []; assert(fn, 'deadline installed'); timers.delete(id); fn() },
  }
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { throw Error('Unexpected import ' + name) },
    AbortController, fetch: (url, init) => { signals.push(init.signal); return fetch(url, init) },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, console }, { filename: source })
  return { client: module.exports, clock, timers, signals }
}
;(async () => {
  await check('headers never settle: finite deadline aborts and a late response is not accepted', async () => {
    const headers = deferred(), f = fixture(() => headers.promise)
    const pending = f.client.ownerTransferRequest('/api/shodan/owner-transfer')
    assert.equal(f.timers.size, 1)
    f.clock.fire()
    await assert.rejects(pending, /通信結果を確認できません/)
    assert.equal(f.signals[0].aborted, true)
    headers.resolve({ status: 200, json: async () => ({ phase: 'committed' }) })
    await new Promise(setImmediate)
    assert.equal(f.timers.size, 0)
  })
  await check('body never settles: one deadline spans headers and body', async () => {
    const body = deferred(), f = fixture(async () => ({ status: 200, json: () => body.promise }))
    const pending = f.client.ownerTransferRequest('/api/aio/owner-transfer')
    await new Promise(setImmediate)
    f.clock.fire()
    await assert.rejects(pending, /通信結果を確認できません/)
    assert.equal(f.signals[0].aborted, true)
    body.resolve({ phase: 'committed' })
    await new Promise(setImmediate)
    assert.equal(f.timers.size, 0)
  })
  await check('current response completes and clears its deadline', async () => {
    const f = fixture(async () => ({ status: 200, json: async () => ({ phase: 'missing' }) }))
    const result = await f.client.ownerTransferRequest('/api/quote/owner-transfer')
    assert.equal(result.status, 200)
    assert.equal(result.body.phase, 'missing')
    assert.equal(f.timers.size, 0)
  })
  await check('durable handle exact scope and compare-before-clear', async () => {
    const f = fixture(async () => { throw Error('HTTP not expected') }), data = new Map()
    const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
    const handle = { version: 1, service: 'quote', actorId: 'actor', organizationId: 'org', organizationSlug: 'selected',
      operationId: '10000000-0000-4000-8000-000000000001' }
    f.client.saveOwnerTransferHandle(storage, handle)
    assert.equal(f.client.readOwnerTransferHandle(storage, 'quote', 'actor', 'selected').operationId, handle.operationId)
    const key = f.client.ownerTransferSlot('quote', 'actor', 'selected')
    data.set(key, JSON.stringify({ ...handle, operationId: '10000000-0000-4000-8000-000000000002' }))
    assert.throws(() => f.client.clearOwnerTransferHandle(storage, handle), /変更されました/)
    assert.equal(data.size, 1)
    data.set(key, JSON.stringify({ ...handle, actorId: 'foreign' }))
    assert.throws(() => f.client.readOwnerTransferHandle(storage, 'quote', 'actor', 'selected'), /確認できません/)
  })
  await check('result and candidate DTOs reject altered actor, scope or malformed success', async () => {
    const f = fixture(async () => { throw Error('HTTP not expected') })
    const handle = { version: 1, service: 'quote', actorId: 'actor', organizationId: 'org', organizationSlug: 'selected',
      operationId: '10000000-0000-4000-8000-000000000001' }
    const result = { actorId: 'actor', service: 'quote', organizationId: 'org', operationId: handle.operationId,
      phase: 'missing', input: null, createdAt: null }
    assert.equal(f.client.parseOwnerTransferResult(result, handle).phase, 'missing')
    for (const bad of [{ ...result, actorId: 'foreign' }, { ...result, organizationId: 'other' },
      { ...result, phase: 'committed' }, { ...result, code: 'unexpected' }]) {
      assert.throws(() => f.client.parseOwnerTransferResult(bad, handle), /確認できません/)
    }
    const candidates = { actorId: 'actor', service: 'quote', organization: { id: 'org', slug: 'selected', name: '合成' },
      owner: { memberId: 'old', userId: 'actor' }, candidates: [{ memberId: 'new', userId: 'successor', name: null, role: 'member', plan: 'LIGHT' }] }
    assert.equal(f.client.parseOwnerTransferCandidates(candidates, 'quote', 'actor', 'selected', 'org').candidates.length, 1)
    for (const bad of [{ ...candidates, actorId: 'foreign' }, { ...candidates, organization: { ...candidates.organization, id: 'other' } },
      { ...candidates, candidates: [{ ...candidates.candidates[0], role: 'owner' }] }]) {
      assert.throws(() => f.client.parseOwnerTransferCandidates(bad, 'quote', 'actor', 'selected', 'org'), /確認できません/)
    }
  })
  await check('only a bound, allowlisted 4xx identifies a confirmed rejection', async () => {
    const f = fixture(async () => { throw Error('HTTP not expected') })
    const handle = { version: 1, service: 'quote', actorId: 'actor', organizationId: 'org', organizationSlug: 'selected',
      operationId: '10000000-0000-4000-8000-000000000001' }
    const rejection = { code: 'OWNER_TRANSFER_CONFIRMATION_CHANGED', error: 'Synthetic rejection',
      actorId: handle.actorId, service: handle.service, organizationId: handle.organizationId, operationId: handle.operationId }
    assert.equal(f.client.parseOwnerTransferRejection(rejection, handle, 409), rejection.code)
    for (const bad of [
      [{ ...rejection, actorId: 'foreign' }, 409], [{ ...rejection, organizationId: 'other' }, 409],
      [{ ...rejection, operationId: '10000000-0000-4000-8000-000000000002' }, 409],
      [{ ...rejection, code: 'OWNER_TRANSFER_STATE_UNAVAILABLE' }, 409],
      [{ ...rejection, extra: true }, 409], [rejection, 503], [rejection, 200],
    ]) assert.throws(() => f.client.parseOwnerTransferRejection(bad[0], handle, bad[1]), /確認できません/)
    assert.equal(f.client.ownerTransferPlanLabel('  light-monthly '), 'ライト')
    assert.equal(f.client.ownerTransferPlanLabel('NOT_PRO'), null)
  })
  const sourceHashes = { [source]: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
    'scripts/security-regression/verify-owner-transfer-client.cjs': crypto.createHash('sha256').update(fs.readFileSync('scripts/security-regression/verify-owner-transfer-client.cjs')).digest('hex') }
  console.log(JSON.stringify({ passed: cases.length, cases, sourceHashes, scope: 'Actual client transport, synthetic timer/HTTP/storage. No browser, database or provider.' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
