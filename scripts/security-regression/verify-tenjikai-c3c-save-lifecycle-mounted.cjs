// Actual TenjikaiApp, useEntryActorScope and useSavedProjectDetail across pending save lifecycle.
// Session SDK, workspace transport, save result and visual children are synthetic; no HTTP or external write.
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
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
let f, saveResolve, saveCalls = 0, budgetEdits = 0, latest = workspace('1'), latestUnavailable = false, statusValue = null, saveStatusResult = 'missing', savedPhase = 'ready_full', checkCalls = 0
const saveSignals = []
const no = () => null, wrap = ({ children }) => React.createElement('div', null, children)
const motion = new Proxy({}, { get: (_, tag) => ({ children, ...props }) => React.createElement(tag,
  Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'exit', 'transition', 'layout', 'layoutId'].includes(key))), children) })
const withHandle = (href, name, op) => { if (!op) return href; const url = new URL(href, 'https://example.invalid'); url.searchParams.set(name, op); return url.pathname + url.search }
const saveOp = 'save.1792627200000.12345678-1234-4123-8123-123456789abc'
const genOp = '1792627200000.12345678-1234-4123-8123-123456789abc'
const saveClient = { validSaveHandle: v => typeof v === 'string' && /^save\.\d{13}\./.test(v), newSaveHandle: () => saveOp,
  withSaveHandle: (href, op) => withHandle(href, 'saveOperation', op),
  saveWorkspace: async (_actor, _project, _revision, _operation, _patch, signal) => { saveCalls++; saveSignals.push(signal); return new Promise(resolve => { saveResolve = resolve }) },
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
  '@/lib/billing-response-client': { readBillingResponse: async () => { throw Error('Unexpected organization read') } },
  '@/lib/tenjikai/workspace-save-client': saveClient,
  '@/lib/tenjikai/workspace-client': { readSavedTenjikaiWorkspace: async actor => latestUnavailable ? ({ state: 'unavailable' }) : ({ state: 'ready_full', workspace: { ...latest, actorId: actor } }) },
  './workspace-client': { readSavedTenjikaiWorkspace: async actor => latestUnavailable ? ({ state: 'unavailable' }) : ({ state: 'ready_full', workspace: { ...latest, actorId: actor } }) },
  '@/lib/tenjikai/generation-status-client': genStatus,
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
  './BudgetPlanner': { __esModule: true, default: ({ input, setInput }) => React.createElement('div', null,
    React.createElement('p', null, `budget:${f.actor}:${input.budgetYen}`),
    React.createElement('button', { onClick: () => { budgetEdits++; setInput({ ...input, budgetYen: 9_000_000 }) } }, 'edit-budget')) },
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
  f.router = { push: url => { f.route = url; f.routes.push(url); f.render() }, replace: url => { f.route = url; f.render() } }
  f.render = () => f.root.render(React.createElement(Session.Provider, { value: { status: f.status,
    data: f.status === 'authenticated' ? { user: { id: f.actor } } : null,
    update: () => f.updateGate ? f.updateGate.promise : Promise.resolve({ user: { id: f.actor } }) } },
    shell ? React.createElement(Shell) : React.createElement(App)))
  f.act = async callback => React.act(async () => { callback(); for (let i = 0; i < 6; i++) await tick() })
  f.click = label => f.act(() => { const button = [...container.querySelectorAll('button')].find(item => item.textContent === label)
    assert.ok(button, label); button.click() })
  f.changeAuth = (actor, status = 'authenticated') => f.act(() => { f.actor = actor; f.status = status; f.render() })
  f.close = () => f.act(() => { f.root.unmount(); f.container.remove() })
  await f.act(f.render)
  return f
}

async function pendingSave() {
  latest = workspace('1')
  saveStatusResult = 'missing'
  const view = await mount('/tenjikai/budget?project=project-a')
  assert.match(view.container.textContent, /budget:actor-a:/)
  const writes = saveCalls
  await view.click('edit-budget')
  await view.click('変更を保存')
  assert.equal(saveCalls, writes + 1)
  assert.match(view.route, /saveOperation=/)
  assert.match(view.container.textContent, /保存操作/)
  return { view, respond: saveResolve, writes: writes + 1 }
}
const committed = () => {
  const next = workspace('2')
  next.input.budgetYen = 9_000_000
  return { state: 'committed', operationId: saveOp, projectId: 'project-a', workspace: next }
}
const tickAct = async callback => React.act(async () => { callback(); for (let i = 0; i < 6; i++) await tick() })

;(async () => {
  const cases = []
  {
    const { view, respond, writes } = await pendingSave()
    await view.act(() => respond(committed()))
    assert.doesNotMatch(view.route, /saveOperation=/)
    assert.match(view.container.textContent, /budget:actor-a:9000000/)
    assert.equal(saveCalls, writes)
    await view.close()
    cases.push('positive control adopts a current-scope committed save exactly once')
  }
  {
    const { view, respond, writes } = await pendingSave()
    await view.changeAuth('', 'loading')
    assert.doesNotMatch(view.container.textContent, /budget:actor-a:/)
    await tickAct(() => respond(committed()))
    assert.equal(saveCalls, writes)
    assert.match(view.route, /saveOperation=/)
    assert.doesNotMatch(view.container.textContent, /budget:actor-a:/)
    await view.close()
    cases.push('SDK loading masks pending save and rejects late committed response')
  }
  {
    const { view, respond, writes } = await pendingSave()
    await view.changeAuth('', 'loading')
    await view.changeAuth('actor-b')
    assert.doesNotMatch(view.container.textContent, /budget:actor-a:/)
    assert.match(view.container.textContent, /budget:actor-b:/)
    await view.changeAuth('actor-a')
    assert.match(view.route, /saveOperation=/)
    await tickAct(() => respond(committed()))
    assert.match(view.route, /saveOperation=/)
    assert.doesNotMatch(view.container.textContent, /budget:actor-a:9000000/)
    assert.equal(saveCalls, writes)
    await view.close()
    cases.push('SDK actor A-B-A does not adopt old save success or issue another write')
  }
  {
    const { view, respond, writes } = await pendingSave()
    const oldRoute = view.route
    await view.close()
    await tickAct(() => respond(committed()))
    assert.equal(view.container.textContent, '')
    assert.equal(view.route, oldRoute)
    assert.equal(saveCalls, writes)
    cases.push('noncooperative save response after unmount cannot adopt or navigate')
  }
  {
    const { view, respond, writes } = await pendingSave()
    await view.act(() => {
      window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true }))
      assert.doesNotMatch(view.container.textContent, /budget:actor-a:/)
    })
    assert.equal(saveSignals.at(-1).aborted, true)
    await tickAct(() => respond(committed()))
    assert.match(view.route, /saveOperation=/)
    assert.doesNotMatch(view.container.textContent, /budget:actor-a:/)
    assert.equal(saveCalls, writes)
    await view.close()
    cases.push('pagehide aborts local signal and noncooperative late success remains masked')
  }
  {
    const { view, respond, writes } = await pendingSave()
    view.updateGate = deferred()
    await view.act(() => {
      window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
      assert.doesNotMatch(view.container.textContent, /budget:actor-a:/)
    })
    assert.match(view.route, /saveOperation=/)
    await tickAct(() => respond(committed()))
    assert.doesNotMatch(view.container.textContent, /budget:actor-a:9000000/)
    assert.equal(saveCalls, writes)
    await view.act(() => view.updateGate.resolve({ user: { id: 'actor-a' } }))
    assert.match(view.route, /saveOperation=/)
    assert.match(view.container.textContent, /budget:actor-a:/)
    assert.doesNotMatch(view.container.textContent, /budget:actor-a:9000000/)
    await view.close()
    cases.push('persisted pageshow without pagehide blocks old display and save adoption until SDK proof')
  }
  {
    const { view, respond, writes } = await pendingSave()
    view.updateGate = deferred()
    await view.act(() => {
      window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
      assert.doesNotMatch(view.container.textContent, /budget:actor-a:/)
    })
    await tickAct(() => respond(committed()))
    await view.act(() => view.updateGate.resolve({ user: { id: 'actor-b' } }))
    assert.doesNotMatch(view.container.textContent, /budget:actor-a:/)
    assert.match(view.route, /saveOperation=/)
    assert.equal(saveCalls, writes)
    await view.close()
    cases.push('persisted pageshow with different SDK actor never resumes old save or display')
  }
  console.log(JSON.stringify({ accepted: true, cases, sourceHashes: Object.fromEntries([...sources].map(file =>
    [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex')])) }))
  dom.window.close()
})().catch(error => { console.error(error); process.exitCode = 1 })
