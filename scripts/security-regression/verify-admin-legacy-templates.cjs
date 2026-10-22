process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('typescript'), React = require('react'), { JSDOM } = require('jsdom')
const sourceRoot = process.env.DOYA_TEST_BASELINE || path.resolve(__dirname, '../..')
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.invalid/admin/templates' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator
global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client')
const runtime = require('react/jsx-runtime'), results = []
const tick = () => new Promise(resolve => setImmediate(resolve))
const flush = async () => { await tick(); await tick() }
const act = fn => React.act(async () => { fn(); await flush() })
function load(file, mocks, globals = {}) {
  const exports = {}
  const output = ts.transpileModule(fs.readFileSync(path.join(sourceRoot, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    reportDiagnostics: true,
  })
  assert.equal((output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  vm.runInNewContext(output.outputText, { exports, require: name => {
    assert.ok(Object.hasOwn(mocks, name), 'Unexpected page dependency: ' + name)
    return mocks[name]
  }, console, AbortController, ...globals }, { filename: file })
  return exports
}
async function mounted(Component) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  await act(() => root.render(React.createElement(Component)))
  return { container, close: async () => { await act(() => root.unmount()); container.remove() } }
}
const link = ({ children, ...props }) => React.createElement('a', props, children)
async function before() {
  const templates = load('src/lib/templates.ts', {})
  let requests = 0
  const icons = Object.fromEntries(['Plus', 'Search', 'Edit2', 'Trash2', 'Eye', 'EyeOff', 'Crown', 'X', 'Save', 'Filter'].map(name => [name, () => null]))
  const motion = { tr: ({ initial, animate, ...props }) => React.createElement('tr', props), div: ({ initial, animate, ...props }) => React.createElement('div', props) }
  async function sample(random) {
    const math = Object.create(Math); math.random = () => random
    const Page = load('src/app/admin/templates/page.tsx', { react: React, 'react/jsx-runtime': runtime, 'framer-motion': { motion }, 'lucide-react': icons, '@/lib/templates': templates }, { Math: math, fetch: () => { requests++; throw Error('No network allowed') } }).default
    const f = await mounted(Page)
    const initialText = f.container.textContent
    const premium = f.container.querySelector('tbody tr button')
    const original = premium.textContent
    await act(() => premium.click())
    assert.notEqual(f.container.querySelector('tbody tr button').textContent, original)
    await f.close()
    const again = await mounted(Page)
    assert.equal(again.container.querySelector('tbody tr button').textContent, original, 'Local edit disappears on remount')
    await again.close()
    return initialText
  }
  assert.notEqual(await sample(0), await sample(0.9), 'Displayed usage changes with synthetic Math.random')
  assert.equal(requests, 0)
  results.push('Before: actual page invents usage; local premium edit disappears on remount; no persistence request')
}
async function after() {
  let pageRequests = 0
  const Page = load('src/app/admin/templates/page.tsx', { 'react/jsx-runtime': runtime, 'next/link': link }, { fetch: () => { pageRequests++; throw Error('No page network allowed') } }).default
  const f = await mounted(Page)
  assert.match(f.container.textContent, /提供を終了しています/)
  assert.match(f.container.textContent, /追加・編集・公開設定はできません/)
  assert.equal(f.container.querySelector('a').getAttribute('href'), '/admin/services')
  assert.equal(f.container.querySelectorAll('button,input,select,textarea,table').length, 0)
  assert.doesNotMatch(f.container.textContent, /総利用回数|総テンプレート数|公開中|プレミアム限定/)
  assert.equal(pageRequests, 0)
  await f.close()
  results.push('After: actual page retirement notice, exact return link, no fake inventory or mutation controls')
  for (const mode of ['allowed', 'denied', 'foreign']) {
    let resolve, authReads = 0
    const redirects = [], router = { push: value => redirects.push(value) }
    const response = new Promise(done => { resolve = done })
    const Wrapper = load('src/components/AdminAuthWrapper.tsx', {
      react: React, 'react/jsx-runtime': runtime,
      'next/navigation': { usePathname: () => '/admin/templates', useRouter: () => router },
      'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { email: mode === 'foreign' ? 'synthetic@example.invalid' : 'synthetic@surisuta.jp' } } }) },
      '@/lib/use-navigation-submission': { startGoogleSignIn() {}, switchGoogleAccount() {}, useNavigationSubmission: () => ({ busy: false, run() {} }) },
    }, { fetch: (url, init) => { assert.equal(url, '/api/admin/auth/session'); assert.equal(init.cache, 'no-store'); authReads++; return response } }).AdminAuthWrapper
    const app = await mounted(() => React.createElement(Wrapper, null, React.createElement(Page)))
    assert.doesNotMatch(app.container.textContent, /旧カンタンマーケAI/)
    await act(() => resolve({ ok: true, json: async () => ({ authenticated: mode !== 'denied' }) }))
    if (mode === 'allowed') assert.match(app.container.textContent, /旧カンタンマーケAI/)
    else assert.doesNotMatch(app.container.textContent, /旧カンタンマーケAI/)
    if (mode === 'denied') assert.deepEqual(redirects, ['/admin/login'])
    assert.equal(authReads, 1)
    await app.close()
    results.push('Actual existing AdminAuthWrapper masks page while loading and ' + mode)
  }
}
(async () => {
  if (process.argv.includes('--before')) await before(); else await after()
  for (const result of results) console.log('PASS ' + result)
  console.log(JSON.stringify({ kind: 'actual component and existing auth wrapper; synthetic session/network, no browser/DB/provider', count: results.length }))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => dom.window.close())
