process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const vm = require('node:vm')
const repoRoot = process.env.DOYA_REPO_ROOT || path.resolve(__dirname, '../..')
const candidate = path.resolve(__dirname, '../..')
const ts = Module.createRequire(path.join(repoRoot, 'package.json'))('typescript')
const timers = new Map()
let nextTimer = 0
const clock = {
  setTimeout: (callback, duration) => { assert.equal(duration, 35_000); const id = ++nextTimer; timers.set(id, callback); return id },
  clearTimeout: id => timers.delete(id),
}
let transport = async () => { throw Error('transport not set') }
let lastInit = null
const fetch = (url, init) => { lastInit = { url, init }; return transport(url, init) }
function load(rel, mocks = {}, globals = {}) {
  const file = fs.existsSync(path.join(candidate, rel)) ? path.join(candidate, rel) : path.join(repoRoot, rel)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: id => { if (id in mocks) return mocks[id]; throw Error(`Unmocked ${id}`) },
    fetch, AbortController, URL, URLSearchParams, Uint8Array, TextDecoder, Response, Headers, console, ...clock, ...globals }, { filename: file })
  return exports
}
const selection = load('src/lib/organization-workspace-selection.ts')
const nav = load('src/lib/aio/billing-navigation.ts', { '@/lib/organization-workspace-selection': selection })
const helper = load('src/lib/billing-response-client.ts')
const adapter = load('src/lib/aio/billing-navigation-client.ts', {
  '@/lib/billing-response-client': helper, './billing-navigation': nav,
  '@/lib/organization-workspace-selection': selection,
})
const read = adapter.readAioBillingNavigation
const dto = { service: 'aio', actorId: 'actor', memberships: [{ id: 'org-A', slug: 'A', name: 'A', role: 'owner' }],
  current: { id: 'org-A', slug: 'A', name: 'A', role: 'owner', plan: 'GUEST', canManageBilling: true } }
const tick = () => new Promise(resolve => setImmediate(resolve))
async function expire() { await tick(); assert.equal(timers.size, 1); [...timers.values()][0](); await tick() }
;(async () => {
  transport = async () => Response.json(dto)
  const positive = await read('actor', 'A', new AbortController().signal)
  assert.equal(positive.current.plan, 'GUEST')
  assert.equal(lastInit.url, '/api/aio/billing-navigation?org=A')
  assert.equal(lastInit.init.headers['X-Aio-Actor-Id'], 'actor')
  assert.equal(lastInit.init.cache, 'no-store')
  assert.equal(timers.size, 0)
  console.log('PASS actual adapter/helper accepts known GUEST and sends exact actor/org private read')

  let lateHeader = null
  transport = (_, init) => new Promise(resolve => { lateHeader = resolve; assert.ok(init.signal) })
  const header = read('actor', 'A', new AbortController().signal)
  const headerRejected = assert.rejects(header, error => error instanceof helper.BillingResponseError)
  await expire(); await headerRejected
  lateHeader(Response.json(dto)); await tick()
  assert.equal(timers.size, 0)
  console.log('PASS noncooperative response headers time out and late body cannot be adopted')

  let lateBody = null
  transport = async () => ({ ok: true, status: 200, headers: new Headers(), body: {
    getReader: () => ({ read: () => new Promise(resolve => { lateBody = resolve }), cancel: async () => {} }),
  } })
  const body = read('actor', 'A', new AbortController().signal)
  const bodyRejected = assert.rejects(body, error => error instanceof helper.BillingResponseError)
  await expire(); await bodyRejected
  lateBody({ done: true }); await tick()
  assert.equal(timers.size, 0)
  console.log('PASS noncooperative body reader times out and late completion is ignored')

  transport = () => new Promise(() => {})
  const controller = new AbortController()
  const cancelled = read('actor', 'A', controller.signal)
  controller.abort()
  await assert.rejects(cancelled, error => error instanceof helper.BillingResponseError && error.cancelled)
  assert.equal(timers.size, 0)
  console.log('PASS actor/scope retirement aborts pending read and clears deadline')

  // Exercise the mounted return consumer with the real private route, response reader,
  // adapter and parser. Only session, Prisma and billing/provider leaves are synthetic.
  const React = Module.createRequire(path.join(repoRoot, 'package.json'))('react')
  const jsx = Module.createRequire(path.join(repoRoot, 'package.json'))('react/jsx-runtime')
  const { JSDOM } = Module.createRequire(path.join(repoRoot, 'package.json'))('jsdom')
  const { createRoot } = Module.createRequire(path.join(repoRoot, 'package.json'))('react-dom/client')
  const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.invalid/aio/billing-return/checkout/cs_A' })
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
  const hint = { version: 1, kind: 'checkout', actorId: 'actor', organizationId: 'org-A', slug: 'A',
    operationId: '47af2b59-dced-4999-a143-7bd8157c20be', sessionId: 'cs_A' }
  assert.equal(nav.saveAioCheckoutHint(dom.window.sessionStorage, hint), true)
  let serverActor = 'actor', member = { userId: 'actor', status: 'ACTIVE', role: 'owner', createdAt: new Date(0),
    organization: { id: 'org-A', slug: 'A', name: 'A' } }
  let serverContext = { userId: 'actor', organizationId: 'org-A', organizationSlug: 'A', role: 'owner' }
  const privateResponse = load('src/lib/private-api-response.ts', {
    'next/server': { NextResponse: { json: Response.json } },
  })
  const api = load('src/app/api/aio/billing-navigation/route.ts', {
    'next-auth': { getServerSession: async () => serverActor ? { user: { id: serverActor } } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { aioMember: { findMany: async () => Array.isArray(member) ? member : member ? [member] : [] },
      user: { findUnique: async () => null } } },
    '@/lib/private-api-response': privateResponse,
    '@/lib/aio/access': { getAioContext: async slug => slug === 'B' ?
      { userId: 'actor', organizationId: 'org-B', organizationSlug: 'B', role: 'owner' } : serverContext },
    '@/lib/aio/billing': { getAioBilling: async () => ({ plan: 'FREE' }) },
    '@/lib/aio/types': { ROLE_HIERARCHY: { owner: 3, admin: 2, manager: 1, member: 0 } },
    '@/lib/organization-workspace-selection': selection,
  })
  let apiCalls = 0
  transport = async (target, init) => {
    apiCalls++
    const nextUrl = new URL(target, 'https://example.invalid')
    return api.GET({ headers: new Headers(init.headers), nextUrl })
  }
  const session = { status: 'authenticated', data: { user: { id: 'actor' } } }
  const route = load('src/lib/aio/billing-return-route.ts', {
    './billing-navigation': nav, './billing-return-correlation': load('src/lib/aio/billing-return-correlation.ts'),
  })
  const router = { replace: () => { throw Error('unexpected navigation') } }
  const Return = load('src/components/aio/AioBillingReturn.tsx', {
    react: React, 'react/jsx-runtime': jsx,
    'next-auth/react': { useSession: () => session },
    'next/navigation': { useRouter: () => router, useSearchParams: () => new URLSearchParams(dom.window.location.search) },
    'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
    '@/lib/aio/billing-navigation-client': adapter,
    '@/lib/aio/billing-navigation': nav,
    '@/lib/aio/billing-return-route': route,
  }, { window: dom.window, sessionStorage: dom.window.sessionStorage }).AioBillingReturn
  const mounted = createRoot(dom.window.document.getElementById('app'))
  const act = async fn => React.act(async () => { await fn(); await tick(); await tick(); await tick() })
  const render = () => act(() => mounted.render(React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A' })))
  await render()
  assert.ok([...dom.window.document.querySelectorAll('a')].some(link => link.getAttribute('href') === '/aio/A'), dom.window.document.body.textContent)
  assert.ok(apiCalls >= 2, 'unscoped and scoped reads both reached the private handler')
  assert.equal(timers.size, 0)
  console.log('PASS actual private route to bounded adapter/parser to mounted return restores only the owned origin')
  member = null
  await act(() => { const event = new dom.window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true }); dom.window.dispatchEvent(event) })
  assert.equal(dom.window.document.body.textContent.includes('元の組織を確認できませんでした'), true)
  assert.equal(dom.window.document.body.textContent.includes('元の組織の作業画面に戻る'), false)
  assert.equal([...dom.window.document.querySelectorAll('a')].some(link => link.getAttribute('href') === '/aio/A'), false)
  assert.equal(timers.size, 0)
  console.log('PASS actual private route membership removal retires the old origin on persisted return')
  member = { userId: 'actor', status: 'ACTIVE', role: 'owner', createdAt: new Date(0),
    organization: { id: 'org-other', slug: 'A', name: 'Other A' } }
  await act(() => { const event = new dom.window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true }); dom.window.dispatchEvent(event) })
  assert.equal(dom.window.document.body.textContent.includes('元の組織を確認できませんでした'), true)
  assert.equal(dom.window.document.body.textContent.includes('元の組織の作業画面に戻る'), false)
  assert.equal(dom.window.document.body.textContent.includes('Other A'), true, 'a current same-slug membership may remain in the selector')
  console.log('PASS same slug on a different organization ID cannot adopt the old origin')
  member = { userId: 'actor', status: 'ACTIVE', role: 'owner', createdAt: new Date(0),
    organization: { id: 'org-A', slug: 'A', name: 'A' } }
  serverActor = 'other'
  await act(() => { const event = new dom.window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true }); dom.window.dispatchEvent(event) })
  assert.equal(dom.window.document.body.textContent.includes('組織を確認できませんでした'), true)
  const retry = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === '再確認する')
  assert.ok(retry)
  const reactProps = Object.keys(retry).find(key => key.startsWith('__reactProps$'))
  const retiredRetry = retry[reactProps].onClick
  const beforeRetire = apiCalls
  await act(() => { dom.window.dispatchEvent(new dom.window.Event('pagehide'))
    const event = new dom.window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true }); dom.window.dispatchEvent(event) })
  await act(() => retiredRetry())
  assert.equal(apiCalls, beforeRetire + 1, 'only persisted pageshow may start the new read')
  serverActor = 'actor'
  const retryCurrent = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === '再確認する')
  const currentProps = Object.keys(retryCurrent).find(key => key.startsWith('__reactProps$'))
  const beforeCurrentRetry = apiCalls
  await act(() => retryCurrent[currentProps].onClick())
  assert.equal(apiCalls, beforeCurrentRetry + 2, 'the current retry re-reads both membership and scoped origin')
  assert.ok([...dom.window.document.querySelectorAll('a')].some(link => link.getAttribute('href') === '/aio/A'), dom.window.document.body.textContent)
  assert.equal(timers.size, 0)
  console.log('PASS actor mismatch blocks the old origin; retired retry reads zero, current retry recovers')
  await act(() => mounted.unmount())
  const strict = createRoot(dom.window.document.getElementById('app'))
  const beforeStrict = apiCalls
  await act(() => strict.render(React.createElement(React.StrictMode, null,
    React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A' }))))
  assert.ok([...dom.window.document.querySelectorAll('a')].some(link => link.getAttribute('href') === '/aio/A'))
  assert.ok(apiCalls >= beforeStrict + 2)
  assert.equal(timers.size, 0)
  await act(() => strict.unmount())
  console.log('PASS StrictMode remount settles only the current private route read without leaking a deadline')
  const portalA = '29e64640-8a15-4f52-90b4-c6546b43bc0b'
  const portalB = '8675544e-2909-40fb-9012-d90ceaa92e97'
  assert.equal(nav.saveAioPortalHint(dom.window.sessionStorage, { version: 1, kind: 'portal', actorId: 'actor',
    organizationId: 'org-A', slug: 'A', navigationId: portalA }), true)
  assert.equal(nav.saveAioPortalHint(dom.window.sessionStorage, { version: 1, kind: 'portal', actorId: 'actor',
    organizationId: 'org-B', slug: 'B', navigationId: portalB }), true)
  member = [member, { userId: 'actor', status: 'ACTIVE', role: 'owner', createdAt: new Date(1),
    organization: { id: 'org-B', slug: 'B', name: 'B' } }]
  for (const [navigationId, slug] of [[portalB, 'B'], [portalA, 'A']]) {
    const portalRoot = createRoot(dom.window.document.getElementById('app'))
    await act(() => portalRoot.render(React.createElement(Return, { kind: 'portal', referenceId: navigationId })))
    assert.equal(dom.window.document.body.textContent.includes('元の組織の作業画面に戻る'), true)
    assert.ok([...dom.window.document.querySelectorAll('a')].some(link => link.getAttribute('href') === `/aio/${slug}`))
    await act(() => portalRoot.unmount())
  }
  assert.equal(timers.size, 0)
  console.log('PASS reverse-order Portal B then A return uses each immutable navigation UUID and fresh membership')
  const actualTransport = transport
  for (const stage of ['header', 'body']) {
    let releaseLate
    transport = stage === 'header' ? () => new Promise(resolve => { releaseLate = resolve }) : async () => ({
      ok: true, status: 200, headers: new Headers(), body: { getReader: () => ({
        read: () => new Promise(resolve => { releaseLate = resolve }), cancel: async () => {},
      }) },
    })
    const timeoutRoot = createRoot(dom.window.document.getElementById('app'))
    await act(() => timeoutRoot.render(React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A' })))
    await act(expire)
    assert.equal(dom.window.document.body.textContent.includes('組織を確認できませんでした'), true, stage)
    assert.equal(timers.size, 0, stage)
    transport = actualTransport
    const button = [...dom.window.document.querySelectorAll('button')].find(node => node.textContent === '再確認する')
    const props = Object.keys(button).find(key => key.startsWith('__reactProps$'))
    await act(() => button[props].onClick())
    assert.ok([...dom.window.document.querySelectorAll('a')].some(link => link.getAttribute('href') === '/aio/A'), stage)
    if (stage === 'header') releaseLate(Response.json({ ...dto, actorId: 'other' }))
    else releaseLate({ done: true })
    await tick()
    assert.equal(dom.window.document.body.textContent.includes('元の組織の作業画面に戻る'), true, stage)
    assert.equal(timers.size, 0, stage)
    await act(() => timeoutRoot.unmount())
  }
  console.log('PASS mounted return recovers from noncooperative headers and body without adopting late data')
  dom.window.close()
})().catch(error => { console.error(error); process.exitCode = 1 })
