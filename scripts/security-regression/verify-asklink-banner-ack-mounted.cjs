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
let pending = [], replaceRun, bannerPending, bannerReject, bannerRequests=0, queueAPI, bannerPromise
const queueHook = load('src/components/asklink/useBannerQueue.ts', {react:React}, {window, Event:window.Event, fetch:(url,init)=>{ assert.equal(url, '/api/asklink/runs/synthetic-run/banners/wide'); assert.equal(init.method,'POST'); bannerRequests++; return new Promise((resolve,reject)=>{ bannerPending=resolve;bannerReject=reject }) }})
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
vm.runInNewContext(compiled, { exports: exported, require: name => {
  if (['react', 'react/jsx-runtime'].includes(name)) return require(name)
  if (name === 'lucide-react') return new Proxy({}, { get: () => () => null })
  if (name === '@/lib/asklink/link') return builder
  if (name === './errors') return errors
  if (name === './AskLinkErrorNotice') return { __esModule: true, default: ({ status, action }) => React.createElement('p', { role: 'alert' }, errors.asklinkErrorCopy(status, action).what) }
  throw Error('Unexpected dependency: ' + name)
}, fetch: (url, init) => { assert.equal(init.method, 'PATCH'); assert.equal(url, '/api/asklink/runs/synthetic-run'); return new Promise(resolve => pending.push({ resolve, edit: JSON.parse(init.body).links[0] })) }, window, document, navigator, URL, Blob, setTimeout, clearTimeout, console })
const base = { id: 'synthetic-run', sourceUrl: 'https://synthetic.invalid', source: 'manual', audience: 'b2b', detectedAudience: 'b2b', site: { name: 'Synthetic site', summary: '', target: '', strengths: [], pages: [], contactUrl: null, downloadUrl: null, pricingUrl: null }, allowedUrls: [], links: [builder.buildLink('understand', 'A', 'Button A', 'Original A', []), builder.buildLink('consult', 'B', 'Button B', 'Original B', [])], banners: [{kind:'wide',label:'Synthetic wide',use:'Synthetic use',w:1200,h:672,status:'none',url:null,verify:null,remaining:2},{kind:'tall',label:'Synthetic tall',use:'Synthetic use',w:1152,h:1536,status:'done',url:'https://synthetic.invalid/tall-original.png',verify:null,remaining:1}], bannerCopy: null, createdAt: '2026-11-01T00:00:00Z' }
function Wrapper() { const [run, setRun] = React.useState(base); replaceRun = setRun; queueAPI=queueHook.useBannerQueue(setRun, run.id); return React.createElement(exported.default, { key: run.id, run, onChange: setRun, bannerBusy: queueAPI.busy, onGenerateBanner: kind => {bannerPromise=queueAPI.generate(run.id,[kind])} }) }
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
  try { await fn(); results.push({ name, passed: true }); console.log('PASS AskLink banner acknowledgement: ' + name) }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.log('FAIL AskLink banner acknowledgement: ' + name) }
}
;(async () => {

  async function startBanner() { bannerPending=null; await React.act(async()=>{ const button=[...host.querySelectorAll('button')].find(b=>b.textContent==='作成する');assert(button);button.click() }); assert(bannerPending); return {promise:bannerPromise} }
  async function finishBanner(promise) { await React.act(async()=>{bannerPending({ok:true,status:200,json:async()=>({run:{...snapshot('Original A','Original B'),banners:[{...base.banners[0],status:'done',url:'https://synthetic.invalid/banner-wide.png',remaining:1}]}})});await promise}) }
  function imageUpdated(){assert(host.querySelector('img[src="https://synthetic.invalid/banner-wide.png"]'),'Banner acknowledgement must update the real BannerCard image')}
  await check('ordinary banner response updates actual BannerCard image',async()=>{const {promise}=await startBanner();await finishBanner(promise);imageUpdated();assert.equal(question(0).value,'Original A')})
  await check('late banner response preserves a question saved through actual LinkCard',async()=>{
    const {promise}=await startBanner(); await click(0,'編集する'); await fill(0,'Edited A'); await click(0,'保存する'); await release(0,snapshot('Edited A','Original B')); assert.equal(question(0).value,'Edited A'); await finishBanner(promise); imageUpdated(); assert.equal(question(0).value,'Edited A')
  })
  await check('late banner response preserves next unsent question draft',async()=>{
    const {promise}=await startBanner(); await click(0,'編集する'); await fill(0,'Edited A'); await click(0,'保存する'); await release(0,snapshot('Edited A','Original B')); await click(0,'編集する'); await fill(0,'Next unsent A'); await finishBanner(promise); imageUpdated(); assert.equal(question(0).value,'Next unsent A'); assert.equal(question(0).readOnly,false)
  })
  await check('late banner response cannot replace newly opened run result',async()=>{
    const {promise}=await startBanner(); await React.act(async()=>replaceRun({...snapshot('New run A','New run B'),id:'synthetic-new-run',site:{...base.site,name:'New synthetic site'}})); await finishBanner(promise); assert(host.textContent.includes('New synthetic site')); assert.equal(question(0).value,'New run A')
  })
  async function replyRaw(payload,jsonReject=false){const {promise}=await startBanner();await React.act(async()=>{bannerPending({ok:true,status:200,json:async()=>{if(jsonReject)throw Error('Synthetic JSON failure');return payload}});await promise})}
  await check('successful banner response without run is reported as a recoverable failure',async()=>{await replyRaw({});assert.equal(queueAPI.errorStatus,0);assert.equal(question(0).value,'Original A')})
  await check('banner JSON failure is reported without replacing result',async()=>{await replyRaw({},true);assert.equal(queueAPI.errorStatus,0);assert.equal(question(0).value,'Original A')})
  await check('banner response with different run id cannot replace current result',async()=>{await replyRaw({run:{...snapshot('Wrong run A','Wrong run B'),id:'synthetic-other'}});assert.equal(question(0).value,'Original A');assert.equal(queueAPI.errorStatus,0)})
  await check('banner response missing requested kind cannot claim success',async()=>{await replyRaw({run:{...snapshot('Original A','Original B'),banners:[{...base.banners[0],kind:'other'}]}});assert.equal(queueAPI.errorStatus,0);assert.equal(question(0).value,'Original A')
  })
  for(const status of [401,500])await check('banner HTTP'+status+' keeps result and releases retry guard',async()=>{
    const {promise}=await startBanner();await React.act(async()=>{bannerPending({ok:false,status,json:async()=>({error:'Synthetic failure'})});await promise});assert.equal(queueAPI.errorStatus,status);assert.equal(queueAPI.busy,null);assert.equal(question(0).value,'Original A')
  })
  await check('banner network failure releases busy state and manual retry updates image',async()=>{
    const first=await startBanner();await React.act(async()=>{bannerReject(Error('Synthetic network failure'));await first.promise});assert.equal(queueAPI.errorStatus,0);assert.equal(queueAPI.busy,null);assert.equal(question(0).value,'Original A');const second=await startBanner();await finishBanner(second.promise);imageUpdated();assert.equal(queueAPI.errorStatus,null)
  })
  await check('a second queued generate call cannot duplicate an active POST',async()=>{
    const before=bannerRequests,{promise}=await startBanner();await React.act(async()=>{await queueAPI.generate('synthetic-run',['wide'])});assert.equal(bannerRequests,before+1);await finishBanner(promise);imageUpdated()
  })
  await check('wide banner acknowledgement retains a newer unrelated tall banner',async()=>{
    const {promise}=await startBanner();await React.act(async()=>replaceRun({...base,banners:[base.banners[0],{...base.banners[1],url:'https://synthetic.invalid/tall-new.png'}]}));await finishBanner(promise);imageUpdated();assert(host.querySelector('img[src="https://synthetic.invalid/tall-new.png"]'))
  })
  await check('a failed target banner is displayed with a retry action',async()=>{
    const {promise}=await startBanner();await React.act(async()=>{bannerPending({ok:true,status:200,json:async()=>({run:{...base,banners:[{...base.banners[0],status:'failed',remaining:1},base.banners[1]]}})});await promise});assert(host.textContent.includes('作成に失敗しました'));assert(host.textContent.includes('作り直す（残り1回）'));assert.equal(queueAPI.busy,null)
  })
})().catch(error => results.push({ name: 'harness', passed: false, error: error.message })).finally(async () => {
  await React.act(async () => mounted.unmount()); dom.window.close()
  const report = { checkedAt: new Date().toISOString(), passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, expectedCases: 14, results, hookSource: {path:'src/components/asklink/useBannerQueue.ts',sha256:crypto.createHash('sha256').update(fs.readFileSync(process.env.DOYA_TEST_BASELINE && fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE,'src/components/asklink/useBannerQueue.ts')) ? path.join(process.env.DOYA_TEST_BASELINE,'src/components/asklink/useBannerQueue.ts') : path.join(root,'src/components/asklink/useBannerQueue.ts'))).digest('hex')}, source: { path: rel, sha256: crypto.createHash('sha256').update(source).digest('hex') }, scope: 'Actual RunResult/LinkCard and useBannerQueue mounted together with real builder/status copy and React18 StrictMode in JSDOM. Save and next draft use actual component controls; new run is explicit state update. Synthetic deferred PATCH/banner POST only. No browser/network/provider/DB/customer writes; does not prove actual parent navigation or production persistence.' }
  const out = process.env.DOYA_TEST_REPORT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/asklink-banner-ack-mounted-results.json')
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, failed: report.failed, expectedCases: 14 })); if (report.failed || results.length !== 14) process.exitCode = 1
})
