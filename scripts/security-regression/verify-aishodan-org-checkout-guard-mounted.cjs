process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript'), React = require(root + '/node_modules/react')
const { JSDOM } = require(root + '/node_modules/jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/aishodan/pricing?org=A' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require(root + '/node_modules/react-dom/client')
let actor = 'actor-A', starts = [], canonical = [], current = true, verifyResult = true, held
const scopeKey = intent => JSON.stringify([intent.planId, intent.billingPeriod, intent.serviceId, intent.returnTo, intent.organization])
const snapshot = { phase: 'idle', handle: null, busy: false, dispatched: false, message: null }
const manager = { observe: async () => {}, snapshot: () => snapshot,
  start: async (intent, lease) => { starts.push({ intent, lease }); snapshot.handle = { operationId: '00000000-0000-4000-8000-000000000001', actorId: actor, scopeKey: scopeKey(intent) }; return { kind: 'none' } } }
const mocks = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'),
  'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: actor } } }) },
  'next/navigation': { usePathname: () => '/aishodan/pricing', useRouter: () => ({ push: () => { throw Error('Unexpected navigation') } }) },
  'lucide-react': { Loader2: () => null, Zap: () => null, CreditCard: () => null },
  'react-hot-toast': { __esModule: true, default: { dismiss() {}, error() {}, loading() {}, success() {} } },
  '@/lib/billing-response-client': { BillingResponseError: class BillingResponseError extends Error {}, billingRedirectUrl: () => null, readBillingResponse: () => { throw Error('Unexpected portal') } },
  '@/lib/checkout-recovery-client': { checkoutScopeKey: scopeKey },
  '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager, snapshot }) },
  '@/lib/plan-utils': { paidTierFromSyncResult: () => 'PRO' },
}
const filename = root + '/src/components/CheckoutButton.tsx', m = new Module(filename)
m.paths = Module._nodeModulePaths(path.dirname(filename)); m.require = n => { assert.ok(n in mocks, n); return mocks[n] }
m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
const CheckoutButton = m.exports.CheckoutButton
const rootView = createRoot(document.getElementById('root'))
const guard = () => ({ identity: 'actor-A:org-A:1', current: () => current, verify: async () => held ? held.promise : verifyResult,
  onCanonical: (operationId, user) => canonical.push([operationId, user]) })
const render = () => React.act(async () => { rootView.render(React.createElement(CheckoutButton, { planId: 'aishodan-pro', actionGuard: guard() }, '購入する')); await new Promise(r => setImmediate(r)) })
const click = () => React.act(async () => { document.querySelector('button').click(); await new Promise(r => setImmediate(r)) })
;(async () => {
  await render(); verifyResult = false; await click(); assert.equal(starts.length, 0)
  verifyResult = true; current = false; await render(); assert.equal(document.querySelector('button').disabled, true); assert.equal(starts.length, 0)
  current = true; await render(); let resolve; held = { promise: new Promise(r => { resolve = r }) }
  await click(); current = false; await render(); await React.act(async () => { resolve(true); await new Promise(r => setImmediate(r)) })
  assert.equal(starts.length, 0); assert.equal(canonical.length, 0)
  current = true; held = null; await render(); await click()
  assert.equal(starts.length, 1); assert.equal(starts[0].intent.organization, null)
  assert.equal(canonical.length, 1); assert.equal(canonical[0][1], 'actor-A')
  await React.act(async () => rootView.unmount()); dom.window.close()
  console.log('PASS 4 actual CheckoutButton mounted cases: UI owner guard denial, stale disabled, pending A-to-B, personal checkout with canonical hint. Synthetic manager/provider-free.')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
