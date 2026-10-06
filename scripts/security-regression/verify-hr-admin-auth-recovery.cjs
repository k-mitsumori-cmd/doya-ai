const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { load, check, results } = require('./load-typescript.cjs')
const callbacks = load('src/lib/safe-signin-callback.ts')
const tick = () => new Promise(resolve => setImmediate(resolve))
const info = { success: true, invitation: { status: 'PENDING', email: 'qa@example.invalid', organization: { id: 'org', name: 'Synthetic org' } } }
const ok = data => ({ status: 200, ok: true, json: async () => data })
function fixture(kind, { get = () => ok(kind === 'hr' ? info : { authenticated: true }), post = () => ({ status: 401, ok: false, json: async () => { throw Error('Synthetic non-JSON 401') } }), sdk = () => Promise.reject(Error('PRIVATE_SDK')), logout = sdk, email = null, token = 'synthetic?x#y', pathname = '/admin/users' } = {}) {
  const slots = [], effects = [], requests = [], auth = [], signouts = [], errors = [], navigation = [], listeners = new Set(), timers = new Map()
  let cursor = 0, disposed = false, writesAfterUnmount = 0, key, timerId = 0, getCount = 0
  const react = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { if (disposed) writesAfterUnmount++; slots[i] = typeof next === 'function' ? next(slots[i]) : next }] },
    useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i] },
    useEffect(action, deps) { const i = cursor++; const previous = slots[i]; if (!previous || deps.some((d, n) => !Object.is(d, previous.deps[n]))) { previous?.cleanup?.(); slots[i] = { deps, cleanup: null }; effects.push(() => { slots[i].cleanup = action() }) } },
  }
  const window = { addEventListener: (event, fn) => { if (event === 'pageshow') listeners.add(fn) }, removeEventListener: (event, fn) => listeners.delete(fn) }
  const signIn = (...args) => { auth.push(args); const p = sdk(auth.length); p?.catch?.(() => {}); return p }
  const signOut = (...args) => { signouts.push(args); const p = logout(signouts.length); p?.catch?.(() => {}); return p }
  const hook = load('src/lib/use-navigation-submission.ts', { react, '@/lib/safe-signin-callback': callbacks, 'next-auth/react': { signIn, signOut }, 'react-hot-toast': { error: text => errors.push(text) } }, { window })
  const router = { push: url => navigation.push(url) }
  const jsx = (type, props, key) => ({ type, props, key })
  const mocks = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/navigation': { useParams: () => ({ token }), usePathname: () => pathname, useRouter: () => router }, 'next-auth/react': { signIn, signOut, useSession: () => ({ data: email ? { user: { email } } : null, status: email ? 'authenticated' : 'unauthenticated' }) }, '@/lib/use-navigation-submission': hook, 'framer-motion': { motion: new Proxy({}, { get: (_, name) => 'motion.' + name }), AnimatePresence: 'div' } }
  const file = kind === 'hr' ? 'src/app/hr/invite/[token]/page.tsx' : 'src/components/AdminAuthWrapper.tsx'
  const baseline = process.env.DOYA_TEST_BASELINE && path.join(process.env.DOYA_TEST_BASELINE, file)
  const source = fs.readFileSync(baseline && fs.existsSync(baseline) ? baseline : file, 'utf8'), exports = {}
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, require: name => { if (name in mocks) return mocks[name]; throw Error('Unexpected import ' + name) }, fetch: async (url, options) => { requests.push({ url, options }); return options?.method === 'POST' ? post(requests.filter(r => r.options?.method === 'POST').length) : get(++getCount) }, window, AbortController, encodeURIComponent, Error, setTimeout: fn => { timers.set(++timerId, fn); return timerId }, clearTimeout: id => timers.delete(id) }, { filename: file })
  const render = () => { cursor = 0; let tree = kind === 'hr' ? exports.default() : exports.AdminAuthWrapper({ children: 'PRIVATE_CHILD' }); key = tree.key; if (typeof tree.type === 'function') tree = tree.type(tree.props); while (effects.length) effects.shift()(); return tree }
  const find = (tree, test) => { if (!tree || typeof tree !== 'object') return null; if (Array.isArray(tree)) { for (const child of tree) { const hit = find(child, test); if (hit) return hit } return null } return test(tree) ? tree : find(tree.props?.children, test) }
  const button = text => find(render(), n => ['button', 'motion.button'].includes(n.type) && (!text || JSON.stringify(n.props.children).includes(text)))
  const ready = async () => { render(); await tick(); await tick(); render() }
  const unmount = () => { disposed = true; for (const slot of slots) slot?.cleanup?.() }
  return { render, button, ready, auth, signouts, errors, requests, navigation, timers, key: () => key, restore: persisted => [...listeners].forEach(fn => fn({ persisted })), unmount, writesAfterUnmount: () => writesAfterUnmount }
}
;(async () => {
  for (const kind of ['hr', 'admin']) {
    for (const action of ['signIn', 'switch']) await check(`${kind}: ${action} failure recovers and retries a preserved safe destination`, async () => {
      const f = fixture(kind, { email: action === 'switch' ? 'outside@example.invalid' : null, post: () => action === 'signIn' ? { status: 401, ok: false, json: async () => { throw Error('Synthetic non-JSON 401') } } : { status: 403, ok: false, json: async () => ({ code: 'INVITE_EMAIL_MISMATCH', error: 'Synthetic mismatch' }) } })
      await f.ready(); if (kind === 'hr') await f.button('招待を受ける').props.onClick()
      const label = action === 'switch' ? '別のアカウント' : 'Googleでログイン'
      await Promise.resolve(f.button(label).props.onClick()).catch(() => {})
      assert.notEqual(f.button(label).props.disabled, true); assert.ok(f.errors.length > 0, 'SDK failure must display a safe retry error'); assert.ok(f.errors.at(-1).includes('もう一度')); assert.ok(!f.errors.join().includes('PRIVATE_SDK'))
      await f.button(label).props.onClick(); const calls = action === 'switch' ? f.signouts : f.auth; assert.equal(calls.length, 2)
      const destination = kind === 'hr' ? '/hr/invite/synthetic%3Fx%23y' : '/admin/users'
      assert.equal(calls[0][action === 'switch' ? 0 : 1].callbackUrl, action === 'switch' ? '/auth/signin?callbackUrl=' + encodeURIComponent(destination) : destination)
      assert.equal(action === 'switch' ? f.auth.length : f.signouts.length, 0); f.unmount()
    })
    await check(`${kind}: repeated login clicks and stale failures are blocked`, async () => {
      let rejectOld, rejectNew; const old = new Promise((resolve, reject) => rejectOld = reject), next = new Promise((resolve, reject) => rejectNew = reject)
      const f = fixture(kind, { sdk: n => n === 1 ? old : next }); await f.ready(); if (kind === 'hr') await f.button('招待を受ける').props.onClick()
      const handler = f.button('Googleでログイン').props.onClick, first = handler(); await handler(); assert.equal(f.auth.length, 1)
      f.restore(false); assert.equal(f.button('ログイン処理中').props.disabled, true); f.restore(true); const second = f.button('Googleでログイン').props.onClick(); const errors = f.errors.length
      rejectOld(Error('old')); await first; assert.equal(f.errors.length, errors); assert.equal(f.button('ログイン処理中').props.disabled, true)
      rejectNew(Error('new')); await second; assert.equal(f.button('Googleでログイン').props.disabled, false); f.unmount()
    })
    await check(`${kind}: unmounted verification ignores API/JSON failure and aborts loading`, async () => {
      for (const phase of ['api', 'json', 'failure']) { let resolve, reject; const pending = new Promise((yes, no) => { resolve = yes; reject = no }); const f = fixture(kind, { get: () => phase === 'json' ? { ok: true, status: 200, json: () => pending } : pending }); f.render(); await tick(); const signal = f.requests[0].options?.signal; assert.ok(signal); f.unmount(); assert.equal(signal.aborted, true); if (phase === 'failure') reject(Error('synthetic')); else resolve(phase === 'api' ? ok(kind === 'hr' ? info : { authenticated: true }) : kind === 'hr' ? info : { authenticated: true }); await tick(); await tick(); assert.equal(f.writesAfterUnmount(), 0); assert.equal(f.navigation.length, 0) }
    })
    await check(`${kind}: route identity remounts its private or invitation state`, async () => { const f = fixture(kind); f.render(); assert.equal(f.key(), kind === 'hr' ? 'synthetic?x#y' : '/admin/users'); f.unmount() })
  }
  await check('HR: duplicate participation, restored history and old response cannot claim success', async () => {
    let release; const pending = new Promise(resolve => release = resolve); const f = fixture('hr', { post: n => n === 1 ? pending : { status: 401, ok: false, json: async () => { throw Error('Synthetic non-JSON 401') } } }); await f.ready(); const handler = f.button('招待を受ける').props.onClick, first = handler(); await handler(); assert.equal(f.requests.filter(r => r.options?.method === 'POST').length, 1); f.restore(false); assert.equal(f.button('招待を受ける'), null); f.restore(true); await f.button('招待を受ける').props.onClick(); release(ok({ success: true, organization: { id: 'old' } })); await first; assert.ok(!JSON.stringify(f.render()).includes('招待を受諾しました')); assert.equal(f.timers.size, 0); assert.equal(f.navigation.length, 0); f.unmount()
  })
  await check('HR: malformed success and network exceptions never show acceptance or raw details', async () => {
    for (const post of [() => ok({}), () => { throw Error('PRIVATE_NETWORK') }]) { const f = fixture('hr', { post }); await f.ready(); await f.button('招待を受ける').props.onClick(); assert.ok(JSON.stringify(f.render()).includes('招待を受諾できませんでした')); assert.ok(!JSON.stringify(f.render()).includes('PRIVATE_NETWORK')); assert.equal(f.timers.size, 0); assert.equal(f.navigation.length, 0); f.unmount() }
  })
  await check('HR: successful participation schedules one redirect and unmount cancels it', async () => { const f = fixture('hr', { post: () => ok({ success: true, organization: { id: 'org' } }) }); await f.ready(); await f.button('招待を受ける').props.onClick(); f.render(); assert.equal(f.timers.size, 1); f.render(); assert.equal(f.timers.size, 1); f.unmount(); assert.equal(f.timers.size, 0); assert.equal(f.navigation.length, 0) })
  await check('HR: expiry and unrelated permission failures cannot offer account switching', async () => { for (const post of [() => ({ status: 410 }), () => ({ status: 403, ok: false, json: async () => ({ code: 'HR_ORG_MEMBER_LIMIT', error: 'Synthetic member limit' }) })]) { const f = fixture('hr', { post }); await f.ready(); await f.button('招待を受ける').props.onClick(); assert.equal(f.button('別のアカウント'), null); assert.equal(f.button('Googleでログイン'), null); assert.equal(f.timers.size, 0); f.unmount() } })
  await check('HR: malformed invitation info never enables participation', async () => { const f = fixture('hr', { get: () => ok({ invitation: { status: 'PENDING', email: {}, organization: { id: 'org', name: {} } } }) }); await f.ready(); assert.equal(f.button('招待を受ける'), null); assert.ok(JSON.stringify(f.render()).includes('招待の検証に失敗しました')); f.unmount() })
  await check('HR: a temporary verification failure can be rechecked without leaving its invitation', async () => { const f = fixture('hr', { get: n => n === 1 ? Promise.reject(Error('PRIVATE_GET')) : ok(info) }); await f.ready(); const retry = f.button('招待の状態を再確認'); assert.ok(retry); retry.props.onClick(); await f.ready(); assert.ok(f.button('招待を受ける')); assert.equal(f.requests.filter(r => r.options?.method !== 'POST').length, 2); assert.equal(f.auth.length, 0); assert.equal(f.signouts.length, 0); assert.equal(f.navigation.length, 0); f.unmount() })
  await check('HR: conflict recheck replaces old readiness with current expiry', async () => { const f = fixture('hr', { post: () => ({ status: 409, ok: false, json: async () => ({ code: 'INVITE_UNAVAILABLE', error: 'Synthetic conflict' }) }), get: n => ok(n === 1 ? info : { ...info, invitation: { ...info.invitation, status: 'EXPIRED' } }) }); await f.ready(); await f.button('招待を受ける').props.onClick(); f.button('招待の状態を再確認').props.onClick(); await f.ready(); assert.ok(JSON.stringify(f.render()).includes('招待の有効期限切れ')); assert.equal(f.button('招待を受ける'), null); assert.equal(f.requests.filter(r => r.options?.method === 'POST').length, 1); assert.equal(f.navigation.length, 0); f.unmount() })
  await check('HR: current pending invitation after conflict may retry participation once', async () => { const f = fixture('hr', { post: n => n === 1 ? { status: 409, ok: false, json: async () => ({ error: 'Synthetic conflict' }) } : ok({ success: true, organization: { id: 'org' } }) }); await f.ready(); await f.button('招待を受ける').props.onClick(); f.button('招待の状態を再確認').props.onClick(); await f.ready(); await f.button('招待を受ける').props.onClick(); f.render(); assert.equal(f.requests.filter(r => r.options?.method === 'POST').length, 2); assert.equal(f.timers.size, 1); assert.equal(f.auth.length, 0); f.unmount() })
  await check('HR: unmount cancels a recheck and ignores its late result', async () => { let release; const pending = new Promise(resolve => release = resolve); const f = fixture('hr', { get: n => n === 1 ? Promise.reject(Error('Synthetic failure')) : pending }); await f.ready(); f.button('招待の状態を再確認').props.onClick(); f.render(); const signal = f.requests.at(-1).options.signal; f.unmount(); assert.equal(signal.aborted, true); release(ok(info)); await tick(); await tick(); assert.equal(f.writesAfterUnmount(), 0); assert.equal(f.navigation.length, 0) })
  await check('HR: cancelled and used invitations retain their actual reason and cannot be accepted', async () => { for (const [status, expected] of [['CANCELLED', 'この招待はキャンセルされています'], ['ACCEPTED', 'この招待は既に使用済みです']]) { const f = fixture('hr', { get: () => ok({ ...info, invitation: { ...info.invitation, status } }) }); await f.ready(); assert.ok(JSON.stringify(f.render()).includes(expected)); assert.equal(f.button('招待を受ける'), null); assert.equal(f.requests.filter(r => r.options?.method === 'POST').length, 0); f.unmount() } })
  await check('Admin: only strict password authentication and allowed Google domain reveal children', async () => { for (const [authenticated, email, allowed] of [[true, 'admin@surisuta.jp', true], ['true', 'admin@surisuta.jp', false], [false, 'admin@surisuta.jp', false], [true, 'other@example.invalid', false], [true, null, false]]) { const f = fixture('admin', { email, get: () => ok({ authenticated }) }); await f.ready(); assert.equal(JSON.stringify(f.render()).includes('PRIVATE_CHILD'), allowed); if (authenticated !== true) assert.equal(f.navigation[0], '/admin/login'); f.unmount() } })
  console.log(JSON.stringify({ passed: results.length, scope: 'actual TSX/shared hook; mocked APIs/SDK; no production writes', results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
