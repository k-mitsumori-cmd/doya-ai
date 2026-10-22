// Actual HR source with synthetic transport only. CI must use this checkout's sources and dependencies.
const TEST_REPO_ROOT = require('node:path').resolve(__dirname, '../../..')
if (process.env.CI && (process.env.DOYA_HR_OWNER_TEST_REPO || process.env.DOYA_HR_OWNER_TEST_SOURCE)) throw Error('HR test source override forbidden in CI')
const TEST_DEPS_ROOT = process.env.DOYA_HR_OWNER_TEST_REPO || TEST_REPO_ROOT
const TEST_SOURCE_ROOT = process.env.DOYA_HR_OWNER_TEST_SOURCE || TEST_REPO_ROOT
// Actual HR Panel/hook/client mounted with synthetic HTTP and browser storage; no DB/provider.
process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto'), assert = require('node:assert/strict')
const repo = TEST_DEPS_ROOT
const ts = require(path.join(repo, 'node_modules/typescript'))
const React = require(path.join(repo, 'node_modules/react'))
const { JSDOM } = require(path.join(repo, 'node_modules/jsdom'))
const { createRoot } = require(path.join(repo, 'node_modules/react-dom/client'))
const source = TEST_SOURCE_ROOT
const cases = []
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
async function fixture(mode = 'success') {
  const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/hr/settings' })
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  dom.window.confirm = () => true
  Object.defineProperty(dom.window.crypto, 'randomUUID', { value: crypto.randomUUID, configurable: true })
  const storage = new Map(), calls = [], locks = new Map(), refreshes = []
  Object.defineProperty(dom.window, 'localStorage', { value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } })
  dom.window.navigator.locks = { request: async (name, _options, work) => { const prior = locks.get(name) ?? Promise.resolve(); let done; const tail = new Promise(resolve => { done = resolve }); locks.set(name, prior.then(() => tail)); await prior; try { return await work() } finally { done() } } }
  const server = { phase: 'missing', input: null, owner: true, failCandidatesOnce: false }
  const candidate = index => ({ memberId: 'm' + String(index).padStart(3, '0'), userId: 'u' + String(index).padStart(3, '0'), name: '後任' + index, role: 'MEMBER', plan: 'PRO' })
  const transport = async (url, init = {}) => {
    const u = new URL(String(url), 'https://example.invalid'); const method = init.method ?? 'GET'
    calls.push({ url: u.href, method, body: init.body ?? null })
    if (u.searchParams.get('action') === 'candidates') {
      if (server.failCandidatesOnce) { server.failCandidatesOnce = false; return Response.json({ error: 'temporary' }, { status: 500 }) }
      const cursor = u.searchParams.get('cursor'); const start = cursor ? Number(cursor.slice(1)) + 1 : 1
      const requestedActor = u.searchParams.get('expectedActor') || 'actor', requestedOrg = u.searchParams.get('orgId') || 'org'
      return Response.json({ actorId: requestedActor, service: 'hr', organization: { id: requestedOrg, slug: 'x'.repeat(161), name: 'Org' },
        owner: { memberId: 'owner', userId: requestedActor }, candidates: Array.from({ length: Math.min(50, 62 - start) }, (_, i) => candidate(start + i)), nextCursor: start + 50 <= 61 ? 'm050' : null })
    }
    if (u.searchParams.get('action') === 'status') return Response.json({ actorId: 'actor', service: 'hr', organizationId: 'org', operationId: u.searchParams.get('operationId'),
      phase: server.phase, input: server.input, createdAt: server.phase === 'missing' ? null : new Date().toISOString() })
    if (method === 'POST') {
      const body = JSON.parse(init.body); assert.equal(body.expectedActor, 'actor'); assert.equal(body.orgId, 'org')
      if (body.action === 'cancel') { server.phase = 'canceled'; server.input = null }
      else if (body.action === 'transfer') {
        if (mode === 'rejected') return Response.json({ error: 'changed', code: 'OWNER_TRANSFER_CONFIRMATION_CHANGED', actorId: 'actor', service: 'hr', organizationId: 'org', operationId: body.operationId }, { status: 409 })
        server.phase = 'committed'; server.input = body.input; server.owner = false
      } else throw Error('unexpected action')
      if (mode === 'lost' && body.action === 'transfer') throw Error('lost acknowledgment')
      return Response.json({ actorId: 'actor', service: 'hr', organizationId: 'org', operationId: body.operationId, phase: server.phase, input: server.input, createdAt: new Date().toISOString() })
    }
    throw Error('unexpected URL ' + u)
  }
  function compile(file, mocks) {
    const filename = path.join(source, file), exports = {}
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    vm.runInNewContext(code, { exports, require: name => { if (name in mocks) return mocks[name]; if (name === 'react/jsx-runtime') return require(path.join(repo, 'node_modules/react/jsx-runtime')); throw Error('Unmocked ' + name) },
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator, crypto: dom.window.crypto,
      Response, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, console, Storage: dom.window.Storage }, { filename })
    return exports
  }
  const client = compile('src/lib/hr/owner-transfer-client.ts', {})
  const hook = compile('src/lib/hr/use-owner-transfer.ts', { react: React, './owner-transfer-client': client })
  const panel = compile('src/components/hr/HrOwnerTransferPanel.tsx', { react: React, '@/lib/hr/use-owner-transfer': hook, '@/lib/hr/owner-transfer-client': client }).default
  const node = document.createElement('div'); document.body.append(node); let root = createRoot(node)
  let role = 'OWNER'
  const flush = async () => { for (let i = 0; i < 5; i++) await React.act(async () => { await new Promise(done => setImmediate(done)) }) }
  const render = async (nextRole = role, nextActor = 'actor', nextOrg = 'org') => { role = nextRole; await React.act(async () => root.render(React.createElement(panel, { actorId: nextActor, organizationId: nextOrg, organizationSlug: nextOrg, role, request: transport, current: () => true, onCommitted: () => refreshes.push('fresh-role-read') }))); await flush() }
  const button = label => [...node.querySelectorAll('button')].find(element => element.textContent.includes(label))
  const handler = label => { const el = button(label); assert.ok(el, 'Missing handler ' + label); return el[Object.keys(el).find(key => key.startsWith('__reactProps$'))].onClick }
  const cycle = async () => { await React.act(async () => dom.window.dispatchEvent(new dom.window.Event('pagehide'))); await flush(); const show = new dom.window.Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true }); await React.act(async () => dom.window.dispatchEvent(show)); await flush() }
  const click = async label => { const target = button(label); assert.ok(target, 'Missing ' + label + ' in ' + node.textContent); await React.act(async () => target.click()); await flush() }
  const remount = async () => { await React.act(async () => root.unmount()); root = createRoot(node); await render() }
  const unmount = async () => { await React.act(async () => root.unmount()); node.remove(); dom.window.close() }
  return { client, node, dom, server, storage, calls, refreshes, render, click, button, handler, cycle, remount, unmount, flush }
}
async function check(name, task) { const f = await fixture(name === 'response loss recovers status-only' ? 'lost' : name === 'definitive rejection preserves handle' ? 'rejected' : 'success'); try { await task(f); cases.push(name) } finally { await f.unmount() } }
;(async () => {
  await check('current transfer and status replay', async f => {
    await f.render(); await f.click('この方へ引き継ぐ')
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    assert.equal(f.storage.size, 1)
    assert.match(f.node.textContent, /引継ぎは完了/)
    assert.equal(f.refreshes.length, 1)
    await f.click('引継ぎ状況を確認')
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    assert.equal(f.refreshes.length, 1)
  })
  await check('response loss recovers status-only', async f => {
    await f.render(); await f.click('この方へ引き継ぐ')
    assert.match(f.node.textContent, /引継ぎ結果を確認できません/)
    await f.click('引継ぎ状況を確認')
    assert.match(f.node.textContent, /引継ぎは完了/)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
  })
  await check('definitive rejection preserves handle', async f => {
    await f.render(); await f.click('この方へ引き継ぐ')
    assert.match(f.node.textContent, /確認した後任や組織の状態が変わりました/)
    assert.equal(f.storage.size, 1)
    await f.click('引継ぎ状況を確認')
    assert.match(f.node.textContent, /まだ登録されていません/)
    await f.click('未実行の引継ぎを取り消す')
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 2)
  })
  await check('61 candidates reachable on second page', async f => {
    await f.render(); assert.equal(f.node.querySelectorAll('button').length > 50, true)
    await f.click('次の候補を表示')
    assert.ok(f.node.textContent.includes('後任61'))
    assert.equal(f.calls.filter(call => new URL(call.url).searchParams.get('action') === 'candidates').length, 2)
  })
  await check('retired status callback after persisted pageshow sends no GET', async f => {
    await f.render(); await f.click('この方へ引き継ぐ')
    const el = f.button('引継ぎ状況を確認')
    const oldHandler = el[Object.keys(el).find(key => key.startsWith('__reactProps$'))].onClick
    await React.act(async () => f.dom.window.dispatchEvent(new f.dom.window.Event('pagehide')))
    await f.flush()
    const show = new f.dom.window.Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true })
    await React.act(async () => f.dom.window.dispatchEvent(show)); await f.flush()
    const before = f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'status').length
    await React.act(async () => oldHandler()); await f.flush()
    assert.equal(f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'status').length, before, 'retired status callback must send no GET')
    await f.click('引継ぎ状況を確認')
    assert.equal(f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'status').length, before + 1, 'fresh callback must work')
  })
  await check('retired candidate pagination callback after persisted pageshow sends no GET', async f => {
    await f.render(); const old = f.handler('次の候補を表示')
    await f.cycle()
    const before = f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'candidates').length
    await React.act(async () => old()); await f.flush()
    assert.equal(f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'candidates').length, before)
    await f.click('次の候補を表示')
    assert.equal(f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'candidates').length, before + 1)
    assert.match(f.node.textContent, /後任61/)
  })
  await check('retired candidate refresh callback after persisted pageshow sends no GET', async f => {
    f.server.failCandidatesOnce = true; await f.render()
    const old = f.handler('後任候補を再確認する')
    await f.cycle()
    const before = f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'candidates').length
    await React.act(async () => old()); await f.flush()
    assert.equal(f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'candidates').length, before)
    assert.ok(f.button('次の候補を表示'))
  })
  for (const variant of [{ name: 'actor ABA', actor: 'other', org: 'org' }, { name: 'org ABA', actor: 'actor', org: 'otherorg' }]) {
    await check('retired status callback after ' + variant.name + ' sends no GET', async f => {
      await f.render(); await f.click('この方へ引き継ぐ')
      const old = f.handler('引継ぎ状況を確認')
      await f.render('OWNER', variant.actor, variant.org)
      await f.render('OWNER', 'actor', 'org')
      const before = f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'status').length
      await React.act(async () => old()); await f.flush()
      assert.equal(f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'status').length, before)
      await f.click('引継ぎ状況を確認')
      assert.equal(f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'status').length, before + 1)
    })
  }
  await check('child-only unmount retires callback and remounted panel recovers status', async f => {
    await f.render(); await f.click('この方へ引き継ぐ')
    const old = f.handler('引継ぎ状況を確認')
    await f.remount()
    const before = f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'status').length
    await React.act(async () => old()); await f.flush()
    assert.equal(f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'status').length, before)
    await f.click('引継ぎ状況を確認')
    assert.equal(f.calls.filter(row => new URL(row.url).searchParams.get('action') === 'status').length, before + 1)
  })
  console.log(JSON.stringify({ passed: cases.length, cases, scope: 'Actual HR Panel/hook/client, synthetic transport, storage and Web Locks. No database, Next route or provider.' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
