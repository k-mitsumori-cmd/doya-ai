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
}

function page(file) {
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
  return exports.default
}

const requests = page('src/app/kintai/requests/page.tsx')
const newRequest = page('src/app/kintai/requests/new/page.tsx')
const clock = page('src/app/kintai/clock/page.tsx')
const sidebar = page('src/components/kintai/KintaiSidebar.tsx')

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
const inactiveSidebar = renderToStaticMarkup(React.createElement(sidebar, { role: 'employee', employeeActive: false }))
assert.doesNotMatch(inactiveSidebar, /href="\/kintai\/clock"/)
assert.match(inactiveSidebar, /href="\/kintai\/attendance"/)

isActive = true
assert.match(render(requests), /href="\/kintai\/requests\/new"/)
assert.doesNotMatch(render(newRequest), /新規申請は利用できません/)
assert.match(renderToStaticMarkup(React.createElement(sidebar, { role: 'employee', employeeActive: true })), /href="\/kintai\/clock"/)
console.log('Kintai disabled pages: PASS')
