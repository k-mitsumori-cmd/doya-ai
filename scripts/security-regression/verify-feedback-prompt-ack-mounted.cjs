// Standalone child: mounted React tests need the development act implementation.
process.env.NODE_ENV = 'development'
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const repo = path.resolve(__dirname, '../..'), dep = name => require(path.join(repo, 'node_modules', name))
const ts = dep('typescript'), React = dep('react'), { JSDOM } = dep('jsdom')
const file = 'src/components/feedback/FeedbackPrompt.tsx'
const source = ts.transpileModule(fs.readFileSync(path.join(repo, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
const results = []
async function check(scenario, strict) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://synthetic.invalid/quote', pretendToBeVisual: true })
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'IS_REACT_ACT_ENVIRONMENT']
  const previous = keys.map(key => [key, Object.getOwnPropertyDescriptor(global, key)])
  for (const key of keys) Object.defineProperty(global, key, { configurable: true, writable: true, value: key === 'window' ? dom.window : key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key] })
  let root, posts = 0, next = 0, resolvePending
  const timers = new Map()
  const fakeFetch = async (url, options) => {
    if (!options) return new Response(JSON.stringify({ show: true, serviceId: 'quote', serviceLabel: 'Synthetic service', usageCount: 1 }))
    assert.equal(url, '/api/feedback'); assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { action: 'submit', serviceId: 'quote', text: 'Synthetic feedback', rating: 4, usageCount: 1 }); posts++
    if (scenario === 'network') throw Error('Synthetic network failure')
    if (scenario === 'double-submit' || scenario === 'unmount') return new Promise(resolve => { resolvePending = () => resolve(new Response(JSON.stringify({ ok: true, id: 'synthetic-id' }))) })
    if (scenario === 'invalid-json') return new Response('invalid')
    const status = scenario === 'http401' ? 401 : scenario === 'http500' ? 500 : 200
    const body = scenario === 'missing-id' ? { ok: true } : scenario === 'false-ack' ? { ok: false, id: 'synthetic-id' } : { ok: true, id: 'synthetic-id' }
    return new Response(JSON.stringify(body), { status })
  }
  const exports = {}
  vm.runInNewContext(source, { exports, require: name => name === 'react' ? React : name === 'react/jsx-runtime' ? dep(name) : (() => { throw Error('Unexpected import ' + name) })(), fetch: fakeFetch, document: dom.window.document, console,
    setTimeout: (fn, ms) => { const id = ++next; timers.set(id, { fn, ms }); return id }, clearTimeout: id => timers.delete(id), setInterval: () => ++next, clearInterval: () => {} }, { filename: file })
  const { act } = React, { Simulate } = dep('react-dom/test-utils')
  try {
    root = dep('react-dom/client').createRoot(document.getElementById('root'))
    await act(async () => root.render(strict ? React.createElement(React.StrictMode, null, React.createElement(exports.default, { serviceId: 'quote' })) : React.createElement(exports.default, { serviceId: 'quote' })))
    await act(async () => [...timers.values()].find(timer => timer.ms === 4000).fn())
    const area = document.querySelector('textarea')
    await act(async () => Simulate.change(area, { target: { value: 'Synthetic feedback' } }))
    const button = label => [...document.querySelectorAll('button')].find(item => item.textContent === label)
    await act(async () => button('4').click())
    const send = button('送る')
    await act(async () => { Simulate.click(send); if (scenario === 'double-submit') Simulate.click(send) })
    if (scenario === 'double-submit' || scenario === 'unmount') {
      assert.equal(posts, 1); assert(area.disabled); assert(send.disabled)
      if (scenario === 'unmount') { await act(async () => root.unmount()); root = null; await act(async () => resolvePending()); assert(![...timers.values()].some(timer => timer.ms === 2600)); return }
      await act(async () => resolvePending())
    }
    const success = ['success', 'double-submit'].includes(scenario)
    assert.equal(document.body.textContent.includes('ありがとうございます'), success); assert.equal(posts, 1)
    const close = [...timers.values()].find(timer => timer.ms === 2600)
    if (success) {
      assert(close); await act(async () => root.unmount()); root = null
      assert(![...timers.values()].some(timer => timer.ms === 2600))
    } else {
      assert(!close); assert.equal(area.value, 'Synthetic feedback'); assert(!area.disabled)
      assert(document.querySelector('[role="alert"]'))
      assert(button('4').className.includes('bg-[#0066ff]'))
      if (scenario === 'http401') assert(document.querySelector('[role="alert"]').textContent.includes('ログイン'))
      assert(!send.disabled)
    }
  } finally {
    if (root) await React.act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(global, key, descriptor); else delete global[key]
  }
}
;(async () => {
  for (const strict of [false, true]) for (const scenario of ['http401', 'http500', 'network', 'invalid-json', 'missing-id', 'false-ack', 'success', 'double-submit', 'unmount']) {
    const name = 'FeedbackPrompt ' + scenario + (strict ? ' StrictMode' : '')
    try { await check(scenario, strict); results.push({ name, passed: true }); console.log('PASS ' + name) } catch (error) { results.push({ name, passed: false, error: error.message }); console.error('FAIL ' + name + ': ' + error.message) }
  }
  const report = { checkedAt: new Date().toISOString(), passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length, cases: results, scope: 'Actual mounted FeedbackPrompt with synthetic HTTP and timers, normal and StrictMode; no DB, providers, notifications or production requests. Server delivery and duplicate safety across manual retries are not verified.' }
  if (process.env.DOYA_FEEDBACK_PROMPT_RESULT) fs.writeFileSync(process.env.DOYA_FEEDBACK_PROMPT_RESULT, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); if (report.failed) process.exitCode = 1
})().catch(error => { console.error(error.message); process.exitCode = 1 })
