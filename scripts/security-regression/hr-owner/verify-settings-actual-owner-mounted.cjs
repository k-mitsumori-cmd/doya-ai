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
function setAuth(status, actorId = 'actor') { auth = { status, data: { user: { id: actorId } } }; for (const listener of listeners) listener() }
const payload = role => ({ settings: { id: 'org', name: 'Org', industry: '', employeeScale: '', fiscalYearStart: '04' }, members: [{ id: 'peer', name: 'Peer', email: 'peer@example.invalid', role: 'MEMBER', joinedAt: '2026-10-23T00:00:00Z', employeeId: null }], myRole: role, myMemberId: 'owner' })
function deferred() { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
const pending = new Map(), employeePending = new Map(), requests = []
const variant = process.env.DOYA_HR_SEARCH_VARIANT || 'old-success'
const employeeBody = deferred(), toastErrors = []
let employeeReads = 0
const ownerServer = { phase: 'missing', input: null }
let settingsReads = 0
async function syntheticFetch(url, init = {}) {
  requests.push({ url, method: init.method || 'GET' })
  if (url === '/api/hr/settings' && !init.method) {
    settingsReads++
    if (pending.has(settingsReads)) return pending.get(settingsReads).promise
    return Response.json(payload('OWNER'))
  }
  if (String(url).startsWith('/api/hr/employees?')) { employeeReads++; if (employeeReads === 1 && variant === 'old-body') return { status: 200, json: () => employeeBody.promise }; if (employeePending.has(employeeReads)) return employeePending.get(employeeReads).promise; return Response.json({ items: [] }) }
  if (url === '/api/hr/organization/invite') return Response.json({ success: true, emailSent: false, inviteUrl: 'https://example.invalid/hr/invite/token' })
  if (url === '/api/hr/audit-logs?pageSize=10') return Response.json({ items: [] })
  if (String(url).startsWith('/api/hr/organization/transfer-owner')) {
    const query = new URL(String(url), 'https://example.invalid').searchParams
    if (query.get('action') === 'candidates') return Response.json({ actorId: 'actor', service: 'hr',
      organization: { id: 'org', slug: 'x'.repeat(161), name: 'Org' }, owner: { memberId: 'owner', userId: 'actor' },
      candidates: [{ memberId: 'target', userId: 'successor', name: 'Successor', role: 'MEMBER', plan: 'PRO' }], nextCursor: null })
    if (query.get('action') === 'status') return Response.json({ actorId: 'actor', service: 'hr', organizationId: 'org',
      operationId: query.get('operationId'), phase: ownerServer.phase, input: ownerServer.input,
      createdAt: ownerServer.phase === 'missing' ? null : new Date().toISOString() })
    const body = JSON.parse(init.body); assert.equal(body.action, 'transfer'); assert.equal(body.orgId, 'org')
    ownerServer.phase = 'committed'; ownerServer.input = body.input
    return Response.json({ actorId: 'actor', service: 'hr', organizationId: 'org', operationId: body.operationId,
      phase: 'committed', input: body.input, createdAt: new Date().toISOString() })
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
function compile(file, custom = {}) {
  const filename = path.join(sourceRoot, file), output = {}
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports: output, require: name => {
    if (name in custom) return custom[name]
    if (name === 'react/jsx-runtime') return require(path.join(repo, 'node_modules/react/jsx-runtime'))
    throw Error('Unmocked ' + name)
  }, window, document, navigator: window.navigator, crypto: window.crypto, setTimeout, clearTimeout, AbortController,
  Response, URL, URLSearchParams, Error, console, Storage: window.Storage }, { filename })
  return output
}
const client = compile('src/lib/hr/owner-transfer-client.ts')
const hook = compile('src/lib/hr/use-owner-transfer.ts', { react: React, './owner-transfer-client': client })
const ActualPanel = compile('src/components/hr/HrOwnerTransferPanel.tsx', { react: React,
  '@/lib/hr/use-owner-transfer': hook, '@/lib/hr/owner-transfer-client': client }).default
const Panel = props => React.createElement('div', { 'data-owner-role': props.role }, React.createElement(ActualPanel, props))
const mocks = {
  react: React, 'react/jsx-runtime': require(path.join(repo, 'node_modules/react/jsx-runtime')),
  '@/components/hr/ui-next': { PageTitle: ({ children, ...props }) => React.createElement('h1', props, children) },
  '@/components/hr/HrOrganizationScope': { useHrOrganizationRequest: () => ({ isCurrent: () => auth.status === 'authenticated', request: syntheticFetch }) },
  '@/components/hr/HrOwnerTransferPanel': { __esModule: true, default: Panel },
  '@/lib/hr/department-list-client': { loadHrDepartmentList: async () => ({ organizationId: 'org', rows: [] }) },
  '@/lib/hr/department-settings-client': { parseSettingsDepartmentList: () => [], confirmSettingsDepartmentDeletion: () => {}, readDepartmentSettingsResponse: async (url, init) => { const res = await syntheticFetch(url, init); return { status: res.status, data: await res.json() } } },
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  'next-auth/react': { useSession }, '@/lib/hr/use-department-creation': { useHrDepartmentCreation: creation },
  'framer-motion': { motion }, 'react-hot-toast': { __esModule: true, default: Object.assign(() => {}, { success: () => {}, error: message => { toastErrors.push(String(message)) } }) },
}
const moduleExports = {}
const code = ts.transpileModule(fs.readFileSync(source, 'utf8'), { fileName: source, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
vm.runInNewContext(code, { exports: moduleExports, require: name => { assert.ok(name in mocks, 'Unmocked ' + name); return mocks[name] },
  window, document, navigator: window.navigator, setTimeout, clearTimeout, AbortController, Response, URL, URLSearchParams, Error, console }, { filename: source })
const tick = () => new Promise(resolve => setImmediate(resolve))
const act = async task => React.act(async () => { await task(); await tick(); await tick() })
const host = document.createElement('div'); document.body.append(host); let root = createRoot(host)
const button = text => [...host.querySelectorAll('button')].find(element => element.textContent.trim() === text || element.textContent.trim().endsWith(text))
const handler = element => element[Object.keys(element).find(key => key.startsWith('__reactProps$'))].onClick
function setInput(input, value) { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })) }
;(async () => {
  await act(() => root.render(React.createElement(moduleExports.default)))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'OWNER')
  const invite = host.querySelector('input[placeholder="メールアドレスで招待"]'); assert.ok(invite)
  await act(() => setInput(invite, 'member@example.invalid'))
  pending.set(2, deferred())
  await act(() => button('招待').click())
  assert.equal(settingsReads, 2)
  pending.set(3, deferred())
  await act(() => button('この方へ引き継ぐ').click())
  assert.equal(settingsReads, 3)
  await act(() => pending.get(3).resolve(Response.json(payload('ADMIN'))))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN')
  await act(() => pending.get(2).resolve(Response.json(payload('OWNER'))))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN')
  // A same-actor SDK recheck must retain the draft DOM but mask stale authority.
  const name = host.querySelector('input[placeholder="株式会社サンプル"]'); assert.ok(name)
  await act(() => setInput(name, 'Unsaved draft'))
  await act(() => setInput(host.querySelector('input[placeholder="メールアドレスで招待"]'), 'again@example.invalid'))
  const oldInvite = handler(button('招待'))
  await act(() => setAuth('loading'))
  assert.strictEqual(host.querySelector('input[placeholder="株式会社サンプル"]'), name)
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'UNKNOWN')
  const hidden = name.closest('div[style*="display: none"]'); assert.ok(hidden)
  pending.set(4, deferred())
  await act(() => setAuth('authenticated'))
  assert.equal(settingsReads, 4)
  assert.strictEqual(host.querySelector('input[placeholder="株式会社サンプル"]'), name)
  assert.equal(name.value, 'Unsaved draft')
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'UNKNOWN')
  await act(() => pending.get(4).resolve(Response.json(payload('ADMIN'))))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN')
  assert.equal(name.value, 'Unsaved draft')
  const writesBeforeOldCallback = requests.filter(row => row.url === '/api/hr/organization/invite').length
  await act(() => oldInvite())
  assert.equal(requests.filter(row => row.url === '/api/hr/organization/invite').length, writesBeforeOldCallback)
  await act(() => button('招待').click())
  assert.equal(requests.filter(row => row.url === '/api/hr/organization/invite').length, writesBeforeOldCallback + 1)
  if (variant !== 'old-body') employeePending.set(1, deferred())
  await act(() => button('従業員連携').click())
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
  assert.equal(employeeReads, 1, 'initial employee search')
  const picker = host.querySelector('[role="dialog"][aria-label="従業員情報の紐付け"]')
  assert.ok(picker)
  await act(() => setAuth('loading'))
  assert.strictEqual(host.querySelector('[role="dialog"][aria-label="従業員情報の紐付け"]'), picker)
  employeePending.set(2, deferred())
  await act(() => setAuth('authenticated'))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
  assert.equal(employeeReads, 2, 'fresh proof must issue a new employee search')
  await act(() => employeePending.get(2).resolve(Response.json({ items: [{ id: 'fresh', lastName: 'Fresh', firstName: 'Employee', email: 'fresh@example.invalid' }] })))
  assert.match(picker.textContent, /Fresh Employee/)
  const errorsBeforeOld = toastErrors.length
  if (variant === 'old-body') await act(() => employeeBody.resolve({ items: [{ id: 'old', lastName: 'Old', firstName: 'Employee', email: 'old@example.invalid' }] }))
  else if (variant === 'old-reject') await act(() => employeePending.get(1).reject(Error('old network failure')))
  else await act(() => employeePending.get(1).resolve(Response.json({ items: [{ id: 'old', lastName: 'Old', firstName: 'Employee', email: 'old@example.invalid' }] })))
  assert.match(picker.textContent, /Fresh Employee/)
  assert.doesNotMatch(picker.textContent, /Old Employee/)
  assert.equal(toastErrors.length, errorsBeforeOld, 'retired search must not toast')
  if (variant === 'actor-change' || variant === 'child-unmount') {
    employeePending.set(3, deferred())
    await act(() => setInput(picker.querySelector('input[placeholder="氏名・メール・社員番号で検索"]'), 'pending-scope-change'))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
    assert.equal(employeeReads, 3)
    const errorsBeforeRetire = toastErrors.length
    if (variant === 'actor-change') await act(() => setAuth('authenticated', 'other-actor'))
    else await act(() => root.unmount())
    await act(() => employeePending.get(3).reject(Error('retired employee search')))
    assert.equal(toastErrors.length, errorsBeforeRetire)
    assert.doesNotMatch(host.textContent, /retired employee search/)
    if (variant === 'child-unmount') { root = createRoot(host); await act(() => root.render(React.createElement(moduleExports.default))) }
    employeePending.set(4, deferred())
    await act(() => button('従業員連携').click())
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
    assert.equal(employeeReads, 4)
    await act(() => employeePending.get(4).resolve(Response.json({ items: [{ id: 'current', lastName: 'Current', firstName: 'Employee', email: 'current@example.invalid' }] })))
    assert.match(host.textContent, /Current Employee/)
  }
  console.log(JSON.stringify({ passed: variant === 'actor-change' || variant === 'child-unmount' ? 5 : 4, variant, settingsReads, employeeReads, oldGetCannotReinstateOwner: true, sameActorDraftElementRetained: true, maskedUntilFreshAuthority: true, retiredInviteWrite0AndFreshInviteWrite1: true, freshSearchPreserved: true, retiredToast0: true }))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { await act(() => root.unmount()); host.remove(); dom.window.close() })
