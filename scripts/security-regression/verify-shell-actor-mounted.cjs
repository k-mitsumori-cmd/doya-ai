process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto'), assert = require('node:assert/strict')
const React = require('react'), ts = require('typescript'), { JSDOM } = require('jsdom')
const rootPath = path.resolve(process.env.DOYA_TEST_ROOT || path.resolve(__dirname, '../..')), sources = new Map(), cases = [], failures = []
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/pricing?payment=cancelled#plans' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require('react-dom/client'), tick = () => new Promise(resolve => setImmediate(resolve))
async function fixture(options = {}) {
  const Session = React.createContext(null), cache = new Map()
  let actor = 'alpha', status = 'authenticated', retainedData = false, reloads = 0, refreshes = 0, mounts = 0, unmounts = 0, closed = false
  let props = { signedIn: true, serverActorId: 'alpha', userName: 'Synthetic Alpha', enabledIds: [], uiNext: 'all', company: { name: 'Synthetic Company A' }, toolHrefs: { sfa: '/sfa/org-a' }, always: true, doyaPower: true, doyaPowerState: { balance: {remaining: 7, limit: 10}, costs: {generate: 2} }, initialRecent: ['sfa', 'hr'], ...options }
  const viewWindow = { location: { reload: () => { reloads++ } }, addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window) }
  const mocks = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': {__esModule: true, default: ({children,...p}) => React.createElement('a',p,children)},
    'lucide-react': {Zap: () => null}, '@/components/ds/cost-badge': {CostBadge: () => null}, './power.module.css': {__esModule: true, default: {}},
    'next-auth/react': { useSession: () => React.useContext(Session) },
    'next/navigation': { usePathname: () => '/pricing', useRouter: () => ({ refresh: () => { refreshes++ } }) },
    './registry': { shouldShowShell: (_, config) => config.signedIn && options.registry !== false },
    './UiNextBadge': { __esModule: true, default: () => React.createElement('i', { 'data-preview': true }, 'Preview marker') },
    './ShellVitals': { __esModule: true, default: () => null },
  }
  function load(file) {
    file = path.resolve(rootPath, file)
    if (cache.has(file)) return cache.get(file)
    const exports = {}; cache.set(file, exports)
    const baseline = process.env.DOYA_TEST_BASELINE && path.join(process.env.DOYA_TEST_BASELINE, path.relative(rootPath, file))
    const source = fs.readFileSync(baseline && fs.existsSync(baseline) ? baseline : file, 'utf8'); sources.set(file, source)
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
      exports, require: name => {
        if (name in mocks) return mocks[name]
        const stem = name.startsWith('@/') ? path.join(rootPath, 'src', name.slice(2)) : path.resolve(path.dirname(file), name)
        const target = [stem + '.ts', stem + '.tsx'].find(p => fs.existsSync(p) || (process.env.DOYA_TEST_BASELINE && fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE,path.relative(rootPath,p))))); assert(target, 'Unmocked ' + name); return load(target)
      }, window: viewWindow, document, console,
    }, { filename: file }); return exports
  }
  const contexts = load('src/components/shell/ui-next-context.tsx'), company = load('src/components/shell/company-context.tsx'), powerFlag = load('src/components/doya-power/doya-power-context.tsx'), power = load('src/components/shell/power.tsx')
  function Child() {
    const [draft, setDraft] = React.useState('unsaved draft')
    React.useEffect(() => { mounts++; return () => { unmounts++ } }, [])
    const account = company.useAccountCompany(), href = contexts.useToolHref()('/sfa')
    return React.createElement('div', { 'data-child': true }, React.createElement('input', { value: draft, readOnly: true }),
      React.createElement('button', { onClick: () => setDraft('edited draft') }, 'Edit draft'),
      React.createElement('a', { href, 'data-org-link': true }, 'Sales'), React.createElement('span', { 'data-company': true }, account?.name || ''),
      React.createElement('span', { 'data-mode': true }, React.useContext(contexts.UiNextContext) || 'legacy'),
      React.createElement('span', {'data-power-flag': true}, String(powerFlag.useDoyaPower())),
      React.createElement('span', {'data-power-state': true}, JSON.stringify(React.useContext(power.ShellPowerContext))))
  }
  mocks['./AppShell'] = { __esModule: true, default: ({ userName, initialRecent, children }) => React.createElement('div', { 'data-frame': true }, React.createElement('span', { 'data-name': true }, userName), React.createElement('span', {'data-recent': true}, JSON.stringify(initialRecent ?? null)), children) }
  const Gate = load('src/components/shell/ShellGate.tsx').default, c = document.createElement('div'); document.body.append(c); const root = createRoot(c)
  const act = fn => React.act(async () => { await fn(); for (let n = 0; n < 4; n++) await tick() })
  const render = () => act(() => root.render(React.createElement(Session.Provider, { value: { status, data: status === 'authenticated' || retainedData ? { user: { id: actor } } : null } },
    React.createElement(React.StrictMode, null, React.createElement(Gate, props, React.createElement(Child))))))
  if (options.initialStatus) status = options.initialStatus
  if ('initialActor' in options) actor = options.initialActor
  await render()
  const transition = (type, persisted = false) => act(() => { const event = new window.Event(type); Object.defineProperty(event, 'persisted', { value: persisted }); window.dispatchEvent(event) })
  return {
    c, render, act, transition,
    auth: (id, nextStatus = 'authenticated', retain = false) => { actor = id; status = nextStatus; retainedData = retain; return render() },
    server: next => { props = { ...props, ...next }; return render() },
    counts: () => ({ reloads, refreshes, mounts, unmounts }),
    edit: () => act(() => { const b = [...c.querySelectorAll('button')].find(b => b.textContent === 'Edit draft'); assert(b); b.click() }),
    reload: () => act(() => { const b = [...c.querySelectorAll('button')].find(b => b.textContent === '最新の画面を読み込む'); assert(b); b.click() }),
    close: () => act(() => { if (!closed) { closed = true; root.unmount(); c.remove() } }),
  }
}
const blocked = f => { assert.equal(f.c.querySelector('[data-child]'), null); assert.equal(f.c.querySelector('[data-frame]'), null); assert.equal(f.c.querySelector('[data-company]'), null); assert.equal(f.c.querySelector('[data-preview]'), null); assert.match(f.c.textContent, /ログイン状態を確認し直してください/); assert.equal(f.counts().refreshes, 0) }
async function check(name, action, options) {
  const f = await fixture(options)
  try { await action(f); cases.push(name) } catch (error) { failures.push({ name, message: error.message }) } finally { await f.close() }
}
;(async () => {
  await check('matching server and SDK actor exposes only the bound private contexts', async f => { assert.equal(f.c.querySelector('[data-org-link]').getAttribute('href'), '/sfa/org-a'); assert.equal(f.c.querySelector('[data-company]').textContent, 'Synthetic Company A'); assert.equal(f.c.querySelector('[data-name]').textContent, 'Synthetic Alpha'); assert(f.c.querySelector('[data-preview]')); assert.equal(f.counts().refreshes, 0) })
  for (const retain of [false, true]) await check('same actor loading preserves the exact input subtree, retained data=' + retain, async f => {
    await f.edit(); const input = f.c.querySelector('input'), before = f.counts(); await f.auth(retain ? 'alpha' : null, 'loading', retain)
    assert.equal(f.c.querySelector('input'), input); assert(input.closest('[hidden][inert]')); assert.equal(f.c.querySelector('[data-preview]'), null)
    await f.auth('alpha'); assert.equal(f.c.querySelector('input'), input); assert.equal(input.value, 'edited draft'); assert.equal(input.closest('[hidden]'), null); assert.equal(f.counts().unmounts, before.unmounts)
  })
  await check('same actor session object refresh preserves draft without reload', async f => { await f.edit(); const before = f.counts(); await f.auth('alpha'); assert.equal(f.c.querySelector('input').value, 'edited draft'); assert.equal(f.counts().unmounts, before.unmounts); assert.equal(f.counts().reloads, 0) })
  for (const route of ['actor', 'ABA', 'logout', 'logoutABA']) await check('confirmed ' + route + ' retires the old private subtree', async f => {
    const before = f.counts(); await f.auth(route.startsWith('logout') ? null : 'beta', route.startsWith('logout') ? 'unauthenticated' : 'authenticated'); blocked(f); assert.equal(f.counts().unmounts, before.unmounts + 1)
    if (route.endsWith('ABA')) { await f.auth('alpha'); blocked(f) }
  })
  await check('late old A and new B RSC props cannot clear a retired snapshot', async f => {
    await f.auth('beta'); await f.server({ serverActorId: 'beta', userName: 'Synthetic Beta', company: { name: 'Synthetic Company B' }, toolHrefs: { sfa: '/sfa/org-b' } }); blocked(f)
    await f.auth('alpha'); await f.server({ serverActorId: 'alpha' }); blocked(f); await f.render(); blocked(f)
  })
  await check('explicit reload requests the same document only after the user clicks', async f => { const url = window.location.href; await f.auth('beta'); blocked(f); assert.equal(f.counts().reloads, 0); await f.reload(); assert.equal(f.counts().reloads, 1); assert.equal(window.location.href, url); blocked(f) })
  for (const event of ['pagehide', 'pageshow']) await check(event + ' persisted lifecycle never resurrects private content', async f => { await f.transition(event, true); blocked(f); await f.auth('alpha'); blocked(f) })
  await check('ordinary pageshow and focus do not retire the current draft', async f => { await f.edit(); await f.transition('pageshow', false); await f.transition('focus'); assert.equal(f.c.querySelector('input').value, 'edited draft'); assert.equal(f.counts().reloads, 0) })
  await check('initial SDK loading never exposes private values', async f => { assert(f.c.querySelector('input').closest('[hidden][inert]')); assert.equal(f.c.querySelector('[data-company]').textContent, ''); assert.equal(f.c.querySelector('[data-name]').textContent, ''); assert.equal(f.c.querySelector('[data-preview]'), null); await f.auth('alpha'); assert.equal(f.c.querySelector('[data-company]').textContent, 'Synthetic Company A') }, { initialStatus: 'loading', initialActor: null })
  await check('authenticated SDK missing ID is unknown rather than a guest', async f => { await f.auth(undefined); assert(f.c.querySelector('input').closest('[hidden][inert]')); assert.match(f.c.textContent, /ログイン状態を確認しています/); await f.auth('alpha'); assert(f.c.querySelector('[data-frame]')) })
  await check('signed-in server missing ID is rejected rather than trusted', async f => blocked(f), { serverActorId: null })
  await check('guest snapshots remain public and neutral', async f => { assert.equal(f.c.querySelector('[data-frame]'), null); assert.equal(f.c.querySelector('[data-company]').textContent, ''); assert.equal(f.c.querySelector('[data-org-link]').getAttribute('href'), '/sfa'); assert.equal(f.c.querySelector('[data-mode]').textContent, 'legacy'); assert.equal(f.c.querySelector('[data-preview]'), null) }, { signedIn: false, serverActorId: null, initialStatus: 'unauthenticated', initialActor: null })
  await check('guest to authenticated transition requests explicit new document', async f => { await f.auth('beta'); blocked(f) }, { signedIn: false, serverActorId: null, initialStatus: 'unauthenticated', initialActor: null })
  await check('registry no-shell children retain the same principal guard', async f => { assert.equal(f.c.querySelector('[data-frame]'), null); assert.equal(f.c.querySelector('[data-company]').textContent, 'Synthetic Company A'); await f.auth('beta'); blocked(f) }, { always: false, registry: false })
  for (const mode of [null, 'preview', 'all']) await check('server-authoritative mode ' + mode + ' cannot survive actor mismatch', async f => { await f.auth('beta'); blocked(f) }, { uiNext: mode })
  const neutral = f => { assert.equal(f.c.querySelector('[data-power-flag]').textContent,'false'); assert.equal(f.c.querySelector('[data-power-state]').textContent,JSON.stringify({balance:null,costs:{}})); const recent=f.c.querySelector('[data-recent]'); if(recent) assert.equal(recent.textContent,'null') }
  await check('actual Power contexts and recent expose exact bound actor values', async f => {
    assert.equal(f.c.querySelector('[data-power-flag]').textContent,'true'); assert.equal(f.c.querySelector('[data-power-state]').textContent,JSON.stringify({balance:{remaining:7,limit:10},costs:{generate:2}})); assert.equal(f.c.querySelector('[data-recent]').textContent,JSON.stringify(['sfa','hr']))
    await f.auth(null,'loading');neutral(f);assert.equal(f.c.querySelector('[data-company]').textContent,'');assert.equal(f.c.querySelector('[data-org-link]').getAttribute('href'),'/sfa');await f.auth('alpha');assert.equal(f.c.querySelector('[data-power-flag]').textContent,'true')
  })
  await check('initial loading masks new private values with retained subtree', async f=>neutral(f),{initialStatus:'loading',initialActor:null})
  await check('guest masks new private values', async f=>neutral(f),{signedIn:false,serverActorId:null,initialStatus:'unauthenticated',initialActor:null})
  await check('legacy mode masks Power and recent even when server supplies them',async f=>neutral(f),{uiNext:null})
  await check('Power disabled masks balance and cost while recent remains actor-bound', async f=>{assert.equal(f.c.querySelector('[data-power-flag]').textContent,'false');assert.equal(f.c.querySelector('[data-power-state]').textContent,JSON.stringify({balance:null,costs:{}}));assert.equal(f.c.querySelector('[data-recent]').textContent,JSON.stringify(['sfa','hr']))},{doyaPower:false})
  await check('pagehide masks synchronously before React lifecycle commit',async f=>{
    const input=f.c.querySelector('input');await f.act(()=>{window.dispatchEvent(new window.Event('pagehide'));assert(input.closest('[hidden][inert]'))});blocked(f)
  })
  for (const file of ['src/app/(shell)/layout.tsx', 'src/app/pricing/page.tsx']) {
    const overlay = process.env.DOYA_TEST_BASELINE && path.join(process.env.DOYA_TEST_BASELINE,file); const source = fs.readFileSync(overlay && fs.existsSync(overlay) ? overlay : path.join(rootPath,file), 'utf8'); sources.set(path.join(rootPath, file), source)
    assert.match(source, /serverActorId=\{session(?:\?\.)?\.?(?:user)(?:\?\.)?\.?id \?\? null\}/, file + ' must bind the actual server session ID')
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), passed: cases.length, failed: failures.length, cases, failures, sourceHashes: Object.fromEntries([...sources].map(([file, source]) => [path.relative(rootPath, file), crypto.createHash('sha256').update(source).digest('hex')])), scope: 'Actual ShellGate and actual company/tool href/UI/Power contexts, exact recent prop under React StrictMode with a stateful child. Synthetic session, AppShell consumer, lifecycle and reload only. No browser, RSC causal freshness, real SDK or production acceptance.' }, null, 2))
  dom.window.close(); if (failures.length) process.exitCode = 1
})().catch(error => { console.error(error); process.exitCode = 1 })
