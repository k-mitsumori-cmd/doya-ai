// Actual scan dashboard mounted with the real AioApiError class. Membership, HTTP and chart leaves are synthetic.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const React = require(path.join(process.cwd(), 'node_modules/react'))
const ts = require(path.join(process.cwd(), 'node_modules/typescript'))
const { JSDOM } = require(path.join(process.cwd(), 'node_modules/jsdom'))
const { createRoot } = require(path.join(process.cwd(), 'node_modules/react-dom/client'))
const { createOrgClient } = require('./org-client-test-loader.cjs')

const dom = new JSDOM('<body></body>', { url: 'https://example.invalid/aio/alpha' })
global.window = dom.window
global.document = dom.window.document
global.IS_REACT_ACT_ENVIRONMENT = true
const { AioApiError } = createOrgClient('aio').client
const contactUrl = 'https://example.invalid/contact'
const pageSource = process.env.AIO_PAGE_SOURCE || path.join(process.cwd(), 'src/app/(shell)/aio/[orgSlug]/page.tsx')
const links = []
let plan = 'PRO', owner = true, quota = null, sends = 0
const empty = () => null
const Link = ({ href, children, ...props }) => { links.push(href); return React.createElement('a', { href, ...props }, children) }
const mocks = {
  react: React,
  'react/jsx-runtime': require(path.join(process.cwd(), 'node_modules/react/jsx-runtime')),
  'next/navigation': { useParams: () => ({ orgSlug: 'alpha' }), useSearchParams: () => new URLSearchParams() },
  'next/link': { __esModule: true, default: Link },
  '@/lib/aio/dashboard': { readAioDashboard: async () => ({ plan, isOwner: owner, profile: { brandName: 'Alpha' }, prompts: [{ text: 'Alpha question' }], items: [], lastFailed: false, latest: null, prev: null, summary: null }) },
  '@/lib/aio/client': { AioApiError, aioSend: async () => { sends++; throw new AioApiError('利用枠に達しました', 402, 'LIMIT', quota.canManageBilling, quota.upgradeUrl || null, quota.contactUrl || null) } },
  '@/components/TrialCallout': { TrialNote: empty },
  '@/lib/pricing': { HIGH_USAGE_CONTACT_URL: contactUrl },
  '@/lib/aio/types': { AIO_MAX_PROMPTS_PER_SCAN: 30, ENGINE_LABEL: {} },
  '@/lib/aio/coverage': { isCompleteScan: () => true },
  '@/components/aio/ui': { DoyaKun: empty, sym: () => null },
  'react-hot-toast': { __esModule: true, default: { loading() {}, success() {}, error() {} } },
  '@/components/ds': { EmptyState: empty },
  '@/components/icons': { UiIcon: empty },
  'recharts': Object.fromEntries(['LineChart', 'Line', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'ResponsiveContainer', 'BarChart', 'Bar', 'Cell'].map(name => [name, empty])),
  '@/components/shell/ui-next-context': { useUiNext: () => false },
}
const pageExports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(pageSource, 'utf8'), { fileName: pageSource, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
  { exports: pageExports, require: name => { assert.ok(name in mocks, `Unmocked ${name}`); return mocks[name] }, window, document, Event: window.Event, URLSearchParams, console, setInterval, clearInterval }, { filename: pageSource })
const Page = pageExports.default
const act = fn => React.act(async () => { await fn(); for (let i = 0; i < 8; i++) await new Promise(setImmediate) })
const props = element => element[Object.keys(element).find(key => key.startsWith('__reactProps$'))]
const checks = []
async function check(name, currentPlan, isOwner, server, expected) {
  plan = currentPlan; owner = isOwner; quota = server; sends = 0; links.length = 0
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  try {
    await act(() => root.render(React.createElement(Page)))
    const button = [...container.querySelectorAll('button')].find(x => x.textContent.includes('スキャン実行'))
    assert.ok(button, 'actual scan button')
    await act(() => props(button).onClick())
    assert.equal(sends, 1)
    assert.match(container.textContent, /スキャンの利用枠に達しました/)
    const upgrade = [...container.querySelectorAll('a')].find(x => x.textContent.includes('料金プランを確認する'))
    const contact = [...container.querySelectorAll('a')].find(x => x.textContent.includes('追加枠について相談する'))
    assert.equal(upgrade?.getAttribute('href') || null, expected.upgrade || null, name + ' upgrade')
    assert.equal(contact?.getAttribute('href') || null, expected.contact || null, name + ' contact')
    checks.push(name)
  } finally { await act(() => root.unmount()); container.remove() }
}
(async () => {
  await check('stale local PRO yields to current FREE owner upgrade', 'PRO', true, { canManageBilling: true, upgradeUrl: '/aio/pricing?org=alpha' }, { upgrade: '/aio/pricing?org=alpha' })
  await check('stale local FREE yields to current paid contact', 'FREE', true, { canManageBilling: true, contactUrl }, { contact: contactUrl })
  await check('nonowner has no purchase action', 'FREE', false, { canManageBilling: false }, {})
  await check('server-confirmed upgrade overrides stale local nonowner display', 'PRO', false, { canManageBilling: true, upgradeUrl: '/aio/pricing?org=alpha' }, { upgrade: '/aio/pricing?org=alpha' })
  await check('server-denied billing overrides stale local owner display', 'FREE', true, { canManageBilling: false, upgradeUrl: '/aio/pricing?org=alpha' }, {})
  await check('missing server action cannot be invented from local FREE', 'FREE', true, { canManageBilling: true }, {})
  await check('conflicting server destinations cannot become a purchase action', 'FREE', true, { canManageBilling: true, upgradeUrl: '/aio/pricing?org=alpha', contactUrl }, {})
  for (const upgradeUrl of ['/aio/pricing', '/aio/pricing?org=beta', '/aio/pricing?org=alpha&org=beta', 'https://example.invalid/aio/pricing?org=alpha']) {
    await check('invalid or foreign server upgrade ' + upgradeUrl, 'FREE', true, { canManageBilling: true, upgradeUrl }, {})
  }
  console.log(JSON.stringify({ passed: checks.length, checks, scope: 'Mounted actual scan page with actual AioApiError; synthetic dashboard read, HTTP quota response and chart leaves. No actual auth, DB, provider or checkout.' }))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => dom.window.close())
