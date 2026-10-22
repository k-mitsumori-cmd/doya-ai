// Popup publish guidance and fresh public config contract. Actual routes, write helper, schema,
// DTO, public checks, stats and embed bytes; synthetic auth/Prisma/DOM/timers only.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), vm = require('node:vm')
// Optional local before-control; CI always reads this checkout's actual source.
const root = process.env.CI ? path.resolve(__dirname, '../..')
  : path.resolve(process.env.DOYA_POPUP_PUBLISH_TEST_ROOT || path.resolve(__dirname, '../..'))
const requireRoot = Module.createRequire(path.join(root, 'package.json'))
const ts = requireRoot('typescript')
const source = name => fs.readFileSync(path.join(root, name), 'utf8')
function load(name, mocks = {}) {
  const filename = path.join(root, name), mod = new Module(filename)
  mod.filename = filename
  mod.require = id => id in mocks ? mocks[id] : requireRoot(id)
  mod._compile(ts.transpileModule(source(name), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename)
  return mod.exports
}
class NextResponse extends Response { static json(body, init) { return Response.json(body, init) } }
const nextServer = { NextResponse }
const schema = load('src/lib/popup/schema.ts')
const siteKey = 'k'.repeat(24), siteId = 's'.repeat(24), popupId = 'p'.repeat(24)
const site = { id: siteId, siteKey, domain: 'example.com', deletedAt: null, lastSeenAt: new Date(), allowedUrls: [] }
const creative = { headline: 'Contact us', buttonLabel: 'Contact', buttonUrl: 'https://example.com/contact' }
const popup = { id: popupId, siteId, userId: 'owner', name: 'Current offer', kind: 'cta', status: 'paused',
  sortOrder: 0, creative, trigger: { type: 'delay', delaySec: 600 },
  targeting: { device: 'all', pathMode: 'all', paths: [] }, frequency: { hideDays: 0, oncePerSession: false },
  reason: null, updatedAt: new Date(), site: { allowedUrls: [] } }
let actor = 'owner', siteWrites = 0, statsWrites = 0
const db = {
  popupSite: {
    findUnique: async ({ where, select }) => {
      assert.deepEqual(Object.keys(select).sort(), ['deletedAt', 'domain', 'id', 'lastSeenAt'])
      return where.siteKey === siteKey ? site : null
    },
    updateMany: async () => { siteWrites++; return { count: 1 } },
  },
  popup: {
    findFirst: async ({ where }) => {
      if (where.userId) return where.id === popupId && where.userId === popup.userId && !site.deletedAt ? popup : null
      if (where.status) return where.id === popupId && popup.status === 'live' && where.site.siteKey === siteKey && !site.deletedAt
        ? { id: popup.id, site: { domain: site.domain } } : null
      throw Error('Unexpected popup read')
    },
    update: async ({ where, data }) => {
      assert.equal(where.id, popupId)
      Object.assign(popup, data, { updatedAt: new Date() })
      return popup
    },
    findMany: async ({ where, orderBy, take, select }) => {
      assert.equal(where.siteId, siteId); assert.equal(where.status, 'live'); assert.equal(take, 20)
      assert.deepEqual(orderBy, [{ sortOrder: 'asc' }, { createdAt: 'asc' }])
      assert.deepEqual(Object.keys(select).sort(), ['creative', 'frequency', 'id', 'kind', 'targeting', 'trigger'])
      return popup.status === 'live' ? [popup] : []
    },
  },
  $executeRaw: async (strings, ...values) => {
    assert.match(strings.join('?'), /INSERT INTO "popup_stat"/)
    assert.equal(values[0], popupId)
    statsWrites++
    return 1
  },
}
const publicFns = load('src/lib/popup/public.ts', { './schema': schema })
const stats = load('src/lib/popup/stats.ts', { '@/lib/prisma': { prisma: db }, './schema': schema })
const dto = load('src/lib/popup/dto.ts', { './schema': schema, './stats': stats })
const write = load('src/lib/popup/popup-write.ts', {
  '@/lib/prisma': { prisma: db }, '@/lib/asklink/link': { checkQuestion: () => { throw Error('CTA must not ask AI') }, buildChatgptUrl: () => { throw Error('CTA must not ask AI') } },
  './schema': schema, './dto': dto,
})
const patch = load('src/app/api/popup/popups/[id]/route.ts', {
  'next/server': nextServer, '@/lib/prisma': { prisma: db },
  '@/lib/popup/access': { getPopupUserId: async () => actor, ownPopup: () => { throw Error('DELETE not exercised here') } },
  '@/lib/popup/schema': schema, '@/lib/popup/popup-read': { getPopupForEdit: () => { throw Error('GET not exercised') } },
  '@/lib/popup/popup-write': write,
})
const config = load('src/app/api/popup/public/config/route.ts', {
  'next/server': nextServer, '@/lib/prisma': { prisma: db }, '@/lib/popup/schema': schema,
  '@/lib/popup/dto': dto, '@/lib/popup/public': publicFns,
})
const track = load('src/app/api/popup/public/track/route.ts', {
  'next/server': nextServer, '@/lib/prisma': { prisma: db }, '@/lib/popup/schema': schema,
  '@/lib/popup/stats': stats, '@/lib/popup/public': publicFns,
})
const headers = new Headers({ Origin: 'https://example.com' })
const request = (url, body) => ({ nextUrl: new URL(url), headers, json: async () => body,
  text: async () => JSON.stringify(body) })
const patchStatus = async status => patch.PATCH(request('https://app.invalid', { status }), { params: Promise.resolve({ id: popupId }) })
const readConfig = async (key = siteKey, requestHeaders = headers) => config.GET({ nextUrl: new URL('https://app.invalid/api/popup/public/config?k=' + key), headers: requestHeaders })
const sendTrack = async () => track.POST({ headers, text: async () => JSON.stringify({ k: siteKey, p: popupId, e: 'impression', t: 'main' }) })
function memoryStore() {
  const items = new Map()
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) }
}
async function embedPage(popups) {
  const listeners = new Map(), intervals = [], timeouts = [], calls = []
  const location = { href: 'https://example.com/start', pathname: '/start', search: '', hostname: 'example.com', host: 'example.com' }
  const currentScript = { src: 'https://app.invalid/popup/embed.js', getAttribute: key => key === 'data-site' ? siteKey : null }
  const document = { currentScript, querySelectorAll: () => [], readyState: 'complete' }
  const window = {
    fetch: async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ popups, track: 'https://app.invalid/api/popup/public/track' }) } },
    localStorage: memoryStore(), sessionStorage: memoryStore(), innerWidth: 1200,
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    matchMedia: () => ({ matches: false }),
  }
  const context = { window, document, location, URL, Date, Math, fetch: window.fetch,
    setInterval: fn => { intervals.push(fn); return intervals.length }, clearInterval: () => {},
    setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length }, clearTimeout: () => {} }
  vm.runInNewContext(source('public/popup/embed.js'), context, { filename: 'actual-embed.js' })
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  return { calls, intervals, timeouts, listeners, location, window }
}
;(async () => {
  // Before version's old SWR header fails this exact check; current candidate keeps TTL 60 only.
  let r = await patchStatus('live'); assert.equal(r.status, 200); assert.equal(popup.status, 'live')
  r = await readConfig(); assert.equal(r.status, 200)
  assert.equal(r.headers.get('Cache-Control'), 'public, max-age=0, s-maxage=60')
  assert.equal(r.headers.get('Vary'), 'Origin')
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://example.com')
  const body = await r.json(); assert.equal(body.popups.length, 1)
  assert.equal(body.popups[0].headline, 'Contact us'); assert.equal(body.popups[0].userId, undefined)
  assert.equal(siteWrites, 0, 'recent lastSeenAt must suppress a new write')
  r = await sendTrack(); assert.equal(r.status, 204); assert.equal(statsWrites, 1)

  r = await patchStatus('paused'); assert.equal(r.status, 200); assert.equal(popup.status, 'paused')
  r = await readConfig(); assert.equal(r.status, 200); assert.deepEqual((await r.json()).popups, [])
  r = await sendTrack(); assert.equal(r.status, 404); assert.equal(statsWrites, 1, 'paused track adds zero')
  actor = 'foreign'; r = await patchStatus('live'); assert.equal(r.status, 404)
  assert.equal(popup.status, 'paused'); actor = 'owner'
  r = await readConfig('bad'); assert.equal(r.status, 404)
  r = await readConfig(siteKey, new Headers({ Origin: 'https://foreign.invalid' })); assert.equal(r.status, 403)
  assert.equal(r.headers.get('Cache-Control'), 'no-store')
  site.deletedAt = new Date(); r = await readConfig(); assert.equal(r.status, 404); site.deletedAt = null
  r = await patchStatus('live'); assert.equal(r.status, 200)
  r = await readConfig(); assert.equal((await r.json()).popups.length, 1, 'fresh config resumes only after explicit live')

  const oldPage = await embedPage([body.popups[0]])
  assert.equal(oldPage.calls.length, 1); assert.equal(oldPage.intervals.length, 1)
  oldPage.location.href = 'https://example.com/next'; oldPage.location.pathname = '/next'
  oldPage.intervals[0](); oldPage.listeners.get('popstate')()
  assert.equal(oldPage.calls.length, 1, 'SPA checks already fetched config; does not refetch')
  const emptyPage = await embedPage([])
  emptyPage.location.href = 'https://example.com/next'; emptyPage.intervals.forEach(fn => fn())
  assert.equal(emptyPage.calls.length, 1, 'initially empty page never starts a refetch watch')
  r = await patchStatus('paused'); assert.equal(r.status, 200)
  const freshPage = await embedPage((await (await readConfig()).json()).popups)
  assert.equal(freshPage.calls.length, 1); assert.equal(freshPage.intervals.length, 0)
  assert.equal(oldPage.calls.length, 1, 'open old page retains fetched live config until its own reload')
  console.log(JSON.stringify({ passed: 8, actualRouteWriteHelper: true, actualConfigTrack: true,
    cacheHeader: 'public, max-age=0, s-maxage=60', livePausedFresh: true, pausedTrackStatus: 404,
    foreignWriteStatus: 404, embedOldPageFetches: oldPage.calls.length, embedEmptyPageFetches: emptyPage.calls.length,
    freshPausedPageFetches: freshPage.calls.length, scope: 'synthetic auth/Prisma and plain VM only; no CDN/browser/provider' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
