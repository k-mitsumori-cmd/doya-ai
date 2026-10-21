process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const ts = req('typescript'), React = req('react'), { JSDOM } = req('jsdom')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/quote/documents/one?org=A' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = req('react-dom/client')
let pathname = '/quote/documents/one', slug = 'A', version = 1, switched = []
const scope = () => ({ kind: 'ready', proof: { actorId: 'actor', revision: version, organization: { id: 'id-' + slug, slug, name: slug, role: 'owner' }, current: () => true,
  href: value => { const url = new URL(value, 'https://example.invalid'); url.searchParams.set('org', slug); return url.pathname + url.search } }, memberships: [] })
const mocks = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'next/navigation': { usePathname: () => pathname },
  '@/lib/ui/guest-path': { isGuestPath: value => value.startsWith('/quote/invite/') },
  '@/components/shell/ToolFrame': { __esModule: true, default: ({ nav, switcher, children }) => React.createElement('div', null,
    React.createElement('nav', null, nav.map(item => React.createElement('a', { key: item.href, href: item.href }, item.label))), switcher, children) },
  './QuoteWorkspaceBoundary': { useOptionalQuoteWorkspace: () => ({ scope: scope() }), useQuoteWorkspace: () => ({ scope: scope(), switchTo: next => switched.push(next) }) },
  './QuoteOrgSwitcher': { __esModule: true, default: () => React.createElement('button', { onClick: () => switched.push('B') }, 'switch') },
}
const cache = new Map()
function load(rel) { if (cache.has(rel)) return cache.get(rel).exports; const filename = root + '/' + rel, m = new Module(filename); cache.set(rel, m)
  m.require = id => { if (id in mocks) return mocks[id]; if (id === '@/lib/quote/nav') return load('src/lib/quote/nav.ts'); throw Error('Unmocked ' + id) }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename); return m.exports }
const Shell = load('src/components/quote/QuoteShellFrame.tsx').default, view = createRoot(document.getElementById('root'))
const render = () => React.act(async () => { view.render(React.createElement(Shell, null, React.createElement('span', null, 'child'))); await new Promise(setImmediate) })
;(async () => { await render(); let links = [...document.querySelectorAll('nav a')].map(row => row.getAttribute('href')); assert.ok(links.length >= 2); assert.ok(links.every(row => row.includes('org=A')))
  slug = 'B'; version++; await render(); links = [...document.querySelectorAll('nav a')].map(row => row.getAttribute('href')); assert.ok(links.every(row => row.includes('org=B'))); assert.ok(!document.body.innerHTML.includes('org=A'))
  pathname = '/quote/invite/token'; await render(); assert.equal(document.querySelectorAll('nav a').length, 0); assert.equal(document.querySelector('button'), null); assert.ok(document.body.textContent.includes('child'))
  await React.act(async () => view.unmount()); dom.window.close(); console.log('PASS Quote ToolFrame scoped navigation A/B and public invite bypass. Actual frame/nav, synthetic proof and ToolFrame.') })().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
