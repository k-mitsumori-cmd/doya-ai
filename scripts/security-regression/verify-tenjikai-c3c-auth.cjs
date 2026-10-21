// Actual private workspace route -> actual adapter -> actual mounted saved-detail hook.
// Session, database and transport are synthetic. No HTTP, provider or production DB.
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
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/tenjikai?project=project-a' })
global.window = dom.window; global.document = dom.window.document
global.IS_REACT_ACT_ENVIRONMENT = true
const Session = React.createContext(null)
let frame, serverActor = '', updateActor = '', updateCalls = 0, reads = [], late = null
const cache = new Map(), sources = new Set()
const mock = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-dom': require('react-dom'),
  'next-auth/react': { useSession: () => React.useContext(Session) },
  'next-auth': { getServerSession: async () => serverActor ? { user: { id: serverActor } } : null },
  '@/lib/auth': { authOptions: {} },
  '@/lib/private-api-response': { privateApiJson: (body, options) => ({ status: options?.status ?? 200, body }) },
  '@/lib/tenjikai/workspace-store': { readFullTenjikaiWorkspace: async () => null },
  '@/lib/tenjikai/project-detail-read': { readTenjikaiProjectDetail: async () => ({ state: 'not_found' }) },
  '@/lib/prisma': { prisma: {} },
  '@/lib/tenjikai/generation-client': { readGenerationEnvelope: async (_init, _signal, url) => {
    reads.push(url)
    if (late && url.includes('expectedActor=actor-a')) return new Promise(resolve => { late.resolve = resolve })
    return route.GET({ nextUrl: new URL(url, 'https://example.invalid') },
      { params: Promise.resolve({ id: 'project-a' }) })
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
const route = load(path.join(repo, 'src/app/api/tenjikai/projects/[id]/workspace/route.ts'))
const { useSavedProjectDetail } = load(path.join(repo, 'src/lib/tenjikai/use-saved-project-detail.ts'))
const { readFullTenjikaiWorkspaceDto } = load(path.join(repo, 'src/lib/tenjikai/workspace-dto.ts'))
function validWorkspace(actorId) {
  const m = materializeTenjikaiWorkspace(SAMPLE_INPUT, mockGeneratedPlan(SAMPLE_INPUT))
  const venue = VENUES.find(item => item.id === SAMPLE_INPUT.venueId)
  const plans = m.plans.map(({ plan, panels, cost, electric }, pi) => {
    const elements = plan.elements.map((item, n) => ({ ...item, z: item.z ?? 0, dbId: `element-${pi}-${n}`, sortOrder: n }))
    const ids = new Map(elements.map(item => [item.id, item.dbId]))
    return { dbId: `plan-${pi}`, plan: { ...plan, elements: elements.map(item => ({ ...item })) }, cost, electric, elements,
      panels: panels.map((item, n) => ({ ...item, dbId: `panel-${pi}-${n}`, elementDbId: ids.get(item.elementId), sortOrder: n })) }
  })
  const value = { schemaVersion: 1, actorId, projectId: 'project-a', revision: '1',
    coverage: { graph: 'saved', images: 'not_saved', documents: 'not_saved', vendors: 'illustrative' }, input: SAMPLE_INPUT,
    venueSnapshot: { code: venue.id, name: venue.name, note: venue.note, komaSizeM: venue.komaM,
      komaPriceYen: venue.komaPriceYen, maxHeightM: venue.maxHeightM, source: 'design_reference' },
    analysis: { ...m.analysis, source: m.source, notice: m.notice, modelId: null },
    projectedVisitors: m.projectedVisitors, selectedVariant: m.selectedVariant, plans,
    creatives: m.creatives.map((item, n) => ({ ...item, dbId: `creative-${n}`, sortOrder: n })),
    novelties: m.novelties.map(({ novelty, quantity, selected }, n) => ({ ...novelty, dbId: `novelty-${n}`, quantity, selected, sortOrder: n })),
    budgetLines: m.budgetLines.map((item, n) => ({ ...item, dbId: `budget-${n}`, source: 'ai', status: 'planned' })),
    deadlines: m.deadlines.map((item, n) => ({ ...item, dbId: `deadline-${n}`, done: false, sortOrder: n })),
  }
  assert.ok(readFullTenjikaiWorkspaceDto(value), 'late body must be a valid full workspace DTO')
  return value
}
const tick = () => new Promise(resolve => setImmediate(resolve))
function View() {
  const result = useSavedProjectDetail('project-a')
  return React.createElement('div', null,
    React.createElement('span', { id: 'phase' }, result.phase),
    React.createElement('button', { onClick: result.reload }, 'reload'))
}
async function mount(sdkActor) {
  const container = document.createElement('div'); document.body.append(container)
  frame = { actor: sdkActor, container, root: createRoot(container) }
  frame.update = async () => { updateCalls++; return updateActor ? { user: { id: updateActor } } : null }
  frame.render = () => frame.root.render(React.createElement(Session.Provider,
    { value: { status: frame.actor ? 'authenticated' : 'unauthenticated',
      data: frame.actor ? { user: { id: frame.actor } } : null, update: frame.update } }, React.createElement(View)))
  frame.act = async callback => React.act(async () => { callback(); for (let i = 0; i < 8; i++) await tick() })
  frame.phase = () => container.querySelector('#phase')?.textContent
  await frame.act(frame.render)
  return frame
}
async function unmount() { await frame.act(() => { frame.root.unmount(); frame.container.remove() }) }
;(async () => {
  const cases = []
  serverActor = ''; updateActor = 'actor-a'; reads = []; updateCalls = 0
  let view = await mount('actor-a')
  assert.equal(view.phase(), 'unauthenticated')
  assert.equal(reads.length, 1)
  serverActor = 'actor-a'
  await view.act(() => view.container.querySelector('button').click())
  assert.equal(updateCalls, 1)
  assert.equal(view.phase(), 'not_found')
  assert.equal(reads.length, 2)
  cases.push('route 401 reaches adapter and mounted hook verification; same actor re-reads')
  await unmount()

  serverActor = 'actor-b'; updateActor = 'actor-b'; reads = []; updateCalls = 0
  view = await mount('actor-a')
  assert.equal(view.phase(), 'auth_changed')
  await view.act(() => view.container.querySelector('button').click())
  assert.equal(updateCalls, 1)
  assert.equal(view.phase(), 'auth_changed')
  await view.act(() => { view.actor = 'actor-b'; view.render() })
  assert.equal(view.phase(), 'not_found')
  assert.equal(reads.filter(url => url.includes('expectedActor=actor-b')).length, 1)
  cases.push('route 409 verifies SDK actor B and adopts only B read')
  await unmount()

  serverActor = 'actor-a'; updateActor = 'actor-b'; reads = []; late = {}
  view = await mount('actor-a')
  assert.equal(view.phase(), 'loading')
  await view.act(() => { view.actor = 'actor-b'; serverActor = 'actor-b'; view.render() })
  assert.equal(view.phase(), 'not_found')
  await view.act(() => late.resolve({ status: 200, body: { state: 'ready_full', actorId: 'actor-a', projectId: 'project-a', workspace: validWorkspace('actor-a') } }))
  assert.equal(view.phase(), 'not_found')
  cases.push('late A body cannot revive after SDK B')
  await unmount()
  console.log(JSON.stringify({ accepted: true, cases, sourceHashes: Object.fromEntries([...sources].map(file =>
    [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex')])) }))
})().catch(error => { console.error(error); process.exitCode = 1 })
