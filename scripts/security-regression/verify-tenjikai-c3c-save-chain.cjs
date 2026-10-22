// Actual save/status/workspace routes, adapters and mounted FullSavedProjectMode.
// Auth, DB store, provider and visual children are synthetic; no HTTP or external write.
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
const { mockGeneratedPlan, SAMPLE_INPUT, VENUES } = require('../../src/lib/tenjikai/engine.ts')
const { materializeTenjikaiWorkspace } = require('../../src/lib/tenjikai/workspace-materialize.ts')
const repo = path.resolve(__dirname, '../..')
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/tenjikai/budget?project=project-a' })
global.window = dom.window; global.document = dom.window.document; global.crypto = crypto.webcrypto
global.IS_REACT_ACT_ENVIRONMENT = true
const Session = React.createContext(null)
const no = () => null, wrap = ({ children }) => React.createElement('div', null, children)
const motion = new Proxy({}, { get: (_, tag) => ({ children, ...props }) => React.createElement(tag,
  Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'exit', 'transition', 'layout', 'layoutId'].includes(key))), children) })
function validWorkspace(revision = '1') {
  const m = materializeTenjikaiWorkspace(SAMPLE_INPUT, mockGeneratedPlan(SAMPLE_INPUT))
  const venue = VENUES.find(item => item.id === SAMPLE_INPUT.venueId)
  const plans = m.plans.map(({ plan, panels, cost, electric }, pi) => {
    const elements = plan.elements.map((item, n) => ({ ...item, z: item.z ?? 0, dbId: `element-${pi}-${n}`, sortOrder: n }))
    const ids = new Map(elements.map(item => [item.id, item.dbId]))
    return { dbId: `plan-${pi}`, plan: { ...plan, elements: elements.map(item => ({ ...item })) }, cost, electric, elements,
      panels: panels.map((item, n) => ({ ...item, dbId: `panel-${pi}-${n}`, elementDbId: ids.get(item.elementId), sortOrder: n })) }
  })
  return { schemaVersion: 1, actorId: 'actor-a', projectId: 'project-a', revision,
    coverage: { graph: 'saved', images: 'not_saved', documents: 'not_saved', vendors: 'illustrative' }, input: { ...SAMPLE_INPUT },
    venueSnapshot: { code: venue.id, name: venue.name, note: venue.note, komaSizeM: venue.komaM,
      komaPriceYen: venue.komaPriceYen, maxHeightM: venue.maxHeightM, source: 'design_reference' },
    analysis: { ...m.analysis, source: m.source, notice: m.notice, modelId: null },
    projectedVisitors: m.projectedVisitors, selectedVariant: m.selectedVariant, plans,
    creatives: m.creatives.map((item, n) => ({ ...item, dbId: `creative-${n}`, sortOrder: n })),
    novelties: m.novelties.map(({ novelty, quantity, selected }, n) => ({ ...novelty, dbId: `novelty-${n}`, quantity, selected, sortOrder: n })),
    budgetLines: m.budgetLines.map((item, n) => ({ ...item, dbId: `budget-${n}`, source: 'ai', status: 'planned' })),
    deadlines: m.deadlines.map((item, n) => ({ ...item, dbId: `deadline-${n}`, done: false, sortOrder: n })),
  }
}
let frame, serverActor = 'actor-a', latest = validWorkspace(), pendingReply = null, loseReply = false, savePosts = 0, statusReads = 0
const receipts = new Map(), cases = [], sources = new Set(), cache = new Map()
class SaveError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code } }
const store = {
  WorkspaceSaveError: SaveError,
  saveTenjikaiWorkspace: async (actor, projectId, op, revision, patch) => {
    savePosts++
    if (actor !== 'actor-a' || projectId !== 'project-a') throw new SaveError(409, 'FOREIGN_PROJECT')
    if (receipts.has(op)) {
      const receipt = receipts.get(op)
      if (receipt.state === 'canceled') throw new SaveError(409, 'CANCELED')
      return receipt
    }
    if (revision !== latest.revision) throw new SaveError(409, 'REVISION_CHANGED')
    const next = structuredClone(latest)
    next.revision = String(BigInt(revision) + 1n)
    if (patch.budgetYen !== undefined) next.input.budgetYen = patch.budgetYen
    latest = next
    const result = { operationId: op, state: 'committed', projectId, resultRevision: next.revision, workspace: next }
    receipts.set(op, result)
    return result
  },
  statusWorkspaceSave: async (_actor, op) => receipts.get(op) ||
    { operationId: op, state: 'missing', projectId: null, resultRevision: null, workspace: null },
  cancelMissingWorkspaceSave: async (_actor, op) => {
    if (!receipts.has(op)) receipts.set(op, { operationId: op, state: 'canceled', projectId: null, resultRevision: null, workspace: null })
    return receipts.get(op)
  },
}
const mock = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-dom': require('react-dom'),
  'next/link': ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
  'next/navigation': { usePathname: () => new URL(frame.route, 'https://example.invalid').pathname,
    useSearchParams: () => new URLSearchParams(new URL(frame.route, 'https://example.invalid').search), useRouter: () => frame.router },
  'next-auth/react': { useSession: () => React.useContext(Session), signOut: async () => {} },
  'next-auth': { getServerSession: async () => serverActor ? { user: { id: serverActor } } : null },
  '@/lib/auth': { authOptions: {} },
  '@/lib/private-api-response': { privateApiJson: (body, options) => ({ status: options?.status ?? 200,
    ok: (options?.status ?? 200) < 400, body }) },
  '@/lib/prisma': { prisma: {} },
  '@/lib/account-lifecycle/state': { LifecycleError: class extends Error {} },
  '@/lib/tenjikai/project-revision': { TenjikaiRevisionError: class extends Error {} },
  '@/lib/tenjikai/workspace-save': store,
  '@/lib/tenjikai/workspace-store': { readFullTenjikaiWorkspace: async (actor, project) =>
    actor === 'actor-a' && project === 'project-a' ? latest : null },
  '@/lib/tenjikai/project-detail-read': { readTenjikaiProjectDetail: async () => ({ state: 'not_found' }) },
  '@/lib/use-entry-organization': { useEntryActorScope: () => ({ actor: frame.actor, status: 'authenticated', version: 0, current: frame.current }) },
  '@/lib/tenjikai/use-saved-project-detail': { useSavedProjectDetail: () => ({ phase: 'ready_full', detail: null, workspace: frame.initial, reload: () => {} }) },
  '@/lib/tenjikai/generation-status-client': { validOperationHandle: () => false, withGenerationOperation: href => href,
    readGenerationStatus: async () => null, cancelGenerationStatus: async () => null },
  'framer-motion': { motion, AnimatePresence: wrap }, 'lucide-react': new Proxy({}, { get: () => no }),
  './TenjikaiSidebar': { __esModule: true, default: () => null },
  './Wizard': { __esModule: true, default: () => null }, './Generating': { __esModule: true, default: no },
  './BoothStudio': { __esModule: true, default: no }, './Overview': { __esModule: true, default: no },
  './CreativeStudio': { __esModule: true, default: no }, './NoveltyPicker': { __esModule: true, default: no },
  './BudgetPlanner': { __esModule: true, default: ({ input, setInput }) => React.createElement('button',
    { onClick: () => setInput({ ...input, budgetYen: input.budgetYen + 1 }) }, 'edit-budget') },
  './VendorBoard': { __esModule: true, default: no }, './DocsVault': { __esModule: true, default: no },
  './SavedProjectPartialView': { __esModule: true, default: no },
  '@/components/shell/ToolFrame': { __esModule: true, default: ({ children }) => React.createElement('div', null, children) },
  '@/lib/tenjikai/generation-client': { readGenerationEnvelope: async (init, signal, url) => {
    const request = { json: async () => JSON.parse(init.body || '{}'), nextUrl: new URL(url, 'https://example.invalid') }
    const projectId = decodeURIComponent(new URL(url, 'https://example.invalid').pathname.split('/')[4] || 'project-a')
    let response
    if (url.includes('/workspace/save')) response = await saveRoute.POST(request, { params: Promise.resolve({ id: projectId }) })
    else if (url.includes('/workspace-save/status')) { statusReads++; response = init.method === 'DELETE' ? await statusRoute.DELETE(request) : await statusRoute.POST(request) }
    else response = await workspaceRoute.GET(request, { params: Promise.resolve({ id: projectId }) })
    if (url.includes('/workspace/save') && loseReply) { loseReply = false; throw new Error('response lost after commit') }
    if (url.includes('/workspace/save') && pendingReply) return new Promise(resolve => { pendingReply.resolve = () => resolve(response) })
    if (signal.aborted) throw new Error('aborted')
    return response
  } },
}
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file).exports
  sources.add(path.relative(repo, file))
  const mod = new Module(file)
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(file, mod)
  mod.require = id => {
    if (Object.hasOwn(mock, id)) return mock[id]
    if (id.startsWith('@/') || id.startsWith('.')) {
      const stem = id.startsWith('@/') ? path.join(repo, 'src', id.slice(2)) : path.resolve(path.dirname(file), id)
      if (stem === path.join(repo, 'src/lib/tenjikai/generation-client')) return mock['@/lib/tenjikai/generation-client']
      if (stem === path.join(repo, 'src/lib/tenjikai/workspace-save')) return store
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
const saveRoute = load(path.join(repo, 'src/app/api/tenjikai/projects/[id]/workspace/save/route.ts'))
const statusRoute = load(path.join(repo, 'src/app/api/tenjikai/workspace-save/status/route.ts'))
const workspaceRoute = load(path.join(repo, 'src/app/api/tenjikai/projects/[id]/workspace/route.ts'))
const client = load(path.join(repo, 'src/lib/tenjikai/workspace-save-client.ts'))
const { readFullTenjikaiWorkspaceDto } = load(path.join(repo, 'src/lib/tenjikai/workspace-dto.ts'))
assert.ok(readFullTenjikaiWorkspaceDto(latest))
mock['@/lib/tenjikai/workspace-save-client'] = client
const App = load(path.join(repo, 'src/components/tenjikai/TenjikaiApp.tsx')).default
const tick = () => new Promise(resolve => setImmediate(resolve))
async function mount(route = '/tenjikai/budget?project=project-a') {
  const container = document.createElement('div'); document.body.append(container)
  frame = { actor: 'actor-a', route, container, root: createRoot(container), initial: structuredClone(latest) }
  frame.current = () => frame.actor === 'actor-a'
  frame.router = { push: url => { frame.route = url; frame.render() }, replace: url => { frame.route = url; frame.render() } }
  frame.render = () => frame.root.render(React.createElement(Session.Provider, { value: { status: 'authenticated',
    data: { user: { id: frame.actor } }, update: async () => ({ user: { id: frame.actor } }) } }, React.createElement(App)))
  frame.act = async callback => React.act(async () => { callback(); for (let i = 0; i < 8; i++) await tick() })
  frame.click = label => frame.act(() => { const button = [...container.querySelectorAll('button')].find(item => item.textContent === label)
    assert.ok(button, label); button.click() })
  await frame.act(frame.render)
  return frame
}
async function unmount() { await frame.act(() => { frame.root.unmount(); frame.container.remove() }) }
;(async () => {
  let view = await mount()
  await view.click('edit-budget')
  await view.click('変更を保存')
  assert.equal(latest.revision, '2')
  assert.equal(savePosts, 1)
  assert.doesNotMatch(view.route, /saveOperation=/)
  cases.push('actual route adapter mounted save commits one revision and adopts full DTO')
  await unmount()

  loseReply = true
  view = await mount()
  await view.click('edit-budget')
  await view.click('変更を保存')
  assert.equal(latest.revision, '3')
  assert.ok(statusReads >= 1)
  assert.doesNotMatch(view.route, /saveOperation=/)
  assert.equal(savePosts, 2)
  cases.push('lost committed response recovers by same durable ID without second POST')
  await unmount()

  const outdated = structuredClone(latest)
  latest = structuredClone(latest); latest.revision = String(BigInt(latest.revision) + 1n)
  view = await mount()
  frame.initial = outdated; await view.act(frame.render)
  await view.click('edit-budget')
  await view.click('変更を保存')
  assert.equal(latest.revision, '4')
  assert.match(view.route, /saveOperation=/)
  await view.click('保存状態を確認')
  await view.click('遅れて届く保存を取り消す')
  await view.click('未保存変更を破棄して最新の保存内容を確認し、編集を続ける')
  assert.doesNotMatch(view.route, /saveOperation=/)
  await view.click('edit-budget')
  await view.click('変更を保存')
  assert.equal(latest.revision, '5')
  cases.push('actual rejected CAS missing tombstone latest read then fresh intent succeeds')
  await unmount()

  serverActor = 'actor-b'
  view = await mount()
  await view.click('edit-budget')
  await view.click('変更を保存')
  assert.equal(latest.revision, '5')
  assert.match(view.route, /saveOperation=/)
  assert.equal(view.container.textContent.includes('確認中'), true)
  cases.push('foreign server actor cannot mutate owned project through actual route')
  await unmount()
  serverActor = 'actor-a'
  const foreign = await client.saveWorkspace('actor-a', 'project-b', latest.revision,
    client.newSaveHandle(), { budgetYen: latest.input.budgetYen + 1 }, new AbortController().signal)
  assert.equal(foreign.state, 'rejected')
  assert.equal(latest.revision, '5')
  cases.push('foreign project through actual save route and adapter mutates zero')
  console.log(JSON.stringify({ accepted: true, cases, sourceHashes: Object.fromEntries([...sources].map(file =>
    [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex')])) }))
})().catch(error => { console.error(error); process.exitCode = 1 })
