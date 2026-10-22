// Actual HR source with synthetic transport only. CI must use this checkout's sources and dependencies.
const TEST_REPO_ROOT = require('node:path').resolve(__dirname, '../../..')
if (process.env.CI && (process.env.DOYA_HR_OWNER_TEST_REPO || process.env.DOYA_HR_OWNER_TEST_SOURCE)) throw Error('HR test source override forbidden in CI')
const TEST_DEPS_ROOT = process.env.DOYA_HR_OWNER_TEST_REPO || TEST_REPO_ROOT
const TEST_SOURCE_ROOT = process.env.DOYA_HR_OWNER_TEST_SOURCE || TEST_REPO_ROOT
process.env.NODE_ENV = 'test'
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const repo = TEST_DEPS_ROOT
const ts = require(path.join(repo, 'node_modules/typescript'))
const { JSDOM } = require(path.join(repo, 'node_modules/jsdom'))
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/hr/settings' })
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
const React = require(path.join(repo, 'node_modules/react'))
const { createRoot } = require(path.join(repo, 'node_modules/react-dom/client'))
const sourceRoot = TEST_SOURCE_ROOT
const source = path.join(sourceRoot, 'src/app/(shell)/hr/settings/page.tsx')
window.confirm = () => true
let uuidCounter = 0
Object.defineProperty(window.crypto, 'randomUUID', { value: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`, configurable: true })
const storage = new Map(), storageWrites = [], storageRemoves = [], lockTrace = [], lockTails = new Map()
let storageEventsSeen = 0
window.addEventListener('storage', () => { storageEventsSeen++ })
Object.defineProperty(window, 'localStorage', { value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => { storageWrites.push({ key, value }); storage.set(key, value) },
  removeItem: key => { storageRemoves.push(key); storage.delete(key) },
  key: index => [...storage.keys()][index] ?? null,
  get length() { return storage.size },
} })
window.navigator.locks = { request: async (name, _options, callback) => {
  lockTrace.push(['requested', name])
  const prior = lockTails.get(name) ?? Promise.resolve()
  let release
  const tail = new Promise(resolve => { release = resolve })
  lockTails.set(name, prior.then(() => tail))
  await prior
  lockTrace.push(['granted', name])
  try { return await callback() } finally { lockTrace.push(['released', name]); release() }
} }
const ScopeContext = React.createContext('A')
const auth = {
  A: { status: 'authenticated', data: { user: { id: 'actor' } } },
  B: { status: 'authenticated', data: { user: { id: 'actor' } } },
}
const listeners = new Set()
function setAuth(rootId, status) { auth[rootId] = { status, data: { user: { id: 'actor' } } }; for (const listener of listeners) listener() }
const payload = role => ({ settings: { id: 'org', name: 'Org', industry: '', employeeScale: '', fiscalYearStart: '04' }, members: [{ id: 'target', name: 'Target', email: 'target@example.invalid', role: 'MEMBER', joinedAt: new Date().toISOString() }], myRole: role, myMemberId: 'owner' })
function deferred() { let resolve, reject; const promise = new Promise((r,j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
const pending = new Map(), requests = [], toastSuccesses = [], toastErrors = []
const variant = process.env.DOYA_HR_TWO_SETTINGS_VARIANT || 'current'
assert.ok(['current', 'lost', 'retire-a', 'late401'].includes(variant), 'bounded two-parent variant')
let pendingInvite = null, pendingSave = null, pendingMember = null, pendingMemberDelete = null
const held = hold => hold && (hold.kind === 'body' ? { status: hold.status, json: () => hold.gate.promise } : hold.gate.promise)
const clockTimers = new Map(); let clockNow = 0, clockNext = 1
const fakeSetTimeout = (callback, delay) => { const id = clockNext++; clockTimers.set(id, { at: clockNow + Number(delay), callback }); return id }
const fakeClearTimeout = id => clockTimers.delete(id)
const advance = ms => { clockNow += ms; for (const [id, timer] of [...clockTimers]) if (timer.at <= clockNow) { clockTimers.delete(id); timer.callback() } }
const ownerServer = { phase: 'missing', operationId: null, input: null, savedBeforePost: false }
const pendingTransfer = variant === 'late401' ? { gate: deferred() } : null
let heldTransferStatus = null
let settingsReads = 0
async function syntheticFetch(url, init = {}, rootId = 'A') {
  requests.push({ url, method: init.method || 'GET', rootId })
  if (url === '/api/hr/settings' && !init.method) {
    settingsReads++
    if (pending.has(settingsReads)) return pending.get(settingsReads).promise
    return Response.json(payload(ownerServer.phase === 'committed' ? 'ADMIN' : 'OWNER'))
  }
  if (url === '/api/hr/organization/invite') return held(pendingInvite) || Response.json({ success: true, emailSent: false, inviteUrl: 'https://example.invalid/hr/invite/token' })
  if (url === '/api/hr/settings' && init.method === 'PUT') return held(pendingSave) || Response.json({ success: true })
  if (url === '/api/hr/organization/members/target' && init.method === 'PATCH') return held(pendingMember) || Response.json({ success: true })
  if (url === '/api/hr/organization/members/target' && init.method === 'DELETE') return held(pendingMemberDelete) || Response.json({ success: true })
  if (url === '/api/hr/audit-logs?pageSize=10') return Response.json({ items: [] })
  if (String(url).startsWith('/api/hr/organization/transfer-owner')) {
    const query = new URL(String(url), 'https://example.invalid').searchParams
    if (query.get('action') === 'candidates') return Response.json({ actorId: 'actor', service: 'hr',
      organization: { id: 'org', slug: 'x'.repeat(161), name: 'Org' }, owner: { memberId: 'owner', userId: 'actor' },
      candidates: [{ memberId: 'target', userId: 'successor', name: 'Successor', role: 'MEMBER', plan: 'PRO' }], nextCursor: null })
    if (query.get('action') === 'status') {
      assert.equal(query.get('expectedActor'), 'actor', 'status must use the current actor')
      assert.equal(query.get('orgId'), 'org', 'status must use the current organization')
      assert.equal(query.get('operationId'), ownerServer.operationId, 'status must use the posted operation')
      return Response.json({ actorId: 'actor', service: 'hr', organizationId: 'org',
        operationId: ownerServer.operationId, phase: ownerServer.phase, input: ownerServer.input,
        createdAt: ownerServer.phase === 'missing' ? null : new Date().toISOString() })
    }
    const body = JSON.parse(init.body); assert.equal(body.action, 'transfer'); assert.equal(body.orgId, 'org')
    assert.equal(body.expectedActor, 'actor', 'POST must use the current actor')
    const savedAtPost = window.localStorage.getItem(client.ownerTransferSlot('hr', 'actor', 'org'))
    assert.ok(savedAtPost, 'durable operation must exist when POST reaches transport')
    assert.equal(JSON.parse(savedAtPost).operationId, body.operationId, 'POST must use the already saved operation')
    ownerServer.savedBeforePost = true
    ownerServer.phase = 'committed'; ownerServer.operationId = body.operationId; ownerServer.input = body.input
    const reply = { actorId: 'actor', service: 'hr', organizationId: 'org', operationId: body.operationId,
      phase: 'committed', input: body.input, createdAt: new Date().toISOString() }
    if (variant === 'lost') throw Error('lost response after commit')
    if (pendingTransfer && rootId === 'A') { heldTransferStatus = 401; return pendingTransfer.gate.promise }
    return Response.json(reply)
  }
  throw Error('Unexpected request ' + url)
}
const motionCache = new Map()
const motion = new Proxy({}, { get: (_, tag) => {
  if (!motionCache.has(tag)) motionCache.set(tag, React.forwardRef(({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)))
  return motionCache.get(tag)
} })
const useSession = () => {
  const rootId = React.useContext(ScopeContext)
  return React.useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, () => auth[rootId])
}
const useRequest = () => {
  const rootId = React.useContext(ScopeContext)
  return { isCurrent: () => auth[rootId].status === 'authenticated', request: (url, init) => syntheticFetch(url, init, rootId) }
}
function compile(file, custom = {}, timerApi = { setTimeout, clearTimeout }) {
  const filename = path.join(sourceRoot, file), output = {}
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports: output, require: name => {
    if (name in custom) return custom[name]
    if (name === 'react/jsx-runtime') return require(path.join(repo, 'node_modules/react/jsx-runtime'))
    throw Error('Unmocked ' + name)
  }, window, document, navigator: window.navigator, crypto: window.crypto, setTimeout: timerApi.setTimeout, clearTimeout: timerApi.clearTimeout, AbortController,
  Response, URL, URLSearchParams, Error, console, Storage: window.Storage }, { filename })
  return output
}
const client = compile('src/lib/hr/owner-transfer-client.ts', {}, { setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout })
const hook = compile('src/lib/hr/use-owner-transfer.ts', { react: React, './owner-transfer-client': client })
const ActualPanel = compile('src/components/hr/HrOwnerTransferPanel.tsx', { react: React,
  '@/lib/hr/use-owner-transfer': hook, '@/lib/hr/owner-transfer-client': client }).default
const actualSettingsClient = compile('src/lib/hr/department-settings-client.ts', {}, { setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout })
const creation = compile('src/lib/hr/use-department-creation.ts', { react: React,
  '@/components/hr/HrOrganizationScope': { useHrOrganizationRequest: useRequest },
  '@/lib/hr/department-settings-client': actualSettingsClient }).useHrDepartmentCreation
const Panel = props => React.createElement('div', { 'data-owner-role': props.role }, React.createElement(ActualPanel, props))
const mocks = {
  react: React, 'react/jsx-runtime': require(path.join(repo, 'node_modules/react/jsx-runtime')),
  '@/components/hr/ui-next': { PageTitle: ({ children, ...props }) => React.createElement('h1', props, children) },
  '@/components/hr/HrOrganizationScope': { useHrOrganizationRequest: useRequest },
  '@/components/hr/HrOwnerTransferPanel': { __esModule: true, default: Panel },
  '@/lib/hr/department-list-client': { loadHrDepartmentList: async () => ({ organizationId: 'org', rows: [{ id: 'dept', name: 'Team', code: null, sortOrder: 0, employeeCount: 0 }] }) },
  '@/lib/hr/department-settings-client': { parseSettingsDepartmentList: () => [{ id: 'dept', name: 'Team', code: null, sortOrder: 0, employeeCount: 0 }], confirmSettingsDepartmentDeletion: () => {}, readDepartmentSettingsResponse: actualSettingsClient.readDepartmentSettingsResponse },
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  'next-auth/react': { useSession }, '@/lib/hr/use-department-creation': { useHrDepartmentCreation: creation },
  'framer-motion': { motion }, 'react-hot-toast': { __esModule: true, default: Object.assign(() => {}, { success: message => { toastSuccesses.push(String(message)) }, error: message => { toastErrors.push(String(message)) } }) },
}
const moduleExports = {}
const code = ts.transpileModule(fs.readFileSync(source, 'utf8'), { fileName: source, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
vm.runInNewContext(code, { exports: moduleExports, require: name => { assert.ok(name in mocks, 'Unmocked ' + name); return mocks[name] },
  window, document, navigator: window.navigator, setTimeout, clearTimeout, AbortController, Response, URL, URLSearchParams, Error, console }, { filename: source })
const tick = () => new Promise(resolve => setImmediate(resolve))
const act = async task => React.act(async () => { await task(); await tick(); await tick() })
const hosts = [document.createElement('div'), document.createElement('div')]
for (const host of hosts) document.body.append(host)
const roots = hosts.map(host => createRoot(host))
const button = (host, text) => [...host.querySelectorAll('button')].find(element => element.textContent.trim() === text || element.textContent.trim().endsWith(text))
const handler = element => element[Object.keys(element).find(key => key.startsWith('__reactProps$'))].onClick
function setInput(input, value) { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })) }
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => {}) }
const readCount = rootId => requests.filter(row => row.rootId === rootId && row.url === '/api/hr/settings' && row.method === 'GET').length
const postCount = () => requests.filter(row => row.url === '/api/hr/organization/transfer-owner' && row.method === 'POST').length
const statusCount = rootId => requests.filter(row => row.rootId === rootId && String(row.url).includes('action=status')).length
const click = async (index, text) => { const el = button(hosts[index], text); assert.ok(el, 'missing '+text+' for root '+index); await act(() => el.click()); await flush() }
const render = async index => act(() => roots[index].render(React.createElement(ScopeContext.Provider, { value: index === 0 ? 'A' : 'B' }, React.createElement(moduleExports.default))))
const lockName = client.ownerTransferLock('hr', 'actor', 'org')
;(async () => {
  // A rejected callback must release its queue; another key remains independent while this key is held.
  const otherLock = lockName + ':other'
  await assert.rejects(() => window.navigator.locks.request(lockName, { mode: 'exclusive' }, async () => { throw Error('modeled callback rejection') }), /modeled callback rejection/)
  await render(0); await render(1)
  assert.equal(readCount('A'), 1); assert.equal(readCount('B'), 1, 'each actual Settings parent performs its own initial read')
  assert.equal(hosts[0].querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'OWNER')
  assert.equal(hosts[1].querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'OWNER')
  const drafts = hosts.map(host => host.querySelector('input[placeholder="株式会社サンプル"]'))
  assert.ok(drafts[0]); assert.ok(drafts[1]); assert.notStrictEqual(drafts[0], drafts[1])
  await act(() => { setInput(drafts[0], 'Draft A'); setInput(drafts[1], 'Draft B') })
  const oldA = handler(button(hosts[0], 'この方へ引き継ぐ'))
  const oldB = handler(button(hosts[1], 'この方へ引き継ぐ'))
  const blocker = deferred(), blockerGranted = deferred()
  const heldLock = window.navigator.locks.request(lockName, { mode: 'exclusive' }, async () => { blockerGranted.resolve(); await blocker.promise })
  await blockerGranted.promise
  let otherKeyRan = false
  await window.navigator.locks.request(otherLock, { mode: 'exclusive' }, async () => { otherKeyRan = true })
  assert.equal(otherKeyRan, true, 'a different Web Lock key runs while the transfer key is held')
  await click(0, 'この方へ引き継ぐ'); await click(1, 'この方へ引き継ぐ')
  assert.equal(postCount(), 0, 'neither root may POST while the shared key is held')
  assert.equal(storageWrites.length, 0, 'neither root may save before lock acquisition')
  assert.equal(lockTrace.filter(row => row[0] === 'requested' && row[1] === lockName).length, 4, 'reject control, blocker and two roots use one key')
  if (variant === 'retire-a') await act(() => setAuth('A', 'loading'))
  blocker.resolve(); await heldLock; await flush()
  if (variant === 'late401') {
    assert.equal(clockTimers.size, 1, 'actual owner request holds its 15-second deadline')
    await act(() => advance(15000)); await flush()
  }
  assert.equal(postCount(), 1, 'shared slot and exclusive queue permit one transfer POST')
  assert.equal(storageWrites.length, 1, 'one operation must be persisted')
  assert.equal(storageEventsSeen, 0, 'modeled localStorage does not send a storage event to its own writer')
  assert.equal(storage.size, 1)
  const slot = client.ownerTransferSlot('hr', 'actor', 'org')
  const saved = storage.get(slot); assert.ok(saved)
  const savedId = JSON.parse(saved).operationId
  assert.equal(ownerServer.savedBeforePost, true); assert.equal(savedId, ownerServer.operationId)
  assert.equal(storageRemoves.length, 0)
  assert.equal(hosts[1].querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN', 'B must independently adopt fresh ADMIN')
  if (variant === 'retire-a') {
    assert.equal(auth.A.status, 'loading')
    assert.equal(statusCount('A'), 0, 'retired queued A sends no status while hidden')
    const bStatusBefore = statusCount('B'), bReadsBefore = readCount('B')
    await click(1, '引継ぎ状況を確認')
    assert.equal(statusCount('B'), bStatusBefore + 1, 'B can read its saved operation while A is hidden')
    assert.equal(readCount('B'), bReadsBefore, 'B status replay does not re-read its role')
    await act(() => setAuth('A', 'authenticated')); await flush()
  } else if (variant !== 'current') {
    assert.match(hosts[0].textContent, /引継ぎ結果を確認できません/)
    await click(0, '引継ぎ状況を確認')
  }
  assert.equal(hosts[0].querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN', 'A must independently adopt fresh ADMIN')
  assert.strictEqual(hosts[0].querySelector('input[placeholder="株式会社サンプル"]'), drafts[0])
  assert.strictEqual(hosts[1].querySelector('input[placeholder="株式会社サンプル"]'), drafts[1])
  assert.equal(drafts[0].value, 'Draft A'); assert.equal(drafts[1].value, 'Draft B')
  assert.equal(button(hosts[0], 'この方へ引き継ぐ'), undefined); assert.equal(button(hosts[1], 'この方へ引き継ぐ'), undefined)
  assert.equal(readCount('A'), variant === 'retire-a' ? 3 : 2, 'A initial + committed role read, plus reproof read when retired')
  assert.equal(readCount('B'), 2, 'B initial + exactly one committed role read')
  const reads = [readCount('A'), readCount('B')], posts = postCount(), writes = storageWrites.length, errors = toastErrors.length
  const resultText = hosts.map(host => host.textContent)
  if (variant === 'late401') {
    assert.equal(heldTransferStatus, 401, 'late response must be a real HTTP 401')
    await act(() => pendingTransfer.gate.resolve(Response.json({ error: 'late unauthorized' }, { status: 401 }))); await flush()
    assert.deepEqual(hosts.map(host => host.textContent), resultText, 'late old 401 cannot replace either committed result before replay')
    assert.equal(toastErrors.length, errors, 'late old 401 cannot show an error toast before replay')
    assert.deepEqual([readCount('A'), readCount('B')], reads)
    assert.equal(storage.get(slot), saved)
  }
  await act(() => oldA()); await act(() => oldB()); await flush()
  assert.equal(postCount(), posts, 'retired start callbacks cannot create another transfer')
  assert.equal(storageWrites.length, writes, 'retired start callbacks cannot replace the saved operation')
  const statusesBeforeReplay = [statusCount('A'), statusCount('B')]
  await click(0, '引継ぎ状況を確認'); await click(1, '引継ぎ状況を確認')
  assert.deepEqual([statusCount('A'), statusCount('B')], statusesBeforeReplay.map(count => count + 1), 'each root replays its own durable status once')
  assert.deepEqual([readCount('A'), readCount('B')], reads, 'status replay must not loop either parent role read')
  assert.equal(storage.get(slot), saved); assert.equal(storageRemoves.length, 0)
  await assert.rejects(() => syntheticFetch('/api/hr/organization/transfer-owner?action=status&expectedActor=actor&orgId=org&operationId=' + crypto.randomUUID(), {}, 'A'), /status must use the posted operation/)
  assert.equal(toastErrors.length, errors)
  assert.equal(postCount(), 1); assert.equal(storageWrites.length, 1)
  assert.equal(lockTrace.filter(row => row[0] === 'released' && row[1] === lockName).length, 4, 'all same-key callbacks release, including rejection')
  console.log(JSON.stringify({ variant, passed: 1, actualSettingsParents: 2, actualPanelHookClient: true, sharedModeledSlot: true,
    exclusiveModeledQueue: true, differentKeyIndependent: true, rejectedLockCallbackReleased: true, storageEventsDispatched: storageEventsSeen,
    savedBeforePost: ownerServer.savedBeforePost, operationId: savedId, readsA: readCount('A'), readsB: readCount('B'), posts: postCount(),
    draftsRetained: true, oldCallbacksWrite0: true, realBrowserCrossTabAtomicity: 'unverified' }))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await act(() => { roots[0].unmount(); roots[1].unmount() })
  for (const host of hosts) host.remove()
  dom.window.close()
})
