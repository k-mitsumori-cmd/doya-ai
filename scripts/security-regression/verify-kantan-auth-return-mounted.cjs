process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const Module = require('node:module')
const root = path.resolve(__dirname, '../..')
const req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react')
const ts = req('typescript')
const { JSDOM } = req('jsdom')
const { createRoot } = req('react-dom/client')
const { renderToStaticMarkup } = req('react-dom/server')
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/kantan/dashboard/text/lp-full-text' })
global.window = dom.window
global.document = dom.window.document
global.localStorage = dom.window.localStorage
global.navigator = dom.window.navigator
global.IS_REACT_ACT_ENVIRONMENT = true
global.fetch = () => { throw Error('Unexpected network') }
const Null = () => null
const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
let session = null
let templateId = 'lp-full-text'
const pricing = { KANTAN_PRICING: { guestLimit: 3, freeLimit: 10, proLimit: 100, plans: [{ id: 'kantan-free', name: '無料', description: '無料', price: 0, features: [] }] }, getGuestRemainingCount: () => 3, getUserUsage: () => ({ date: '', count: 0 }), getGuestUsage: () => ({ date: '', count: 0 }) }
const mocks = {
  'next-auth/react': { useSession: () => ({ status: session ? 'authenticated' : 'unauthenticated', data: session }), signOut: async () => {} },
  'next/link': { __esModule: true, default: Link },
  'next/navigation': { useParams: () => ({ templateId }), useRouter: () => ({ push() {}, replace() {} }), redirect: req('next/navigation').redirect },
  'lucide-react': new Proxy({}, { get: () => Null }),
  'react-hot-toast': { __esModule: true, default: { success() {}, error() {} }, Toaster: Null, toast: { success() {}, error() {} } },
  '@/lib/unified-plan': { UNIFIED_PRO_PRICE_LABEL: '¥9,980', UNIFIED_PRO_PLAN_ID: 'unified-pro' },
  '@/lib/pricing': pricing,
  '@/components/TrialCallout': { TrialBadge: Null, TrialNote: Null },
  '@/components/CheckoutButton': { CheckoutButton: Null },
  '@/components/FeatureGuide': { FeatureGuide: Null },
}
function load(relative) {
  const file = path.join(root, relative)
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    exports, require: id => {
      if (id === 'react' || id === 'react/jsx-runtime') return req(id)
      if (id in mocks) return mocks[id]
      throw Error(`Unmocked ${id} from ${relative}`)
    }, window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
    navigator: dom.window.navigator, fetch: global.fetch, console, URL, Response, AbortController,
    Date, setTimeout, clearTimeout, setInterval, clearInterval,
  }, { filename: file })
  return exports
}
const templates = load('src/lib/templates.ts')
mocks['@/lib/templates'] = templates
const { safeSignInCallbackUrl } = load('src/lib/safe-signin-callback.ts')
async function mount(relative) {
  const host = document.createElement('div')
  document.body.append(host)
  const handle = createRoot(host)
  const Component = load(relative).default
  await React.act(async () => { handle.render(React.createElement(Component)); await new Promise(resolve => setTimeout(resolve, 0)) })
  return { host, close: async () => { await React.act(async () => handle.unmount()); host.remove() } }
}
function target(host, label) {
  const links = [...host.querySelectorAll('a')].filter(link => link.textContent.includes(label))
  assert.equal(links.length, 1, `${label}: exactly one visible CTA`)
  return links[0].getAttribute('href')
}
const observations = []
function verify(label, href, expected) {
  const url = new URL(href, 'https://example.invalid')
  const actual = url.searchParams.get('callbackUrl')
  observations.push({ label, href, callbackUrl: actual, expected })
  assert.equal(url.pathname, '/auth/signin')
  assert.equal(url.searchParams.get('service'), 'kantan')
  assert.equal(safeSignInCallbackUrl(actual), actual)
}
;(async () => {
  const detailPath = 'src/app/kantan/dashboard/text/[templateId]/page.tsx'
  for (const id of ['lp-full-text', 'google-ad-title']) {
    assert.ok(templates.SAMPLE_TEMPLATES.some(t => t.id === id && t.inputFields.some(f => f.required)))
    templateId = id
    localStorage.removeItem('kantan_guest_usage')
    const banner = await mount(detailPath)
    verify(`${id} guest banner`, target(banner.host, 'ログインで10回に！'), `/kantan/dashboard/text/${encodeURIComponent(id)}`)
    await banner.close()
    localStorage.setItem('kantan_guest_usage', JSON.stringify({ count: 3, date: new Date().toISOString().split('T')[0] }))
    const exhausted = await mount(detailPath)
    verify(`${id} exhausted guest`, target(exhausted.host, 'ログインで続ける'), `/kantan/dashboard/text/${encodeURIComponent(id)}`)
    await exhausted.close()
  }
  const chat = await mount('src/app/kantan/dashboard/chat/page.tsx')
  verify('chat guest banner', target(chat.host, 'ログインで10回/日に！'), '/kantan/dashboard/chat')
  await chat.close()
  const pricingPage = await mount('src/app/kantan/dashboard/pricing/page.tsx')
  verify('internal pricing guest', target(pricingPage.host, '無料でログイン'), '/kantan/dashboard/pricing')
  await pricingPage.close()
  session = { user: { id: 'synthetic', name: 'Synthetic' } }
  const signed = await mount('src/app/kantan/dashboard/pricing/page.tsx')
  assert.equal([...signed.host.querySelectorAll('a')].filter(link => link.textContent.includes('無料でログイン')).length, 0)
  await signed.close()
  const publicPricing = load('src/app/kantan/pricing/page.tsx').default
  const publicDoc = new JSDOM(renderToStaticMarkup(React.createElement(publicPricing))).window.document
  assert.equal(target(publicDoc, '無料で始める'), '/auth/signin?service=kantan&callbackUrl=/kantan/dashboard')
  assert.equal(safeSignInCallbackUrl('//outside.invalid/a'), '/home')
  assert.equal(safeSignInCallbackUrl('/\\outside.invalid/a'), '/home')
  for (const item of observations) assert.equal(item.callbackUrl, item.expected, `${item.label}: return to current work route`)
  console.log(JSON.stringify({ passed: observations.length + 4, observations, scope: 'Actual Kantan guest work pages mounted; synthetic session/decorative UI, no generation, network, provider, or database. URL return only; React form/chat state persistence unproven.' }))
  dom.window.close()
})().catch(error => { console.error(JSON.stringify({ observations })); console.error(error); process.exitCode = 1; dom.window.close() })
