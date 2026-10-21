// Actual navigation components mounted with synthetic state. No network or writes.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { JSDOM } = require('jsdom')
const { createRoot } = require('react-dom/client')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '../..')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/home' })
global.window = dom.window
global.document = dom.window.document
global.IS_REACT_ACT_ENVIRONMENT = true
global.fetch = async () => { throw Error('Network forbidden') }
const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
const no = () => null
const Wrap = ({ children }) => React.createElement(React.Fragment, null, children)
const MockButton = ({ href, children, ...props }) => href ? React.createElement(Link, { href, ...props }, children) : React.createElement('button', props, children)
let uiNext = false
let sessionStatus = 'unauthenticated'
let sessionData = null
const serviceRows = [
  { id: 'hr', name: 'ドヤHR', href: '/hr', dashboardHref: '/hr/dashboard', pricing: { free: { limit: '5' }, pro: { limit: '100' } } },
  { id: 'kintai', name: 'ドヤ勤怠', href: '/kintai', dashboardHref: '/kintai/dashboard', pricing: { free: { limit: '5' }, pro: { limit: '100' } } },
  { id: 'doyaslide', name: 'ドヤスライド', href: '/doyaslide', dashboardHref: '/doyaslide/new', pricing: { free: { limit: '5' }, pro: { limit: '100' } } },
]
const mocks = {
  'next/link': { __esModule: true, default: Link },
  'next/image': { __esModule: true, default: props => React.createElement('img', { ...props, unoptimized: undefined }) },
  'next/navigation': { useParams: () => ({ token: 'private-invite-token' }), useRouter: () => ({ push: () => {} }), usePathname: () => window.location.pathname, notFound: () => { throw Error('Unexpected notFound') } },
  'next-auth': { getServerSession: async () => null },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma: new Proxy({}, { get: () => { throw Error('DB forbidden') } }) },
  '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
  '@/lib/seoAccess': { canUseSeoImages: () => false, isTrialActive: () => ({ active: false }), normalizeSeoPlan: () => 'FREE' },
  'next-auth/react': { useSession: () => ({ status: sessionStatus, data: sessionData }) },
  'lucide-react': new Proxy({}, { get: (_, key) => key === '__esModule' ? false : no }),
  '@/components/shell/ui-next-context': { useUiNext: () => uiNext },
  '@/components/kintai/ui-next': { useToolUiNext: () => uiNext, PageTitle: Wrap },
  '@/components/kintai/KintaiAccessContext': { useKintaiAccess: () => ({ isActive: true }) },
  '@/components/hr/HrOrganizationScope': { useOptionalHrOrganizationRequest: () => null },
  '@/components/UnifiedPricingPlans': { UnifiedPricingPlans: no },
  '@/components/RuntimeErrorReporter': { reportBrowserError: () => {} },
  'framer-motion': { motion: { div: Wrap } },
  '@/components/ds': { Button: MockButton, EmptyState: ({ action }) => React.createElement('div', null, action), ErrorNotice: ({ onRetry, retryLabel }) => React.createElement('button', { onClick: onRetry }, retryLabel), Skeleton: no, Badge: no, StatTile: no, ToolHero: no },
  '@/components/ds/feedback': { ErrorNotice: ({ onRetry, retryLabel }) => React.createElement('button', { onClick: onRetry }, retryLabel) },
  '@/components/ds/motion': { CountUp: no, Stagger: Wrap, StaggerItem: Wrap },
  '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://example.invalid/support', ENTERPRISE_CONTACT_MAILTO: 'mailto:support@example.invalid' },
  '@/lib/kintai/format': { formatMinutesJa: () => '' },
  '@/lib/use-invitation-recovery': { useInvitationRecovery: () => ({ state: 'error', error: '招待を確認できません', accountAction: 'switch', busy: false, sessionStatus: 'authenticated', signInOrSwitch: () => {}, verifyAgain: () => {} }) },
  '@/components/CheckoutButton': { CheckoutButton: no },
  '@/components/TrialCallout': { TrialBadge: no, TrialNote: no, useTrialEligible: () => false },
  '@/components/shell/icons': { ShellIcon: no },
  '@/components/shell/tools': { ALL_SHELL_TOOLS: serviceRows.map(s => ({ id: s.id, stage: 'test', icon: 'test' })), shellGroups: () => [{ label: 'テスト', tools: serviceRows.map(s => ({ id: s.id, stage: 'test' })) }] },
  '@/hooks/useBillingPlanResync': { useBillingPlanResync: () => ({ run: () => {}, busy: false, disabled: false, message: '' }) },
  '@/lib/plan-utils': { higherPlan: (_, plan) => plan },
  '@/lib/services': { getPublicServices: () => serviceRows },
  '@/lib/unified-plan': { isPaidPlan: () => false, UNIFIED_PLAN_COPY: {}, UNIFIED_PRO_PLAN_ID: 'synthetic', UNIFIED_PRO_PRICE_LABEL: 'synthetic' },
}
const cache = new Map()
function load(relative) {
  const file = path.join(root, relative)
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file); mod.filename = file; cache.set(file, mod)
  mod.require = id => {
    if (mocks[id]) return mocks[id]
    if (id.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    if (id.startsWith('@/')) {
      const base = path.join(root, 'src', id.slice(2))
      for (const ext of ['.ts', '.tsx']) if (fs.existsSync(base + ext)) return load(path.relative(root, base + ext))
    }
    return require(id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
  return mod.exports
}
async function mount(Component, props, check) {
  const node = document.getElementById('root'), instance = createRoot(node)
  try { await React.act(async () => { instance.render(React.createElement(Component, props)); await new Promise(resolve => setImmediate(resolve)) }); await check(node) }
  finally { await React.act(async () => instance.unmount()) }
}
function link(node, label, href) { const anchor = [...node.querySelectorAll('a')].find(a => a.textContent.includes(label)); assert.ok(anchor, label); assert.equal(anchor.getAttribute('href'), href, label) }
async function main() {
  let passed = 0
  for (const next of [false, true]) {
    uiNext = next
    const slideError = load('src/app/(shell)/doyaslide/error.tsx').default
    await mount(slideError, { error: Error('synthetic'), reset: () => {} }, node => { link(node, 'プロジェクト一覧へ', '/doyaslide/projects'); passed++ })
    const slideNotFound = load('src/app/(shell)/doyaslide/not-found.tsx').default
    await mount(slideNotFound, {}, node => { link(node, 'プロジェクト一覧へ', '/doyaslide/projects'); passed++ })
  }
  uiNext = false
  await mount(load('src/app/(shell)/kintai/error.tsx').default, { error: Error('synthetic'), reset: () => {} }, node => { link(node, '勤怠ダッシュボードへ', '/kintai/dashboard'); passed++ })
  await mount(load('src/app/(shell)/kintai/dashboard/error.tsx').default, { error: Error('synthetic'), reset: () => {} }, node => { link(node, '勤怠ダッシュボードへ', '/kintai/dashboard'); link(node, 'ツールのホームへ', '/home'); passed++ })
  await mount(load('src/app/(shell)/kintai/invite/[token]/page.tsx').default, {}, node => { link(node, '勤怠を開く', '/kintai/dashboard'); assert.ok(node.textContent.includes('別のアカウントでログイン')); passed++ })
  const priorFetch = global.fetch
  global.fetch = async () => new Response(JSON.stringify({ error: 'synthetic outage' }), { status: 503 })
  for (const next of [false, true]) {
    uiNext = next
    await mount(load('src/app/(shell)/kintai/dashboard/page.tsx').default, {}, node => { link(node, 'ツールのホームへ', '/home'); if (!next) link(node, '勤怠ダッシュボードへ', '/kintai/dashboard'); passed++ })
  }
  global.fetch = priorFetch
  sessionStatus = 'authenticated'; sessionData = { user: { id: 'synthetic-actor' } }
  global.fetch = async () => new Response(null, { status: 401 })
  await mount(load('src/app/(shell)/hr/pricing/page.tsx').default, {}, node => { link(node, 'ドヤHRで設定状況を確認する', '/hr/dashboard'); assert.ok(!node.textContent.includes('組織のプランを確認できませんでした')); passed++ })
  global.fetch = priorFetch; sessionStatus = 'unauthenticated'; sessionData = null
  uiNext = false
  await mount(load('src/components/pricing/PricingNext.tsx').default, { canceled: false }, node => { for (const service of serviceRows) link(node, service.name, service.dashboardHref); passed++ })
  const SeoImage = load('src/app/(shell)/seo/images/[id]/page.tsx').default
  const seoMarkup = renderToStaticMarkup(await SeoImage({ params: Promise.resolve({ id: 'private image?id=1' }) }))
  const seoDom = new JSDOM(seoMarkup)
  const seoLogin = [...seoDom.window.document.querySelectorAll('a')].find(a => a.textContent.includes('ログインする'))
  assert.ok(seoLogin)
  assert.equal(new URL(seoLogin.href, 'https://example.invalid').searchParams.get('callbackUrl'), '/seo/images/private%20image%3Fid%3D1')
  passed++
  const ReturnLink = load('src/components/SignInReturnLink.tsx').default
  window.history.replaceState({}, '', '/hr/settings?tab=people#top')
  const handlers = { context: 0, auxiliary: 0, click: 0 }
  await mount(ReturnLink, { fallback: '/hr/dashboard', children: '再ログイン', onContextMenu: () => handlers.context++, onAuxClick: () => handlers.auxiliary++, onClick: () => handlers.click++ }, async node => {
    const anchor = node.querySelector('a')
    assert.equal(new URL(anchor.href).searchParams.get('callbackUrl'), '/hr/settings?tab=people#top')
    window.history.replaceState({}, '', '/hr/settings?tab=contracts#details')
    anchor.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true }))
    assert.equal(new URL(anchor.href).searchParams.get('callbackUrl'), '/hr/settings?tab=contracts#details')
    window.history.replaceState({}, '', '/hr/settings?tab=owners#latest')
    anchor.dispatchEvent(new window.MouseEvent('auxclick', { bubbles: true, button: 1 }))
    assert.equal(new URL(anchor.href).searchParams.get('callbackUrl'), '/hr/settings?tab=owners#latest')
    window.history.replaceState({}, '', '/hr/settings?tab=work#resume')
    anchor.dispatchEvent(new window.MouseEvent('click', { bubbles: true, ctrlKey: true }))
    assert.equal(new URL(anchor.href).searchParams.get('callbackUrl'), '/hr/settings?tab=work#resume')
    assert.deepEqual(handlers, { context: 1, auxiliary: 1, click: 1 })
    passed++
  })
  console.log(JSON.stringify({ passed, scope: 'Actual mounted slide legacy/next errors, Kintai legacy/next errors and invite, HR no-org pricing, dynamic pricing rows, and return-link activation; synthetic state and zero external network.' }))
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => dom.window.close())
