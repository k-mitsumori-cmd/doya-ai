process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const crypto = require('node:crypto')
const root = process.env.DOYA_REPO_ROOT || path.resolve(__dirname, '../..')
const candidate = process.env.DOYA_AIO_CANDIDATE || path.resolve(__dirname, '../..')
const useCandidate = process.env.DOYA_AIO_BEFORE !== '1'
const ts = Module.createRequire(path.join(root, 'package.json'))('typescript')
const requireRepo = Module.createRequire(path.join(root, 'package.json'))
const hashes = {}
const cache = new Map()
function load(rel, mocks = {}) {
  const file = (useCandidate || !fs.existsSync(path.join(root, rel))) && fs.existsSync(path.join(candidate, rel))
    ? path.join(candidate, rel) : path.join(root, rel)
  const key = `${file}:${Object.keys(mocks).sort().join(',')}`
  if (cache.has(key)) return cache.get(key).exports
  const mod = new Module(file)
  cache.set(key, mod)
  const bytes = fs.readFileSync(file)
  hashes[rel] = crypto.createHash('sha256').update(bytes).digest('hex')
  mod.require = id => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id]
    if (id === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    if (id === './billing-return-correlation' || id === '@/lib/aio/billing-return-correlation') return load('src/lib/aio/billing-return-correlation.ts')
    if (id === './billing-navigation' || id === '@/lib/aio/billing-navigation') return load('src/lib/aio/billing-navigation.ts')
    if (id === '@/lib/aio/billing-return-route') return load('src/lib/aio/billing-return-route.ts')
    if (id === './billing-response-client') return { billingRedirectUrl: raw => typeof raw === 'string' && raw.startsWith('https://checkout.example.invalid/') ? raw : null }
    throw Error(`Unmocked ${id} in ${rel}`)
  }
  mod._compile(ts.transpileModule(bytes.toString('utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, file)
  return mod.exports
}
let cases = 0
const check = async (name, callback) => { await callback(); cases++; console.log(`PASS ${name}`) }
async function main() {
  const urls = load('src/lib/account-lifecycle/checkout-urls.ts').checkoutUrls
  const binding = { version: 1, origin: 'https://example.invalid', recipe: 'generic', returnPath: '/aio/pricing', workingPath: '/aio' }
  const pair = urls(binding, 'unified-pro', 'aio')
  await check('actual sealed generic URL lacks an organization', () => {
    assert.equal(pair.successUrl, 'https://example.invalid/aio?success=true&plan=pro&session_id={CHECKOUT_SESSION_ID}')
    assert.equal(pair.cancelUrl, 'https://example.invalid/aio/pricing?payment=cancelled')
  })
  const redirects = []
  const page = load('src/app/(shell)/aio/page.tsx', {
    'react/jsx-runtime': Module.createRequire(path.join(root, 'package.json'))('react/jsx-runtime'),
    'next-auth': { getServerSession: async () => ({ user: { id: 'actor-A' } }) },
    'next/navigation': { redirect: target => { redirects.push(target); throw Error('NEXT_REDIRECT') } },
    '@/lib/auth': { authOptions: {} }, '@/lib/ui-next': { isUiNext: async () => true },
    '@/lib/aio/access': { listMemberships: async () => [{ slug: 'A' }, { slug: 'B' }] },
    './Entry': { default: () => null }, './Lp': { default: () => null },
    '@/lib/aio/billing-return-route': load('src/lib/aio/billing-return-route.ts'),
  }).default
  await check('actual AIO entry redirects marked checkout before latest-B entry', async () => {
    await assert.rejects(page({ searchParams: Promise.resolve({ success: 'true', plan: 'pro', session_id: 'cs_A' }) }), /NEXT_REDIRECT/)
    assert.deepEqual(redirects, ['/aio/billing-return/checkout/cs_A?success=true&session_id=cs_A&plan=pro'])
    await assert.rejects(page({ searchParams: Promise.resolve({}) }), /NEXT_REDIRECT/)
    assert.equal(redirects[1], '/aio/B/scan')
  })
  const route = load('src/lib/aio/billing-return-route.ts')
  const nav = load('src/lib/aio/billing-navigation.ts')
  await check('session stays in the path across sync query clearing', () => {
    const url = route.aioReturnRedirect({ success: 'true', plan: 'pro', session_id: 'cs_A' })
    assert.equal(url, '/aio/billing-return/checkout/cs_A?success=true&session_id=cs_A&plan=pro')
    assert.equal(new URL(url, 'https://example.invalid').pathname, '/aio/billing-return/checkout/cs_A')
    assert.equal(route.aioReturnRedirect({ payment: 'cancelled' }), '/aio/billing-return/cancelled')
    assert.equal(route.aioReturnRedirect({ portal_return: 'plan_change' }), '/aio/billing-return/unknown?portal_return=plan_change')
    assert.equal(route.aioReturnRedirect({ success: 'true', session_id: ['cs_A', 'cs_B'] }), '/aio/billing-return/unknown')
    for (const invalid of [
      { success: 'true', session_id: 'cs_A', payment: ['cancelled', 'x'] },
      { success: 'true', session_id: 'cs_A', portal_return: ['plan_change', 'x'] },
      { success: 'true', session_id: 'cs_A', payment: null },
      { success: 'true', session_id: 'cs_A', portal_return: {} },
      { success: 'true', session_id: 'cs_A', plan: ['pro', 'free'] },
    ]) assert.equal(route.aioReturnRedirect(invalid), '/aio/billing-return/unknown')
    assert.equal(route.aioReturnRedirect({}), null)
    assert.equal(route.aioDedicatedReturnMarkerValid('checkout', 'cs_A', { success: 'true', session_id: 'cs_A' }), true)
    assert.equal(route.aioDedicatedReturnMarkerValid('checkout', 'cs_A', { success: 'true', session_id: 'cs_B' }), false)
    assert.equal(route.aioDedicatedReturnMarkerValid('checkout', 'cs_A', { success: 'true', session_id: ['cs_A', 'cs_B'] }), false)
    assert.equal(route.aioDedicatedReturnMarkerValid('checkout', 'cs_A', {}), true)
    assert.equal(route.aioUnknownReturnPath({ success: 'true', session_id: 'cs_B' }), '/aio/billing-return/unknown?success=true&session_id=cs_B')
    assert.equal(route.aioDedicatedReturnMarkerValid('unknown', null, { success: 'true', session_id: 'cs_B' }), true)
    assert.equal(route.aioDedicatedReturnMarkerValid('unknown', null, { portal_return: 'plan_change' }), true)
    assert.equal(route.aioDedicatedReturnMarkerValid('unknown', null, { success: ['true', 'true'], session_id: 'cs_B' }), false)
  })
  const directRedirects = []
  const directPage = load('src/app/(shell)/aio/billing-return/[...segments]/page.tsx', {
    'react/jsx-runtime': requireRepo('react/jsx-runtime'), react: requireRepo('react'),
    '@/components/aio/AioBillingReturn': { AioBillingReturn: () => null },
    '@/lib/aio/billing-navigation': nav,
    '@/lib/aio/billing-return-route': route,
    'next/navigation': { redirect: url => { directRedirects.push(url); throw Error('NEXT_REDIRECT') } },
  }).default
  await check('actual dedicated return page rejects a mismatched or duplicated session before sync mounts', async () => {
    for (const query of [{ success: 'true', session_id: 'cs_B' }, { success: 'true', session_id: ['cs_A', 'cs_B'] },
      { success: 'true', session_id: 'cs_A', payment: 'cancelled' }]) {
      await assert.rejects(directPage({ params: Promise.resolve({ segments: ['checkout', 'cs_A'] }), searchParams: Promise.resolve(query) }), /NEXT_REDIRECT/)
      assert.equal(directRedirects.at(-1), query.session_id === 'cs_B' ?
        '/aio/billing-return/unknown?success=true&session_id=cs_B' : '/aio/billing-return/unknown')
    }
    assert.ok(await directPage({ params: Promise.resolve({ segments: ['checkout', 'cs_A'] }), searchParams: Promise.resolve({}) }))
    assert.ok(await directPage({ params: Promise.resolve({ segments: ['unknown'] }),
      searchParams: Promise.resolve({ success: 'true', session_id: 'cs_B' }) }))
    assert.ok(await directPage({ params: Promise.resolve({ segments: ['unknown'] }),
      searchParams: Promise.resolve({ portal_return: 'plan_change' }) }))
  })
  await check('actual entry rejects a duplicate cancel or portal marker before valid success', async () => {
    for (const extra of [{ payment: ['cancelled', 'x'] }, { portal_return: ['plan_change', 'x'] }]) {
      await assert.rejects(page({ searchParams: Promise.resolve({ success: 'true', session_id: 'cs_A', ...extra }) }), /NEXT_REDIRECT/)
      assert.equal(redirects.at(-1), '/aio/billing-return/unknown')
    }
  })
  const actor = 'actor-A', orgA = { id: 'org-A', slug: 'A', name: 'A', role: 'owner' }
  const orgB = { id: 'org-B', slug: 'B', name: 'B', role: 'owner' }
  const memory = new Map()
  let ignoreWrites = false
  const storage = { getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => { if (!ignoreWrites) memory.set(key, value) } }
  const opA = crypto.randomUUID(), opB = crypto.randomUUID()
  await check('actor/session navigation hints are immutable across later B', () => {
    const a = { version: 1, kind: 'checkout', actorId: actor, organizationId: orgA.id, slug: 'A', operationId: opA, sessionId: 'cs_A' }
    const b = { ...a, organizationId: orgB.id, slug: 'B', operationId: opB, sessionId: 'cs_B' }
    assert.equal(nav.saveAioCheckoutHint(storage, a), true)
    assert.equal(nav.saveAioCheckoutHint(storage, b), true)
    assert.equal(nav.readAioCheckoutHint(storage, actor, 'cs_A').organizationId, 'org-A')
    assert.equal(nav.saveAioCheckoutHint(storage, { ...b, sessionId: 'cs_A' }), false)
    assert.equal(nav.readAioCheckoutHint(storage, actor, 'cs_A').organizationId, 'org-A')
    assert.equal(nav.readAioCheckoutHint(storage, 'other', 'cs_A'), null)
  })
  await check('portal departures have separate immutable UUIDs', () => {
    const one = { version: 1, kind: 'portal', actorId: actor, organizationId: orgA.id, slug: 'A', navigationId: opA }
    const two = { ...one, organizationId: orgB.id, slug: 'B', navigationId: opB }
    assert.equal(nav.saveAioPortalHint(storage, one), true)
    assert.equal(nav.saveAioPortalHint(storage, two), true)
    assert.equal(nav.readAioPortalHint(storage, actor, opA).slug, 'A')
    assert.equal(nav.saveAioPortalHint(storage, { ...two, navigationId: opA }), false)
    assert.equal(nav.readAioPortalHint(storage, actor, opB).slug, 'B')
  })
  let portalSession = null, portalCustomer = 'customer', providerReturn = null
  const portalApi = load('src/app/api/stripe/portal/route.ts', {
    'next/server': { NextResponse: { json: Response.json, redirect: value => Response.redirect(value) } },
    'next-auth': { getServerSession: async () => portalSession }, '@/lib/auth': { authOptions: {} },
    '@/lib/stripe': { resolveBillingCustomerId: async () => portalCustomer,
      createCustomerPortalSession: async input => { providerReturn = input; return { url: 'https://billing.example.invalid/portal' } } },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: actor, stripeCustomerId: 'customer' }) } } },
  })
  const portalRequest = (returnPath, method = 'GET') => ({ url: `https://example.invalid/api/stripe/portal?returnTo=${encodeURIComponent(returnPath)}`,
    nextUrl: new URL(`https://example.invalid/api/stripe/portal?returnTo=${encodeURIComponent(returnPath)}`),
    json: async () => ({ returnTo: returnPath, purpose: 'plan_change' }) })
  await check('actual Portal GET/POST sanitizer retains the UUID, including signin/failure', async () => {
    const returnPath = `/aio/billing-return/portal/${opA}`
    portalSession = null
    let response = await portalApi.GET(portalRequest(returnPath))
    let callback = new URL(response.headers.get('location')).searchParams.get('callbackUrl')
    assert.equal(callback, `/api/stripe/portal?returnTo=${encodeURIComponent(returnPath)}`)
    providerReturn = null
    response = await portalApi.POST(portalRequest(returnPath, 'POST'))
    assert.equal(response.status, 401)
    assert.equal(providerReturn, null)
    portalSession = { user: { email: 'actor@example.invalid' } }
    portalCustomer = null
    response = await portalApi.GET(portalRequest(returnPath))
    assert.equal(new URL(response.headers.get('location')).searchParams.get('returnTo'), returnPath)
    portalCustomer = 'customer'
    response = await portalApi.GET(portalRequest(returnPath))
    assert.equal(response.status, 302)
    assert.equal(providerReturn.returnUrl, `https://example.invalid${returnPath}`)
    response = await portalApi.POST(portalRequest(returnPath, 'POST'))
    assert.equal(response.status, 200)
    assert.equal(providerReturn.returnUrl, `https://example.invalid${returnPath}?portal_return=plan_change`)
    assert.equal((await response.json()).url, 'https://billing.example.invalid/portal')
    portalCustomer = null
    response = await portalApi.GET(portalRequest(returnPath))
    const failed = new URL(response.headers.get('location'))
    const actualFailurePage = load('src/app/billing/portal-unavailable/page.tsx', {
      'react/jsx-runtime': requireRepo('react/jsx-runtime'),
      'next/link': { __esModule: true, default: ({ href, children }) => requireRepo('react').createElement('a', { href }, children) },
    }).default
    const tree = await actualFailurePage({ searchParams: Promise.resolve(Object.fromEntries(failed.searchParams)) })
    const links = []
    const walk = element => { if (!element || typeof element !== 'object') return
      if (element.props?.href) links.push(element.props.href)
      for (const child of [element.props?.children].flat(Infinity)) walk(child)
    }
    walk(tree)
    assert.deepEqual(links, [`/api/stripe/portal?returnTo=${encodeURIComponent(returnPath)}`, returnPath])
    portalCustomer = 'customer'
  })
  await check('read DTO accepts exact owner and rejects changed identity', () => {
    const good = { service: 'aio', actorId: actor, memberships: [orgA, orgB], current: { ...orgA, plan: 'FREE', canManageBilling: true } }
    assert.equal(nav.parseAioBillingRead(good, actor, 'A').current.id, 'org-A')
    assert.equal(nav.parseAioBillingRead({ ...good, current: { ...good.current, plan: 'GUEST' } }, actor, 'A').current.plan, 'GUEST')
    for (const changed of [
      { ...good, actorId: 'other' }, { ...good, current: { ...good.current, id: 'org-B' } },
      { ...good, current: { ...good.current, role: 'member' } }, { ...good, current: { ...good.current, plan: 'UNKNOWN' } },
      ...[['owner'], null, {}, 1].map(role => ({ ...good, memberships: [{ ...orgA, role }, orgB], current: { ...good.current, role } })),
      { ...good, memberships: [orgA, orgA] },
    ]) assert.throws(() => nav.parseAioBillingRead(changed, actor, 'A'))
    assert.throws(() => nav.parseAioBillingRead(good, actor, null))
  })
  await check('existing creator slugs remain valid without truncation or normalization', () => {
    const long = 'a'.repeat(120)
    const duplicate = `${long}-1760000000000`
    for (const slug of [long, duplicate, '日本語の組織']) {
      const row = { ...orgA, slug }
      const parsed = nav.parseAioBillingRead({ service: 'aio', actorId: actor, memberships: [row],
        current: { ...row, plan: 'FREE', canManageBilling: true } }, actor, slug)
      assert.equal(parsed.current.slug, slug)
    }
    for (const slug of ['', '.', '..', 'bad/path', 'bad?org=B', 'a'.repeat(513)]) {
      assert.throws(() => nav.parseAioBillingRead({ service: 'aio', actorId: actor, memberships: [], current: null }, actor, slug))
    }
  })
  const member = { userId: actor, status: 'ACTIVE', role: 'owner', createdAt: new Date(0),
    organization: { id: 'org-A', slug: 'A', name: 'A' } }
  let serverActor = actor, serverMember = member, billingPlan = 'FREE', serverContext = { userId: actor, organizationId: 'org-A', organizationSlug: 'A', role: 'owner' }
  const api = load('src/app/api/aio/billing-navigation/route.ts', {
    'next-auth': { getServerSession: async () => serverActor ? { user: { id: serverActor } } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { aioMember: { findMany: async () => Array.isArray(serverMember) ? serverMember : serverMember ? [serverMember] : [] },
      user: { findUnique: async () => null } } },
    '@/lib/private-api-response': load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: { json: Response.json } } }),
    '@/lib/aio/access': { getAioContext: async slug => slug === 'A' ? serverContext : null },
    '@/lib/aio/billing': { getAioBilling: async () => ({ plan: billingPlan }) },
    '@/lib/aio/types': { ROLE_HIERARCHY: { owner: 3, admin: 2, manager: 1, member: 0 } },
  })
  const apiRequest = (actorHeader, slug) => ({ headers: new Headers({ 'X-Aio-Actor-Id': actorHeader }),
    nextUrl: new URL(`https://example.invalid/api/aio/billing-navigation${slug === null ? '' : `?org=${encodeURIComponent(slug)}`}`) })
  await check('actual private read route rejects foreign actor/organization', async () => {
    let response = await api.GET(apiRequest(actor, 'A'))
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Cache-Control'), /private.*no-store/)
    assert.match(response.headers.get('Vary'), /Cookie/)
    assert.equal((await response.json()).current.id, 'org-A')
    response = await api.GET(apiRequest('other', 'A'))
    assert.equal(response.status, 409)
    serverContext = { ...serverContext, organizationId: 'other' }
    response = await api.GET(apiRequest(actor, 'A'))
    assert.equal(response.status, 409)
    serverContext = { ...serverContext, organizationId: 'org-A' }
    serverMember = null
    response = await api.GET(apiRequest(actor, 'A'))
    assert.equal(response.status, 403)
    serverMember = member
    serverActor = null
    response = await api.GET(apiRequest(actor, 'A'))
    assert.equal(response.status, 401)
    serverActor = actor
  })
  await check('actual private read route and parser reject changed membership identity, role and malformed plan', async () => {
    serverMember = { ...member, organization: { ...member.organization, id: 'org-other' } }
    assert.equal((await api.GET(apiRequest(actor, 'A'))).status, 409)
    serverMember = member
    serverContext = { ...serverContext, role: 'member' }
    assert.equal((await api.GET(apiRequest(actor, 'A'))).status, 409)
    serverMember = { ...member, role: 'member' }
    let response = await api.GET(apiRequest(actor, 'A'))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).current.canManageBilling, false)
    serverMember = [member, { ...member, organization: { ...member.organization, id: 'other' } }]
    assert.equal((await api.GET(apiRequest(actor, 'A'))).status, 503)
    serverMember = member; serverContext = { ...serverContext, role: 'owner' }
    billingPlan = 'UNKNOWN'
    response = await api.GET(apiRequest(actor, 'A'))
    assert.equal(response.status, 200)
    const unknownPlan = await response.json()
    assert.throws(() => nav.parseAioBillingRead(unknownPlan, actor, 'A'))
    billingPlan = 'FREE'
  })
  const React = requireRepo('react')
  const { JSDOM } = requireRepo('jsdom')
  const { createRoot } = requireRepo('react-dom/client')
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.invalid/aio/billing-return/checkout/cs_A' })
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
  Object.defineProperty(dom.window, 'sessionStorage', { value: storage, configurable: true })
  global.sessionStorage = storage
  let mountedActor = actor
  let returnRead = { service: 'aio', actorId: actor, memberships: [orgA, orgB], current: null }
  const returnNavigations = []
  const returnRouter = { replace: target => { returnNavigations.push(target); dom.window.history.replaceState(null, '', target) } }
  const Return = load('src/components/aio/AioBillingReturn.tsx', {
    react: React, 'react/jsx-runtime': requireRepo('react/jsx-runtime'),
    'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: mountedActor } } }) },
    'next/navigation': { useSearchParams: () => new URLSearchParams(window.location.search),
      useRouter: () => returnRouter },
    'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
    '@/lib/aio/billing-navigation-client': { AioNavigationReadError: class extends Error {}, readAioBillingNavigation: async (id, slug) => {
      if (id !== mountedActor) throw Error('actor changed')
      return slug === null ? { ...returnRead, actorId: id, memberships: id === actor ? returnRead.memberships : [orgB] } : {
        ...returnRead, actorId: id, current: { ...(returnRead.memberships.find(row => row.slug === slug) || orgB), plan: 'FREE', canManageBilling: true },
      }
    } },
  }).AioBillingReturn
  const app = createRoot(document.getElementById('app'))
  const settle = async () => { await React.act(async () => { await new Promise(resolve => setImmediate(resolve)) }) }
  const showReturn = async (kind, referenceId) => {
    await React.act(async () => { app.render(React.createElement(Return, { kind, referenceId })) })
    await settle()
    return [...document.querySelectorAll('a')].map(link => link.getAttribute('href'))
  }
  await check('actual return UI uses cs_A rather than latest B; cancel selects explicitly', async () => {
    assert.ok((await showReturn('checkout', 'cs_A')).includes('/aio/A'))
    const cancel = await showReturn('cancelled', null)
    assert.ok(cancel.includes('/aio/A') && cancel.includes('/aio/B'))
    assert.match(document.body.textContent, /元の組織を確認できませんでした/)
    await showReturn('checkout', 'cs_missing')
    assert.match(document.body.textContent, /元の組織を確認できませんでした/)
    mountedActor = 'other'
    assert.deepEqual((await showReturn('checkout', 'cs_A')).filter(x => x.startsWith('/aio/')), ['/aio/B'])
    assert.match(document.body.textContent, /元の組織を確認できませんでした/)
    mountedActor = actor
    returnRead = { ...returnRead, memberships: [{ ...orgA, id: 'replacement' }, orgB] }
    await showReturn('checkout', 'cs_A')
    assert.match(document.body.textContent, /元の組織を確認できませんでした/)
    returnRead = { ...returnRead, memberships: [orgA, orgB] }
    ignoreWrites = true
    dom.window.history.replaceState(null, '', '/aio/billing-return/checkout/cs_A?success=true&session_id=cs_B')
    await showReturn('checkout', 'cs_A')
    assert.match(document.body.textContent, /元の組織を確認できませんでした/)
    assert.equal(returnNavigations.at(-1), '/aio/billing-return/unknown?success=true&session_id=cs_B')
    assert.equal(nav.readAioCheckoutHint(storage, actor, 'cs_A').organizationId, 'org-A')
    ignoreWrites = false
    const descriptor = Object.getOwnPropertyDescriptor(global, 'sessionStorage')
    Object.defineProperty(global, 'sessionStorage', { configurable: true, get: () => { throw Error('storage denied') } })
    try {
      await showReturn('checkout', 'cs_missing')
      assert.match(document.body.textContent, /元の組織を確認できませんでした/)
    } finally { Object.defineProperty(global, 'sessionStorage', descriptor) }
  })
  await React.act(async () => app.unmount())
  await check('contradictory session remains a selector after query clearing and a fresh mount', async () => {
    const reload = createRoot(document.getElementById('app'))
    dom.window.history.replaceState(null, '', '/aio/billing-return/unknown')
    await React.act(async () => reload.render(React.createElement(Return, { kind: 'unknown', referenceId: null })))
    await settle()
    assert.match(document.body.textContent, /元の組織を確認できませんでした/)
    assert.equal(nav.readAioCheckoutHint(storage, actor, 'cs_A').organizationId, 'org-A')
    dom.window.history.replaceState(null, '', '/aio/billing-return/checkout/cs_A')
    await React.act(async () => reload.render(React.createElement(Return, { kind: 'checkout', referenceId: 'cs_A' })))
    await settle()
    assert.match(document.body.textContent, /元の組織の作業画面に戻る/)
    await React.act(async () => reload.unmount())
  })
  const { CheckoutRecoveryClient } = load('src/lib/checkout-recovery-client.ts')
  const intent = { planId: 'unified-pro', billingPeriod: 'monthly', serviceId: 'aio', returnTo: '/aio/pricing', organization: null }
  const handleStorage = new Map()
  const handlePort = { getItem: key => handleStorage.get(key) ?? null, setItem: (key, value) => handleStorage.set(key, value), removeItem: key => handleStorage.delete(key) }
  const ready = (data, status = 200) => ({ ok: status === 200, status, data })
  let canonical = null, responses = [], calls = []
  const client = new CheckoutRecoveryClient(actor, () => handlePort, async body => {
    calls.push(body.action)
    if (body.action === 'start') return ready({ actorId: actor, operationId: canonical || body.operationId, url: 'https://checkout.example.invalid/start' })
    return responses.shift() || ready({ actorId: actor, operationId: body.operationId, sessionId: 'cs_A', url: 'https://checkout.example.invalid/ready' })
  }, () => crypto.randomUUID())
  await client.observe(intent)
  const seen = []
  await check('actual recovery distinguishes fresh ready and readyAgain', async () => {
    assert.equal((await client.start(intent, () => true, value => seen.push(value))).kind, 'ready')
    assert.equal(seen[0].provenance, 'fresh')
    assert.equal(seen[0].sessionId, 'cs_A')
    assert.equal((await client.readyAgain(intent, () => true, value => seen.push(value))).kind, 'ready')
    assert.equal(seen[1].provenance, 'recovered')
    assert.deepEqual(calls, ['start', 'ready', 'ready'])
  })
  client.dispose()
  await check('newAfterTerminal creates a different UUID and fresh validated session only after an aborted predecessor', async () => {
    handleStorage.clear()
    const sent = [], observed = [], allocated = []
    let terminal = false
    const transport = async body => {
      sent.push(body)
      if (body.action === 'status') return ready({ actorId: actor, operationId: body.operationId,
        phase: terminal ? 'aborted' : 'completed', dispatched: false })
      if (body.action === 'start' || body.action === 'start_after_terminal') return ready({ actorId: actor,
        operationId: body.operationId, url: 'https://checkout.example.invalid/start' })
      return ready({ actorId: actor, operationId: body.operationId,
        sessionId: terminal ? 'cs_successor' : 'cs_predecessor', url: 'https://checkout.example.invalid/ready' })
    }
    const uuid = () => { const value = crypto.randomUUID(); allocated.push(value); return value }
    const successor = new CheckoutRecoveryClient(actor, () => handlePort, transport, uuid)
    await successor.observe(intent)
    assert.equal((await successor.start(intent, () => true, value => observed.push(value))).kind, 'ready')
    assert.equal(observed[0].provenance, 'fresh')
    terminal = true
    successor.dispose()
    const resumed = new CheckoutRecoveryClient(actor, () => handlePort, transport, uuid)
    await resumed.observe(intent)
    assert.equal(resumed.snapshot().phase, 'aborted')
    assert.equal((await resumed.newAfterTerminal(intent, () => true, value => observed.push(value))).kind, 'ready')
    assert.equal(allocated.length, 2)
    assert.notEqual(allocated[0], allocated[1])
    assert.equal(sent.filter(call => call.action === 'start').length, 2)
    assert.equal(observed[1].operationId, allocated[1])
    assert.equal(observed[1].sessionId, 'cs_successor')
    assert.equal(observed[1].provenance, 'fresh')
    resumed.dispose()
  })
  await check('lost first ready response restores only a recovered observation, never a fresh origin', async () => {
    handleStorage.clear()
    const lostCalls = [], before = new CheckoutRecoveryClient(actor, () => handlePort, async body => {
      lostCalls.push(body.action)
      if (body.action === 'start') return ready({ actorId: actor, operationId: body.operationId,
        url: 'https://checkout.example.invalid/start' })
      throw Error('synthetic noncooperative ready response lost')
    }, () => crypto.randomUUID())
    await before.observe(intent)
    const firstSeen = []
    assert.equal(await before.start(intent, () => true, value => firstSeen.push(value)), null)
    assert.equal(before.snapshot().phase, 'unknown')
    assert.deepEqual(lostCalls, ['start', 'ready'])
    assert.equal(firstSeen.length, 0)
    assert.equal(nav.readAioCheckoutHint(storage, actor, 'cs_lost'), null)
    before.dispose()
    const afterCalls = [], after = new CheckoutRecoveryClient(actor, () => handlePort, async body => {
      afterCalls.push(body.action)
      if (body.action === 'status') return ready({ actorId: actor, operationId: body.operationId,
        phase: 'completed', dispatched: false })
      return ready({ actorId: actor, operationId: body.operationId, sessionId: 'cs_lost',
        url: 'https://checkout.example.invalid/ready' })
    }, () => crypto.randomUUID())
    await after.observe(intent)
    assert.equal(after.snapshot().phase, 'completed')
    const recovered = []
    assert.equal((await after.readyAgain(intent, () => true, value => recovered.push(value))).kind, 'ready')
    assert.equal(recovered[0].provenance, 'recovered')
    assert.deepEqual(afterCalls, ['status', 'ready'])
    assert.equal(nav.readAioCheckoutHint(storage, actor, 'cs_lost'), null)
    after.dispose()
  })
  await check('canonical adoption is recovered even when request and response later agree', async () => {
    handleStorage.clear()
    const adopted = crypto.randomUUID(), seen = [], actions = []
    const pending = new CheckoutRecoveryClient(actor, () => handlePort, async body => {
      actions.push(body.action)
      return body.action === 'start' ? ready({ actorId: actor, operationId: adopted,
        url: 'https://checkout.example.invalid/start' }) : ready({ actorId: actor,
        operationId: body.operationId, sessionId: 'cs_adopted', url: 'https://checkout.example.invalid/ready' })
    }, () => crypto.randomUUID())
    await pending.observe(intent)
    assert.equal((await pending.start(intent, () => true, value => seen.push(value))).kind, 'ready')
    assert.equal(seen[0].operationId, adopted)
    assert.equal(seen[0].provenance, 'recovered')
    assert.deepEqual(actions, ['start', 'ready'])
    pending.dispose()
  })
  await check('ready without a validated session never yields a navigation', async () => {
    handleStorage.clear(); calls = []
    const invalid = new CheckoutRecoveryClient(actor, () => handlePort, async body => ready({ actorId: actor,
      operationId: body.operationId, ...(body.action === 'ready' ? { url: 'https://checkout.example.invalid/missing' } :
        { url: 'https://checkout.example.invalid/start' }) }), () => crypto.randomUUID())
    await invalid.observe(intent)
    let invoked = 0
    const result = await invalid.start(intent, () => true, () => invoked++)
    assert.equal(result, null)
    assert.equal(invalid.snapshot().phase, 'unknown')
    assert.equal(invoked, 0)
    invalid.dispose()
  })
  for (const [label, mutate] of [
    ['foreign actor', value => ({ ...value, actorId: 'foreign' })],
    ['foreign operation', value => ({ ...value, operationId: crypto.randomUUID() })],
    ['session array', value => ({ ...value, sessionId: ['cs_array'] })],
    ['invalid session', value => ({ ...value, sessionId: 'not_a_session' })],
    ['claimed error', value => ({ ...value, error: 'secret provider detail' })],
    ['claimed code', value => ({ ...value, code: 'OK' })],
  ]) await check(`ready ${label} cannot navigate or call the origin observer`, async () => {
    handleStorage.clear()
    const invalid = new CheckoutRecoveryClient(actor, () => handlePort, async body => {
      const data = { actorId: actor, operationId: body.operationId,
        url: body.action === 'ready' ? 'https://checkout.example.invalid/cs_plausible' : 'https://checkout.example.invalid/start',
        ...(body.action === 'ready' ? { sessionId: 'cs_valid' } : {}) }
      return ready(body.action === 'ready' ? mutate(data) : data)
    }, () => crypto.randomUUID())
    await invalid.observe(intent)
    let observed = 0
    assert.equal(await invalid.start(intent, () => true, () => observed++), null)
    assert.equal(invalid.snapshot().phase, 'unknown')
    assert.equal(observed, 0)
    invalid.dispose()
  })
  console.log(JSON.stringify({ cases, sourceHashes: hashes }))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
