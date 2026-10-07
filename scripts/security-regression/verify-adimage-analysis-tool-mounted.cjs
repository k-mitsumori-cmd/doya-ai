const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), { createRequire } = require('node:module')
const file = 'scripts/security-regression/verify-adimage-operation-tool-mounted.cjs'
const prefix = fs.readFileSync(file, 'utf8').split('\n(async()=>{')[0]
const f = new Function('require', '__dirname', prefix + '\nreturn {mount,close,act,render,input,click,host:()=>host,dom,setActor:v=>actor=v,setNetwork:v=>network=v,originalNetwork:network,reset:()=>{receipts=new Map();calls=[]},calls:()=>calls};')(createRequire(path.resolve(file)), path.dirname(path.resolve(file)))
const start = async () => { await f.act(() => f.input('https://example.com', 'https://synthetic.test')); await f.click('広告コピーを作る') }
const count = () => f.calls().filter(c => c.url === '/api/adimage/analyze').length
const cases = []
async function test(name, work) { await f.close(); f.dom.window.localStorage.clear(); f.setActor('actor-a'); f.setNetwork(f.originalNetwork); f.reset(); await f.mount(); await work(); cases.push(name); console.log('PASS ' + name) }
;(async () => { try {
  await test('Analysis lost response persists metadata only and never resubmits automatically', async () => {
    f.setNetwork(async c => { const r = await f.originalNetwork(c); if (c.url === '/api/adimage/analyze') throw Error('Synthetic lost saved response'); return r })
    await start(); assert.equal(count(), 1); const raw = f.dom.window.localStorage.getItem('adimage-intent:v1:actor-a'); const intent = JSON.parse(raw)
    assert.equal(intent.kind, 'analyze'); assert.equal(intent.targetId, 'analysis'); assert(!raw.includes('synthetic.test')); assert(!raw.includes('brand')); assert(!raw.includes('appeal'))
    assert(f.host().textContent.includes('保存結果を確認')); assert(!f.host().querySelector('input[type="file"]'))
    const button = [...f.host().querySelectorAll('button')].find(b => b.textContent.includes('広告コピーを作る')); assert(button.disabled); await f.act(() => button.click()); assert.equal(count(), 1)
    await f.close(); await f.mount(); assert.equal(count(), 1); await f.click('保存結果を確認'); assert(f.host().querySelector('input[type="file"]')); assert.equal(count(), 1)
    await f.click('結果を確認しました'); assert.equal(f.dom.window.localStorage.getItem('adimage-intent:v1:actor-a'), null)
  })
  await test('Malformed completed analysis remains fenced instead of applying untrusted copy', async () => {
    f.setNetwork(async c => { const r = await f.originalNetwork(c); if (c.url !== '/api/adimage/analyze') return r; const d = await r.json(); d.concepts[0].copy.headline = { private: 'invalid' }; return Response.json(d) })
    await start(); assert.equal(count(), 1); assert(!f.host().querySelector('input[type="file"]')); assert(f.dom.window.localStorage.getItem('adimage-intent:v1:actor-a'))
    await f.click('保存結果を確認'); assert(f.host().querySelector('input[type="file"]')); assert.equal(count(), 1)
  })
  await test('Confirmed source failure offers manual description and requires explicit close before new work', async () => {
    f.setNetwork(c => c.url === '/api/adimage/analyze' ? Promise.resolve(Response.json({ operationId: c.body.operationId, kind: 'analyze', targetId: 'analysis', state: 'failed', error: 'Synthetic source unavailable', code: 'WEBSITE_UNREADABLE', canUseManualInput: true })) : f.originalNetwork(c))
    await start(); assert(f.host().textContent.includes('Synthetic source unavailable')); assert(f.host().querySelector('textarea'))
    assert([...f.host().querySelectorAll('button')].find(b => b.textContent.includes('広告コピーを作る')).disabled)
    await f.click('この操作を閉じる'); assert.equal(f.dom.window.localStorage.getItem('adimage-intent:v1:actor-a'), null)
  })
  await test('Analysis daily cap retains structured upgrade guidance and no new automatic POST', async () => {
    f.setNetwork(c => c.url === '/api/adimage/analyze' ? Promise.resolve(Response.json({ operationId: c.body.operationId, kind: 'analyze', targetId: 'analysis', state: 'limit', code: 'ANALYSIS_DAILY_LIMIT', error: 'Synthetic daily cap', upgradeUrl: '/adimage/pricing', limitReached: true }, { status: 429 })) : f.originalNetwork(c))
    await start(); assert(f.host().textContent.includes('Synthetic daily cap')); assert(f.host().querySelector('a[href="/adimage/pricing"]')); assert.equal(count(), 1)
  })
  await test('Account switch and return keep old analysis intent recoverable without replay', async () => {
    f.setNetwork(async c => { const r = await f.originalNetwork(c); if (c.url === '/api/adimage/analyze') throw Error('Synthetic loss'); return r })
    await start(); f.setActor('actor-b'); await f.render(); assert(!f.host().querySelector('input[type="file"]')); assert(!f.host().querySelector('section[aria-label="解析の結果確認"]'))
    f.setActor('actor-a'); await f.render(); assert(f.host().querySelector('section[aria-label="解析の結果確認"]')); assert.equal(count(), 1)
    await f.click('保存結果を確認'); assert(f.host().querySelector('input[type="file"]')); assert.equal(count(), 1)
  })
  const files = ['src/app/adimage/Tool.tsx', 'src/lib/adimage/operation-client.ts', 'src/lib/adimage/use-operation-recovery.ts', 'src/lib/adimage/analysis-result.ts']
  fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/adimage-analysis-tool-mounted-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), passed: cases.length, cases, sourceHashes: Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])), scope: 'Actual full Tool, actual recovery hook/reader and output validator under React18 StrictMode. Synthetic network/session/Web Locks. No real provider or production DB; native automatic POST retry proved separately by private PostgreSQL fixture.' }, null, 2) + '\n')
} finally { await f.close() } })().catch(error => { console.error(error); process.exitCode = 1 })
