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
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail }); return { promise, resolve, reject } }
async function fixture(mode = 'success') {
  const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/hr/settings' })
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  dom.window.confirm = () => true
  Object.defineProperty(dom.window.crypto, 'randomUUID', { value: crypto.randomUUID, configurable: true })
  const storage = new Map(), calls = [], locks = new Map(), refreshes = [], storageWrites = [], storageRemoves = [], lockTrace = []
  Object.defineProperty(dom.window, 'localStorage', { value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storageWrites.push({key,value}); storage.set(key, value) }, removeItem: key => { storageRemoves.push(key); storage.delete(key) } } })
  dom.window.navigator.locks = { request: async (name, _options, work) => { lockTrace.push(['requested', name]); const prior = locks.get(name) ?? Promise.resolve(); let done; const tail = new Promise(resolve => { done = resolve }); locks.set(name, prior.then(() => tail)); await prior; lockTrace.push(['granted', name]); try { return await work() } finally { lockTrace.push(['released', name]); done() } } }
  const server = { phase: 'missing', input: null, owner: true, failCandidatesOnce: false, holdTransfer: null, holdCancel: null }
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
      const result = { actorId: 'actor', service: 'hr', organizationId: 'org', operationId: body.operationId, phase: server.phase, input: server.input, createdAt: new Date().toISOString() }
      const held = body.action === 'transfer' ? server.holdTransfer : server.holdCancel
      if (held?.kind === 'headers') return held.gate.promise
      if (held?.kind === 'body') { server.lastHeldStatus = held.status ?? 200; return { status: server.lastHeldStatus, json: () => held.gate.promise } }
      return Response.json(result)
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
  const holdLock = async () => { const gate = deferred(), granted = deferred(); const name = client.ownerTransferLock('hr', 'actor', 'org'); const done = dom.window.navigator.locks.request(name, { mode: 'exclusive' }, async () => { granted.resolve(); await gate.promise }); await granted.promise; return { release: () => gate.resolve(), done, name } }
  return { client, node, dom, server, storage, storageWrites, storageRemoves, calls, refreshes, lockTrace, holdLock, render, click, button, handler, cycle, remount, unmount, flush }
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
  const postCount = f => f.calls.filter(row => row.method === 'POST').length
  const savedHandle = f => ({ version: 1, service: 'hr', actorId: 'actor', organizationId: 'org', organizationSlug: 'org', operationId: crypto.randomUUID() })
  const installMissing = f => { const handle = savedHandle(f); f.storage.set(f.client.ownerTransferSlot('hr', 'actor', 'org'), JSON.stringify(handle)); return handle }
  const resultFor = (handle, phase, input = null) => ({ actorId: 'actor', service: 'hr', organizationId: 'org', operationId: handle.operationId, phase, input, createdAt: new Date().toISOString() })
  await check('E3 old start callback after page restoration cannot save or POST', async f => {
    await f.render(); const old = f.handler('この方へ引き継ぐ')
    await f.cycle(); const writes = f.storageWrites.length, posts = postCount(f)
    await React.act(async () => old()); await f.flush()
    assert.equal(postCount(f), posts); assert.equal(f.storageWrites.length, writes)
    await f.click('この方へ引き継ぐ')
    assert.equal(postCount(f), posts + 1); assert.equal(f.storageWrites.length, writes + 1)
  })
  for (const variant of [{ name: 'actor', actor: 'foreign', org: 'org' }, { name: 'organization', actor: 'actor', org: 'foreign' }]) {
    await check('E3 old start callback after ' + variant.name + ' ABA cannot save or POST', async f => {
      await f.render(); const old = f.handler('この方へ引き継ぐ')
      await f.render('OWNER', variant.actor, variant.org); await f.render('OWNER', 'actor', 'org')
      const writes = f.storageWrites.length, posts = postCount(f)
      await React.act(async () => old()); await f.flush()
      assert.equal(postCount(f), posts); assert.equal(f.storageWrites.length, writes)
      await f.click('この方へ引き継ぐ'); assert.equal(postCount(f), posts + 1)
    })
  }
  await check('E3 old missing-cancel callback after restoration cannot POST', async f => {
    installMissing(f); await f.render(); assert.ok(f.button('未実行の引継ぎを取り消す'))
    const old = f.handler('未実行の引継ぎを取り消す'); await f.cycle()
    const posts = postCount(f), writes = f.storageWrites.length, removes = f.storageRemoves.length
    await React.act(async () => old()); await f.flush()
    assert.equal(postCount(f), posts); assert.equal(f.storageWrites.length, writes); assert.equal(f.storageRemoves.length, removes)
    await f.click('未実行の引継ぎを取り消す'); assert.equal(postCount(f), posts + 1)
  })
  await check('E3 old terminal-clear callback after restoration cannot remove', async f => {
    installMissing(f); await f.render(); await f.click('未実行の引継ぎを取り消す')
    const old = f.handler('現在の権限を確認して別の引継ぎを始める'); await f.cycle()
    const posts = postCount(f), writes = f.storageWrites.length, removes = f.storageRemoves.length
    await React.act(async () => old()); await f.flush()
    assert.equal(postCount(f), posts); assert.equal(f.storageWrites.length, writes); assert.equal(f.storageRemoves.length, removes)
    await f.click('現在の権限を確認して別の引継ぎを始める')
    assert.equal(f.storageRemoves.length, removes + 1)
    assert.equal(postCount(f), posts)
  })
  for (const retirement of ['pagehide', 'actor ABA', 'child unmount']) {
    await check('E3 queued start retires on ' + retirement, async f => {
      await f.render(); const held = await f.holdLock(); const posts = postCount(f), writes = f.storageWrites.length
      await f.click('この方へ引き継ぐ')
      assert.equal(f.lockTrace.filter(row => row[0] === 'requested' && row[1] === held.name).length, 2)
      if (retirement === 'pagehide') await f.cycle()
      else if (retirement === 'actor ABA') { await f.render('OWNER', 'foreign', 'org'); await f.render('OWNER', 'actor', 'org') }
      else await f.remount()
      held.release(); await held.done; await f.flush()
      assert.equal(postCount(f), posts, 'retired queued start must not POST')
      assert.equal(f.storageWrites.length, writes, 'retired queued start must not save')
      await f.click('この方へ引き継ぐ')
      assert.equal(postCount(f), posts + 1, 'current start must work after queue drains')
    })
  }
  await check('E3 queued missing cancellation retires before POST', async f => {
    installMissing(f); await f.render(); const held = await f.holdLock()
    const posts = postCount(f), writes = f.storageWrites.length
    await f.click('未実行の引継ぎを取り消す'); await f.cycle()
    held.release(); await held.done; await f.flush()
    assert.equal(postCount(f), posts); assert.equal(f.storageWrites.length, writes)
    await f.click('未実行の引継ぎを取り消す'); assert.equal(postCount(f), posts + 1)
  })
  await check('E3 queued terminal clear retires before remove', async f => {
    installMissing(f); await f.render(); await f.click('未実行の引継ぎを取り消す')
    const held = await f.holdLock(), removes = f.storageRemoves.length, posts = postCount(f)
    await f.click('現在の権限を確認して別の引継ぎを始める'); await f.cycle()
    held.release(); await held.done; await f.flush()
    assert.equal(f.storageRemoves.length, removes); assert.equal(postCount(f), posts)
    await f.click('現在の権限を確認して別の引継ぎを始める')
    assert.equal(f.storageRemoves.length, removes + 1)
  })
  for (const variant of [{ name: 'actor ABA', actor: 'foreign', org: 'org' }, { name: 'organization ABA', actor: 'actor', org: 'foreign' }]) {
    await check('E3 old missing-cancel and queued cancellation retire on ' + variant.name, async f => {
      installMissing(f); await f.render()
      const old = f.handler('未実行の引継ぎを取り消す'), held = await f.holdLock()
      await f.click('未実行の引継ぎを取り消す')
      await f.render('OWNER', variant.actor, variant.org); await f.render('OWNER', 'actor', 'org')
      const posts = postCount(f), writes = f.storageWrites.length
      await React.act(async () => old()); await f.flush()
      held.release(); await held.done; await f.flush()
      assert.equal(postCount(f), posts); assert.equal(f.storageWrites.length, writes)
      await f.click('未実行の引継ぎを取り消す'); assert.equal(postCount(f), posts + 1)
    })
    await check('E3 old terminal-clear and queued clear retire on ' + variant.name, async f => {
      installMissing(f); await f.render(); await f.click('未実行の引継ぎを取り消す')
      const old = f.handler('現在の権限を確認して別の引継ぎを始める'), held = await f.holdLock()
      await f.click('現在の権限を確認して別の引継ぎを始める')
      await f.render('OWNER', variant.actor, variant.org); await f.render('OWNER', 'actor', 'org')
      const removes = f.storageRemoves.length, posts = postCount(f)
      await React.act(async () => old()); await f.flush()
      held.release(); await held.done; await f.flush()
      assert.equal(f.storageRemoves.length, removes); assert.equal(postCount(f), posts)
      await f.click('現在の権限を確認して別の引継ぎを始める')
      assert.equal(f.storageRemoves.length, removes + 1)
    })
  }
  for (const kind of ['headers', 'body']) for (const late of ['success', '401', 'reject']) {
    await check('E3 pending transfer ' + kind + ' late ' + late + ' cannot adopt after page restoration', async f => {
      const gate = deferred(); f.server.holdTransfer = { kind, gate, status: late === '401' ? 401 : 200 }
      await f.render(); await f.click('この方へ引き継ぐ')
      const handle = JSON.parse([...f.storage.values()][0]), posts = postCount(f)
      if (kind === 'body') assert.equal(f.server.lastHeldStatus, late === '401' ? 401 : 200, 'body HTTP status witness')
      assert.equal(posts, 1); assert.equal(f.refreshes.length, 0)
      await f.cycle()
      assert.equal(f.refreshes.length, 1, 'status-only restoration must refresh current role once')
      const beforeText = f.node.textContent, beforeRemoves = f.storageRemoves.length
      if (late === 'reject') gate.reject(Error('late transport failure'))
      else if (kind === 'headers') gate.resolve(Response.json(late === '401' ? { error: 'late' } : resultFor(handle, 'committed', f.server.input), { status: late === '401' ? 401 : 200 }))
      else gate.resolve(late === '401' ? { error: 'late' } : resultFor(handle, 'committed', f.server.input))
      await f.flush()
      assert.equal(f.node.textContent, beforeText)
      assert.equal(f.refreshes.length, 1)
      assert.equal(f.storageRemoves.length, beforeRemoves)
      assert.equal(f.storage.size, 1)
      assert.equal(postCount(f), posts)
    })
  }
  for (const kind of ['headers', 'body']) for (const late of ['success', '401', 'reject']) {
    await check('E3 hidden transfer ' + kind + ' late ' + late + ' cannot adopt before restoration', async f => {
      const gate = deferred(); f.server.holdTransfer = { kind, gate, status: late === '401' ? 401 : 200 }
      await f.render(); await f.click('この方へ引き継ぐ')
      const handle = JSON.parse([...f.storage.values()][0]), posts = postCount(f)
      if (kind === 'body') assert.equal(f.server.lastHeldStatus, late === '401' ? 401 : 200, 'body HTTP status witness')
      await React.act(async () => f.dom.window.dispatchEvent(new f.dom.window.Event('pagehide')))
      await f.flush()
      const beforeRefreshes = f.refreshes.length, beforeRemoves = f.storageRemoves.length
      if (late === 'reject') gate.reject(Error('hidden transport failure'))
      else if (kind === 'headers') gate.resolve(Response.json(late === '401' ? { error: 'hidden' } : resultFor(handle, 'committed', f.server.input), { status: late === '401' ? 401 : 200 }))
      else gate.resolve(late === '401' ? { error: 'hidden' } : resultFor(handle, 'committed', f.server.input))
      await f.flush()
      assert.equal(f.refreshes.length, beforeRefreshes)
      assert.equal(f.storageRemoves.length, beforeRemoves)
      assert.equal(f.storage.size, 1)
      assert.equal(postCount(f), posts)
      const show = new f.dom.window.Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true })
      await React.act(async () => f.dom.window.dispatchEvent(show)); await f.flush()
      assert.equal(f.refreshes.length, beforeRefreshes + 1)
      assert.match(f.node.textContent, /引継ぎは完了/)
    })
  }
  for (const kind of ['headers', 'body']) for (const late of ['success', '401', 'reject']) {
    await check('E3 pending missing cancellation ' + kind + ' late ' + late + ' retires and restores by status', async f => {
      const handle = installMissing(f), gate = deferred(); f.server.holdCancel = { kind, gate, status: late === '401' ? 401 : 200 }
      await f.render(); await f.click('未実行の引継ぎを取り消す')
      const posts = postCount(f); assert.equal(posts, 1)
      if (kind === 'body') assert.equal(f.server.lastHeldStatus, late === '401' ? 401 : 200, 'cancel body HTTP status witness')
      await f.cycle(); assert.match(f.node.textContent, /取り消されました/)
      const beforeText = f.node.textContent
      if (late === 'reject') gate.reject(Error('late cancellation transport rejection'))
      else if (kind === 'headers') gate.resolve(Response.json(late === '401' ? { error: 'late unauthorized' } : resultFor(handle, 'canceled'), { status: late === '401' ? 401 : 200 }))
      else gate.resolve(late === '401' ? { error: 'late unauthorized' } : resultFor(handle, 'canceled'))
      await f.flush()
      assert.equal(f.node.textContent, beforeText)
      assert.equal(postCount(f), posts)
      assert.equal(f.storage.size, 1)
      assert.equal(f.refreshes.length, 0)
    })
  }
  for (const kind of ['headers', 'body']) for (const late of ['success', '401', 'reject']) {
    await check('E3 hidden missing cancellation ' + kind + ' late ' + late + ' stays inert until status restoration', async f => {
      const handle = installMissing(f), gate = deferred(); f.server.holdCancel = { kind, gate, status: late === '401' ? 401 : 200 }
      await f.render(); await f.click('未実行の引継ぎを取り消す')
      const posts = postCount(f); assert.equal(posts, 1)
      if (kind === 'body') assert.equal(f.server.lastHeldStatus, late === '401' ? 401 : 200, 'hidden cancel body HTTP status witness')
      await React.act(async () => f.dom.window.dispatchEvent(new f.dom.window.Event('pagehide'))); await f.flush()
      const beforeRefreshes = f.refreshes.length, beforeRemoves = f.storageRemoves.length
      if (late === 'reject') gate.reject(Error('hidden cancellation transport rejection'))
      else if (kind === 'headers') gate.resolve(Response.json(late === '401' ? { error: 'hidden unauthorized' } : resultFor(handle, 'canceled'), { status: late === '401' ? 401 : 200 }))
      else gate.resolve(late === '401' ? { error: 'hidden unauthorized' } : resultFor(handle, 'canceled'))
      await f.flush()
      assert.equal(f.refreshes.length, beforeRefreshes)
      assert.equal(f.storageRemoves.length, beforeRemoves)
      assert.equal(f.storage.size, 1)
      assert.equal(postCount(f), posts)
      const show = new f.dom.window.Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true })
      await React.act(async () => f.dom.window.dispatchEvent(show)); await f.flush()
      assert.match(f.node.textContent, /取り消されました/)
      assert.equal(f.storage.size, 1)
      assert.equal(postCount(f), posts)
    })
  }
  console.log(JSON.stringify({ passed: cases.length, cases, scope: 'Actual HR Panel/hook/client, synthetic transport, storage and Web Locks. No database, Next route or provider.' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
