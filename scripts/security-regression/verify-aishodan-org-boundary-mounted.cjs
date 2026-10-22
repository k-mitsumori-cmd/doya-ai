process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript'), React = require(root + '/node_modules/react')
const { JSDOM } = require(root + '/node_modules/jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/aishodan/sessions/old?org=A' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require(root + '/node_modules/react-dom/client')
const { Simulate } = require(root + '/node_modules/react-dom/test-utils')
let actor = 'actor-A', status = 'authenticated', pathname = '/aishodan/sessions/old', search = '?org=A', remembered = 'B', calls = [], pushes = [], replacements = []
let snapshot = { phase: 'idle', handle: null }, manager = { inspectStored() {} }
const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j }); return { promise, resolve, reject } }
const read = (expected, selected) => { const held = deferred(); calls.push({ expected, selected, held }); return held.promise }
const link = { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) }
const router = { push: href => pushes.push(href), replace: href => replacements.push(href) }
const mocks = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'), 'next/link': link,
  'next-auth/react': { useSession: () => ({ status, data: status === 'authenticated' ? { user: { id: actor } } : null }) },
  'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search), useRouter: () => router },
  '@/components/SignInReturnLink': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  '@/components/org/OrgSwitcher': { __esModule: true, default: () => null, getSelectedOrg: () => remembered, selectOrganization: (_, slug) => { remembered = slug } },
  '@/lib/ui/guest-path': { isGuestPath: () => false },
  '@/lib/organization-workspace-client': { readOrganizationWorkspace: read, selectedWorkspaceFromUrl: (raw, selected) => {
    const explicit = load('src/lib/organization-workspace-selection.ts').organizationSelection(raw)
    return explicit.kind !== 'absent' ? explicit : selected ? { kind: 'selected', slug: selected } : explicit
  }, WorkspaceReadError: class WorkspaceReadError extends Error { constructor(kind) { super(); this.kind = kind } } },
  '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager, snapshot }) },
  '@/lib/checkout-recovery-client': { checkoutStoredIntent: () => ({ serviceId: 'aishodan', organization: null }) },
  '@/lib/aishodan/checkout-origin-hint': {
    readCheckoutOriginHint: (...args) => load('src/lib/aishodan/checkout-origin-hint.ts').readCheckoutOriginHint(...args),
    readPortalOriginHint: (...args) => load('src/lib/aishodan/checkout-origin-hint.ts').readPortalOriginHint(...args),
  },
}
const leaves = require('./caller14-leaf-bridge.cjs')(root, React, ts)
const cache = new Map()
function load(rel) {
  if (cache.has(rel)) return cache.get(rel).exports
  const filename = path.join(root, rel), m = new Module(filename)
  cache.set(rel, m); m.paths = Module._nodeModulePaths(path.dirname(filename))
  m.require = n => { if (n in mocks) return mocks[n]; if (n === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts'); throw Error('Unmocked ' + n) }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return m.exports
}
const boundary = load('src/components/org/OrganizationWorkspaceBoundary.tsx')
const primitive = ({ children, href, className }) => React.createElement(href ? 'a' : 'div', { href, className }, children)
const toolData = url => url.includes('/products') ? { products: [], nextCursor: null, total: 0 }
  : url.includes('/rooms') ? { rooms: [], nextCursor: null, total: 0 }
  : url.includes('/stats') ? { total: 0, unanswered: [] }
  : { sessions: [] }
const toolPosts = []
mocks['@/components/org/OrganizationWorkspaceBoundary'] = boundary
mocks['@/lib/org-fetch'] = { fetchOrgJson: async url => toolData(url) }
mocks['@/lib/aishodan/types'] = { SESSION_STATUS_LABELS: {}, VERDICT_LABELS: {} }
mocks['./Lp'] = { __esModule: true, default: primitive }
mocks['@/lib/ui/notify'] = { notifyError: (setter, message) => setter(message) }
mocks['@/components/lp'] = { DoyaKun: primitive }
mocks['@/components/LoadingProgress'] = { __esModule: true, default: primitive }
mocks['@/lib/aishodan/list-pages'] = { parseAishodanPage: (value, key) => ({ items: value[key] || [], nextCursor: null, total: 0 }), appendAishodanPage: (items, page) => [...items, ...page.items] }
mocks['@/components/shell/ui-next-context'] = { useUiNext: () => true }
mocks['@/components/ds'] = new Proxy({}, { get: (_, key) => key === '__esModule' ? true : primitive })
mocks['@/components/aishodan/failure'] = leaves.aishodanFailure()
mocks['@/components/ds/motion'] = { Stagger: primitive, StaggerItem: primitive }
const Tool = load('src/app/(shell)/aishodan/Tool.tsx').default
const organizations = [{ id: 'id-A', slug: 'A', name: 'Org A', role: 'owner' }, { id: 'id-B', slug: 'B', name: 'Org B', role: 'member' }]
const payload = (user, slug) => ({ service: 'aishodan', actorId: user, memberships: organizations, current: organizations.find(row => row.slug === slug) })
function Probe() { const value = boundary.useOrganizationWorkspace(); return React.createElement('div', { 'data-scope': value.scope.kind,
  'data-actor': value.scope.kind === 'ready' ? value.scope.proof.actorId : '',
  'data-revision': value.scope.kind === 'ready' ? value.scope.proof.revision : '',
  'data-current': value.scope.kind === 'ready' ? String(value.scope.proof.current()) : '' },
  value.scope.kind === 'ready' ? React.createElement('button', { onClick: () => value.switchTo('B') }, value.scope.proof.organization.slug) : '') }
const rootView = createRoot(document.getElementById('root'))
const render = () => React.act(async () => { rootView.render(React.createElement(boundary.OrganizationWorkspaceBoundary, null, React.createElement(Probe))); await new Promise(r => setImmediate(r)) })
const settle = (index, value) => React.act(async () => { calls[index].held.resolve(value); await new Promise(r => setImmediate(r)) })
;(async () => {
  await render(); assert.deepEqual(calls[0].selected, { kind: 'selected', slug: 'A' }); assert.equal(calls[0].expected, 'actor-A')
  await settle(0, payload('actor-A', 'A')); assert.equal(document.querySelector('[data-scope]').textContent, 'A')
  const retainedButton = document.querySelector('button')
  status = 'loading'; await render(); assert.equal(document.querySelector('button'), retainedButton); assert.ok(document.querySelector('[hidden]'))
  status = 'authenticated'; await render(); const refreshed = calls.length - 1; assert.equal(document.querySelector('button'), retainedButton)
  await settle(refreshed, payload('actor-A', 'A')); assert.equal(document.querySelector('button'), retainedButton)
  await React.act(async () => document.querySelector('button').click())
  assert.equal(pushes.at(-1), '/aishodan/sessions?org=B'); assert.equal(document.querySelector('[data-scope]'), null)
  pathname = '/aishodan/sessions'; search = '?org=B'; window.history.replaceState(null, '', pathname + search); await render()
  const switched = calls.length - 1; assert.deepEqual(calls[switched].selected, { kind: 'selected', slug: 'B' }); await settle(switched, payload('actor-A', 'B'))
  assert.equal(document.querySelector('[data-scope]').textContent, 'B')
  pathname = '/aishodan'; search = '?org=A'; window.history.replaceState(null, '', pathname + search); await render()
  const lateA = calls.length - 1; actor = 'actor-B'; await render(); const currentB = calls.length - 1
  await settle(currentB, payload('actor-B', 'A')); await settle(lateA, payload('actor-A', 'A'))
  assert.equal(document.querySelector('[data-scope]').textContent, 'A')
  assert.equal(document.querySelector('[data-scope]').dataset.actor, 'actor-B')
  assert.equal(document.querySelector('[data-scope]').dataset.current, 'true')
  assert.equal(calls[currentB].expected, 'actor-B')
  actor = 'actor-A'; await render(); const oldActorA = calls.length - 1
  actor = 'actor-B'; await render(); const midActorB = calls.length - 1
  actor = 'actor-A'; await render(); const newActorA = calls.length - 1
  await settle(newActorA, payload('actor-A', 'A'))
  const newActorRevision = document.querySelector('[data-scope]').dataset.revision
  await settle(oldActorA, payload('actor-A', 'A')); await settle(midActorB, payload('actor-B', 'A'))
  assert.equal(document.querySelector('[data-scope]').dataset.actor, 'actor-A')
  assert.equal(document.querySelector('[data-scope]').dataset.revision, newActorRevision)
  assert.equal(document.querySelector('[data-scope]').dataset.current, 'true')
  search = '?org=B'; window.history.replaceState(null, '', pathname + search); await render(); const orgB1 = calls.length - 1
  search = '?org=A'; window.history.replaceState(null, '', pathname + search); await render(); const oldOrgA = calls.length - 1
  search = '?org=B'; window.history.replaceState(null, '', pathname + search); await render(); const orgB2 = calls.length - 1
  search = '?org=A'; window.history.replaceState(null, '', pathname + search); await render(); const newOrgA = calls.length - 1
  await settle(newOrgA, payload('actor-A', 'A'))
  const newOrgRevision = document.querySelector('[data-scope]').dataset.revision
  await settle(oldOrgA, payload('actor-A', 'A')); await settle(orgB1, payload('actor-A', 'B')); await settle(orgB2, payload('actor-A', 'B'))
  assert.equal(document.querySelector('[data-scope]').dataset.revision, newOrgRevision)
  assert.equal(document.querySelector('[data-scope]').dataset.actor, 'actor-A')
  assert.equal(document.querySelector('[data-scope]').textContent, 'A')
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  const resumedWithoutHide = calls.length - 1
  assert.equal(document.querySelector('[data-scope]'), null)
  await settle(resumedWithoutHide, payload('actor-A', 'A'))
  assert.equal(document.querySelector('[data-scope]').dataset.actor, 'actor-A')
  actor = 'actor-B'; await render(); const backToB = calls.length - 1
  await settle(backToB, payload('actor-B', 'A'))
  const hint = { version: 1, actorId: 'actor-B', operationId: '00000000-0000-4000-8000-000000000001', organizationId: 'id-A', slug: 'A', returnPath: '/aishodan' }
  load('src/lib/aishodan/checkout-origin-hint.ts').saveCheckoutOriginHint(window.sessionStorage, hint)
  snapshot = { phase: 'checking', handle: { operationId: hint.operationId } }; search = '?success=true'; remembered = 'B'; window.history.replaceState(null, '', pathname + search)
  await render(); const returning = calls.length - 1
  assert.deepEqual(calls[returning].selected, { kind: 'selected', slug: 'A' }); await settle(returning, payload('actor-B', 'A'))
  assert.equal(document.querySelector('[data-scope]'), null); assert.equal(document.querySelector('a[href="/aishodan?org=A"]').textContent, 'Org Aの作業に戻る')
  window.sessionStorage.clear(); snapshot = { phase: 'idle', handle: null }; search = '?payment=cancelled'; window.history.replaceState(null, '', pathname + search)
  await render(); const missing = calls.length - 1; assert.equal(calls[missing].selected.kind, 'absent')
  await settle(missing, payload('actor-B', 'B')); assert.equal(document.querySelector('[data-scope]'), null)
  assert.equal(document.querySelectorAll('a[href^="/aishodan?org="]').length, 2)
  pathname = '/aishodan/billing-return/00000000-0000-4000-8000-000000000003'; search = ''; remembered = 'B'
  window.history.replaceState(null, '', pathname); await render()
  const portalMissing = calls.length - 1; assert.equal(calls[portalMissing].selected.kind, 'absent')
  await settle(portalMissing, payload('actor-B', 'B'))
  assert.equal(document.querySelector('[data-scope]'), null)
  assert.equal(document.querySelectorAll('a[href^="/aishodan?org="]').length, 2)
  const portalHint = { version: 1, actorId: 'actor-B', navigationId: '00000000-0000-4000-8000-000000000004', organizationId: 'id-A', slug: 'A', returnPath: '/aishodan' }
  load('src/lib/aishodan/checkout-origin-hint.ts').savePortalOriginHint(window.sessionStorage, portalHint)
  pathname = `/aishodan/billing-return/${portalHint.navigationId}`; window.history.replaceState(null, '', pathname); await render()
  const portalFound = calls.length - 1; assert.deepEqual(calls[portalFound].selected, { kind: 'selected', slug: 'A' })
  await settle(portalFound, payload('actor-B', 'A'))
  assert.equal(document.querySelector('a[href="/aishodan?org=A"]').textContent, 'Org Aの作業に戻る')
  await React.act(async () => window.dispatchEvent(new dom.window.Event('pagehide')))
  assert.equal(document.querySelector('a[href="/aishodan?org=A"]'), null)
  await React.act(async () => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  const resumed = calls.length - 1; assert.deepEqual(calls[resumed].selected, { kind: 'selected', slug: 'A' })
  await settle(resumed, payload('actor-B', 'A'))
  assert.equal(document.querySelector('a[href="/aishodan?org=A"]').textContent, 'Org Aの作業に戻る')
  pathname = '/aishodan/billing-return/arbitrary'; window.history.replaceState(null, '', pathname); await render()
  const arbitrary = calls.length - 1; assert.equal(calls[arbitrary].selected.kind, 'absent')
  await settle(arbitrary, payload('actor-B', 'B'))
  assert.equal(document.querySelector('[data-scope]'), null)
  assert.equal(document.querySelectorAll('a[href^="/aishodan?org="]').length, 2)
  pathname = '/aishodan/billing-return/00000000-0000-4000-8000-000000000005'; window.history.replaceState(null, '', pathname); await render()
  const wrongId = calls.length - 1; assert.equal(calls[wrongId].selected.kind, 'absent')
  await settle(wrongId, payload('actor-B', 'B'))
  assert.equal(document.querySelector('[data-scope]'), null)
  const changed = { ...portalHint, navigationId: '00000000-0000-4000-8000-000000000006' }
  load('src/lib/aishodan/checkout-origin-hint.ts').savePortalOriginHint(window.sessionStorage, changed)
  pathname = `/aishodan/billing-return/${changed.navigationId}`; window.history.replaceState(null, '', pathname); await render()
  const changedRead = calls.length - 1; assert.deepEqual(calls[changedRead].selected, { kind: 'selected', slug: 'A' })
  window.sessionStorage.clear(); await settle(changedRead, payload('actor-B', 'A'))
  assert.equal(document.querySelector('[data-scope]'), null)
  assert.equal(document.querySelectorAll('a[href^="/aishodan?org="]').length, 2)
  pathname = '/aishodan'; search = ''; remembered = 'B'; window.history.replaceState(null, '', pathname); await render()
  const ordinary = calls.length - 1; assert.deepEqual(calls[ordinary].selected, { kind: 'selected', slug: 'B' })
  await settle(ordinary, payload('actor-B', 'B'))
  assert.equal(document.querySelector('[data-scope]').textContent, 'B')
  assert.equal(replacements.at(-1), '/aishodan?org=B')
  search = '?portal_return=plan_change'; window.history.replaceState(null, '', pathname + search); await render()
  const postPortal = calls.length - 1; assert.equal(calls[postPortal].selected.kind, 'absent')
  await settle(postPortal, payload('actor-B', 'B'))
  assert.equal(document.querySelector('[data-scope]'), null)
  assert.equal(document.querySelectorAll('a[href^="/aishodan?org="]').length, 2)
  window.sessionStorage.clear(); remembered = 'removed'; pathname = '/aishodan'; search = ''
  window.history.replaceState(null, '', pathname); await render()
  const removed = calls.length - 1; assert.deepEqual(calls[removed].selected, { kind: 'selected', slug: 'removed' })
  await React.act(async () => { calls[removed].held.reject(new mocks['@/lib/organization-workspace-client'].WorkspaceReadError('denied')); await new Promise(r => setImmediate(r)) })
  const choices = calls.length - 1; assert.equal(calls[choices].selected.kind, 'absent')
  await settle(choices, payload('actor-B', 'B'))
  assert.equal(document.querySelector('[data-scope]'), null)
  assert.match(document.body.textContent, /前回の組織を確認できませんでした/)
  assert.equal(document.querySelectorAll('a[href^="/aishodan?org="]').length, 2)
  await React.act(async () => rootView.unmount())
  actor = 'actor-A'; status = 'authenticated'; pathname = '/aishodan'; search = '?org=A'; remembered = 'B'
  window.history.replaceState(null, '', pathname + search)
  global.fetch = (url, options) => {
    if ((options?.method || 'GET') === 'GET') return Promise.resolve(Response.json(toolData(String(url))))
    const held = deferred(); toolPosts.push({ url, options, held })
    return held.promise.then(value => ({ ok: true, json: async () => value }))
  }
  const integrated = createRoot(document.getElementById('root'))
  const renderTool = () => React.act(async () => { integrated.render(React.createElement(boundary.OrganizationWorkspaceBoundary, null, React.createElement(Tool))); await new Promise(r => setImmediate(r)) })
  await renderTool(); const firstToolRead = calls.length - 1
  await settle(firstToolRead, payload('actor-A', 'A'))
  const input = document.getElementById('aishodan-import-url'); assert.ok(input)
  await React.act(async () => { Simulate.change(input, { target: { value: 'https://service.invalid' } }); await new Promise(r => setImmediate(r)) })
  const importButton = [...document.querySelectorAll('button')].find(button => button.textContent.includes('取り込む'))
  assert.ok(importButton && !importButton.disabled)
  React.act(() => importButton.click()); await new Promise(r => setImmediate(r))
  assert.equal(toolPosts.length, 1)
  status = 'loading'; await renderTool(); assert.ok(document.querySelector('[hidden]'))
  status = 'authenticated'; await renderTool(); const freshToolRead = calls.length - 1
  await settle(freshToolRead, payload('actor-A', 'A'))
  assert.equal([...document.querySelectorAll('button')].some(button => button.textContent.includes('取り込み中')), false)
  assert.match(document.body.textContent, /直前の操作結果を確認できません/)
  const nextImport = [...document.querySelectorAll('button')].find(button => button.textContent.includes('取り込む'))
  React.act(() => nextImport.click()); await new Promise(r => setImmediate(r))
  assert.equal(toolPosts.length, 2)
  React.act(() => toolPosts[0].held.resolve({ product: { name: 'Late' }, pageCount: 1, chunkCount: 1 }))
  await React.act(async () => { await new Promise(r => setImmediate(r)) })
  assert.ok([...document.querySelectorAll('button')].some(button => button.textContent.includes('取り込み中')), 'old finally must not clear newer operation busy')
  assert.equal(document.body.textContent.includes('Late'), false)
  React.act(() => toolPosts[1].held.resolve({ product: { name: 'New' }, pageCount: 1, chunkCount: 1 }))
  await React.act(async () => { await new Promise(r => setImmediate(r)) })
  assert.equal([...document.querySelectorAll('button')].some(button => button.textContent.includes('取り込み中')), false)
  await React.act(async () => { Simulate.change(document.getElementById('aishodan-import-url'), { target: { value: 'https://service.invalid/again' } }); await new Promise(r => setImmediate(r)) })
  const thirdImport = [...document.querySelectorAll('button')].find(button => button.textContent.includes('取り込む'))
  React.act(() => thirdImport.click()); await new Promise(r => setImmediate(r))
  assert.equal(toolPosts.length, 3)
  status = 'loading'; await renderTool()
  status = 'authenticated'; await renderTool(); const failedToolRead = calls.length - 1
  await React.act(async () => { calls[failedToolRead].held.reject(new mocks['@/lib/organization-workspace-client'].WorkspaceReadError('unavailable')); await new Promise(r => setImmediate(r)) })
  assert.match(document.body.textContent, /組織を確認できませんでした/)
  assert.equal(document.querySelector('[hidden]'), null, 'failed fresh read exposes Boundary retry instead of hidden busy child')
  await React.act(async () => integrated.unmount()); dom.window.close()
  console.log('PASS 21 actual mounted workspace boundary cases: prior 18 cases plus actual Boundary+Tool same-actor reproof releases busy/ignores old body, old finally preserves newer busy, failed fresh read exposes Boundary retry. Synthetic SDK/read/transport.')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
