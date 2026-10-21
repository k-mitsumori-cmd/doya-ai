process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript'), React = require(root + '/node_modules/react')
const { JSDOM } = require(root + '/node_modules/jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/aishodan?org=A' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require(root + '/node_modules/react-dom/client')
const { Simulate } = require(root + '/node_modules/react-dom/test-utils')
const { workspaceHref, workspaceApi } = (() => {
  const filename = path.join(root, 'src/lib/organization-workspace-selection.ts'), m = new Module(filename)
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  return m.exports
})()
let active = true, requests = [], pending = [], proof, richCase = ''
const row = { id: 'id-A', slug: 'A', name: 'Org A', role: 'owner' }
const makeProof = () => ({ actorId: 'actor-A', organization: row, revision: 1, current: () => active, href: p => workspaceHref(p, 'A'), api: p => workspaceApi(p, 'A') })
proof = makeProof()
const scope = { kind: 'ready', proof, memberships: [row] }
const workspace = { scope }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const scenario = { id: 'item-1', name: 'Scenario A', product: { id: 'p1', name: 'Product A', profile: null },
  phases: [], slots: [], icp: { conditions: [] }, guardrails: { pricePolicy: 'disclose', noEvidenceBehavior: 'defer', competitorPolicy: 'neutral', prohibitedTopics: [] },
  persona: { tone: 'polite', firstPerson: '私', maxCharsPerUtterance: 100 }, durationMin: 15, schedulingUrl: null, schedulingLabel: null }
const session = { id: 'item-1', guestName: null, guestCompany: null, guestEmail: null, status: 'completed', startedAt: '2026-10-22T00:00:00Z', endedAt: '2026-10-22T00:10:00Z',
  schedulingClickedAt: null, roomName: 'Room A', isPreview: false, productName: 'Product A', turns: [], slots: [], questions: [], outcome: null }
const toolProduct = { id: 'p1', name: 'Product A', sourceUrl: 'https://service.invalid', scenarios: [{ id: 'item-1', name: 'Scenario A' }], _count: { chunks: 1, sources: 1 } }
const toolRoom = { id: 'r1', name: 'Room A', token: 'token-a', isActive: true, expiresAt: null, createdAt: '2026-10-22T00:00:00Z',
  sessionCount: 0, maxSessions: 10, scenario: { id: 'item-1', name: 'Scenario A', product: { name: 'Product A' } }, _count: { sessions: 0 } }
const data = url => url.includes('/products') ? { products: richCase === 'preview' ? [{ id: 'p1', name: 'Product A', scenarios: [{ id: 'item-1', name: 'Scenario A' }] }] : richCase.startsWith('tool:') ? [toolProduct] : [], nextCursor: null, total: 0 }
  : url.includes('/rooms') ? { rooms: richCase.startsWith('tool:') ? [toolRoom] : [], nextCursor: null, total: 0 }
  : url.includes('/stats') ? { total: 0, unanswered: [] }
  : url.includes('/scenarios/') ? { scenario: richCase === 'scenario detail' ? scenario : null }
  : url.includes('/sessions/') ? { session: richCase === 'session detail' ? session : null }
  : { sessions: [], nextCursor: null, total: 0 }
const request = url => { requests.push(url); const held = deferred(); pending.push({ url, held }); return held.promise }
global.fetch = (url, init) => request(url).then(value => ({ ok: true, json: async () => value, status: 200, init }))
const primitive = ({ children, href, className }) => React.createElement(href ? 'a' : 'div', { href, className }, children)
const dummy = { __esModule: true, default: primitive }
const components = new Proxy({}, { get: (_, key) => key === '__esModule' ? true : primitive })
const listPages = { parseAishodanPage: (d, key) => ({ items: d[key] || [], nextCursor: d.nextCursor || null, total: d.total || 0 }), appendAishodanPage: (items, page) => [...items, ...page.items] }
const mocks = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'),
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
  'next/navigation': { useParams: () => ({ id: 'item-1' }) },
  '@/components/org/OrganizationWorkspaceBoundary': { useOrganizationWorkspace: () => workspace, useOptionalOrganizationWorkspace: () => workspace, useWorkspaceProof: () => proof },
  '@/components/org/OrgSwitcher': { __esModule: true, default: primitive },
  '@/lib/org-fetch': { fetchOrgJson: url => request(url) },
  '@/lib/aishodan/types': { SESSION_STATUS_LABELS: {}, VERDICT_LABELS: {}, PRICE_POLICY_LABELS: {} },
  '@/lib/aishodan/list-pages': listPages,
  '@/lib/ui/notify': { notifyError: (setter, message) => setter(message) },
  '@/components/shell/ui-next-context': { useUiNext: () => true },
  '@/components/lp': { DoyaKun: primitive },
  '@/components/LoadingProgress': dummy,
  '@/components/aishodan/AishodanHeading': dummy,
  '@/components/SignInReturnLink': dummy,
  '@/components/EmptyState': dummy,
  '@/components/ds': components,
  '@/components/ds/motion': { Stagger: primitive, StaggerItem: primitive },
  './Lp': dummy,
}
const cache = new Map()
function load(rel) {
  if (cache.has(rel)) return cache.get(rel).exports.default
  const filename = path.join(root, rel), m = new Module(filename)
  cache.set(rel, m); m.paths = Module._nodeModulePaths(path.dirname(filename))
  m.require = id => { if (id in mocks) return mocks[id]; throw Error(`Unmocked ${id} from ${rel}`) }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return m.exports.default
}
const pages = [
  ['dashboard', 'src/app/(shell)/aishodan/Tool.tsx', ['/api/aishodan/products?org=A', '/api/aishodan/rooms?org=A', '/api/aishodan/sessions?org=A', '/api/aishodan/stats?org=A']],
  ['sessions', 'src/app/(shell)/aishodan/sessions/page.tsx', ['/api/aishodan/sessions?org=A']],
  ['session detail', 'src/app/(shell)/aishodan/sessions/[id]/page.tsx', ['/api/aishodan/sessions/item-1?org=A']],
  ['scenario detail', 'src/app/(shell)/aishodan/scenarios/[id]/page.tsx', ['/api/aishodan/scenarios/item-1?org=A']],
  ['preview', 'src/app/(shell)/aishodan/preview/page.tsx', ['/api/aishodan/products?org=A', '/api/aishodan/sessions?scope=preview&org=A']],
]
const tick = () => new Promise(r => setImmediate(r))
;(async () => {
  for (const [label, file, expected] of pages) {
    requests = []; pending = []; active = true; proof = makeProof(); scope.proof = proof; richCase = label
    const view = createRoot(document.getElementById('root'))
    await React.act(async () => { view.render(React.createElement(load(file))); await tick() })
    assert.deepEqual(requests, expected, label)
    await React.act(async () => { for (const item of pending) item.held.resolve(data(item.url)); await tick() })
    const links = [...document.querySelectorAll('a[href^="/aishodan"]')]
    assert.ok(links.length > 0, `${label} must expose a real local navigation link`)
    for (const link of links) assert.equal(new URL(link.href).searchParams.get('org'), 'A', `${label} link ${link.href}`)
    if (label === 'dashboard') {
      const input = document.getElementById('aishodan-import-url')
      assert.ok(input)
      await React.act(async () => { Simulate.change(input, { target: { value: 'https://service.invalid' } }); await tick() })
      const action = [...document.querySelectorAll('button')].find(button => button.textContent.includes('取り込む'))
      assert.ok(action && !action.disabled)
      const before = requests.length
      active = false
      await React.act(async () => { action.click(); await tick() })
      assert.equal(requests.length, before, 'dashboard retained import cannot write')
      active = true
    }
    if (['session detail', 'scenario detail', 'preview'].includes(label)) {
      const before = requests.length
      active = false
      const actionText = label === 'session detail' ? '自動判定をやり直す' : label === 'scenario detail' ? '保存' : '練習を始める'
      const action = [...document.querySelectorAll('button')].find(button => button.textContent.includes(actionText))
      assert.ok(action, `${label} retained action exists`)
      await React.act(async () => { action.click(); await tick() })
      assert.equal(requests.length, before, `${label} retired action cannot write`)
      active = true
    }
    await React.act(async () => view.unmount())

    requests = []; pending = []; active = true; proof = makeProof(); scope.proof = proof; richCase = ''
    const retiringView = createRoot(document.getElementById('root'))
    await React.act(async () => { retiringView.render(React.createElement(load(file))); await tick() })
    assert.deepEqual(requests, expected, `${label} before retirement`)
    active = false
    await React.act(async () => { for (const item of pending) item.held.resolve(data(item.url)); await tick() })
    assert.equal(requests.length, expected.length, `${label} retired response must not start another request`)
    await React.act(async () => retiringView.unmount())
  }
  for (const [label, file] of [pages[0], pages[2], pages[3], pages[4]]) {
    requests = []; pending = []; active = true; proof = makeProof(); scope.proof = proof; richCase = label
    const view = createRoot(document.getElementById('root'))
    await React.act(async () => { view.render(React.createElement(load(file))); await tick() })
    await React.act(async () => { for (const item of [...pending]) item.held.resolve(data(item.url)); await tick() })
    const actionText = label === 'dashboard' ? '取り込む' : label === 'session detail' ? '自動判定をやり直す'
      : label === 'scenario detail' ? '保存' : '練習を始める'
    if (label === 'dashboard') {
      const input = document.getElementById('aishodan-import-url')
      await React.act(async () => { Simulate.change(input, { target: { value: 'https://service.invalid' } }); await tick() })
    }
    const action = [...document.querySelectorAll('button')].find(button => button.textContent.includes(actionText))
    assert.ok(action && !action.disabled, `${label} action ready`)
    const oldProof = proof, startIndex = pending.length
    React.act(() => { action.click() }); await tick()
    assert.equal(pending.length, startIndex + 1, `${label} pending mutation`)
    oldProof.current = () => false
    proof = makeProof(); scope.proof = proof
    React.act(() => { view.render(React.createElement(load(file))) }); await tick()
    React.act(() => { for (const item of pending.slice(startIndex + 1)) item.held.resolve(data(item.url)) })
    await React.act(async () => { await tick() })
    const busyText = label === 'dashboard' ? '取り込み中' : label === 'session detail' ? '処理中'
      : label === 'scenario detail' ? '保存中' : '準備中'
    const stillBusy = [...document.querySelectorAll('button')].find(button => button.textContent.includes(busyText))
    assert.equal(stillBusy, undefined, `${label} old operation must release busy after same-actor proof refresh`)
    assert.match(document.body.textContent, /直前の.*結果を確認できません/, `${label} unknown result must remain visible`)
    const recheck = [...document.querySelectorAll('button')].find(button => button.textContent.includes('最新の') && button.textContent.includes('読み込む'))
    assert.ok(recheck, `${label} explicit authoritative reread exists`)
    const beforeRecheck = pending.length
    React.act(() => recheck.click()); await tick()
    assert.ok(pending.length > beforeRecheck, `${label} explicit reread started`)
    React.act(() => { for (const item of pending.slice(beforeRecheck)) item.held.resolve(data(item.url)) })
    await React.act(async () => { await tick() })
    assert.match(document.body.textContent, /後から/, `${label} reread must not claim old operation has drained`)
    const late = label === 'dashboard' ? { product: { name: 'late' }, pageCount: 1, chunkCount: 1 }
      : label === 'scenario detail' ? { scenario: { ...scenario, name: 'LATE_RESULT' } } : label === 'session detail' ? { ok: true } : { token: 'late' }
    React.act(() => pending[startIndex].held.resolve(late))
    await React.act(async () => { await tick() })
    assert.equal([...document.querySelectorAll('button')].some(button => button.textContent.includes(busyText)), false)
    assert.equal(document.body.textContent.includes('LATE_RESULT'), false)
    await React.act(async () => view.unmount())
  }
  window.confirm = () => true
  for (const [kind, actionText, busyText] of [
    ['issue', '商談URLを発行する', '発行中'], ['delete-product', '削除・保管', '処理中'], ['delete-room', 'このURLを削除', '削除中'],
  ]) {
    requests = []; pending = []; active = true; proof = makeProof(); scope.proof = proof; richCase = `tool:${kind}`
    const view = createRoot(document.getElementById('root'))
    await React.act(async () => { view.render(React.createElement(load(pages[0][1]))); await tick() })
    React.act(() => { for (const item of [...pending]) item.held.resolve(data(item.url)) })
    await React.act(async () => { await tick() })
    const action = [...document.querySelectorAll('button')].find(button => button.textContent.includes(actionText))
    assert.ok(action && !action.disabled, `${kind} action ready`)
    const oldProof = proof, startIndex = pending.length
    React.act(() => action.click()); await tick()
    assert.equal(pending.length, startIndex + 1, `${kind} pending mutation`)
    oldProof.current = () => false
    proof = makeProof(); scope.proof = proof
    React.act(() => { view.render(React.createElement(load(pages[0][1]))) })
    await tick()
    React.act(() => { for (const item of pending.slice(startIndex + 1)) item.held.resolve(data(item.url)) })
    await React.act(async () => { await tick() })
    assert.equal([...document.querySelectorAll('button')].some(button => button.textContent.includes(busyText)), false, `${kind} old busy released`)
    assert.match(document.body.textContent, /直前の操作結果を確認できません/)
    React.act(() => pending[startIndex].held.resolve({ archived: false }))
    await React.act(async () => { await tick() })
    assert.equal([...document.querySelectorAll('button')].some(button => button.textContent.includes(busyText)), false, `${kind} late finally did not reinstate busy`)
    await React.act(async () => view.unmount())
  }
  dom.window.close()
  console.log('PASS 21 actual mounted Aishodan consumer cases: five screens scoped requests/links, retired actions and late reads; dashboard import/issue/delete product/delete room, detail, scenario, preview in-flight same actor proof refresh release busy with old result ignored. Synthetic transport/proof.')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
