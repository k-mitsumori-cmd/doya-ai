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
function deferred() { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const pending = new Map(), requests = []
let pendingInvite = null, pendingSave = null, pendingMember = null, pendingDelete = null, pendingDepartmentCreate = null
const ownerServer = { phase: 'missing', input: null }
let settingsReads = 0
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
  if (url === '/api/hr/departments' && init.method === 'POST') return pendingDepartmentCreate ? pendingDepartmentCreate.promise : Response.json({ success: true })
  if (String(url).startsWith('/api/hr/department-operation?')) {
    const query = new URL(url, 'https://example.invalid').searchParams
    return Response.json({ success: true, organizationId: 'org', operationId: query.get('operationId'), state: 'created', department: { id: 'new-dept', name: 'Fresh Team', code: null, sortOrder: 0 } })
  }
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
const departmentHelper = compile('src/lib/hr/department-settings-client.ts')
const creation = compile('src/lib/hr/use-department-creation.ts', { react: React, '@/components/hr/HrOrganizationScope': { useHrOrganizationRequest: () => ({ request: syntheticFetch }) }, '@/lib/hr/department-settings-client': departmentHelper }).useHrDepartmentCreation
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
  '@/lib/hr/department-settings-client': departmentHelper,
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
  // Both writes remain unresolved when SDK authentication is rechecked. Their old promises cannot own fresh busy state.
  pendingInvite = deferred(); pendingSave = deferred()
  await act(() => setInput(host.querySelector('input[placeholder="メールアドレスで招待"]'), 'pending@example.invalid'))
  const oldCount = requests.length
  await act(() => { button('招待').click(); button('保存する').click() })
  assert.equal(requests.slice(oldCount).filter(row => row.method === 'POST' || row.method === 'PUT').length, 2)
  assert.equal(button('送信中...').disabled, true)
  assert.equal(button('保存中...').disabled, true)
  await act(() => setAuth('loading'))
  await act(() => setAuth('authenticated'))
  assert.ok(host.textContent.includes('前回の変更結果を確認できませんでした。'))
  assert.equal(button('招待').disabled, true)
  assert.equal(button('保存する').disabled, true)
  const afterReproofCount = requests.length
  await act(() => { pendingInvite.resolve(Response.json({ success: true, emailSent: false, inviteUrl: 'https://example.invalid/late' })); pendingSave.resolve(Response.json({ success: true })) })
  assert.equal(requests.length, afterReproofCount)
  assert.ok(host.textContent.includes('前回の変更結果を確認できませんでした。'))
  assert.equal(button('招待').disabled, true)
  assert.equal(button('保存する').disabled, true)
  // A member role update and department deletion share the same proof lifetime, but each has a separate unknown result.
  pendingMember = deferred(); pendingDelete = deferred()
  const roleSelect = [...host.querySelectorAll('select')].find(item => item.value === 'MEMBER')
  assert.ok(roleSelect)
  const memberBefore = requests.filter(row => row.url === '/api/hr/organization/members/target' && row.method === 'PATCH').length
  const deleteBefore = requests.filter(row => row.url === '/api/hr/departments/dept' && row.method === 'DELETE').length
  await act(() => {
    roleSelect[Object.keys(roleSelect).find(key => key.startsWith('__reactProps$'))].onChange({ target: { value: 'ADMIN' } })
    host.querySelector('button[title="削除"]').click()
  })
  assert.equal(requests.filter(row => row.url === '/api/hr/organization/members/target' && row.method === 'PATCH').length, memberBefore + 1)
  assert.equal(requests.filter(row => row.url === '/api/hr/departments/dept' && row.method === 'DELETE').length, deleteBefore + 1)
  await act(() => setAuth('loading'))
  await act(() => setAuth('authenticated'))
  assert.ok(host.textContent.includes('前回の変更結果を確認できませんでした。'))
  assert.ok(host.textContent.includes('前回の部署削除結果を確認できません。'))
  const afterMember = requests.filter(row => row.url === '/api/hr/organization/members/target' && row.method === 'PATCH').length
  const afterDelete = requests.filter(row => row.url === '/api/hr/departments/dept' && row.method === 'DELETE').length
  await act(() => { pendingMember.resolve(Response.json({ success: true })); pendingDelete.resolve(Response.json({ success: true })) })
  const newSelect = [...host.querySelectorAll('select')].find(item => item.value === 'MEMBER')
  await act(() => {
    newSelect[Object.keys(newSelect).find(key => key.startsWith('__reactProps$'))].onChange({ target: { value: 'ADMIN' } })
    host.querySelector('button[title="削除"]').click()
  })
  assert.equal(requests.filter(row => row.url === '/api/hr/organization/members/target' && row.method === 'PATCH').length, afterMember)
  assert.equal(requests.filter(row => row.url === '/api/hr/departments/dept' && row.method === 'DELETE').length, afterDelete)
  // The actual durable department hook preserves the operation handle across SDK revalidation.
  pendingDepartmentCreate = deferred()
  await act(() => button('部署一覧を再取得する').click())
  assert.equal(button('部署を追加').disabled, false)
  await act(() => button('部署を追加').click())
  await act(() => setInput(host.querySelector('input[placeholder="例: 営業部"]'), 'Fresh Team'))
  const departmentPostsBefore = requests.filter(row => row.url === '/api/hr/departments' && row.method === 'POST').length
  await act(() => button('作成').click())
  const departmentPosts = requests.filter(row => row.url === '/api/hr/departments' && row.method === 'POST').length
  assert.equal(departmentPosts, departmentPostsBefore + 1)
  const intentKey = [...Array(window.localStorage.length)].map((_, index) => window.localStorage.key(index)).find(key => key.startsWith('hr-department-create-intent:v1:'))
  assert.ok(intentKey)
  const savedOperation = JSON.parse(window.localStorage.getItem(intentKey))
  assert.equal(savedOperation.input.name, 'Fresh Team')
  await act(() => setAuth('loading'))
  await act(() => setAuth('authenticated'))
  assert.equal(requests.filter(row => row.url === '/api/hr/departments' && row.method === 'POST').length, departmentPosts)
  await act(() => pendingDepartmentCreate.resolve(Response.json({ success: true, organizationId: 'org', operationId: savedOperation.operationId, state: 'created', department: { id: 'new-dept', name: 'Fresh Team', code: null, sortOrder: 0 } })))
  assert.equal(window.localStorage.getItem(intentKey) !== null, true)
  assert.equal(requests.filter(row => row.url === '/api/hr/departments' && row.method === 'POST').length, departmentPosts)
  await act(() => button('キャンセル').click())
  await act(() => button('作成結果を確認する').click())
  assert.ok(host.textContent.includes('部署は保存済みです'))
  assert.equal(requests.filter(row => row.url === '/api/hr/departments' && row.method === 'POST').length, departmentPosts)
  assert.equal(JSON.parse(window.localStorage.getItem(intentKey)).operationId, savedOperation.operationId)
  console.log(JSON.stringify({ passed: 6, settingsReads, pendingInviteSaveMemberDeleteReproofRetiresBusyButBlocksRepeat: true, departmentDurableSameIdStatusRecoveryNoSecondPost: true }))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { await act(() => root.unmount()); host.remove(); dom.window.close() })
