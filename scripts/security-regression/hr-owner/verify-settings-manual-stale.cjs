process.env.NODE_ENV = 'test'
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const repo = path.resolve(__dirname, '../../..')
const ts = require(path.join(repo, 'node_modules/typescript'))
const { JSDOM } = require(path.join(repo, 'node_modules/jsdom'))
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/hr/settings' })
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
const React = require(path.join(repo, 'node_modules/react'))
const { createRoot } = require(path.join(repo, 'node_modules/react-dom/client'))
const sourceRoot = repo
if (process.env.DOYA_HR_SETTINGS_SOURCE || process.env.DOYA_TEST_BASELINE) throw Error('H1 fixture requires current repository source')
if (process.env.DOYA_HR_STALE_BODY && !['rejection', 'invalid'].includes(process.env.DOYA_HR_STALE_BODY)) throw Error('Unknown H1 case')
const source = path.join(sourceRoot, 'src/app/(shell)/hr/settings/page.tsx')
window.confirm = () => true
Object.defineProperty(window.crypto, 'randomUUID', { value: crypto.randomUUID, configurable: true })
window.navigator.locks = { request: async (_name, _options, callback) => callback() }
let auth = { status: 'authenticated', data: { user: { id: 'actor' } } }
const listeners = new Set()
function setAuth(status) { auth = { status, data: { user: { id: 'actor' } } }; for (const listener of listeners) listener() }
const payload = role => ({ settings: { id: 'org', name: 'Org', industry: '', employeeScale: '', fiscalYearStart: '04' }, members: [{ id: 'target', name: 'Target', email: 'target@example.invalid', role: 'MEMBER', joinedAt: new Date().toISOString() }], myRole: role, myMemberId: 'owner' })
function deferred() { let resolve, reject; const promise = new Promise((r,j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
const pending = new Map(), requests = []
let pendingInvite = null, pendingSave = null, pendingMember = null, pendingDelete = null
const ownerServer = { phase: 'missing', input: null }
let settingsReads = 0
let auditFailures = 2
async function syntheticFetch(url, init = {}) {
  requests.push({ url, method: init.method || 'GET' })
  if (url === '/api/hr/settings' && !init.method) {
    settingsReads++
    if (pending.has(settingsReads)) return pending.get(settingsReads).promise
    return Response.json(payload('OWNER'))
  }
  if (url === '/api/hr/organization/invite') return pendingInvite ? pendingInvite.promise : Response.json({ success: true, emailSent: false, inviteUrl: 'https://example.invalid/hr/invite/token' })
  if (url === '/api/hr/settings' && init.method === 'PUT') return pendingSave ? pendingSave.promise : Response.json({ success: true })
  if (url === '/api/hr/organization/members/target' && init.method === 'PATCH') return pendingMember ? pendingMember.promise : Response.json({ success: true })
  if (url === '/api/hr/departments/dept' && init.method === 'DELETE') return pendingDelete ? pendingDelete.promise : Response.json({ success: true })
  if (url === '/api/hr/audit-logs?pageSize=10') { if (auditFailures > 0) { auditFailures--; return Response.json({ error: 'synthetic audit failure' }, { status: 500 }) } return Response.json({ items: [] }) }
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
  '@/lib/hr/department-list-client': { loadHrDepartmentList: async () => ({ organizationId: 'org', rows: [{ id: 'dept', name: 'Team', code: null, sortOrder: 0, employeeCount: 0 }] }) },
  '@/lib/hr/department-settings-client': { parseSettingsDepartmentList: () => [{ id: 'dept', name: 'Team', code: null, sortOrder: 0, employeeCount: 0 }], confirmSettingsDepartmentDeletion: () => {}, readDepartmentSettingsResponse: async (url, init) => { const res = await syntheticFetch(url, init); return { status: res.status, data: await res.json() } } },
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  'next-auth/react': { useSession }, '@/lib/hr/use-department-creation': { useHrDepartmentCreation: creation },
  'framer-motion': { motion }, 'react-hot-toast': { __esModule: true, default: Object.assign(() => {}, { success: () => {}, error: () => {} }) },
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
function setInput(input, value) { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })) }
;(async () => {
  await act(() => root.render(React.createElement(moduleExports.default)))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'OWNER')
  assert.ok(button('再試行する'), 'audit retry is visible')
  // A current manual read failure must remain visible and explicitly retryable.
  pending.set(2, deferred())
  await act(() => button('再試行する').click())
  assert.equal(settingsReads, 2)
  await act(() => pending.get(2).reject(Error('current manual read failure')))
  assert.ok(button('もう一度読み直す'), 'current failure offers retry')
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'UNKNOWN')
  pending.set(3, deferred())
  await act(() => button('もう一度読み直す').click())
  await act(() => pending.get(3).resolve(Response.json(payload('OWNER'))))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'OWNER')
  assert.ok(button('再試行する'), 'second audit failure offers another manual read')
  const name = host.querySelector('input[placeholder="株式会社サンプル"]'); assert.ok(name)
  await act(() => setInput(name, 'Unsaved draft'))
  pending.set(4, deferred())
  await act(() => button('再試行する').click())
  assert.equal(settingsReads, 4)
  pending.set(5, deferred())
  await act(() => button('この方へ引き継ぐ').click())
  assert.equal(settingsReads, 5)
  await act(() => pending.get(5).resolve(Response.json(payload('ADMIN'))))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN')
  if (process.env.DOYA_HR_STALE_BODY === 'invalid') await act(() => pending.get(4).resolve(Response.json({ settings: { id: 'org' }, members: 'invalid' })))
  else await act(() => pending.get(4).reject(Error('stale manual read failure')))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN')
  assert.strictEqual(host.querySelector('input[placeholder="株式会社サンプル"]'), name)
  assert.equal(name.value, 'Unsaved draft')
  assert.equal(button('もう一度読み直す'), undefined, 'stale error has no new retry CTA')
  console.log(JSON.stringify({ passed: 2, staleKind: process.env.DOYA_HR_STALE_BODY === 'invalid' ? 'invalid-body' : 'rejection', currentFailureRetry: true, staleManualFailureDoesNotInvalidateFreshAdmin: true, draftElementRetained: true, settingsReads }))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { await act(() => root.unmount()); host.remove(); dom.window.close() })
