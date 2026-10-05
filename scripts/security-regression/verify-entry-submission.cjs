const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { load, check, results } = require('./load-typescript.cjs')
const callbackHelpers=load('src/lib/safe-signin-callback.ts')

function fixture(service, response, sdk = () => Promise.resolve(), authed = true) {
  const slots = [], effects = [], cleanups = [], errors = [], toastIds = [], requests = [], auth = [], navigation = []
  const listeners = new Map()
  let cursor = 0, mounted = false
  const react = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next }] },
    useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i] },
    useEffect(effect) { if (!mounted) effects.push(effect) },
  }
  const api = load('src/lib/use-navigation-submission.ts', {
    react, '@/lib/safe-signin-callback': callbackHelpers, 'react-hot-toast': { error: (value, options) => { errors.push(value); toastIds.push(options?.id) } },
    'next-auth/react': { signIn: (...args) => { auth.push(args); return sdk(auth.length) } },
  }, { window: {
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => { if (listeners.get(name) === listener) listeners.delete(name) },
  } })
  const render = () => {
    cursor = 0
    const hook = api.useNavigationSubmission('安全な再試行メッセージ')
    if (!mounted) { mounted = true; effects.forEach(effect => cleanups.push(effect())) }
    return hook
  }
  const file = `src/app/${service}/Entry.tsx`
  const source = fs.readFileSync(file, 'utf8')
  const handler = service === 'aio' ? 'start' : 'create'
  assert.ok(source.includes('const { busy: creating, run: submit } = useNavigationSubmission('), 'entry must use the tested hook')
  assert.match(source, new RegExp(`onClick=\\{${handler}\\}\\s+disabled=\\{creating\\}`), 'actual submit button must use the hook busy state')
  const start = source.indexOf(`  const ${handler} = async () => {`)
  const end = source.indexOf('\n  }\n', start) + 5
  assert.ok(start >= 0 && end > start)
  const context = {
    exports: {}, ...api, authed, serviceUrl: 'https://example.invalid/input', orgName: '会社名', memberName: '氏名',
    submit: action => render().run(action),
    toast: { error: value => errors.push(value) },
    fetch: async (url, options) => { requests.push({ url, options }); return response(requests.length) },
    router: { replace: url => navigation.push(url) }, JSON, Error, encodeURIComponent,
  }
  vm.runInNewContext(ts.transpileModule(source.slice(start, end) + `\nexports.run=${handler};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  render()
  return { run: context.exports.run, busy: () => render().busy, errors, toastIds, requests, auth, navigation,
    restore: persisted => listeners.get('pageshow')?.({ persisted }),
    unmount: () => cleanups.forEach(cleanup => cleanup?.()), listeners,
  }
}
const unauthorized = () => ({ status: 401, json: () => { throw Error('401 body must not be parsed') } })
const success = () => ({ status: 200, ok: true, json: async () => ({ slug: '組織 名', organization: { slug: '組織 名' } }) })

;(async () => {
  for (const service of ['aio', 'sfa', 'shodan']) {
    await check(`${service}: unauthorized SDK failure recovers, hides raw details and retries unchanged input`, async () => {
      const f = fixture(service, unauthorized, () => Promise.reject(Error('PRIVATE_SDK_DETAILS')))
      await f.run()
      assert.equal(f.busy(), false)
      assert.equal(f.errors.length, 1)
      assert.ok(!f.errors.join().includes('PRIVATE_SDK_DETAILS'))
      assert.equal(f.auth[0][1].callbackUrl, `/${service}`)
      await f.run()
      assert.equal(f.auth.length, 2)
      assert.deepEqual(f.toastIds, ['navigation-submission-error', 'navigation-submission-error'])
      assert.equal(f.requests[0].options.body, f.requests[1].options.body)
      f.unmount()
    })
    await check(`${service}: network failure releases lock with safe message`, async () => {
      const f = fixture(service, () => { throw Error('PRIVATE_NETWORK_DETAILS') })
      await f.run()
      assert.equal(f.busy(), false)
      assert.equal(f.errors[0], '安全な再試行メッセージ')
      assert.equal(f.auth.length, 0)
      f.unmount()
    })
    await check(`${service}: server business error remains visible and retryable`, async () => {
      const f = fixture(service, () => ({ status: 429, ok: false, json: async () => ({ error: '利用上限に達しました' }) }))
      await f.run()
      assert.equal(f.busy(), false)
      assert.equal(f.errors[0], '利用上限に達しました')
      assert.equal(f.navigation.length, 0)
      f.unmount()
    })
    await check(`${service}: successful creation keeps navigation lock and original input`, async () => {
      const f = fixture(service, success)
      await f.run()
      assert.equal(f.busy(), true)
      assert.equal(f.auth.length, 0)
      assert.equal(f.navigation.length, 1)
      assert.equal(f.navigation[0], service === 'aio' ? '/aio/%E7%B5%84%E7%B9%94%20%E5%90%8D?scan=1' : service === 'shodan' ? '/shodan/%E7%B5%84%E7%B9%94%20%E5%90%8D' : '/sfa/組織 名')
      const body = JSON.parse(f.requests[0].options.body)
      assert.deepEqual(body, service === 'aio' ? { url: 'https://example.invalid/input' } : { name: '会社名', memberName: '氏名' })
      f.unmount()
    })
    await check(`${service}: immediate duplicates and duplicates during SDK waiting create one request`, async () => {
      let release, reject
      const pendingApi = new Promise(resolve => { release = resolve })
      const pendingSdk = new Promise((resolve, fail) => { reject = fail })
      const f = fixture(service, () => pendingApi, () => pendingSdk)
      const first = f.run()
      await f.run()
      assert.equal(f.requests.length, 1)
      release(unauthorized())
      await new Promise(resolve => setImmediate(resolve))
      await f.run()
      assert.equal(f.auth.length, 1)
      reject(Error('synthetic'))
      await first
      assert.equal(f.busy(), false)
      f.unmount()
    })
    await check(`${service}: history restoration unlocks; stale API cannot navigate or start OAuth`, async () => {
      let release
      const pending = new Promise(resolve => { release = resolve })
      const f = fixture(service, attempt => attempt === 1 ? pending : success())
      const first = f.run()
      f.restore(false)
      assert.equal(f.busy(), true)
      f.restore(true)
      assert.equal(f.busy(), false)
      await f.run()
      release(unauthorized())
      await first
      assert.equal(f.auth.length, 0)
      assert.equal(f.navigation.length, 1)
      assert.equal(f.busy(), true)
      assert.equal(f.errors.length, 0)
      f.unmount()
      assert.equal(f.listeners.size, 0)
    })
    await check(`${service}: old SDK failure does not release a newer restored submission`, async () => {
      let rejectOld, rejectNew
      const old = new Promise((resolve, reject) => { rejectOld = reject })
      const next = new Promise((resolve, reject) => { rejectNew = reject })
      const f = fixture(service, unauthorized, attempt => attempt === 1 ? old : next)
      const first = f.run()
      await new Promise(resolve => setImmediate(resolve))
      f.restore(true)
      const second = f.run()
      await new Promise(resolve => setImmediate(resolve))
      rejectOld(Error('old'))
      await first
      assert.equal(f.busy(), true)
      assert.equal(f.errors.length, 0)
      rejectNew(Error('new'))
      await second
      assert.equal(f.busy(), false)
      assert.equal(f.errors.length, 1)
      f.unmount()
    })
    await check(`${service}: stale JSON completion does not navigate after history restoration`, async () => {
      let release
      const json = new Promise(resolve => { release = resolve })
      const f = fixture(service, attempt => attempt === 1 ? { status: 200, ok: true, json: () => json } : success())
      const first = f.run()
      await new Promise(resolve => setImmediate(resolve))
      f.restore(true)
      await f.run()
      release({ slug: 'old', organization: { slug: 'old' } })
      await first
      assert.equal(f.navigation.length, 1)
      assert.ok(!f.navigation[0].includes('old'))
      assert.equal(f.busy(), true)
      f.unmount()
    })
    await check(`${service}: unmounted request failure does not announce an obsolete error`, async () => {
      let reject
      const pending = new Promise((resolve, fail) => { reject = fail })
      const f = fixture(service, () => pending)
      const first = f.run()
      f.unmount()
      reject(Error('obsolete'))
      await first
      assert.equal(f.errors.length, 0)
      assert.equal(f.listeners.size, 0)
    })
  }
  await check('aio: guest login failure is safe and does not call quick-start', async () => {
    const f = fixture('aio', success, () => Promise.reject(Error('PRIVATE_GUEST_DETAILS')), false)
    await f.run()
    assert.equal(f.busy(), false)
    assert.equal(f.requests.length, 0)
    assert.equal(f.auth.length, 1)
    assert.ok(!f.errors.join().includes('PRIVATE_GUEST_DETAILS'))
    f.unmount()
  })
  console.log(JSON.stringify({ passed: results.length, scope: 'actual TS hook and extracted current entry handlers; API/OAuth mocked; no production writes', results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
