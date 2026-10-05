const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { load, check, results } = require('./load-typescript.cjs')
const callbackHelpers = load('src/lib/safe-signin-callback.ts')
const tick = () => new Promise(resolve => setImmediate(resolve))

function fixture(callback = '/hr/dashboard', behavior = () => Promise.resolve(), queryError = null) {
  const slots = [], calls = []
  let cursor = 0, mounted = false
  const effects = [], cleanups = [], listeners = new Map()
  const react = {
    Suspense: 'suspense',
    useEffect(effect) { if (!mounted) effects.push(effect) },
    useState(value) {
      const i = cursor++
      if (!(i in slots)) slots[i] = value
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
    },
    useRef(value) {
      const i = cursor++
      if (!(i in slots)) slots[i] = { current: value }
      return slots[i]
    },
  }
  const jsx = (type, props, key) => ({ type, props, key })
  const params = new URLSearchParams({ callbackUrl: callback, ...(queryError ? { error: queryError } : {}) })
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next-auth/react': { signIn: (...args) => {
      calls.push(args)
      const promise = behavior(calls.length)
      // Observe SDK rejection independently so the unfixed handler cannot terminate this test process.
      promise?.catch?.(() => {})
      return promise
    } },
    'next/navigation': { useSearchParams: () => params },
    'next/link': { default: 'a' },
    'framer-motion': { motion: { div: 'motion.div' } },
    'lucide-react': Object.fromEntries(['BarChart3', 'PenLine', 'Palette', 'Sparkles', 'Mic', 'FileText', 'Wand2'].map(name => [name, name])),
    '@/lib/safe-signin-callback': callbackHelpers,
  }
  const file = 'src/app/auth/signin/page.tsx'
  const exports = {}
  const source = fs.readFileSync(file, 'utf8') + '\nexports.SignInContent = SignInContent\n'
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { exports, require: name => {
    if (name in mocks) return mocks[name]
    throw Error('Unexpected import ' + name)
  }, window: { addEventListener: (name, listener) => listeners.set(name, listener), removeEventListener: (name, listener) => { if (listeners.get(name) === listener) listeners.delete(name) } } }, { filename: file })
  function find(tree, predicate) {
    if (!tree || typeof tree !== 'object') return null
    if (Array.isArray(tree)) {
      for (const child of tree) { const hit = find(child, predicate); if (hit) return hit }
      return null
    }
    if (predicate(tree)) return tree
    return find(tree.props?.children, predicate)
  }
  const render = () => { cursor = 0; const tree = exports.SignInContent(); if (!mounted) { mounted = true; for (const effect of effects) cleanups.push(effect()) }; return tree }
  const button = () => find(render(), node => node.type === 'button' && typeof node.props.onClick === 'function')
  const alert = () => find(render(), node => node.props?.role === 'alert')
  return { calls, render, find, button, alert, pageShow: persisted => listeners.get('pageshow')?.({ persisted }), unmount: () => { for (const cleanup of cleanups) cleanup?.() }, listenerCount: () => listeners.size }
}

;(async () => {
  await check('failed OAuth start releases loading and shows a safe accessible retry message', async () => {
    const f = fixture('/hr/dashboard', () => Promise.reject(new TypeError('PRIVATE_NETWORK_DETAILS')))
    await f.button().props.onClick()
    await tick()
    assert.equal(f.button().props.disabled, false)
    assert.ok(f.alert(), 'network failure must be announced without requiring a page reload')
    assert.ok(!JSON.stringify(f.render()).includes('PRIVATE_NETWORK_DETAILS'))
    assert.equal(f.calls.length, 1)
  })
  await check('failed start can be retried and preserves the exact local return destination', async () => {
    const callback = '/seo/articles/synthetic?tab=outline#editor'
    const f = fixture(callback, attempt => attempt === 1 ? Promise.reject(Error('synthetic')) : Promise.resolve())
    await f.button().props.onClick()
    assert.equal(f.button().props.disabled, false)
    await f.button().props.onClick()
    assert.equal(f.calls.length, 2)
    assert.equal(f.calls[1][0], 'google')
    assert.equal(f.calls[1][1].callbackUrl, callback)
    assert.equal(f.alert(), null)
  })
  await check('duplicate starts before rerender and during SDK waiting are ignored', async () => {
    let reject
    const pending = new Promise((resolve, fail) => { reject = fail })
    const f = fixture('/hr/dashboard', () => pending)
    const handler = f.button().props.onClick
    const first = handler()
    await handler()
    assert.equal(f.calls.length, 1)
    assert.equal(f.button().props.disabled, true)
    reject(Error('synthetic'))
    await first
    assert.equal(f.button().props.disabled, false)
  })
  await check('successful redirect initiation stays locked until navigation leaves the page', async () => {
    const f = fixture()
    await f.button().props.onClick()
    assert.equal(f.button().props.disabled, true)
    await f.button().props.onClick()
    assert.equal(f.calls.length, 1)
    assert.equal(f.alert(), null)
  })
  await check('synchronous SDK failure is recoverable too', async () => {
    const f = fixture('/persona', () => { throw Error('PRIVATE_SYNC_DETAILS') })
    await f.button().props.onClick()
    assert.equal(f.button().props.disabled, false)
    assert.ok(f.alert())
    assert.ok(!JSON.stringify(f.render()).includes('PRIVATE_SYNC_DETAILS'))
  })
  await check('HR invitation account selection and callback sanitization remain intact', async () => {
    const invitation = fixture('/hr/invite/synthetic?return=details')
    await invitation.button().props.onClick()
    assert.equal(invitation.calls[0][1].callbackUrl, '/hr/invite/synthetic?return=details')
    assert.equal(invitation.calls[0][2].prompt, 'select_account')
    const external = fixture('//external.example/private')
    await external.button().props.onClick()
    assert.equal(external.calls[0][1].callbackUrl, '/seo')
    assert.equal(external.calls[0][2], undefined)
  })
  await check('all three invitation services prompt for the recipient account while other routes keep normal sign-in',async()=>{for(const service of ['aio','shodan','hr']){const f=fixture(`/${service}/invite/synthetic%3Ftoken?return=details`);await f.button().props.onClick();assert.equal(f.calls[0][2].prompt,'select_account');assert.equal(Object.keys(f.calls[0][2]).length,1);assert.equal(f.calls[0][1].callbackUrl,`/${service}/invite/synthetic%3Ftoken?return=details`)}for(const callback of ['/aio/team','/shodan/invite','/aio/invite/synthetic/nested','/hr/inviteevil/token']){const f=fixture(callback);await f.button().props.onClick();assert.equal(f.calls[0][2],undefined)}})
  await check('existing OAuth error query is still shown accessibly', async () => {
    const f = fixture('/quote', undefined, 'OAuthCallback')
    assert.ok(f.alert())
    assert.ok(JSON.stringify(f.render()).includes('ログイン処理に失敗しました。'))
  })
  await check('restoring the page from browser history allows another OAuth start', async () => {
    const f = fixture()
    await f.button().props.onClick()
    f.pageShow(false)
    assert.equal(f.button().props.disabled, true, 'ordinary pageshow must not unlock an active start')
    f.pageShow(true)
    assert.equal(f.button().props.disabled, false, 'bfcache restoration must not leave the page permanently locked')
    await f.button().props.onClick()
    assert.equal(f.calls.length, 2)
    f.unmount()
    assert.equal(f.listenerCount(), 0)
  })
  await check('late failure from before history restoration cannot unlock a newer attempt', async () => {
    let rejectOld, rejectNew
    const old = new Promise((resolve, reject) => { rejectOld = reject })
    const next = new Promise((resolve, reject) => { rejectNew = reject })
    const f = fixture('/quote', attempt => attempt === 1 ? old : next)
    const first = f.button().props.onClick()
    f.pageShow(true)
    const second = f.button().props.onClick()
    rejectOld(Error('old-synthetic'))
    await first
    assert.equal(f.button().props.disabled, true)
    assert.equal(f.alert(), null)
    rejectNew(Error('new-synthetic'))
    await second
    assert.equal(f.button().props.disabled, false)
    assert.ok(f.alert())
    f.unmount()
    assert.equal(f.listenerCount(), 0)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
