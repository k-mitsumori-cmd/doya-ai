// Actual durable admin hook, synthetic cookie session/API and DOM. No provider, DB or browser auth claim.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm')
const ts = require('typescript'), React = require('react'), { JSDOM } = require('jsdom')
const { createRoot } = require('react-dom/client')
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://admin.invalid/admin/users' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const lockTails = new Map()
dom.window.navigator.locks = { request: async (name, _options, work) => {
  const previous = lockTails.get(name) || Promise.resolve()
  let release
  const next = new Promise(resolve => { release = resolve })
  lockTails.set(name, previous.then(() => next))
  await previous
  try { return await work() } finally { release() }
} }
const tick = () => new Promise(resolve => setImmediate(resolve))
let admin = 'admin1', response = async (_url, init) => {
  const a = JSON.parse(init.body)
  return Response.json({ source: 'admin', actorId: a.expectedAdminId, targetUserId: a.targetUserId,
    operationId: a.operationId, intent: a.intent, phase: 'completed', reason: null,
    canAbort: false, canContinue: false, actionPhase: 'confirmed', result: 'confirmed' })
}
const storage = new Map(), requests = []
let failStorage = false
const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => {
  if (failStorage) throw Error('synthetic quota'); storage.set(k, v)
}, removeItem: k => storage.delete(k) }
async function fetch(url, init) {
  if (url === '/api/admin/auth/session') return Response.json({ authenticated: true, adminUser: { id: admin } })
  requests.push({ url, init, storedAtSend: [...storage.values()] })
  return response(url, init)
}
const loaded = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/admin-subscription-client.ts', 'utf8'), {
  fileName: 'src/lib/admin-subscription-client.ts', compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded, require: name => { assert.equal(name, 'react'); return React },
  window: dom.window, document: dom.window.document, localStorage, fetch, crypto: require('node:crypto').webcrypto, Response,
  JSON, Object, Set, Map, Error, Date, console }, { filename: 'admin-subscription-client.ts' })
let hook
function Harness() { hook = loaded.useAdminSubscriptionOperation(); return React.createElement('p', null, hook.view?.phase || 'unknown') }
const container = document.createElement('div'); document.body.append(container)
const root = createRoot(container)
const flush = async () => { await tick(); await tick(); await tick() }
;(async () => {
  await React.act(async () => { root.render(React.createElement(Harness)); await flush() })
  assert.equal(hook.actorId, 'admin1')
  await React.act(async () => { await hook.start('user1', 'period_end_cancel'); await flush() })
  assert.equal(requests.length, 1); assert.equal(requests[0].storedAtSend.length, 1)
  assert.equal(JSON.parse(requests[0].init.body).action, 'start')
  assert.equal(hook.view.phase, 'completed')
  await React.act(async () => { assert.equal(await hook.clearTerminal(), true); await flush() })
  assert.equal(storage.size, 0)

  failStorage = true
  await React.act(async () => { await hook.start('user1', 'resume'); await flush() })
  assert.equal(requests.length, 1); assert.match(hook.error, /保存できなかった/)
  failStorage = false

  let release
  response = () => new Promise(resolve => { release = resolve })
  await React.act(async () => { void hook.start('user1', 'immediate_cancel'); await flush() })
  assert.equal(requests.length, 2)
  const saved = hook.handle
  // Lost body does not permit another start. A status request reuses the saved handle.
  await React.act(async () => { await hook.start('user2', 'resume'); await flush() })
  assert.equal(requests.length, 2); assert.equal(hook.handle.operationId, saved.operationId)
  await React.act(async () => { release(Response.json({})); await flush() })
  assert.equal(hook.view, null); assert.equal(storage.size, 1)
  response = async (_url, init) => { const a = JSON.parse(init.body); return Response.json({ source: 'admin', actorId: a.expectedAdminId,
    targetUserId: a.targetUserId, operationId: a.operationId, intent: a.intent, phase: 'executing',
    reason: 'EXTERNAL_UNKNOWN', canAbort: false, canContinue: false, actionPhase: 'dispatched', result: null }) }
  await React.act(async () => { await hook.act('status'); await flush() })
  assert.equal(requests.length, 3); assert.equal(JSON.parse(requests[2].init.body).action, 'status')
  assert.equal(hook.view.reason, 'EXTERNAL_UNKNOWN')

  // A delayed A response cannot be adopted after a current cookie principal switch to B.
  response = () => new Promise(resolve => { release = resolve })
  await React.act(async () => { void hook.act('status'); await flush() })
  admin = 'admin2'
  await React.act(async () => { dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })); await flush() })
  assert.equal(hook.actorId, 'admin2'); assert.equal(hook.handle, null)
  await React.act(async () => { release(Response.json({ source: 'admin', actorId: 'admin1', targetUserId: saved.targetUserId,
    operationId: saved.operationId, intent: saved.intent, phase: 'completed', reason: null,
    canAbort: false, canContinue: false, actionPhase: 'confirmed', result: 'confirmed' })); await flush() })
  assert.equal(hook.view, null); assert.equal(storage.size, 1)
  response = () => new Promise(resolve => { release = resolve })
  await React.act(async () => { void hook.start('user2', 'resume'); await flush() })
  assert.equal(requests.length, 5, 'principal refresh must retire the old busy request before B can start')
  await React.act(async () => { release(Response.json({ source: 'admin', actorId: 'admin2', targetUserId: 'user2',
    operationId: hook.handle.operationId, intent: 'resume', phase: 'reserved', reason: null,
    canAbort: true, canContinue: true, actionPhase: 'planned', result: null })); await flush() })
  await React.act(async () => { root.unmount(); await flush() })
  container.remove()

  // Two mounted tabs share one durable admin slot. A second intent must discover X, not overwrite it.
  storage.clear(); admin = 'admin1'
  const reply = (a, phase, reason = null) => Response.json({ source: 'admin', actorId: a.expectedAdminId,
    targetUserId: a.targetUserId, operationId: a.operationId, intent: a.intent, phase, reason,
    canAbort: false, canContinue: false, actionPhase: phase === 'completed' ? 'confirmed' : 'dispatched',
    result: phase === 'completed' ? 'confirmed' : null })
  response = async (_url, init) => reply(JSON.parse(init.body), 'executing', 'EXTERNAL_UNKNOWN')
  let tabA, tabB, reload
  function A() { tabA = loaded.useAdminSubscriptionOperation(); return React.createElement('p', null, tabA.view?.phase || 'unknown') }
  function B() { tabB = loaded.useAdminSubscriptionOperation(); return React.createElement('p', null, tabB.view?.phase || 'unknown') }
  function C() { reload = loaded.useAdminSubscriptionOperation(); return React.createElement('p', null, reload.view?.phase || 'unknown') }
  const nodeA = document.createElement('div'), nodeB = document.createElement('div'), nodeC = document.createElement('div')
  document.body.append(nodeA, nodeB, nodeC)
  const mountA = createRoot(nodeA), mountB = createRoot(nodeB), mountC = createRoot(nodeC)
  await React.act(async () => { mountA.render(React.createElement(A)); mountB.render(React.createElement(B)); await flush() })
  const beforeTabs = requests.length
  await React.act(async () => { await tabA.start('user1', 'immediate_cancel'); await flush() })
  const x = tabA.handle
  assert.equal(requests.length, beforeTabs + 1); assert.equal(tabA.view.reason, 'EXTERNAL_UNKNOWN')
  await React.act(async () => { await tabB.start('user2', 'resume'); await flush() })
  assert.equal(requests.length, beforeTabs + 1); assert.equal(tabB.handle.operationId, x.operationId)
  assert.equal(JSON.parse([...storage.values()][0]).operationId, x.operationId)
  await React.act(async () => { mountC.render(React.createElement(C)); await flush() })
  assert.equal(reload.handle.operationId, x.operationId)
  await React.act(async () => { await reload.act('status'); await flush() })
  assert.equal(JSON.parse(requests.at(-1).init.body).action, 'status')
  assert.equal(requests.length, beforeTabs + 2)

  response = async (_url, init) => reply(JSON.parse(init.body), 'completed')
  await React.act(async () => { await tabA.act('status'); await flush() })
  const y = { ...x, targetUserId: 'user2', operationId: require('node:crypto').randomUUID() }
  storage.set(`doya:admin-subscription:v1:${x.actorId}`, JSON.stringify(y))
  await React.act(async () => { assert.equal(await tabA.clearTerminal(), false); await flush() })
  assert.equal(JSON.parse([...storage.values()][0]).operationId, y.operationId)
  await React.act(async () => { mountA.unmount(); mountB.unmount(); mountC.unmount(); await flush() })
  nodeA.remove(); nodeB.remove(); nodeC.remove()

  storage.clear(); admin = 'admin1'
  let isolated
  function Isolated() { isolated = loaded.useAdminSubscriptionOperation(); return React.createElement('p', null, isolated.view?.phase || 'unknown') }
  const nodeD = document.createElement('div'); document.body.append(nodeD)
  const mountD = createRoot(nodeD)
  const beforeStrict = requests.length
  await React.act(async () => { mountD.render(React.createElement(React.StrictMode, null, React.createElement(Isolated))); await flush() })
  assert.equal(requests.length, beforeStrict, 'StrictMode bootstrap observes only and does not mutate')
  assert.equal(isolated.actorId, 'admin1'); assert.equal(isolated.handle, null)
  const lock = dom.window.navigator.locks
  dom.window.navigator.locks = undefined
  const beforeUnavailable = requests.length
  await React.act(async () => { await isolated.start('user1', 'period_end_cancel'); await flush() })
  assert.equal(requests.length, beforeUnavailable); assert.equal(storage.size, 0)
  dom.window.navigator.locks = lock
  response = () => new Promise(resolve => { release = resolve })
  await React.act(async () => { void isolated.start('user1', 'period_end_cancel'); await flush() })
  const firstSend = requests.length, pendingId = isolated.handle.operationId
  await React.act(async () => { await isolated.start('user1', 'period_end_cancel'); await flush() })
  assert.equal(requests.length, firstSend, 'double click does not create a second operation or provider request')
  assert.equal(isolated.handle.operationId, pendingId)
  await React.act(async () => { dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide')); await flush() })
  await React.act(async () => { release(reply({ expectedAdminId: 'admin1', targetUserId: 'user1',
    operationId: pendingId, intent: 'period_end_cancel' }, 'completed')); await flush() })
  assert.equal(isolated.view, null, 'late body after pagehide cannot adopt a completed result')
  assert.equal(JSON.parse([...storage.values()][0]).operationId, pendingId)
  await React.act(async () => { mountD.unmount(); await flush() }); nodeD.remove()

  // The WebLock queue is a separate async boundary: a retired start must not first persist its UUID.
  const heldStart = async retire => {
    storage.clear(); admin = 'admin1'
    response = async (_url, init) => reply(JSON.parse(init.body), 'completed')
    let probe
    function Probe() { probe = loaded.useAdminSubscriptionOperation(); return React.createElement('p', null, probe.view?.phase || 'unknown') }
    const node = document.createElement('div'); document.body.append(node)
    const mounted = createRoot(node)
    await React.act(async () => { mounted.render(React.createElement(Probe)); await flush() })
    let release
    lockTails.set('doya:admin-subscription:v1:admin1', new Promise(resolve => { release = resolve }))
    const before = requests.length
    await React.act(async () => { void probe.start('user1', 'period_end_cancel'); await flush() })
    assert.equal(storage.size, 0); assert.equal(requests.length, before)
    if (retire === 'refresh') {
      await React.act(async () => { await probe.refreshPrincipal(); await flush() })
    } else if (retire === 'pagehide') {
      await React.act(async () => { dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide')); await flush() })
    } else {
      await React.act(async () => { mounted.unmount(); await flush() }); node.remove()
    }
    await React.act(async () => { release(); await flush() })
    assert.equal(storage.size, 0, `retired ${retire} start cannot write a handle after acquiring the lock`)
    assert.equal(requests.length, before, `retired ${retire} start cannot POST`)
    if (retire !== 'unmount') {
      assert.equal(probe.error, null, `retired ${retire} start cannot set an old error`)
      if (retire === 'pagehide') await React.act(async () => {
        dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })); await flush()
      })
      await React.act(async () => { await probe.start('user1', 'period_end_cancel'); await flush() })
      assert.equal(requests.length, before + 1, 'the current scope can start normally after retirement')
      assert.equal(probe.view.phase, 'completed')
      await React.act(async () => { assert.equal(await probe.clearTerminal(), true); await flush() })
      await React.act(async () => { mounted.unmount(); await flush() }); node.remove()
    }
  }
  await heldStart('refresh')
  await heldStart('pagehide')
  await heldStart('unmount')

  // A stale terminal close waiting on the same lock must not erase a still-durable handle.
  storage.clear(); admin = 'admin1'
  const closing = { version: 1, actorId: 'admin1', targetUserId: 'user1',
    operationId: require('node:crypto').randomUUID(), intent: 'period_end_cancel' }
  storage.set('doya:admin-subscription:v1:admin1', JSON.stringify(closing))
  response = async (_url, init) => reply(JSON.parse(init.body), 'completed')
  let closer
  function Closer() { closer = loaded.useAdminSubscriptionOperation(); return React.createElement('p', null, closer.view?.phase || 'unknown') }
  const nodeE = document.createElement('div'); document.body.append(nodeE)
  const mountE = createRoot(nodeE)
  await React.act(async () => { mountE.render(React.createElement(Closer)); await flush() })
  await React.act(async () => { await closer.act('status'); await flush() })
  assert.equal(closer.view.phase, 'completed')
  let releaseClose
  lockTails.set('doya:admin-subscription:v1:admin1', new Promise(resolve => { releaseClose = resolve }))
  const beforeClose = requests.length
  await React.act(async () => { void closer.clearTerminal(); await flush() })
  await React.act(async () => { await closer.refreshPrincipal(); await flush() })
  await React.act(async () => { releaseClose(); await flush() })
  assert.equal(JSON.parse([...storage.values()][0]).operationId, closing.operationId)
  assert.equal(requests.length, beforeClose); assert.equal(closer.error, null)
  await React.act(async () => { await closer.act('status'); await flush() })
  await React.act(async () => { assert.equal(await closer.clearTerminal(), true); await flush() })
  assert.equal(storage.size, 0, 'current-scope explicit close still succeeds')
  await React.act(async () => { mountE.unmount(); await flush() }); nodeE.remove()
  console.log(JSON.stringify({ passed: 17, scope: 'actual durable admin hook with synthetic session/API, shared storage and mounted React' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
