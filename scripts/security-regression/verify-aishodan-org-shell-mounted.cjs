process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript'), React = require(root + '/node_modules/react')
const { JSDOM } = require(root + '/node_modules/jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/aishodan/sessions/old?org=A' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require(root + '/node_modules/react-dom/client')
let pathname = '/aishodan/sessions/old', switched = []
const selection = (() => {
  const filename = root + '/src/lib/organization-workspace-selection.ts', m = new Module(filename)
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  return m.exports
})()
const proof = { actorId: 'actor-A', organization: { id: 'id-A', slug: 'A', name: 'Org A', role: 'owner' }, revision: 1,
  current: () => true, href: value => selection.workspaceHref(value, 'A'), api: value => selection.workspaceApi(value, 'A') }
const workspace = { scope: { kind: 'ready', proof, memberships: [proof.organization, { id: 'id-B', slug: 'B', name: 'Org B', role: 'member' }] }, switchTo: slug => switched.push(slug), retry() {} }
const link = { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) }
const Null = () => null
const navMock = {
  SidebarShell: ({ children }) => React.createElement('aside', null, children), SidebarLogoSection: Null, SidebarSectionTitle: Null,
  SidebarNavLink: ({ item }) => React.createElement('a', { href: item.href, 'data-sidebar-nav': item.label }, item.label),
  SidebarCollapseToggle: Null, SidebarBrandingFooter: Null, SidebarHelpContact: Null, SidebarLogoutDialog: Null,
  SidebarUserProfile: ({ loginCallbackUrl }) => React.createElement('a', { href: loginCallbackUrl, 'data-login-callback': true }, 'ログイン'),
  SidebarUsagePanel: ({ pricingHref, organizationSlug }) => React.createElement('a', { href: pricingHref, 'data-usage-org': organizationSlug }, '料金'),
  useSidebarState: () => ({ isCollapsed: false, showLabel: true, toggle() {} }),
}
const mocks = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'), 'next/link': link,
  'next/navigation': { usePathname: () => pathname }, 'next-auth/react': { useSession: () => ({ status: 'authenticated', data: { user: { id: 'actor-A' } } }), signOut: async () => {} },
  '@/components/org/OrganizationWorkspaceBoundary': { useWorkspaceProof: () => { if (workspace.scope.kind !== 'ready') throw Error('Sidebar cannot read an empty workspace'); return proof }, useOptionalOrganizationWorkspace: () => workspace, useOrganizationWorkspace: () => workspace },
  '@/lib/ui/guest-path': { isGuestPath: value => /^\/aishodan\/invite\//.test(value) },
  '@/components/shell/ToolFrame': { __esModule: true, default: ({ nav, switcher, children }) => React.createElement('div', null,
    React.createElement('nav', null, nav.map(item => React.createElement('a', { key: item.href, href: item.href, 'data-shell-nav': item.label }, item.label))), switcher, children) },
  '@/components/shell/nav': { isNavActive: (current, item) => current === item.href || current.startsWith(item.href + '/') },
  '@/components/shell/icons': { resolveShellIcon: () => Null },
  '@/components/sidebar/themes': { aishodanTheme: {} }, '@/components/sidebar': navMock,
  '@/components/ToolSwitcherMenu': { ToolSwitcherMenu: Null },
  'lucide-react': { MessagesSquare: Null, Menu: Null },
  'framer-motion': { AnimatePresence: ({ children }) => children, motion: new Proxy({}, { get: (_, tag) => ({ children, ...props }) => React.createElement(tag, props, children) }) },
}
const cache = new Map()
function load(rel) {
  if (cache.has(rel)) return cache.get(rel).exports
  const filename = root + '/' + rel, m = new Module(filename); cache.set(rel, m); m.paths = Module._nodeModulePaths(path.dirname(filename))
  m.require = name => {
    if (name in mocks) return mocks[name]
    if (name === './AishodanShellSwitcher') return load('src/components/aishodan/AishodanShellSwitcher.tsx')
    if (name === './AishodanSidebar') return load('src/components/aishodan/AishodanSidebar.tsx')
    if (name === '@/components/org/OrgSwitcher') return load('src/components/org/OrgSwitcher.tsx')
    if (name === '@/lib/aishodan/nav') return load('src/lib/aishodan/nav.ts')
    if (name.endsWith('.module.css')) return {}
    throw Error('Unmocked ' + name)
  }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return m.exports
}
const Shell = load('src/components/aishodan/AishodanShellFrame.tsx').default
const Legacy = load('src/components/aishodan/AishodanAppLayout.tsx').default
const rootView = createRoot(document.getElementById('root'))
const render = Component => React.act(async () => { rootView.render(React.createElement(Component, null, React.createElement('p', null, 'work'))); await new Promise(r => setImmediate(r)) })
;(async () => {
  await render(Shell)
  assert.equal(document.querySelector('[data-shell-nav="料金プラン"]').getAttribute('href'), '/aishodan/pricing?org=A')
  assert.equal(document.querySelector('[data-shell-nav="商談ログ"]').getAttribute('href'), '/aishodan/sessions?org=A')
  const select = document.querySelector('select'); assert.ok(select)
  await React.act(async () => { select.value = 'B'; select.dispatchEvent(new window.Event('change', { bubbles: true })) })
  assert.deepEqual(switched, ['B'])
  await render(Legacy)
  assert.equal(document.querySelector('[data-sidebar-nav="料金プラン"]').getAttribute('href'), '/aishodan/pricing?org=A')
  assert.equal(document.querySelector('[data-sidebar-nav="商談ログ"]').getAttribute('href'), '/aishodan/sessions?org=A')
  assert.equal(document.querySelector('[data-usage-org]').getAttribute('href'), '/aishodan/pricing?org=A')
  assert.equal(document.querySelector('[data-login-callback]').getAttribute('href'), '/aishodan?org=A')
  workspace.scope = { kind: 'empty' }; pathname = '/aishodan'
  await render(Shell)
  assert.equal(document.querySelector('p')?.textContent, 'work', 'Modern shell must pass through empty root onboarding')
  await render(Legacy)
  assert.equal(document.querySelector('p')?.textContent, 'work', 'Legacy shell must pass through empty root onboarding')
  await React.act(async () => rootView.unmount()); dom.window.close()
  console.log('PASS 4 actual shell mounted cases: validated A in modern/legacy shell and empty root onboarding pass-through in both. Synthetic workspace proof.')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
