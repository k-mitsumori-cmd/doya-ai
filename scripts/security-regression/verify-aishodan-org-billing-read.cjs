const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const root = path.resolve(__dirname, '../..'), ts = require(root + '/node_modules/typescript')
let actor = 'actor-A', actual = { userId: actor, organizationId: 'org-A', organizationSlug: 'A', role: 'owner' }, contexts = 0, billings = 0
const selection = (() => {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + '/src/lib/organization-workspace-selection.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: () => { throw Error('unexpected import') }, URL, decodeURIComponent, encodeURIComponent })
  return exports
})()
const modules = {
  'next-auth': { getServerSession: async () => actor ? { user: { id: actor } } : null },
  '@/lib/auth': { authOptions: {} },
  '@/lib/quote/access': { getQuoteContext: () => { throw Error('quote unrelated') } },
  '@/lib/mensetsu/access': { getMensetsuContext: () => { throw Error('mensetsu unrelated') } },
  '@/lib/aishodan/access': { getAishodanContext: async slug => { contexts++; assert.equal(slug, 'A'); return actual } },
  '@/lib/organization-billing': { getOrganizationBilling: async () => { billings++; return { plan: 'PRO', ownerUserId: 'actor-A' } } },
  '@/lib/organization-workspace-selection': selection,
  'next/server': { NextResponse: { json: (body, init = {}) => Response.json(body, init) } },
}
const routeExports = {}
const file = 'src/app/api/organization-billing/[service]/route.ts'
vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + '/' + file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: routeExports, require: name => { assert.ok(name in modules, name); return modules[name] }, URL, Response, console }, { filename: file })
const request = (query, expected = 'actor-A') => new Request('https://example.invalid/api/organization-billing/aishodan' + query, { headers: { 'x-doya-workspace-actor': expected } })
const get = req => routeExports.GET(req, { params: Promise.resolve({ service: 'aishodan' }) })
;(async () => {
  let response = await get(request('?org=A', 'actor-B'))
  assert.equal(response.status, 409); assert.equal(contexts, 0); assert.equal(billings, 0)
  for (const query of ['', '?org=', '?org=A&org=B', '?org=%', '?org=..']) {
    response = await get(request(query)); assert.equal(response.status, 400, query); assert.equal(contexts, 0)
  }
  response = await get(request('?org=A')); assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie')
  assert.deepEqual(await response.json(), { organizationId: 'org-A', actorId: 'actor-A', organizationSlug: 'A', plan: 'PRO', canManageBilling: true })
  assert.equal(contexts, 1); assert.equal(billings, 1)
  actual = { ...actual, role: 'member' }; response = await get(request('?org=A'))
  assert.equal((await response.json()).canManageBilling, false)
  actual = { ...actual, userId: 'actor-B' }; response = await get(request('?org=A')); assert.equal(response.status, 409)
  actor = null; response = await get(request('?org=A')); assert.equal(response.status, 401)
  console.log('PASS 9 actual organization-billing route cases: actor precheck, strict org, owner/member, mismatched context, private response. Synthetic auth/context/billing.')
})().catch(error => { console.error(error); process.exitCode = 1 })
