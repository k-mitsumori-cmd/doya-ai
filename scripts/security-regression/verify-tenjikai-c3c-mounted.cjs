// Actual TenjikaiApp + TenjikaiShellFrame navigation and full-saved controls.
// Auth, DB adapters, provider and visual children are synthetic; no HTTP or external write.
process.env.NODE_ENV = 'test'
require('tsx/cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const crypto = require('node:crypto')
const React = require('react')
const { createRoot } = require('react-dom/client')
const { JSDOM } = require('jsdom')
const ts = require('typescript')
const { mockGeneratedPlan, SAMPLE_INPUT } = require('../../src/lib/tenjikai/engine.ts')
const { materializeTenjikaiWorkspace } = require('../../src/lib/tenjikai/workspace-materialize.ts')
const repo = path.resolve(__dirname, '../..')
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/tenjikai' })
global.window = dom.window; global.document = dom.window.document; global.crypto = crypto.webcrypto
global.IS_REACT_ACT_ENVIRONMENT = true
const m = materializeTenjikaiWorkspace(SAMPLE_INPUT, mockGeneratedPlan(SAMPLE_INPUT))
const workspace = revision => ({ actorId: 'actor-a', projectId: 'project-a', revision, input: { ...SAMPLE_INPUT },
  analysis: m.analysis, selectedVariant: m.selectedVariant, projectedVisitors: m.projectedVisitors,
  plans: m.plans.map((p, n) => ({ ...p, dbId: `plan-${n}` })),
  creatives: m.creatives, novelties: m.novelties.map((item, n) => ({ ...item.novelty, dbId: `novelty-${n}`, quantity: item.quantity, selected: item.selected })),
  budgetLines: m.budgetLines.map((line, n) => ({ ...line, dbId: `budget-${n}`, source: 'ai', status: 'planned' })),
  deadlines: m.deadlines.map((item, n) => ({ ...item, dbId: `deadline-${n}`, done: false })) })
const Session = React.createContext(null)
let f, saveResolve, saveCalls = 0, budgetEdits = 0, latest = workspace('1'), latestUnavailable = false, statusValue = null, saveStatusResult = 'missing', savedPhase = 'ready_full', checkCalls = 0
const no = () => null, wrap = ({ children }) => React.createElement('div', null, children)
const motion = new Proxy({}, { get: (_, tag) => ({ children, ...props }) => React.createElement(tag,
  Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'exit', 'transition', 'layout', 'layoutId'].includes(key))), children) })
const withHandle = (href, name, op) => { if (!op) return href; const url = new URL(href, 'https://example.invalid'); url.searchParams.set(name, op); return url.pathname + url.search }
const saveOp = 'save.1792627200000.12345678-1234-4123-8123-123456789abc'
const genOp = '1792627200000.12345678-1234-4123-8123-123456789abc'
const saveClient = { validSaveHandle: v => typeof v === 'string' && /^save\.\d{13}\./.test(v), newSaveHandle: () => saveOp,
  withSaveHandle: (href, op) => withHandle(href, 'saveOperation', op),
  saveWorkspace: async () => { saveCalls++; return new Promise(resolve => { saveResolve = resolve }) },
  readSaveStatus: async (_a, _p, op) => { checkCalls++; return { state: saveStatusResult, operationId: op,
    projectId: saveStatusResult === 'superseded' ? 'project-a' : null, workspace: null } },
  cancelMissingSave: async (_a, _p, op) => ({ state: 'canceled', operationId: op, projectId: null, workspace: null }) }
const genStatus = { validOperationHandle: v => typeof v === 'string' && /^\d{13}\./.test(v),
  withGenerationOperation: (href, op) => withHandle(href, 'operation', op),
  readGenerationStatus: async () => statusValue,
  cancelGenerationStatus: async () => ({ ...statusValue, state: 'canceled', terminalConfirmed: true }) }
const mocks = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-dom': require('react-dom'),
  'next/link': ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
  'next/navigation': { usePathname: () => new URL(f.route, 'https://example.invalid').pathname,
    useSearchParams: () => new URLSearchParams(new URL(f.route, 'https://example.invalid').search), useRouter: () => f.router },
  'next-auth/react': { useSession: () => React.useContext(Session), signOut: async () => {} },
  '@/lib/use-entry-organization': { useEntryActorScope: () => ({ actor: f.actor, status: f.status, version: f.version,
    current: f.current }) },
  '@/lib/tenjikai/workspace-save-client': saveClient,
  '@/lib/tenjikai/workspace-client': { readSavedTenjikaiWorkspace: async () => latestUnavailable ? ({ state: 'unavailable' }) : ({ state: 'ready_full', workspace: latest }) },
  '@/lib/tenjikai/generation-status-client': genStatus,
  '@/lib/tenjikai/use-saved-project-detail': { useSavedProjectDetail: () => ({ phase: savedPhase, workspace: savedPhase === 'ready_full' ? latest : null, detail: null, reload: () => {} }) },
  '@/lib/tenjikai/engine': require('../../src/lib/tenjikai/engine.ts'),
  'framer-motion': { motion, AnimatePresence: wrap },
  'lucide-react': new Proxy({}, { get: () => no }),
  './TenjikaiSidebar': { __esModule: true, default: ({ go, loginCallbackUrl }) => React.createElement('nav', { 'data-login-callback': loginCallbackUrl },
    ['new', 'budget', 'booth'].map(section => React.createElement('button', { key: section, onClick: () => go(section) }, 'nav-' + section))) },
  './Wizard': { __esModule: true, default: ({ submitDisabled, submitLabel }) => React.createElement('button',
    { disabled: submitDisabled }, submitLabel === '同じ操作で生成を続ける' ? 'resume-same-operation' : 'start') },
  './Generating': { __esModule: true, default: no },
  './BoothStudio': { __esModule: true, default: () => React.createElement('p', null, 'saved-booth') },
  './Overview': { __esModule: true, default: () => React.createElement('p', null, 'saved-overview') },
  './CreativeStudio': { __esModule: true, default: no },
  './NoveltyPicker': { __esModule: true, default: no },
  './BudgetPlanner': { __esModule: true, default: ({ input, setInput }) => React.createElement('button',
    { onClick: () => { budgetEdits++; setInput({ ...input, budgetYen: 9_000_000 }) } }, 'edit-budget') },
  './VendorBoard': { __esModule: true, default: no },
  './DocsVault': { __esModule: true, default: no },
  './SavedProjectPartialView': { __esModule: true, default: no },
  '@/components/shell/ToolFrame': { __esModule: true, default: ({ nav, children }) => React.createElement('div', null,
    React.createElement('nav', null, nav.map(item => React.createElement('button', { key: item.section,
      onClick: () => f.router.push(item.href) }, 'shell-' + item.section))), children) },
}
const cache = new Map(), sources = new Set()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file).exports
  sources.add(path.relative(repo, file))
  const mod = new Module(file)
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(file, mod)
  mod.require = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (id.startsWith('@/') || id.startsWith('.')) {
      const stem = id.startsWith('@/') ? path.join(repo, 'src', id.slice(2)) : path.resolve(path.dirname(file), id)
      const found = ['.ts', '.tsx'].map(ext => stem + ext).find(fs.existsSync)
      assert.ok(found, `Unmocked ${id}`); return load(found)
    }
    return require(id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
  return mod.exports
}
const App = load(path.join(repo, 'src/components/tenjikai/TenjikaiApp.tsx')).default
const Shell = load(path.join(repo, 'src/components/tenjikai/TenjikaiShellFrame.tsx')).default
const tick = () => new Promise(resolve => setImmediate(resolve))
async function mount(route, shell = false) {
  const container = document.createElement('div'); document.body.append(container)
  f = { route, actor: 'actor-a', status: 'authenticated', version: 0, container, root: createRoot(container), routes: [] }
  f.current = () => f.status === 'authenticated' && f.actor === 'actor-a'
  f.router = { push: url => { f.route = url; f.routes.push(url); f.render() }, replace: url => { f.route = url; f.render() } }
  f.render = () => f.root.render(React.createElement(Session.Provider, { value: { status: f.status,
    data: { user: { id: f.actor } }, update: async () => ({ user: { id: f.actor } }) } },
    shell ? React.createElement(Shell) : React.createElement(App)))
  f.act = async callback => React.act(async () => { callback(); for (let i = 0; i < 6; i++) await tick() })
  f.click = label => f.act(() => { const button = [...container.querySelectorAll('button')].find(item => item.textContent === label)
    assert.ok(button, label); button.click() })
  await f.act(f.render)
  return f
}
;(async () => {
  const cases = []
  let view = await mount('/tenjikai/budget?project=project-a', true)
  await view.click('edit-budget')
  await view.click('変更を保存')
  assert.equal(saveCalls, 1)
  assert.match(view.route, /saveOperation=/)
  assert.equal([...view.container.querySelectorAll('button')].find(b => b.textContent === 'edit-budget').matches(':disabled'), true)
  await view.click('edit-budget')
  assert.equal(budgetEdits, 1)
  await view.click('shell-booth')
  assert.match(view.route, /saveOperation=/)
  await view.click('shell-new')
  assert.match(view.route, /project=project-a.*saveOperation=/)
  cases.push('pending save disables edits and shell new; shell tabs retain handle')
  const pendingRoute = view.route
  await view.act(() => { view.root.unmount(); view.container.remove() })
  view = await mount(pendingRoute, true)
  assert.match(view.container.textContent, /未到着の可能性/)
  await view.click('shell-new')
  assert.match(view.route, /project=project-a.*saveOperation=/)
  cases.push('reloaded save handle remains blocked in shell pending or missing')
  await view.act(() => { view.root.unmount(); view.container.remove() })
  view = await mount('/tenjikai/budget?project=project-a&saveOperation=' + saveOp, true)
  await view.act(() => saveResolve({ state: 'superseded', operationId: saveOp, projectId: 'project-a', workspace: null }))
  saveStatusResult = 'superseded'
  await view.click('保存状態を確認')
  assert.match(view.container.textContent, /別の変更と競合/)
  latest = workspace('2')
  await view.click('未保存変更を破棄して最新の保存内容を読み込む')
  assert.doesNotMatch(view.route, /saveOperation=/)
  cases.push('superseded requires explicit latest adoption')
  await view.act(() => { view.root.unmount(); view.container.remove() })
  saveStatusResult = 'missing'
  view = await mount('/tenjikai/budget?project=project-a&saveOperation=' + saveOp)
  await view.click('遅れて届く保存を取り消す')
  latestUnavailable = true
  await view.click('未保存変更を破棄して最新の保存内容を確認し、編集を続ける')
  assert.match(view.route, /saveOperation=/)
  assert.match(view.container.textContent, /最新の保存内容を確認できませんでした/)
  latestUnavailable = false; latest = workspace('3')
  await view.click('未保存変更を破棄して最新の保存内容を確認し、編集を続ける')
  assert.doesNotMatch(view.route, /saveOperation=/)
  await view.click('edit-budget')
  await view.click('変更を保存')
  assert.equal(saveCalls, 2)
  cases.push('ordinary CAS loser missing tombstone needs explicit latest read before new intent')
  await view.act(() => { view.root.unmount(); view.container.remove() })
  statusValue = { actorId: 'actor-a', operationId: genOp, state: 'reserved', projectId: 'project-a',
    analysis: 'not_saved', dispatchAllowed: true, terminalConfirmed: false }
  view = await mount('/tenjikai/booth?project=project-a&operation=' + genOp)
  await view.click('同じ生成操作を続ける')
  assert.equal(view.route, '/tenjikai?operation=' + genOp)
  cases.push('reserved saved URL resumes same generation operation')
  await view.act(() => { view.root.unmount(); view.container.remove() })
  statusValue = { actorId: 'actor-a', operationId: genOp, state: 'reserved', projectId: 'project-a',
    analysis: 'not_saved', dispatchAllowed: false, terminalConfirmed: false }
  view = await mount('/tenjikai/booth?project=project-a&operation=' + genOp)
  assert.doesNotMatch(view.container.textContent, /同じ生成操作を続ける/)
  await view.act(() => { view.root.unmount(); view.container.remove() })
  view = await mount('/tenjikai?operation=' + genOp)
  assert.equal([...view.container.querySelectorAll('button')].find(b => b.textContent === 'start')?.disabled, true)
  assert.doesNotMatch(view.container.textContent, /resume-same-operation/)
  cases.push('legacy reserved cannot resume in saved or new mode')
  await view.act(() => { view.root.unmount(); view.container.remove() })
  statusValue = { actorId: 'actor-a', operationId: genOp, state: 'superseded', projectId: 'project-a',
    analysis: 'saved', dispatchAllowed: false, terminalConfirmed: true }
  view = await mount('/tenjikai/booth?project=project-a&operation=' + genOp)
  await view.click('別の案件を新規作成')
  assert.equal(view.route, '/tenjikai')
  cases.push('edited completed receipt allows only explicit new')
  await view.act(() => { view.root.unmount(); view.container.remove() })
  view = await mount('/tenjikai?operation=' + genOp)
  await view.click('別の案件を新規作成')
  assert.equal(view.route, '/tenjikai')
  cases.push('new-mode legal edit superseded terminal allows explicit next job')
  await view.act(() => { view.root.unmount(); view.container.remove() })
  statusValue = { actorId: 'actor-a', operationId: genOp, state: 'superseded', projectId: 'project-a',
    analysis: 'not_saved', dispatchAllowed: false, terminalConfirmed: false }
  view = await mount('/tenjikai?operation=' + genOp)
  assert.doesNotMatch(view.container.textContent, /別の案件を新規作成/)
  assert.equal([...view.container.querySelectorAll('button')].find(b => b.textContent === 'start')?.disabled, true)
  cases.push('claimed or unknown derived superseded cannot release handle')
  await view.act(() => { view.root.unmount(); view.container.remove() })
  for (const phase of ['ready_partial', 'error', 'auth_changed']) {
    savedPhase = phase
    view = await mount('/tenjikai/overview?project=project-a&saveOperation=' + saveOp)
    assert.match(view.container.querySelector('nav').getAttribute('data-login-callback'), /saveOperation=/)
    await view.click('nav-budget')
    assert.match(view.route, /saveOperation=/)
    await view.click('nav-new')
    assert.match(view.route, /project=project-a.*saveOperation=/)
    await view.act(() => view.container.querySelector('[aria-label="メニューを開く"]').click())
    const mobileNav = [...view.container.querySelectorAll('nav')].at(-1)
    assert.match(mobileNav.getAttribute('data-login-callback'), /saveOperation=/)
    await view.act(() => [...mobileNav.querySelectorAll('button')].find(b => b.textContent === 'nav-new').click())
    assert.match(view.route, /project=project-a.*saveOperation=/)
    cases.push(`partial parent nav/login keeps save operation phase=${phase}`)
    await view.act(() => { view.root.unmount(); view.container.remove() })
  }
  savedPhase = 'ready_full'
  assert.ok(checkCalls >= 0)
  console.log(JSON.stringify({ accepted: true, cases, sourceHashes: Object.fromEntries([...sources].map(file =>
    [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex')])) }))
})().catch(error => { console.error(error); process.exitCode = 1 })
