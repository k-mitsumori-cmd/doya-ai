// Actual Boundary + Tool/Report legacy mutators; synthetic actor, workspace and transport.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom'), { createRoot } = req('react-dom/client')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/mensetsu?org=B' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
let actor = 'actor-A', status = 'authenticated', pathname = '/mensetsu', search = '?org=B'
let selected = 'B', calls = [], writes = [], readCount = 0, sessionStatus = 'none', reportMode = 'evaluate', memberRows = [], workspaceEmpty = false, transportMode = false
const emptyWrites = []
const transportWrites = []
const notifications = []
let lastProof = null
window.confirm = () => true
const mediaCalls = []
dom.window.HTMLMediaElement.prototype.pause = function () { mediaCalls.push('pause') }
dom.window.HTMLMediaElement.prototype.load = function () { mediaCalls.push('load') }
const organization = { id: 'orgB', slug: 'B', name: 'Org B', role: 'owner', retentionDays: 180, recordAudio: false, discloseToCandidate: false }
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
  if (path === '/api/mensetsu/members') return Promise.resolve(Response.json({ myUserId: actor, myRole: 'owner', members: memberRows }))
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
  '@/components/ds': { EmptyState: no, ErrorNotice: no, Skeleton: no, ToolHero: no },
  // Owner transfer has a dedicated actual mounted fixture; this test owns Mensetsu's existing write boundary.
  '@/components/org/OwnerTransferPanel': { __esModule: true, default: no },
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
  await open(Tool, '/mensetsu')
  const job = document.querySelector('input[placeholder^="職種"]')
  assert.ok(job)
  await act(() => props(job).onChange({ target: { value: 'Engineer' } }))
  await act(() => button('質問セットを生成').click())
  assert.equal(writes.length, 1); assert.equal(writes[0].method, 'POST')
  await reprove(Tool)
  assert.ok(document.body.textContent.includes('前の操作の結果を確認できません'))
  assert.equal(job.value, 'Engineer', 'same-scope Tool input stays mounted')
  await act(() => button('質問セットを生成').click())
  assert.equal(writes.length, 1, 'unknown Tool POST cannot be repeated')
  await act(() => writes[0].held.resolve(Response.json({ template: { questions: [], criteria: [] } })))
  assert.equal(document.body.textContent.includes('作成しました'), false, 'old Tool acknowledgment is ignored')
  await close()

  for (const test of [
    { name: 'company', label: '会社情報を読み取る', prepare: () => {
      const input = document.querySelector('input[placeholder="https://example.co.jp"]')
      assert.ok(input); return act(() => props(input).onChange({ target: { value: 'https://company.invalid' } }))
    } },
    { name: 'template delete', label: '削除', prepare: async () => {} },
    { name: 'session issue', label: '面接URLを発行する', prepare: () => {
      const input = document.querySelector('input[placeholder="山田 太郎"]')
      assert.ok(input); return act(() => props(input).onChange({ target: { value: 'Candidate B' } }))
    } },
    { name: 'session close', label: '終了にする', session: 'pending', prepare: async () => {} },
    { name: 'session reopen', label: '受験可能に戻す', session: 'aborted', prepare: async () => {} },
    { name: 'session evaluate', label: '評価する', session: 'completed', prepare: async () => {} },
  ]) {
    sessionStatus = test.session || 'none'
    await open(Tool, '/mensetsu')
    await test.prepare()
    const initial = writes.length
    await act(() => { const target = button(test.label); assert.ok(target, test.name); target.click() })
    assert.equal(writes.length, initial + 1, `${test.name} starts one actual consumer request`)
    await reprove(Tool)
    assert.ok(document.body.textContent.includes('前の操作の結果を確認できません'), test.name)
    await act(() => { const target = button(test.label); assert.ok(target, test.name); target.click() })
    assert.equal(writes.length, initial + 1, `${test.name} cannot repeat an unknown write`)
    await act(() => writes[initial].held.resolve(Response.json({ status: 'completed', template: { questions: [], criteria: [] }, profile: {}, pageCount: 1, url: 'https://candidate.invalid' })))
    await close()
  }
  sessionStatus = 'none'
  await open(Tool, '/mensetsu')
  const currentJob = document.querySelector('input[placeholder^="職種"]')
  await act(() => props(currentJob).onChange({ target: { value: 'Current Engineer' } }))
  const currentWrite = writes.length
  await act(() => button('質問セットを生成').click())
  assert.equal(writes.length, currentWrite + 1)
  await act(() => writes[currentWrite].held.resolve(Response.json({ template: { questions: [], criteria: [] }, removedByGuardrail: [] })))
  assert.ok(document.body.textContent.includes('質問0問・評価軸0個を作成しました'), 'current Tool write success remains usable')
  assert.equal(document.body.textContent.includes('前の操作の結果を確認できません'), false)
  await close()

  await open(Report, '/mensetsu/sessions/session-B')
  await act(() => button('再評価する').click())
  const reportWrite = writes.length - 1
  assert.equal(writes[reportWrite].method, 'POST')
  await reprove(Report)
  assert.ok(document.body.textContent.includes('前の操作の結果を確認できません'))
  await act(() => button('再評価する').click())
  assert.equal(writes.length, reportWrite + 1, 'unknown Report POST cannot be repeated')
  await act(() => writes[reportWrite].held.resolve(Response.json({ status: 'evaluating' })))
  assert.equal(document.body.textContent.includes('登録しました'), false, 'old Report acknowledgment is ignored')
  await close()

  for (const test of [
    { mode: 'sample', label: '良い例として登録', prepare: async () => {
      await act(() => button('逐語ログ').click())
      await act(() => button('この回答を採点例にする').click())
      const choice = document.querySelector('select')
      assert.ok(choice)
      await act(() => props(choice).onChange({ target: { value: 'fairness' } }))
    } },
    { mode: 'hr', label: 'ドヤHRへ登録', prepare: async () => {} },
  ]) {
    reportMode = test.mode
    await open(Report, '/mensetsu/sessions/session-B')
    await test.prepare()
    const initial = writes.length
    await act(() => { const target = button(test.label); assert.ok(target, test.mode); target.click() })
    assert.equal(writes.length, initial + 1, `${test.mode} starts actual POST`)
    await reprove(Report)
    assert.ok(document.body.textContent.includes('前の操作の結果を確認できません'))
    await act(() => { const target = button(test.label); assert.ok(target, test.mode); target.click() })
    assert.equal(writes.length, initial + 1, `${test.mode} cannot repeat unknown POST`)
    await act(() => writes[initial].held.resolve(Response.json({ inviteUrl: 'https://stale.invalid', alreadyHandedOff: true })))
    await close()
  }
  reportMode = 'evaluate'

  reportMode = 'recording'
  await open(Report, '/mensetsu/sessions/session-B')
  await act(() => button('録音を再生').click())
  const firstAudio = document.querySelector('audio')
  assert.equal(firstAudio?.getAttribute('src'), 'https://recording.invalid/current')
  status = 'loading'; await render(Report)
  assert.ok(document.querySelector('[hidden][inert]'), 'recording Report is retained inert during reproof')
  assert.equal(firstAudio.getAttribute('src'), null, 'loading retires the signed recording URL immediately')
  assert.ok(mediaCalls.includes('pause') && mediaCalls.includes('load'), 'loading stops active media')
  status = 'authenticated'; await render(Report)
  await React.act(async () => { calls.at(-1).held.reject(new Error('workspace unavailable')); await new Promise(setImmediate) })
  assert.ok(document.body.textContent.includes('組織を確認できませんでした'), 'read failure remains unavailable, not old playback')
  await close()

  await open(Report, '/mensetsu/sessions/session-B')
  await act(() => button('録音を再生').click())
  const secondAudio = document.querySelector('audio')
  assert.equal(secondAudio?.getAttribute('src'), 'https://recording.invalid/current')
  await act(() => window.dispatchEvent(new dom.window.Event('pagehide')))
  assert.equal(secondAudio.getAttribute('src'), null, 'pagehide retires recording URL synchronously')
  await close()
  reportMode = 'evaluate'

  await open(Settings, '/mensetsu/settings')
  const email = document.querySelector('input[type="email"]')
  assert.ok(email)
  await act(() => props(email).onChange({ target: { value: 'invitee@example.invalid' } }))
  await act(() => button('招待する').click())
  const settingsWrite = writes.length - 1
  assert.equal(writes[settingsWrite].method, 'POST')
  await reprove(Settings)
  assert.ok(document.body.textContent.includes('前の変更結果を確認できません'))
  assert.equal(email.value, 'invitee@example.invalid', 'same-scope invite draft remains')
  await act(() => button('招待する').click())
  assert.equal(writes.length, settingsWrite + 1, 'unknown invite cannot be resent')
  await act(() => writes[settingsWrite].held.resolve(Response.json({ inviteUrl: 'https://invite.invalid/token' })))
  assert.equal(document.body.textContent.includes('invite.invalid'), false, 'late invite response cannot be adopted')
  await close()

  for (const test of [
    { name: 'settings patch', prepare: async () => {
      assert.ok(document.querySelector('input[type="checkbox"]'))
      return () => props(document.querySelector('input[type="checkbox"]')).onChange({ target: { checked: true } })
    } },
    { name: 'member remove', member: { id: 'member-other', name: 'Other', userId: 'other', role: 'member', status: 'ACTIVE', inviteEmail: null }, prepare: async () => {
      assert.ok(button('外す'))
      return () => button('外す').click()
    } },
  ]) {
    memberRows = test.member ? [test.member] : []
    await open(Settings, '/mensetsu/settings')
    const trigger = await test.prepare(), initial = writes.length
    await act(trigger)
    assert.equal(writes.length, initial + 1, `${test.name} starts an actual request`)
    await reprove(Settings)
    assert.ok(document.body.textContent.includes('前の変更結果を確認できません'))
    await act(trigger)
    assert.equal(writes.length, initial + 1, `${test.name} cannot repeat unknown write`)
    await act(() => writes[initial].held.resolve(Response.json({ success: true })))
    await close()
  }
  transportMode = true
  await open(Tool, '/mensetsu')
  const transportJob = document.querySelector('input[placeholder^="職種"]')
  await act(() => props(transportJob).onChange({ target: { value: 'Transport Engineer' } }))
  await withWriteDeadline(() => button('質問セットを生成').click())
  assert.equal(transportWrites.length, 1, 'Tool starts one actual sealed transport')
  assert.ok(document.body.textContent.includes('前の操作の結果を確認できません'), 'same-proof Tool header timeout is unknown')
  await act(() => button('質問セットを生成').click())
  assert.equal(transportWrites.length, 1, 'same-proof Tool retry makes no second write')
  await reprove(Tool)
  await act(() => button('質問セットを生成').click())
  assert.equal(transportWrites.length, 1, 'fresh same-actor proof cannot clear Tool unknown outcome')
  await act(() => transportWrites[0].held.resolve(Response.json({ template: { questions: [], criteria: [] } })))
  assert.equal(document.body.textContent.includes('作成しました'), false, 'late Tool header cannot be adopted')
  await close()

  await open(Report, '/mensetsu/sessions/session-B')
  const heldBody = deferred()
  await withWriteDeadline(() => button('再評価する').click(), async () => {
    assert.equal(transportWrites.length, 2)
    const response = Response.json({ status: 'evaluating' })
    response.arrayBuffer = () => heldBody.promise
    await act(() => transportWrites[1].held.resolve(response))
  })
  assert.ok(document.body.textContent.includes('前の操作の結果を確認できません'), 'same-proof Report body timeout is unknown')
  await act(() => button('再評価する').click())
  assert.equal(transportWrites.length, 2, 'same-proof Report retry makes no second write')
  await reprove(Report)
  await act(() => button('再評価する').click())
  assert.equal(transportWrites.length, 2, 'fresh same-actor proof cannot clear Report unknown outcome')
  await act(() => heldBody.resolve(new ArrayBuffer(0)))
  await close()

  await open(Settings, '/mensetsu/settings')
  const timeoutEmail = document.querySelector('input[type="email"]')
  await act(() => props(timeoutEmail).onChange({ target: { value: 'timed@example.invalid' } }))
  await withWriteDeadline(() => button('招待する').click())
  assert.equal(transportWrites.length, 3)
  assert.ok(document.body.textContent.includes('前の変更結果を確認できません'), 'same-proof Settings header timeout is unknown')
  await act(() => button('招待する').click())
  assert.equal(transportWrites.length, 3, 'same-proof Settings retry makes no second write')
  await reprove(Settings)
  await act(() => button('招待する').click())
  assert.equal(transportWrites.length, 3, 'fresh same-actor proof cannot clear Settings unknown outcome')
  await act(() => transportWrites[2].held.resolve(Response.json({ inviteUrl: 'https://late.invalid' })))
  await close()

  await open(Tool, '/mensetsu')
  const rejectedJob = document.querySelector('input[placeholder^="職種"]')
  await act(() => props(rejectedJob).onChange({ target: { value: 'Rejected Engineer' } }))
  await act(() => button('質問セットを生成').click())
  assert.equal(transportWrites.length, 4)
  await act(() => transportWrites[3].held.resolve(Response.json({ error: '入力を確認してください' }, { status: 400 })))
  assert.equal(document.body.textContent.includes('前の操作の結果を確認できません'), false, 'definitive HTTP rejection is not unknown')
  await act(() => button('質問セットを生成').click())
  assert.equal(transportWrites.length, 5, 'known 400 permits corrected retry')
  await act(() => transportWrites[4].held.resolve(Response.json({ error: '入力を確認してください' }, { status: 400 })))
  await close()
  transportMode = false
  workspaceEmpty = true; selected = ''; search = ''
  await open(Tool, '/mensetsu')
  const newOrgName = document.querySelector('input[placeholder="株式会社スリスタ"]')
  assert.ok(newOrgName, 'actual empty Tool offers organization creation')
  await act(() => props(newOrgName).onChange({ target: { value: 'New Organization' } }))
  await act(() => button('組織を作成').click())
  assert.equal(emptyWrites.length, 1, 'one actor-only create request')
  await reprove(Tool)
  assert.equal(newOrgName.value, 'New Organization', 'empty organization draft remains')
  assert.ok(document.body.textContent.includes('前の操作の結果を確認できません'), 'empty create has unknown outcome after reproof')
  await act(() => button('組織を作成').click())
  assert.equal(emptyWrites.length, 1, 'unknown create must not send a second POST')
  await act(() => emptyWrites[0].held.resolve(Response.json({ organization: { id: 'old', slug: 'old' } })))
  assert.equal(document.body.textContent.includes('作成しました'), false, 'retired create response is not adopted')
  await close()

  await open(Tool, '/mensetsu')
  const positiveOrgName = document.querySelector('input[placeholder="株式会社スリスタ"]')
  await act(() => props(positiveOrgName).onChange({ target: { value: 'Current Organization' } }))
  await act(() => button('組織を作成').click())
  assert.equal(emptyWrites.length, 2, 'current actor starts one organization create')
  workspaceEmpty = false
  const readsBeforeCreate = calls.length
  await act(() => emptyWrites[1].held.resolve(Response.json({ organization: { id: 'orgB', slug: 'B' } })))
  assert.equal(calls.length, readsBeforeCreate + 1, 'create acknowledgment triggers fresh actual membership read')
  await respondWorkspace(calls.length - 1)
  assert.ok(document.querySelector('input[placeholder^="職種"]'), 'only fresh membership proof enters the ready Tool')
  await close()

  workspaceEmpty = true; selected = ''
  await open(Tool, '/mensetsu')
  const unconfirmedOrgName = document.querySelector('input[placeholder="株式会社スリスタ"]')
  await act(() => props(unconfirmedOrgName).onChange({ target: { value: 'Unconfirmed Organization' } }))
  await act(() => button('組織を作成').click())
  assert.equal(emptyWrites.length, 3)
  await act(() => emptyWrites[2].held.resolve(Response.json({ organization: { id: 'unconfirmed', slug: 'unconfirmed' } })))
  await respondWorkspace(calls.length - 1)
  assert.ok(document.body.textContent.includes('前の操作の結果を確認できません'), '200 without fresh membership remains unknown')
  await act(() => button('組織を作成').click())
  assert.equal(emptyWrites.length, 3, 'unconfirmed membership cannot permit duplicate create')
  await close()

  await open(Tool, '/mensetsu')
  const deadlineOrgName = document.querySelector('input[placeholder="株式会社スリスタ"]')
  await act(() => props(deadlineOrgName).onChange({ target: { value: 'Timed Organization' } }))
  const realSetTimeout = global.setTimeout
  let fireDeadline = null
  global.setTimeout = (callback, delay, ...args) => {
    if (delay === 30_000) { fireDeadline = () => callback(...args); return 0 }
    return realSetTimeout(callback, delay, ...args)
  }
  try { await act(() => button('組織を作成').click()) } finally { global.setTimeout = realSetTimeout }
  assert.equal(emptyWrites.length, 4, 'finite empty create sends one request')
  assert.ok(fireDeadline, 'create installs finite transport deadline')
  await act(fireDeadline)
  assert.ok(document.body.textContent.includes('前の操作の結果を確認できません'), 'noncooperative timeout is unknown')
  await act(() => button('組織を作成').click())
  assert.equal(emptyWrites.length, 4, 'timed-out create cannot be replayed')
  const readBeforeLateCreate = calls.length
  await act(() => emptyWrites[3].held.resolve(Response.json({ organization: { id: 'late', slug: 'late' } })))
  assert.equal(calls.length, readBeforeLateCreate, 'late create body cannot trigger membership adoption')
  await close()

  await open(Tool, '/mensetsu')
  const actorOrgName = document.querySelector('input[placeholder="株式会社スリスタ"]')
  await act(() => props(actorOrgName).onChange({ target: { value: 'Retired Organization' } }))
  await act(() => button('組織を作成').click())
  assert.equal(emptyWrites.length, 5)
  actor = 'actor-B'
  await render(Tool)
  assert.equal(document.querySelector('input[placeholder="株式会社スリスタ"]'), null, 'old actor empty form unmounts')
  await respondWorkspace(calls.length - 1)
  await act(() => emptyWrites[4].held.resolve(Response.json({ organization: { id: 'old', slug: 'old' } })))
  assert.equal(emptyWrites.length, 5, 'old actor acknowledgment cannot start a new request')
  assert.equal(document.body.textContent.includes('Retired Organization'), false, 'old actor draft is not shown to next actor')
  await close()

  workspaceEmpty = false; selected = 'B'; sessionStatus = 'none'
  const clipboardCalls = [], copyTimers = []
  let clipboardResult = () => Promise.resolve()
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: value => {
    clipboardCalls.push(value); return clipboardResult()
  } } } })
  const originalWindowTimer = window.setTimeout.bind(window)
  window.setTimeout = (callback, delay, ...args) => {
    if (delay === 2000) { copyTimers.push(() => callback(...args)); return copyTimers.length }
    return originalWindowTimer(callback, delay, ...args)
  }
  await open(Tool, '/mensetsu')
  const candidate = document.querySelector('input[placeholder="山田 太郎"]')
  assert.ok(candidate)
  await act(() => props(candidate).onChange({ target: { value: 'Candidate B' } }))
  const issuedWrite = writes.length
  await act(() => button('面接URLを発行する').click())
  assert.equal(writes.length, issuedWrite + 1)
  await act(() => writes[issuedWrite].held.resolve(Response.json({ url: 'https://candidate.invalid/issued' })))
  assert.ok(button('URLをコピーする'), 'actual Tool renders issued URL copy control')
  const staleCopy = props(button('URLをコピーする')).onClick
  await act(staleCopy)
  assert.deepEqual(clipboardCalls, ['https://candidate.invalid/issued'], 'current issued URL is copied once')
  assert.ok(button('コピーしました'), 'current clipboard success is visible')
  assert.equal(copyTimers.length, 1, 'current copy installs one bounded confirmation timer')

  status = 'loading'; await render(Tool)
  assert.ok(document.querySelector('[hidden][inert]'), 'retired Tool remains inert while reproof is pending')
  await act(staleCopy)
  assert.equal(clipboardCalls.length, 1, 'retired issued copy never writes to clipboard')
  status = 'authenticated'; await render(Tool); await respondWorkspace(calls.length - 1)
  assert.ok(button('URLをコピーする'), 'fresh proof clears an old copy confirmation')
  const heldClipboard = deferred()
  clipboardResult = () => heldClipboard.promise
  await act(() => button('URLをコピーする').click())
  assert.equal(clipboardCalls.length, 2, 'new current proof can start a copy')
  assert.equal(copyTimers.length, 1, 'pending clipboard cannot claim success or install timer')
  await reprove(Tool)
  await act(() => heldClipboard.resolve())
  assert.ok(button('URLをコピーする'), 'late clipboard completion cannot adopt old proof')
  assert.equal(copyTimers.length, 1, 'late clipboard completion installs no old timer')

  clipboardResult = () => Promise.resolve()
  await act(() => button('URLをコピーする').click())
  assert.ok(button('コピーしました'), 'fresh current proof can copy normally')
  assert.equal(copyTimers.length, 2)
  await act(copyTimers[0]); assert.ok(button('コピーしました'), 'old proof timer cannot clear fresh confirmation')
  await act(copyTimers[1]); assert.ok(button('URLをコピーする'), 'fresh current timer clears confirmation')
  clipboardResult = () => Promise.reject(new Error('synthetic clipboard denied'))
  await act(() => button('URLをコピーする').click())
  assert.ok(button('URLをコピーする'), 'failed clipboard never reports success')
  assert.equal(copyTimers.length, 2, 'failed clipboard has no success timer')
  navigator.clipboard = undefined
  await act(() => button('URLをコピーする').click())
  assert.ok(button('URLをコピーする'), 'unavailable clipboard never reports success')
  assert.equal(copyTimers.length, 2, 'unavailable clipboard has no success timer')
  await close()

  for (const outcome of ['resolve', 'reject']) {
    navigator.clipboard = { writeText: value => { clipboardCalls.push(value); return pendingClipboard.promise } }
    await open(Tool, '/mensetsu')
    const nextCandidate = document.querySelector('input[placeholder="山田 太郎"]')
    await act(() => props(nextCandidate).onChange({ target: { value: 'Unmount Candidate' } }))
    const nextIssue = writes.length
    await act(() => button('面接URLを発行する').click())
    await act(() => writes[nextIssue].held.resolve(Response.json({ url: 'https://candidate.invalid/unmount' })))
    const pendingClipboard = deferred()
    const proofAtCopy = lastProof
    await act(() => button('URLをコピーする').click())
    const timersAtUnmount = copyTimers.length, noticesAtUnmount = notifications.length
    await act(() => view.render(React.createElement(Boundary, null, React.createElement('div', { 'data-testid': 'replacement' }, 'Other child'))))
    assert.equal(proofAtCopy.current(), true, 'Boundary proof remains current after Tool child unmount')
    assert.equal(button('URLをコピーする'), undefined, 'Tool child is unmounted')
    if (outcome === 'resolve') await act(() => pendingClipboard.resolve())
    else await act(() => pendingClipboard.reject(new Error('synthetic clipboard denied after unmount')))
    assert.equal(copyTimers.length, timersAtUnmount, 'unmounted Tool cannot install a delayed success timer')
    assert.equal(notifications.length, noticesAtUnmount, 'unmounted Tool cannot notify from late clipboard result')
    await close()
  }
  window.setTimeout = originalWindowTimer
  dom.window.close()
  console.log('mensetsu actual Boundary+Tool7+empty/Report3/Settings3: pending write, same-actor reproof, unknown/no-repeat/late-ack/current membership PASS', JSON.stringify({ reads: readCount, writes: writes.length, emptyWrites: emptyWrites.length }))
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
