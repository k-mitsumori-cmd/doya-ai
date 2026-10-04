const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const planUtils = require('./load-typescript.cjs').load('src/lib/plan-utils.ts')

const accessFile = path.resolve(__dirname, '../../src/lib/adbanner/access.ts')
const accessSource = fs.readFileSync(accessFile, 'utf8')
const accessAst = ts.createSourceFile(accessFile, accessSource, ts.ScriptTarget.Latest, true)
let paidPredicate
function findPaid(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'isPaid') paidPredicate = node
  ts.forEachChild(node, findPaid)
}
findPaid(accessAst)
assert.ok(paidPredicate, 'AdBanner paid-tier predicate must exist')
const predicateJs = ts.transpileModule(`(${paidPredicate.getText(accessAst)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const isPaid = vm.runInNewContext(predicateJs)
for (const plan of ['LIGHT', 'PRO', 'ENTERPRISE', 'BUNDLE', 'STARTER']) assert.equal(isPaid(plan), true, plan)
for (const plan of [undefined, null, 'FREE', 'GUEST', 'unknown', 'NOT_PRO', 'APPROVED']) assert.equal(isPaid(plan), false, String(plan))

const empty = () => null
const container = ({ children }) => React.createElement('div', null, children)
const sidebar = new Proxy({
  SidebarShell: container,
  useSidebarState: () => ({ isCollapsed: false, showLabel: true, toggle() {} }),
}, { get: (target, key) => key in target ? target[key] : empty })

function render(file, user, isMobile) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/components', file), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText
  const session = user ? { user } : null
  const mocks = {
    react: React,
    'next/link': ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
    'next/navigation': { usePathname: () => '/' },
    'next-auth/react': { useSession: () => ({ data: session, status: user ? 'authenticated' : 'unauthenticated' }), signOut() {} },
    'lucide-react': new Proxy({}, { get: () => empty }),
    '@/components/TrialCallout': { TrialInlineSuffix: () => React.createElement('span', null, 'TRIAL_MARKER') },
    '@/components/sidebar/themes': { adbannerTheme: {}, copyTheme: {} },
    '@/components/sidebar': sidebar,
    '@/components/ToolSwitcherMenu': { ToolSwitcherMenu: empty },
    '@/lib/plan-utils': planUtils,
  }
  const exports = {}
  vm.runInNewContext(compiled, { exports, React, require: (name) => {
    if (name in mocks) return mocks[name]
    throw new Error(`Unexpected import: ${name}`)
  } })
  return renderToStaticMarkup(React.createElement(exports.default, { isMobile }))
}

for (const isMobile of [false, true]) {
  for (const plan of [null, 'FREE', 'LIGHT', 'PRO', 'ENTERPRISE', 'BUNDLE']) {
    const user = plan ? { plan } : null
    const ad = render('adbanner/AdBannerSidebar.tsx', user, isMobile)
    const copy = render('CopySidebar.tsx', user && { ...user, copyPlan: 'FREE' }, isMobile)
    const expected = plan === 'BUNDLE' ? 'PRO' : plan || 'GUEST'
    for (const [html, service] of [[ad, 'adbanner'], [copy, 'copy']]) {
      assert.ok(html.includes(expected === 'GUEST' ? '現在：ゲスト' : `現在：${expected}`))
      assert.ok(html.includes(`href="/${service}/pricing"`))
      if (expected === 'PRO' || expected === 'ENTERPRISE') {
        assert.ok(html.includes('プランを確認する'))
        assert.ok(!html.includes('プロにアップグレード'))
        assert.ok(!html.includes('TRIAL_MARKER'))
      } else if (service === 'adbanner' && expected === 'LIGHT') {
        assert.ok(html.includes('ライトプランで1日60枚'))
        assert.ok(html.includes('全サービスのプランを確認する'))
        assert.ok(!html.includes('プロにアップグレード'))
        assert.ok(!html.includes('TRIAL_MARKER'))
      } else {
        assert.ok(html.includes('プロにアップグレード'))
        assert.ok(html.includes('TRIAL_MARKER'))
      }
    }
    if (plan === 'LIGHT') assert.ok(!ad.includes('現在：FREE'))
  }
  const legacyPaidCopy = render('CopySidebar.tsx', { plan: 'FREE', copyPlan: 'PRO' }, isMobile)
  assert.ok(legacyPaidCopy.includes('現在：PRO'))
  assert.ok(!legacyPaidCopy.includes('プロにアップグレード'))
}
console.log('PASS adbanner and copy plan CTAs: guest, free, light, pro, enterprise, aliases, and stale service plans')
