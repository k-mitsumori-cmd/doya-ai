process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), crypto = require('node:crypto')
const candidate = path.resolve(__dirname, '../..')
const baseline = process.env.DOYA_TEST_BASELINE || candidate
const root = fs.existsSync(path.join(candidate, 'node_modules/react')) ? candidate : baseline
const sourcePath = relative => {
  const primary = path.join(candidate, relative)
  if (fs.existsSync(primary)) return primary
  const fallback = path.join(baseline, relative)
  if (fs.existsSync(fallback)) return fallback
  throw Error(`Missing actual source ${relative}`)
}
const ts = require(root + '/node_modules/typescript'), React = require(root + '/node_modules/react')
const { JSDOM } = require(root + '/node_modules/jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/aishodan?org=A' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const { createRoot } = require(root + '/node_modules/react-dom/client')
const { Simulate } = require(root + '/node_modules/react-dom/test-utils')
function loadActual(relative, imports = {}) {
  const filename = sourcePath(relative), m = new Module(filename)
  m.require = id => { if (id in imports) return imports[id]; throw Error(`Unmocked actual source import ${id}`) }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  return m.exports
}
const selection = loadActual('src/lib/organization-workspace-selection.ts')
const { workspaceHref, workspaceApi } = selection
let routeRole = 'owner'
const actualProductsRoute = loadActual('src/app/api/aishodan/products/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/organization-workspace-selection': selection,
  '@/lib/prisma': { prisma: { aishodanProduct: { deleteMany: async () => ({}), findFirst: async () => null, count: async () => 1 } } },
  '@/lib/organization-billing': { getOrganizationOwnerUserId: async () => 'actor-A' },
  '@/lib/aishodan/access': { getAishodanContext: async () => ({ organizationId: 'id-A', organizationSlug: 'A', userId: routeRole === 'owner' ? 'actor-A' : 'actor-member', role: routeRole }), orgSlugFrom: () => 'A' },
  '@/lib/aishodan/knowledge': { crawlProductSite: () => { throw Error('quota route must not crawl') }, generateProfile: () => { throw Error('quota route must not use AI') }, ingestPages: () => { throw Error('quota route must not ingest') } },
  '@/lib/aishodan/defaults': { DEFAULT_GUARDRAILS: {}, DEFAULT_ICP: {}, DEFAULT_PERSONA: {}, DEFAULT_PHASES: [], DEFAULT_SLOTS: [] },
  '@/lib/plan-limit': { FREE_LIMITS: { aishodanProducts: 1 }, assertFreeLimit: async (_kind, count) => { assert.equal(await count(), 1); return { ok: false, used: 1, limit: 1, reason: '無料枠に達しました' } } },
  '@/lib/service-usage': { recordServiceUsage: () => { throw Error('quota route must not record usage') } },
})
async function actualQuota(role) {
  routeRole = role
  const response = await actualProductsRoute.POST(new Request('https://example.invalid/api/aishodan/products?org=A', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://service.invalid' }) }))
  assert.equal(response.status, 402)
  return { status: response.status, body: await response.json() }
}
let active = true, requests = [], pending = [], proof, richCase = '', importReply = null, uiNext = true
const row = { id: 'id-A', slug: 'A', name: 'Org A', role: 'owner' }
const makeProof = () => ({ actorId: 'actor-A', organization: row, revision: 1, current: () => active, href: p => workspaceHref(p, 'A'), api: p => workspaceApi(p, 'A') })
proof = makeProof()
const scope = { kind: 'ready', proof, memberships: [row] }
const workspace = { scope }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const scenario = { id: 'item-1', name: 'Scenario A', product: { id: 'p1', name: 'Product A', profile: null },
  phases: [], slots: [], icp: { conditions: [] }, guardrails: { pricePolicy: 'disclose', noEvidenceBehavior: 'defer', competitorPolicy: 'neutral', prohibitedTopics: [] },
  persona: { tone: 'polite', firstPerson: '私', maxCharsPerUtterance: 100 }, durationMin: 15, schedulingUrl: null, schedulingLabel: null }
const session = { id: 'item-1', guestName: null, guestCompany: null, guestEmail: null, status: 'completed', startedAt: '2026-10-22T00:00:00Z', endedAt: '2026-10-22T00:10:00Z',
  schedulingClickedAt: null, roomName: 'Room A', isPreview: false, productName: 'Product A', turns: [], slots: [], questions: [], outcome: null }
const toolProduct = { id: 'p1', name: 'Product A', sourceUrl: 'https://service.invalid', scenarios: [{ id: 'item-1', name: 'Scenario A' }], _count: { chunks: 1, sources: 1 } }
const toolRoom = { id: 'r1', name: 'Room A', token: 'token-a', isActive: true, expiresAt: null, createdAt: '2026-10-22T00:00:00Z',
  sessionCount: 0, maxSessions: 10, scenario: { id: 'item-1', name: 'Scenario A', product: { name: 'Product A' } }, _count: { sessions: 0 } }
const data = url => url.includes('/products') ? { products: richCase === 'preview' ? [{ id: 'p1', name: 'Product A', scenarios: [{ id: 'item-1', name: 'Scenario A' }] }] : richCase.startsWith('tool:') ? [toolProduct] : [], nextCursor: null, total: 0 }
  : url.includes('/rooms') ? { rooms: richCase.startsWith('tool:') ? [toolRoom] : [], nextCursor: null, total: 0 }
  : url.includes('/stats') ? { total: 0, unanswered: [] }
  : url.includes('/scenarios/') ? { scenario: richCase === 'scenario detail' ? scenario : null }
  : url.includes('/sessions/') ? { session: richCase === 'session detail' ? session : null }
  : { sessions: [], nextCursor: null, total: 0 }
const request = url => { requests.push(url); const held = deferred(); pending.push({ url, held }); return held.promise }
global.fetch = (url, init) => init?.method === 'POST' && importReply
  ? Promise.resolve({ ok: false, status: importReply.status, json: async () => importReply.body })
  : request(url).then(value => richCase === 'auth-load' && String(url).includes('/products') ? ({ ok: false, json: async () => ({error:'Expired'}), status: 401, init }) : richCase === 'rate-load' && String(url).includes('/products') ? ({ ok: false, json: async () => ({error:'Rate limited'}), status: 429, init }) : ({ ok: true, json: async () => value, status: 200, init }))
const primitive = ({ children, href, className }) => React.createElement(href ? 'a' : 'div', { href, className }, children)
const dummy = { __esModule: true, default: primitive }
const components = new Proxy({}, { get: (_, key) => key === '__esModule' ? true : primitive })
const listPages = { parseAishodanPage: (d, key) => ({ items: d[key] || [], nextCursor: d.nextCursor || null, total: d.total || 0 }), appendAishodanPage: (items, page) => [...items, ...page.items] }
const mocks = {
  react: React, 'react/jsx-runtime': require(root + '/node_modules/react/jsx-runtime'),
  'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children) },
  'next/navigation': { useParams: () => ({ id: 'item-1' }) },
  '@/components/org/OrganizationWorkspaceBoundary': { useOrganizationWorkspace: () => workspace, useOptionalOrganizationWorkspace: () => workspace, useWorkspaceProof: () => proof },
  '@/components/org/OrgSwitcher': { __esModule: true, default: primitive },
  '@/lib/org-fetch': { fetchOrgJson: url => request(url) },
  '@/lib/aishodan/types': { SESSION_STATUS_LABELS: {}, VERDICT_LABELS: {}, PRICE_POLICY_LABELS: {} },
  '@/lib/aishodan/list-pages': listPages,
  '@/lib/ui/notify': { notifyError: (setter, message) => setter(message) },
  '@/components/shell/ui-next-context': { useUiNext: () => uiNext },
  '@/components/lp': { DoyaKun: primitive },
  '@/components/LoadingProgress': dummy,
  '@/components/aishodan/AishodanHeading': dummy,
  '@/components/SignInReturnLink': dummy,
  '@/components/EmptyState': dummy,
  '@/components/ds': { Button: ({href,children}) => React.createElement(href?'a':'button',{href},children), ErrorNotice: ({what,how}) => React.createElement('div',{role:'alert'},what,how), EmptyState: primitive, Skeleton: primitive, ToolHero: primitive, FirstSteps: primitive },
  '@/components/ds/motion': { Stagger: primitive, StaggerItem: primitive },
  './Lp': dummy,
}
const cache = new Map()
function load(rel) {
  if (cache.has(rel)) return cache.get(rel).exports.default
  const filename = sourcePath(rel), m = new Module(filename)
  cache.set(rel, m); m.paths = Module._nodeModulePaths(path.dirname(filename))
  m.require = id => { if (id in mocks) return mocks[id]; if (id === '@/components/aishodan/failure') return loadExports('src/components/aishodan/failure.tsx'); throw Error(`Unmocked ${id} from ${rel}`) }
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename)
  return m.exports.default
}
const helperCache = new Map()
function loadExports(rel) { if (helperCache.has(rel)) return helperCache.get(rel); const filename=sourcePath(rel), m=new Module(filename);m.require=id=>{if(id==='react/jsx-runtime')return require(root+'/node_modules/react/jsx-runtime');if(id==='@/components/ds')return mocks['@/components/ds'];throw Error('Unmocked helper '+id)};m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);helperCache.set(rel,m.exports);return m.exports}
const Tool=load('src/app/(shell)/aishodan/Tool.tsx')
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const cases=[]
async function check(kind, expectedHref) {
  requests=[];pending=[];active=true;proof=makeProof();scope.proof=proof;richCase=kind
  const view=createRoot(document.getElementById('root'))
  await React.act(async()=>{view.render(React.createElement(Tool));await tick()})
  assert.equal(pending.length,4)
  await React.act(async()=>{for(const item of pending)item.held.resolve(data(item.url));await tick()})
  const links=[...document.querySelectorAll('a')].map(anchor=>anchor.getAttribute('href'))
  assert.equal(links.includes(expectedHref),kind==='auth-load',`${kind} destination`)
  cases.push({kind,links:links.filter(link=>link?.startsWith('/auth/signin')||link?.includes('pricing'))})
  await React.act(async()=>view.unmount())
}
async function checkImport(name, reply, expectedPricing, role = 'owner', next = true) {
  requests=[];pending=[];active=true;row.role=role;uiNext=next;proof=makeProof();scope.proof=proof;richCase='normal';importReply=reply
  const view=createRoot(document.getElementById('root'))
  await React.act(async()=>{view.render(React.createElement(Tool));await tick()})
  await React.act(async()=>{for(const item of pending)item.held.resolve(data(item.url));await tick()})
  const input=document.getElementById('aishodan-import-url')
  assert.ok(input)
  await React.act(async()=>{Simulate.change(input,{target:{value:'https://service.invalid'}});await tick()})
  const action=[...document.querySelectorAll('button')].find(button=>button.textContent.includes('取り込む'))
  assert.ok(action&&!action.disabled)
  await React.act(async()=>{action.click();await tick()})
  const pricingLinks=[...document.querySelectorAll('a')].map(anchor=>anchor.getAttribute('href')).filter(href=>href?.includes('pricing'))
  assert.deepEqual(pricingLinks,expectedPricing?['/aishodan/pricing?org=A']:[],name)
  const priced=pricingLinks.length===1
  cases.push({kind:name,scopedPricing:priced})
  await React.act(async()=>view.unmount())
}
;(async()=>{
  await check('auth-load','/auth/signin?callbackUrl=%2Faishodan%3Forg%3DA')
  await check('rate-load','/aishodan/pricing?org=A')
  requests=[];pending=[];active=true;proof=makeProof();scope.proof=proof;richCase='auth-load'
  const view=createRoot(document.getElementById('root'))
  await React.act(async()=>{view.render(React.createElement(Tool));await tick()})
  active=false
  await React.act(async()=>{for(const item of pending)item.held.resolve(data(item.url));await tick()})
  assert.equal([...document.querySelectorAll('a')].some(anchor=>anchor.getAttribute('href')?.startsWith('/auth/signin')),false,'retired old 401 cannot expose action')
  await React.act(async()=>view.unmount())
  const ownerQuota = await actualQuota('owner')
  assert.deepEqual({ canManageBilling: ownerQuota.body.canManageBilling, upgradeUrl: ownerQuota.body.upgradeUrl }, { canManageBilling: true, upgradeUrl: '/aishodan/pricing?org=A' })
  await checkImport('actual owner 402 upgrade',ownerQuota,true)
  await checkImport('legacy orgless 402 guidance',{...ownerQuota,body:{...ownerQuota.body,upgradeUrl:'/aishodan/pricing'}},false)
  await checkImport('foreign organization 402 guidance',{...ownerQuota,body:{...ownerQuota.body,upgradeUrl:'/aishodan/pricing?org=B'}},false)
  await checkImport('conflicting organization 402 guidance',{...ownerQuota,body:{...ownerQuota.body,upgradeUrl:'/aishodan/pricing?org=A&org=B'}},false)
  await checkImport('external 402 guidance',{...ownerQuota,body:{...ownerQuota.body,upgradeUrl:'https://evil.invalid/aishodan/pricing?org=A'}},false)
  await checkImport('false billing authority 402 guidance',{...ownerQuota,body:{...ownerQuota.body,canManageBilling:false}},false)
  const memberQuota = await actualQuota('member')
  assert.equal(memberQuota.body.upgradeUrl,undefined)
  await checkImport('actual member 402 no upgrade',memberQuota,false,'member')
  await checkImport('forged member 402 upgrade',{...ownerQuota},false,'member')
  await checkImport('rate 429 without validated guidance',{status:429,body:{...ownerQuota.body}},false)
  await checkImport('legacy actual owner scoped 402',ownerQuota,true,'owner',false)
  await checkImport('legacy crossorg 402',{...ownerQuota,body:{...ownerQuota.body,upgradeUrl:'/aishodan/pricing?org=B'}},false,'owner',false)
  await checkImport('legacy forged member 402',ownerQuota,false,'member',false)
  dom.window.close()
  const sourceHashes = Object.fromEntries([
    'src/app/api/aishodan/products/route.ts',
    'src/lib/organization-workspace-selection.ts',
    'src/app/(shell)/aishodan/Tool.tsx',
    'src/components/aishodan/failure.tsx',
  ].map(relative => [relative, crypto.createHash('sha256').update(fs.readFileSync(sourcePath(relative))).digest('hex')]))
  console.log(JSON.stringify({passed:cases.length,cases,sourceHashes,scope:'Actual repository products POST quota response + actual Aishodan Tool and notice, UI-next and legacy branches; synthetic verified proof and mocked DB quota. No full Boundary/auth/provider/DB/browser.'}))
})().catch(error=>{console.error(error);process.exitCode=1;dom.window.close()})
