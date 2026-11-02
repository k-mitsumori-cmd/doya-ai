const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const root = path.resolve(__dirname, '../..')
let isActive = false
const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
const mocks = {
  react: React,
  'react/jsx-runtime': require('react/jsx-runtime'),
  'next/link': { __esModule: true, default: Link },
  'next/navigation': { useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/kintai/dashboard' },
  'lucide-react': require('lucide-react'),
  '@/lib/kintai/access-client': { hasMinRole: () => false },
  '@/components/ToolSwitcherMenu': { ToolSwitcherMenu: () => null },
  '@/components/kintai/KintaiAccessContext': { useKintaiAccess: () => ({ isActive }) },
  '@/lib/kintai/types': { CLOCK_TYPE_LABELS: {}, REQUEST_TYPE_LABELS: {}, REQUEST_STATUS_LABELS: {} },
  '@/lib/kintai/format': { formatMinutesJa: () => '0分' },
  '@/lib/kintai/load-requests': { appendKintaiRequestPage: () => [], fetchKintaiRequestPage: async () => ({}) },
  // 共通の枠の中（新しい見た目）。ページの見出しは ToolFrame の h1 の下の h2
  '@/components/kintai/ui-next': { useToolUiNext: () => true, PageTitle: ({ className, children }) => React.createElement('h2', { className }, children) },
  '@/components/ds': { Button: () => null, EmptyState: () => null, Skeleton: () => null },
  // UX 点検の直し（FIX-PLAN 17・18）で足した依存。ここでは描画だけを確かめるので、ダイアログは呼ばれない
  '@/components/ds/dialog': { confirmDialog: async () => false, alertDialog: async () => {} },
  '@/lib/kintai/user-error': { userErrorMessage: (_raw, fallback) => fallback, KINTAI_NETWORK_ERROR: '通信できませんでした。' },
  '@/lib/kintai/use-escape': { useEscapeToClose: () => {} },
}

// Render the real extracted clock hook during SSR; effects remain unexecuted here.
const loadTs = require('./load-typescript.cjs').load
mocks['@/lib/kintai/use-clock'] = loadTs('src/lib/kintai/use-clock.ts', {
  react: React,
  './types': mocks['@/lib/kintai/types'],
  './clock-response': loadTs('src/lib/kintai/clock-response.ts'),
  './user-error': mocks['@/lib/kintai/user-error'],
}, { setTimeout, clearTimeout, AbortController })

function moduleOf(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, require: name => {
    if (name in mocks) return mocks[name]
    throw Error(`Unmocked import: ${name}`)
  }, Date, URL, console, setTimeout, clearTimeout }, { filename: file })
  return exports
}
function page(file) { return moduleOf(file).default }

mocks['@/lib/error-report-input'] = loadTs('src/lib/error-report-input.ts')
mocks['@/lib/pricing'] = { SUPPORT_CONTACT_URL: 'https://support.synthetic.invalid/contact' }
mocks['@/components/ds/kun-src'] = loadTs('src/components/ds/kun-src.ts')
mocks['@/components/common/ErrorReportForm'] = moduleOf('src/components/common/ErrorReportForm.tsx')

const requests = page('src/app/(shell)/kintai/requests/page.tsx')
const newRequest = page('src/app/(shell)/kintai/requests/new/page.tsx')
const clock = page('src/app/(shell)/kintai/clock/page.tsx')
// 打刻のタブは共通の枠のナビ（src/lib/kintai/nav.ts。KintaiShellFrame が ToolFrame に渡す）で出し分ける
const { buildKintaiNav } = require('./load-typescript.cjs').load('src/lib/kintai/nav.ts', { '@/lib/kintai/access-client': { hasMinRole: () => false } })
const navHrefs = employeeActive => buildKintaiNav('employee', employeeActive).map(item => item.href)

const render = Component => renderToStaticMarkup(React.createElement(Component))
isActive = false
const inactiveRequests = render(requests)
assert.doesNotMatch(inactiveRequests, /href="\/kintai\/requests\/new"/)
assert.match(inactiveRequests, /申請一覧/)
assert.match(render(newRequest), /新規申請は利用できません/)
const inactiveClock = render(clock)
assert.match(inactiveClock, /打刻は利用できません/)
assert.match(inactiveClock, /href="\/kintai\/attendance"/)
assert.doesNotMatch(inactiveClock, /出勤する/)
assert.ok(!navHrefs(false).includes('/kintai/clock'))
assert.ok(navHrefs(false).includes('/kintai/attendance'))

isActive = true
assert.match(render(requests), /href="\/kintai\/requests\/new"/)
assert.doesNotMatch(render(newRequest), /新規申請は利用できません/)
assert.ok(navHrefs(true).includes('/kintai/clock'))
console.log('Kintai disabled pages: PASS')
