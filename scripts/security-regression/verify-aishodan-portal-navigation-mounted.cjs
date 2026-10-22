process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript'), React = require(root + '/node_modules/react')
const { JSDOM } = require(root + '/node_modules/jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/aishodan/pricing?org=A' })
const navigations = []
global.window = new Proxy(dom.window, { get(target, name) { if (name === 'location') return { assign: url => navigations.push(url) }; return Reflect.get(target, name, target) } })
global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require(root + '/node_modules/react-dom/client')
let verify = true, current = true, saved = true, held = null, preparations = []
const mocks = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'),
  'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: 'actor' } } }) },
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
  'next/navigation': { usePathname: () => '/aishodan/pricing' },
  '@/lib/pricing': { ENTERPRISE_CONTACT_MAILTO: 'mailto:test@example.invalid' },
  '@/components/CheckoutButton': { CheckoutButton: () => null },
  '@/components/TrialCallout': { TrialBadge: () => null, TrialNote: () => null, useTrialEligible: () => false },
  '@/lib/services': { getServiceById: () => ({ id: 'aishodan', pricing: { free: {}, pro: {} }, features: [] }), getPublicServices: () => [] },
  '@/lib/plan-utils': { higherPlan: (a, b) => b || a, tierFrom: x => x },
  '@/hooks/useBillingPlanResync': { useBillingPlanResync: () => ({ run() {}, busy: false, disabled: false, message: null }) },
  '@/lib/unified-plan': { UNIFIED_PRO_PRICE_LABEL: '¥9,980', UNIFIED_PRO_PLAN_ID: 'aishodan-pro', UNIFIED_PLAN_COPY: { freeName: 'Free', freeTagline: '', proName: 'Pro', proNote: '' } },
}
const filename = root + '/src/components/UnifiedPricingPlans.tsx', moduleUnderTest = new Module(filename)
moduleUnderTest.paths = Module._nodeModulePaths(path.dirname(filename)); moduleUnderTest.require = name => { assert.ok(name in mocks, name); return mocks[name] }
moduleUnderTest._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
const view = createRoot(document.getElementById('root'))
const guard = () => ({ identity: 'actor:org-A:1', current: () => current, verify: async () => held ? held.promise : verify,
  prepareReturn: id => { preparations.push(id); return saved } })
const render = () => React.act(async () => { view.render(React.createElement(moduleUnderTest.exports.UnifiedPricingPlans,
  { serviceId: 'aishodan', currentPlan: 'FREE', portalNavigationGuard: guard() })); await new Promise(r => setImmediate(r)) })
const click = () => React.act(async () => { document.querySelector('button[type=button]:last-child')?.click(); await new Promise(r => setImmediate(r)) })
;(async () => {
  await render()
  const portalButton = [...document.querySelectorAll('button')].find(node => node.textContent.includes('プラン変更・お支払い方法'))
  assert.ok(portalButton); assert.equal(document.querySelector('a[href^="/api/stripe/portal?"]'), null)
  verify = false; await React.act(async () => { portalButton.click(); await new Promise(r => setImmediate(r)) })
  assert.equal(navigations.length, 0); assert.equal(preparations.length, 0)
  verify = true; saved = false; await React.act(async () => { portalButton.click(); await new Promise(r => setImmediate(r)) })
  assert.equal(navigations.length, 0); assert.equal(preparations.length, 1)
  saved = true; await React.act(async () => { portalButton.click(); await new Promise(r => setImmediate(r)) })
  assert.equal(navigations.length, 1)
  const destination = new URL(navigations[0], 'https://example.invalid')
  assert.equal(destination.pathname, '/api/stripe/portal')
  assert.match(destination.searchParams.get('returnTo'), /^\/aishodan\/billing-return\/[a-f0-9-]{36}$/)
  assert.equal(destination.searchParams.get('returnTo'), `/aishodan/billing-return/${preparations.at(-1)}`)
  let release; held = { promise: new Promise(resolve => { release = resolve }) }
  await React.act(async () => { portalButton.click(); await new Promise(r => setImmediate(r)) })
  current = false; await render(); await React.act(async () => { release(true); await new Promise(r => setImmediate(r)) })
  assert.equal(navigations.length, 1)
  await React.act(async () => view.unmount()); dom.window.close()
  console.log('PASS actual UnifiedPricingPlans footer portal guard: failed verify/storage no navigation, UUID queryless return, stale scope no navigation. Synthetic billing guard/provider-free.')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
