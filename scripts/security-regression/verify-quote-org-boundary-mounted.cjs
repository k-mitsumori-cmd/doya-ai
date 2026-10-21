process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/quote/documents/docA?org=A' })
global.window = dom.window; global.document = dom.window.document; global.CustomEvent = dom.window.CustomEvent; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = req('react-dom/client')
let actor = 'actor-A', status = 'authenticated', pathname = '/quote/documents/docA', search = '?org=A', remembered = 'B'
let snapshot = { phase: 'idle', handle: null }, calls = [], pushes = [], replaces = []
let mounts = 0
const router = { push: href => pushes.push(href), replace: href => replaces.push(href) }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const read = (expected, selected, signal, service) => { if (calls.length > 60) throw Error('unexpected workspace read loop'); const held = deferred(); calls.push({ expected, selected, signal, service, held }); return held.promise }
const mocks = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
  'next-auth/react': { useSession: () => ({ status, data: status === 'authenticated' ? { user: { id: actor } } : null }) },
  'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search), useRouter: () => router },
  '@/components/org/OrgSwitcher': { getSelectedOrg: () => remembered, selectOrganization: (_service, slug) => { remembered = slug } },
  '@/lib/ui/guest-path': { isGuestPath: () => false },
  '@/lib/organization-workspace-client': { readOrganizationWorkspace: read, selectedWorkspaceFromUrl: (raw, stored) => {
    const explicit = load('src/lib/organization-workspace-selection.ts').organizationSelection(raw)
    return explicit.kind !== 'absent' ? explicit : stored ? { kind: 'selected', slug: stored } : explicit
  }, WorkspaceReadError: class WorkspaceReadError extends Error { constructor(status, kind) { super(); this.status = status; this.kind = kind } } },
  '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager: { inspectStored() {} }, snapshot }) },
  '@/lib/checkout-recovery-client': { checkoutStoredIntent: () => ({ serviceId: 'quote', organization: null }) },
}
const cache = new Map()
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports
  const filename = path.join(root, relative), m = new Module(filename)
  cache.set(relative, m)
  m.require = id => {
    if (id in mocks) return mocks[id]
    if (id === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    if (id === '@/lib/quote/checkout-origin-hint') return load('src/lib/quote/checkout-origin-hint.ts')
    throw Error('Unmocked ' + id)
  }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return m.exports
}
const boundary = load('src/components/quote/QuoteWorkspaceBoundary.tsx')
const organizations = [{ id: 'orgA', slug: 'A', name: 'Org A', role: 'owner' }, { id: 'orgB', slug: 'B', name: 'Org B', role: 'member' }]
const payload = (user, slug) => ({ service: 'quote', actorId: user, memberships: organizations, current: organizations.find(row => row.slug === slug) || null })
function Probe() {
  const { scope, switchTo } = boundary.useQuoteWorkspace()
  const mounted = React.useRef(0)
  if (!mounted.current) mounted.current = ++mounts
  return React.createElement('div', { 'data-scope': scope.kind, 'data-mount': mounted.current, 'data-actor': scope.kind === 'ready' ? scope.proof.actorId : '', 'data-revision': scope.kind === 'ready' ? scope.proof.revision : '' },
    scope.kind === 'ready' ? React.createElement('button', { onClick: () => switchTo('B') }, scope.proof.organization.slug) : '')
}
const view = createRoot(document.getElementById('root'))
const render = () => React.act(async () => { view.render(React.createElement(boundary.QuoteWorkspaceBoundary, null, React.createElement(Probe))); await new Promise(setImmediate) })
const settle = (i, value) => React.act(async () => { calls[i].held.resolve(value); await new Promise(setImmediate) })
;(async () => {
  await render(); assert.deepEqual(calls[0].selected, { kind: 'selected', slug: 'A' }); assert.equal(calls[0].service, 'quote')
  await settle(0, payload(actor, 'A')); assert.equal(document.querySelector('button').textContent, 'A')
  const stableMount = document.querySelector('[data-mount]').dataset.mount
  status = 'loading'; await render(); assert.equal(document.querySelector('[data-mount]').dataset.mount, stableMount)
  assert.equal(document.querySelector('[data-mount]').closest('[hidden]') !== null, true)
  status = 'authenticated'; await render(); await settle(calls.length - 1, payload(actor, 'A'))
  assert.equal(document.querySelector('[data-mount]').dataset.mount, stableMount)
  const veto = event => event.preventDefault(); window.addEventListener('quote:before-org-switch', veto)
  await React.act(async () => document.querySelector('button').click()); assert.equal(pushes.length, 0)
  window.removeEventListener('quote:before-org-switch', veto)
  await React.act(async () => document.querySelector('button').click())
  assert.equal(pushes.at(-1), '/quote?org=B'); assert.equal(document.querySelector('button'), null)
  pathname = '/quote'; search = '?org=B'; window.history.replaceState(null, '', pathname + search); await render()
  const switched = calls.length - 1; await settle(switched, payload(actor, 'B')); assert.equal(document.querySelector('button').textContent, 'B')
  pathname = '/quote/documents/docA'; search = '?org=A'; window.history.replaceState(null, '', pathname + search); await render()
  const oldA = calls.length - 1; actor = 'actor-B'; await render(); const currentB = calls.length - 1
  await settle(currentB, payload('actor-B', 'A')); await settle(oldA, payload('actor-A', 'A'))
  assert.equal(document.querySelector('[data-actor]').dataset.actor, 'actor-B')
  actor = 'actor-A'; await render(); const oldABA = calls.length - 1
  actor = 'actor-B'; await render(); const midABA = calls.length - 1
  actor = 'actor-A'; await render(); const freshABA = calls.length - 1
  await settle(freshABA, payload('actor-A', 'A')); const revision = document.querySelector('[data-revision]').dataset.revision
  await settle(oldABA, payload('actor-A', 'A')); await settle(midABA, payload('actor-B', 'A'))
  assert.equal(document.querySelector('[data-revision]').dataset.revision, revision)
  search = '?org=B'; window.history.replaceState(null, '', pathname + search); await render(); const oldOrg = calls.length - 1
  search = '?org=A'; window.history.replaceState(null, '', pathname + search); await render(); const freshOrg = calls.length - 1
  await settle(freshOrg, payload(actor, 'A')); await settle(oldOrg, payload(actor, 'B'))
  assert.equal(document.querySelector('button').textContent, 'A')
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  assert.equal(document.querySelector('button'), null)
  await settle(calls.length - 1, payload(actor, 'A')); assert.equal(document.querySelector('button').textContent, 'A')
  search = '?org=foreign'; window.history.replaceState(null, '', pathname + search); await render()
  const denied = calls.length - 1; assert.deepEqual(calls[denied].selected, { kind: 'selected', slug: 'foreign' })
  await React.act(async () => { calls[denied].held.resolve(Promise.reject(new mocks['@/lib/organization-workspace-client'].WorkspaceReadError(403, 'denied'))); await new Promise(setImmediate) })
  assert.equal(document.querySelector('button'), null); assert.equal(document.querySelector('[role="alert"]')?.textContent.includes('権限'), true)
  assert.equal(replaces.length, 0)
  const portalId = '00000000-0000-4000-8000-000000000009'
  pathname = '/quote/billing-return/' + portalId; search = ''; window.history.replaceState(null, '', pathname); await render()
  assert.deepEqual(calls.at(-1).selected, { kind: 'absent' }); await settle(calls.length - 1, payload(actor, 'B'))
  assert.ok(document.body.textContent.includes('元の組織を確認できませんでした'))
  const hints = load('src/lib/quote/checkout-origin-hint.ts')
  assert.equal(hints.saveQuotePortalHint(window.sessionStorage, { version: 1, actorId: actor, navigationId: portalId, organizationId: 'orgA', slug: 'A', returnPath: '/quote' }), true)
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  assert.deepEqual(calls.at(-1).selected, { kind: 'selected', slug: 'A' }); await settle(calls.length - 1, payload(actor, 'A'))
  assert.ok([...document.querySelectorAll('a')].some(a => a.getAttribute('href') === '/quote?org=A'))
  actor = 'actor-B'; await render(); assert.deepEqual(calls.at(-1).selected, { kind: 'absent' }); await settle(calls.length - 1, payload(actor, 'B'))
  assert.ok(document.body.textContent.includes('元の組織を確認できませんでした'))
  pathname = '/quote'; search = '?success=1'; window.history.replaceState(null, '', pathname + search); await render()
  assert.deepEqual(calls.at(-1).selected, { kind: 'absent' }); await settle(calls.length - 1, payload(actor, 'B'))
  assert.ok(document.body.textContent.includes('元の組織を確認できませんでした'))
  search = '?success=1&org=A'; window.history.replaceState(null, '', pathname + search); await render()
  assert.deepEqual(calls.at(-1).selected, { kind: 'absent' }); await settle(calls.length - 1, payload(actor, 'B'))
  assert.ok(document.body.textContent.includes('元の組織を確認できませんでした'))
  search = ''; window.history.replaceState(null, '', pathname); await render()
  assert.deepEqual(calls.at(-1).selected, { kind: 'selected', slug: remembered }); await settle(calls.length - 1, payload(actor, remembered))
  assert.equal(document.querySelector('[data-scope]').dataset.scope, 'ready')
  actor = 'actor-A'; snapshot = { phase: 'idle', handle: { operationId: '00000000-0000-4000-8000-000000000011' } }
  await render(); await settle(calls.length - 1, payload(actor, remembered))
  assert.equal(hints.saveQuoteCheckoutHint(window.sessionStorage, { version: 1, actorId: actor, operationId: snapshot.handle.operationId, organizationId: 'orgA', slug: 'A', returnPath: '/quote' }), true)
  search = '?success=1'; window.history.replaceState(null, '', pathname + search); await render()
  assert.deepEqual(calls.at(-1).selected, { kind: 'selected', slug: 'A' })
  await settle(calls.length - 1, payload(actor, 'A'))
  assert.ok([...document.querySelectorAll('a')].some(a => a.getAttribute('href') === '/quote?org=A'))
  actor = 'actor-B'; await render(); assert.deepEqual(calls.at(-1).selected, { kind: 'absent' }); await settle(calls.length - 1, payload(actor, 'B'))
  actor = 'actor-A'; snapshot = { phase: 'idle', handle: { operationId: '00000000-0000-4000-8000-000000000012' } }
  await render(); assert.deepEqual(calls.at(-1).selected, { kind: 'absent' }); await settle(calls.length - 1, payload(actor, 'B'))
  assert.ok(document.body.textContent.includes('元の組織を確認できませんでした'))
  await React.act(async () => view.unmount()); dom.window.close()
  console.log('quote boundary mounted: stable same-actor subtree, explicit URL, document switch, actor/org ABA, persisted show, foreign deny, portal and same-path checkout return markers, ordinary entry PASS')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
