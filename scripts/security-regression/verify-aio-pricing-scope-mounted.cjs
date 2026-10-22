process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const repoRoot = process.env.DOYA_REPO_ROOT || path.resolve(__dirname, '../..')
const candidate = path.resolve(__dirname, '../..'), repo = Module.createRequire(path.join(repoRoot, 'package.json'))
const ts = repo('typescript'), React = repo('react'), runtime = repo('react/jsx-runtime')
const { JSDOM } = repo('jsdom'), { createRoot } = repo('react-dom/client')
const dom = new JSDOM('<main></main>', { url: 'https://example.invalid/aio/pricing?org=A' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
function load(rel, mocks = {}, extra = {}) {
  const file = fs.existsSync(path.join(candidate, rel)) ? path.join(candidate, rel) : path.join(repoRoot, rel)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const exports = {}
  require('node:vm').runInNewContext(code, { exports, require: id => { if (id in mocks) return mocks[id]; throw Error(`Unmocked ${id}`) },
    window: extra.window || dom.window, sessionStorage: extra.sessionStorage || dom.window.sessionStorage, AbortController, URL, URLSearchParams, Response, Headers,
    TextDecoder, Uint8Array, setTimeout, clearTimeout, fetch: extra.fetch, console,
    process: { env: { NEXT_PUBLIC_APP_URL: 'https://example.invalid', STRIPE_SECRET_KEY: 'synthetic-test-key' } },
    crypto: require('node:crypto') }, { filename: file })
  return exports
}
const selection = load('src/lib/organization-workspace-selection.ts')
const nav = load('src/lib/aio/billing-navigation.ts', { '@/lib/organization-workspace-selection': selection })
const trial = load('src/lib/trial.ts', {
  '@/lib/stripe': { stripe: {} },
  '@/lib/unified-plan': { isPaidPlan: () => false },
})
let actor = 'actor', role = 'owner', plan = 'FREE', id = 'org-A', currentProps = null
let readFails = false, readCalls = 0
let refreshCalls = 0
let ignoreHintWrites = false
const hintStorage = { getItem: key => window.sessionStorage.getItem(key),
  setItem: (key, value) => { if (!ignoreHintWrites) window.sessionStorage.setItem(key, value) } }
let actualButtonProps = null
const billing = load('src/lib/billing-response-client.ts')
const recovery = load('src/lib/checkout-recovery-client.ts', { './billing-response-client': billing })
const lifecycleState = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': require('node:crypto') })
const checkoutHttp = load('src/lib/account-lifecycle/checkout-http.ts', {
  'server-only': {}, './state': lifecycleState, './checkout-receipt': {}, './checkout': {}, './checkout-store': {},
  './checkout-provider': {}, './checkout-stripe-provider': {}, '@/lib/stripe': {},
  '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: actor, email: 'actor@example.invalid', name: 'Actor', stripeCustomerId: null }) } } },
})
const checkoutUrls = load('src/lib/account-lifecycle/checkout-urls.ts').checkoutUrls
const sealed = checkoutUrls({ version: 1, origin: 'https://example.invalid', recipe: 'generic',
  returnPath: '/aio/pricing', workingPath: '/aio' }, 'unified-pro', 'aio')
assert.equal(sealed.successUrl, 'https://example.invalid/aio?success=true&plan=pro&session_id={CHECKOUT_SESSION_ID}')
assert.equal(sealed.cancelUrl, 'https://example.invalid/aio/pricing?payment=cancelled')
const checkoutCalls = [], external = [], portalPosts = []
const portalSessions = []
const portalApi = load('src/app/api/stripe/portal/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => Response.json(body, options),
    redirect: url => Response.redirect(url) } },
  'next-auth': { getServerSession: async () => ({ user: { id: actor, email: 'actor@example.invalid' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/stripe': { resolveBillingCustomerId: async () => 'cus_synthetic',
    createCustomerPortalSession: async options => {
      portalSessions.push(options)
      return { url: 'https://billing.example.invalid/portal' }
    } },
  '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: actor, stripeCustomerId: 'cus_synthetic' }),
    update: async () => { throw Error('customer update must not run') } } } },
})
const portalRequest = (href, body) => ({ url: new URL(href, 'https://example.invalid').toString(),
  nextUrl: new URL(href, 'https://example.invalid'), json: async () => body })
let mode = 'ready'
let readySessionId = 'cs_scope'
const serverRequests = []
const syntheticPrices = new Proxy({}, { get: () => new Proxy({}, { get: () => ({ monthly: 'price_test', yearly: 'price_year' }) }) })
const checkoutRoute = load('src/app/api/stripe/checkout/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
  'next-auth': { getServerSession: async () => ({ user: { id: actor, email: 'actor@example.invalid' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/stripe': { STRIPE_PRICE_IDS: syntheticPrices, findActiveLikeSubscriptions: async () => [] },
  '@/lib/unified-plan': { UNIFIED_TRIAL_DAYS: 0 },
  '@/lib/services': { getActiveServices: () => [{ id: 'aio', dashboardHref: '/aio' }] },
  '@/lib/trial': { ...trial, isTrialEligible: async input => {
    assert.equal(input.email, 'actor@example.invalid')
    assert.equal(input.plan, 'FREE')
    assert.deepEqual(Array.from(input.servicePlans), [])
    return false
  } },
  '@/lib/prisma': { prisma: { user: { findUnique: async query => {
    assert.equal(query.where.id, actor)
    for (const field of ['id', 'email', 'stripeCustomerId', 'plan', 'serviceSubscriptions']) {
      assert.deepEqual(JSON.parse(JSON.stringify(query.select[field])), JSON.parse(JSON.stringify(field === 'serviceSubscriptions' ? trial.TRIAL_USER_SELECT.serviceSubscriptions : true)))
    }
    return { id: actor, email: 'actor@example.invalid', name: 'Actor', stripeCustomerId: null,
      plan: 'FREE', serviceSubscriptions: [] }
  } } } },
  '@/lib/hr/organization-selection': { parseHrOrganizationSelection: () => { throw Error('HR scope must not be read') } },
  '@/lib/account-lifecycle/state': lifecycleState,
  '@/lib/account-lifecycle/checkout-urls': { checkoutUrls },
  '@/lib/account-lifecycle/checkout-http': { ...checkoutHttp,
    currentCheckoutEpoch: async () => 'c28631ee-c1d8-49e3-853a-5b5d8753b328',
    runCheckoutHttpAction: async (action, actorId, start) => {
      assert.equal(actorId, actor)
      if (action.action === 'start') {
        if (mode === 'plan_change') throw new lifecycleState.LifecycleError('PLAN_CHANGE_REQUIRED', 409)
        serverRequests.push(await start())
        return { operationId: action.operationId, url: 'https://checkout.example.invalid/start' }
      }
      if (action.action === 'ready') return { id: readySessionId, operationId: action.operationId, url: 'https://checkout.example.invalid/ready' }
      throw Error(`unexpected server action ${action.action}`)
    },
  },
  '@/lib/account-lifecycle/checkout-stripe-provider': { stripeModeFromSecret: () => 'test' },
}).POST
const createManager = () => new recovery.CheckoutRecoveryClient('actor', () => window.sessionStorage, async body => {
  checkoutCalls.push(body)
  const response = await checkoutRoute({ json: async () => body, headers: new Headers() })
  return { ok: response.ok, status: response.status, data: await response.json() }
}, () => require('node:crypto').randomUUID())
let manager = createManager()
const fakeWindow = { location: { pathname: '/aio/pricing', set href(value) { external.push(value) }, assign(value) { external.push(value) }, reload() {} } }
const CheckoutButton = load('src/components/CheckoutButton.tsx', {
  react: React, 'react/jsx-runtime': runtime,
  'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: actor, plan: 'FREE' } } }) },
  'next/navigation': { usePathname: () => '/aio/pricing', useRouter: () => ({ push() {} }) },
  'lucide-react': { Loader2: () => null, Zap: () => null, CreditCard: () => null },
  'react-hot-toast': { error() {}, loading() {}, success() {}, dismiss() {} },
  '@/lib/billing-response-client': { ...billing, readBillingResponse: async (url, init) => {
    if (url !== '/api/stripe/portal') throw Error(`unexpected ${url}`)
    const body = JSON.parse(init.body)
    portalPosts.push(body)
    const response = await portalApi.POST(portalRequest(url, body))
    return { ok: response.ok, status: response.status, data: await response.json() }
  } },
  '@/lib/checkout-recovery-client': recovery,
  '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager,
    snapshot: React.useSyncExternalStore(manager.subscribe, manager.snapshot) }) },
  '@/lib/plan-utils': { paidTierFromSyncResult: () => 'PRO' },
}, { window: fakeWindow }).CheckoutButton
let activeSlug = 'A'
const privateApi = load('src/lib/private-api-response.ts', {
  'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
})
const navigationRoute = load('src/app/api/aio/billing-navigation/route.ts', {
  'next/server': {}, 'next-auth': { getServerSession: async () => ({ user: { id: actor } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma: { aioMember: { findMany: async () => [{
    role, organization: { id, slug: activeSlug, name: activeSlug },
  }] } } },
  '@/lib/private-api-response': privateApi,
  '@/lib/aio/access': { getAioContext: async slug => slug === activeSlug
    ? { userId: actor, organizationId: id, organizationSlug: activeSlug, role } : null },
  '@/lib/aio/billing': { getAioBilling: async () => ({ plan }) },
  '@/lib/aio/types': { ROLE_HIERARCHY: { owner: 3, member: 1 } },
  '@/lib/organization-workspace-selection': selection,
}).GET
const navigationTransport = load('src/lib/billing-response-client.ts', {}, { fetch: async (url, init) => {
  readCalls++
  if (readFails) throw Error('synthetic read unavailable')
  const requestUrl = new URL(url, 'https://example.invalid')
  const response = await navigationRoute({ nextUrl: requestUrl, headers: new Headers(init.headers) })
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.match(response.headers.get('Vary'), /Cookie/)
  return response
} })
const navigationAdapter = load('src/lib/aio/billing-navigation-client.ts', {
  '@/lib/billing-response-client': navigationTransport,
  './billing-navigation': nav,
  '@/lib/organization-workspace-selection': selection,
})
const read = navigationAdapter.readAioBillingNavigation
const UnifiedPricingPlans = load('src/components/UnifiedPricingPlans.tsx', {
  react: React, 'react/jsx-runtime': runtime,
  'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: actor, plan: 'FREE' } } }) },
  'next/navigation': { usePathname: () => '/aio/pricing' },
  'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
  '@/lib/pricing': { ENTERPRISE_CONTACT_MAILTO: 'mailto:test@example.invalid' },
  '@/components/CheckoutButton': { CheckoutButton: props => { actualButtonProps = props; return React.createElement(CheckoutButton, props) } },
  '@/components/TrialCallout': { TrialBadge: () => null, TrialNote: () => null, useTrialEligible: () => false },
  '@/lib/services': { getServiceById: () => ({ id: 'aio', order: 1, features: [], pricing: { free: { limit: 'free' }, pro: { limit: 'pro', price: 9980 } }, dashboardHref: '/aio' }), getPublicServices: () => [] },
  '@/lib/plan-utils': { tierFrom: value => value, higherPlan: () => 'FREE' },
  '@/hooks/useBillingPlanResync': { useBillingPlanResync: () => ({ run() {}, busy: false, disabled: false, message: null }) },
  '@/lib/unified-plan': { UNIFIED_PRO_PRICE_LABEL: '9,980円', UNIFIED_PRO_PLAN_ID: 'banner-pro',
    UNIFIED_PLAN_COPY: { freeName: '無料', freeTagline: '無料', proName: 'プロ', proNote: 'プロ' } },
}, { window: fakeWindow }).UnifiedPricingPlans
const { AioPricingScope } = load('src/components/aio/AioPricingScope.tsx', {
  react: React, 'react/jsx-runtime': runtime,
  'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: actor } } }) },
  'next/navigation': { useRouter: () => ({ refresh: () => { refreshCalls++ } }) },
  'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
  '@/components/UnifiedPricingPlans': { UnifiedPricingPlans: props => { currentProps = props; return React.createElement(UnifiedPricingPlans, props) } },
  '@/lib/aio/billing-navigation-client': navigationAdapter,
  '@/lib/aio/billing-navigation': nav,
  '@/lib/organization-workspace-selection': selection,
}, { sessionStorage: hintStorage })
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
const expected = { actorId: 'actor', organizationId: 'org-A', slug: 'A', role: 'owner', plan: 'FREE' }
const tick = () => new Promise(resolve => setImmediate(resolve))
const flush = async () => React.act(async () => { await tick(); await tick() })
const persistedShow = () => { const event = new dom.window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true }); window.dispatchEvent(event) }
const render = async () => { await React.act(async () => root.render(React.createElement(AioPricingScope, { expected }))); await flush() }
;(async () => {
  await render()
  assert.equal(currentProps.canPurchase, true)
  assert.equal(actualButtonProps.actionGuard, currentProps.checkoutActionGuard)
  assert.equal(actualButtonProps.portalActionGuard, currentProps.portalNavigationGuard)
  await React.act(async () => { document.querySelector('button').click(); await new Promise(resolve => setImmediate(resolve)) })
  assert.equal(external[0], 'https://checkout.example.invalid/ready')
  assert.deepEqual(checkoutCalls.map(call => call.action), ['start', 'ready'])
  assert.equal(serverRequests.length, 1)
  assert.equal(serverRequests[0].source, 'generic')
  assert.equal(serverRequests[0].organizationId, null)
  assert.equal(serverRequests[0].terms.priceId, 'price_test')
  assert.equal(serverRequests[0].recovery.workingPath, '/aio')
  assert.equal(serverRequests[0].recovery.returnPath, '/aio/pricing')
  assert.equal(serverRequests[0].terms.successUrl, sealed.successUrl)
  assert.equal(serverRequests[0].terms.cancelUrl, sealed.cancelUrl)
  assert.equal(nav.readAioCheckoutHint(window.sessionStorage, actor, 'cs_scope').organizationId, 'org-A')
  console.log('PASS actual scope → Unified → CheckoutButton → manager → fresh session hint → external navigation')
  await React.act(async () => { [...document.querySelectorAll('button')].find(button => button.textContent.includes('ご契約中')).click(); await new Promise(resolve => setImmediate(resolve)) })
  const portalHref = new URL(external[1], 'https://example.invalid')
  assert.equal(portalHref.pathname, '/api/stripe/portal')
  const portalReturn = portalHref.searchParams.get('returnTo')
  const portalId = portalReturn.split('/').at(-1)
  assert.equal(nav.readAioPortalHint(window.sessionStorage, actor, portalId).organizationId, 'org-A')
  const getPortalResponse = await portalApi.GET(portalRequest(external[1]))
  assert.equal(getPortalResponse.headers.get('location'), 'https://billing.example.invalid/portal')
  assert.equal(portalSessions[0].returnUrl, `https://example.invalid${portalReturn}`)
  assert.equal(portalSessions[0].customerId, 'cus_synthetic')
  console.log('PASS actual Portal GET prepares per-departure UUID before external navigation')
  manager.dispose(); window.sessionStorage.removeItem(`doya-checkout-handle-v1:${encodeURIComponent(actor)}`)
  mode = 'plan_change'; manager = createManager()
  await render()
  await React.act(async () => { [...document.querySelectorAll('button')].find(button => button.textContent.includes('アップグレード')).click(); await new Promise(resolve => setImmediate(resolve)) })
  assert.equal(portalPosts.length, 1)
  assert.match(portalPosts[0].returnTo, /^\/aio\/billing-return\/portal\/[a-f0-9-]{36}$/)
  assert.equal(nav.readAioPortalHint(window.sessionStorage, actor, portalPosts[0].returnTo.split('/').at(-1)).organizationId, 'org-A')
  assert.equal(portalSessions[1].returnUrl, `https://example.invalid${portalPosts[0].returnTo}?portal_return=plan_change`)
  assert.equal(portalSessions[1].requirePlanChange, true)
  assert.equal(external[2], 'https://billing.example.invalid/portal')
  console.log('PASS actual CheckoutButton plan-change POST prepares distinct Portal UUID')
  assert.equal(currentProps.checkoutActionGuard.onCanonical, undefined)
  assert.equal(await currentProps.checkoutActionGuard.verify(new AbortController().signal), true)
  const fresh = { actorId: actor, operationId: 'e9f9880e-b48f-48c3-a153-d9225520a834', sessionId: 'cs_A', provenance: 'fresh' }
  assert.equal(currentProps.checkoutActionGuard.onReady(fresh), true)
  assert.equal(nav.readAioCheckoutHint(window.sessionStorage, actor, 'cs_A').organizationId, 'org-A')
  ignoreHintWrites = true
  assert.equal(currentProps.checkoutActionGuard.onReady({ actorId: actor,
    operationId: 'e9f9880e-b48f-48c3-a153-d9225520a830', sessionId: 'cs_ignored', provenance: 'fresh' }), false)
  assert.equal(nav.readAioCheckoutHint(window.sessionStorage, actor, 'cs_ignored'), null)
  ignoreHintWrites = false
  console.log('PASS ignored origin-hint write cannot authorize navigation')
  assert.equal(currentProps.checkoutActionGuard.onReady({ ...fresh, provenance: 'recovered', sessionId: 'cs_B' }), true)
  assert.equal(nav.readAioCheckoutHint(window.sessionStorage, actor, 'cs_B'), null)
  const furtherPortalId = 'e9f9880e-b48f-48c3-a153-d9225520a835'
  assert.equal(currentProps.portalNavigationGuard.prepareReturn(furtherPortalId), true)
  assert.equal(currentProps.portalNavigationGuard.returnPath(furtherPortalId), `/aio/billing-return/portal/${furtherPortalId}`)
  console.log('PASS actual scope carries fresh ready and guarded Portal GET/POST props')
  const old = currentProps.checkoutActionGuard
  window.dispatchEvent(new dom.window.Event('pagehide'))
  assert.equal(old.current(), false)
  assert.equal(old.onReady({ ...fresh, sessionId: 'cs_late' }), false)
  assert.equal(nav.readAioCheckoutHint(window.sessionStorage, actor, 'cs_late'), null)
  console.log('PASS pagehide retires retained callback before storage')
  readFails = true
  await React.act(async () => { persistedShow(); await tick() })
  await flush()
  const retryButton = [...document.querySelectorAll('button')].find(button => button.textContent === '再確認する')
  assert.ok(retryButton)
  const propsKey = Object.keys(retryButton).find(key => key.startsWith('__reactProps$'))
  const retainedRetry = retryButton[propsKey].onClick
  await React.act(async () => { window.dispatchEvent(new dom.window.Event('pagehide'))
    persistedShow(); await tick() })
  await flush()
  const beforeRetained = readCalls
  await React.act(async () => retainedRetry())
  await flush()
  assert.equal(readCalls, beforeRetained)
  console.log('PASS old pricing retry callback cannot start another read after persisted return')
  readFails = false; role = 'member'
  await React.act(async () => { persistedShow(); await tick() })
  await flush()
  assert.match(container.textContent, /組織の役割またはプランが更新されました/)
  const changedButton = [...document.querySelectorAll('button')].find(button => button.textContent === 'ページを再読み込みする')
  assert.ok(changedButton)
  assert.equal(container.querySelectorAll('button').length, 1)
  await React.act(async () => changedButton.click())
  assert.equal(refreshCalls, 1)
  assert.deepEqual(checkoutCalls.map(call => call.action), ['start', 'ready', 'start'])
  console.log('PASS fresh same-actor role drift has explicit SSR refresh without checkout or Portal')
  role = 'owner'; plan = 'PRO'
  await React.act(async () => { persistedShow(); await tick() })
  await flush()
  const planButton = [...document.querySelectorAll('button')].find(button => button.textContent === 'ページを再読み込みする')
  assert.ok(planButton)
  assert.equal(container.querySelectorAll('button').length, 1)
  await React.act(async () => planButton.click())
  assert.equal(refreshCalls, 2)
  assert.equal(portalPosts.length, 1)
  console.log('PASS fresh same-actor plan drift requests new SSR props without stale purchase')
  await React.act(async () => root.unmount()); manager.dispose()
  window.sessionStorage.removeItem(`doya-checkout-handle-v1:${encodeURIComponent(actor)}`)
  activeSlug = 'B'; id = 'org-B'; role = 'owner'; plan = 'FREE'; mode = 'ready'; readySessionId = 'cs_scopeB'
  manager = createManager()
  const second = createRoot(container)
  await React.act(async () => { second.render(React.createElement(AioPricingScope, { expected: {
    actorId: actor, organizationId: 'org-B', slug: 'B', role: 'owner', plan: 'FREE',
  } })); await tick() })
  await flush()
  const previousStarts = checkoutCalls.filter(call => call.action === 'start').length
  await React.act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent.includes('アップグレード')).click(); await tick() })
  assert.equal(checkoutCalls.filter(call => call.action === 'start').length, previousStarts + 1)
  assert.equal(nav.readAioCheckoutHint(window.sessionStorage, actor, 'cs_scope').slug, 'A')
  assert.equal(nav.readAioCheckoutHint(window.sessionStorage, actor, 'cs_scopeB').slug, 'B')
  const returnRead = async (requestActor, slug) => {
    assert.equal(requestActor, actor)
    const memberships = [{ id: 'org-A', slug: 'A', name: 'A', role: 'owner' },
      { id: 'org-B', slug: 'B', name: 'B', role: 'owner' }]
    const current = slug ? memberships.find(row => row.slug === slug) : null
    return { service: 'aio', actorId: actor, memberships, current: current ? { ...current, plan: 'PRO', canManageBilling: true } : null }
  }
  const markerRoute = load('src/lib/aio/billing-return-route.ts', { './billing-navigation': nav,
    './billing-return-correlation': load('src/lib/aio/billing-return-correlation.ts') })
  const entryRedirects = []
  const EntryPage = load('src/app/(shell)/aio/page.tsx', {
    'react/jsx-runtime': runtime,
    'next-auth': { getServerSession: async () => ({ user: { id: actor } }) },
    'next/navigation': { redirect: target => { entryRedirects.push(target); throw Error('NEXT_REDIRECT') } },
    '@/lib/auth': { authOptions: {} }, '@/lib/ui-next': { isUiNext: async () => true },
    '@/lib/aio/access': { listMemberships: async () => [{ slug: 'A' }, { slug: 'B' }] },
    './Entry': { default: () => null }, './Lp': { default: () => null },
    '@/lib/aio/billing-return-route': markerRoute,
  }).default
  const returnRouter = { replace() {} }
  const Return = load('src/components/aio/AioBillingReturn.tsx', {
    react: React, 'react/jsx-runtime': runtime,
    'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: actor } } }) },
    'next/navigation': { useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => returnRouter },
    'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
    '@/lib/aio/billing-navigation-client': { AioNavigationReadError: class extends Error {}, readAioBillingNavigation: returnRead },
    '@/lib/aio/billing-navigation': nav, '@/lib/aio/billing-return-route': markerRoute,
  }).AioBillingReturn
  await React.act(async () => second.unmount())
  for (const [sessionId, expectedSlug] of [['cs_scope', 'A'], ['cs_scopeB', 'B']]) {
    const success = new URL(sealed.successUrl.replace('{CHECKOUT_SESSION_ID}', sessionId))
    assert.equal(success.pathname, '/aio')
    await assert.rejects(EntryPage({ searchParams: Promise.resolve(Object.fromEntries(success.searchParams)) }), /NEXT_REDIRECT/)
    const target = entryRedirects.at(-1)
    assert.equal(new URL(target, success).pathname, `/aio/billing-return/checkout/${sessionId}`)
    window.history.replaceState(null, '', target)
    const returnRoot = createRoot(container)
    await React.act(async () => { returnRoot.render(React.createElement(Return, { kind: 'checkout', referenceId: sessionId })); await tick() })
    await flush()
    assert.ok([...container.querySelectorAll('a')].some(link => link.getAttribute('href') === `/aio/${expectedSlug}`))
    assert.ok(![...container.querySelectorAll('a')].some(link => link.getAttribute('href') === `/aio/${expectedSlug === 'A' ? 'B' : 'A'}` && link.textContent?.includes('元の組織')))
    await React.act(async () => returnRoot.unmount())
  }
  console.log('PASS actual two separate A/B checkout HTTP sessions retain immutable origin hints through actual Return consumer')
  const third = createRoot(container)
  const expectedB = { actorId: 'actor', organizationId: 'org-B', slug: 'B', role: 'owner', plan: 'FREE' }
  const renderThird = async () => { await React.act(async () => { third.render(React.createElement(AioPricingScope, { expected: expectedB })); await tick() }); await flush() }
  await renderThird()
  const oldGuard = currentProps.checkoutActionGuard
  actor = 'actor-other'; await renderThird()
  actor = 'actor'; await renderThird()
  const oldLate = { actorId: 'actor', operationId: '59cf8bf7-2ea0-4270-8abc-450210d83528', sessionId: 'cs_oldlate', provenance: 'fresh' }
  assert.equal(oldGuard.onReady(oldLate), false)
  assert.equal(nav.readAioCheckoutHint(window.sessionStorage, 'actor', 'cs_oldlate'), null)
  const freshGuard = currentProps.checkoutActionGuard
  assert.equal(freshGuard.onReady({ ...oldLate, sessionId: 'cs_currentB' }), true)
  assert.equal(nav.readAioCheckoutHint(window.sessionStorage, 'actor', 'cs_currentB').organizationId, 'org-B')
  await React.act(async () => third.unmount())
  console.log('PASS actual pricing actor A-B-A retires the old ready callback while current same-actor proof can save B')
  manager.dispose(); dom.window.close()
})().catch(error => { console.error(error); process.exitCode = 1 })
