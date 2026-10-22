// Actual Boundary + Tool/Report legacy mutators; synthetic actor, workspace and transport.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom'), { createRoot } = req('react-dom/client')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/mensetsu?org=B' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.crypto = require('node:crypto').webcrypto; global.IS_REACT_ACT_ENVIRONMENT = true
dom.window.navigator.locks = { request: async (_name, _options, work) => work() }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
let actor = 'actor-A', status = 'authenticated', pathname = '/mensetsu', search = '?org=B'
let selected = 'B', calls = [], writes = [], readCount = 0, sessionStatus = 'none', reportMode = 'evaluate', memberRows = [], workspaceEmpty = false, transportMode = false
const emptyWrites = []
const transportWrites = []
const notifications = []
let lastProof = null, ownerPosts = 0, ownerStatusReads = 0, memberRole = 'owner'
window.confirm = () => true
const mediaCalls = []
dom.window.HTMLMediaElement.prototype.pause = function () { mediaCalls.push('pause') }
dom.window.HTMLMediaElement.prototype.load = function () { mediaCalls.push('load') }
let organization = { id: 'orgB', slug: 'B', name: 'Org B', role: 'owner', retentionDays: 180, recordAudio: false, discloseToCandidate: false }
const template = { id: 'template-B', name: 'Template B', jobTitle: 'Engineer', status: 'draft', durationMin: 10,
  questions: [], criteria: [], _count: { questions: 0, criteria: 0, sessions: 0 } }
const report = { session: { id: 'session-B', candidateName: 'Candidate B', status: 'evaluating',
  startedAt: '2020-01-01T00:00:00Z', endedAt: '2020-01-01T00:10:00Z', updatedAt: '2020-01-01T00:20:00Z',
  evaluatedAt: '2020-01-01T00:20:00Z', template, turns: [], scores: [], recordingPath: null, verdict: null }, average: null }
const sessionPage = () => {
  const sessions = sessionStatus === 'none' ? [] : [{ id: 'session-B', token: 'token-B', status: sessionStatus,
    candidateName: 'Candidate B', template: { jobTitle: 'Engineer' }, expiresAt: '2030-01-01T00:00:00Z', verdict: null }]
  return { sessions, total: sessions.length, nextCursor: null }
}
const router = { push: () => {}, replace: () => {} }
const readWorkspace = (expected, request, signal, service) => {
  const held = deferred(); calls.push({ expected, request, signal, service, held }); return held.promise
}
const respondWorkspace = index => React.act(async () => { calls[index].held.resolve({ service: 'mensetsu', actorId: actor,
  memberships: workspaceEmpty ? [] : [organization], current: workspaceEmpty ? null : organization }); await new Promise(setImmediate) })
global.fetch = async (target, init) => {
  if (String(target).startsWith('/api/mensetsu/owner-transfer')) {
    const query = new URL(String(target), 'https://example.invalid').searchParams
    if (query.get('action') === 'candidates') return Response.json({ actorId: actor, service: 'mensetsu', organization: { id: 'orgB', slug: 'B', name: 'Org B' }, owner: { memberId: 'self', userId: actor }, candidates: [{ memberId: 'target', userId: 'successor', name: '後任', role: 'member', plan: 'LIGHT' }] })
    if (query.get('action') === 'status') { ownerStatusReads++; return Response.json({ actorId: actor, service: 'mensetsu', organizationId: 'orgB', operationId: query.get('operationId'), phase: 'committed', input: { expectedOwnerMemberId: 'self', targetMemberId: 'target', targetUserId: 'successor', targetRole: 'member', targetPlan: 'LIGHT' }, createdAt: new Date().toISOString() }) }
    const body = JSON.parse(init.body); assert.equal(body.action, 'transfer'); ownerPosts++; memberRole = 'admin'; organization = { ...organization, role: 'admin' };
    return Response.json({ actorId: actor, service: 'mensetsu', organizationId: 'orgB', operationId: body.operationId, phase: 'committed', input: body.input, createdAt: new Date().toISOString() })
  }
  if (transportMode && String(target).startsWith('/api/mensetsu/')) {
    const url = new URL(String(target), 'https://example.invalid')
    assert.equal(url.searchParams.get('org'), 'B', 'actual staff transport seals the organization')
    const held = deferred(); transportWrites.push({ target: String(target), init, held }); return held.promise
  }
  assert.equal(target, '/api/mensetsu/organizations', 'empty onboarding is the sole unbound route')
  if ((init?.method || 'GET') === 'GET') return Response.json({ current: null })
  assert.equal(init?.method, 'POST')
  const held = deferred(); emptyWrites.push({ target, init, held, actor }); return held.promise
}
const request = (proof, path, init) => {
  assert.equal(proof.current(), true, 'transport requires the captured current proof')
  assert.equal(proof.organization.id, 'orgB')
  lastProof = proof
  const method = init?.method || 'GET'
  if (method !== 'GET') {
    if (transportMode) return load('src/lib/mensetsu/staff-request-client.ts').requestMensetsuStaff(proof, path, init)
    const held = deferred(); writes.push({ path, method, held, proof }); return held.promise
  }
  readCount++
  if (path === '/api/mensetsu/organizations') return Promise.resolve(Response.json({ current: organization }))
  if (path === '/api/mensetsu/templates') return Promise.resolve(Response.json({ templates: [template] }))
  if (path === '/api/mensetsu/company') return Promise.resolve(Response.json({ profile: null }))
  if (path === '/api/mensetsu/members') return Promise.resolve(Response.json({ myUserId: actor, myRole: memberRole, members: memberRows }))
  if (path === '/api/mensetsu/sessions/session-B/recording') return Promise.resolve(Response.json({ url: 'https://recording.invalid/current', expiresInSec: 900 }))
  if (path === '/api/mensetsu/sessions/session-B') return Promise.resolve(Response.json(reportMode === 'sample'
    ? { ...report, session: { ...report.session, status: 'evaluated', template: { ...template, criteria: [{ id: 'criterion-1', key: 'fairness', name: 'Fairness' }] }, turns: [{ id: 'turn-1', speaker: 'interviewer', text: 'Question' }, { id: 'turn-2', speaker: 'candidate', text: 'Answer' }] } }
    : reportMode === 'hr' ? { ...report, session: { ...report.session, status: 'evaluated' } }
      : reportMode === 'recording' ? { ...report, session: { ...report.session, status: 'evaluated', recordingPath: 'synthetic-recording' } } : report))
  if (path === '/api/mensetsu/sessions/session-B/hr-handoff') return Promise.resolve(Response.json(reportMode === 'hr'
    ? { canHandoff: true, organizations: [{ id: 'hr-org', name: 'HR destination' }], alreadyHandedOff: false }
    : { canHandoff: false, organizations: [] }))
  throw Error('Unexpected staff read ' + path)
}
const leaves = require('./caller14-leaf-bridge.cjs')(root, React, ts)
const cache = new Map()
const no = () => null
const mocks = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
  '@/components/SignInReturnLink': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', { href: '/auth/signin', ...props }, children) },
  'next-auth/react': { useSession: () => ({ status, data: status === 'authenticated' ? { user: { id: actor } } : null }) },
  'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search), useRouter: () => router, useParams: () => ({ id: 'session-B' }) },
  '@/components/org/OrgSwitcher': { getSelectedOrg: () => selected, selectOrganization: (_service, slug) => { selected = slug } },
  '@/lib/ui/guest-path': { isGuestPath: () => false },
  '@/lib/organization-workspace-client': {
    readOrganizationWorkspace: readWorkspace,
    selectedWorkspaceFromUrl: (raw, stored) => { const value = load('src/lib/organization-workspace-selection.ts').organizationSelection(raw); return value.kind !== 'absent' ? value : stored ? { kind: 'selected', slug: stored } : value },
    WorkspaceReadError: class WorkspaceReadError extends Error { constructor(code, kind) { super(); this.status = code; this.kind = kind } },
  },
  '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager: { inspectStored() {} }, snapshot: { phase: 'idle', handle: null } }) },
  '@/lib/checkout-recovery-client': { checkoutStoredIntent: () => null },
  '@/components/mensetsu/ui-next': { PageTitle: ({ children, ...props }) => React.createElement('h1', props, children), useToolUiNext: () => false },
  '@/components/ds': { ...leaves.ds, EmptyState: no, ErrorNotice: no, Skeleton: no, ToolHero: no },
  '@/components/mensetsu/states': leaves.mensetsuStates(), '@/components/shell/icons': { ShellIcon: no },
  '@/components/LoadingProgress': { __esModule: true, default: no }, './Lp': { __esModule: true, default: no },
  '@/lib/ui/notify': { notifyError: (setter, message) => { notifications.push(message); setter(message) } },
  '@/lib/mensetsu/types': { EVALUATION_STALE_MS: 1000 },
  '@/lib/mensetsu/session-pages': { fetchMensetsuSessionPage: async proof => {
    assert.equal(proof.current(), true); return sessionPage()
  }, appendMensetsuSessionPage: (_existing, page) => page.sessions },
  '@/lib/mensetsu/staff-request-client': { requestMensetsuStaff: request, readMensetsuStaffJson: async (proof, target) => (await request(proof, target)).json() },
}
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports
  const filename = path.join(root, relative), mod = new Module(filename); mod.filename = filename; cache.set(relative, mod)
  mod.require = id => {
    if (id in mocks) return mocks[id]
    if (id === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    if (id === '@/lib/mensetsu/checkout-origin-hint') return load('src/lib/mensetsu/checkout-origin-hint.ts')
    if (id === '@/components/mensetsu/MensetsuWorkspaceBoundary' || id === './MensetsuWorkspaceBoundary') return load('src/components/mensetsu/MensetsuWorkspaceBoundary.tsx')
    if (id === '@/components/mensetsu/useMensetsuRequest') return load('src/components/mensetsu/useMensetsuRequest.ts')
    if (id === '@/components/mensetsu/useMensetsuOperation') return load('src/components/mensetsu/useMensetsuOperation.ts')
    if (id === '@/components/org/OwnerTransferPanel') return load('src/components/org/OwnerTransferPanel.tsx')
    if (id === '@/lib/use-owner-transfer') return load('src/lib/use-owner-transfer.ts')
    if (id === '@/lib/owner-transfer-client' || id === './owner-transfer-client') return load('src/lib/owner-transfer-client.ts')
    throw Error('Unmocked ' + id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return mod.exports
}
const Boundary = load('src/components/mensetsu/MensetsuWorkspaceBoundary.tsx').MensetsuWorkspaceBoundary
const Tool = load('src/app/(shell)/mensetsu/Tool.tsx').default
const Report = load('src/app/(shell)/mensetsu/sessions/[id]/page.tsx').default
const Settings = load('src/app/(shell)/mensetsu/settings/page.tsx').default
let view = null
const act = fn => React.act(async () => { await fn(); for (let n = 0; n < 5; n++) await new Promise(setImmediate) })
const render = Component => act(() => view.render(React.createElement(Boundary, null, React.createElement(Component))))
const button = label => [...document.querySelectorAll('button')].find(value => value.textContent.includes(label))
const props = element => element[Object.keys(element).find(key => key.startsWith('__reactProps$'))]
async function withWriteDeadline(start, afterStart = async () => {}) {
  const native = global.setTimeout
  let fire = null
  global.setTimeout = (callback, delay, ...args) => {
    if (delay === 310_000) { fire = () => callback(...args); return 0 }
    return native(callback, delay, ...args)
  }
  try {
    await act(start)
    assert.ok(fire, 'actual staff transport installed the write deadline')
    await afterStart()
    await act(fire)
  } finally { global.setTimeout = native }
}
async function open(Component, page) {
  pathname = page; search = workspaceEmpty ? '' : '?org=B'; status = 'authenticated'; actor = 'actor-A'
  window.history.replaceState(null, '', page + search)
  view = createRoot(document.getElementById('root'))
  await render(Component)
  await respondWorkspace(calls.length - 1)
}
async function reprove(Component) {
  status = 'loading'; await render(Component)
  assert.ok(document.querySelector('[hidden][inert]'), 'pending view remains mounted but inert')
  status = 'authenticated'; await render(Component)
  await respondWorkspace(calls.length - 1)
}
async function close() { await act(() => view.unmount()); document.getElementById('root').innerHTML = '' }

;(async () => {
  await open(Settings, '/mensetsu/settings')
  const email = document.querySelector('input[placeholder="招待する方のメールアドレス"]')
  assert(email)
  await act(() => props(email).onChange({ target: { value: 'dirty@example.invalid' } }))
  assert(button('この方へ引き継ぐ'))
  await act(() => button('この方へ引き継ぐ').click())
  assert.equal(ownerPosts, 1)
  assert.equal(calls.length, 2, 'committed receipt triggers fresh workspace read')
  assert(document.querySelector('[hidden][inert]'), 'old owner subtree is hidden during reproof')
  assert.equal(email.value, 'dirty@example.invalid', 'invite draft stays in retained subtree')
  assert.equal(window.localStorage.length, 1)
  await act(() => calls[1].held.reject(new Error('synthetic workspace unavailable')))
  assert(document.querySelector('[hidden][inert]'), 'failed read does not reveal stale owner actions')
  assert.equal(email.value, 'dirty@example.invalid')
  assert(button('再読み込みする'), 'failed fresh role read offers explicit retry')
  await act(() => button('再読み込みする').click())
  assert.equal(calls.length, 3)
  await respondWorkspace(2)
  assert.equal(email.value, 'dirty@example.invalid', 'fresh admin proof retains invite input')
  assert.equal(button('この方へ引き継ぐ'), undefined, 'fresh role masks owner action')
  assert(button('引継ぎ状況を確認'), 'saved receipt is recovered under fresh proof')
  await act(() => button('引継ぎ状況を確認').click())
  assert.equal(ownerPosts, 1)
  assert.equal(ownerStatusReads >= 1, true)
  assert.equal(window.localStorage.length, 1)
  await close(); dom.window.close()
  console.log('owner transfer Mensetsu actual Boundary+Settings+Panel: retained invite draft, hidden old role, fresh admin, durable status, POST1 PASS')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
