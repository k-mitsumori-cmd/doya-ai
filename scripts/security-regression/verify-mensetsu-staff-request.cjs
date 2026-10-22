const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const root = path.resolve(__dirname, '../..')
const req = Module.createRequire(path.join(root, 'package.json'))
const ts = req('typescript')
const filename = path.join(root, 'src/lib/mensetsu/staff-request-client.ts')
const m = new Module(filename)
m.require = id => { if (id === '@/lib/organization-workspace-selection') return {}; throw Error('Unmocked ' + id) }
m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
const { requestMensetsuStaff, readMensetsuStaffJson, MensetsuWriteUnknownError } = m.exports
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
let current = true, requests = [], timers = new Map(), nextTimer = 0
const proof = { current: () => current, api: path => `/api/mensetsu/staff${path}?org=B` }
const originalFetch = global.fetch, originalSetTimeout = global.setTimeout, originalClearTimeout = global.clearTimeout
global.fetch = (url, init) => { const held = deferred(); requests.push({ url, init, held }); return held.promise }
global.setTimeout = (callback, delay) => { assert.ok(delay === 20000 || delay === 310000); const id = ++nextTimer; timers.set(id, { callback, delay }); return id }
global.clearTimeout = id => timers.delete(id)
const flush = () => new Promise(resolve => originalSetTimeout(resolve, 0))
;(async () => {
  const header = readMensetsuStaffJson(proof, '/header').then(() => 'accepted', e => e.message)
  assert.equal(requests[0].url, '/api/mensetsu/staff/header?org=B')
  assert.equal(timers.size, 1)
  timers.values().next().value.callback()
  assert.match(await header, /読み込みが完了しません/)
  assert.equal(requests[0].init.signal.aborted, true)
  assert.equal(timers.size, 0)
  requests[0].held.resolve(new Response('{"old":true}', { status: 401 }))
  await flush()

  const heldBody = deferred()
  const body = readMensetsuStaffJson(proof, '/body').then(() => 'accepted', e => e.message)
  requests[1].held.resolve({ status: 200, statusText: 'OK', headers: new Headers(), arrayBuffer: () => heldBody.promise })
  await flush()
  timers.values().next().value.callback()
  assert.match(await body, /読み込みが完了しません/)
  heldBody.resolve(new TextEncoder().encode('{"old":true}').buffer)
  await flush()

  const retired = requestMensetsuStaff(proof, '/retired').then(() => 'accepted', e => e.message)
  current = false
  requests[2].held.resolve(new Response('{"old":true}', { status: 200 }))
  assert.match(await retired, /組織の確認が切り替わりました/)
  assert.equal(timers.size, 0)
  current = true
  const fresh = readMensetsuStaffJson(proof, '/fresh')
  requests[3].held.resolve(new Response('{"current":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  assert.deepEqual(await fresh, { current: true })
  assert.equal(timers.size, 0)

  const canceled = new AbortController()
  const pending = requestMensetsuStaff(proof, '/abort', { signal: canceled.signal }).then(() => 'accepted', e => e.message)
  canceled.abort()
  assert.match(await pending, /読み込みが完了しません/)
  assert.equal(requests[4].init.signal.aborted, true)
  assert.equal(timers.size, 0)
  const write = requestMensetsuStaff(proof, '/write', { method: 'POST', body: '{}' }).then(() => 'accepted', e => e.message)
  assert.equal(timers.values().next().value.delay, 310000)
  timers.values().next().value.callback()
  assert.match(await write, /再送すると重複する可能性/)
  assert.equal(requests[5].init.signal.aborted, true)
  assert.equal(timers.size, 0)
  requests[5].held.resolve(new Response('{"late":"success"}', { status: 200 }))
  await flush()
  const writeBody = deferred()
  const typed = requestMensetsuStaff(proof, '/write-body', { method: 'PATCH', body: '{}' }).then(() => null, error => error)
  requests[6].held.resolve({ status: 200, statusText: 'OK', headers: new Headers(), arrayBuffer: () => writeBody.promise })
  await flush()
  timers.values().next().value.callback()
  const typedError = await typed
  assert.ok(typedError instanceof MensetsuWriteUnknownError, 'write body timeout has a typed unknown outcome')
  assert.equal(typedError.code, 'MENSET_WRITE_OUTCOME_UNKNOWN')
  writeBody.resolve(new TextEncoder().encode('{"late":true}').buffer)
  await flush()
  const network = requestMensetsuStaff(proof, '/network', { method: 'POST' }).then(() => null, error => error)
  requests[7].held.reject(new Error('socket lost'))
  assert.ok(await network instanceof MensetsuWriteUnknownError, 'network rejection after dispatch is unknown')
  const rejected = requestMensetsuStaff(proof, '/known-rejection', { method: 'POST' })
  requests[8].held.resolve(Response.json({ error: 'bad input' }, { status: 400 }))
  assert.equal((await rejected).status, 400, 'complete HTTP rejection remains a known response')
  console.log('mensetsu staff GET/write: header/body deadline, retired body, current success, abort cleanup, unknown write without replay PASS')
})().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => {
  global.fetch = originalFetch; global.setTimeout = originalSetTimeout; global.clearTimeout = originalClearTimeout
})
