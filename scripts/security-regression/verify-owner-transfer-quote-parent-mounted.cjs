// Actual Quote boundary, Settings parent and owner-transfer Panel/hook/client; synthetic reads and HTTP only.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const React = req('react'), ts = req('typescript'), { JSDOM } = req('jsdom')
const { createRoot } = req('react-dom/client')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/quote/settings?org=A' })
global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator
global.crypto = require('node:crypto').webcrypto; global.IS_REACT_ACT_ENVIRONMENT = true
window.confirm = () => true
window.navigator.locks = { request: async (_name, _options, work) => work() }
let authStatus = 'authenticated', actor = 'actor-A', readCount = 0, postCount = 0
let role = 'owner', requests = [], workspaceReads = []
const router = { push() {}, replace() {} }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const org = currentRole => ({ id: 'orgA', slug: 'A', name: 'Org A', role: currentRole })
const workspace = () => ({ service: 'quote', actorId: actor, memberships: [org(role)], current: org(role) })
const fetch = async (url, init = {}) => {
  requests.push({ url: String(url), method: init.method || 'GET' })
  const parsed = new URL(String(url), 'https://example.invalid'), action = parsed.searchParams.get('action')
  if (action === 'candidates') return Response.json({ actorId: actor, service: 'quote', organization: { id: 'orgA', slug: 'A', name: 'Org A' },
    owner: { memberId: 'owner', userId: actor }, candidates: [{ memberId: 'successor', userId: 'user-B', name: '後任', role: 'member', plan: 'LIGHT' }] })
  if (action === 'status') return Response.json({ actorId: actor, service: 'quote', organizationId: 'orgA',
    operationId: parsed.searchParams.get('operationId'), phase: 'committed', input: { expectedOwnerMemberId: 'owner',
      targetMemberId: 'successor', targetUserId: 'user-B', targetRole: 'member', targetPlan: 'LIGHT' }, createdAt: new Date().toISOString() })
  if (init.method === 'POST') {
    const body = JSON.parse(init.body); assert.equal(body.action, 'transfer'); postCount++; role = 'admin'
    return Response.json({ actorId: actor, service: 'quote', organizationId: 'orgA', operationId: body.operationId,
      phase: 'committed', input: body.input, createdAt: new Date().toISOString() })
  }
  throw Error('Unexpected ' + url)
}
global.fetch = fetch
const Null = () => null
const leaves = require('./caller14-leaf-bridge.cjs')(root, React, ts)
const mocks = {
  react: React, 'react/jsx-runtime': req('react/jsx-runtime'),
  'next-auth/react': { useSession: () => ({ status: authStatus, data: { user: { id: actor } } }) },
  'next/navigation': { usePathname: () => '/quote/settings', useSearchParams: () => new URLSearchParams('org=A'), useRouter: () => router },
  'next/link': { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { ...props, href }, children) },
  '@/components/org/OrgSwitcher': { getSelectedOrg: () => 'A', selectOrganization() {} },
  '@/lib/ui/guest-path': { isGuestPath: () => false },
  '@/lib/organization-workspace-client': { readOrganizationWorkspace: () => {
    const held = deferred(); workspaceReads.push(held); readCount++; return held.promise
  }, selectedWorkspaceFromUrl: () => ({ kind: 'selected', slug: 'A' }), WorkspaceReadError: class WorkspaceReadError extends Error {} },
  '@/components/CheckoutRecoveryProvider': { useCheckoutRecovery: () => ({ manager: { inspectStored() {} }, snapshot: { phase: 'idle', handle: null } }) },
  '@/lib/checkout-recovery-client': { checkoutStoredIntent: () => null },
  '@/components/quote/QuoteOrgSwitcher': { __esModule: true, default: Null },
  '@/components/org/MemberPanel': { __esModule: true, default: () => React.createElement('div', { 'data-member-pending': 'yes' }, 'member pending') },
  '@/components/quote/QuotePageHeading': { __esModule: true, default: ({ children }) => React.createElement('h1', null, children) },
  '@/components/shell/ui-next-context': { useUiNext: () => false },
  '@/components/lp': { DoyaKun: Null }, '@/components/LoadingProgress': { __esModule: true, default: Null },
  '@/components/EmptyState': { EmptyState: Null }, '@/components/sidebar/themes': { quoteTheme: {} },
  '@/components/ToolSwitcherMenu': { ToolSwitcherMenu: Null },
  '@/components/sidebar': { SidebarUsagePanel: Null, useSidebarState: () => ({ isCollapsed: false, showLabel: true, toggle() {} }), SidebarShell: ({ children }) => children },
  '@/lib/ui/notify': { notifyError: (_setter, _message) => {} },
  '@/components/ds': leaves.ds,
}
const cache = new Map()
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports
  const filename = path.join(root, relative), module = new Module(filename)
  cache.set(relative, module)
  module.require = id => {
    if (id in mocks) return mocks[id]
    if (id === '@/components/quote/error-copy') return load('src/components/quote/error-copy.ts')
    if (id === '@/components/quote/QuoteWorkspaceBoundary') return load('src/components/quote/QuoteWorkspaceBoundary.tsx')
    if (id === '@/components/org/OwnerTransferPanel') return load('src/components/org/OwnerTransferPanel.tsx')
    if (id === '@/lib/use-owner-transfer') return load('src/lib/use-owner-transfer.ts')
    if (id === '@/lib/owner-transfer-client' || id === './owner-transfer-client') return load('src/lib/owner-transfer-client.ts')
    if (id === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    if (id === '@/lib/quote/checkout-origin-hint') return load('src/lib/quote/checkout-origin-hint.ts')
    if (id === '@/lib/quote/use-issuer-settings') return { useQuoteIssuerSettings: () => {
      const [draft, setDraft] = React.useState('original'); return { form: { companyName: draft }, loading: false, loaded: true,
        saving: false, error: null, message: null, unknown: false, canEdit: true, hasUnsavedChanges: draft !== 'original',
        update: (_field, value) => setDraft(value), load() {}, save() {} }
    } }
    throw Error('Unmocked ' + id)
  }
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return module.exports
}
const Boundary = load('src/components/quote/QuoteWorkspaceBoundary.tsx').QuoteWorkspaceBoundary
const Settings = load('src/app/(shell)/quote/settings/page.tsx').default
const view = createRoot(document.getElementById('root'))
const flush = async () => { for (let i = 0; i < 5; i++) await React.act(async () => { await new Promise(setImmediate) }) }
const settle = async (index, value) => { await React.act(async () => { workspaceReads[index].resolve(value); await new Promise(setImmediate) }); await flush() }
const button = label => [...document.querySelectorAll('button')].find(item => item.textContent.includes(label))
;(async () => {
  await React.act(async () => view.render(React.createElement(Boundary, null, React.createElement(Settings))))
  await settle(0, workspace())
  const input = document.querySelector('input[placeholder="株式会社スリスタ"]')
  assert(input)
  await React.act(async () => { input[Object.keys(input).find(key => key.startsWith('__reactProps'))].onChange({ target: { value: 'dirty issuer' } }) })
  assert.equal(input.value, 'dirty issuer')
  const retainedMember = document.querySelector('[data-member-pending]')
  await flush()
  assert(button('この方へ引き継ぐ'))
  await React.act(async () => button('この方へ引き継ぐ').click())
  await flush()
  assert.equal(postCount, 1)
  assert.equal(readCount, 2, 'receipt causes one fresh workspace read')
  assert.equal(document.querySelector('input[placeholder="株式会社スリスタ"]').value, 'dirty issuer')
  assert(document.querySelector('[data-member-pending]'), 'member subtree remains mounted during retry')
  assert.equal(document.querySelector('[data-member-pending]'), retainedMember, 'pending member node is not remounted')
  assert(document.querySelector('[data-member-pending]').closest('[hidden]'), 'old owner subtree is hidden until fresh role read')
  assert.equal(window.localStorage.length, 1, 'durable handle remains while role refresh is pending')
  await settle(1, Promise.reject(new Error('synthetic workspace read unavailable')))
  assert(document.querySelector('[data-member-pending]').closest('[hidden]'), 'failed read never exposes stale owner actions')
  assert(button('再読み込みする'), 'failed current-role read offers explicit retry')
  await React.act(async () => button('再読み込みする').click()); await flush()
  assert.equal(readCount, 3)
  await settle(2, workspace())
  assert.equal(document.querySelector('input[placeholder="株式会社スリスタ"]').value, 'dirty issuer')
  assert(document.querySelector('[data-member-pending]'))
  assert.equal(document.querySelector('[data-member-pending]'), retainedMember)
  assert.equal(button('この方へ引き継ぐ'), undefined, 'fresh admin role masks owner action')
  assert(button('引継ぎ状況を確認'), 'same saved operation is restored after proof revision')
  await React.act(async () => button('引継ぎ状況を確認').click()); await flush()
  assert.equal(postCount, 1, 'status replay creates no operation')
  assert.equal(readCount, 3, 'same receipt does not loop role reads')
  assert.equal(window.localStorage.length, 1)
  await React.act(async () => view.unmount())
  dom.window.close()
  console.log('owner transfer Quote actual Boundary+Settings+Panel: retained dirty draft, pending member subtree, hidden old role, fresh admin, same durable status, POST1 PASS')
})().catch(error => { console.error(error); process.exitCode = 1; dom.window.close() })
