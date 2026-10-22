// Actual bounded checkout response reader + actual recovery manager. Synthetic HTTP only.
// A lost header/body never proves server non-execution or permits a new UUID.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const Module = require('node:module')
const crypto = require('node:crypto')
const root = process.env.DOYA_REPO_ROOT || path.resolve(__dirname, '../..')
const candidate = path.resolve(__dirname, '../..')
const ts = Module.createRequire(path.join(root, 'package.json'))('typescript')
const read = rel => fs.readFileSync(fs.existsSync(path.join(candidate, rel)) ? path.join(candidate, rel) : path.join(root, rel), 'utf8')
function actual(rel, dependencies, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports, require: id => {
    if (id in dependencies) return dependencies[id]
    throw Error(`Unmocked ${id} in ${rel}`)
  }, AbortController, URL, TextDecoder, Uint8Array, Buffer, Response, console, ...globals }, { filename: rel })
  return exports
}
const tick = () => new Promise(resolve => setImmediate(resolve))
const intent = { planId: 'unified-pro', billingPeriod: 'monthly', serviceId: 'aio', returnTo: '/aio/pricing', organization: null }
async function caseFor(which) {
  const stored = new Map(), port = { getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) }
  const timers = new Map(), requests = [], callbacks = []
  let timerId = 0
  const reader = actual('src/lib/billing-response-client.ts', {}, {
    setTimeout: (fn, ms) => { assert.equal(ms, 35000); timers.set(++timerId, fn); return timerId },
    clearTimeout: id => timers.delete(id),
    fetch: (url, init) => {
      assert.equal(url, '/api/stripe/checkout')
      const body = JSON.parse(init.body)
      requests.push({ body, signal: init.signal })
      if (body.action === 'start') return Promise.resolve(Response.json({ actorId: 'actor', operationId: body.operationId,
        url: 'https://checkout.example.invalid/start' }))
      assert.equal(body.action, 'ready')
      if (which === 'headers') return new Promise(() => {})
      return Promise.resolve(new Response(new ReadableStream({ start() {}, cancel() {} }), { status: 200 }))
    },
  })
  const { CheckoutRecoveryClient } = actual('src/lib/checkout-recovery-client.ts', { './billing-response-client': reader })
  const before = new CheckoutRecoveryClient('actor', () => port, (body, headers, signal) => reader.readBillingResponse(
    '/api/stripe/checkout', { method: 'POST', headers, body: JSON.stringify(body) }, signal), () => crypto.randomUUID())
  await before.observe(intent)
  const pending = before.start(intent, () => true, value => callbacks.push(value))
  for (let i = 0; i < 12 && requests.length < 2; i++) await tick()
  assert.deepEqual(requests.map(row => row.body.action), ['start', 'ready'])
  assert.equal(timers.size, 1)
  for (const timeout of timers.values()) timeout()
  assert.equal(await pending, null)
  assert.equal(before.snapshot().phase, 'unknown')
  assert.equal(callbacks.length, 0)
  assert.equal(stored.size, 1)
  assert.equal(requests.length, 2)
  assert.equal(requests[1].signal.aborted, true)
  before.dispose()
  const afterCalls = []
  const after = new CheckoutRecoveryClient('actor', () => port, async body => {
    afterCalls.push(body.action)
    return { ok: true, status: 200, data: body.action === 'status' ? {
      actorId: 'actor', operationId: body.operationId, phase: 'completed', dispatched: false,
    } : { actorId: 'actor', operationId: body.operationId,
      sessionId: `cs_${which}`, url: 'https://checkout.example.invalid/ready' } }
  }, () => { throw Error('recovery must not allocate a new UUID') })
  await after.observe(intent)
  const outcome = await after.readyAgain(intent, () => true, value => callbacks.push(value))
  assert.equal(outcome.kind, 'ready')
  assert.equal(callbacks.length, 1)
  assert.equal(callbacks[0].provenance, 'recovered')
  assert.deepEqual(afterCalls, ['status', 'ready'])
  assert.equal(requests.length, 2)
  assert.equal(timers.size, 0)
  after.dispose()
  return { case: which, postActions: requests.map(row => row.body.action), recoveryActions: afterCalls,
    postLossNewStart: requests.filter(row => row.body.action === 'start').length - 1,
    inferredFreshOrigin: callbacks.filter(row => row.provenance === 'fresh').length }
}
;(async () => { const cases = [await caseFor('headers'), await caseFor('body')]
  console.log(JSON.stringify({ passed: cases.length, cases, scope: 'Actual bounded response reader and recovery manager; synthetic noncooperative checkout HTTP. No real provider, DB or Stripe.' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
