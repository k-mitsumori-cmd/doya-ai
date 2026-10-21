process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom'), { createRoot } = req('react-dom/client')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/mensetsu/sessions/session-B?org=B' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
let actor = 'actor-A', status = 'authenticated', pathname = '/mensetsu/templates/template-B', search = '?org=B', remembered = null
let snapshot = { phase: 'idle', handle: null }, calls = [], pushes = [], replaces = [], mounts = 0
const router = { push: href => pushes.push(href), replace: href => replaces.push(href) }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const writes = []
let transportMode = false
const transportWrites = []
global.fetch = async (target, init) => {
  assert.equal(new URL(String(target), 'https://example.invalid').searchParams.get('org'), 'B')
  const held = deferred(); transportWrites.push({ target, init, held }); return held.promise
}
const read = (expected, selected, signal, service) => {
  if (calls.length > 60) throw Error('unexpected workspace read loop')
  const held = deferred(); calls.push({ expected, selected, signal, service, held }); return held.promise
}
const cache = new Map()
const mocks = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
  '@/components/SignInReturnLink': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', { ...props, href: '/auth/signin' }, children) },
  'next-auth/react': { useSession: () => ({ status, data: status === 'authenticated' ? { user: { id: actor } } : null }) },
  'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search), useRouter: () => router, useParams: () => ({ id: 'template-B' }) },
  '@/components/org/OrgSwitcher': { getSelectedOrg: () => remembered, selectOrganization: (service, slug) => { assert.equal(service, 'mensetsu'); remembered = slug } },
  '@/lib/ui/guest-path': { isGuestPath: value => /^\/mensetsu\/(?:live|invite)\//.test(value) },
  '@/lib/organization-workspace-client': {
    readOrganizationWorkspace: read,
    selectedWorkspaceFromUrl: (raw, stored) => { const selection = load('src/lib/organization-workspace-selection.ts').organizationSelection(raw); return selection.kind !== 'absent' ? selection : stored ? { kind: 'selected', slug: stored } : selection },
    WorkspaceReadError: class WorkspaceReadError extends Error { constructor(status, kind) { super(); this.status = status; this.kind = kind } },
  },
  '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager: { inspectStored() {} }, snapshot }) },
  '@/lib/checkout-recovery-client': { checkoutStoredIntent: () => ({ serviceId: 'mensetsu', organization: null }) },
  '@/components/mensetsu/ui-next': { PageTitle: ({ children, ...props }) => React.createElement('h1', props, children) },
  '@/lib/ui/notify': { notifyError: (setter, message) => setter(message) },
}
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports
  const filename = path.join(root, relative), m = new Module(filename)
  cache.set(relative, m)
  m.require = id => {
    if (id in mocks) return mocks[id]
    if (id === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    if (id === '@/lib/mensetsu/checkout-origin-hint') return load('src/lib/mensetsu/checkout-origin-hint.ts')
    if (id === '@/components/mensetsu/MensetsuWorkspaceBoundary') return load('src/components/mensetsu/MensetsuWorkspaceBoundary.tsx')
    if (id === './MensetsuWorkspaceBoundary') return load('src/components/mensetsu/MensetsuWorkspaceBoundary.tsx')
    if (id === '@/components/mensetsu/useMensetsuRequest') return load('src/components/mensetsu/useMensetsuRequest.ts')
    if (id === '@/components/mensetsu/useMensetsuOperation') return load('src/components/mensetsu/useMensetsuOperation.ts')
    if (id === '@/lib/mensetsu/staff-request-client') return { requestMensetsuStaff: (proof, path, init) => {
      assert.equal(proof.current(), true)
      assert.equal(path, '/api/mensetsu/templates/template-B')
      if (init?.method === 'PATCH') {
        if (transportMode) return load('src/lib/mensetsu/staff-request-client.ts').requestMensetsuStaff(proof, path, init)
        const held = deferred(); writes.push({ proof, held }); return held.promise
      }
      assert.equal(init?.method || 'GET', 'GET')
      return Promise.resolve(Response.json({ template: { id: 'template-B', name: 'Original B', jobTitle: 'Engineer', status: 'draft', intro: '', closing: '', questions: [], criteria: [] } }))
    } }
    throw Error('Unmocked ' + id)
  }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return m.exports
}
const boundary = load('src/components/mensetsu/MensetsuWorkspaceBoundary.tsx')
const Template = load('src/app/(shell)/mensetsu/templates/[id]/page.tsx').default
const orgs = [{ id: 'orgA', slug: 'A', name: 'Org A', role: 'owner' }, { id: 'orgB', slug: 'B', name: 'Org B', role: 'member' }]
const payload = (user, slug) => ({ service: 'mensetsu', actorId: user, memberships: orgs, current: orgs.find(o => o.slug === slug) || null })
function Probe() {
  const workspace = boundary.useOptionalMensetsuWorkspace()
  if (!workspace) return React.createElement('div', { 'data-guest': 'true' })
  const { scope, switchTo } = workspace
  const mount = React.useRef(0)
  if (!mount.current) mount.current = ++mounts
  return React.createElement('div', { 'data-kind': scope.kind, 'data-mount': mount.current, 'data-actor': scope.kind === 'ready' ? scope.proof.actorId : '', 'data-org': scope.kind === 'ready' ? scope.proof.organization.slug : '' },
    scope.kind === 'ready' ? React.createElement('button', { onClick: () => switchTo('A') }, scope.proof.organization.slug) : '')
}
const view = createRoot(document.getElementById('root'))
const render = () => React.act(async () => { view.render(React.createElement(boundary.MensetsuWorkspaceBoundary, null, React.createElement(Template))); await new Promise(setImmediate); await new Promise(setImmediate) })
const settle = (i, value) => React.act(async () => { calls[i].held.resolve(value); await new Promise(setImmediate) })
const navigate = async (path, query) => { pathname = path; search = query; window.history.replaceState(null, '', path + query); await render() }
;(async () => {
  await render(); assert.deepEqual(calls[0].selected, { kind: 'selected', slug: 'B' }); assert.equal(calls[0].service, 'mensetsu')
  await settle(0, payload(actor, 'B'))
  const name = [...document.querySelectorAll('input')].find(input => input.value === 'Original B')
  assert.ok(name, 'actual Template should mount after selected-org proof')
  const props = element => element[Object.keys(element).find(key => key.startsWith('__reactProps$'))]
  await React.act(async () => props(name).onChange({ target: { value: 'Unsaved B' } }))
  const edited = [...document.querySelectorAll('input')].find(input => input.value === 'Unsaved B')
  assert.ok(edited, 'actual Template draft edit')
  status = 'loading'; await render()
  assert.equal(document.body.contains(edited) && edited.closest('[hidden]') !== null, true, 'same actor SDK loading must retain the actual draft behind a mask')
  status = 'authenticated'; await render(); await settle(calls.length - 1, payload(actor, 'B'))
  assert.equal(document.body.contains(edited) && edited.value === 'Unsaved B', true, 'fresh proof must keep the same draft node and value')
  assert.equal(edited.closest('[inert]'), null, 'fresh proof releases the retained input for interaction')
  status = 'loading'; await render()
  status = 'authenticated'; await render()
  await React.act(async () => { calls.at(-1).held.reject(new mocks['@/lib/organization-workspace-client'].WorkspaceReadError(503, 'unavailable')); await new Promise(setImmediate) })
  assert.equal(document.body.contains(edited) && edited.closest('[hidden]') !== null, true, 'same-scope unavailable keeps the draft hidden')
  assert.ok(document.querySelector('[role="alert"] button')?.textContent.includes('再読み込み'))
  await React.act(async () => document.querySelector('[role="alert"] button').click())
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.equal(document.body.contains(edited) && edited.value === 'Unsaved B', true, 'retry restores the same draft')
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  assert.equal(document.body.contains(edited) && edited.closest('[hidden][inert]') !== null, true, 'pageshow without pagehide keeps dirty draft inert during fresh read')
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.equal(document.body.contains(edited) && edited.value === 'Unsaved B', true, 'no-pagehide fresh proof preserves actual draft')
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide', { persisted: true })))
  assert.equal(document.body.contains(edited) && edited.closest('[hidden]') !== null, true, 'pagehide retires without destroying the draft')
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.equal(document.body.contains(edited) && edited.value === 'Unsaved B', true, 'persisted pageshow reproof keeps the same draft')
  const save = () => [...document.querySelectorAll('button')].find(button => button.textContent === '保存する')
  await React.act(async () => save().click())
  assert.equal(writes.length, 1)
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  assert.equal(document.body.contains(edited) && edited.closest('[hidden][inert]') !== null, true, 'no-pagehide pending PATCH remains inert')
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.ok(document.body.textContent.includes('保存結果を確認できません'), 'lost write response must surface unknown')
  assert.equal(edited.value, 'Unsaved B')
  await React.act(async () => save().click())
  assert.equal(writes.length, 1, 'no blind repeat PATCH')
  await React.act(async () => { writes[0].held.resolve(Response.json({ template: {} })); await new Promise(setImmediate) })
  assert.equal(document.body.textContent.includes('保存しました'), false, 'late old acknowledgment cannot be adopted')
  actor = 'actor-B'; await render(); await settle(calls.length - 1, payload(actor, 'B'))
  assert.equal(document.body.contains(edited), false, 'confirmed different actor discards the previous draft')
  await React.act(async () => save().click())
  assert.equal(writes.length, 2)
  await React.act(async () => { writes[1].held.resolve(Response.json({ template: {} })); await new Promise(setImmediate) })
  assert.ok(document.body.textContent.includes('保存しました'), 'current Template save remains usable')
  transportMode = true
  const nativeSetTimeout = global.setTimeout
  let expireWrite = null
  global.setTimeout = (callback, delay, ...args) => {
    if (delay === 310_000) { expireWrite = () => callback(...args); return 0 }
    return nativeSetTimeout(callback, delay, ...args)
  }
  try {
    await React.act(async () => save().click())
    assert.ok(expireWrite, 'actual Template transport has a finite write deadline')
    assert.equal(transportWrites.length, 1)
    await React.act(async () => { expireWrite(); await new Promise(setImmediate) })
  } finally { global.setTimeout = nativeSetTimeout }
  assert.ok(document.body.textContent.includes('保存結果を確認できません'), 'same-proof Template header timeout is unknown')
  await React.act(async () => save().click())
  assert.equal(transportWrites.length, 1, 'same-proof Template retry makes no second PATCH')
  const currentName = document.querySelector('input[value="Original B"]')
  assert.ok(currentName)
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  assert.ok(currentName.closest('[hidden][inert]'), 'unknown Template is inert during no-pagehide reproof')
  await settle(calls.length - 1, payload(actor, 'B'))
  await React.act(async () => save().click())
  assert.equal(transportWrites.length, 1, 'fresh same-actor proof cannot clear Template unknown outcome')
  await React.act(async () => { transportWrites[0].held.resolve(Response.json({ template: {} })); await new Promise(setImmediate) })
  await React.act(async () => view.unmount()); dom.window.close()
  console.log('mensetsu actual boundary + Template dirty same-actor reproof, pending PATCH unknown/no-replay/late-ack PASS')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
