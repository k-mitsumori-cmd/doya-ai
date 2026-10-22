// Actual shared Panel/hook/client with synthetic session, browser storage and HTTP. No DB/provider.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const crypto = require('node:crypto')
const ts = require('typescript')
const React = require('react')
const { JSDOM } = require('jsdom')
const { createRoot } = require('react-dom/client')
const services = ['shodan', 'aio', 'quote', 'mensetsu', 'aishodan']
const cases = []
const sourcePaths = [
  'src/lib/owner-transfer-client.ts', 'src/lib/use-owner-transfer.ts',
  'src/components/org/OwnerTransferPanel.tsx',
  'scripts/security-regression/verify-owner-transfer-mounted.cjs',
]
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function fixture(service, postMode = 'success') {
  const dom = new JSDOM('<!doctype html><body></body>', { url: `https://synthetic.invalid/${service}/settings?org=selected` })
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
  dom.window.confirm = () => true
  const storage = new Map(), calls = [], held = new Map(), refreshes = []
  Object.defineProperty(dom.window, 'localStorage', { value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value) },
    removeItem: key => { storage.delete(key) },
  } })
  dom.window.navigator.locks = { request: async (name, _options, work) => {
    const previous = held.get(name) || Promise.resolve()
    let release; const tail = new Promise(done => { release = done })
    held.set(name, previous.then(() => tail))
    await previous
    try { return await work() } finally { release() }
  } }
  const server = { phase: 'missing', operationId: null, input: null, ownerNow: true }
  const orgId = `org_${service}`
  const candidate = { memberId: 'target', userId: 'successor', name: '後任', role: 'member', plan: 'LIGHT' }
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body || null })
    const query = new URL(String(url), 'https://synthetic.invalid').searchParams
    if (query.get('action') === 'candidates') return server.ownerNow ? Response.json({ actorId: 'actor', service,
      organization: { id: orgId, slug: 'selected', name: '合成組織' }, owner: { memberId: 'owner', userId: 'actor' },
      candidates: [candidate] }) : Response.json({ code: 'OWNER_TRANSFER_OWNER_REQUIRED' }, { status: 403 })
    if (query.get('action') === 'status') return Response.json({ actorId: 'actor', service,
      organizationId: orgId, operationId: query.get('operationId'), phase: server.phase,
      input: server.input, createdAt: server.phase === 'missing' ? null : new Date().toISOString() })
    if (init.method === 'POST') {
      const body = JSON.parse(init.body)
      assert.equal(body.expectedActor, 'actor')
      assert.equal(body.orgId, orgId)
      if (body.action === 'cancel') { server.phase = 'canceled'; server.operationId = body.operationId; server.input = null }
      else if (body.action === 'transfer') {
        if (['rejected', 'unbound', 'owner_denied', 'invalid_code'].includes(postMode)) return Response.json({
          code: postMode === 'owner_denied' ? 'OWNER_TRANSFER_OWNER_REQUIRED' :
            postMode === 'invalid_code' ? 'OWNER_TRANSFER_STATE_UNAVAILABLE' : 'OWNER_TRANSFER_CONFIRMATION_CHANGED',
          error: 'Synthetic confirmed rejection',
          actorId: postMode === 'unbound' ? 'other' : 'actor', service, organizationId: orgId,
          operationId: body.operationId,
        }, { status: postMode === 'owner_denied' ? 403 : 409 })
        server.phase = 'committed'; server.operationId = body.operationId; server.input = body.input; server.ownerNow = false
      }
      else throw Error('unexpected action')
      if (postMode === 'lost' && body.action === 'transfer') throw Error('synthetic response lost after commit')
      return Response.json({ actorId: 'actor', service, organizationId: orgId, operationId: body.operationId,
        phase: server.phase, input: server.input, createdAt: new Date().toISOString() })
    }
    throw Error('unexpected request ' + url)
  }
  const compile = (file, mocks) => {
    const exports = {}
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    vm.runInNewContext(output, { exports, require: name => {
      if (name in mocks) return mocks[name]
      if (name === 'react/jsx-runtime') return require('react/jsx-runtime')
      throw Error('Unmocked ' + name + ' from ' + file)
    }, React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    crypto, fetch, Response, URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    console, Storage: dom.window.Storage }, { filename: file })
    return exports
  }
  const client = compile('src/lib/owner-transfer-client.ts', {})
  const holdLock = async () => {
    const gate = deferred(), acquired = deferred()
    const pending = dom.window.navigator.locks.request(client.ownerTransferLock(service, 'actor', 'selected'),
      { mode: 'exclusive' }, async () => { acquired.resolve(); await gate.promise })
    await acquired.promise
    return async () => { gate.resolve(); await pending }
  }
  const hook = compile('src/lib/use-owner-transfer.ts', { react: React, './owner-transfer-client': client })
  const auth = { useSession: () => ({ status: 'authenticated', data: { user: { id: 'actor' } } }) }
  const panel = compile('src/components/org/OwnerTransferPanel.tsx', {
    react: React, 'next-auth/react': auth, '@/lib/use-owner-transfer': hook,
    '@/lib/owner-transfer-client': client,
  }).default
  const proof = ['quote', 'mensetsu', 'aishodan'].includes(service)
    ? { actorId: 'actor', organization: { id: orgId, slug: 'selected', name: '合成組織', role: 'owner' },
        revision: 1, current: () => true, href: path => path, api: path => path }
    : undefined
  const node = document.createElement('div'); document.body.append(node)
  const root = createRoot(node)
  let currentRole = 'owner'
  const render = async (role = currentRole, consumers = 1) => { currentRole = role; await React.act(async () => {
    root.render(React.createElement(React.Fragment, null, ...Array.from({ length: consumers }, (_, index) => React.createElement(panel, {
      key: index, service, organizationSlug: 'selected', organizationId: proof ? orgId : undefined,
      role: currentRole, proof, onCommitted: () => { refreshes.push({ service, orgId }) } }))))
  }); await flush() }
  const flush = async () => { for (let i = 0; i < 5; i++) await React.act(async () => { await new Promise(done => setImmediate(done)) }) }
  const click = async label => {
    const button = [...node.querySelectorAll('button')].find(item => item.textContent?.includes(label))
    assert(button, `missing button ${label}: ${node.textContent}`)
    await React.act(async () => { button.click() }); await flush()
  }
  const callback = label => {
    const button = [...node.querySelectorAll('button')].find(item => item.textContent?.includes(label))
    assert(button, `missing button ${label}`)
    const key = Object.keys(button).find(value => value.startsWith('__reactProps'))
    return button[key].onClick
  }
  const unmount = async () => { await React.act(async () => root.unmount()); node.remove(); dom.window.close() }
  return { service, client, storage, calls, refreshes, server, candidate, orgId, node, render, click, callback, holdLock, flush, unmount }
}

async function check(name, fn) { await fn(); cases.push(name); console.log('PASS', name) }
;(async () => {
  for (const service of services) await check(`${service}: actual panel stores before transfer and verifies receipt`, async () => {
    const f = await fixture(service)
    await f.render()
    assert.equal(f.node.querySelectorAll('button').length >= 1, true)
    await f.click('この方へ引き継ぐ')
    const posts = f.calls.filter(call => call.method === 'POST')
    assert.equal(posts.length, 1)
    const body = JSON.parse(posts[0].body)
    assert.equal(body.action, 'transfer')
    assert.equal(body.input.targetUserId, 'successor')
    assert.equal(f.storage.size, 1)
    assert.match(f.node.textContent, /引継ぎは完了/)
    assert.deepEqual(f.refreshes, [{ service, orgId: f.orgId }], 'committed receipt triggers one current-role reread')
    await f.click('引継ぎ状況を確認')
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    assert.equal(f.refreshes.length, 1, 'status replay does not loop the current-role reread')
    await f.unmount()
  })
  await check('lost response recovers by status without a second POST', async () => {
    const f = await fixture('quote', 'lost')
    await f.render(); await f.click('この方へ引き継ぐ')
    assert.match(f.node.textContent, /引継ぎ結果を確認できません/)
    await f.click('引継ぎ状況を確認')
    assert.match(f.node.textContent, /引継ぎは完了/)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    assert.deepEqual(f.refreshes, [{ service: 'quote', orgId: f.orgId }])
    await f.unmount()
  })
  await check('two mounted consumers each refresh their own current role once for the same committed receipt', async () => {
    const f = await fixture('quote')
    const operationId = crypto.randomUUID()
    f.server.phase = 'committed'
    f.server.operationId = operationId
    f.server.input = { expectedOwnerMemberId: 'owner', targetMemberId: 'target', targetUserId: 'successor',
      targetRole: 'member', targetPlan: 'LIGHT' }
    f.storage.set(f.client.ownerTransferSlot('quote', 'actor', 'selected'), JSON.stringify({ version: 1,
      service: 'quote', actorId: 'actor', organizationId: f.orgId, organizationSlug: 'selected', operationId }))
    await f.render('owner', 2)
    assert.equal(f.refreshes.length, 2, 'each parent owns its own role reread')
    assert.equal(f.calls.filter(call => new URL(call.url, 'https://synthetic.invalid').searchParams.get('action') === 'status').length, 2)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 0)
    await f.click('引継ぎ状況を確認')
    assert.equal(f.refreshes.length, 2, 'same consumer status replay cannot loop reread')
    await f.unmount()
  })
  await check('bound confirmed rejection remains distinct from unknown and keeps the handle until explicit cancel', async () => {
    const f = await fixture('quote', 'rejected')
    await f.render(); await f.click('この方へ引き継ぐ')
    assert.match(f.node.textContent, /確認した後任や組織の状態が変わりました/)
    assert.equal(f.node.textContent.includes('引継ぎ結果を確認できません'), false)
    assert.equal(f.storage.size, 1)
    assert.equal(f.server.phase, 'missing')
    await f.click('引継ぎ状況を確認')
    assert.match(f.node.textContent, /まだ登録されていません/)
    assert.equal(f.calls.filter(call => JSON.parse(call.body || '{}').action === 'transfer').length, 1)
    await f.click('未実行の引継ぎ申請を取り消す')
    assert.match(f.node.textContent, /取り消されました/)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 2)
    await f.unmount()
  })
  await check('unbound rejection stays unknown without clearing or retrying the transfer', async () => {
    const f = await fixture('aio', 'unbound')
    await f.render(); await f.click('この方へ引き継ぐ')
    assert.match(f.node.textContent, /引継ぎ結果を確認できません/)
    assert.equal(f.storage.size, 1)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    await f.unmount()
  })
  for (const mode of ['owner_denied', 'invalid_code']) await check(`${mode}: no automatic handle clear or second write`, async () => {
    const f = await fixture('mensetsu', mode)
    await f.render(); await f.click('この方へ引き継ぐ')
    assert.match(f.node.textContent, mode === 'owner_denied' ? /現在のオーナー権限を確認できません/ : /引継ぎ結果を確認できません/)
    assert.equal(f.storage.size, 1)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    await f.unmount()
  })
  await check('strict stored scope rejects a foreign actor and sends no POST', async () => {
    const f = await fixture('aio')
    const key = f.client.ownerTransferSlot('aio', 'actor', 'selected')
    f.storage.set(key, JSON.stringify({ version: 1, service: 'aio', actorId: 'foreign', organizationId: f.orgId,
      organizationSlug: 'selected', operationId: crypto.randomUUID() }))
    await f.render()
    assert.match(f.node.textContent, /安全に保存できません/)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 0)
    await f.unmount()
  })
  await check('committed historical handle survives demotion and permits a fresh owner to start explicitly', async () => {
    const f = await fixture('quote')
    await f.render(); await f.click('この方へ引き継ぐ')
    assert.equal(f.storage.size, 1)
    await f.render('admin')
    assert.equal(f.node.textContent.includes('別の引継ぎを始める'), false)
    await f.render('owner')
    await f.click('現在の権限を確認して別の引継ぎを始める')
    assert.equal(f.storage.size, 1, 'stale owner role alone cannot clear the historical handle')
    f.server.ownerNow = true // a separate confirmed B -> A transfer, followed by a fresh owner proof
    await f.click('現在の権限を確認して別の引継ぎを始める')
    assert.equal(f.storage.size, 0)
    assert.match(f.node.textContent, /後任を選択/)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    await f.unmount()
  })
  for (const service of ['shodan', 'aio']) await check(`${service}: pagehide and pageshow never reactivate the retired callback`, async () => {
    const f = await fixture(service)
    await f.render()
    const old = f.callback('この方へ引き継ぐ')
    await React.act(async () => { window.dispatchEvent(new window.Event('pagehide')) })
    await React.act(async () => { await old() }); await f.flush()
    assert.equal(f.storage.size, 0)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 0)
    const show = new window.Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true })
    await React.act(async () => { window.dispatchEvent(show) }); await f.flush()
    await React.act(async () => { await old() }); await f.flush()
    assert.equal(f.storage.size, 0)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 0)
    await f.click('この方へ引き継ぐ')
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    await f.unmount()
  })
  await check('scope A-B-A cannot revive a retained owner callback', async () => {
    const f = await fixture('shodan')
    await f.render()
    const old = f.callback('この方へ引き継ぐ')
    await f.render('admin'); await f.render('owner')
    await React.act(async () => { await old() }); await f.flush()
    assert.equal(f.storage.size, 0)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 0)
    await f.click('この方へ引き継ぐ')
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    await f.unmount()
  })
  await check('queued WebLock from a retired page cannot save a handle or POST after pageshow', async () => {
    const f = await fixture('aio')
    await f.render()
    const release = await f.holdLock()
    await f.click('この方へ引き継ぐ')
    assert.equal(f.storage.size, 0)
    await React.act(async () => { window.dispatchEvent(new window.Event('pagehide')) })
    const show = new window.Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true })
    await React.act(async () => { window.dispatchEvent(show) }); await f.flush()
    await release(); await f.flush()
    assert.equal(f.storage.size, 0)
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 0)
    await f.click('この方へ引き継ぐ')
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    await f.unmount()
  })
  await check('retired missing-cancel callback cannot POST after persisted pageshow', async () => {
    const f = await fixture('shodan')
    const handle = { version: 1, service: 'shodan', actorId: 'actor', organizationId: f.orgId,
      organizationSlug: 'selected', operationId: crypto.randomUUID() }
    f.client.saveOwnerTransferHandle(window.localStorage, handle)
    await f.render()
    const old = f.callback('未実行の引継ぎ申請を取り消す')
    await React.act(async () => { window.dispatchEvent(new window.Event('pagehide')) })
    const show = new window.Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true })
    await React.act(async () => { window.dispatchEvent(show) }); await f.flush()
    await React.act(async () => { await old() }); await f.flush()
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 0)
    assert.equal(f.storage.size, 1)
    await f.click('未実行の引継ぎ申請を取り消す')
    assert.equal(f.calls.filter(call => call.method === 'POST').length, 1)
    await f.unmount()
  })
  await check('retired terminal-clear callback cannot erase a handle after persisted pageshow', async () => {
    const f = await fixture('aio')
    const handle = { version: 1, service: 'aio', actorId: 'actor', organizationId: f.orgId,
      organizationSlug: 'selected', operationId: crypto.randomUUID() }
    f.client.saveOwnerTransferHandle(window.localStorage, handle)
    f.server.phase = 'canceled'; f.server.operationId = handle.operationId
    await f.render()
    const old = f.callback('現在の権限を確認して別の引継ぎを始める')
    await React.act(async () => { window.dispatchEvent(new window.Event('pagehide')) })
    const show = new window.Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true })
    await React.act(async () => { window.dispatchEvent(show) }); await f.flush()
    const before = f.calls.length
    await React.act(async () => { await old() }); await f.flush()
    assert.equal(f.calls.length, before)
    assert.equal(f.storage.size, 1)
    await f.click('現在の権限を確認して別の引継ぎを始める')
    assert.equal(f.storage.size, 0)
    await f.unmount()
  })
  const sourceHashes = Object.fromEntries(sourcePaths.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))
  console.log(JSON.stringify({ passed: cases.length, cases, sourceHashes,
    scope: 'Actual shared Panel/hook/client with synthetic SDK session and HTTP; no real browser, DB, retirement, or provider.' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
