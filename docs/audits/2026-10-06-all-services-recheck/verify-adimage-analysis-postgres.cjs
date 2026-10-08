const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), http = require('node:http'), puppeteer = require('puppeteer-core'), { createRequire } = require('node:module')
const { load } = require('../../../scripts/security-regression/load-typescript.cjs')
const base = 'docs/audits/2026-10-06-all-services-recheck/', fixture = base + 'verify-adimage-operation-postgres.cjs'
const { db, setupDb, makeBudget } = new Function('require', '__dirname', fs.readFileSync(fixture, 'utf8').split(';(async()=>')[0] + '\nreturn {db,setupDb,makeBudget};')(createRequire(path.resolve(fixture)), path.dirname(path.resolve(fixture)))
const globals = { TextEncoder, TextDecoder, setTimeout, clearTimeout, console: { log() {}, warn() {}, error() {}, info() {} } }
const access = load('src/lib/adimage/access.ts', { crypto, 'next-auth': { getServerSession: async () => null }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: db } }, globals)
const output = load('src/lib/adimage/analysis-result.ts', { './types': load('src/lib/adimage/types.ts') }, globals)
const input = load('src/lib/adimage/analysis-input.ts', {}, globals)
const analysis = load('src/lib/adimage/analysis-budget.ts', { 'node:crypto': crypto, '@/lib/prisma': { prisma: db }, './access': access }, globals)
const uuid = '40000000-0000-4000-8000-000000000001', uuid2 = '40000000-0000-4000-8000-000000000002'
const key = 'adimage-analysis:v1:' + crypto.createHash('sha256').update('budget-user').digest('hex')
const cases = []; let actor, calls, copyCalls, gate, entered, sourceFailure, providerFailure, badOutput, rollback, lostCommit, core, formatter, route, ops, budget
const op = (id = uuid, kind = 'analyze') => ({ actor: 'budget-user', operationId: id, kind, targetId: kind === 'analyze' ? 'analysis' : kind === 'generate' ? 'brand' : 'original' })
const body = extra => ({ operationId: uuid, url: 'https://synthetic.test/', ...extra })
class BrandSourceError extends Error { constructor() { super('Synthetic source unavailable'); this.status = 422 } }
async function reset() {
  budget = await makeBudget(); await db.$executeRawUnsafe(`INSERT INTO "User" (id,plan) VALUES ('budget-user','FREE'),('other','FREE') ON CONFLICT(id) DO UPDATE SET plan='FREE'`)
  actor = 'budget-user'; calls = 0; copyCalls = 0; gate = null; entered = null; sourceFailure = false; providerFailure = false; badOutput = false; rollback = false; lostCommit = false
  const wrapped = { ...budget, withAdImageBudgetTransaction: async (work, ...args) => {
    const result = await budget.withAdImageBudgetTransaction(tx => work(new Proxy(tx, { get(target, prop) {
      if (prop === 'adImageBrand' && rollback) return new Proxy(tx.adImageBrand, { get(model, key) { if (key === 'create') return async data => { await model.create(data); throw Error('Synthetic insert rollback') }; const value = Reflect.get(model, key); return typeof value === 'function' ? value.bind(model) : value } })
      const value = Reflect.get(target, prop); return typeof value === 'function' ? value.bind(target) : value
    } })), ...args)
    if (lostCommit && result?.phase === 'completed') { lostCommit = false; throw Object.assign(Error('Synthetic acknowledgement lost'), { code: 'P1001' }) }
    return result
  } }
  core = load('src/lib/adimage/image-operation.ts', { 'node:crypto': crypto, './access': access, './image-budget': wrapped, './analysis-budget': analysis, './analysis-result': output, './logo-operation': require('../../../scripts/security-regression/adimage-logo-operation-fixture.cjs').makeAdImageLogoOperationFixture(wrapped,()=>core,globals) }, globals)
  formatter = load('src/lib/adimage/image-operation-http.ts', { 'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma: db }, './access': { getIdentity: async () => ({ userId: actor, plan: 'FREE' }) }, './storage': { signedUrl: async () => 'https://synthetic.test/image.png' }, './placements': { findPlacement: () => null }, '@/lib/fetch-timeout': { raceTimeout: async (_label, _ms, promise) => promise }, './image-operation': core, './analysis-result': output }, globals)
  route = load('src/app/api/adimage/analyze/route.ts', { 'next/server': {}, '@/lib/adimage/access': { getIdentity: async () => ({ userId: actor, plan: 'FREE' }) }, '@/lib/adimage/analysis-input': input, '@/lib/adimage/analysis-result': output, '@/lib/adimage/image-operation': core, '@/lib/adimage/image-operation-http': formatter,
    '@/lib/adimage/brand': { BrandSourceError, analyzeBrand: async () => { if (sourceFailure) throw new BrandSourceError(); calls++; entered?.(); if (gate) await gate; if (providerFailure) throw Error('Synthetic provider failure'); return { name: 'Synthetic', valueProps: ['Useful'], colors: ['#0066ff'] } } },
    '@/lib/adimage/copy': { generateConcepts: async () => { copyCalls++; return badOutput ? [{ copy: {} }] : [{ label: 'Synthetic', appealAxis: 'benefit', tone: 'plain', copy: { headline: '見出し', sub: '', cta: '確認' } }] }, findRiskyExpressions: () => [] },
  }, globals)
  ops = load('src/app/api/adimage/operations/route.ts', { '@/lib/adimage/image-operation-http': formatter }, globals)
}
const post = extra => route.POST(new Request('https://local.test/api/adimage/analyze', { method: 'POST', body: JSON.stringify(body(extra)) }))
const recover = (id = uuid, cancel = false) => { const req = new Request('https://local.test/api/adimage/operations?' + new URLSearchParams({ operationId: id, kind: 'analyze', targetId: 'analysis' })); req.nextUrl = new URL(req.url); return ops[cancel ? 'DELETE' : 'GET'](req) }
const usage = async () => { const r = await db.systemSetting.findUnique({ where: { key } }); return r ? JSON.parse(r.value) : null }
const count = () => db.adImageBrand.count({ where: { id: { not: 'brand' } } })
async function record(name, work) { await reset(); await work(); cases.push(name); console.log('PASS ' + name) }
;(async () => { let server, browser
  try {
    await setupDb()
    await record('Same UUID replays one stored brand and one consumed attempt without repeated AI', async () => {
      assert.equal((await post()).status, 200); assert.equal((await post()).status, 200)
      const saved = await (await recover()).json(); assert.equal(saved.state, 'completed'); assert.equal(saved.concepts.length, 1)
      assert.equal(calls, 1); assert.equal(copyCalls, 1); assert.equal(await count(), 1); assert.equal((await usage()).count, 1)
    })
    await record('Ten concurrent duplicate UUID requests start one provider operation', async () => {
      let release; gate = new Promise(resolve => { release = resolve }); const started = new Promise(resolve => { entered = resolve })
      const first = post(); await started
      const replies = await Promise.all(Array.from({ length: 9 }, post)); assert(replies.every(r => r.status === 202))
      release(); assert.equal((await first).status, 200); assert.equal(calls, 1); assert.equal(await count(), 1); assert.equal((await usage()).count, 1)
    })
    await record('Changed input bound to an existing UUID is rejected before another provider call', async () => {
      await post(); const changed = await post({ appeal: 'Changed' }); assert.equal(changed.status, 409); assert.equal(calls, 1)
    })
    await record('Cancellation before arrival tombstones delayed POST without quota or provider work', async () => {
      assert.equal((await (await recover(uuid, true)).json()).state, 'cancelled')
      assert.equal((await (await post()).json()).state, 'cancelled'); assert.equal(calls, 0); assert.equal(await usage(), null)
    })
    await record('Confirmed source rejection refunds once and recovery retains manual input guidance', async () => {
      sourceFailure = true; const first = await (await post()).json(); assert.equal(first.state, 'failed'); assert.equal(first.canUseManualInput, true)
      assert.equal((await usage()).count, 0); await post(); assert.equal((await usage()).count, 0); assert.equal(calls, 0)
      assert.equal((await (await recover()).json()).code, 'WEBSITE_UNREADABLE')
    })
    await record('Provider failure remains consumed and cannot automatically replay', async () => {
      providerFailure = true; assert.equal((await (await post()).json()).state, 'failed'); await post()
      assert.equal(calls, 1); assert.equal((await usage()).count, 1); assert.equal(await count(), 0)
    })
    await record('Malformed provider output cannot be saved or displayed as completed', async () => {
      badOutput = true; assert.equal((await (await post()).json()).state, 'failed'); assert.equal(await count(), 0); assert.equal((await usage()).count, 1)
    })
    await record('Insert failure rolls back brand, result receipt and budget completion', async () => {
      rollback = true; assert.equal((await post()).status, 503); assert.equal(await count(), 0)
      assert.equal((await (await recover()).json()).state, 'failed'); assert.equal((await usage()).count, 1)
    })
    await record('Lost commit acknowledgement preserves completed result and cannot repeat AI or refund', async () => {
      lostCommit = true; assert.equal((await post()).status, 503)
      assert.equal((await (await recover()).json()).state, 'completed'); assert.equal((await (await post()).json()).state, 'completed')
      assert.equal(calls, 1); assert.equal(await count(), 1); assert.equal((await usage()).count, 1)
    })
    await record('Deleted or transferred brand is unavailable and cannot be regenerated by replay', async () => {
      const saved = await (await post()).json(); await db.adImageBrand.update({ where: { id: saved.brandId }, data: { userId: 'other' } })
      assert.equal((await (await recover()).json()).state, 'unavailable'); assert.equal((await (await post()).json()).state, 'unavailable'); assert.equal(calls, 1)
    })
    await record('Changed owned brand invalidates replay of old analysis drafts', async () => {
      const saved = await (await post()).json(); await db.adImageBrand.update({ where: { id: saved.brandId }, data: { name: 'Changed' } })
      assert.equal((await (await recover()).json()).state, 'unavailable'); assert.equal(calls, 1)
    })
    await record('Anonymous and foreign actor cannot read result or trigger original UUID work', async () => {
      await post(); actor = null; const response = await recover(); assert.equal(response.status, 401); assert.equal(response.headers.get('cache-control'), 'private, no-store')
      actor = 'other'; assert.equal((await (await recover()).json()).state, 'missing'); assert.equal(calls, 1)
    })
    await record('Analysis and image generation share a bidirectional actor fence', async () => {
      let release; gate = new Promise(resolve => { release = resolve }); const started = new Promise(resolve => { entered = resolve }); const pending = post(); await started
      const brand = await db.adImageBrand.findUnique({ where: { id: 'brand' } }); const competing = await core.beginAdImageOperation(op(uuid2, 'generate'), {}, 1, core.adImageTargetHash('generate', brand)); assert.equal(competing.state, 'busy')
      release(); await pending
      const image = await core.beginAdImageOperation(op(uuid2, 'generate'), {}, 1, core.adImageTargetHash('generate', brand)); assert.equal(image.state, 'started')
      const r = await post({ operationId: '40000000-0000-4000-8000-000000000003' }); assert.equal(r.status, 202); assert.equal((await r.json()).state, 'busy'); assert.equal(calls, 1)
    })
    await record('Expired analysis cannot write after provider work completes late', async () => {
      let release; gate = new Promise(resolve => { release = resolve }); const started = new Promise(resolve => { entered = resolve }); const pending = post(); await started
      const state = await usage(); await db.systemSetting.update({ where: { key }, data: { value: JSON.stringify({ ...state, until: 1 }) } })
      release(); assert.equal((await pending).status, 409); assert.equal(await count(), 0); assert.equal((await usage()).count, 1); assert.equal((await (await recover()).json()).state, 'failed')
    })
    await record('Missing operation ID refuses legacy untracked analysis before any quota or source work', async () => {
      const response = await post({ operationId: undefined }); assert.equal(response.status, 409); assert.equal(calls, 0); assert.equal(await usage(), null)
    })
    await record('Daily cap returns private structured upgrade guidance without starting another provider', async () => {
      await post(); const state = await usage(); await db.systemSetting.update({ where: { key }, data: { value: JSON.stringify({ ...state, count: 20 }) } })
      const response = await post({ operationId: uuid2 }); assert.equal(response.status, 429); const data = await response.json(); assert.equal(data.code, 'ANALYSIS_DAILY_LIMIT'); assert.equal(data.upgradeUrl, '/adimage/pricing'); assert.equal(data.usage.used, 20); assert.equal(calls, 1)
    })
    if (process.env.DOYA_ANALYSIS_NATIVE_CHROME !== '0') await record('Native Chrome automatic POST retry after saved-response socket loss replays exactly one result', async () => {
      let requests = 0, origin
      server = http.createServer(async (req, res) => { try {
        if (req.url === '/') { res.end('<!doctype html><title>Synthetic analysis recovery</title>'); return }
        let raw = ''; for await (const part of req) raw += part
        requests++; const reply = await route.POST(new Request(origin + '/api/adimage/analyze', { method: 'POST', body: raw })); const data = await reply.text()
        if (requests === 1) { assert.equal(reply.status, 200); req.socket.destroy(); return }
        res.writeHead(reply.status, { 'Content-Type': 'application/json' }); res.end(data)
      } catch (error) { res.writeHead(500); res.end('{}') } })
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + server.address().port
      browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--disable-background-networking', '--disable-sync'] }); const page = await browser.newPage()
      await page.setRequestInterception(true); page.on('request', r => r.url().startsWith(origin) ? r.continue() : r.abort()); await page.goto(origin)
      const first = await page.evaluate(async payload => { try { const r = await fetch('/api/adimage/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); return { status: r.status, body: await r.json() } } catch { return { status: null } } }, body())
      assert.equal(first.status, 200); assert.equal(first.body.state, 'completed'); assert.equal(requests, 2); assert.equal(calls, 1); assert.equal(copyCalls, 1); assert.equal(await count(), 1); assert.equal((await usage()).count, 1)
      await browser.close(); browser = null; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); server = null
    })
    if (process.env.DOYA_ANALYSIS_NATIVE_CHROME !== '0') await record('Native full Tool through actual API and PostgreSQL recovers committed analysis after loss and reload without provider replay', async () => {
      const nativeFile = base + 'verify-adimage-feedback-native.cjs'
      const nativePrefix = fs.readFileSync(nativeFile, 'utf8').split('const receipts=new Map()')[0].replace("window.__actor||'actor'", "window.__actor||'budget-user'")
      const assets = new Function('require', '__dirname', nativePrefix + '\nreturn {javascript,css,react,reactdom};')(createRequire(path.resolve(nativeFile)), path.dirname(path.resolve(nativeFile)))
      let requests = 0, origin
      server = http.createServer(async (req, res) => { try {
        const url = new URL(req.url, origin)
        if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/react.js"></script><script src="/reactdom.js"></script><script src="/app.js"></script>'); return }
        const resource = { '/style.css': [assets.css, 'text/css'], '/react.js': [assets.react, 'text/javascript'], '/reactdom.js': [assets.reactdom, 'text/javascript'], '/app.js': [assets.javascript, 'text/javascript'] }[url.pathname]
        if (resource) { res.writeHead(200, { 'Content-Type': resource[1] }); res.end(resource[0]); return }
        const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }); res.end(JSON.stringify(data)) }
        if (url.pathname === '/api/adimage/placements') { send({ placements: [{ key: 'square', name: 'Square', media: 'Test', size: '1024x1024' }], defaults: ['square'], chips: [], unsupported: [] }); return }
        if (url.pathname.startsWith('/api/adimage/design-refs')) { send({ items: [], matched: 0 }); return }
        if (url.pathname === '/api/adimage/operations') {
          const request = new Request(url); request.nextUrl = url; const r = await ops[req.method === 'DELETE' ? 'DELETE' : 'GET'](request); send(await r.json(), r.status); return
        }
        if (url.pathname !== '/api/adimage/analyze') { send({}, 404); return }
        let raw = ''; for await (const part of req) raw += part
        requests++; const r = await route.POST(new Request(url, { method: 'POST', body: raw })); const data = await r.json()
        if (requests === 1) { assert.equal(r.status, 200); req.socket.destroy(); return }
        send(data, r.status)
      } catch { res.writeHead(500); res.end('{}') } })
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + server.address().port
      browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--disable-background-networking', '--disable-sync'] }); const page = await browser.newPage(); const errors = []
      page.on('pageerror', e => errors.push(e.message)); await page.setRequestInterception(true); page.on('request', r => r.url().startsWith(origin) ? r.continue() : r.abort()); await page.goto(origin)
      const click = text => page.evaluate(label => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes(label)); if (!b) throw Error('Missing button ' + label); b.click() }, text)
      await page.type('input[placeholder="https://example.com"]', 'https://synthetic.test'); await click('広告コピーを作る'); try { await page.waitForSelector('input[type="file"]') } catch (error) { console.error(JSON.stringify({nativeAnalysisFailure:{requests,calls,copyCalls,errors,view:await page.evaluate(()=>document.body.innerText.slice(0,3000))}})); throw error }
      assert.equal(requests, 2); assert.equal(calls, 1); assert.equal(copyCalls, 1); assert.equal(await count(), 1); assert.equal((await usage()).count, 1)
      const metadata = await page.evaluate(() => localStorage.getItem('adimage-intent:v1:budget-user')); assert.equal(JSON.parse(metadata).kind, 'analyze'); assert(!metadata.includes('synthetic.test'))
      await page.reload({ waitUntil: 'networkidle0' }); assert.equal(requests, 2); await click('保存結果を確認'); await page.waitForSelector('input[type="file"]'); assert.equal(requests, 2); assert.equal(calls, 1)
      await click('結果を確認しました'); await page.waitForFunction(() => localStorage.getItem('adimage-intent:v1:budget-user') === null); assert.equal(errors.length, 0)
      await browser.close(); browser = null; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); server = null
    })
    const files = ['src/lib/adimage/image-operation.ts', 'src/lib/adimage/image-operation-http.ts', 'src/lib/adimage/analysis-budget.ts', 'src/lib/adimage/image-budget.ts', 'src/lib/adimage/analysis-input.ts', 'src/lib/adimage/analysis-result.ts', 'src/app/api/adimage/analyze/route.ts', 'src/app/adimage/Tool.tsx', 'src/lib/adimage/operation-client.ts', 'src/lib/adimage/use-operation-recovery.ts']
    const result = { checkedAt: new Date().toISOString(), passed: cases.length, cases, sourceHashes: Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])), scope: 'Actual full analyze POST, operation GET/DELETE, receipt/budget/parser/validator, Prisma and private Unix-only PostgreSQL; native Chrome actual socket loss at completion. Synthetic identity/source/AI only. No production database/provider/process-kill E2E.' }
    fs.writeFileSync(base + 'adimage-analysis-postgres-results.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result))
  } finally { if (server) server.closeAllConnections(); if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); await db.$disconnect() }
})().catch(error => { console.error(error); process.exitCode = 1 })
