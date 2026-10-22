process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const vm = require('node:vm')
const crypto = require('node:crypto')
const root = process.env.DOYA_REPO_ROOT || path.resolve(__dirname, '../..')
const candidate = path.resolve(__dirname, '../..')
const repo = Module.createRequire(path.join(root, 'package.json'))
const ts = repo('typescript'), React = repo('react'), runtime = repo('react/jsx-runtime')
const { JSDOM } = repo('jsdom'), { createRoot } = repo('react-dom/client')
const dom = new JSDOM('<main></main>', { url: 'https://example.invalid/aio/pricing' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.IS_REACT_ACT_ENVIRONMENT = true
function load(rel, mocks, extra = {}) {
  const file = fs.existsSync(path.join(candidate, rel)) ? path.join(candidate, rel) : path.join(root, rel)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports, require: id => { if (id in mocks) return mocks[id]; throw Error(`Unmocked ${id} from ${rel}`) },
    window: extra.window || dom.window, AbortController, crypto, URL, URLSearchParams, console, setTimeout, clearTimeout }, { filename: file })
  return exports
}
const selection = load('src/lib/organization-workspace-selection.ts', {})
const nav = load('src/lib/aio/billing-navigation.ts', { '@/lib/organization-workspace-selection': selection })
const billing = load('src/lib/billing-response-client.ts', {})
const recovery = load('src/lib/checkout-recovery-client.ts', { './billing-response-client': billing })
const tick = () => new Promise(resolve => setImmediate(resolve))
const act = fn => React.act(async () => { await fn(); await tick(); await tick() })
const map = new Map()
const storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }
const navigations = [], portalPosts = [], httpCalls = []
const fakeWindow = { location: { pathname: '/aio/pricing', set href(url) { navigations.push(url) }, reload() {} }, sessionStorage: storage }
const manager = new recovery.CheckoutRecoveryClient('actor', () => storage, async body => {
  httpCalls.push(body)
  if (body.action === 'start' || body.action === 'start_after_terminal') return { ok: true, status: 200,
    data: { actorId: 'actor', operationId: body.operationId, url: 'https://checkout.example.invalid/start' } }
  if (body.action === 'ready') return { ok: true, status: 200,
    data: { actorId: 'actor', operationId: body.operationId, sessionId: 'cs_A', url: 'https://checkout.example.invalid/ready' } }
  throw Error(`unexpected ${body.action}`)
}, () => crypto.randomUUID())
let guard, portalGuard, activeSlug = 'A', failStorage = false
const makeGuard = () => ({
  identity: activeSlug, current: () => activeSlug === 'A' || activeSlug === 'B', verify: async () => true,
  onReady: ready => {
    if (ready.provenance === 'recovered') return true
    if (failStorage) return false
    return nav.saveAioCheckoutHint(storage, { version: 1, kind: 'checkout', actorId: ready.actorId,
      organizationId: `org-${activeSlug}`, slug: activeSlug, operationId: ready.operationId, sessionId: ready.sessionId })
  },
})
guard = makeGuard()
portalGuard = { identity: 'A', current: () => true, verify: async () => true,
  prepareReturn: id => nav.saveAioPortalHint(storage, { version: 1, kind: 'portal', actorId: 'actor',
    organizationId: 'org-A', slug: 'A', navigationId: id }),
  returnPath: id => `/aio/billing-return/portal/${id}` }
const mocks = {
  react: React, 'react/jsx-runtime': runtime,
  'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: 'actor' } } }) },
  'next/navigation': { usePathname: () => '/aio/pricing', useRouter: () => ({ push() {} }) },
  'lucide-react': { Loader2: () => null, Zap: () => null, CreditCard: () => null },
  'react-hot-toast': { error() {}, loading() {}, success() {}, dismiss() {} },
  '@/lib/billing-response-client': { ...billing, readBillingResponse: async (url, init) => {
    if (url !== '/api/stripe/portal') throw Error(`unexpected ${url}`)
    portalPosts.push(JSON.parse(init.body)); return { ok: true, status: 200, data: { url: 'https://billing.example.invalid/portal' } }
  } },
  '@/lib/checkout-recovery-client': recovery,
  '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager,
    snapshot: React.useSyncExternalStore(manager.subscribe, manager.snapshot) }) },
  '@/lib/plan-utils': { paidTierFromSyncResult: () => 'PRO' },
}
const { CheckoutButton } = load('src/components/CheckoutButton.tsx', mocks, { window: fakeWindow })
const container = document.createElement('div'); document.body.append(container)
const rootView = createRoot(container)
async function render() { await act(() => rootView.render(React.createElement(CheckoutButton, {
  planId: 'unified-pro', actionGuard: guard, portalActionGuard: portalGuard, children: '購入',
}))) }
async function click() { await act(() => container.querySelector('button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))) }
;(async () => {
  await render(); await click()
  assert.equal(navigations[0], 'https://checkout.example.invalid/ready')
  assert.equal(nav.readAioCheckoutHint(storage, 'actor', 'cs_A').organizationId, 'org-A')
  assert.deepEqual(httpCalls.map(x => x.action), ['start', 'ready'])
  console.log('PASS actual CheckoutButton + recovery fresh ready stores A before navigation')
  activeSlug = 'B'; guard = makeGuard(); await render(); await click()
  assert.equal(nav.readAioCheckoutHint(storage, 'actor', 'cs_A').organizationId, 'org-A')
  assert.deepEqual(httpCalls.map(x => x.action), ['start', 'ready', 'ready'])
  assert.equal(navigations.length, 2)
  console.log('PASS readyAgain with B keeps A immutable and makes no new checkout')
  await act(() => rootView.unmount()); manager.dispose(); container.remove(); dom.window.close()
})().catch(error => { console.error(error); process.exitCode = 1 })
