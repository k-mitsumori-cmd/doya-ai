process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { JSDOM } = require('jsdom')
const { load } = require('./load-typescript.cjs')
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.invalid/banner/pricing' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client')
const runtime = require('react/jsx-runtime')
const tick = () => new Promise(resolve => setImmediate(resolve))
const source = ts.transpileModule(fs.readFileSync('src/components/CheckoutButton.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
const billing = load('src/lib/billing-response-client.ts')
const recovery = load('src/lib/checkout-recovery-client.ts', { './billing-response-client': billing }, { AbortController })
const planUtils = load('src/lib/plan-utils.ts')
const warnings = [], originalError = console.error
console.error = (...args) => warnings.push(args.map(String).join(' '))
async function fixture(realClient = false) {
  let status = 'authenticated', data = { user: { id: 'actor-one' } }, props = { planId: 'banner-pro' }, pathname = '/banner/pricing', onClick
  let readReply = async () => { throw Error('unexpected response read') }
  let checkoutReply = async () => { throw Error('unexpected checkout action') }
  const checkoutCalls = [], durable = new Map()
  const navigations = [], notices = [], calls = []
  const mockManager = {
    value: { phase: 'idle', handle: null, busy: false, dispatched: false, message: null },
    listeners: new Set(), subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }, snapshot() { return this.value },
    set(value) { this.value = { ...this.value, ...value }; for (const fn of this.listeners) fn() },
    async observe(intent, lease) { calls.push(['observe', intent]); if (!lease()) throw Error('stale') },
    async start(intent, lease) { calls.push(['start', intent]); if (!lease()) return null; this.set({ phase: 'completed', handle: { actorId: 'actor-one', scopeKey: recovery.checkoutScopeKey(intent) } }); return { kind: 'ready', url: 'https://checkout.stripe.com/c/pay/synthetic' } },
    async status(intent) { calls.push(['status', intent]) },
    async abortMissing(intent) { calls.push(['abort', intent]) },
    async resume(intent) { calls.push(['resume', intent]); return { kind: 'ready', url: 'https://checkout.stripe.com/c/pay/resumed' } },
    async readyAgain(intent) { calls.push(['ready', intent]); return { kind: 'ready', url: 'https://checkout.stripe.com/c/pay/ready' } },
    async newAfterTerminal(intent) { calls.push(['new', intent]); return { kind: 'ready', url: 'https://checkout.stripe.com/c/pay/new' } },
  }
  const manager = realClient ? new recovery.CheckoutRecoveryClient('actor-one', () => ({
    getItem: key => durable.get(key) ?? null, setItem: (key, value) => durable.set(key, value), removeItem: key => durable.delete(key),
  }), (body, headers, signal) => { checkoutCalls.push({ body, headers, signal }); return checkoutReply(body, headers, signal) }, () => crypto.randomUUID()) : mockManager
  const jsx = { ...runtime }
  for (const method of ['jsx', 'jsxs']) jsx[method] = (type, p, ...rest) => { if (type === 'button') onClick = p.onClick; return runtime[method](type, p, ...rest) }
  const location = { pathname, set href(url) { navigations.push(['href', url]) }, reload() { navigations.push(['reload']) } }
  const mocks = {
    react: React, 'react/jsx-runtime': jsx,
    'next-auth/react': { useSession: () => ({ status, data }) },
    'next/navigation': { usePathname: () => pathname, useRouter: () => ({ push: url => navigations.push(['router', url]) }) },
    'lucide-react': { Loader2: () => null, Zap: () => null, CreditCard: () => null },
    'react-hot-toast': { error: (message, options) => notices.push(['error', message, options]), loading: (message, options) => notices.push(['loading', message, options]), success: (message, options) => notices.push(['success', message, options]), dismiss() {} },
    '@/lib/billing-response-client': { ...billing, readBillingResponse: (...args) => readReply(...args) }, '@/lib/checkout-recovery-client': recovery,
    '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager, snapshot: React.useSyncExternalStore(manager.subscribe.bind(manager), manager.snapshot.bind(manager)) }) },
    '@/lib/plan-utils': planUtils,
  }
  const exports = {}; vm.runInNewContext(source, { exports, require: name => { assert.ok(name in mocks, name); return mocks[name] }, window: { location }, AbortController, console })
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
  const flush = async () => { await tick(); await tick() }
  const render = () => React.act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(exports.CheckoutButton, props))); await flush() })
  const click = () => React.act(async () => { container.querySelector('button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await flush() })
  const directTwice = () => React.act(async () => { void onClick(); void onClick(); await flush() })
  const change = value => React.act(async () => { manager.set(value); await flush() })
  const close = () => React.act(async () => { root.unmount(); if (realClient) manager.dispose(); await flush(); container.remove() })
  await render()
  return { container, navigations, notices, calls, manager, checkoutCalls, durable, render, click, directTwice, change, close,
    auth: (s, user) => { status = s; data = user }, props: value => { props = { ...props, ...value } }, path: value => { pathname = value },
    reply: fn => { readReply = fn }, checkoutReply: fn => { checkoutReply = fn } }
}
(async () => {
  const results = []
  const run = async (name, check, realClient = false) => { const f = await fixture(realClient); try { await check(f); results.push(name) } finally { await f.close() } }
  await run('Loading and missing actual actor never dispatch', async f => {
    f.auth('loading', null); await f.render(); await f.directTwice(); assert.equal(f.calls.filter(x => x[0] === 'start').length, 0)
    f.auth('authenticated', { user: {} }); await f.render(); await f.directTwice(); assert.equal(f.calls.filter(x => x[0] === 'start').length, 0)
  })
  await run('Guest login keeps callback and never submits checkout', async f => {
    f.auth('unauthenticated', null); await f.render(); await f.click()
    assert.deepEqual(f.navigations[0], ['router', '/auth/signin?callbackUrl=%2Fbanner'])
    assert.equal(f.container.querySelector('button').type, 'button')
    assert.equal(f.calls.filter(x => x[0] === 'start').length, 0)
  })
  await run('One click passes exact scoped intent and redirects only after manager authorization', async f => {
    await f.click(); const start = f.calls.find(x => x[0] === 'start'); assert.equal(start[1].serviceId, 'banner')
    assert.equal(start[1].returnTo, '/banner/pricing'); assert.equal(start[1].billingPeriod, 'monthly')
    assert.deepEqual(f.navigations[0], ['href', 'https://checkout.stripe.com/c/pay/synthetic'])
  })
  await run('Unknown and dispatched state only observe status', async f => {
    const handle = { actorId: 'actor-one', scopeKey: recovery.checkoutScopeKey({ planId: 'banner-pro', serviceId: 'banner', billingPeriod: 'monthly', returnTo: '/banner/pricing', organization: null }) }
    await f.change({ phase: 'unknown', handle, dispatched: true }); await f.click()
    assert.equal(f.calls.filter(x => x[0] === 'status').length, 1)
    assert.equal(f.calls.filter(x => ['start', 'resume'].includes(x[0])).length, 0)
  })
  await run('Missing requires explicit abort and cannot silently start', async f => {
    const handle = { actorId: 'actor-one', scopeKey: recovery.checkoutScopeKey({ planId: 'banner-pro', serviceId: 'banner', billingPeriod: 'monthly', returnTo: '/banner/pricing', organization: null }) }
    await f.change({ phase: 'missing', handle }); await f.click()
    assert.equal(f.calls.filter(x => x[0] === 'abort').length, 1)
    assert.equal(f.calls.filter(x => x[0] === 'start').length, 0)
  })
  await run('Foreign organization or plan handle cannot write or navigate', async f => {
    await f.change({ phase: 'completed', handle: { actorId: 'actor-one', scopeKey: 'other-org' } })
    assert.equal(f.container.querySelector('button').disabled, true); await f.directTwice()
    assert.equal(f.calls.filter(x => x[0] !== 'observe').length, 0); assert.equal(f.navigations.length, 0)
  })
  await run('Reserved resumes the same handle, completed reauthorizes ready', async f => {
    const handle = { actorId: 'actor-one', scopeKey: recovery.checkoutScopeKey({ planId: 'banner-pro', serviceId: 'banner', billingPeriod: 'monthly', returnTo: '/banner/pricing', organization: null }) }
    await f.change({ phase: 'reserved', handle, dispatched: false }); await f.click()
    assert.equal(f.calls.at(-1)[0], 'resume'); assert.equal(f.navigations[0][1], 'https://checkout.stripe.com/c/pay/resumed')
  })
  await run('Completed handle reauthorizes ready without a new start', async f => {
    const handle = { actorId: 'actor-one', scopeKey: recovery.checkoutScopeKey({ planId: 'banner-pro', serviceId: 'banner', billingPeriod: 'monthly', returnTo: '/banner/pricing', organization: null }) }
    await f.change({ phase: 'completed', handle }); await f.click()
    assert.equal(f.calls.at(-1)[0], 'ready'); assert.equal(f.calls.filter(x => x[0] === 'start').length, 0)
    assert.equal(f.navigations[0][1], 'https://checkout.stripe.com/c/pay/ready')
  })
  await run('Verified expiry requires explicit successor action', async f => {
    const handle = { actorId: 'actor-one', scopeKey: recovery.checkoutScopeKey({ planId: 'banner-pro', serviceId: 'banner', billingPeriod: 'monthly', returnTo: '/banner/pricing', organization: null }) }
    await f.change({ phase: 'expired', handle }); assert.match(f.container.querySelector('button').textContent, /新しく申し込む/)
    assert.equal(f.calls.filter(x => x[0] === 'new').length, 0); await f.click(); assert.equal(f.calls.at(-1)[0], 'new')
  })
  await run('Plan change keeps the existing portal branch and its return path', async f => {
    f.manager.start = async intent => { f.calls.push(['start', intent]); return { kind: 'plan_change' } }
    f.reply(async (path, init) => { assert.equal(path, '/api/stripe/portal'); assert.deepEqual(JSON.parse(init.body), { returnTo: '/banner/pricing', purpose: 'plan_change' }); return { ok: true, data: { url: 'https://billing.stripe.com/p/synthetic' } } })
    await f.click(); assert.equal(f.calls.filter(x => x[0] === 'start').length, 1)
    assert.equal(f.navigations[0][1], 'https://billing.stripe.com/p/synthetic')
  })
  await run('Subscription sync claims reflection only after confirmed paid tier', async f => {
    f.manager.start = async intent => { f.calls.push(['start', intent]); return { kind: 'subscribed' } }
    f.reply(async path => { assert.equal(path, '/api/stripe/sync/latest'); return { ok: true, data: { ok: true, plan: 'PRO' } } })
    await f.click(); assert.equal(f.navigations[0][0], 'reload'); assert.equal(f.notices.filter(x => x[0] === 'success').length, 1)
  })
  await run('Provider Session completion is not a paid claim until sync confirms the tier', async f => {
    const handle = { actorId: 'actor-one', scopeKey: recovery.checkoutScopeKey({ planId: 'banner-pro', serviceId: 'banner', billingPeriod: 'monthly', returnTo: '/banner/pricing', organization: null }) }
    await f.change({ phase: 'provider_complete', handle }); f.reply(async path => { assert.equal(path, '/api/stripe/sync/latest'); return { ok: true, data: { ok: true, plan: 'FREE' } } })
    await f.click(); assert.equal(f.navigations.length, 0); assert.equal(f.notices.filter(x => x[0] === 'success').length, 0)
  })
  await run('Unconfirmed subscription sync never claims reflection', async f => {
    f.manager.start = async intent => { f.calls.push(['start', intent]); return { kind: 'subscribed' } }
    f.reply(async () => ({ ok: true, data: { ok: true, plan: 'FREE' } }))
    await f.click(); assert.equal(f.navigations.length, 0); assert.equal(f.notices.filter(x => x[0] === 'success').length, 0)
    assert.match(f.container.textContent, /契約の反映を確認できませんでした/)
  })
  await run('Invalid organization actor blocks purchase before the manager', async f => {
    f.props({ billingOrganization: { actor: 'other', organizationId: 'org-a' } }); await f.render(); await f.directTwice()
    assert.equal(f.container.querySelector('button').disabled, true)
    assert.equal(f.calls.filter(x => x[0] === 'start').length, 0)
  })
  for (const [code, secondary] of [['PLAN_CHANGE_REQUIRED', 'portal'], ['ALREADY_SUBSCRIBED', 'sync']]) {
    await run(`${code} secondary ${secondary} failure leaves explicit status recovery enabled`, async f => {
      f.checkoutReply(async body => body.action === 'start'
        ? { ok: false, status: 409, data: { code } }
        : { ok: true, status: 200, data: { actorId: 'actor-one', operationId: body.operationId, phase: 'missing', dispatched: false } })
      f.reply(async path => secondary === 'portal'
        ? Promise.reject(Error('synthetic portal outage'))
        : { ok: true, data: { ok: true, plan: 'FREE' } })
      await f.click()
      assert.equal(f.checkoutCalls[0].body.action, 'start')
      assert.equal(f.manager.snapshot().phase, 'unknown')
      assert.equal(f.container.querySelector('button').disabled, false)
      assert.match(f.container.querySelector('button').textContent, /申込状況を確認/)
      assert.equal(f.navigations.length, 0)
      await f.click()
      assert.deepEqual(f.checkoutCalls.map(x => x.body.action), ['start', 'status'])
      assert.equal(f.manager.snapshot().phase, 'missing')
      assert.equal(f.checkoutCalls[0].body.operationId, f.checkoutCalls[1].body.operationId)
    }, true)
  }
  await run('Aborted monthly handle permits an explicit yearly start without reusing an expired predecessor', async f => {
    let initialOperation
    f.checkoutReply(async body => {
      if (body.action === 'start') {
        if (!initialOperation) initialOperation = body.operationId
        return { ok: true, status: 200, data: { actorId: 'actor-one', operationId: body.operationId, url: 'https://checkout.stripe.com/c/pay/synthetic' } }
      }
      if (body.action === 'ready') return { ok: true, status: 200, data: { actorId: 'actor-one', operationId: body.operationId, sessionId: 'cs_synthetic', url: 'https://checkout.stripe.com/c/pay/synthetic' } }
      if (body.action === 'status') return { ok: true, status: 200, data: { actorId: 'actor-one', operationId: body.operationId, phase: 'aborted', dispatched: false } }
      throw Error(`unexpected action ${body.action}`)
    })
    await f.click()
    assert.equal(f.manager.snapshot().phase, 'completed')
    await React.act(async () => { await f.manager.status({ planId: 'banner-pro', billingPeriod: 'monthly', serviceId: 'banner', returnTo: '/banner/pricing', organization: null }) })
    assert.equal(f.manager.snapshot().phase, 'aborted')
    f.props({ billingPeriod: 'yearly' }); await f.render()
    assert.equal(f.container.querySelector('button').disabled, false)
    assert.match(f.container.querySelector('button').textContent, /新しく申し込む/)
    await f.click()
    assert.deepEqual(f.checkoutCalls.filter(x => x.body.action === 'start').map(x => x.body.billingPeriod), ['monthly', 'yearly'])
    assert.equal(f.checkoutCalls.filter(x => x.body.action === 'start_after_terminal').length, 0)
    assert.notEqual(f.manager.snapshot().handle.operationId, initialOperation)
  }, true)
  await run('Expired monthly handle keeps a different yearly intent blocked', async f => {
    let readyReads = 0
    f.checkoutReply(async body => body.action === 'start' || body.action === 'ready' && ++readyReads === 1
      ? { ok: true, status: 200, data: { actorId: 'actor-one', operationId: body.operationId, sessionId: 'cs_synthetic', url: 'https://checkout.stripe.com/c/pay/synthetic' } }
      : { ok: false, status: 409, data: { code: 'CHECKOUT_EXPIRED' } })
    await f.click()
    await React.act(async () => { await f.manager.readyAgain({ planId: 'banner-pro', billingPeriod: 'monthly', serviceId: 'banner', returnTo: '/banner/pricing', organization: null }) })
    assert.equal(f.manager.snapshot().phase, 'expired')
    f.props({ billingPeriod: 'yearly' }); await f.render()
    assert.equal(f.container.querySelector('button').disabled, true)
    await f.directTwice()
    assert.equal(f.checkoutCalls.filter(x => x.body.action === 'start').length, 1)
    assert.equal(f.checkoutCalls.filter(x => x.body.action === 'start_after_terminal').length, 0)
  }, true)
  assert.equal(warnings.length, 0, JSON.stringify(warnings))
  console.log(JSON.stringify({ passed: results.length, results, scope: 'Actual CheckoutButton mounted in React StrictMode; synthetic shared manager, auth, navigation. Real Stripe/DB not used.' }))
})().catch(error => { console.error = originalError; console.error(error); process.exitCode = 1 }).finally(() => { console.error = originalError; dom.window.close() })
