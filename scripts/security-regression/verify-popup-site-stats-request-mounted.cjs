// 実際のサイト詳細を合成HTTPで描画し、期間・サイト切替後の遅い応答を検査する。
process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..'), req = n => require(path.join(root, 'node_modules', n))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom'), el = React.createElement
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = req('react-dom/client')
const file = 'src/app/(shell)/popup/sites/[id]/SiteDetailClient.tsx'
const source = fs.readFileSync(process.env.DOYA_POPUP_STATS_SOURCE || path.join(root, file), 'utf8')
const act = fn => React.act(async () => { await fn(); await new Promise(setImmediate) })
const detail = (days, n, id = 'A') => ({ days, site: { id, name: 'Synthetic Site ' + id, domain: 'example.invalid', sourceUrl: 'https://example.invalid/', embedCode: '<script data-site="synthetic"></script>', lastSeenAt: null, totals: { impressions: n, clicks: 0, closes: 0, ctr: 0 } }, popups: [] })
async function fixture() {
  const requests = [], timers = new Map(), browser = { location: { href: 'unchanged' } }, exports = {}
  let nextTimer = 0, initial = detail(30, 3000), unmounted = false
  const ui = {
    PageHeader: ({ title, action }) => el('header', null, el('h1', null, title), action),
    DaysSwitch: ({ value, onChange }) => el('nav', null, [7, 30, 90].map(d => el('button', { key: d, 'aria-pressed': d === value, onClick: () => onChange(d) }, d + '日'))),
    StatTile: ({ label, value }) => el('output', null, label + ':' + value),
    ErrorState: ({ message, onRetry }) => el('button', { onClick: onRetry, 'data-error': true }, message),
    SkeletonDetail: () => el('p', { 'data-loading': true }, 'loading'),
    fmt: n => n.toLocaleString('ja-JP'), pct: () => '', summaryText: () => '', frequencyText: () => '', targetingText: () => '',
    useToast: () => ({ show: React.useCallback(() => {}, []), node: null }),
  }
  for (const name of ['ConfirmDialog', 'CopyButton', 'EmptyState', 'KindBadge', 'StatusBadge']) ui[name] = () => null
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    exports, require: n => {
      if (['react', 'react/jsx-runtime', 'lucide-react'].includes(n)) return req(n)
      if (n === 'next/navigation') return { useRouter: () => ({ push() {} }) }
      if (n === 'next/image' || n === 'next/link' || n === '@/components/popup/PopupPreview') return { default: () => null, __esModule: true }
      if (n === '@/components/popup/ui') return ui
      throw Error('Unexpected import ' + n)
    }, window: browser, fetch: (url, init) => new Promise((resolve, reject) => requests.push({ url, init, resolve, reject })),
    setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id }, clearTimeout: id => timers.delete(id), AbortController, URL, console,
  }, { filename: file })
  const container = document.createElement('div'); document.body.append(container); const mounted = createRoot(container)
  const render = next => { if (next) initial = next; return act(() => mounted.render(el(React.StrictMode, null, el(exports.default, { initial, created: false })))) }
  const respond = (r, days, n, id = 'A') => act(() => r.resolve(new Response(JSON.stringify(detail(days, n, id)), { status: 200 })))
  const unmount = async () => { if (!unmounted) { unmounted = true; await act(() => mounted.unmount()); container.remove() } }
  await render(); for (const r of [...requests]) await respond(r, 30, 3000); requests.length = 0
  return { requests, timers, browser, container, render, respond, unmount,
    click: days => act(() => [...container.querySelectorAll('nav button')].find(b => b.textContent === days + '日').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))),
    value: () => container.querySelector('output')?.textContent,
    selected: () => container.querySelector('nav [aria-pressed="true"]')?.textContent,
  }
}
;(async () => {
  const results = []
  async function check(name, fn) { const f = await fixture(); try { await fn(f); results.push(name); console.log('PASS ' + name) } finally { await f.unmount(); assert.equal(f.timers.size, 0, 'read timers cleaned after unmount') } }
  await check('latest selected period survives a late older success', async f => {
    await f.click(7); await f.click(30); await f.respond(f.requests[1], 30, 3030); await f.respond(f.requests[0], 7, 7007)
    assert.equal(f.selected(), '30日'); assert.equal(f.value(), '表示（30日）:3,030'); assert.equal(f.requests[0].init.signal.aborted, true)
  })
  await check('late older failure cannot hide current statistics', async f => {
    await f.click(7); await f.click(30); await f.respond(f.requests[1], 30, 3030); await act(() => f.requests[0].reject(Error('synthetic transport')))
    assert.equal(f.value(), '表示（30日）:3,030'); assert.equal(f.container.querySelector('[data-error]'), null)
  })
  await check('late older unauthorized response cannot redirect the current screen', async f => {
    await f.click(7); await f.click(30); await f.respond(f.requests[1], 30, 3030); await act(() => f.requests[0].resolve(new Response('', { status: 401 })))
    assert.equal(f.browser.location.href, 'unchanged'); assert.equal(f.value(), '表示（30日）:3,030')
  })
  await check('old JSON body completing later cannot overwrite current data', async f => {
    await f.click(7); let body; await act(() => f.requests[0].resolve({ status: 200, ok: true, json: () => new Promise(resolve => { body = resolve }) }))
    await f.click(30); await f.respond(f.requests[1], 30, 3030); await act(() => body(detail(7, 7007)))
    assert.equal(f.value(), '表示（30日）:3,030')
  })
  await check('cleared older skeleton callback cannot hide the new result', async f => {
    await f.click(7); const oldTimer = [...f.timers.values()][0]; await f.click(30); await f.respond(f.requests[1], 30, 3030); await act(() => oldTimer.fn())
    assert.equal(f.value(), '表示（30日）:3,030'); await f.respond(f.requests[0], 7, 7007)
  })
  await check('site change displays the new initial data and rejects old site results', async f => {
    await f.click(7); const old = f.requests[0]; await f.render(detail(30, 9000, 'B'))
    assert.equal(f.container.querySelector('h1').textContent, 'Synthetic Site B')
    const latest = f.requests.at(-1); assert.equal(latest.url, '/api/popup/sites/B?days=7'); await f.respond(latest, 7, 9007, 'B'); await f.respond(old, 7, 7007)
    assert.equal(f.container.querySelector('h1').textContent, 'Synthetic Site B'); assert.equal(f.value(), '表示（7日）:9,007'); assert.equal(old.init.signal.aborted, true)
  })
  await check('same site rerender preserves a current pending request', async f => {
    await f.click(7); const pending = f.requests[0]; await f.render(detail(30, 3000)); assert.equal(f.requests.length, 1); assert.equal(pending.init.signal.aborted, false)
    await f.respond(pending, 7, 7007); assert.equal(f.value(), '表示（7日）:7,007')
  })
  await check('current request still shows delayed skeleton and completes normally', async f => {
    await f.click(90); await act(() => [...f.timers.values()][0].fn()); assert.ok(f.container.querySelector('[data-loading]'))
    await f.respond(f.requests[0], 90, 9090); assert.equal(f.value(), '表示（90日）:9,090'); assert.equal(f.container.querySelector('[data-loading]'), null); assert.equal(f.timers.size, 0)
  })
  await check('current failures remain visible and explicit retry recovers', async f => {
    await f.click(7); await act(() => f.requests[0].resolve(new Response('', { status: 503 }))); assert.ok(f.container.querySelector('[data-error]'))
    await act(() => f.container.querySelector('[data-error]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); assert.equal(f.requests.length, 2)
    await f.respond(f.requests[1], 7, 7007); assert.equal(f.value(), '表示（7日）:7,007')
  })
  await check('leaving cancels the request and discards a late unauthorized result', async f => {
    await f.click(7); const pending = f.requests[0]; await f.unmount(); assert.equal(pending.init.signal.aborted, true)
    await act(() => pending.resolve(new Response('', { status: 401 }))); assert.equal(f.browser.location.href, 'unchanged')
  })
  await check('current unauthorized response still requires login', async f => {
    await f.click(7); await act(() => f.requests[0].resolve(new Response('', { status: 401 }))); assert.equal(f.browser.location.href, '/auth/signin?callbackUrl=/popup/sites/A')
  })
  console.log(JSON.stringify({ passed: results.length, results, scope: 'Actual SiteDetailClient in React StrictMode/jsdom, synthetic HTTP/visual children/timers; no real network/account/provider/write/native UI.' }, null, 2)); dom.window.close()
})().catch(e => { console.error(e); dom.window.close(); process.exitCode = 1 })
