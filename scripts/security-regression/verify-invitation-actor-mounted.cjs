process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto')
const React = require('react'), ts = require('typescript'), { JSDOM } = require('jsdom')
const rootPath = path.resolve(__dirname, '../..'), sources = new Map(), cases = [], failures = []
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client')
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const ok = data => ({ status: 200, ok: true, json: async () => data })
const no = () => null
const wrap = ({ children }) => React.createElement(React.Fragment, null, children)
const motionCache = new Map()
const motion = new Proxy({}, { get: (_, tag) => {
  if (!motionCache.has(tag)) motionCache.set(tag, ({ children, ...props }) => React.createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap'].includes(key))), children))
  return motionCache.get(tag)
} })
const generic = new Set(['quote', 'mensetsu', 'aishodan'])
function info(service) {
  if (generic.has(service)) return { invite: { organizationName: 'Synthetic organization', roleLabel: 'Member', accepted: false } }
  if (service === 'hr') return { invitation: { status: 'PENDING', email: 'a@example.invalid', organization: { id: 'org', name: 'Synthetic organization' } } }
  if (service === 'promane') return { success: true, invitation: { workspaceName: 'Synthetic organization', workspaceSlug: 'org-a', email: 'a@example.invalid', role: 'member', invitedByName: null, expiresAt: '2099-01-01T00:00:00.000Z' } }
  return { organizationName: 'Synthetic organization', organizationSlug: 'org-a', email: 'a@example.invalid', employeeName: 'Synthetic member', role: 'member' }
}
function success(service) {
  if (generic.has(service)) return { ok: true }
  if (service === 'hr') return { success: true, organization: { id: 'org' } }
  if (service === 'promane') return { success: true, workspaceSlug: 'org-a' }
  if (service === 'kintai') return { success: true, organizationId: 'org', organizationName: 'Synthetic organization' }
  return { ok: true, organizationSlug: 'org-a' }
}
async function fixture(service, options = {}) {
  const Session = React.createContext(null), routes = [], messages = [], reads = [], timers = new Map()
  let actor = 'alpha', status = 'authenticated', token = 'synthetic', postCount = 0, sdkCount = 0, timerId = 0, closed = false
  const router = { push: url => routes.push(url), replace: url => routes.push(url) }
  const viewWindow = { addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window), location: { assign: url => routes.push(url) } }
  const mocks = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'next-auth/react': { useSession: () => React.useContext(Session), signIn: async () => { sdkCount++ }, signOut: async () => { sdkCount++ } },
    'next/navigation': { useParams: () => ({ token }), useRouter: () => router },
    'next/link': ({ children, href }) => React.createElement('a', { href }, children), 'next/image': no,
    'framer-motion': { motion, AnimatePresence: wrap },
    'react-hot-toast': { __esModule: true, default: { success: text => messages.push(text), error: text => messages.push(text) } },
    '@/lib/ui/notify': { notifyError: (set, text) => { set(text); messages.push(text) } },
    '@/components/aio/ui': { BgDots: no, DoyaKun: no }, '@/components/shodan/ui': { BgDots: no, DoyaKun: no },
    '@/components/shell/ui-next-context': { useUiNext: () => false },
    '@/components/aio/brand-next.module.css': { __esModule: true, default: {} },
    '@/components/promane/ui/button': { Button: props => React.createElement('button', props) },
  }
  const cache = new Map()
  function load(file) {
    file = path.resolve(rootPath, file)
    if (cache.has(file)) return cache.get(file)
    const exports = {}; cache.set(file, exports)
    const baseline = process.env.DOYA_TEST_BASELINE && path.join(process.env.DOYA_TEST_BASELINE, path.relative(rootPath, file))
    const source = fs.readFileSync(baseline && fs.existsSync(baseline) ? baseline : file, 'utf8')
    sources.set(file, source)
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
      exports, require: name => {
        if (name in mocks) return mocks[name]
        const stem = name.startsWith('@/') ? path.join(rootPath, 'src', name.slice(2)) : path.resolve(path.dirname(file), name)
        const target = [stem + '.ts', stem + '.tsx'].find(fs.existsSync)
        assert(target, 'Unmocked ' + name); return load(target)
      }, window: viewWindow, console, AbortController, URL, JSON,
      setTimeout: fn => { timers.set(++timerId, fn); return timerId }, clearTimeout: id => timers.delete(id),
      fetch: async (url, init = {}) => {
        if (init.method === 'POST') { postCount++; return options.post ? options.post() : ok(success(service)) }
        reads.push({ url, signal: init.signal }); return options.get ? options.get(reads.length) : ok(info(service))
      },
    }, { filename: file })
    return exports
  }
  const Page = load(`src/app/(shell)/${service}/invite/[token]/page.tsx`).default
  const c = document.createElement('div'); document.body.append(c); const root = createRoot(c)
  const act = fn => React.act(async () => { await fn(); for (let i = 0; i < 6; i++) await tick() })
  const render = () => act(() => root.render(React.createElement(Session.Provider, { value: { status, data: status === 'authenticated' ? { user: { id: actor } } : null } }, React.createElement(React.StrictMode, null, React.createElement(Page)))))
  await render()
  return {
    c, routes, messages, reads, timers, act, render,
    auth: (id, nextStatus = 'authenticated') => { actor = id; status = nextStatus; return render() },
    changeToken: value => { token = value; return render() },
    accept: () => act(() => { const button = [...c.querySelectorAll('button')].find(b => /参加する|組織に参加|ワークスペースに参加|招待を受ける/.test(b.textContent)); assert(button, c.textContent); assert.equal(button.disabled, false); button.click() }),
    counts: () => ({ postCount, sdkCount }),
    flushTimers: () => act(() => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()) }),
    close: () => act(() => { if (!closed) { closed = true; root.unmount(); c.remove() } }),
  }
}
async function check(service, name, action, options) {
  const f = await fixture(service, options)
  try { await action(f); cases.push(service + ': ' + name) } catch (error) { failures.push({ service, name, message: error.message }) } finally { await f.close() }
}
;(async () => {
  for (const service of ['aio', 'shodan', 'hr', 'quote', 'mensetsu', 'aishodan', 'sfa', 'promane', 'kintai']) {
    for (const transition of ['actor', 'ABA', 'loading', 'signout', 'token']) {
      const late = deferred()
      await check(service, 'late acceptance is ignored after ' + transition, async f => {
        await f.accept(); assert.equal(f.counts().postCount, 1)
        if (transition === 'token') await f.changeToken('different')
        else if (transition === 'loading') await f.auth('alpha', 'loading')
        else if (transition === 'signout') await f.auth(null, 'unauthenticated')
        else { await f.auth('beta'); if (transition === 'ABA') await f.auth('alpha') }
        assert(f.reads[0].signal.aborted)
        await f.act(() => late.resolve(ok(success(service)))); await f.flushTimers()
        assert.equal(f.routes.length, 0); assert.equal(f.messages.length, 0); assert.equal(f.timers.size, 0); assert.equal(f.counts().sdkCount, 0)
        assert(!f.c.textContent.includes('参加しました'))
      }, { post: () => late.promise })
    }
    const sameActor = deferred()
    await check(service, 'same actor session refresh preserves one active acceptance', async f => {
      const oldReads = f.reads.length; await f.accept(); await f.auth('alpha')
      assert.equal(f.reads.length, oldReads); assert.equal(f.counts().postCount, 1)
      await f.act(() => sameActor.resolve(ok(success(service)))); await f.flushTimers()
      assert.equal(f.routes.length, 1); assert.equal(f.counts().sdkCount, 0)
    }, { post: () => sameActor.promise })
    await check(service, 'loading and authenticated-without-id mask invitation actions', async f => {
      await f.auth('alpha', 'loading'); assert.match(f.c.textContent, /ログイン状態を確認しています/); assert.equal(f.c.querySelector('button'), null)
      await f.auth(undefined); assert.match(f.c.textContent, /ログイン状態を確認しています/); assert.equal(f.c.querySelector('button'), null)
      assert.equal(f.counts().postCount, 0); assert.equal(f.routes.length, 0)
    })
    await check(service, 'guest retains invitation details and explicit participation entry', async f => {
      await f.auth(null, 'unauthenticated'); assert.match(f.c.textContent, /Synthetic organization/); assert(f.c.querySelector('button')); assert.equal(f.counts().postCount, 0); assert.equal(f.counts().sdkCount, 0)
    })
    const lateRead = deferred()
    await check(service, 'old lookup cannot restore invitation after a new actor lookup fails', async f => {
      await f.auth('beta'); await f.act(() => lateRead.resolve(ok(info(service))))
      assert(!f.c.textContent.includes('Synthetic organization')); assert.match(f.c.textContent, /有効期限|確認できません/)
      assert.equal(f.routes.length, 0); assert.equal(f.counts().postCount, 0)
    }, { get: n => n <= 2 ? lateRead.promise : { status: 410, ok: false, json: async () => ({}) } })
    if (generic.has(service) || service === 'hr') await check(service, 'accepted success timer is removed on actor change', async f => {
      await f.accept(); assert.equal(f.timers.size, 1); await f.auth('beta'); assert.equal(f.timers.size, 0); await f.flushTimers(); assert.equal(f.routes.length, 0)
    })
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), passed: cases.length, failed: failures.length, cases, failures, sourceHashes: Object.fromEntries([...sources].map(([file, source]) => [path.relative(rootPath, file), crypto.createHash('sha256').update(source).digest('hex')])), scope: 'Actual nine invitation TSX entry points, shared invite components and hooks mounted in React StrictMode. Synthetic API/session/router/timers only; no production participation, email, provider or browser acceptance.' }, null, 2))
  dom.window.close(); if (failures.length) process.exitCode = 1
})().catch(error => { console.error(error); process.exitCode = 1 })
