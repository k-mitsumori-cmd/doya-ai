// Actual admin services API -> actual page, synthetic admin cookie and count-only DB.
// This proves work-link selection, not the target dashboard's membership access or a live admin session.
process.env.NODE_ENV = 'test'
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..'), req = Module.createRequire(path.join(root, 'package.json'))
const ts = req('typescript'), React = req('react'), { JSDOM } = req('jsdom'), { createRoot } = req('react-dom/client')
const { load } = req(path.join(root, 'scripts/security-regression/load-typescript.cjs'))
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/admin/services' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const writes = [], counts = []
const db = new Proxy({}, { get: (_, model) => new Proxy({}, { get: (_, method) => async args => {
  if (method !== 'count') { writes.push({ model, method }); throw Error('write forbidden') }
  counts.push({ model, args }); return counts.length
} }) })
const routeMocks = valid => ({
  'next/server': { NextResponse: Response },
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'synthetic-admin-token' }) }) },
  '@/lib/admin-auth': { COOKIE_NAME: 'synthetic', verifyAdminSession: async () => ({ valid }) },
  '@/lib/prisma': { prisma: db },
})
const route = load('src/app/api/admin/services/route.ts', routeMocks(true))
const rejectedRoute = load('src/app/api/admin/services/route.ts', routeMocks(false))
let apiRows = [], fetches = 0
const originalFetch = global.fetch
global.fetch = async url => {
  fetches++; assert.equal(url, '/api/admin/services')
  const response = await route.GET(); apiRows = (await response.clone().json()).services
  return response
}
const file = path.join(root, 'src/app/admin/services/page.tsx'), mod = new Module(file)
mod.filename = file
mod.require = id => id === 'next/link' ? {
  __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
} : req(id)
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText, file)
const plan = load('src/lib/unified-plan.ts')
const services = load('src/lib/services.ts', { './unified-plan': plan })
const expectedPaths = { seo:'/seo',banner:'/banner',interview:'/interview',copy:'/copy',lp:'/lp',voice:'/voice',
  movie:'/movie',kintai:'/kintai/dashboard',hr:'/hr/dashboard',tenkai:'/tenkai',adsim:'/adsim' }
;(async () => {
  const denied = await rejectedRoute.GET()
  assert.equal(denied.status, 401); assert.equal(counts.length, 0); assert.equal(writes.length, 0)
  console.log('PASS invalid admin remains 401 without DB counts or writes')
  const mount = createRoot(document.getElementById('root'))
  try {
    await React.act(async () => { mount.render(React.createElement(mod.exports.default)); for (let i=0;i<20;i++) await new Promise(setImmediate) })
    assert.equal(fetches, 1)
    assert.equal(apiRows.length, 11)
    assert.deepEqual(apiRows.map(s => s.id), Object.keys(expectedPaths))
    assert.equal(counts.length, 19)
    assert.equal(writes.length, 0)
    for (const row of apiRows) {
      assert.equal(row.path, expectedPaths[row.id], row.id)
      assert.equal(row.status, ['tenkai','adsim'].includes(row.id) ? 'coming_soon' : 'active')
      const card = [...document.querySelectorAll('a')].find(a => a.parentElement.textContent.includes(row.name))
      assert.ok(card, row.id)
      assert.equal(card.getAttribute('href'), expectedPaths[row.id], `actual ${row.id} card must use actual API path`)
    }
    assert.equal(apiRows.find(x => x.id === 'seo').path, services.getServiceById('seo').dashboardHref)
    for (const id of ['kintai','hr']) assert.equal(apiRows.find(x => x.id === id).path, services.getServiceById(id).dashboardHref)
    assert.match(document.body.textContent, /全ユーザー/)
    console.log('PASS actual admin API and page use canonical HR/Kintai work links; SEO and other nine rows, status and counts preserved')
  } finally { await React.act(async () => mount.unmount()); dom.window.close(); global.fetch = originalFetch }
})().catch(error => { console.error(error); process.exitCode = 1; global.fetch = originalFetch })
