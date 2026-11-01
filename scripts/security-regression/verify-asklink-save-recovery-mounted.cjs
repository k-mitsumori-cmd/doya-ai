// Mount the real result/editor; all HTTP responses are synthetic, with no DB/provider access.
process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto')
const React = require('react'), { JSDOM } = require('jsdom'), ts = require('typescript')
const { load } = require('./load-typescript.cjs')
const root = path.resolve(__dirname, '../..'), rel = 'src/components/asklink/RunResult.tsx'
const source = fs.readFileSync(path.join(process.env.DOYA_TEST_BASELINE || root, rel), 'utf8')
const dom = new JSDOM('<main id="host"></main>', { url: 'https://synthetic.invalid' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client'), host = document.querySelector('main'), mounted = createRoot(host)
const errors = load('src/components/asklink/errors.ts'), links = load('src/lib/asklink/link.ts')
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
let respond, requests = [], changes = [], call = 0
const exportsAudit = {}
vm.runInNewContext(compiled, { exports: exportsAudit, require: name => {
  if (['react', 'react/jsx-runtime'].includes(name)) return require(name)
  if (name === 'lucide-react') return new Proxy({}, { get: () => () => null })
  if (name === '@/lib/asklink/link') return links
  if (name === './errors') return errors
  if (name === './AskLinkErrorNotice') return { __esModule: true, default: ({ status, action }) => React.createElement('p', { role: 'alert' }, errors.asklinkErrorCopy(status, action).what) }
  throw Error('Unexpected dependency: ' + name)
}, fetch: async (url, init) => { assert.equal(init.method, 'PATCH'); assert.equal(url, '/api/asklink/runs/synthetic-run'); requests.push(JSON.parse(init.body)); return respond(++call) }, window, document, navigator, URL, Blob, setTimeout, clearTimeout, console })
const result = exportsAudit.default
const base = { id: 'synthetic-run', sourceUrl: 'https://synthetic.invalid', source: 'manual', audience: 'b2b', detectedAudience: 'b2b', site: { name: 'Synthetic', summary: '', target: '', strengths: [], pages: [], contactUrl: null, downloadUrl: null, pricingUrl: null }, allowedUrls: [], links: [links.buildLink('understand', 'Synthetic', 'Synthetic button', 'Synthetic question', [])], banners: [], bannerCopy: null, createdAt: '2026-11-01T00:00:00Z' }
function Wrapper() { const [run, setRun] = React.useState(base); return React.createElement(result, { run, onChange: next => { changes.push(next); setRun(next) }, bannerBusy: null, onGenerateBanner: () => { throw Error('Provider forbidden') } }) }
function button(label) { const b = [...host.querySelectorAll('button')].find(x => x.textContent === label); assert(b, label); return b }
async function click(label) { await React.act(async () => { button(label).click(); await new Promise(setImmediate) }) }
async function enterDraft() { await click('編集する'); const q = host.querySelector('textarea[aria-label="質問文"]'); await React.act(async () => { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(q, 'Synthetic edited draft'); q.dispatchEvent(new window.Event('input', { bubbles: true })); q.dispatchEvent(new window.Event('change', { bubbles: true })) }); return q }
const cases = [], scenarios = [
  ['network rejection', () => { throw new TypeError('synthetic offline') }, 0],
  ['HTTP 500', () => ({ ok: false, status: 500, json: async () => ({ error: 'synthetic server failure' }) }), 500],
  ['HTTP 401', () => ({ ok: false, status: 401, json: async () => ({}) }), 401],
  ['invalid JSON acknowledgement', () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('synthetic body') } }), 0],
  ['missing run acknowledgement', () => ({ ok: true, status: 200, json: async () => ({}) }), 0],
  ['wrong run acknowledgement', () => ({ ok: true, status: 200, json: async () => ({ run: { ...base, id: 'different-synthetic-run' } }) }), 0],
]
;(async () => {
  for (const [name, failure, status] of scenarios) {
    requests = []; changes = []; call = 0
    respond = n => n === 1 ? failure() : { ok: true, status: 200, json: async () => ({ run: { ...base, links: [links.buildLink('understand', 'Synthetic', 'Synthetic button', requests[1].links[0].question, [])] } }) }
    await React.act(async () => mounted.render(React.createElement(Wrapper, { key: name })))
    const q = await enterDraft(), draft = q.value
    assert.equal(draft, 'Synthetic edited draft', 'real editor accepted draft')
    await click('保存する')
    assert.equal(changes.length, 0); assert.equal(requests.length, 1, 'no automatic retry')
    assert.equal(q.value, draft); assert.equal(q.readOnly, false); assert.equal(button('保存する').disabled, false)
    assert.equal(host.querySelector('[role=alert]').textContent, errors.asklinkErrorCopy(status, 'save').what)
    await click('保存する')
    assert.equal(requests.length, 2); assert.deepEqual(requests[1], requests[0]); assert.equal(changes.length, 1)
    assert.equal(host.querySelector('[role=alert]'), null); assert.equal(q.readOnly, true); assert.equal(q.value, draft)
    cases.push(name + ': draft retained, error shown, explicit retry succeeds')
    console.log('PASS AskLink save recovery: ' + cases[cases.length - 1])
  }
  const report = { checkedAt: new Date().toISOString(), passed: cases.length, failed: 0, cases, source: { path: rel, sha256: crypto.createHash('sha256').update(source).digest('hex') }, scope: 'Actual RunResult and LinkCard mounted in React/JSDOM; real link builder and status copy. Notice shell/icons mocked; PATCH synthetic only. No network/DB/providers/real accounts or production persistence verification.' }
  const out = process.env.DOYA_TEST_REPORT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/asklink-save-recovery-mounted-results.json')
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: cases.length, failed: 0 }))
})().catch(e => { console.error(e); process.exitCode = 1 }).finally(async () => { await React.act(async () => mounted.unmount()); dom.window.close() })
