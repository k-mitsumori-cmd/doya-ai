process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const root = process.env.DOYA_SOURCE_ROOT || path.resolve(__dirname, '../..')
const requireRepo = Module.createRequire(path.join(root, 'package.json'))
const React = requireRepo('react')
const ts = requireRepo('typescript')
const { JSDOM } = requireRepo('jsdom')
const { createRoot } = requireRepo('react-dom/client')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/quote?org=A' })
global.window = dom.window
global.document = dom.window.document
global.CustomEvent = dom.window.CustomEvent
global.IS_REACT_ACT_ENVIRONMENT = true
const sourceHashes = {}
const cache = new Map()
let mocks = {}
function load(rel) {
  const key = rel + ':' + (mocks.__phase || '')
  if (cache.has(key)) return cache.get(key).exports
  const candidate = path.join(process.env.DOYA_TEST_BASELINE || root, rel)
  const filename = fs.existsSync(candidate) ? candidate : path.join(root, rel)
  const mod = new Module(filename)
  cache.set(key, mod)
  mod.require = id => {
    if (id in mocks) return mocks[id]
    if (id === './services') return load('src/lib/services.ts')
    if (id === './unified-plan' || id === '@/lib/unified-plan') return load('src/lib/unified-plan.ts')
    if (id === '@/lib/service-limit-ui') return load('src/lib/service-limit-ui.ts')
    if (id === './organization-workspace-selection' || id === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    if (id === '@/lib/quote/checkout-origin-hint') return load('src/lib/quote/checkout-origin-hint.ts')
    if (id === '@/components/quote/QuoteWorkspaceBoundary') return load('src/components/quote/QuoteWorkspaceBoundary.tsx')
    if (id === '@/components/OrganizationPricingPlans') return load('src/components/OrganizationPricingPlans.tsx')
    if (id === '@/lib/billing-response-client') return load('src/lib/billing-response-client.ts')
    throw Error(`Unmocked ${id} from ${rel}`)
  }
  const bytes = fs.readFileSync(filename)
  sourceHashes[rel] = require('node:crypto').createHash('sha256').update(bytes).digest('hex')
  mod._compile(ts.transpileModule(bytes.toString('utf8'), { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename)
  return mod.exports
}
const next = () => new Promise(resolve => setImmediate(resolve))
const act = callback => React.act(async () => { await callback(); await next(); await next(); await next() })
let calls = { quota: 0, create: 0, provider: 0, workspace: [], billing: [] }
let quotaReached = true
const ctx = { organizationId: 'org-A', organizationSlug: 'A', userId: 'actor', role: 'owner' }
mocks = {
  __phase: 'route',
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { quoteIssuer: { findUnique: async () => null }, $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn({ quoteDocument: { create: async () => { calls.create++; return { id: 'doc-1', quoteNo: 'Q1' } } } }) } } },
  '@/lib/organization-billing': { getOrganizationOwnerUserId: async () => 'actor' },
  '@/lib/quote/access': { getQuoteContext: async slug => { assert.equal(slug, 'A'); return ctx }, orgSlugFrom: req => new URL(req.url).searchParams.get('org') || undefined },
  '@/lib/quote/document': { defaultExpiry: () => new Date('2026-11-22'), nextQuoteNo: async () => 'Q1', recalcDocument: async () => {} },
  '@/lib/plan-limit': { FREE_LIMITS: { quoteDocuments: 3 }, assertFreeLimit: async () => { calls.quota++; return quotaReached ? { ok: false, used: 100, limit: 100, reason: '今月の上限（100件）に達しました。追加をご希望の場合はお問い合わせよりご相談ください。' } : { ok: true, used: 2, limit: 3 } } },
  '@/lib/organization-quota-ledger': { getOrganizationQuotaUsage: async () => { if (quotaReached) throw Error('blocked path read quota'); return 2 }, recordOrganizationQuotaUsage: async () => { if (quotaReached) throw Error('blocked path write quota') } },
  '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
  '@/lib/service-usage': { recordServiceUsage: async () => { if (quotaReached) throw Error('blocked path usage') } },
}
const route = load('src/app/api/quote/documents/route.ts')
const request = () => new Request('https://example.invalid/api/quote/documents?org=A', { method: 'POST', body: '{}' })
async function main() {
  const blocked = await route.POST(request())
  assert.equal(blocked.status, 402)
  const body = await blocked.clone().json()
  assert.equal(body.code, 'LIMIT_REACHED')
  assert.equal(body.canManageBilling, true)
  assert.equal(body.upgradeUrl, undefined)
  assert.equal(body.contactUrl, 'https://doyamarke.surisuta.jp/contact')
  assert.equal(body.pricingUrl, '/quote/pricing?org=A')
  assert.equal(calls.quota, 1)
  assert.equal(calls.create, 0)
  quotaReached = false
  const allowed = await route.POST(request())
  assert.equal(allowed.status, 200)
  const normalReply = allowed.clone()
  assert.equal((await allowed.json()).id, 'doc-1')
  assert.equal(calls.create, 1)
  quotaReached = true

  // Actual fetch observer and actual modal. The only synthetic input is the
  // quota route's authority/Prisma result above; the route response is real.
  let session = { user: { id: 'actor', plan: 'PRO' } }
  let status = 'authenticated'
  let pathname = '/quote'
  let search = '?org=A'
  let reply = normalReply
  const originalFetch = async () => reply.clone()
  window.fetch = originalFetch
  mocks = {
    __phase: 'modal', react: React, 'react/jsx-runtime': requireRepo('react/jsx-runtime'),
    'react-dom': requireRepo('react-dom'),
    'next-auth/react': { useSession: () => ({ data: session, status }) },
    'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search) },
    '@/components/TrialCallout': { TrialNote: () => null, useTrialEligible: () => false, TRIAL_DAYS: 30 },
    '@/lib/pricing': { HIGH_USAGE_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
    '@/lib/plan-utils': { tierFrom: () => 'FREE' },
  }
  const provider = load('src/components/limits/ServiceLimitProvider.tsx').default
  const mounted = createRoot(document.getElementById('root'))
  await act(() => mounted.render(React.createElement(provider)))
  assert.equal(document.querySelector('[role=dialog]'), null)
  const normal = await window.fetch('/api/quote/documents?org=A', { method: 'POST' })
  assert.equal(normal.status, 200)
  await act(async () => {})
  assert.equal(document.querySelector('[role=dialog]'), null, 'successful actual route response does not make a limit notice')
  reply = blocked
  const returned = await window.fetch('/api/quote/documents?org=A', { method: 'POST' })
  assert.equal(returned.status, 402)
  assert.equal((await returned.json()).code, 'LIMIT_REACHED')
  await act(async () => {})
  const dialog = document.querySelector('[role=dialog]')
  assert.ok(dialog, 'actual provider sees actual route response')
  assert.equal(dialog.querySelector('a').getAttribute('href'), 'https://doyamarke.surisuta.jp/contact')
  const href = [...dialog.querySelectorAll('a')].find(a => a.getAttribute('href')?.startsWith('/quote/pricing'))?.getAttribute('href')
  assert.equal(href, '/quote/pricing?org=A', 'verified A retained in actual modal href')
  await act(() => dialog.querySelector('button[aria-label="閉じる"]').click())
  reply = Response.json({ ...body, pricingUrl: '/quote/pricing' }, { status: 402 })
  await window.fetch('/api/quote/action?org=A', { method: 'POST' })
  await act(async () => {})
  const invalidPaidNotice = document.querySelector('[role=dialog]')
  assert.ok(invalidPaidNotice)
  assert.equal(invalidPaidNotice.querySelectorAll('a').length, 0, 'invalid secondary pricing scope cannot fall back to remembered B or contact action')
  await act(() => invalidPaidNotice.querySelector('button[aria-label="閉じる"]').click())

  await act(() => mounted.unmount())
  assert.equal(window.fetch, originalFetch)

  // Mount the real Quote Boundary around the real pricing page after taking
  // that href. A remembered B is the synthetic server workspace result.
  window.history.replaceState(null, '', href)
  pathname = '/quote/pricing'
  search = '?org=A'
  const organizations = { A: { id: 'org-A', slug: 'A', name: 'Org A', role: 'owner' }, B: { id: 'org-B', slug: 'B', name: 'Org B', role: 'owner' } }
  let expectedSelection = 'A'
  const actualWorkspaceClient = load('src/lib/organization-workspace-client.ts')
  const workspaceClient = {
    WorkspaceReadError: actualWorkspaceClient.WorkspaceReadError,
    selectedWorkspaceFromUrl: actualWorkspaceClient.selectedWorkspaceFromUrl,
    readOrganizationWorkspace: async (actor, selected, signal, service) => {
      calls.workspace.push({ actor, selected, service })
      assert.equal(actor, 'actor'); assert.equal(service, 'quote')
      assert.deepEqual(selected, { kind: 'selected', slug: expectedSelection })
      return { service, actorId: actor, memberships: Object.values(organizations), current: organizations[selected.slug] }
    },
  }
  const router = { replace() {}, push() {} }
  const recovery = { manager: { inspectStored() {} }, snapshot: { phase: 'idle', handle: null } }
  mocks = {
    __phase: 'pricing', react: React, 'react/jsx-runtime': requireRepo('react/jsx-runtime'),
    'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
    'next-auth/react': { useSession: () => ({ data: session, status }) },
    'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(search), useRouter: () => router },
    '@/components/org/OrgSwitcher': { getSelectedOrg: () => 'B', selectOrganization: () => {} },
    '@/lib/ui/guest-path': { isGuestPath: () => false },
    '@/lib/organization-workspace-client': workspaceClient,
    '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => recovery },
    '@/lib/checkout-recovery-client': { checkoutStoredIntent: () => null },
    '@/components/quote/QuotePageHeading': { __esModule: true, default: ({ children }) => React.createElement('h1', null, children) },
    '@/components/shell/ui-next-context': { useUiNext: () => false },
    'lucide-react': { ArrowLeft: () => null },
    '@/components/UnifiedPricingPlans': { UnifiedPricingPlans: ({ currentPlan }) => React.createElement('div', { 'data-plan': currentPlan || '' }) },
    '@/lib/plan-utils': { planLabel: x => x, tierFrom: x => x },
    '@/lib/aishodan/checkout-origin-hint': { saveCheckoutOriginHint: () => false, savePortalOriginHint: () => false, readPortalOriginHint: () => 'missing' },
    '@/lib/mensetsu/checkout-origin-hint': { saveMensetsuCheckoutHint: () => false, saveMensetsuPortalHint: () => false, readMensetsuPortalHint: () => 'missing' },
  }
  // The actual billing reader is used with a synthetic private response.
  global.fetch = async (url, init) => {
    const org = new URL(url, 'https://example.invalid').searchParams.get('org')
    calls.billing.push({ url, org, actor: init?.headers?.['x-doya-workspace-actor'] })
    return Response.json({ actorId: 'actor', organizationId: 'org-' + org, organizationSlug: org, plan: 'FREE', canManageBilling: true })
  }
  const boundary = load('src/components/quote/QuoteWorkspaceBoundary.tsx')
  const Page = load('src/app/(shell)/quote/pricing/page.tsx').default
  const priceRoot = createRoot(document.getElementById('root'))
  await act(() => priceRoot.render(React.createElement(boundary.QuoteWorkspaceBoundary, null, React.createElement(Page))))
  assert.equal(calls.workspace[0].selected.slug, 'A')
  assert.equal(calls.billing[0].org, 'A')
  assert.equal(calls.billing[0].actor, 'actor')
  const backToWork = [...document.querySelectorAll('a')].find(link => link.textContent?.includes('戻る'))
  assert.equal(backToWork?.getAttribute('href'), '/quote?org=A', 'pricing back link preserves verified A')
  await act(() => priceRoot.unmount())
  expectedSelection = 'B'
  search = '?org=B'
  window.history.replaceState(null, '', '/quote/pricing?org=B')
  const positiveRoot = createRoot(document.getElementById('root'))
  await act(() => positiveRoot.render(React.createElement(boundary.QuoteWorkspaceBoundary, null, React.createElement(Page))))
  assert.equal(calls.workspace.at(-1).selected.slug, 'B')
  assert.equal(calls.billing.at(-1).org, 'B')
  await act(() => positiveRoot.unmount())
  dom.window.close()
  console.log(JSON.stringify({ passed: true, route: { status: blocked.status, body }, allowed: { status: allowed.status, created: calls.create }, dialogHref: href, firstWorkspaceRequest: calls.workspace[0], firstBillingRequest: calls.billing[0], positiveWorkspaceRequest: calls.workspace.at(-1), positiveBillingRequest: calls.billing.at(-1), sourceHashes }, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
