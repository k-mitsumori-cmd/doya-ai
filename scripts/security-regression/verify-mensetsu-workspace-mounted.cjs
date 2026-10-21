process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom'), { createRoot } = req('react-dom/client')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/mensetsu/sessions/session-B?org=B' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
let actor = 'actor-A', status = 'authenticated', pathname = '/mensetsu/sessions/session-B', search = '?org=B', remembered = null
let snapshot = { phase: 'idle', handle: null }, calls = [], pushes = [], replaces = [], mounts = 0
const router = { push: href => pushes.push(href), replace: href => replaces.push(href) }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
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
  'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search), useRouter: () => router },
  '@/components/org/OrgSwitcher': { getSelectedOrg: () => remembered, selectOrganization: (service, slug) => { assert.equal(service, 'mensetsu'); remembered = slug } },
  '@/lib/ui/guest-path': { isGuestPath: value => /^\/mensetsu\/(?:live|invite)\//.test(value) },
  '@/lib/organization-workspace-client': {
    readOrganizationWorkspace: read,
    selectedWorkspaceFromUrl: (raw, stored) => { const selection = load('src/lib/organization-workspace-selection.ts').organizationSelection(raw); return selection.kind !== 'absent' ? selection : stored ? { kind: 'selected', slug: stored } : selection },
    WorkspaceReadError: class WorkspaceReadError extends Error { constructor(status, kind) { super(); this.status = status; this.kind = kind } },
  },
  '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager: { inspectStored() {} }, snapshot }) },
  '@/lib/checkout-recovery-client': { checkoutStoredIntent: () => ({ serviceId: 'mensetsu', organization: null }) },
}
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports
  const filename = path.join(root, relative), m = new Module(filename)
  cache.set(relative, m)
  m.require = id => {
    if (id in mocks) return mocks[id]
    if (id === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    if (id === '@/lib/mensetsu/checkout-origin-hint') return load('src/lib/mensetsu/checkout-origin-hint.ts')
    throw Error('Unmocked ' + id)
  }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return m.exports
}
const boundary = load('src/components/mensetsu/MensetsuWorkspaceBoundary.tsx')
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
const render = () => React.act(async () => { view.render(React.createElement(boundary.MensetsuWorkspaceBoundary, null, React.createElement(Probe))); await new Promise(setImmediate) })
const settle = (i, value) => React.act(async () => { calls[i].held.resolve(value); await new Promise(setImmediate) })
const navigate = async (path, query) => { pathname = path; search = query; window.history.replaceState(null, '', path + query); await render() }
;(async () => {
  await render(); assert.deepEqual(calls[0].selected, { kind: 'selected', slug: 'B' }); assert.equal(calls[0].service, 'mensetsu')
  await settle(0, payload(actor, 'B')); assert.equal(document.querySelector('[data-org]').dataset.org, 'B')
  await React.act(async () => document.querySelector('button').click())
  assert.equal(pushes.at(-1), '/mensetsu?org=A'); assert.equal(document.querySelector('[data-org]'), null)
  await navigate('/mensetsu', '?org=A'); await settle(calls.length - 1, payload(actor, 'A'))
  assert.equal(document.querySelector('[data-org]').dataset.org, 'A')
  await navigate('/mensetsu/compare', '?org=B'); const oldActorRead = calls.length - 1
  actor = 'actor-B'; await render(); const freshActorRead = calls.length - 1
  await settle(freshActorRead, payload('actor-B', 'B')); await settle(oldActorRead, payload('actor-A', 'B'))
  assert.equal(document.querySelector('[data-actor]').dataset.actor, 'actor-B')
  actor = 'actor-A'; await render(); const oldABA = calls.length - 1
  actor = 'actor-B'; await render(); actor = 'actor-A'; await render(); const freshABA = calls.length - 1
  await settle(freshABA, payload('actor-A', 'B')); await settle(oldABA, payload('actor-A', 'B'))
  assert.equal(document.querySelector('[data-actor]').dataset.actor, 'actor-A')
  await navigate('/mensetsu/compare', '?org=A'); const oldOrg = calls.length - 1
  await navigate('/mensetsu/compare', '?org=B'); const freshOrg = calls.length - 1
  await settle(freshOrg, payload(actor, 'B')); await settle(oldOrg, payload(actor, 'A'))
  assert.equal(document.querySelector('[data-org]').dataset.org, 'B')
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  assert.equal(document.querySelector('[data-org]')?.dataset.org, 'B', 'same actor/org remains mounted during pageshow reproof')
  assert.ok(document.querySelector('[data-org]')?.closest('[hidden][inert]'), 'old proof is inert until the fresh read')
  await settle(calls.length - 1, payload(actor, 'B')); assert.equal(document.querySelector('[data-org]').dataset.org, 'B')
  await navigate('/mensetsu/compare', '?org=foreign'); const denied = calls.length - 1
  await React.act(async () => { calls[denied].held.reject(new mocks['@/lib/organization-workspace-client'].WorkspaceReadError(403, 'denied')); await new Promise(setImmediate) })
  assert.equal(document.querySelector('[role="alert"]')?.textContent.includes('権限'), true)
  const count = calls.length
  await navigate('/mensetsu/compare', '?org='); assert.equal(calls.length, count); assert.equal(document.querySelector('[role="alert"]')?.textContent.includes('権限'), true)
  await navigate('/mensetsu/live/token', ''); assert.equal(calls.length, count); assert.equal(document.querySelector('[data-guest]')?.dataset.guest, 'true')
  status = 'unauthenticated'; await navigate('/mensetsu', ''); assert.equal(calls.length, count); assert.equal(document.querySelector('[data-kind]')?.dataset.kind, 'empty')
  await navigate('/mensetsu/settings', '?org=B'); assert.equal(document.querySelector('[role="alert"]')?.textContent.includes('権限'), true)
  status = 'authenticated'; await navigate('/mensetsu', ''); const entry = calls.length - 1
  assert.deepEqual(calls[entry].selected, { kind: 'selected', slug: remembered })
  await settle(entry, { service: 'mensetsu', actorId: actor, memberships: [], current: null })
  assert.equal(document.querySelector('[data-kind]').dataset.kind, 'empty')
  const portalId = '00000000-0000-4000-8000-000000000009'
  await navigate('/mensetsu/billing-return/' + portalId, '')
  assert.deepEqual(calls.at(-1).selected, { kind: 'absent' })
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.ok(document.body.textContent.includes('元の組織を確認できませんでした'))
  const hints = load('src/lib/mensetsu/checkout-origin-hint.ts')
  snapshot = { phase: 'idle', handle: { operationId: '00000000-0000-4000-8000-000000000011' } }
  await navigate('/mensetsu', '')
  await settle(calls.length - 1, payload(actor, remembered))
  assert.equal(hints.saveMensetsuCheckoutHint(window.sessionStorage, { version: 1, actorId: actor, operationId: snapshot.handle.operationId, organizationId: 'orgA', slug: 'A', returnPath: '/mensetsu' }), true)
  await navigate('/mensetsu', '?success=1')
  assert.deepEqual(calls.at(-1).selected, { kind: 'selected', slug: 'A' })
  await settle(calls.length - 1, payload(actor, 'A'))
  assert.ok([...document.querySelectorAll('a')].some(link => link.getAttribute('href') === '/mensetsu?org=A'))
  actor = 'actor-B'; await render()
  assert.deepEqual(calls.at(-1).selected, { kind: 'absent' })
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.ok(document.body.textContent.includes('元の組織を確認できませんでした'))
  actor = 'actor-A'; snapshot = { phase: 'idle', handle: { operationId: '00000000-0000-4000-8000-000000000012' } }
  await render()
  assert.deepEqual(calls.at(-1).selected, { kind: 'absent' })
  await settle(calls.length - 1, payload(actor, 'B'))
  assert.ok(document.body.textContent.includes('元の組織を確認できませんでした'))
  await React.act(async () => view.unmount()); dom.window.close()
  console.log('mensetsu actual boundary mounted: explicit B, detail switch, actor/org ABA, persisted show, invalid/foreign, guest/root, empty, unknown portal and same-path checkout return PASS')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
