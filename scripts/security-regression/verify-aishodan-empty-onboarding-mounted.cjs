process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript'), React = require(root + '/node_modules/react')
const { JSDOM } = require(root + '/node_modules/jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/aishodan' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require(root + '/node_modules/react-dom/client')
const Null = () => null, writes = []
let retries = 0
const workspace = { scope: { kind: 'empty' }, retry: () => { retries++ }, switchTo: () => { throw Error('Unverified organization switch') } }
global.fetch = async (url, init) => {
  assert.equal(url, '/api/aishodan/organizations')
  assert.equal(init.method, 'POST')
  writes.push(JSON.parse(init.body))
  return Response.json({ organization: { id: 'org-A', slug: 'A' } })
}
const leaves = require('./caller14-leaf-bridge.cjs')(root, React, ts)
const mocks = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'),
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
  '@/components/org/OrganizationWorkspaceBoundary': { useOrganizationWorkspace: () => workspace },
  '@/components/org/OrgSwitcher': { __esModule: true, default: Null },
  '@/lib/org-fetch': { fetchOrgJson: () => { throw Error('Empty workspace private read') } },
  '@/lib/aishodan/types': { SESSION_STATUS_LABELS: {}, VERDICT_LABELS: {} },
  './Lp': { __esModule: true, default: Null },
  '@/lib/ui/notify': { notifyError: (set, message) => set(message) },
  '@/components/lp': { DoyaKun: Null },
  '@/components/LoadingProgress': { __esModule: true, default: Null },
  '@/lib/aishodan/list-pages': { appendAishodanPage() {}, parseAishodanPage() {} },
  '@/components/shell/ui-next-context': { useUiNext: () => false },
  '@/components/ds': { Button: Null, EmptyState: Null, FirstSteps: Null, Skeleton: Null, StatTile: Null, ToolHero: Null },
  '@/components/ds/motion': { Stagger: ({ children }) => children, StaggerItem: ({ children }) => children },
  '@/components/aishodan/failure': leaves.aishodanFailure(),
}
const filename = root + '/src/app/(shell)/aishodan/Tool.tsx', m = new Module(filename)
m.paths = Module._nodeModulePaths(path.dirname(filename)); m.require = name => { assert.ok(name in mocks, name); return mocks[name] }
m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
const view = createRoot(document.getElementById('root'))
const props = node => node[Object.keys(node).find(key => key.startsWith('__reactProps$'))]
;(async () => {
  await React.act(async () => { view.render(React.createElement(m.exports.default)); await new Promise(r => setImmediate(r)) })
  const input = document.querySelector('input[placeholder]')
  assert.ok(input)
  assert.match(document.body.textContent, /はじめに、商談を行う組織を作成してください/)
  assert.equal(writes.length, 0)
  await React.act(async () => props(input).onChange({ target: { value: 'Acme' } }))
  const create = [...document.querySelectorAll('button')].find(node => node.textContent.includes('組織を作成する'))
  assert.ok(create); assert.equal(create.disabled, false)
  await React.act(async () => { props(create).onClick(); await new Promise(r => setImmediate(r)) })
  assert.deepEqual(writes, [{ name: 'Acme' }]); assert.equal(retries, 1)
  await React.act(async () => view.unmount()); dom.window.close()
  console.log('PASS actual Aishodan Tool empty onboarding form: no private read, explicit create POST1 and boundary retry1. Synthetic organization API only.')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
