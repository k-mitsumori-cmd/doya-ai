// Actual route -> adapter -> mounted TenjikaiApp. External auth, Prisma, AI, router and visual children are synthetic.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const crypto = require('node:crypto')
const React = require('react')
const { createRoot } = require('react-dom/client')
const { JSDOM } = require('jsdom')
const harness = require('./verify-tenjikai-c3a-generation.cjs')
const rootPath = path.resolve(__dirname, '../..')
const req = Module.createRequire(path.join(rootPath, 'package.json'))
const ts = req('typescript')
const { NextRequest } = req('next/server')
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/tenjikai' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true; global.crypto = crypto.webcrypto
const originalFetch = global.fetch
const source = new Set(), cases = []
const Session = React.createContext(null)
let f
const no = () => null
const wrap = ({ children }) => React.createElement('div', null, children)
const motion = new Proxy({}, { get: (_, tag) => ({ children, ...props }) => React.createElement(tag,
  Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'exit', 'transition', 'layout', 'layoutId', 'whileHover', 'whileTap'].includes(key))), children) })
const Link = ({ children, href, ...props }) => React.createElement('a', { ...props, href }, children)
function SyntheticGenerating({ onDone }) { f.animationDone = onDone; React.useEffect(onDone, [onDone]); return React.createElement('p', null, 'generating') }
const mocks = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'), 'react-dom': req('react-dom'),
  'next/link': Link,
  'next/navigation': {
    usePathname: () => new URL(f.route, 'https://example.invalid').pathname,
    useSearchParams: () => new URLSearchParams(new URL(f.route, 'https://example.invalid').search),
    useRouter: () => f.router,
  },
  'next-auth/react': { useSession: () => React.useContext(Session), signOut: async () => {} },
  '@/lib/tenjikai/engine': harness.engine,
  'framer-motion': { motion, AnimatePresence: wrap },
  'lucide-react': new Proxy({}, { get: () => no }),
  './TenjikaiSidebar': { __esModule: true, default: ({ go, ready }) => React.createElement('nav', null,
    load(path.join(rootPath, 'src/lib/tenjikai/nav.ts')).SECTIONS.map(section => React.createElement('button', { key: section, disabled: !ready && section !== 'new',
      onClick: () => go(section) }, `nav-${section}`))) },
  './Wizard': { __esModule: true, default: ({ initial, onSubmit, submitDisabled, submitLabel }) => React.createElement('div', null,
    React.createElement('span', null, `input:${initial.eventName}`),
    React.createElement('button', { disabled: submitDisabled, onClick: () => onSubmit({ ...initial, eventName: '実入力の展示会' }) }, submitLabel === '同じ操作で生成を続ける' ? 'resume-same-operation' : 'start')) },
  './Generating': { __esModule: true, default: SyntheticGenerating },
  './BoothStudio': { __esModule: true, default: ({ input, analysis }) => React.createElement('p', null, `3D:${input.eventName}:${analysis.brand}`) },
  './Overview': { __esModule: true, default: ({ input }) => React.createElement('p', null, `overview:${input.eventName}`) },
  './CreativeStudio': { __esModule: true, default: no }, './NoveltyPicker': { __esModule: true, default: no },
  './BudgetPlanner': { __esModule: true, default: no }, './VendorBoard': { __esModule: true, default: no },
  './DocsVault': { __esModule: true, default: no },
  '@/lib/tenjikai/use-saved-project-detail': { useSavedProjectDetail: () => ({ phase: 'loading', detail: null, reload: () => {} }) },
  './SavedProjectPartialView': { __esModule: true, default: () => React.createElement('p', null, '保存内容の部分表示') },
  '@/components/shell/ToolFrame': { __esModule: true, default: ({ children, nav }) => React.createElement('div', null,
    React.createElement('nav', null, nav.map(item => React.createElement('button', { key: item.section, onClick: () => f.router.push(item.href) }, `shell-${item.section}`))), children) },
}
const cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file).exports
  source.add(path.relative(rootPath, file))
  const mod = new Module(file)
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(file, mod)
  mod.require = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (id.startsWith('@/') || id.startsWith('.')) {
      const stem = id.startsWith('@/') ? path.join(rootPath, 'src', id.slice(2)) : path.resolve(path.dirname(file), id)
      const found = ['.ts', '.tsx'].map(ext => stem + ext).find(fs.existsSync)
      assert.ok(found, `Unmocked ${id}`)
      return load(found)
    }
    return req(id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, file)
  return mod.exports
}
const App = load(path.join(rootPath, 'src/components/tenjikai/TenjikaiApp.tsx')).default
const Shell = load(path.join(rootPath, 'src/components/tenjikai/TenjikaiShellFrame.tsx')).default
const tick = () => new Promise(resolve => setImmediate(resolve))
async function fixture(mode, shell, initialRoute = '/tenjikai', preserveState = false) {
  if (!preserveState) harness.reset(mode)
  global.fetch = async (url, init) => {
    const address = new URL(url, 'https://example.invalid')
    const request = new NextRequest(address, init)
    if (address.pathname.endsWith('/generate/status')) return init?.method === 'POST' ? harness.statusRoute.POST(request) : harness.statusRoute.GET(request)
    return harness.POST(request)
  }
  const container = document.createElement('div'); document.body.append(container)
  const active = { route: initialRoute, routes: [], actor: 'actor-a', status: 'authenticated', container, root: createRoot(container) }
  active.update = async () => ({ user: { id: active.actor } })
  active.router = { push: url => { active.routes.push(url); active.route = url; active.render() }, replace: url => { active.route = url; active.render() } }
  f = active
  const Driver = () => React.createElement(Session.Provider, { value: { status: active.status, data: active.status === 'authenticated' ? { user: { id: active.actor } } : null,
    update: () => active.update() } }, shell ? React.createElement(Shell) : React.createElement(App, { shell: false }))
  active.render = () => active.root.render(React.createElement(Driver))
  const act = async callback => React.act(async () => { callback(); for (let i = 0; i < 8; i++) await tick() })
  await act(() => active.render())
  active.act = act
  active.click = label => act(() => { const button = [...container.querySelectorAll('button')].find(item => item.textContent === label); assert.ok(button, `button ${label}`); button.click() })
  active.clickAria = label => act(() => { const button = container.querySelector(`button[aria-label="${label}"]`); assert.ok(button, `button aria ${label}`); button.click() })
  active.auth = (actor, status = 'authenticated') => act(() => { active.actor = actor; active.status = status; harness.getState().session = status === 'authenticated' ? { user: { id: actor } } : null; active.render() })
  active.close = () => act(() => { active.root.unmount(); container.remove(); global.fetch = originalFetch })
  return active
}
async function check(name, mode, shell, run, initialRoute, preserveState = false) {
  const view = await fixture(mode, shell, initialRoute, preserveState)
  try { await run(view); cases.push(name) } finally { await view.close() }
}
;(async () => {
  await check('success non-shell keeps project and 3D across tabs', 'success', false, async view => {
    await view.click('start')
    assert.equal(view.route, '/tenjikai/booth?project=project-a')
    assert.match(view.container.textContent, /3D:実入力の展示会:ドヤAI/)
    assert.match(view.container.textContent, /基本情報を保存しました/)
    await view.click('nav-overview'); assert.equal(view.route, '/tenjikai/overview?project=project-a')
    await view.click('nav-booth'); assert.match(view.container.textContent, /3D:実入力の展示会/)
  })
  await check('success shell nav keeps project', 'success', true, async view => {
    await view.click('start'); assert.equal(view.route, '/tenjikai/booth?project=project-a')
    await view.click('shell-overview'); assert.equal(view.route, '/tenjikai/overview?project=project-a')
    await view.click('shell-booth'); assert.match(view.container.textContent, /3D:実入力の展示会/)
  })
  for (const shell of [false, true]) await check(`all working tabs preserve project shell=${shell}`, 'success', shell, async view => {
    await view.click('start')
    for (const section of ['overview', 'booth', 'creatives', 'novelty', 'budget', 'vendors', 'docs']) {
      await view.click(`${shell ? 'shell' : 'nav'}-${section}`)
      assert.equal(view.route, `/tenjikai/${section}?project=project-a`)
      assert.doesNotMatch(view.container.textContent, /保存内容の部分表示/)
    }
    await view.click(`${shell ? 'shell' : 'nav'}-booth`)
    assert.match(view.container.textContent, /3D:実入力の展示会:ドヤAI/)
  })
  for (const shell of [false, true]) await check(`browser back to new retires workspace and forward is partial shell=${shell}`, 'success', shell, async view => {
    await view.click('start'); assert.match(view.container.textContent, /3D:実入力の展示会/)
    const savedUrl = view.route
    await view.act(() => { view.route = '/tenjikai'; view.render() })
    assert.doesNotMatch(view.container.textContent, /3D:|実入力の展示会/)
    await view.act(() => { view.route = savedUrl; view.render() })
    assert.match(view.container.textContent, /保存内容の部分表示/)
    assert.doesNotMatch(view.container.textContent, /3D:/)
  })
  await check('mobile navigation keeps same working project', 'success', false, async view => {
    await view.click('start')
    await view.clickAria('メニューを開く')
    const mobile = [...view.container.querySelectorAll('div.fixed nav button')].find(button => button.textContent === 'nav-overview')
    assert.ok(mobile, 'mobile overview navigation')
    await view.act(() => mobile.click())
    assert.equal(view.route, '/tenjikai/overview?project=project-a')
    assert.match(view.container.textContent, /overview:実入力の展示会/)
  })
  await check('analysis save failure is visible and keeps 3D', 'analysis_failure', false, async view => {
    await view.click('start')
    assert.equal(view.route, '/tenjikai/booth?project=project-a')
    assert.match(view.container.textContent, /分析結果の保存を確認できません/)
    assert.match(view.container.textContent, /3D:実入力の展示会/)
  })
  await check('quota retains input and does not claim project', 'quota', false, async view => {
    await view.click('start')
    assert.match(view.route, /^\/tenjikai\?operation=\d{13}\.[0-9a-f-]{36}$/)
    assert.match(view.container.textContent, /input:実入力の展示会/)
    assert.doesNotMatch(view.container.textContent, /基本情報を保存しました/)
    assert.equal(harness.getState().provider, 0)
  })
  await check('unknown keeps input and disables ordinary resend', 'commit_then_p2028', false, async view => {
    await view.click('start')
    assert.match(view.route, /^\/tenjikai\?operation=\d{13}\.[0-9a-f-]{36}$/)
    assert.match(view.container.textContent, /作成結果を確認できません/)
    assert.match(view.container.textContent, /input:実入力の展示会/)
    assert.equal([...view.container.querySelectorAll('button')].some(item => item.textContent === 'start' && !item.disabled), false)
    assert.ok([...view.container.querySelectorAll('button')].some(item => item.textContent === 'resume-same-operation'))
    assert.equal(harness.getState().creates, 1)
  })
  await check('AI failure keeps input and links owned partial', 'ai_failure', false, async view => {
    await view.click('start')
    assert.match(view.route, /^\/tenjikai\?operation=\d{13}\.[0-9a-f-]{36}$/)
    assert.match(view.container.textContent, /input:実入力の展示会/)
    assert.match(view.container.querySelector('a[href*="project=project-a"]')?.textContent || '', /保存案件/)
    assert.equal([...view.container.querySelectorAll('button')].find(item => item.textContent === 'start')?.disabled, true)
  })
  await check('malformed response body becomes unknown without another POST', 'success', false, async view => {
    let calls = 0
    global.fetch = async (_url, init) => { if (init?.method === 'POST') calls++; return new Response('{bad', { status: 200, headers: { 'content-type': 'application/json' } }) }
    await view.click('start')
    assert.equal(calls, 1)
    assert.match(view.container.textContent, /作成結果を確認できません/)
    assert.equal([...view.container.querySelectorAll('button')].find(item => item.textContent === 'start')?.disabled, true)
    assert.equal(harness.getState().provider, 0)
  })
  await check('direct URL is partial and never sample workspace', 'success', false, async view => {
    await view.act(() => view.router.push('/tenjikai/booth?project=project-a'))
    assert.match(view.container.textContent, /保存内容の部分表示/)
    assert.doesNotMatch(view.container.textContent, /3D:/)
  })
  await check('reload with project URL remains partial', 'success', false, async view => {
    assert.match(view.container.textContent, /保存内容の部分表示/)
    assert.doesNotMatch(view.container.textContent, /3D:/)
  }, '/tenjikai/booth?project=project-a')
  await check('actor ABA never revives workspace', 'success', false, async view => {
    await view.click('start'); assert.match(view.container.textContent, /3D:/)
    await view.auth('actor-b'); assert.doesNotMatch(view.container.textContent, /3D:/)
    await view.auth('actor-a'); assert.doesNotMatch(view.container.textContent, /3D:/)
    assert.match(view.container.textContent, /保存内容の部分表示/)
  })
  for (const status of ['loading', 'unauthenticated']) await check(`auth ${status} masks old working session`, 'success', false, async view => {
    await view.click('start'); assert.match(view.container.textContent, /3D:/)
    await view.auth('actor-a', status)
    assert.doesNotMatch(view.container.textContent, /3D:/)
    await view.auth('actor-a')
    assert.doesNotMatch(view.container.textContent, /3D:/)
    assert.match(view.container.textContent, /保存内容の部分表示/)
  })
  await check('old actor in-flight body is ignored after ABA', 'success', false, async view => {
    let resume
    harness.getState().aiWait = new Promise(resolve => { resume = resolve })
    await view.click('start')
    await view.auth('actor-b')
    await view.auth('actor-a')
    const before = view.routes.length
    await view.act(() => resume())
    assert.equal(view.routes.length, before)
    assert.doesNotMatch(view.container.textContent, /3D:/)
  })
  await check('explicit new retires old callback and project', 'success', false, async view => {
    let resume
    harness.getState().aiWait = new Promise(resolve => { resume = resolve })
    await view.click('start')
    await view.click('nav-new')
    const before = view.routes.length
    const staleAnimation = view.animationDone
    await view.act(() => { staleAnimation(); resume() })
    assert.equal(view.routes.length, before)
    assert.equal(view.route, '/tenjikai')
    assert.doesNotMatch(view.container.textContent, /3D:/)
  })
  await check('old failure and finally cannot overwrite a newer generation', 'ai_failure', false, async view => {
    let resume
    harness.getState().aiWait = new Promise(resolve => { resume = resolve })
    await view.click('start')
    await view.click('nav-new')
    harness.getState().mode = 'success'
    harness.getState().aiWait = null
    await view.click('start')
    assert.equal(view.route, '/tenjikai/booth?project=project-a')
    const before = view.routes.length
    await view.act(() => resume())
    assert.equal(view.routes.length, before)
    assert.match(view.container.textContent, /3D:実入力の展示会:ドヤAI/)
    assert.doesNotMatch(view.container.textContent, /AIでの作成に失敗/)
  })
  await check('BFCache hides workspace before session recheck', 'success', false, async view => {
    await view.click('start'); assert.match(view.container.textContent, /3D:/)
    await view.act(() => window.dispatchEvent(new window.Event('pagehide')))
    assert.doesNotMatch(view.container.textContent, /3D:/)
    const event = new window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true })
    await view.act(() => window.dispatchEvent(event))
    assert.doesNotMatch(view.container.textContent, /3D:/)
  })
  await check('persisted pageshow alone retires workspace before session recheck', 'success', false, async view => {
    await view.click('start'); assert.match(view.container.textContent, /3D:/)
    let release
    view.update = () => new Promise(resolve => { release = resolve })
    const event = new window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true })
    await view.act(() => window.dispatchEvent(event))
    assert.match(view.container.textContent, /ログイン状態を確認しています/)
    assert.doesNotMatch(view.container.textContent, /3D:/)
    await view.act(() => release({ user: { id: 'actor-a' } }))
    assert.doesNotMatch(view.container.textContent, /3D:/)
    assert.match(view.container.textContent, /保存内容の部分表示/)
  })
  await check('BFCache second hide invalidates earlier session response', 'success', false, async view => {
    await view.click('start')
    let release
    view.update = () => new Promise(resolve => { release = resolve })
    await view.act(() => window.dispatchEvent(new window.Event('pagehide')))
    const event = new window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true })
    await view.act(() => window.dispatchEvent(event))
    await view.act(() => window.dispatchEvent(new window.Event('pagehide')))
    await view.act(() => release({ user: { id: 'actor-a' } }))
    assert.match(view.container.textContent, /ログイン状態を確認しています/)
    assert.doesNotMatch(view.container.textContent, /3D:/)
  })
  await check('BFCache actor ABA invalidates earlier session response', 'success', false, async view => {
    await view.click('start')
    let release
    view.update = () => new Promise(resolve => { release = resolve })
    await view.act(() => window.dispatchEvent(new window.Event('pagehide')))
    const event = new window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true })
    await view.act(() => window.dispatchEvent(event))
    await view.auth('actor-b')
    await view.auth('actor-a')
    await view.act(() => release({ user: { id: 'actor-a' } }))
    assert.doesNotMatch(view.container.textContent, /3D:/)
    assert.match(view.container.textContent, /保存内容の部分表示/)
  })
  await check('response loss recovers reserved operation and explicit same-handle continuation', 'commit_then_p2028', false, async view => {
    await view.click('start')
    assert.equal(harness.getState().creates, 1); assert.equal(harness.getState().provider, 0)
    assert.match(view.container.textContent, /同じ操作で生成を続ける|resume-same-operation/)
    await view.click('resume-same-operation')
    assert.equal(harness.getState().creates, 1); assert.equal(harness.getState().provider, 1)
    assert.equal(view.route, '/tenjikai/booth?project=project-a')
    assert.match(view.container.textContent, /3D:実入力の展示会/)
  })
  harness.reset('success')
  harness.getState().project = { id: 'project-a', userId: 'actor-a' }
  harness.getState().operations.set(harness.operationId, { operationId: harness.operationId, state: 'completed', projectId: 'project-a', analysis: 'saved', dispatchAllowed: false })
  await check('reload completed handle shows only saved basic and analysis without recreated 3D', 'success', false, async view => {
    assert.equal(harness.getState().provider, 0); assert.equal(harness.getState().creates, 0)
    assert.match(view.container.textContent, /基本情報と分析を保存済み/)
    assert.match(view.container.textContent, /元の3D案は再現されません/)
    assert.ok(view.container.querySelector('a[href*="project=project-a"]'))
    assert.doesNotMatch(view.container.textContent, /3D:/)
  }, `/tenjikai?operation=${harness.operationId}`, true)
  harness.reset('success')
  harness.getState().project = { id: 'project-a', userId: 'actor-a' }
  harness.getState().operations.set(harness.operationId, { operationId: harness.operationId, state: 'claimed', projectId: 'project-a', analysis: 'not_saved', dispatchAllowed: false })
  await check('reload claimed handle never auto dispatches or calls it completed', 'success', false, async view => {
    assert.equal(harness.getState().provider, 0); assert.equal(harness.getState().creates, 0)
    assert.match(view.container.textContent, /AI実行結果を確認中/)
    assert.doesNotMatch(view.container.textContent, /基本情報と分析を保存済み|3D:/)
  }, `/tenjikai?operation=${harness.operationId}`, true)
  await check('actor ABA on operation handle does not auto POST', 'commit_then_p2028', false, async view => {
    await view.click('start'); assert.equal(harness.getState().provider, 0)
    await view.auth('actor-b'); await view.auth('actor-a')
    assert.equal(harness.getState().provider, 0)
    assert.doesNotMatch(view.container.textContent, /3D:/)
  })
  const hashes = Object.fromEntries([...source].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(rootPath, file))).digest('hex')]))
  console.log(JSON.stringify({ accepted: true, scope: 'Actual route, adapter and mounted TenjikaiApp/ShellFrame with synthetic auth/DB/AI/router/visual children; no external calls.', passed: cases.length, cases, sourceHashes: hashes }, null, 2))
  dom.window.close()
})().catch(error => { console.error(error); process.exitCode = 1; global.fetch = originalFetch; dom.window.close() })
