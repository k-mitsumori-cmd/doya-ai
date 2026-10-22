process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { JSDOM } = require('jsdom')
const rootPath = path.resolve(__dirname, '../..')
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.invalid/sfa' })
global.window = dom.window
global.document = dom.window.document
global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client')
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const results = [], failures = []
const empty = service => service === 'sfa' ? { onboarded: false, memberships: [] } : { authenticated: true, onboarded: false, memberships: [] }
const member = (service, slug) => service === 'sfa'
  ? { onboarded: true, organization: { slug }, memberships: [{ slug }] }
  : { authenticated: true, onboarded: true, memberships: [{ slug }] }

async function fixture(service, options = {}) {
  const Session = React.createContext(null)
  let status = options.status || 'authenticated', session = { user: { id: 'alpha' } }
  let read = options.read || (() => Promise.resolve(Response.json(empty(service))))
  let post = options.post || (() => Promise.resolve(Response.json({ organization: { slug: 'created-org' } })))
  let sdk = options.sdk || (() => Promise.resolve()), closed = false, sequence = 0
  const calls = [], routes = [], signs = [], errors = [], timers = new Map()
  const router = { replace: url => routes.push(url) }
  const fetch = (url, init = {}) => {
    calls.push({ url, init })
    return init.method === 'POST' ? post(url, init) : read(url, init)
  }
  const wrap = ({ children }) => React.createElement('div', null, children)
  const no = () => null
  const landing = ({ children }) => React.createElement('div', { 'data-landing': true }, children)
  const lp = new Proxy({ LpShell: landing }, { get: (target, key) => key in target ? target[key] : wrap })
  const mocks = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'next-auth/react': { useSession: () => React.useContext(Session), signIn: (...args) => { signs.push(args); return sdk() }, signOut: async () => {} },
    'next/navigation': { useRouter: () => router },
    'react-hot-toast': { error: value => errors.push(value) },
    '@/lib/services': { getServiceById: () => ({}) }, '@/components/lp': lp,
    '@/components/shell/ui-next-context': { useUiNext: () => options.uiNext !== false },
    '@/components/ds': { Skeleton: () => React.createElement('div', { 'data-skeleton': true }) },
    './lp-data': { ACCENT: '', CTA: '/auth/signin', STEPS: [], BENEFITS: [], FAQ: [] },
    './mocks': new Proxy({}, { get: () => no }),
  }
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const exports = {}; cache.set(file, exports)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText
    vm.runInNewContext(code, { exports, require: name => {
      if (name in mocks) return mocks[name]
      const source = name.startsWith('@/') ? path.join(rootPath, 'src', name.slice(2)) : path.resolve(path.dirname(file), name)
      const resolved = [source + '.ts', source + '.tsx'].find(candidate => fs.existsSync(candidate))
      assert.ok(resolved, 'Unmocked import ' + name)
      return load(resolved)
    }, fetch, window, document, console, URL, Response, Request, Headers, AbortController, TextDecoder, Uint8Array,
      setTimeout: (fn, ms) => { assert.equal(ms, 35000); timers.set(++sequence, fn); return sequence },
      clearTimeout: id => timers.delete(id),
    }, { filename: path.relative(rootPath, file) })
    return exports
  }
  const source = process.env.DOYA_ENTRY_BASELINE
    ? path.join(process.env.DOYA_ENTRY_BASELINE, service, 'Entry.tsx')
    : path.join(rootPath, 'src/app/(shell)', service, 'Entry.tsx')
  const Component = load(source).default
  const c = document.createElement('div'); document.body.append(c)
  const root = createRoot(c)
  const act = fn => React.act(async () => { await fn(); for (let i = 0; i < 5; i++) await tick() })
  const render = () => act(() => root.render(React.createElement(Session.Provider, { value: { data: session, status } }, React.createElement(React.StrictMode, null, React.createElement(Component)))))
  await render()
  return { c, calls, routes, signs, errors, timers, act, render,
    auth: (id, nextStatus = 'authenticated') => { session = { user: id ? { id } : {} }; status = nextStatus },
    read: value => { read = value }, post: value => { post = value }, sdk: value => { sdk = value },
    click: button => act(() => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))),
    async fill() {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      await act(() => { for (const input of c.querySelectorAll('input')) { setter.call(input, 'Synthetic value'); input.dispatchEvent(new window.Event('input', { bubbles: true })) } })
    },
    close: () => act(() => { if (!closed) { closed = true; root.unmount(); c.remove() } }),
  }
}
async function check(service, name, options, run) {
  const f = await fixture(service, options)
  try { await run(f); results.push(service + ': ' + name) }
  catch (error) { failures.push({ check: service + ': ' + name, error: error.message }); console.error('FAIL ' + service + ': ' + name + ': ' + error.message) }
  finally { await f.close() }
}
const assertUnknown = f => { assert.ok(f.c.querySelector('[role="alert"]'), 'unknown read must display retryable error'); assert.equal(f.c.querySelectorAll('input').length, 0); assert.equal(f.c.querySelector('[data-landing]'), null); assert.equal(f.routes.length, 0) }
const createButton = f => [...f.c.querySelectorAll('button')].find(button => button.textContent.includes('組織を作成して始める'))
;(async () => {
  for (const service of ['sfa', 'shodan']) {
    await check(service, 'network failure is unknown, never onboarding or guest', { read: async () => { throw Error('Synthetic network outage') } }, assertUnknown)
    await check(service, 'HTTP failure cannot become verified absence', { read: async () => Response.json(empty(service), { status: 503 }) }, assertUnknown)
    await check(service, 'malformed successful payload remains unknown', { read: async () => Response.json({}) }, assertUnknown)
    await check(service, 'HTTP rejection never becomes guest or an editable form', { read: async () => Response.json({ error: 'Synthetic rejection' }, { status: 401 }) }, assertUnknown)
    await check(service, 'unsafe membership slug is not used for navigation', { read: async () => Response.json(member(service, '../outside')) }, assertUnknown)
    await check(service, 'onboarded without membership is not accepted', { read: async () => Response.json(service === 'sfa' ? { onboarded: true, organization: { slug: 'not-a-member' }, memberships: [] } : { authenticated: true, onboarded: true, memberships: [] }) }, assertUnknown)
    await check(service, 'confirmed no membership displays existing onboarding form', {}, f => { assert.equal(f.c.querySelectorAll('input').length, 2); assert.ok(createButton(f)); assert.equal(f.c.querySelector('[role="alert"]'), null) })
    await check(service, 'confirmed guest preserves landing page', { status: 'unauthenticated', read: async () => Response.json(service === 'sfa' ? empty(service) : { authenticated: false, onboarded: false, memberships: [] }) }, f => { assert.ok(f.c.querySelector('[data-landing]')); assert.equal(f.c.querySelectorAll('input').length, 0) })
    await check(service, 'cookie-authenticated membership navigates while SDK is loading', { status: 'loading', read: async () => Response.json(member(service, 'current-org')) }, f => { assert.ok(f.routes.includes('/' + service + '/current-org')); assert.equal(f.c.querySelectorAll('input').length, 0) })
    await check(service, 'manual read retry recovers without organization POST', { read: async () => { throw Error('Synthetic outage') } }, async f => { assertUnknown(f); f.read(async () => Response.json(empty(service))); await f.click(f.c.querySelector('[role="alert"] button')); assert.ok(createButton(f)); assert.equal(f.calls.some(call => call.init.method === 'POST'), false) })
    const oldActorRead = deferred()
    await check(service, 'confirmed actor change ignores previous actor response', { read: () => oldActorRead.promise }, async f => {
      f.read(async () => Response.json(empty(service))); f.auth('new'); await f.render()
      await f.act(() => oldActorRead.resolve(Response.json(member(service, 'old-org'))))
      assert.equal(f.routes.length, 0); assert.ok(createButton(f))
    })
    const firstARead = deferred()
    await check(service, 'ABA actor return does not revive first A response', { read: () => firstARead.promise }, async f => {
      const current = deferred(); f.read(() => new Promise(() => {})); f.auth('B'); await f.render()
      f.read(() => current.promise); f.auth('alpha'); await f.render()
      await f.act(() => firstARead.resolve(Response.json(member(service, 'obsolete-A')))); assert.equal(f.routes.length, 0)
      await f.act(() => current.resolve(Response.json(member(service, 'current-A')))); assert.ok(f.routes.includes('/' + service + '/current-A'))
    })
    await check(service, 'same actor session-object refresh preserves input and read count', {}, async f => {
      await f.fill(); const count = f.calls.length; const inputs = [...f.c.querySelectorAll('input')]; f.auth('alpha'); await f.render()
      assert.equal(f.calls.length, count); assert.equal(f.c.querySelector('input'), inputs[0]); assert.equal(inputs[0].value, 'Synthetic value')
    })
    await check(service, 'pending read is bounded and retryable', { read: () => new Promise(() => {}) }, async f => {
      assert.ok(f.timers.size); await f.act(() => { for (const callback of [...f.timers.values()]) callback() }); assertUnknown(f)
      assert.equal(f.calls.at(-1).init.signal.aborted, true)
    })
    const unmountedRead = deferred()
    await check(service, 'unmount cancels lookup and rejects late navigation', { read: () => unmountedRead.promise }, async f => {
      const call = f.calls.at(-1)
      await f.close(); await f.act(() => unmountedRead.resolve(Response.json(member(service, 'unmounted')))); assert.equal(f.routes.length, 0); assert.equal(call.init.signal.aborted, true); assert.equal(f.timers.size, 0)
    })
    await check(service, 'missing authenticated identity cannot create organization', {}, async f => { f.auth(null); await f.render(); assertUnknown(f) })
    await check(service, 'double click while sign-in SDK waits creates one POST and sign-in', {}, async f => {
      const sign = deferred(); f.post(async () => Response.json({}, { status: 401 })); f.sdk(() => sign.promise); await f.fill()
      await f.act(() => { const button = createButton(f); button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
      assert.equal(f.calls.filter(call => call.init.method === 'POST').length, 1); assert.equal(f.signs.length, 1); await f.act(() => sign.resolve())
    })
    for (const status of [200, 401]) await check(service, 'old creation ' + status + ' cannot navigate or sign in after actor change', {}, async f => {
      const pending = deferred(); f.post(() => pending.promise); await f.fill(); await f.click(createButton(f)); f.auth('beta'); await f.render()
      await f.act(() => pending.resolve(Response.json({ organization: { slug: 'old-create' } }, { status })))
      assert.equal(f.routes.length, 0); assert.equal(f.signs.length, 0)
    })
    await check(service, 'history restoration rechecks membership and cancels old read', { read: () => new Promise(() => {}) }, async f => {
      const previous = f.calls.at(-1); f.read(async () => Response.json(empty(service)))
      await f.act(() => window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true })))
      assert.ok(createButton(f)); assert.equal(previous.init.signal.aborted, true)
    })
    await check(service, 'legacy appearance preserves error retry and recovery', { uiNext: false, read: async () => { throw Error('Synthetic outage') } }, async f => { assertUnknown(f); f.read(async () => Response.json(empty(service))); await f.click(f.c.querySelector('[role="alert"] button')); assert.ok(createButton(f)) })
  }
  console.log(JSON.stringify({ passed: results.length, failed: failures.length, scope: 'Actual current SFA/Shodan entry components and navigation hook under React StrictMode; real bounded reader; synthetic session, HTTP and SDK only; no network or writes', results, failures }, null, 2))
  dom.window.close()
  if (failures.length) process.exitCode = 1
})().catch(error => { console.error(error); process.exitCode = 1 })
