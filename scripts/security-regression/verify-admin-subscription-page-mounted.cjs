// Actual admin page and actual durable hook with synthetic session/list/API. No real browser or provider.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm')
const React = require('react'), ts = require('typescript'), { JSDOM } = require('jsdom')
const { createRoot } = require('react-dom/client')
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://admin.invalid/admin/users' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const held = new Map(), storage = new Map(), calls = []
dom.window.navigator.locks = { request: async (name, _options, work) => {
  const previous = held.get(name) || Promise.resolve(); let release
  const tail = new Promise(resolve => { release = resolve }); held.set(name, previous.then(() => tail))
  await previous; try { return await work() } finally { release() }
} }
const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key) }
let actor = null, users = [], stripeStatus = 200
async function fetch(url, init) {
  calls.push({ url, init })
  if (url === '/api/admin/auth/session') return actor ? Response.json({ authenticated: true, adminUser: { id: actor } }) : Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
  if (url === '/api/admin/users') return Response.json(users)
  if (url === '/api/admin/stripe') {
    if (stripeStatus !== 200) return Response.json({ code: 'ADMIN_AUTHORITY_CHANGED' }, { status: stripeStatus })
    const body = JSON.parse(init.body)
    return Response.json({ source: 'admin', actorId: actor, targetUserId: body.targetUserId,
      operationId: body.operationId, intent: body.intent, phase: 'executing', reason: 'EXTERNAL_UNKNOWN',
      canAbort: false, canContinue: false, actionPhase: 'dispatched', result: null })
  }
  throw Error('Unexpected fetch ' + url)
}
const compile = (file, mocks) => {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const exports = {}
  vm.runInNewContext(output, { exports, require: name => {
    if (name in mocks) return mocks[name]
    if (name === 'react/jsx-runtime') return require('react/jsx-runtime')
    throw Error('Unmocked ' + name)
  }, React, window: dom.window, document: dom.window.document, localStorage, fetch,
  crypto: require('node:crypto').webcrypto, Response, URLSearchParams, URL, Date, console,
  setTimeout, clearTimeout, confirm: () => true }, { filename: file })
  return exports
}
const hook = compile('src/lib/admin-subscription-client.ts', { react: React })
const motion = new Proxy({}, { get: (_target, tag) => ({ children, ...props }) => React.createElement(tag,
  Object.fromEntries(Object.entries(props).filter(([key]) => !['variants', 'initial', 'animate', 'exit', 'whileHover', 'whileTap', 'transition', 'layout'].includes(key))), children) })
const icons = new Proxy({}, { get: () => () => React.createElement('span') })
const toast = () => {}; toast.success = () => {}; toast.error = () => {}
const page = compile('src/app/admin/users/page.tsx', { react: React, 'next/navigation': { useRouter: () => ({ push() {} }) },
  'framer-motion': { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) },
  'lucide-react': icons, 'react-hot-toast': { __esModule: true, default: toast, Toaster: () => null },
  '@/lib/plan-utils': { isPaidTier: () => false, tierFrom: value => value },
  '@/lib/admin-subscription-client': hook })
const rootNode = document.createElement('div'); document.body.append(rootNode)
const root = createRoot(rootNode), flush = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)) }
const button = label => [...rootNode.querySelectorAll('button')].find(node => node.textContent.trim() === label)
;(async () => {
  await React.act(async () => { root.render(React.createElement(page.default)); await flush() })
  assert(button('管理者認証を再確認'), 'bootstrap failure exposes a real page retry control')
  assert.equal(rootNode.textContent.includes('保存された課金操作があります'), false)
  actor = 'admin1'
  await React.act(async () => { button('管理者認証を再確認').click(); await flush() })
  assert.equal(button('管理者認証を再確認'), undefined)
  const handle = { version: 1, actorId: 'admin1', targetUserId: 'user1',
    operationId: require('node:crypto').randomUUID(), intent: 'immediate_cancel' }
  storage.set('doya:admin-subscription:v1:admin1', JSON.stringify(handle))
  await React.act(async () => { dom.window.dispatchEvent(new dom.window.Event('focus')); await flush() })
  assert(rootNode.textContent.includes(handle.operationId), 'same actor restore shows the saved operation')
  const before = calls.filter(call => call.url === '/api/admin/stripe').length
  await React.act(async () => { button('保存状態を確認').click(); await flush() })
  assert.equal(calls.filter(call => call.url === '/api/admin/stripe').length, before + 1)
  assert.equal(JSON.parse(calls.filter(call => call.url === '/api/admin/stripe').at(-1).init.body).action, 'status')
  stripeStatus = 403
  await React.act(async () => { button('保存状態を確認').click(); await flush() })
  assert.equal(rootNode.textContent.includes(handle.operationId), false, '403 masks private operation context')
  assert(storage.has('doya:admin-subscription:v1:admin1'))
  stripeStatus = 200
  await React.act(async () => { button('管理者認証を再確認').click(); await flush() })
  assert(rootNode.textContent.includes(handle.operationId), 'same actor explicit retry restores the durable handle')
  actor = 'admin2'
  await React.act(async () => { dom.window.dispatchEvent(new dom.window.Event('focus')); await flush() })
  assert.equal(rootNode.textContent.includes(handle.operationId), false, 'foreign actor context is masked')
  assert(storage.has('doya:admin-subscription:v1:admin1'), 'foreign actor handle remains durable')
  await React.act(async () => { root.unmount(); await flush() })
  rootNode.remove()

  // Each of the three real buttons emits the strict action union through the actual hook.
  const user = { id: 'user1', name: 'Synthetic', email: 'user@example.invalid', image: null,
    plan: 'PRO', role: 'USER', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    stripeCustomerId: 'cus_one', stripeSubscriptionId: 'sub_one', totalGenerations: 0,
    bannerQuota: { used: 0, limit: 10, remaining: 10 }, seoQuota: { used: 0, limit: 10, remaining: 10 },
    serviceSubscriptions: [], services: [], stripeInfo: { status: 'active', currentPeriodStart: '2026-01-01T00:00:00.000Z',
      currentPeriodEnd: '2026-11-01T00:00:00.000Z', cancelAtPeriodEnd: false, canceledAt: null,
      created: '2026-01-01T00:00:00.000Z', amount: 1000, interval: 'month' } }
  const buttonAction = async (label, intent, scheduled) => {
    storage.clear(); actor = 'admin1'; users = [{ ...user, stripeInfo: { ...user.stripeInfo, cancelAtPeriodEnd: scheduled } }]
    const node = document.createElement('div'); document.body.append(node); const mounted = createRoot(node)
    await React.act(async () => { mounted.render(React.createElement(page.default)); await flush() })
    const edit = node.querySelector('button[aria-label="Syntheticの詳細を編集"]')
    assert(edit, 'actual user row exposes the edit dialog')
    await React.act(async () => { edit.click(); await flush() })
    const actionButton = [...node.querySelectorAll('button')].find(item => item.textContent.trim() === label)
    assert(actionButton, `actual ${label} button is mounted`)
    const before = calls.filter(call => call.url === '/api/admin/stripe').length
    await React.act(async () => { actionButton.click(); await flush() })
    const writes = calls.filter(call => call.url === '/api/admin/stripe')
    assert.equal(writes.length, before + 1)
    const body = JSON.parse(writes.at(-1).init.body)
    assert.equal(body.action, 'start'); assert.equal(body.intent, intent)
    assert.equal(body.expectedAdminId, 'admin1'); assert.equal(body.targetUserId, 'user1')
    assert.equal(JSON.parse([...storage.values()][0]).operationId, body.operationId)
    await React.act(async () => { mounted.unmount(); await flush() }); node.remove()
  }
  await buttonAction('期間終了時にキャンセル', 'period_end_cancel', false)
  await buttonAction('即時キャンセル', 'immediate_cancel', false)
  await buttonAction('解約予約を取り消す', 'resume', true)
  console.log(JSON.stringify({ passed: 8, scope: 'actual admin page 3 buttons + hook + synthetic principal/list/API, no browser auth/provider' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
