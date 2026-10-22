process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const Module = require('node:module')
const repo = path.resolve(__dirname, '../..')
const req = Module.createRequire(path.join(repo, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom')
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.invalid/banner/pricing' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.IS_REACT_ACT_ENVIRONMENT = true
const auth = req('next-auth/react'), { createRoot } = req('react-dom/client'), tick = () => new Promise(resolve => setImmediate(resolve))
const actorA = { user: { id: 'actor-a', email: 'a@example.invalid', plan: 'FREE' }, expires: '2099-12-31T23:59:59Z' }
const actorB = { user: { id: 'actor-b', email: 'b@example.invalid', plan: 'FREE' }, expires: '2099-12-31T23:59:59Z' }
let serverSession = actorA, updateSession, holdStatusFor = null, releaseHeldStatus
const calls = [], warnings = [], originalError = console.error, originalFetch = global.fetch
console.error = (...args) => warnings.push(args.map(String).join(' '))
const reply = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, 'https://example.invalid')
  if (url.pathname === '/api/auth/csrf') return Response.json({ csrfToken: 'synthetic' })
  if (url.pathname === '/api/auth/session') return Response.json(serverSession || {})
  if (url.pathname === '/api/stripe/checkout') {
    const body = JSON.parse(init.body)
    calls.push({ actor: serverSession?.user.id, body })
    assert.equal(body.action, 'status', 'mount, SDK update and page return may only observe')
    if (holdStatusFor === body.operationId) return new Promise(resolve => { releaseHeldStatus = () => resolve(Response.json({ actorId: 'actor-a', operationId: body.operationId, phase: 'reserved', dispatched: false })) })
    return Response.json({ actorId: serverSession.user.id, operationId: body.operationId, phase: 'reserved', reason: null, dispatched: false })
  }
  throw Error('Unexpected network: ' + url.pathname)
}
global.fetch = reply
function load(file, mocks) {
  const exported = {}, code = fs.readFileSync(path.join(repo, file), 'utf8')
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { exports: exported, require: name => { if (name in mocks) return mocks[name]; throw Error('Unmocked ' + name) }, window, document, AbortController, URL, TextDecoder, Uint8Array, Response, fetch: reply, setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto, console }, { filename: file })
  return exported
}
const billing = load('src/lib/billing-response-client.ts', {})
const client = load('src/lib/checkout-recovery-client.ts', { './billing-response-client': billing })
const provider = load('src/components/CheckoutRecoveryProvider.tsx', {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'), 'next-auth/react': auth,
  '@/lib/billing-response-client': billing, '@/lib/checkout-recovery-client': client,
})
const intent = { planId: 'banner-pro', serviceId: 'banner', billingPeriod: 'monthly', returnTo: '/banner/pricing', organization: null }
const idA = '11111111-1111-4111-8111-111111111111', idB = '22222222-2222-4222-8222-222222222222'
const save = (actor, id) => window.sessionStorage.setItem(`doya-checkout-handle-v1:${actor}`, JSON.stringify({ version: 1, actorId: actor, operationId: id, scopeKey: client.checkoutScopeKey(intent), previousOperationId: null }))
save('actor-a', idA); save('actor-b', idB)
let snapshot, currentManager
function Hook() {
  const session = auth.useSession(); updateSession = session.update
  const { manager, snapshot: current } = provider.useCheckoutRecovery(); React.useEffect(() => { if (manager) void manager.observe(intent) }, [manager]); snapshot = current; currentManager = manager
  return React.createElement('span', null, `${session.status}:${current.phase}:${current.handle?.actorId || 'none'}`)
}
const container = document.getElementById('root'), root = createRoot(container)
const act = fn => React.act(async () => { await fn(); for (let n = 0; n < 10; n++) await tick() })
;(async () => {
  await act(() => root.render(React.createElement(React.StrictMode, null,
    React.createElement(auth.SessionProvider, { session: actorA }, React.createElement(provider.CheckoutRecoveryProvider, null, React.createElement(Hook))))))
  assert.equal(snapshot.handle?.actorId, 'actor-a'); assert.equal(currentManager.alive, true, 'StrictMode must not dispose active manager')
  assert.equal(container.querySelector('aside a')?.getAttribute('href'), '/banner/pricing', 'recovery remains discoverable without a checkout CTA')
  assert(calls.some(c => c.body.operationId === idA && c.body.action === 'status'))
  const readCount = calls.length
  await act(() => container.querySelector('aside button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })))
  assert.equal(calls.length, readCount + 1, 'notice explicitly rechecks the saved handle without a CTA')
  assert.equal(calls.at(-1).body.action, 'status')
  assert.equal(calls.at(-1).body.operationId, idA)
  holdStatusFor = idA
  await act(() => container.querySelector('aside button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })))
  assert.equal(typeof releaseHeldStatus, 'function')
  const releaseBeforeAba = releaseHeldStatus
  holdStatusFor = null
  serverSession = actorB; await act(() => updateSession())
  serverSession = actorA; await act(() => updateSession())
  await act(() => releaseBeforeAba())
  assert.equal(snapshot.handle?.actorId, 'actor-a')
  assert.doesNotMatch(container.textContent, /保存済み申込の状態を確認しました/, 'an old A read cannot update the notice after A→B→A')
  const before = calls.length
  const beforePagehide = currentManager
  holdStatusFor = idA; releaseHeldStatus = null
  await act(() => container.querySelector('aside button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })))
  assert.equal(typeof releaseHeldStatus, 'function')
  const releaseBeforePagehide = releaseHeldStatus
  await act(() => window.dispatchEvent(new dom.window.Event('pagehide')))
  assert.equal(beforePagehide.alive, false)
  holdStatusFor = null
  await act(() => releaseBeforePagehide())
  assert.doesNotMatch(container.textContent, /保存済み申込の状態を確認しました/, 'pagehide retires a delayed notice result')
  await act(() => window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true })))
  assert.notEqual(currentManager, beforePagehide); assert.equal(currentManager.alive, true)
  assert(calls.length > before); assert(calls.slice(before).every(c => c.body.action === 'status'))
  const priorManager = currentManager
  serverSession = actorB
  await act(() => updateSession())
  assert.equal(priorManager.alive, false, 'old actor manager is retired after SDK update')
  assert.equal(currentManager.alive, true)
  assert.equal(snapshot.handle?.actorId, 'actor-b')
  assert(calls.some(c => c.body.operationId === idB && c.body.action === 'status'))
  assert(calls.every(c => c.body.action === 'status'))
  await act(() => root.unmount())
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(currentManager.alive, false, 'real unmount retires manager')
  const hrIntent = { planId: 'hr-pro', serviceId: 'hr', billingPeriod: 'monthly', returnTo: '/hr/settings/billing', organization: { actor: 'actor-a', organizationId: 'org-a' } }
  window.sessionStorage.setItem('doya-checkout-handle-v1:actor-a', JSON.stringify({ version: 1, actorId: 'actor-a', operationId: idA,
    scopeKey: client.checkoutScopeKey(hrIntent), previousOperationId: null }))
  window.sessionStorage.setItem('hr-selected-organization:v1:actor-a', 'org-b')
  window.history.replaceState(null, '', '/hr/settings/billing')
  serverSession = actorA
  const hrContainer = document.createElement('div'); document.body.append(hrContainer); const hrRoot = createRoot(hrContainer)
  await act(() => hrRoot.render(React.createElement(React.StrictMode, null,
    React.createElement(auth.SessionProvider, { session: actorA }, React.createElement(provider.CheckoutRecoveryProvider, null, React.createElement(Hook))))))
  const beforeWrongOrg = calls.length
  await act(() => hrContainer.querySelector('aside button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })))
  assert.equal(calls.length, beforeWrongOrg, 'foreign selected HR organization cannot trigger even a status read')
  assert.match(hrContainer.textContent, /元のサービス・組織を選択/)
  window.sessionStorage.setItem('hr-selected-organization:v1:actor-a', 'org-a')
  await act(() => hrContainer.querySelector('aside button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })))
  assert.equal(calls.length, beforeWrongOrg + 1, 'matching selected HR organization permits only a status read')
  assert.equal(calls.at(-1).body.action, 'status')
  await act(() => hrRoot.unmount())
  await new Promise(resolve => setTimeout(resolve, 5))
  hrContainer.remove()
  window.sessionStorage.setItem('doya-checkout-handle-v1:actor-a', JSON.stringify({ version: 1, actorId: 'actor-b', operationId: idA,
    scopeKey: client.checkoutScopeKey(intent), previousOperationId: null }))
  const foreignContainer = document.createElement('div'); document.body.append(foreignContainer); const foreignRoot = createRoot(foreignContainer)
  const beforeForeignActor = calls.length
  await act(() => foreignRoot.render(React.createElement(React.StrictMode, null,
    React.createElement(auth.SessionProvider, { session: actorA }, React.createElement(provider.CheckoutRecoveryProvider, null, React.createElement(Hook))))))
  assert.equal(snapshot.phase, 'blocked')
  assert.equal(foreignContainer.querySelector('aside button'), null)
  assert.equal(calls.length, beforeForeignActor, 'a stored handle for another actor cannot trigger status')
  await act(() => foreignRoot.unmount())
  await new Promise(resolve => setTimeout(resolve, 5))
  foreignContainer.remove()
  assert.equal(warnings.length, 0, JSON.stringify(warnings))
  console.log(JSON.stringify({ passed: 5, scope: 'Installed NextAuth SessionProvider/useSession/update plus actual checkout provider and client; synthetic status transport only, no Stripe/DB/browser purchase.' }))
})().catch(error => { console.error = originalError; console.error(error); console.error(warnings); process.exitCode = 1 }).finally(() => { console.error = originalError; global.fetch = originalFetch; dom.window.close() })
