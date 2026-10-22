// Mounted real TenjikaiApp/ShellFrame/Sidebar/hook/view and frozen route/reader.
// Only auth, router, Prisma, legacy wizard children and browser transport are synthetic.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const React = require('react')
const { createRoot } = require('react-dom/client')
const { JSDOM } = require('jsdom')
const rootPath = path.resolve(__dirname, '../..')
const req = Module.createRequire(path.join(rootPath, 'package.json'))
const ts = req('typescript')
const engineModule = new Module(path.join(rootPath, 'src/lib/tenjikai/engine.ts'))
engineModule._compile(ts.transpileModule(fs.readFileSync(engineModule.id, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, engineModule.id)
const actualLabels = engineModule.exports
const { NextRequest } = req('next/server')
const dom = new JSDOM('<body></body>', { url: 'https://example.test/tenjikai' })
global.window = dom.window
global.document = dom.window.document
global.IS_REACT_ACT_ENVIRONMENT = true
const Session = React.createContext(null)
let active

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const wrap = ({ children }) => React.createElement('div', null, children)
const no = () => null
const motion = new Proxy({}, { get: (_, name) => ({ children, ...props }) => React.createElement(name,
  Object.fromEntries(Object.entries(props).filter(([key]) => !['initial', 'animate', 'exit', 'transition', 'layout', 'layoutId', 'whileHover'].includes(key))), children) })
const Link = ({ children, href, ...props }) => React.createElement('a', { ...props, href }, children)
const engine = {
  GOAL_LABEL: actualLabels.GOAL_LABEL,
  POSITION_LABEL: actualLabels.POSITION_LABEL,
  SAMPLE_INPUT: { eventName: 'SAMPLE_SENTINEL', goal: 'lead' },
  mockGeneratedPlan: () => { active.oldCalls.push('mockGeneratedPlan'); return { analysis: {}, boothCopy: null, creativeCopy: null } },
  generateBoothPlans: () => { active.oldCalls.push('generateBoothPlans'); return [{ variant: 'A' }] },
  applyBoothCopy: value => value,
  generateCreatives: () => { active.oldCalls.push('generateCreatives'); return [] },
  applyCreativeCopy: value => value,
  generateNovelties: () => { active.oldCalls.push('generateNovelties'); return [] },
  generateDeadlines: () => { active.oldCalls.push('generateDeadlines'); return [] },
  computeBudget: () => { active.oldCalls.push('computeBudget'); return {} },
  requestGeneratedPlan: async () => { active.oldCalls.push('requestGeneratedPlan'); throw Error('Generation forbidden') },
}
const prisma = new Proxy({}, { get: (_, model) => {
  assert.equal(model, 'tenjikaiProject')
  return new Proxy({}, { get: (_, method) => {
    assert.equal(method, 'findFirst', 'No child read or write')
    return async input => {
      active.dbCalls.push(input)
      return active.rows.find(row => row.id === input.where.id && row.userId === input.where.userId)?.value ?? null
    }
  } })
} })
const saved = (id, overrides = {}) => ({
  id, name: `PRIVATE_${id}`, serviceUrl: `https://saved.example/${id}`, venueId: null,
  eventName: '保存展示会', eventStart: new Date('2026-10-20T15:00:00Z'), eventDays: 2,
  komaCols: 3, komaRows: 2, boothWidthM: 3, boothDepthM: 2, boothPosition: '角小間',
  budgetYen: 123456, goal: '商談', staffCount: 2, status: 'done',
  createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-20T00:00:00Z'),
  analysis: { brand: `PRIVATE_BRAND_${id}`, category: '保存カテゴリ', headline: '保存見出し', subline: '保存補足',
    valueProps: [{ title: '保存訴求', body: '保存本文' }], targets: ['保存対象'],
    brandColors: { primary: '#111111', secondary: '#222222', accent: '#333333' }, tone: '丁寧', logoUrl: null },
  ...overrides,
})

const mocks = {
  react: React,
  'react/jsx-runtime': req('react/jsx-runtime'),
  'react-dom': req('react-dom'),
  'next/server': req('next/server'),
  'next/link': Link,
  'next/navigation': {
    usePathname: () => new URL(active.route, 'https://example.test').pathname,
    useSearchParams: () => new URLSearchParams(new URL(active.route, 'https://example.test').search),
    useRouter: () => active.router,
  },
  'next-auth/react': { useSession: () => React.useContext(Session), signOut: async () => {} },
  'next-auth': { getServerSession: async () => active.serverSession },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  // The mounted reader enters the actual workspace GET first. This fixture has
  // legacy-only rows, so the full workspace store has no saved record.
  '@/lib/tenjikai/workspace-store': { readFullTenjikaiWorkspace: async () => null },
  '@/lib/billing-response-client': { readBillingResponse: async () => { throw Error('Unexpected billing read') } },
  '@/lib/tenjikai/engine': engine,
  'framer-motion': { motion, AnimatePresence: wrap },
  'lucide-react': new Proxy({}, { get: () => no }),
  '@/components/sidebar/themes': { tenjikaiTheme: { navText: '', navTextIcon: '' } },
  '@/components/sidebar': {
    SidebarShell: wrap, SidebarLogoSection: no, SidebarSectionTitle: no, SidebarCollapseToggle: no,
    SidebarBrandingFooter: no, SidebarHelpContact: no, SidebarLogoutDialog: no,
    SidebarUserProfile: ({ loginCallbackUrl }) => React.createElement('a', { href: `/auth/signin?callbackUrl=${encodeURIComponent(loginCallbackUrl)}` }, 'プロフィールからログイン'),
    useSidebarState: () => ({ isCollapsed: false, showLabel: true, toggle: () => {} }),
  },
  '@/components/ToolSwitcherMenu': { ToolSwitcherMenu: no },
  '@/components/shell/tools': { ALL_SHELL_TOOLS: [{ id: 'tenjikai', name: 'ドヤ展示会' }], SHELL_HOME: { href: '/home', name: 'ホーム' } },
  '@/components/shell/icons': { ShellIcon: no, resolveShellIcon: () => no },
  '@/components/shell/ShellCompanyCard': { ShellCompanyTag: no },
  '@/components/shell/ui-next-context': { useUiNext: () => false },
  './tools': { ALL_SHELL_TOOLS: [{ id: 'tenjikai', name: 'ドヤ展示会' }], SHELL_HOME: { href: '/home', name: 'ホーム' } },
  './icons': { ShellIcon: no, resolveShellIcon: () => no },
  './ShellCompanyCard': { ShellCompanyTag: no },
  './ui-next-context': { useUiNext: () => false },
  '@/lib/tenjikai/tokens': { ds: { yellow: '#ff0' } },
  './Wizard': { __esModule: true, default: () => { active.oldCalls.push('Wizard'); return React.createElement('p', null, 'SAMPLE_SENTINEL') } },
  './Generating': { __esModule: true, default: no },
  './Overview': { __esModule: true, default: no },
  './BoothStudio': { __esModule: true, default: no },
  './CreativeStudio': { __esModule: true, default: no },
  './NoveltyPicker': { __esModule: true, default: no },
  './BudgetPlanner': { __esModule: true, default: no },
  './VendorBoard': { __esModule: true, default: no },
  './DocsVault': { __esModule: true, default: no },
}
const cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file).exports
  const mod = new Module(file)
  mod.filename = file
  mod.paths = Module._nodeModulePaths(path.dirname(file))
  cache.set(file, mod)
  mod.require = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (id.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    if (id.startsWith('@/') || id.startsWith('.')) {
      const stem = id.startsWith('@/') ? path.join(rootPath, 'src', id.slice(2)) : path.resolve(path.dirname(file), id)
      const found = ['.ts', '.tsx', '.js'].map(ext => stem + ext).find(fs.existsSync)
      assert.ok(found, `Unmocked source ${id}`)
      return load(found)
    }
    return req(id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, file)
  return mod.exports
}
const App = load(path.join(rootPath, 'src/components/tenjikai/TenjikaiApp.tsx')).default
const Shell = load(path.join(rootPath, 'src/components/tenjikai/TenjikaiShellFrame.tsx')).default
const routeGET = load(path.join(rootPath, 'src/app/api/tenjikai/projects/[id]/route.ts')).GET
const workspaceGET = load(path.join(rootPath, 'src/app/api/tenjikai/projects/[id]/workspace/route.ts')).GET

async function fixture({ route = '/tenjikai/overview?project=P', shell = false } = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  const oldFetch = global.fetch
  const f = {
    route, shell, container, root: createRoot(container), oldCalls: [], dbCalls: [], fetchCalls: [], workspaceCalls: [], legacyCalls: [], nav: [], checks: [],
    rows: [{ id: 'P', userId: 'A', value: saved('P') }, { id: 'P', userId: 'B', value: saved('P', { name: 'PRIVATE_B_P' }) }, { id: 'Q', userId: 'A', value: saved('Q') }, { id: 'Q', userId: 'B', value: saved('Q', { name: 'PRIVATE_B_Q' }) },
      { id: 'foreign', userId: 'B', value: saved('foreign') }],
    auth: { status: 'authenticated', data: { user: { id: 'A' } } },
    serverSession: { user: { id: 'A' } },
    router: null, setRoute: null, history: [route], historyIndex: 0,
  }
  f.router = {
    push: href => {
      f.nav.push({ method: 'push', href })
      f.history.splice(f.historyIndex + 1)
      f.history.push(href)
      f.historyIndex++
      f.route = href
      f.setRoute(href)
    },
    replace: href => {
      f.nav.push({ method: 'replace', href })
      f.history[f.historyIndex] = href
      f.route = href
      f.setRoute(href)
    },
  }
  f.defaultFetch = async (url, options) => {
    f.fetchCalls.push({ url, options })
    assert.equal(options.cache, 'no-store')
    const target = new URL(url, 'https://example.test')
    const workspace = target.pathname.endsWith('/workspace')
    const id = decodeURIComponent(target.pathname.split('/').at(workspace ? -2 : -1))
    assert.match(target.pathname, /^\/api\/tenjikai\/projects\/[A-Za-z0-9_-]+(?:\/workspace)?$/)
    ;(workspace ? f.workspaceCalls : f.legacyCalls).push({ url, options })
    return (workspace ? workspaceGET : routeGET)(new NextRequest(target), { params: Promise.resolve({ id }) })
  }
  f.fetcher = f.defaultFetch
  global.fetch = (...args) => f.fetcher(...args)
  function Driver() {
    const [, setRoute] = React.useState(f.route)
    f.setRoute = setRoute
    return React.createElement(f.shell ? Shell : App)
  }
  f.act = async fn => React.act(async () => { await fn?.(); await new Promise(resolve => setImmediate(resolve)) })
  f.render = async () => f.act(() => f.root.render(React.createElement(Session.Provider, { value: {
    data: f.auth.data, status: f.auth.status, update: f.update,
  } }, React.createElement(Driver))))
  f.update = () => { const check = deferred(); f.checks.push(check); return check.promise }
  f.navigate = async href => f.act(() => f.router.push(href))
  f.back = async () => f.act(() => {
    assert.ok(f.historyIndex > 0)
    f.route = f.history[--f.historyIndex]
    f.setRoute(f.route)
  })
  f.forward = async () => f.act(() => {
    assert.ok(f.historyIndex < f.history.length - 1)
    f.route = f.history[++f.historyIndex]
    f.setRoute(f.route)
  })
  f.changeAuth = async (id, status = 'authenticated') => {
    f.auth = { status, data: id ? { user: { id } } : null }
    await f.render()
  }
  f.switchScope = async (id, href) => f.act(() => {
    f.auth = { status: 'authenticated', data: { user: { id } } }
    f.serverSession = { user: { id } }
    f.router.push(href)
    f.root.render(React.createElement(Session.Provider, { value: {
      data: f.auth.data, status: f.auth.status, update: f.update,
    } }, React.createElement(Driver)))
  })
  f.text = () => f.container.textContent
  f.links = () => [...f.container.querySelectorAll('a[href]')].map(link => link.getAttribute('href'))
  f.click = async label => f.act(() => {
    const button = [...f.container.querySelectorAll('button')].find(item => item.textContent.includes(label))
    assert.ok(button, `Missing button ${label}`)
    button.click()
  })
  let closed = false
  f.close = async () => {
    if (closed) return
    closed = true
    await f.act(() => f.root.unmount())
    global.fetch = oldFetch
    f.container.remove()
  }
  active = f
  await f.render()
  return f
}

test('Tenjikai saved project actual mounted boundary', async t => {
  const check = async (name, options, run) => t.test(name, async () => {
    const f = await fixture(options)
    try { await run(f) } finally { await f.close() }
  })
  await check('no project keeps legacy wizard and makes no detail GET', { route: '/tenjikai' }, async f => {
    assert.match(f.text(), /SAMPLE_SENTINEL/)
    assert.ok(f.oldCalls.includes('mockGeneratedPlan'))
    assert.equal(f.fetchCalls.length, 0)
  })
  await check('real route and reader deliver owner partial DTO; saved mode runs no legacy calculations', {}, async f => {
    assert.match(f.text(), /PRIVATE_P/)
    assert.match(f.text(), /PRIVATE_BRAND_P/)
    assert.match(f.text(), /2026-10-21/)
    assert.match(f.text(), /123,456円/)
    assert.match(f.text(), /会場情報は確認できません/)
    assert.match(f.text(), /ブース案・制作物・ノベルティ・予算内訳・資料・締切は、この画面では確認できません/)
    assert.deepEqual(f.oldCalls, [])
    assert.equal(f.workspaceCalls.length, 1, 'workspace GET must precede the legacy partial detail')
    assert.equal(f.legacyCalls.length, 1, 'partial workspace must continue to the legacy detail GET')
    assert.match(f.workspaceCalls[0].url, /\/P\/workspace\?expectedActor=A$/)
    assert.match(f.legacyCalls[0].url, /\/P\?expectedActor=A$/)
    assert.deepEqual(f.dbCalls[0].where, { id: 'P', userId: 'A' })
    for (const section of ['booth', 'creatives', 'novelty', 'budget', 'vendors', 'docs', 'overview']) {
      await f.navigate(`/tenjikai/${section}?project=P`)
      assert.match(f.text(), /PRIVATE_P/)
      assert.deepEqual(f.oldCalls, [], `legacy calculation on ${section}`)
    }
  })
  await check('known goal and booth position use actual Japanese labels; unknown is not inferred', {}, async f => {
    for (const [goal, label] of Object.entries(actualLabels.GOAL_LABEL)) {
      f.rows.find(row => row.id === 'P' && row.userId === 'A').value = saved('P', { goal })
      await f.click('再読み込み')
      assert.ok(f.text().includes(label))
    }
    for (const [boothPosition, label] of Object.entries(actualLabels.POSITION_LABEL)) {
      f.rows.find(row => row.id === 'P' && row.userId === 'A').value = saved('P', { boothPosition })
      await f.click('再読み込み')
      assert.ok(f.text().includes(label))
    }
    f.rows.find(row => row.id === 'P' && row.userId === 'A').value = saved('P', { goal: 'unknown_goal', boothPosition: 'unknown_position' })
    await f.click('再読み込み')
    assert.ok(f.text().includes('保存された値を確認できません。'))
    assert.ok(f.text().includes('会場情報は確認できません。'))
    assert.deepEqual(f.oldCalls, [])
  })
  await check('root alias replaces overview before wizard mounts, and all shell tabs keep project', { route: '/tenjikai?project=P', shell: true }, async f => {
    assert.equal(f.nav[0].method, 'replace')
    assert.equal(f.nav[0].href, '/tenjikai/overview?project=P')
    assert.ok(!f.text().includes('SAMPLE_SENTINEL'))
    assert.deepEqual(f.oldCalls, [])
    assert.ok(f.links().includes('/tenjikai/booth?project=P'))
    assert.ok(f.links().includes('/tenjikai'))
    assert.ok(!f.container.querySelector('a[aria-current="page"]')?.textContent.includes('新規出展'))
  })
  await check('non-shell root alias also replaces overview without mounting wizard', { route: '/tenjikai?project=P' }, async f => {
    assert.equal(f.nav[0].method, 'replace')
    assert.equal(f.nav[0].href, '/tenjikai/overview?project=P')
    assert.match(f.text(), /PRIVATE_P/)
    assert.deepEqual(f.oldCalls, [])
  })
  await check('non-shell tabs and mobile menu retain project; explicit new clears it', {}, async f => {
    await f.act(() => {
      const button = f.container.querySelector('button[aria-label="メニューを開く"]')
      assert.ok(button)
      button.click()
    })
    const mobile = [...f.container.querySelectorAll('button')].filter(button => button.textContent.includes('資料庫・締切')).at(-1)
    assert.ok(mobile)
    await f.act(() => mobile.click())
    assert.equal(f.route, '/tenjikai/docs?project=P')
    assert.match(f.text(), /この項目の保存内容は、まだ表示に対応していません/)
    await f.click('新規出展プロジェクト')
    assert.equal(f.route, '/tenjikai')
    assert.match(f.text(), /SAMPLE_SENTINEL/)
    const legacyCalls = f.oldCalls.length
    await f.back()
    assert.equal(f.route, '/tenjikai/docs?project=P')
    assert.match(f.text(), /PRIVATE_P/)
    assert.equal(f.oldCalls.length, legacyCalls, 'saved mode must not run old calculations on back')
    await f.forward()
    assert.equal(f.route, '/tenjikai')
    assert.match(f.text(), /SAMPLE_SENTINEL/)
  })
  await check('invalid and duplicate project query never call API or show wizard', { route: '/tenjikai?project=P&project=Q' }, async f => {
    assert.match(f.text(), /案件の指定が正しくありません/)
    assert.equal(f.fetchCalls.length, 0)
    assert.deepEqual(f.oldCalls, [])
    await f.navigate('/tenjikai/booth?project=+')
    assert.match(f.text(), /案件の指定が正しくありません/)
    assert.equal(f.fetchCalls.length, 0)
    await f.navigate('/tenjikai/docs?project=')
    assert.match(f.text(), /案件の指定が正しくありません/)
    assert.equal(f.fetchCalls.length, 0)
  })
  await check('foreign and absent project are same unavailable view through real route', {}, async f => {
    await f.navigate('/tenjikai/overview?project=foreign')
    assert.match(f.text(), /この案件を表示できません/)
    const before = f.text()
    await f.navigate('/tenjikai/overview?project=absent')
    assert.equal(f.text(), before)
    assert.ok(!f.text().includes('PRIVATE_'))
  })
  await check('actor loading, B, ABA immediately mask and only fresh actor read returns saved values', {}, async f => {
    assert.match(f.text(), /PRIVATE_P/)
    await f.changeAuth('A', 'loading')
    assert.ok(!f.text().includes('PRIVATE_'))
    f.serverSession = { user: { id: 'B' } }
    await f.changeAuth('B')
    assert.ok(!f.text().includes('PRIVATE_P'))
    f.serverSession = { user: { id: 'A' } }
    await f.changeAuth('A')
    assert.match(f.text(), /PRIVATE_P/)
    assert.equal(f.dbCalls.at(-1).where.userId, 'A')
  })
  await check('project P-Q-P and query removal cannot reuse old detail', {}, async f => {
    await f.navigate('/tenjikai/overview?project=Q')
    assert.match(f.text(), /PRIVATE_Q/)
    assert.ok(!f.text().includes('PRIVATE_P'))
    await f.navigate('/tenjikai/overview?project=P')
    assert.match(f.text(), /PRIVATE_P/)
    await f.navigate('/tenjikai')
    assert.match(f.text(), /SAMPLE_SENTINEL/)
    await f.navigate('/tenjikai/overview?project=P')
    assert.match(f.text(), /PRIVATE_P/)
  })
  await check('combined actor and project switch reads only the new pair', {}, async f => {
    await f.switchScope('B', '/tenjikai/overview?project=Q')
    assert.match(f.text(), /PRIVATE_B_Q/)
    assert.ok(!f.text().includes('PRIVATE_P'))
    assert.deepEqual(f.dbCalls.at(-1).where, { id: 'Q', userId: 'B' })
    await f.switchScope('A', '/tenjikai/overview?project=P')
    assert.match(f.text(), /PRIVATE_P/)
    assert.ok(!f.text().includes('PRIVATE_B_Q'))
    assert.deepEqual(f.dbCalls.at(-1).where, { id: 'P', userId: 'A' })
  })
  await check('analysis missing and invalid remain distinct; saved 0 is not a missing budget', {}, async f => {
    f.rows[0].value.analysis = null
    f.rows[0].value.budgetYen = 0
    await f.click('再読み込み')
    assert.match(f.text(), /保存された分析結果はありません/)
    assert.match(f.text(), /入力予算0円/)
    f.rows[0].value.analysis = { ...saved('P').analysis, valueProps: { bad: true } }
    await f.click('再読み込み')
    assert.match(f.text(), /保存された分析結果を表示できません/)
    assert.ok(!f.text().includes('保存された分析結果はありません'))
  })
  await check('saved strings remain text and only http(s) URLs become links', {}, async f => {
    f.rows[0].value.name = '<PRIVATE_NAME>'
    f.rows[0].value.serviceUrl = 'javascript:alert(1)'
    f.rows[0].value.analysis = { ...saved('P').analysis, logoUrl: 'data:text/html,PRIVATE_LOGO' }
    await f.click('再読み込み')
    assert.match(f.text(), /<PRIVATE_NAME>/)
    assert.equal(f.container.querySelector('PRIVATE_NAME'), null)
    assert.equal(f.container.querySelector('a[href^="javascript:"]'), null)
    assert.equal(f.container.querySelector('a[href^="data:"]'), null)
  })
  await check('unauthenticated and missing SDK actor mask values and preserve login callback', {}, async f => {
    await f.changeAuth(null, 'unauthenticated')
    assert.ok(!f.text().includes('PRIVATE_'))
    assert.match(f.text(), /保存内容を確認するには、ログインしてください/)
    assert.ok(f.links().some(href => href.includes('callbackUrl=%2Ftenjikai%2Foverview%3Fproject%3DP')))
    await f.changeAuth('', 'authenticated')
    assert.ok(!f.text().includes('PRIVATE_'))
  })
  await check('same-scope reloads resolve in reverse and ignore late fetch and body', {}, async f => {
    const first = deferred(), second = deferred(), body = deferred()
    let number = 0
    f.fetcher = (url, options) => url.includes('/P?')
      ? (f.fetchCalls.push({ url, options }), ++number === 1 ? first.promise : second.promise)
      : f.defaultFetch(url, options)
    await f.click('再読み込み')
    assert.ok(!f.text().includes('PRIVATE_'))
    await f.click('再読み込み')
    assert.equal(f.workspaceCalls.length, 3, 'initial and two reloads must pass workspace first')
    assert.equal(number, 2, 'both delayed responses belong to the legacy detail GET')
    const currentResponse = await routeGET(new NextRequest('https://example.test/api/tenjikai/projects/P?expectedActor=A'), { params: Promise.resolve({ id: 'P' }) })
    await f.act(() => second.resolve(currentResponse))
    assert.match(f.text(), /PRIVATE_P/)
    await f.act(() => first.resolve({ ok: true, status: 200, json: () => body.promise }))
    assert.match(f.text(), /PRIVATE_P/)
    await f.act(() => body.resolve({ state: 'ready_partial', actorId: 'A', project: { id: 'P' } }))
    assert.match(f.text(), /PRIVATE_P/)
  })
  await check('delayed response body after project switch never overwrites current Q', {}, async f => {
    const body = deferred()
    const old = await routeGET(new NextRequest('https://example.test/api/tenjikai/projects/P?expectedActor=A'), { params: Promise.resolve({ id: 'P' }) })
    const oldBody = await old.json()
    f.fetcher = (url, options) => url.includes('/P?')
      ? (f.fetchCalls.push({ url, options }), Promise.resolve({ ok: true, status: 200, json: () => body.promise }))
      : f.defaultFetch(url, options)
    await f.click('再読み込み')
    await f.navigate('/tenjikai/overview?project=Q')
    assert.match(f.text(), /PRIVATE_Q/)
    await f.act(() => body.resolve(oldBody))
    assert.match(f.text(), /PRIVATE_Q/)
    assert.ok(!f.text().includes('PRIVATE_P'))
  })
  for (const status of [401, 409, 500]) {
    await check(`old ${status} after project switch cannot mask current Q`, {}, async f => {
      const stale = deferred()
      f.fetcher = (url, options) => url.includes('/P?')
        ? (f.fetchCalls.push({ url, options }), stale.promise)
        : f.defaultFetch(url, options)
      await f.click('再読み込み')
      await f.navigate('/tenjikai/overview?project=Q')
      assert.match(f.text(), /PRIVATE_Q/)
      await f.act(() => stale.resolve({ ok: false, status }))
      assert.match(f.text(), /PRIVATE_Q/)
      assert.ok(!f.text().includes('PRIVATE_P'))
    })
  }
  await check('old rejection and unmount completion cannot reveal or navigate', {}, async f => {
    const stale = deferred()
    f.fetcher = (url, options) => url.includes('/P?')
      ? (f.fetchCalls.push({ url, options }), stale.promise)
      : f.defaultFetch(url, options)
    await f.click('再読み込み')
    await f.navigate('/tenjikai/overview?project=Q')
    assert.match(f.text(), /PRIVATE_Q/)
    const before = f.nav.length
    await f.act(() => stale.reject(Error('synthetic old network failure')))
    assert.equal(f.nav.length, before)
    assert.match(f.text(), /PRIVATE_Q/)
    await f.close()
    assert.equal(f.container.textContent, '')
  })
  await check('pagehide invalidates a pending ignored-abort response before BFCache session proof', {}, async f => {
    const stale = deferred()
    const old = await routeGET(new NextRequest('https://example.test/api/tenjikai/projects/P?expectedActor=A'), { params: Promise.resolve({ id: 'P' }) })
    f.fetcher = (url, options) => (f.fetchCalls.push({ url, options }), stale.promise)
    await f.click('再読み込み')
    window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true }))
    assert.ok(!f.text().includes('PRIVATE_'))
    await f.act(() => stale.resolve(old))
    assert.ok(!f.text().includes('PRIVATE_'))
    f.fetcher = f.defaultFetch
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
    await f.act(() => f.checks[0].resolve({ user: { id: 'A' } }))
    assert.match(f.text(), /PRIVATE_P/)
  })
  await check('wrong or absent server actor, wrong project, ready and malformed body are rejected', {}, async f => {
    const actual = await routeGET(new NextRequest('https://example.test/api/tenjikai/projects/P?expectedActor=A'), { params: Promise.resolve({ id: 'P' }) })
    const body = await actual.json()
    const serveLegacy = changed => (url, options) => {
      if (!url.includes('/P?')) return f.defaultFetch(url, options)
      assert.equal(options.cache, 'no-store')
      f.fetchCalls.push({ url, options })
      f.legacyCalls.push({ url, options })
      return Promise.resolve({ ok: true, status: 200, json: async () => changed })
    }
    f.fetcher = serveLegacy(body)
    await f.click('再読み込み')
    assert.match(f.text(), /PRIVATE_P/, 'actual unchanged legacy DTO must pass after workspace partial read')
    assert.equal(f.workspaceCalls.length, 2)
    for (const changed of [{ ...body, actorId: 'B' }, { ...body, actorId: undefined },
      { ...body, project: { ...body.project, id: 'Q' } }, { ...body, state: 'ready' }, { nope: true }]) {
      f.fetcher = serveLegacy(changed)
      await f.click('再読み込み')
      assert.match(f.text(), /保存内容を読み込めませんでした/)
      assert.ok(!f.text().includes('PRIVATE_'))
    }
  })
  await check('pagehide masks native DOM before event returns; BFCache waits for actual session update', {}, async f => {
    assert.match(f.text(), /PRIVATE_P/)
    window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true }))
    assert.ok(!f.text().includes('PRIVATE_'), 'pagehide must synchronously clear visible private text')
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
    assert.ok(!f.text().includes('PRIVATE_'))
    assert.equal(f.checks.length, 1)
    await f.act(() => f.checks[0].resolve({ user: { id: 'A' } }))
    assert.match(f.text(), /PRIVATE_P/)
  })
  await check('BFCache update SDK loading then B loses old promise and uses fresh server GET', {}, async f => {
    window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
    await f.changeAuth('A', 'loading')
    f.serverSession = { user: { id: 'B' } }
    await f.changeAuth('B')
    await f.act(() => f.checks[0].resolve({ user: { id: 'A' } }))
    assert.ok(!f.text().includes('PRIVATE_P'))
    assert.equal(f.dbCalls.at(-1).where.userId, 'B')
  })
  await check('update returning during SDK loading recovers on authenticated A through fresh GET', {}, async f => {
    await f.changeAuth('A', 'loading')
    window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
    const reads = f.dbCalls.length
    await f.act(() => f.checks[0].resolve({ user: { id: 'A' } }))
    assert.ok(!f.text().includes('PRIVATE_'))
    assert.equal(f.dbCalls.length, reads)
    await f.changeAuth('A')
    assert.match(f.text(), /PRIVATE_P/)
    assert.equal(f.dbCalls.at(-1).where.userId, 'A')
  })
  await check('SDK actor change invalidates already returned but not yet adopted update proof', {}, async f => {
    await f.changeAuth('A', 'loading')
    window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
    await f.act(() => f.checks[0].resolve({ user: { id: 'A' } }))
    const reads = f.dbCalls.length
    f.serverSession = { user: { id: 'B' } }
    await f.changeAuth('B')
    assert.equal(f.dbCalls.length, reads + 2, 'B needs its own workspace and legacy partial reads')
    assert.deepEqual(f.dbCalls.at(-2).where, { id: 'P', userId: 'B' })
    assert.equal(f.dbCalls.at(-1).where.userId, 'B')
    assert.ok(!f.text().includes('PRIVATE_P'))
    f.serverSession = { user: { id: 'A' } }
    await f.changeAuth('A')
    assert.match(f.text(), /PRIVATE_P/)
    assert.equal(f.dbCalls.at(-1).where.userId, 'A')
  })
  await check('old BFCache update after external actor ABA cannot replace current read', {}, async f => {
    window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
    f.serverSession = { user: { id: 'B' } }
    await f.changeAuth('B')
    f.serverSession = { user: { id: 'A' } }
    await f.changeAuth('A')
    await f.act(() => f.checks[0].resolve({ user: { id: 'B' } }))
    assert.match(f.text(), /PRIVATE_P/)
    assert.equal(f.dbCalls.at(-1).where.userId, 'A')
  })
  await check('BFCache update failure stays masked until a new explicit proof', {}, async f => {
    window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true }))
    await f.act(() => f.checks[0].reject(Error('synthetic session failure')))
    assert.ok(!f.text().includes('PRIVATE_'))
    await f.click('再読み込み')
    assert.equal(f.checks.length, 2)
    await f.act(() => f.checks[1].resolve({ user: { id: 'A' } }))
    assert.match(f.text(), /PRIVATE_P/)
  })
  await check('current 409 masks and retry confirms session before another GET', {}, async f => {
    f.serverSession = { user: { id: 'B' } }
    await f.click('再読み込み')
    assert.ok(!f.text().includes('PRIVATE_P'))
    assert.match(f.text(), /ログイン状態が変わりました/)
    const count = f.fetchCalls.length
    await f.click('再読み込み')
    assert.equal(f.fetchCalls.length, count)
    f.serverSession = { user: { id: 'A' } }
    await f.act(() => f.checks[0].resolve({ user: { id: 'A' } }))
    assert.match(f.text(), /PRIVATE_P/)
  })
  await check('current 401 masks and retry requires session confirmation before another GET', {}, async f => {
    f.serverSession = null
    const dbCount = f.dbCalls.length
    await f.click('再読み込み')
    assert.equal(f.dbCalls.length, dbCount, 'unauthenticated route must not read DB')
    assert.ok(!f.text().includes('PRIVATE_'))
    assert.match(f.text(), /保存内容を確認するには、ログインしてください/)
    const count = f.fetchCalls.length
    await f.click('再読み込み')
    assert.equal(f.fetchCalls.length, count)
    f.serverSession = { user: { id: 'A' } }
    await f.act(() => f.checks[0].resolve({ user: { id: 'A' } }))
    assert.match(f.text(), /PRIVATE_P/)
  })
})
