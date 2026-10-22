// Actual HR source with synthetic transport only. CI must use this checkout's sources and dependencies.
const TEST_REPO_ROOT = require('node:path').resolve(__dirname, '../../..')
if (process.env.CI && (process.env.DOYA_HR_OWNER_TEST_REPO || process.env.DOYA_HR_OWNER_TEST_SOURCE)) throw Error('HR test source override forbidden in CI')
const TEST_DEPS_ROOT = process.env.DOYA_HR_OWNER_TEST_REPO || TEST_REPO_ROOT
const TEST_SOURCE_ROOT = process.env.DOYA_HR_OWNER_TEST_SOURCE || TEST_REPO_ROOT
process.env.NODE_ENV = 'test'
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const repo = TEST_DEPS_ROOT
const ts = require(path.join(repo, 'node_modules/typescript'))
const { JSDOM } = require(path.join(repo, 'node_modules/jsdom'))
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/hr/settings' })
Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
const React = require(path.join(repo, 'node_modules/react'))
const { createRoot } = require(path.join(repo, 'node_modules/react-dom/client'))
const source = path.join(TEST_SOURCE_ROOT, 'src/app/(shell)/hr/settings/page.tsx')
let auth = { status: 'authenticated', data: { user: { id: 'actor' } } }
const listeners = new Set()
function setAuth(status) { auth = { status, data: { user: { id: 'actor' } } }; for (const listener of listeners) listener() }
const payload = role => ({ settings: { id: 'org', name: 'Org', industry: '', employeeScale: '', fiscalYearStart: '04' }, members: [], myRole: role, myMemberId: 'owner' })
function deferred() { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const pending = new Map(), requests = []
let settingsReads = 0
async function syntheticFetch(url, init = {}) {
  requests.push({ url, method: init.method || 'GET' })
  if (url === '/api/hr/settings' && !init.method) {
    settingsReads++
    if (pending.has(settingsReads)) return pending.get(settingsReads).promise
    return Response.json(payload('OWNER'))
  }
  if (url === '/api/hr/organization/invite') return Response.json({ success: true, emailSent: false, inviteUrl: 'https://example.invalid/hr/invite/token' })
  if (url === '/api/hr/audit-logs?pageSize=10') return Response.json({ items: [] })
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
const Panel = ({ role, onCommitted }) => React.createElement('section', { 'data-owner-role': role }, React.createElement('button', { type: 'button', onClick: onCommitted }, 'Commit receipt'))
const mocks = {
  react: React, 'react/jsx-runtime': require(path.join(repo, 'node_modules/react/jsx-runtime')),
  '@/components/hr/ui-next': { PageTitle: ({ children, ...props }) => React.createElement('h1', props, children) },
  '@/components/hr/HrOrganizationScope': { useHrOrganizationRequest: () => ({ isCurrent: () => auth.status === 'authenticated', request: syntheticFetch }) },
  '@/components/hr/HrOwnerTransferPanel': { __esModule: true, default: Panel },
  '@/lib/hr/department-list-client': { loadHrDepartmentList: async () => ({ organizationId: 'org', rows: [] }) },
  '@/lib/hr/department-settings-client': { parseSettingsDepartmentList: () => [], confirmSettingsDepartmentDeletion: () => {}, readDepartmentSettingsResponse: async (url, init) => { const res = await syntheticFetch(url, init); return { status: res.status, data: await res.json() } } },
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
  await act(() => button('Commit receipt').click())
  assert.equal(settingsReads, 3)
  await act(() => pending.get(3).resolve(Response.json(payload('ADMIN'))))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN')
  await act(() => pending.get(2).resolve(Response.json(payload('OWNER'))))
  assert.equal(host.querySelector('[data-owner-role]').getAttribute('data-owner-role'), 'ADMIN')
  // A same-actor SDK recheck must retain the draft DOM but mask stale authority.
  const name = host.querySelector('input[placeholder="株式会社サンプル"]'); assert.ok(name)
  await act(() => setInput(name, 'Unsaved draft'))
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
  console.log(JSON.stringify({ passed: 2, settingsReads, oldGetCannotReinstateOwner: true, sameActorDraftElementRetained: true, maskedUntilFreshAuthority: true }))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { await act(() => root.unmount()); host.remove(); dom.window.close() })
