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
Object.defineProperty(window.crypto, 'randomUUID', { value: crypto.randomUUID, configurable: true })
window.navigator.locks = { request: async (_name, _options, callback) => callback() }
let auth = { status: 'authenticated', data: { user: { id: 'actor' } } }
const listeners = new Set()
function setAuth(status) { auth = { status, data: { user: { id: 'actor' } } }; for (const listener of listeners) listener() }
const payload = role => ({ settings: { id: 'org', name: 'Org', industry: '', employeeScale: '', fiscalYearStart: '04' }, members: [{ id: 'target', name: 'Target', email: 'target@example.invalid', role: 'MEMBER', joinedAt: new Date().toISOString() }], myRole: role, myMemberId: 'owner' })
function deferred() { let resolve, reject; const promise = new Promise((r,j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
const pending = new Map(), requests = [], toastSuccesses = [], toastErrors = []
const variant = process.env.DOYA_HR_OWNER_PARENT_VARIANT || 'headers-success'
const currentPositive = variant === 'current-positive'
const [stage, late = 'success'] = variant.split('-')
assert.ok(currentPositive || (['headers', 'body'].includes(stage) && ['success', 'malformed', '401', 'reject'].includes(late)), 'bounded owner-parent variant')
let pendingInvite = null, pendingSave = null, pendingMember = null, pendingMemberDelete = null
const held = hold => hold && (hold.kind === 'body' ? { status: hold.status, json: () => hold.gate.promise } : hold.gate.promise)
const clockTimers = new Map(); let clockNow = 0, clockNext = 1
const fakeSetTimeout = (callback, delay) => { const id = clockNext++; clockTimers.set(id, { at: clockNow + Number(delay), callback }); return id }
const fakeClearTimeout = id => clockTimers.delete(id)
const advance = ms => { clockNow += ms; for (const [id, timer] of [...clockTimers]) if (timer.at <= clockNow) { clockTimers.delete(id); timer.callback() } }
const ownerServer = { phase: 'missing', operationId: null, input: null, savedBeforePost: false }
let pendingTransfer = null, heldTransferStatus = null
let settingsReads = 0
async function syntheticFetch(url, init = {}) {
  requests.push({ url, method: init.method || 'GET' })
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
    if (pendingTransfer) {
      if (pendingTransfer.kind === 'body') heldTransferStatus = pendingTransfer.status
      return held(pendingTransfer)
    }
    return Response.json(reply)
  }
  throw Error('Unexpected request ' + url)
}
const motionCache = new Map()
const motion = new Proxy({}, { get: (_, tag) => {
  if (!motionCache.has(tag)) motionCache.set(tag, React.forwardRef(({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }, ref) => React.createElement(tag, { ...props, ref }, children)))
  return motionCache.get(tag)
} })
const useSession = () => React.useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, () => auth)
const creation = () => ({ ready: true, intent: null, busy: false, result: null, message: '', loginRequired: false, isCurrent: () => true,
  create: async () => null, retry: async () => null, recover: async () => null, acknowledge: () => {} })
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
const Panel = props => React.createElement('div', { 'data-owner-role': props.role }, React.createElement(ActualPanel, props))
const mocks = {
  react: React, 'react/jsx-runtime': require(path.join(repo, 'node_modules/react/jsx-runtime')),
  '@/components/hr/ui-next': { PageTitle: ({ children, ...props }) => React.createElement('h1', props, children) },
  '@/components/hr/HrOrganizationScope': { useHrOrganizationRequest: () => ({ isCurrent: () => auth.status === 'authenticated', request: syntheticFetch }) },
  '@/components/hr/HrOwnerTransferPanel': { __esModule: true, default: Panel },
  '@/lib/hr/department-list-client': { loadHrDepartmentList: async () => ({ organizationId: 'org', rows: [{ id: 'dept', name: 'Team', code: null, sortOrder: 0, employeeCount: 0 }] }) },
  '@/lib/hr/department-settings-client': { parseSettingsDepartmentList: () => [{ id: 'dept', name: 'Team', code: null, sortOrder: 0, employeeCount: 0 }], confirmSettingsDepartmentDeletion: () => {}, readDepartmentSettingsResponse: (url, init, signal) => actualSettingsClient.readDepartmentSettingsResponse(url, init, signal, syntheticFetch) },
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
const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
const button = text => [...host.querySelectorAll('button')].find(element => element.textContent.trim() === text || element.textContent.trim().endsWith(text))
const handler = element => element[Object.keys(element).find(key => key.startsWith('__reactProps$'))].onClick
const changeHandler = element => element[Object.keys(element).find(key => key.startsWith('__reactProps$'))].onChange
function setInput(input, value) { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })) }
;(async () => {
  await act(() => root.render(React.createElement(moduleExports.default)))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'OWNER')
  const draft = host.querySelector('input[placeholder="株式会社サンプル"]'); assert.ok(draft)
  await act(() => setInput(draft, 'Unsent draft'))
  const postCount = () => requests.filter(row => row.url === '/api/hr/organization/transfer-owner' && row.method === 'POST').length
  if (!currentPositive) pendingTransfer = { kind: stage, gate: deferred(), status: late === '401' ? 401 : 200 }
  const startButton = button('この方へ引き継ぐ'); assert.ok(startButton)
  await act(() => startButton.click())
  assert.equal(postCount(), 1)
  const slot = client.ownerTransferSlot('hr', 'actor', 'org')
  assert.equal(ownerServer.savedBeforePost, true, 'POST-time storage witness')
  const saved = window.localStorage.getItem(slot); assert.ok(saved, 'operation handle must remain after POST')
  const parsed = JSON.parse(saved); assert.match(parsed.operationId, /^[0-9a-f-]{36}$/i)
  assert.equal(ownerServer.operationId, parsed.operationId)
  if (!currentPositive) {
    assert.equal(clockTimers.size, 1, 'actual owner request must own a 15s deadline')
    if (stage === 'body') assert.equal(heldTransferStatus, late === '401' ? 401 : 200, 'actual held body HTTP status')
    await act(() => advance(15000))
    assert.equal(clockTimers.size, 0, 'owner deadline must clear timer')
    assert.match(host.textContent, /引継ぎ結果を確認できません/)
    assert.equal(window.localStorage.getItem(slot), saved)
    await act(() => button('引継ぎ状況を確認').click())
  }
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN', 'committed status must trigger actual parent fresh-role read')
  assert.strictEqual(host.querySelector('input[placeholder="株式会社サンプル"]'), draft, 'same actor draft DOM must survive')
  assert.equal(draft.value, 'Unsent draft')
  assert.equal(button('この方へ引き継ぐ'), undefined, 'old OWNER transfer control must be masked')
  const wrongOperation = crypto.randomUUID()
  await assert.rejects(() => syntheticFetch('/api/hr/organization/transfer-owner?action=status&expectedActor=actor&orgId=org&operationId=' + wrongOperation),
    /status must use the posted operation/, 'synthetic status must reject a foreign operation')
  const roleReads = settingsReads, postBeforeLate = postCount(), storageBeforeLate = window.localStorage.getItem(slot)
  const successBeforeLate = toastSuccesses.length, errorsBeforeLate = toastErrors.length, panelBeforeLate = host.textContent
  assert.match(panelBeforeLate, /この引き継ぎは完了|引継ぎは完了|引き継ぎは完了/, 'committed result must be visible before late response')
  assert.doesNotMatch(panelBeforeLate, /再ログイン|ログインし直|認証エラー/, 'no auth error before late response')
  if (!currentPositive) {
    const reply = { actorId: 'actor', service: 'hr', organizationId: 'org', operationId: parsed.operationId,
      phase: 'committed', input: ownerServer.input, createdAt: new Date().toISOString() }
    if (late === 'reject') await act(() => pendingTransfer.gate.reject(Error('late transport rejection')))
    else if (stage === 'headers') await act(() => pendingTransfer.gate.resolve(Response.json(late === '401' ? { error: 'late unauthorized' } : late === 'malformed' ? { malformed: true } : reply, { status: late === '401' ? 401 : 200 })))
    else await act(() => pendingTransfer.gate.resolve(late === '401' ? { error: 'late unauthorized' } : late === 'malformed' ? { malformed: true } : reply))
    assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN')
    assert.equal(settingsReads, roleReads, 'late old response must not schedule another role read')
    assert.equal(postCount(), postBeforeLate, 'late old response must not redispatch transfer')
    assert.equal(window.localStorage.getItem(slot), storageBeforeLate, 'late old response must not clear or replace durable ID')
    assert.equal(toastSuccesses.length, successBeforeLate, 'late old response must not show success')
    assert.equal(toastErrors.length, errorsBeforeLate, 'late old response must not show an error toast')
    assert.equal(host.textContent, panelBeforeLate, 'late old response must not replace the committed result or show an auth error')
    await act(() => button('引継ぎ状況を確認').click())
    assert.equal(settingsReads, roleReads, 'same committed status replay must not loop role reads')
  }
  assert.equal(requests.filter(row => row.url === '/api/hr/organization/transfer-owner' && row.method === 'POST').length, 1)
  console.log(JSON.stringify({ variant, passed: 1, settingsReads, ownerPosts: postCount(), actualSettingsParent: true,
    actualOwnerPanelHookClient: true, durableOperationId: parsed.operationId, savedBeforePost: ownerServer.savedBeforePost, wrongStatusRejected: true, retainedDraft: true,
    freshAdminAccepted: true, lateOldAdoption: false, syntheticTransport: true }))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { await act(() => root.unmount()); host.remove(); dom.window.close() })
