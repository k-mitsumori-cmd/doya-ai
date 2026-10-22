// Actual dev page + fixture wrapper + shared SiteDetailView. Synthetic UI shell only;
// no SessionProvider, API, router, DB, or provider calls.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..')
const requireRoot = Module.createRequire(path.join(root, 'package.json'))
const React = requireRoot('react'), { renderToStaticMarkup } = requireRoot('react-dom/server')
const { createRoot } = requireRoot('react-dom/client'), { JSDOM } = requireRoot('jsdom')
const ts = requireRoot('typescript')
const source = file => fs.readFileSync(path.join(root, file), 'utf8')
function load(file, mocks = {}) {
  const filename = path.join(root, file), mod = new Module(filename)
  mod.filename = filename
  mod.require = id => id in mocks ? mocks[id] : requireRoot(id)
  mod._compile(ts.transpileModule(source(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename)
  return mod.exports
}
const no = () => null
const forbidden = name => () => { throw new Error(`${name} must not be used in the dev preview`) }
const actualSchema = load('src/lib/popup/schema.ts')
const fixtures = load('src/lib/popup/dev-fixtures.ts', { './schema': actualSchema })
const common = { react: React, 'react/jsx-runtime': requireRoot('react/jsx-runtime') }
const ui = {
  ConfirmDialog: forbidden('ConfirmDialog'), CopyButton: forbidden('CopyButton'),
  DaysSwitch: forbidden('DaysSwitch'), EmptyState: ({ title, action }) => React.createElement('div', null, title, action),
  ErrorState: no, KindBadge: ({ kind }) => React.createElement('span', null, kind),
  PageHeader: ({ back, title, sub, action }) => React.createElement('header', null,
    back && React.createElement('a', { href: back.href }, back.label), title, sub, action),
  SkeletonDetail: no, StatTile: ({ label, value }) => React.createElement('div', null, label, value),
  StatusBadge: ({ status }) => React.createElement('span', null, status),
  fmt: String, frequencyText: () => '頻度', pct: String,
  summaryText: () => '出し方', targetingText: () => '対象', useToast: forbidden('useToast'),
}
const viewModule = load('src/app/(shell)/popup/sites/[id]/SiteDetailClient.tsx', {
  ...common, 'next/image': { default: no, __esModule: true },
  'next/link': { default: forbidden('Link'), __esModule: true },
  'next/navigation': { useRouter: forbidden('useRouter') },
  'next-auth/react': { useSession: forbidden('useSession') },
  'lucide-react': new Proxy({}, { get: () => no }),
  '@/lib/popup/schema': actualSchema,
  '@/lib/safe-signin-callback': { safeSignInCallbackUrl: forbidden('safeSignInCallbackUrl') },
  '@/components/popup/PopupPreview': { default: () => React.createElement('div', null, 'popup visual'), __esModule: true },
  '@/components/popup/ui': ui,
})
const Preview = load('src/app/(shell)/popup/dev/states/SiteDetailPreview.tsx', {
  ...common, '../../sites/[id]/SiteDetailClient': viewModule,
}).default
let notFoundCalls = 0
const Page = load('src/app/(shell)/popup/dev/states/page.tsx', {
  ...common, 'next/navigation': { notFound: () => { notFoundCalls++; throw new Error('notFound') } },
  '@/lib/popup/dev-fixtures': fixtures,
  '@/components/shell/AppShell': { default: ({ children }) => React.createElement('div', { 'data-shell': 'app' }, children), __esModule: true },
  '@/components/popup/PopupShellFrame': { default: ({ children }) => React.createElement('div', { 'data-shell': 'popup' }, children), __esModule: true },
  '@/lib/popup/nav': { POPUP_NAV: [] },
  '@/components/popup/ui': ui,
  '../../Tool': { default: no, __esModule: true },
  './SiteDetailPreview': { default: Preview, __esModule: true },
  '../../edit/[id]/EditClient': { default: no, __esModule: true },
}).default
const originalFetch = global.fetch
global.fetch = forbidden('fetch')
;(async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ s: 'site' }) }))
  for (const marker of ['サンプル株式会社', '設置タグ', 'DevSiteKey_abcdefghijklm', '表示（30日）',
    'ポップアップ', 'A. AIに聞く', 'B. 相談・申し込み', '画像のポップアップ', '開発用の見本です']) {
    assert.ok(html.includes(marker), `missing actual preview marker: ${marker}`)
  }
  assert.equal((html.match(/<button\b/g) || []).length > 5, true)
  assert.equal((html.match(/<button\b/g) || []).length, (html.match(/<button\b[^>]*disabled/g) || []).length,
    'every preview action must be visibly disabled')
  assert.equal((html.match(/<a\b/g) || []).length, 0, 'no navigation from the preview')
  console.log('PASS actual dev site fixture renders shared view without session, router or fetch; all actions disabled')
  const shell = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ s: 'site', shell: '1' }) }))
  assert.match(shell, /data-shell="app"/); assert.match(shell, /data-shell="popup"/)
  assert.match(shell, /設置タグ/)
  console.log('PASS shell=1 keeps the same fixture-only site preview')
  process.env.NODE_ENV = 'production'
  await assert.rejects(() => Page({ searchParams: Promise.resolve({ s: 'site' }) }), /notFound/)
  assert.equal(notFoundCalls, 1)
  console.log('PASS production dev route remains notFound before rendering')
  process.env.NODE_ENV = 'test'
  const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/popup/dev/states?s=site' })
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
  global.ResizeObserver = class {
    constructor(callback) { this.callback = callback }
    observe() { this.callback([{ contentRect: { width: 300 } }]) }
    disconnect() {}
  }
  const actualPopupPreview = load('src/components/popup/PopupPreview.tsx', common)
  const realView = load('src/app/(shell)/popup/sites/[id]/SiteDetailClient.tsx', {
    ...common, 'next/image': { default: no, __esModule: true },
    'next/link': { default: ({ href, children }) => React.createElement('a', { href }, children), __esModule: true },
    'next/navigation': { useRouter: forbidden('useRouter') },
    'next-auth/react': { useSession: forbidden('useSession') },
    'lucide-react': new Proxy({}, { get: () => no }),
    '@/lib/popup/schema': actualSchema,
    '@/lib/safe-signin-callback': { safeSignInCallbackUrl: forbidden('safeSignInCallbackUrl') },
    '@/components/popup/PopupPreview': actualPopupPreview,
    '@/components/popup/ui': { ...ui, CopyButton: no, DaysSwitch: () => React.createElement('span', null, '30日') },
  })
  const RealPreview = load('src/app/(shell)/popup/dev/states/SiteDetailPreview.tsx', {
    ...common, '../../sites/[id]/SiteDetailClient': realView,
  }).default
  const rootNode = createRoot(document.getElementById('root'))
  const act = async work => React.act(async () => { await work(); await new Promise(resolve => setTimeout(resolve, 0)) })
  await act(() => rootNode.render(React.createElement(RealPreview, { initial: fixtures.DETAIL })))
  await act(() => new Promise(resolve => setTimeout(resolve, 280)))
  assert.equal(document.querySelectorAll('[inert] iframe[srcdoc]').length, fixtures.DETAIL.popups.length,
    'actual srcDoc previews must be inside an inert subtree, including keyboard navigation')
  assert.equal(document.querySelectorAll('[inert] a').length, 0)
  await act(() => rootNode.render(React.createElement(realView.SiteDetailView, {
    data: fixtures.DETAIL, days: 30, actions: {
      onDaysChange: no, onRetry: no, onAddPopup: no, onPopupAction: no,
      onRequestSiteDelete: no, onCancelConfirm: no, onConfirmPopupDelete: no, onConfirmSiteDelete: no,
    },
  })))
  assert.equal(document.querySelectorAll('[inert]').length, 0, 'production view remains interactive')
  assert.equal(document.querySelectorAll('a[href^="/popup/edit/"]').length, fixtures.DETAIL.popups.length)
  console.log('PASS actual PopupPreview srcDoc is inert only in the read-only preview; production view stays interactive')
  await act(() => rootNode.unmount())
  dom.window.close()
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { global.fetch = originalFetch })
