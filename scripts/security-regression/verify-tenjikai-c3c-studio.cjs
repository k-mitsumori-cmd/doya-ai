// Actual BoothStudio consumer with a mounted React tree; 3D drawing is synthetic.
// Saved mode must supply the exact persisted plan, panels and costs without engine recomputation.
process.env.NODE_ENV = 'test'
require('tsx/cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const React = require('react')
const { createRoot } = require('react-dom/client')
const { JSDOM } = require('jsdom')
const ts = require('typescript')
const engine = require('../../src/lib/tenjikai/engine.ts')
const graphics = require('../../src/lib/tenjikai/graphics.ts')
const { materializeTenjikaiWorkspace } = require('../../src/lib/tenjikai/workspace-materialize.ts')
const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/tenjikai/booth' })
global.window = dom.window
global.document = dom.window.document
global.IS_REACT_ACT_ENVIRONMENT = true
let planCostCalls = 0, graphicsCalls = 0
const rendered = []
const no = () => null
const node = name => props => React.createElement('div', { 'data-component': name }, props.children)
const motion = new Proxy({}, { get: (_, tag) => props => React.createElement(tag,
  Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'exit', 'transition', 'layoutId', 'whileHover'].includes(key))), props.children) })
const mocks = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  'framer-motion': { motion, AnimatePresence: node('animate-presence') },
  'lucide-react': new Proxy({}, { get: () => no }),
  'next/image': props => React.createElement('img', { src: props.src, alt: props.alt }),
  './IsoBooth': { __esModule: true, default: no },
  './Booth3D': { __esModule: true, default: props => { rendered.push({ variant: props.plan.variant,
    panels: props.panels.map(p => p.id), plan: props.plan }); return React.createElement('p', null, 'saved-3d-' + props.plan.variant) } },
  './GraphicPlanner': { __esModule: true, default: no },
  './ImageGenModal': { __esModule: true, default: no },
  './EmptyState': { __esModule: true, default: no },
  './ui': { CountUp: ({ value }) => React.createElement('span', null, value), Modal: node('modal'), PageHeader: node('header') },
  './useImageGen': { remainingLabel: () => '', requestImages: () => { throw Error('image provider called') },
    useImageQuota: () => ({ quota: null, refresh: async () => {} }) },
  '@/lib/tenjikai/imagegen': { nearestRatio: () => '1:1' },
  '@/lib/tenjikai/graphics': { ...graphics, generateGraphicPlan: () => { graphicsCalls++; throw Error('saved graphics recomputed') } },
  '@/lib/tenjikai/engine': { ...engine, planCost: () => { planCostCalls++; throw Error('saved cost recomputed') } },
  '@/lib/tenjikai/tokens': { ds: { line: '#ddd', sub: '#999', ink: '#222', blue: '#55f', blueSoft: '#eef', paper: '#fff', yellow: '#ff0' } },
}
const file = path.resolve(__dirname, '../../src/components/tenjikai/BoothStudio.tsx')
const mod = new Module(file)
mod.filename = file
mod.paths = Module._nodeModulePaths(path.dirname(file))
mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id)
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
const BoothStudio = mod.exports.default
const input = engine.SAMPLE_INPUT
const generated = engine.mockGeneratedPlan(input)
const materialized = materializeTenjikaiWorkspace(input, generated)
const savedPlans = materialized.plans.map((item, index) => {
  const elements = item.plan.elements.map((e, n) => ({ ...e, dbId: `element-${index}-${n}`, sortOrder: n }))
  const ids = new Map(elements.map(e => [e.id, e.dbId]))
  return { ...item, dbId: 'plan-' + index, elements,
    panels: item.panels.map((p, n) => ({ ...p, dbId: `panel-${index}-${n}`, elementDbId: ids.get(p.elementId), sortOrder: n })) }
})
const container = document.createElement('div')
document.body.append(container)
const root = createRoot(container)
function Driver() {
  const [variant, setVariant] = React.useState('C')
  return React.createElement(BoothStudio, { plans: savedPlans.map(item => item.plan), savedPlans,
    variant, setVariant, input, analysis: generated.analysis, panelImages: {}, setPanelImages: () => {} })
}
;(async () => {
  await React.act(async () => root.render(React.createElement(Driver)))
  assert.match(container.textContent, /saved-3d-C/)
  assert.deepEqual(rendered.at(-1).panels, savedPlans[2].panels.map(p => p.id))
  assert.equal(rendered.at(-1).plan, savedPlans[2].plan)
  const b = [...container.querySelectorAll('button')].find(item => item.textContent.includes('案 B'))
  assert.ok(b)
  await React.act(async () => b.click())
  assert.match(container.textContent, /saved-3d-B/)
  assert.deepEqual(rendered.at(-1).panels, savedPlans[1].panels.map(p => p.id))
  assert.equal(planCostCalls, 0)
  assert.equal(graphicsCalls, 0)
  await React.act(async () => root.unmount())
  console.log(JSON.stringify({ accepted: true, cases: ['C saved 3D', 'B variant saved panels', 'engine recompute 0'],
    sourceSha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex') }))
})().catch(error => { console.error(error); process.exitCode = 1 })
