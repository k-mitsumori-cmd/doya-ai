process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto')
const React = require('react'), { JSDOM } = require('jsdom'), ts = require('typescript'), { load } = require('./load-typescript.cjs')
const root = path.resolve(__dirname, '../..'), rel = 'src/components/asklink/RunResult.tsx'
const selected = process.env.DOYA_TEST_BASELINE && fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE, rel)) ? path.join(process.env.DOYA_TEST_BASELINE, rel) : path.join(root, rel)
const source = fs.readFileSync(selected, 'utf8')
const dom = new JSDOM('<main id="host"></main>', { url: 'https://synthetic.invalid' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client'), host = document.querySelector('main'), mounted = createRoot(host)
const builder = load('src/lib/asklink/link.ts'), errors = load('src/components/asklink/errors.ts'), exported = {}
let pending = [], replaceRun
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
vm.runInNewContext(compiled, { exports: exported, require: name => {
  if (['react', 'react/jsx-runtime'].includes(name)) return require(name)
  if (name === 'lucide-react') return new Proxy({}, { get: () => () => null })
  if (name === '@/lib/asklink/link') return builder
  if (name === './errors') return errors
  if (name === './AskLinkErrorNotice') return { __esModule: true, default: ({ status, action }) => React.createElement('p', { role: 'alert' }, errors.asklinkErrorCopy(status, action).what) }
  throw Error('Unexpected dependency: ' + name)
}, fetch: (url, init) => { assert.equal(init.method, 'PATCH'); assert.equal(url, '/api/asklink/runs/synthetic-run'); return new Promise(resolve => pending.push({ resolve, edit: JSON.parse(init.body).links[0] })) }, window, document, navigator, URL, Blob, setTimeout, clearTimeout, console })
const base = { id: 'synthetic-run', sourceUrl: 'https://synthetic.invalid', source: 'manual', audience: 'b2b', detectedAudience: 'b2b', site: { name: 'Synthetic site', summary: '', target: '', strengths: [], pages: [], contactUrl: null, downloadUrl: null, pricingUrl: null }, allowedUrls: [], links: [builder.buildLink('understand', 'A', 'Button A', 'Original A', []), builder.buildLink('consult', 'B', 'Button B', 'Original B', [])], banners: [], bannerCopy: null, createdAt: '2026-11-01T00:00:00Z' }
function Wrapper() { const [run, setRun] = React.useState(base); replaceRun = setRun; return React.createElement(exported.default, { key: run.id, run, onChange: setRun, bannerBusy: null, onGenerateBanner: () => { throw Error('Provider forbidden') } }) }
function question(index) { const q = host.querySelectorAll('textarea[aria-label="質問文"]')[index]; assert(q); return q }
function button(index, label) { const b = [...question(index).parentElement.querySelectorAll('button')].find(x => x.textContent === label); assert(b, label); return b }
async function click(index, label) { await React.act(async () => { button(index, label).click(); await new Promise(setImmediate) }) }
async function fill(index, text) { await React.act(async () => { const q = question(index); Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(q, text); q.dispatchEvent(new window.Event('input', { bubbles: true })); q.dispatchEvent(new window.Event('change', { bubbles: true })) }); assert.equal(question(index).value, text) }
async function submitBoth() {
  for (let i = 0; i < 2; i++) { await click(i, '編集する'); await fill(i, i ? 'Edited B' : 'Edited A') }
  await click(0, '保存する'); await click(1, '保存する'); assert.equal(pending.length, 2)
}
function snapshot(a, b) { return { ...base, links: [builder.buildLink('understand', 'A', 'Button A', a, []), builder.buildLink('consult', 'B', 'Button B', b, [])] } }
async function release(index, run) { await React.act(async () => { pending[index].resolve({ ok: true, status: 200, json: async () => ({ run }) }); await new Promise(setImmediate) }) }
const results = []
async function check(name, fn) {
  pending = []; await React.act(async () => mounted.render(React.createElement(React.StrictMode, null, React.createElement(Wrapper, { key: name }))))
  try { await fn(); results.push({ name, passed: true }); console.log('PASS AskLink response order: ' + name) }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.log('FAIL AskLink response order: ' + name) }
}
;(async () => {
  await check('late earlier acknowledgement cannot revert another saved link', async () => {
    await submitBoth(); await release(1, snapshot('Edited A', 'Edited B')); await release(0, snapshot('Edited A', 'Original B'))
    assert.equal(question(0).value, 'Edited A'); assert.equal(question(1).value, 'Edited B'); assert.equal(question(1).readOnly, true)
  })
  await check('late acknowledgement preserves another card next unsent draft', async () => {
    await submitBoth(); await release(1, snapshot('Edited A', 'Edited B')); await click(1, '編集する'); await fill(1, 'Next unsent B'); await release(0, snapshot('Edited A', 'Original B'))
    assert.equal(question(1).value, 'Next unsent B'); assert.equal(question(1).readOnly, false); assert.equal(button(1, '保存する').disabled, false)
  })
  await check('reverse response order also retains both independent edits', async () => {
    await submitBoth(); await release(0, snapshot('Edited A', 'Edited B')); await release(1, snapshot('Original A', 'Edited B'))
    assert.equal(question(0).value, 'Edited A'); assert.equal(question(1).value, 'Edited B')
  })
  await check('old run acknowledgement cannot replace a newly opened run', async () => {
    await click(0, '編集する'); await fill(0, 'Edited A'); await click(0, '保存する')
    await React.act(async () => replaceRun({ ...snapshot('New run A', 'New run B'), id: 'synthetic-new-run', site: { ...base.site, name: 'New synthetic site' } }))
    await release(0, snapshot('Edited A', 'Original B')); assert(host.textContent.includes('New synthetic site')); assert.equal(question(0).value, 'New run A'); assert.equal(question(1).value, 'New run B')
  })
})().catch(error => results.push({ name: 'harness', passed: false, error: error.message })).finally(async () => {
  await React.act(async () => mounted.unmount()); dom.window.close()
  const report = { checkedAt: new Date().toISOString(), passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, expectedCases: 4, results, source: { path: rel, sha256: crypto.createHash('sha256').update(source).digest('hex') }, scope: 'Actual RunResult/LinkCard, real builder/status copy and React18 StrictMode state updates in JSDOM. Deferred synthetic successful PATCH snapshots only, no browser/network/DB/providers or customer data. Independent native SQL tests cover persistence; this test covers client acknowledgement ordering, unsent drafts and run replacement, not all banner/generation/actor races.' }
  const out = process.env.DOYA_TEST_REPORT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/asklink-edit-response-order-mounted-results.json')
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, failed: report.failed, expectedCases: 4 })); if (report.failed || results.length !== 4) process.exitCode = 1
})
