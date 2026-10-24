// ドヤカンニングを「開発中のベータ版」として隠したときの回帰テスト（2026-10-22）。
// - 許可されていない人は /api/cunning/* のどの入口も 403（ほかの処理を1つも呼ばない）
// - 許可された人（許可リストのメール）は、入口を通って今までどおりの処理へ進む
// - 一覧（メニュー・⌘K・経営ホームの例・トップ・料金・sitemap・llms.txt）に出ない
// - ツールの数は旗を見て数える（旗を外せば1つ増える）
// ⚠️ git コマンドを使わない。process.env の既定値に頼らない（許可リストなどの値はテストの中で渡す）。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { load, check, results } = require('./load-typescript.cjs')

const root = path.resolve(__dirname, '../..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const ALLOWED = 'owner@example.invalid'
const OTHER = 'someone@example.invalid'
const unified = load('src/lib/unified-plan.ts')
const services = load('src/lib/services.ts', { './unified-plan': unified })
const uiNext = load('src/lib/ui-next.ts')
// 許可リストは、テストの中で渡す（環境変数を読まない）
const uiNextWithAllow = { ...uiNext, uiPreviewEmails: () => [ALLOWED] }
const beta = load('src/lib/beta-service.ts', { '@/lib/services': services, '@/lib/ui-next': uiNextWithAllow })

/** TSX を読む（load-typescript.cjs は JSX を変換しないため、ここで jsx を指定して読む） */
function loadTsx(file, mocks) {
  const exports = {}
  const out = ts.transpileModule(read(file), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  vm.runInNewContext(out, { exports, process: { env: {} }, Promise, Error, require: (n) => { if (n in mocks) return mocks[n]; throw Error('Unmocked ' + n) } }, { filename: file })
  return exports
}

/** 旗（hidden: 'beta'）を外した services.ts を読む。数が旗から数えられているかを確かめるため */
function servicesWithoutFlag() {
  const source = read('src/lib/services.ts')
  const stripped = source.replace(/^\s*hidden: 'beta',\s*$/m, '')
  assert.notEqual(stripped, source, 'services.ts に hidden: \'beta\' の行が見つからない')
  const exports = {}
  vm.runInNewContext(ts.transpileModule(stripped, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, process: { env: {} }, require: (n) => { if (n === './unified-plan') return unified; throw Error('Unmocked ' + n) },
  })
  return exports
}

/** どこを触っても記録して失敗する偽物。入口より先の処理が呼ばれたかを数える */
function poisonFactory() {
  const state = { touched: 0, armed: false }
  const handler = {
    get: (_t, key) => (key === 'then' ? undefined : key === Symbol.toPrimitive ? () => '' : poison),
    apply: () => { if (state.armed) state.touched++; throw Error('poison: beyond the beta gate') },
    construct: () => { if (state.armed) state.touched++; throw Error('poison: beyond the beta gate') },
  }
  const poison = new Proxy(function poisoned() {}, handler)
  return { poison, state }
}

function routeFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...routeFiles(rel))
    else if (entry.name === 'route.ts') out.push(rel)
  }
  return out.sort()
}

;(async () => {
  await check('cunning carries the single beta flag and is derived into every hidden set', async () => {
    assert.equal(services.getServiceById('cunning').hidden, 'beta')
    assert.deepEqual([...services.BETA_HIDDEN_SERVICE_IDS], ['cunning'])
    assert.ok(services.HIDDEN_SERVICE_IDS.has('cunning'))
    assert.ok(!services.getActiveServices().some((s) => s.id === 'cunning'))
    assert.ok(!services.getPublicServices().some((s) => s.id === 'cunning'))
    assert.ok(services.isBetaHiddenPath('/cunning') && services.isBetaHiddenPath('/cunning/history/abc') && services.isBetaHiddenPath('/cunning?x=1'))
    assert.ok(!services.isBetaHiddenPath('/cunningx') && !services.isBetaHiddenPath('/banner'))
    // ツールの画面の判定（ポップアップを出さない・計測）には残す。許可した人は使うため
    assert.ok(services.getRunningServices().some((s) => s.id === 'cunning'))
    // 隠しても定義は残す（旗を外せば戻る）
    assert.ok(services.SERVICES.some((s) => s.id === 'cunning'))
  })

  await check('tool counts are counted from the flag, not hard-coded', async () => {
    const unflagged = servicesWithoutFlag()
    assert.equal(unflagged.BETA_HIDDEN_SERVICE_IDS.size, 0)
    assert.equal(unflagged.getPublicServices().length, services.getPublicServices().length + 1)
    assert.equal(unflagged.getActiveServices().length, services.getActiveServices().length + 1)
    const expected = services.SERVICES.filter((s) => s.status === 'active' && !services.RETIRED_SERVICE_IDS.has(s.id) && !services.UNLISTED_SERVICE_IDS.has(s.id) && s.hidden !== 'beta').length
    assert.equal(services.getPublicServices().length, expected)
    // 料金ページの「全◯ツール」と比較表は getPublicServices() から数える（数字をベタ書きしない）
    for (const file of ['src/components/pricing/PricingNext.tsx', 'src/components/UnifiedPricingPlans.tsx', 'src/app/all-in-one/page.tsx']) {
      const source = read(file)
      assert.match(source, /getPublicServices\(\)/, file)
      assert.doesNotMatch(source, /全\s*[0-9０-９]+\s*(ツール|サービス)/, file)
    }
  })

  await check('shell menu, command palette, recent tools and all-tools list omit cunning', async () => {
    const tools = load('src/components/shell/tools.ts', { '@/lib/services': services })
    assert.ok(!tools.ALL_SHELL_TOOLS.some((t) => t.id === 'cunning'))
    assert.ok(!tools.SHELL_GROUPS.flatMap((g) => g.tools).some((t) => t.id === 'cunning'))
    // 許可した人が開いたときのパンくずの名前だけは引ける
    assert.equal(tools.findShellTool('cunning').name, 'ドヤカンニング')
    assert.equal(tools.findShellTool('banner').id, 'banner')
    assert.equal(tools.findShellTool('no-such-tool'), undefined)
    // ⌘K・最近使ったツール・スマホの下のタブは ALL_SHELL_TOOLS / SHELL_GROUPS から引く（ほかの一覧を持たない）
    const shell = read('src/components/shell/AppShell.tsx')
    assert.match(shell, /const TOOL_ITEMS: PaletteItem\[\] = ALL_SHELL_TOOLS\.map/)
    assert.equal((shell.match(/new Map\(ALL_SHELL_TOOLS\.map/g) || []).length, 2)
  })

  await check('home intents never point to a beta-hidden tool', async () => {
    const intents = load('src/app/(shell)/home/intents.ts', { '@/lib/services': services })
    const hrefs = intents.HOME_INTENT_GROUPS.flatMap((g) => g.intents.map((i) => i.href))
    assert.ok(hrefs.length > 0)
    assert.ok(hrefs.every((href) => !services.isBetaHiddenPath(href)))
    assert.equal(intents.matchHomeIntent('カンニング'), null)
  })

  await check('public lists (llms.txt, llms-full.txt, sitemap) omit cunning', async () => {
    const seo = { SITE_CONFIG: { url: 'https://example.invalid', name: 'ドヤAI' } }
    for (const file of ['src/app/llms.txt/route.ts', 'src/app/llms-full.txt/route.ts']) {
      const route = load(file, { '@/lib/services': services, '@/lib/seo': seo })
      const body = await route.GET().text()
      assert.ok(body.length > 100, file)
      assert.ok(!body.includes('/cunning') && !body.includes('ドヤカンニング'), file)
    }
    const sitemap = load('src/app/sitemap.ts', { '@/lib/services': services, '@/lib/seo': seo, next: {} })
    const urls = sitemap.default().map((e) => e.url)
    assert.ok(urls.length > 10)
    assert.ok(!urls.some((u) => u.includes('/cunning')))
  })

  await check('beta access decision uses the allow list passed in', async () => {
    assert.equal(beta.canUseBetaService('cunning', ALLOWED), true)
    assert.equal(beta.canUseBetaService('cunning', ' Owner@Example.invalid '), true)
    for (const email of [OTHER, '', null, undefined]) assert.equal(beta.canUseBetaService('cunning', email), false)
    assert.equal(beta.canUseBetaService('cunning', ALLOWED, { allow: [] }), false)
    assert.equal(beta.canUseBetaService('cunning', OTHER, { allow: [OTHER] }), true)
    // 隠していないツールは誰でも使える
    assert.equal(beta.canUseBetaService('banner', null), true)
  })

  const serverGate = (session) => {
    let reads = 0
    const mod = load('src/lib/beta-service.server.ts', {
      'next/server': { NextResponse: { json: (d, i) => new Response(JSON.stringify(d), i) } },
      'next-auth': { getServerSession: async () => { reads++; if (session instanceof Error) throw session; return session } },
      '@/lib/auth': { authOptions: {} },
      '@/lib/services': services,
      '@/lib/beta-service': beta,
    })
    return { mod, reads: () => reads }
  }

  await check('server gate returns 403 to signed-out, other and broken sessions', async () => {
    for (const session of [null, { user: {} }, { user: { email: OTHER } }, new Error('session store down')]) {
      const { mod } = serverGate(session)
      const denied = await mod.betaServiceDenied('cunning')
      assert.ok(denied, JSON.stringify(String(session)))
      assert.equal(denied.status, 403)
      assert.equal(denied.headers.get('cache-control'), 'private, no-store')
      const body = await denied.json()
      assert.equal(body.code, 'BETA_HIDDEN')
      assert.match(body.error, /開発中のベータ版/)
      assert.equal(await mod.canAccessBetaService('cunning'), false)
    }
  })

  await check('server gate lets the allowed account through and ignores unflagged tools', async () => {
    const { mod } = serverGate({ user: { email: ALLOWED } })
    assert.equal(await mod.betaServiceDenied('cunning'), null)
    assert.equal(await mod.canAccessBetaService('cunning'), true)
    const other = serverGate({ user: { email: OTHER } })
    assert.equal(await other.mod.betaServiceDenied('banner'), null)
    assert.equal(other.reads(), 0)
  })

  const files = routeFiles('src/app/api/cunning')
  await check('every /api/cunning route exports only gated async function handlers', async () => {
    assert.ok(files.length >= 17, String(files.length))
    for (const file of files) {
      const source = read(file)
      assert.doesNotMatch(source, /export\s+(const|let|var)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/, file)
      assert.doesNotMatch(source, /export\s*\{[^}]*\b(GET|POST|PUT|PATCH|DELETE)\b/, file)
      const handlers = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\(/g)].map((m) => m[1])
      assert.ok(handlers.length > 0, file)
      assert.equal((source.match(/await betaServiceDenied\('cunning'\)/g) || []).length, handlers.length, file)
    }
  })

  const callHandlers = async (file, gate) => {
    const { poison, state } = poisonFactory()
    const mocks = new Proxy({}, {
      has: () => true,
      get: (_t, name) => (name === '@/lib/beta-service.server' ? { betaServiceDenied: gate } : poison),
    })
    const route = load(file, mocks)
    state.armed = true
    const out = []
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      if (typeof route[method] !== 'function') continue
      const before = state.touched
      const req = new Request('https://example.invalid/api/cunning', { method: method === 'GET' ? 'GET' : 'POST', body: method === 'GET' ? undefined : '{}' })
      const ctx = { params: Promise.resolve({ id: 'session-1', windowId: 'window-1' }) }
      let response = null, threw = null
      try { response = await route[method](req, ctx) } catch (e) { threw = e }
      out.push({ method, response, threw, touched: state.touched - before })
    }
    return out
  }

  await check('denied visitors get 403 from every /api/cunning handler before any other work', async () => {
    let count = 0
    for (const file of files) {
      const denied = async () => new Response(JSON.stringify({ code: 'BETA_HIDDEN' }), { status: 403 })
      for (const r of await callHandlers(file, denied)) {
        assert.equal(r.threw, null, `${file} ${r.method}: ${r.threw}`)
        assert.equal(r.response.status, 403, `${file} ${r.method}`)
        assert.equal(r.touched, 0, `${file} ${r.method} touched work behind the gate`)
        count++
      }
    }
    assert.ok(count >= 23, String(count))
  })

  await check('allowed accounts pass the gate into the existing handler logic', async () => {
    for (const file of files) {
      for (const r of await callHandlers(file, async () => null)) {
        // 入口を通ったので、その先の処理（ログイン確認・DB など）に進んでいる
        assert.ok(r.touched > 0, `${file} ${r.method} did not proceed past the gate`)
        assert.ok(!(r.response && r.response.status === 403 && r.touched === 0), `${file} ${r.method}`)
      }
    }
  })

  await check('cunning layout shows the beta notice instead of the tool to denied visitors', async () => {
    const jsx = require('react/jsx-runtime')
    const Notice = function BetaServiceNotice() { return null }
    const Lp = function LpJsonLd() { return null }
    const Shell = function CunningShellFrame() { return null }
    const layoutFor = (session) => loadTsx('src/app/(shell)/cunning/layout.tsx', {
      'next-auth': { getServerSession: async () => session },
      '@/lib/auth': { authOptions: {} },
      '@/lib/seo': { buildServiceMetadata: () => ({}) },
      '@/lib/services': services,
      '@/components/lp': { LpJsonLd: Lp },
      '@/components/cunning/CunningShellFrame': { __esModule: true, default: Shell },
      '@/components/BetaServiceNotice': { __esModule: true, default: Notice },
      '@/lib/beta-service': beta,
      'react/jsx-runtime': jsx,
    })
    const children = jsx.jsx('p', { children: 'tool' })
    const flatten = (el, acc = []) => {
      if (!el || typeof el !== 'object') return acc
      acc.push(el)
      const kids = el.props && el.props.children
      for (const k of Array.isArray(kids) ? kids : [kids]) flatten(k, acc)
      return acc
    }
    for (const session of [null, { user: { email: OTHER } }]) {
      const el = await layoutFor(session).default({ children })
      const nodes = flatten(el)
      assert.ok(nodes.some((n) => n.type === Notice))
      assert.ok(!nodes.some((n) => n === children || n.type === Shell || n.type === Lp))
      assert.equal(nodes.find((n) => n.type === Notice).props.signedIn, Boolean(session))
    }
    const allowed = flatten(await layoutFor({ user: { email: ALLOWED } }).default({ children }))
    assert.ok(!allowed.some((n) => n.type === Notice))
    assert.ok(allowed.some((n) => n.type === Shell))
    // /cunning のページは (shell)/cunning の下だけにある（この layout を通らない入口が無い）
    const appDirs = fs.readdirSync(path.join(root, 'src/app'), { withFileTypes: true }).filter((e) => e.isDirectory())
    const cunningDirs = appDirs.flatMap((e) => (e.name === 'cunning' ? [e.name] : /^\(.+\)$/.test(e.name) && fs.existsSync(path.join(root, 'src/app', e.name, 'cunning')) ? [path.join(e.name, 'cunning')] : []))
    assert.deepEqual(cunningDirs, ['(shell)/cunning'])
    // LP の比較用プレビューにも出さない
    assert.match(read('src/app/renewal-preview/[service]/page.tsx'), /isBetaHiddenService\(serviceId\)\) notFound\(\)/)
  })

  console.log(JSON.stringify({ passed: results.length, routes: files.length, networkRequests: 0, productionWrites: 0 }))
})().catch((e) => { console.error(e); process.exitCode = 1 })
