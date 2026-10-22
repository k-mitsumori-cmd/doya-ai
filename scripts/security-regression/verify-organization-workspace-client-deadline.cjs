const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const root = path.resolve(__dirname, '../..')
const ts = require(root + '/node_modules/typescript')
const cache = new Map()
function load(rel) {
  if (cache.has(rel)) return cache.get(rel).exports
  const filename = path.join(root, rel), mod = new Module(filename)
  cache.set(rel, mod)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod.require = id => {
    if (id === './organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    throw new Error(`Unmocked ${id}`)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename)
  return mod.exports
}
const { readOrganizationWorkspace, WorkspaceReadError } = load('src/lib/organization-workspace-client.ts')
const row = { id: 'id-A', slug: 'A', name: 'Org A', role: 'owner' }
const payload = { service: 'aishodan', actorId: 'actor-A', memberships: [row], current: row }
const selected = { kind: 'selected', slug: 'A' }
const originalFetch = global.fetch, originalSetTimeout = global.setTimeout, originalClearTimeout = global.clearTimeout
let timer = null, cleared = 0, requestSignal = null
global.setTimeout = (callback, delay) => { assert.equal(delay, 20_000); timer = callback; return 1 }
global.clearTimeout = () => { cleared++ }
const tick = () => new Promise(resolve => setImmediate(resolve))
const expectStopped = async promise => assert.rejects(promise, error => error instanceof WorkspaceReadError && error.kind === 'unavailable')
async function run() {
  // A transport that ignores AbortSignal at the header boundary still settles at the deadline.
  global.fetch = (_, options) => { requestSignal = options.signal; return new Promise(() => {}) }
  const header = readOrganizationWorkspace('actor-A', selected, new AbortController().signal)
  await tick(); assert.equal(typeof timer, 'function'); timer()
  await expectStopped(header); assert.equal(requestSignal.aborted, true); assert.equal(cleared, 1)

  // The response headers arrive, but reader.read() never resolves or rejects on abort.
  let readEntered = false, canceled = false
  global.fetch = (_, options) => {
    requestSignal = options.signal
    return Promise.resolve({ ok: true, status: 200, headers: new Headers(), body: {
      getReader: () => ({
        read: () => { readEntered = true; return new Promise(() => {}) },
        cancel: () => { canceled = true; return new Promise(() => {}) },
      }),
    } })
  }
  timer = null
  const body = readOrganizationWorkspace('actor-A', selected, new AbortController().signal)
  await tick(); assert.equal(readEntered, true); timer()
  await expectStopped(body); assert.equal(requestSignal.aborted, true); assert.equal(canceled, true); assert.equal(cleared, 2)

  // An external retirement also settles a noncooperative request immediately.
  global.fetch = (_, options) => { requestSignal = options.signal; return new Promise(() => {}) }
  const external = new AbortController()
  const retired = readOrganizationWorkspace('actor-A', selected, external.signal)
  await tick(); external.abort()
  await expectStopped(retired); assert.equal(requestSignal.aborted, true); assert.equal(cleared, 3)

  // A normal response remains readable and does not wait for the deadline.
  global.fetch = () => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))
  const result = await readOrganizationWorkspace('actor-A', selected, new AbortController().signal)
  assert.equal(result.current.slug, 'A'); assert.equal(result.actorId, 'actor-A'); assert.equal(cleared, 4)
  console.log('PASS 4 actual workspace client cases: noncooperative header/body deadline, external abort, normal response')
}
run().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.fetch = originalFetch; global.setTimeout = originalSetTimeout; global.clearTimeout = originalClearTimeout
})
