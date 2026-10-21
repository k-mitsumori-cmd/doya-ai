process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript'), React = require(root + '/node_modules/react')
const { JSDOM } = require(root + '/node_modules/jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/quote/pricing?org=A' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require(root + '/node_modules/react-dom/client')
let status = 'authenticated', selected = 'A', role = 'owner', revision = 1, delayA = false, releaseA, requests = [], proofCache, portalProps, portalWrite = true, portalReadback = true
const makeProof = () => {
  if (proofCache?.revision === revision && proofCache.slug === selected) return proofCache.value
  const bound = revision, slug = selected
  const value = { actorId: 'actor', organization: { id: 'org-' + slug, slug, name: 'Org ' + slug, role }, revision: bound,
    current: () => revision === bound && selected === slug, href: p => p + '?org=' + slug, api: p => p + '?org=' + slug }
  proofCache = { revision, slug, value }
  return value
}
const mocks = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'),
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
  'next-auth/react': { useSession: () => ({ status, data: status === 'authenticated' ? { user: { id: 'actor' } } : null }) },
  'lucide-react': { ArrowLeft: () => null },
  '@/components/quote/QuotePageHeading': { __esModule: true, default: ({children}) => React.createElement('h1', null, children) },
  '@/components/shell/ui-next-context': { useUiNext: () => false },
  '@/lib/plan-utils': { planLabel: x => x, tierFrom: x => x },
  '@/components/UnifiedPricingPlans': { UnifiedPricingPlans: p => { portalProps = p; return React.createElement('div', { 'data-testid': 'plan', 'data-plan': p.currentPlan || 'guest', 'data-guard': p.checkoutActionGuard ? 'yes' : 'no', 'data-portal': p.portalNavigationGuard ? 'yes' : 'no' }, p.currentPlan || 'guest') } },
  '@/components/quote/QuoteWorkspaceBoundary': { useOptionalQuoteWorkspace: () => status === 'authenticated' ? { scope: { kind: 'ready', proof: makeProof() } } : null },
    '@/lib/aishodan/checkout-origin-hint': { saveCheckoutOriginHint: () => { throw Error('Aishodan hint used by Quote') }, savePortalOriginHint: () => { throw Error('Aishodan hint used by Quote') }, readPortalOriginHint: () => { throw Error('Aishodan hint used by Quote') } },
  '@/lib/quote/checkout-origin-hint': { saveQuoteCheckoutHint: () => true, saveQuotePortalHint: () => portalWrite,
    readQuotePortalHint: (_, actorId, navigationId) => portalReadback ? ({ actorId, navigationId, organizationId: 'org-' + selected, slug: selected }) : 'missing' },
}
const cache = new Map()
function load(rel) {
  if (cache.has(rel)) return cache.get(rel).exports
  const filename = path.join(root, rel), m = new Module(filename)
  cache.set(rel, m); m.paths = Module._nodeModulePaths(path.dirname(filename))
  m.require = n => {
    if (n in mocks) return mocks[n]
    if (n === '@/components/OrganizationPricingPlans') return load('src/components/OrganizationPricingPlans.tsx')
    if (n === '@/lib/billing-response-client') return load('src/lib/billing-response-client.ts')
    if (n === '@/lib/mensetsu/checkout-origin-hint') return load('src/lib/mensetsu/checkout-origin-hint.ts')
    if (n === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    throw Error('Unmocked ' + n)
  }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return m.exports
}
global.fetch = async (url, init) => {
  const org = new URL(url, 'https://example.invalid').searchParams.get('org')
  requests.push({ url, org, actor: init?.headers?.['x-doya-workspace-actor'] })
  const data = { actorId: 'actor', organizationId: 'org-' + (org || 'B'), organizationSlug: org || 'B', plan: org === 'A' ? 'PRO' : 'FREE', canManageBilling: role === 'owner' }
  if (delayA && org === 'A') return new Response(new ReadableStream({ start(controller) { releaseA = () => { controller.enqueue(new TextEncoder().encode(JSON.stringify(data))); controller.close() } } }), { headers: { 'Content-Type': 'application/json' } })
  return Response.json(data)
}
const Page = load('src/app/(shell)/quote/pricing/page.tsx').default
const flush = () => React.act(async () => { await new Promise(resolve => setImmediate(resolve)) })
let mounted
async function render() { await React.act(async () => mounted.render(React.createElement(Page))); await flush() }
async function reset() { if (mounted) await React.act(async () => mounted.unmount()); mounted = null; document.getElementById('root').innerHTML = ''; requests = []; releaseA = null; delayA = false; proofCache = null }
;(async () => {
  selected = 'A'; revision = 1; mounted = createRoot(document.getElementById('root')); await render()
  assert.equal(requests[0].org, 'A'); assert.equal(requests[0].actor, 'actor')
  assert.equal(document.querySelector('[data-testid=plan]').getAttribute('data-plan'), 'PRO')
  assert.equal(document.querySelector('[data-testid=plan]').getAttribute('data-guard'), 'yes')
  assert.equal(document.querySelector('[data-testid=plan]').getAttribute('data-portal'), 'yes')
  assert.equal(await portalProps.portalNavigationGuard.verify(new AbortController().signal), true)
  const navigationId = '00000000-0000-4000-8000-000000000009'
  portalWrite = false; assert.equal(portalProps.portalNavigationGuard.prepareReturn(navigationId), false)
  portalWrite = true; portalReadback = false; assert.equal(portalProps.portalNavigationGuard.prepareReturn(navigationId), false)
  portalReadback = true; assert.equal(portalProps.portalNavigationGuard.prepareReturn(navigationId), true)
  assert.equal(document.querySelector('a').getAttribute('href'), '/quote?org=A'); await reset()
  selected = 'A'; revision = 2; delayA = true; mounted = createRoot(document.getElementById('root')); await render()
  assert.equal(typeof releaseA, 'function'); selected = 'B'; revision = 3; await render()
  assert.ok(requests.some(row => row.org === 'B')); await React.act(async () => releaseA()); await flush()
  assert.equal(document.querySelector('[data-testid=plan]').getAttribute('data-plan'), 'FREE')
  assert.equal(document.querySelector('a').getAttribute('href'), '/quote?org=B'); await reset()
  status = 'authenticated'; selected = 'A'; role = 'member'; revision = 4; mounted = createRoot(document.getElementById('root')); await render()
  assert.equal(requests.at(-1).org, 'A'); assert.equal(document.querySelector('[data-testid=plan]'), null)
  assert.ok(document.body.textContent.includes('オーナー'))
  selected = 'B'; role = 'owner'; revision = 5; await render()
  assert.equal(requests.at(-1).org, 'B'); assert.equal(document.querySelector('[data-testid=plan]').getAttribute('data-guard'), 'yes')
  const oldGuard = portalProps.checkoutActionGuard; selected = 'A'; role = 'member'; revision = 6
  assert.equal(oldGuard.current(), false)
  await reset()
  status = 'unauthenticated'; mounted = createRoot(document.getElementById('root')); await render()
  assert.equal(document.querySelector('[data-testid=plan]').getAttribute('data-plan'), 'guest')
  assert.equal(requests.length, 0); await reset()
  dom.window.close(); console.log('PASS 4 actual Quote pricing page mounted cases: A proof/request/return, late A body after B, member A and owner B guard, guest public pricing. Synthetic billing HTTP.')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
