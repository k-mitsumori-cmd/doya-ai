process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript'), React = require(root + '/node_modules/react')
const { JSDOM } = require(root + '/node_modules/jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/aishodan' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require(root + '/node_modules/react-dom/client')
let fetches = 0; global.fetch = () => { fetches++; throw Error('Guest private fetch') }
const signIn = { __esModule: true, default: ({ fallback, children, ...props }) => React.createElement('a', { ...props, href: `/auth/signin?callbackUrl=${encodeURIComponent(fallback)}` }, children) }
const mocks = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'),
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
  'next/navigation': { usePathname: () => '/aishodan/billing-return/00000000-0000-4000-8000-000000000001' },
  '@/components/SignInReturnLink': signIn,
  '@/components/org/OrganizationWorkspaceBoundary': { useOptionalOrganizationWorkspace: () => null,
    useOrganizationWorkspace: () => { throw Error('Guest required workspace') }, useWorkspaceProof: () => { throw Error('Guest required proof') } },
}
const cases = [
  ['src/app/(shell)/aishodan/sessions/page.tsx', '/aishodan/sessions'],
  ['src/app/(shell)/aishodan/sessions/[id]/page.tsx', '/aishodan/sessions'],
  ['src/app/(shell)/aishodan/scenarios/[id]/page.tsx', '/aishodan'],
  ['src/app/(shell)/aishodan/preview/page.tsx', '/aishodan/preview'],
  ['src/app/(shell)/aishodan/settings/page.tsx', '/aishodan/settings'],
  ['src/app/(shell)/aishodan/billing-return/[navigationId]/page.tsx', '/aishodan/billing-return/00000000-0000-4000-8000-000000000001'],
]
function load(rel) {
  const filename = path.join(root, rel), m = new Module(filename)
  m.paths = Module._nodeModulePaths(path.dirname(filename))
  m.require = name => mocks[name] || {}
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return m.exports.default
}
;(async () => {
  for (const [file, fallback] of cases) {
    const view = createRoot(document.getElementById('root'))
    await React.act(async () => { view.render(React.createElement(load(file))); await new Promise(r => setImmediate(r)) })
    assert.equal(document.querySelector('a')?.getAttribute('href'), `/auth/signin?callbackUrl=${encodeURIComponent(fallback)}`, file)
    await React.act(async () => view.unmount())
  }
  assert.equal(fetches, 0)
  dom.window.close()
  console.log('PASS 6 actual private page guest mounts: session list/detail, scenario, preview, settings and portal return show sign-in link before required proof; private fetch0. Synthetic navigation/auth.')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
