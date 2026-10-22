process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), vm = require('node:vm')
const rootPath = process.env.DOYA_REPO_ROOT || path.resolve(__dirname, '../..'), candidate = path.resolve(__dirname, '../..')
const repo = Module.createRequire(path.join(rootPath, 'package.json'))
const ts = repo('typescript'), React = repo('react'), jsx = repo('react/jsx-runtime')
const { JSDOM } = repo('jsdom'), { createRoot } = repo('react-dom/client')
const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.invalid/aio/billing-return/checkout/cs_A?success=true&session_id=cs_A&plan=pro' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.IS_REACT_ACT_ENVIRONMENT = true
function load(rel, mocks, globals = {}) {
  const file = rel === 'src/components/StripeSuccessSync.tsx' && process.env.DOYA_AIO_SYNC_BEFORE
    ? process.env.DOYA_AIO_SYNC_BEFORE
    : fs.existsSync(path.join(candidate, rel)) ? path.join(candidate, rel) : path.join(rootPath, rel)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const exports = {}; vm.runInNewContext(source, { exports, require: id => { if (id in mocks) return mocks[id]; throw Error(`Unmocked ${id} from ${rel}`) },
    window: dom.window, AbortController, URL, URLSearchParams, TextDecoder, Uint8Array, Buffer, Response, fetch, setTimeout, clearTimeout,
    CustomEvent: dom.window.CustomEvent, console, ...globals }, { filename: file }); return exports
}
const selection = load('src/lib/organization-workspace-selection.ts', {})
const nav = load('src/lib/aio/billing-navigation.ts', { '@/lib/organization-workspace-selection': selection })
const correlation = load('src/lib/aio/billing-return-correlation.ts', {})
const opA = '47af2b59-dced-4999-a143-7bd8157c20be'
assert.equal(nav.saveAioCheckoutHint(dom.window.sessionStorage, { version: 1, kind: 'checkout', actorId: 'actor',
  organizationId: 'org-A', slug: 'A', operationId: opA, sessionId: 'cs_A' }), true)
assert.equal(nav.saveAioCheckoutHint(dom.window.sessionStorage, { version: 1, kind: 'checkout', actorId: 'actor',
  organizationId: 'org-B', slug: 'B', operationId: '917b5c25-5bb5-458e-95b0-031c526fa675', sessionId: 'cs_B' }), true)
let url = new URL(dom.window.location.href), refreshes = 0, syncCalls = 0, deferNavigation = false
const queuedNavigation = []
const applyNavigation = next => { url = new URL(next, url); dom.window.history.replaceState(null, '', next) }
const router = { replace: next => { if (deferNavigation) queuedNavigation.push(next); else applyNavigation(next) }, refresh: () => refreshes++ }
const session = { status: 'authenticated', data: { user: { id: 'actor', plan: 'FREE' } }, update: async () => ({ user: { id: 'actor', plan: 'PRO' } }) }
const syncListeners = new Map(), syncEvents = []
const syncWindow = {
  location: { get href() { return url.href } },
  dispatchEvent(event) { syncEvents.push(event); for (const fn of syncListeners.get(event.type) || []) fn(event); return true },
  addEventListener(type, fn) { const callbacks = syncListeners.get(type) || new Set(); callbacks.add(fn); syncListeners.set(type, callbacks) },
  removeEventListener(type, fn) { syncListeners.get(type)?.delete(fn) },
}
let readFails = false, readCalls = 0, delaySync = false, deferReads = false
const pendingReads = []
const pendingSync = []
const reader = load('src/lib/billing-response-client.ts', {}, { fetch: async (target, init) => {
  assert.equal(target, '/api/stripe/sync'); assert.ok(['cs_A', 'cs_B'].includes(JSON.parse(init.body).sessionId)); syncCalls++
  if (delaySync) return new Promise(resolve => pendingSync.push(resolve))
  return Response.json({ ok: true, plan: 'PRO', paymentStatus: 'paid', subscriptionStatus: 'active' })
} })
const sync = load('src/components/StripeSuccessSync.tsx', {
  react: React, 'react/jsx-runtime': jsx, 'next-auth/react': { useSession: () => session },
  'next/navigation': { useRouter: () => router, useSearchParams: () => new URLSearchParams(url.search) },
  'react-hot-toast': { loading() {}, success() {}, error() {}, dismiss() {} },
  '@/components/UpgradeSuccessModal': { __esModule: true, default: () => null },
  '@/lib/plan-utils': { paidTierFromSyncResult: () => 'PRO' },
  '@/lib/billing-response-client': reader,
  '@/lib/aio/billing-return-correlation': correlation,
}, { window: syncWindow }).default
const Return = load('src/components/aio/AioBillingReturn.tsx', {
  react: React, 'react/jsx-runtime': jsx, 'next-auth/react': { useSession: () => session },
  'next/navigation': { useSearchParams: () => new URLSearchParams(url.search), useRouter: () => router },
  'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
  '@/lib/aio/billing-navigation-client': { AioNavigationReadError: class extends Error {}, readAioBillingNavigation: async (actor, slug) => {
    readCalls++
    if (readFails) throw Error('synthetic read unavailable')
    assert.ok(['actor', 'actor-B'].includes(actor))
    const memberships = actor === 'actor' ? [{ id: 'org-A', slug: 'A', name: 'A', role: 'owner' },
      { id: 'org-B', slug: 'B', name: 'B', role: 'owner' }] : [{ id: 'org-B', slug: 'B', name: 'B', role: 'owner' }]
    const current = slug ? memberships.find(row => row.slug === slug) : null
    const result = { service: 'aio', actorId: actor, memberships,
      current: current ? { ...current, plan: 'PRO', canManageBilling: true } : null }
    if (deferReads) return new Promise(resolve => pendingReads.push({ actor, slug, resolve, result }))
    return result
  } },
  '@/lib/aio/billing-navigation': nav,
  '@/lib/aio/billing-return-route': load('src/lib/aio/billing-return-route.ts', { './billing-navigation': nav,
    './billing-return-correlation': correlation }),
}, { sessionStorage: dom.window.sessionStorage }).AioBillingReturn
const tick = () => new Promise(resolve => setImmediate(resolve))
const act = fn => React.act(async () => { await fn(); await tick(); await tick(); await tick() })
const persistedShow = () => { const event = new dom.window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true }); dom.window.dispatchEvent(event) }
const rootView = createRoot(document.getElementById('app'))
const render = () => act(() => rootView.render(React.createElement(React.Fragment, null,
  React.createElement(sync), React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A' }))))
;(async () => {
  await render(); await act(async () => {})
  assert.equal(syncCalls, 1)
  assert.equal(url.pathname, '/aio/billing-return/checkout/cs_A')
  assert.equal(url.searchParams.has('session_id'), false)
  assert.equal(url.searchParams.has('success'), false)
  assert.ok(refreshes >= 1)
  assert.match(document.body.textContent, /元の組織の作業画面に戻る/)
  assert.ok([...document.querySelectorAll('a')].some(link => link.getAttribute('href') === '/aio/A'))
  assert.equal(nav.readAioCheckoutHint(dom.window.sessionStorage, 'actor', 'cs_B').slug, 'B')
  await render(); assert.equal(syncCalls, 1)
  console.log('PASS actual StripeSuccessSync clears query and refreshes without losing cs_A return path or A origin')
  await act(() => rootView.unmount())
  const reload = createRoot(document.getElementById('app'))
  await act(() => reload.render(React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A' })))
  assert.match(document.body.textContent, /元の組織の作業画面に戻る/)
  assert.equal(syncCalls, 1)
  console.log('PASS remount after query clear retains exact session hint without repeating sync')
  readFails = true
  await act(() => persistedShow())
  assert.match(document.body.textContent, /組織を確認できませんでした/)
  const retryButton = [...document.querySelectorAll('button')].find(button => button.textContent === '再確認する')
  const propsKey = Object.keys(retryButton).find(key => key.startsWith('__reactProps$'))
  const retainedRetry = retryButton[propsKey].onClick
  await act(() => { dom.window.dispatchEvent(new dom.window.Event('pagehide'))
    persistedShow() })
  const beforeRetained = readCalls
  await act(() => retainedRetry())
  assert.equal(readCalls, beforeRetained)
  console.log('PASS old return retry callback cannot start another read after persisted return')
  await act(() => reload.unmount())
  const markerRoute = load('src/lib/aio/billing-return-route.ts', { './billing-navigation': nav,
    './billing-return-correlation': correlation })
  let rejectedPath = null
  const ReturnPage = load('src/app/(shell)/aio/billing-return/[...segments]/page.tsx', {
    'react/jsx-runtime': jsx, react: React, '@/components/aio/AioBillingReturn': { AioBillingReturn: Return },
    '@/lib/aio/billing-navigation': nav, '@/lib/aio/billing-return-route': markerRoute,
    'next/navigation': { redirect: href => { rejectedPath = href; throw Error('NEXT_REDIRECT') } },
  }).default
  await assert.rejects(ReturnPage({ params: Promise.resolve({ segments: ['checkout', 'cs_A'] }),
    searchParams: Promise.resolve({ success: 'true', session_id: 'cs_B' }) }), /NEXT_REDIRECT/)
  assert.equal(rejectedPath, '/aio/billing-return/unknown?success=true&session_id=cs_B')
  router.replace(rejectedPath)
  readFails = false
  const mismatch = createRoot(document.getElementById('app'))
  await act(() => mismatch.render(React.createElement(React.Fragment, null,
    React.createElement(sync), React.createElement(Return, { kind: 'unknown', referenceId: null }))))
  assert.match(document.body.textContent, /元の組織を確認できませんでした/)
  assert.equal(syncCalls, 2)
  assert.equal(url.pathname, '/aio/billing-return/unknown')
  assert.equal(url.search, '')
  console.log('PASS server mismatch trampoline preserves valid B sync but never adopts A origin after query clear')
  await act(() => mismatch.unmount())
  for (const order of ['sync-first', 'return-first']) {
    router.replace('/aio/billing-return/checkout/cs_A?success=true&session_id=cs_B')
    const beforeSync = syncCalls
    const race = createRoot(document.getElementById('app'))
    const components = [React.createElement(sync, { key: 'sync' }),
      React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A', key: 'return' })]
    await act(() => race.render(React.createElement(React.Fragment, null,
      ...(order === 'sync-first' ? components : components.reverse()))))
    await act(async () => {})
    assert.equal(url.pathname, '/aio/billing-return/unknown', order)
    assert.match(document.body.textContent, /元の組織を確認できませんでした/, order)
    assert.equal(syncCalls, beforeSync + 1, order)
    await act(() => race.unmount())
  }
  console.log('PASS same-path mismatch stays unknown with either Sync/Return mounted order')
  for (const order of ['sync-first', 'return-first']) for (const responseOrder of ['response-first', 'navigation-first']) {
    router.replace('/aio/billing-return/checkout/cs_A?success=true&session_id=cs_B')
    deferNavigation = true; delaySync = true
    const sticky = createRoot(document.getElementById('app'))
    const components = [React.createElement(sync, { key: 'sync' }),
      React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A', key: 'return' })]
    await act(() => sticky.render(React.createElement(React.Fragment, null,
      ...(order === 'sync-first' ? components : components.reverse()))))
    assert.ok(queuedNavigation.includes('/aio/billing-return/unknown?success=true&session_id=cs_B'))
    applyNavigation('/aio/billing-return/checkout/cs_A?success=true&session_id=cs_A')
    await act(() => sticky.render(React.createElement(React.Fragment, null,
      ...(order === 'sync-first' ? components : components.reverse()))))
    assert.match(document.body.textContent, /元の組織を確認できませんでした/, `${order}: rejected mount must not adopt A hint`)
    if (responseOrder === 'navigation-first') for (const next of queuedNavigation.splice(0)) applyNavigation(next)
    for (const resolve of pendingSync.splice(0)) await act(() => resolve(Response.json({ ok: true, plan: 'PRO', paymentStatus: 'paid', subscriptionStatus: 'active' })))
    for (const next of queuedNavigation.splice(0)) applyNavigation(next)
    assert.equal(url.pathname, '/aio/billing-return/unknown', `${order}/${responseOrder}: old invalid marker must not restore A path`)
    await act(() => sticky.unmount())
    deferNavigation = false; delaySync = false
  }
  console.log('PASS sticky rejected same-path marker remains unknown across a later valid-A query in both orders')
  if (!['duplicate', 'mixed'].includes(process.env.AIO_TEST_ONLY)) for (const order of ['return-first', 'sync-first']) for (const responseOrder of ['response-first', 'navigation-first']) {
    router.replace('/aio/billing-return/checkout/cs_A?success=true&session_id=cs_B')
    deferNavigation = true
    delaySync = true
    const delayed = createRoot(document.getElementById('app'))
    const components = [React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A', key: 'return' }),
      React.createElement(sync, { key: 'sync' })]
    await act(() => delayed.render(React.createElement(React.Fragment, null,
      ...(order === 'return-first' ? components : components.reverse()))))
    await act(async () => {})
    assert.ok(queuedNavigation.includes('/aio/billing-return/unknown?success=true&session_id=cs_B'), order)
    assert.equal(pendingSync.length, 1, `${order}/${responseOrder}: one pending sync`)
    if (responseOrder === 'navigation-first') for (const next of queuedNavigation.splice(0)) applyNavigation(next)
    await act(() => pendingSync.shift()(Response.json({ ok: true, plan: 'PRO', paymentStatus: 'paid', subscriptionStatus: 'active' })))
    for (const next of queuedNavigation.splice(0)) applyNavigation(next)
    assert.equal(url.pathname, '/aio/billing-return/unknown', `${order}/${responseOrder}: late Sync clear must not restore A path`)
    await act(() => delayed.unmount())
    deferNavigation = false
    delaySync = false
    console.log(`PASS ${order}/${responseOrder} pending unknown navigation cannot be overwritten by late Sync query clearing`)
  }
  const invalidQueries = ['success=true&session_id=cs_B&session_id=cs_A',
    'success=true&session_id=cs_B&payment=cancelled']
  for (const query of process.env.AIO_TEST_ONLY === 'mixed' ? invalidQueries.slice(1) : invalidQueries) {
    router.replace(`/aio/billing-return/checkout/cs_A?${query}`)
    const beforeSync = syncCalls
    const invalid = createRoot(document.getElementById('app'))
    await act(() => invalid.render(React.createElement(React.Fragment, null,
      React.createElement(sync), React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A' }))))
    await act(async () => {})
    assert.equal(url.pathname, '/aio/billing-return/unknown')
    assert.equal(url.search, '')
    assert.equal(syncCalls, beforeSync, query)
    await act(() => invalid.unmount())
  }
  console.log('PASS duplicate and mixed same-path markers cannot trigger checkout Sync')
  router.replace('/aio/billing-return/checkout/cs_A')
  session.data = { user: { id: 'actor' } }
  deferReads = true
  const lifetime = createRoot(document.getElementById('app'))
  const renderLifetime = () => act(() => lifetime.render(React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A' })))
  await renderLifetime()
  assert.deepEqual(pendingReads.map(row => row.actor), ['actor'])
  session.data = { user: { id: 'actor-B' } }
  await renderLifetime()
  session.data = { user: { id: 'actor' } }
  await renderLifetime()
  assert.deepEqual(pendingReads.map(row => row.actor), ['actor', 'actor-B', 'actor'])
  await act(() => pendingReads[2].resolve(pendingReads[2].result))
  assert.equal(pendingReads[3].slug, 'A')
  await act(() => pendingReads[3].resolve(pendingReads[3].result))
  assert.match(document.body.textContent, /元の組織の作業画面に戻る/)
  const beforeLate = document.body.textContent
  await act(() => pendingReads[0].resolve({ ...pendingReads[0].result,
    memberships: [{ id: 'org-B', slug: 'B', name: 'late old A', role: 'owner' }] }))
  await act(() => pendingReads[1].resolve(pendingReads[1].result))
  assert.equal(document.body.textContent, beforeLate)
  console.log('PASS old actor A and B noncooperative reads cannot overwrite fresh A after actor A-B-A')
  const beforeShow = pendingReads.length
  await act(() => persistedShow())
  assert.equal(pendingReads.length, beforeShow + 1)
  assert.equal(pendingReads.at(-1).actor, 'actor')
  await act(() => pendingReads.at(-1).resolve(pendingReads.at(-1).result))
  assert.equal(pendingReads.at(-1).slug, 'A')
  await act(() => pendingReads.at(-1).resolve(pendingReads.at(-1).result))
  assert.match(document.body.textContent, /元の組織の作業画面に戻る/)
  await act(() => lifetime.unmount())
  console.log('PASS persisted pageshow without prior pagehide retires old view and accepts only a fresh same-actor read')
  router.replace('/aio/billing-return/checkout/cs_A?success=true&session_id=cs_A')
  deferReads = false; delaySync = true
  const beforeHiddenSync = syncCalls, beforeHiddenEvents = syncEvents.length
  const hidden = createRoot(document.getElementById('app'))
  await act(() => hidden.render(React.createElement(React.Fragment, null,
    React.createElement(sync), React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A' }))))
  assert.equal(syncCalls, beforeHiddenSync + 1)
  assert.equal(pendingSync.length, 1)
  await act(() => { syncWindow.dispatchEvent({ type: 'pagehide' }); dom.window.dispatchEvent(new dom.window.Event('pagehide')) })
  await act(() => pendingSync.shift()(Response.json({ ok: true, plan: 'PRO', paymentStatus: 'paid' })))
  assert.equal(syncEvents.slice(beforeHiddenEvents).filter(event => event.type === 'doya:checkout-verified').length, 0)
  assert.equal(syncCalls, beforeHiddenSync + 1)
  await act(() => { syncWindow.dispatchEvent({ type: 'pageshow', persisted: true }); persistedShow() })
  assert.equal(syncCalls, beforeHiddenSync + 1)
  assert.match(document.body.textContent, /元の組織の作業画面に戻る/)
  assert.equal(syncEvents.slice(beforeHiddenEvents).filter(event => event.type === 'doya:checkout-verified').length, 0)
  await act(() => hidden.unmount())
  delaySync = false
  console.log('PASS pending Sync and Return pagehide retire old response; persisted show keeps A origin without automatic repost')
  dom.window.close()
})().catch(error => { console.error(error); process.exitCode = 1 })
