// Actual SiteDetailClient with synthetic React, NextAuth, router and HTTP. No DB or external requests.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..')
const requireRoot = Module.createRequire(path.join(root, 'package.json'))
const React = requireRoot('react'), { createRoot } = requireRoot('react-dom/client')
const { JSDOM } = requireRoot('jsdom'), ts = requireRoot('typescript')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/popup/sites/aaaaaaaaaaaaaaaaaaaa' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const no = () => null
const SITE_A = 'aaaaaaaaaaaaaaaaaaaa', SITE_B = 'bbbbbbbbbbbbbbbbbbbb'
const POP_A = 'pppppppppppppppppppp', POP_B = 'qqqqqqqqqqqqqqqqqqqq'
let sdk = { status: 'authenticated', actor: 'userA' }, pushes = [], requests = [], toasts = []
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const source = file => fs.readFileSync(path.join(root, file), 'utf8')
function load(file, mocks = {}) {
  const filename = path.join(root, file), mod = new Module(filename)
  mod.filename = filename
  mod.require = id => id in mocks ? mocks[id] : requireRoot(id)
  mod._compile(ts.transpileModule(source(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename)
  return mod.exports
}
const actualSchema = load('src/lib/popup/schema.ts')
const actualCallback = load('src/lib/safe-signin-callback.ts')
const stableShow = value => toasts.push(value)
const mocks = {
  react: React, 'react/jsx-runtime': requireRoot('react/jsx-runtime'),
  'next/image': { default: no, __esModule: true },
  'next/link': { default: ({ href, children }) => React.createElement('a', { href }, children), __esModule: true },
  'next/navigation': { useRouter: () => ({ push: url => pushes.push(url) }) },
  'next-auth/react': { useSession: () => ({ status: sdk.status, data: sdk.actor ? { user: { id: sdk.actor } } : null }) },
  'lucide-react': new Proxy({}, { get: () => no }),
  '@/lib/popup/schema': actualSchema,
  '@/lib/safe-signin-callback': actualCallback,
  '@/components/popup/PopupPreview': { default: no, __esModule: true },
  '@/components/popup/ui': {
    ConfirmDialog: ({ onConfirm, onCancel }) => React.createElement('div', null,
      React.createElement('button', { onClick: onConfirm }, 'confirm'),
      React.createElement('button', { onClick: onCancel }, 'cancel')),
    CopyButton: no,
    DaysSwitch: ({ onChange }) => React.createElement('div', null,
      ...[7, 30, 90].map(d => React.createElement('button', { key: d, onClick: () => onChange(d) }, `days-${d}`))),
    EmptyState: ({ action }) => action,
    ErrorState: ({ message, onRetry }) => React.createElement('div', null, message,
      React.createElement('button', { onClick: onRetry }, 'retry')),
    KindBadge: no, PageHeader: ({ title, action }) => React.createElement('header', null, title, action),
    SkeletonDetail: () => React.createElement('div', null, 'skeleton'),
    StatTile: ({ label }) => React.createElement('div', null, label), StatusBadge: no,
    fmt: String, frequencyText: () => '', pct: String, summaryText: () => '', targetingText: () => '',
    useToast: () => ({ show: stableShow, node: null }),
  },
}
const Component = load('src/app/(shell)/popup/sites/[id]/SiteDetailClient.tsx', mocks).default
const popup = (id = POP_A) => ({ id, name: `Popup ${id}`, status: 'draft', kind: 'cta', reason: null,
  targeting: {}, frequency: {}, issues: [], sortOrder: 0,
  totals: { impressions: 0, clicks: 0, closes: 0, ctr: null } })
const dto = (id = SITE_A, days = 30, popups = []) => ({ days, site: { id, name: `Site ${id}`,
  sourceUrl: 'https://example.invalid', domain: 'example.invalid', lastSeenAt: null,
  embedCode: 'tag', totals: { impressions: 0, clicks: 0, closes: 0, ctr: null } }, popups })
const flush = async () => { await new Promise(done => setImmediate(done)) }
const act = async fn => React.act(async () => { await fn(); await flush() })
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent === text)
const clicks = text => { const b = button(text); assert(b, `missing button ${text}`); b.click() }
async function setup({ id = SITE_A, actor = 'userA', serverActor = actor, popups = [], created = false, strict = false } = {}) {
  sdk = { status: 'authenticated', actor }; pushes = []; requests = []; toasts = []
  global.fetch = (url, options) => { const header = deferred(); requests.push({ url: String(url), options, header }); return header.promise }
  const instance = createRoot(document.getElementById('root'))
  const render = async (props = {}) => act(() => {
    const view = React.createElement(Component,
      { initial: dto(props.id || id, 30, props.popups || popups), serverActorId: props.serverActor || serverActor, created })
    instance.render(strict ? React.createElement(React.StrictMode, null, view) : view)
  })
  await render()
  return { instance, render, unmount: () => act(() => instance.unmount()) }
}
const respond = async (req, body, status = 200) => act(() => req.header.resolve({ ok: status >= 200 && status < 300,
  status, json: async () => body }))
const check = async (name, fn) => { try { await fn(); console.log('PASS', name) } catch (error) { console.error('FAIL', name, error); process.exitCode = 1 } }
;(async () => {
  await check('StrictMode remount keeps the current site usable', async () => {
    const app = await setup({ strict: true })
    try {
      assert.equal(requests.length, 1, 'the replayed mount must re-read the current actor/site')
      await respond(requests[0], dto(SITE_A, 30))
      assert.match(document.body.textContent, /Site aaaaaaaaaaaaaaaaaaaa/)
      assert.doesNotMatch(document.body.textContent, /skeleton/)
      assert.equal(button('一から作る').disabled, false)
    } finally { await app.unmount() }
  })
  await check('latest period wins when old response arrives last', async () => {
    const app = await setup()
    try {
      await act(() => clicks('days-7')); const old = requests[0]
      await act(() => clicks('days-90')); const now = requests[1]
      await respond(now, dto(SITE_A, 90))
      assert.match(document.body.textContent, /表示（90日）/)
      await respond(old, dto(SITE_A, 7))
      assert.match(document.body.textContent, /表示（90日）/)
    } finally { await app.unmount() }
  })
  await check('add completion after unmount cannot navigate', async () => {
    const app = await setup()
    await act(() => clicks('画像で作る')); const req = requests[0]
    await app.unmount(); await respond(req, { popup: { id: POP_A } })
    assert.deepEqual(pushes, [])
  })
  await check('current add success preserves edit navigation', async () => {
    const app = await setup()
    try { await act(() => clicks('画像で作る')); await respond(requests[0], { popup: { id: POP_A } })
      assert.deepEqual(pushes, [`/popup/edit/${POP_A}`]) }
    finally { await app.unmount() }
  })
  await check('7→90→7 request ABA keeps the third response', async () => {
    const app = await setup()
    try {
      await act(() => clicks('days-7')); const first = requests[0]
      await act(() => clicks('days-90')); const second = requests[1]
      await act(() => clicks('days-7')); const third = requests[2]
      await respond(third, dto(SITE_A, 7))
      await respond(second, dto(SITE_A, 90)); await respond(first, dto(SITE_A, 7))
      assert.match(document.body.textContent, /表示（7日）/)
      assert.equal(button('days-7') !== undefined, true)
    } finally { await app.unmount() }
  })
  await check('late old body and wrong-site or wrong-days DTO cannot replace the current view', async () => {
    const app = await setup()
    try {
      await act(() => clicks('days-7')); const old = requests[0], body = deferred()
      await act(() => old.header.resolve({ ok: true, status: 200, json: () => body.promise }))
      await act(() => clicks('days-90')); const now = requests[1]
      await respond(now, dto(SITE_A, 90))
      await act(() => body.resolve(dto(SITE_A, 7)))
      assert.match(document.body.textContent, /表示（90日）/)
      await act(() => clicks('days-7'))
      await respond(requests[2], dto(SITE_B, 7))
      assert.match(document.body.textContent, /集計を読み込めませんでした/)
      await act(() => clicks('retry'))
      await respond(requests[3], dto(SITE_A, 30))
      assert.match(document.body.textContent, /集計を読み込めませんでした/)
      await act(() => clicks('retry'))
      await respond(requests[4], dto(SITE_A, 7))
      assert.match(document.body.textContent, /表示（7日）/)
    } finally { await app.unmount() }
  })
  await check('same-tick double add sends one POST and malformed returned IDs never navigate', async () => {
    for (const invalid of ['x/y', 'x?y', 'x#y', '', {}, null]) {
      const app = await setup()
      try {
        await act(() => { clicks('画像で作る'); clicks('画像で作る') })
        assert.equal(requests.length, 1)
        await respond(requests[0], { popup: { id: invalid } })
        assert.deepEqual(pushes, [])
      } finally { await app.unmount() }
    }
  })
  await check('actor and SDK loading retire an old add without navigation', async () => {
    const app = await setup()
    try {
      await act(() => clicks('画像で作る')); const old = requests[0]
      sdk = { status: 'loading', actor: 'userA' }; await app.render()
      assert.doesNotMatch(document.body.textContent, /Site aaaaaaaaaaaaaaaaaaaa/)
      await respond(old, { popup: { id: POP_A } })
      assert.deepEqual(pushes, [])
      sdk = { status: 'authenticated', actor: 'userA' }; await app.render()
      assert.equal(requests.length, 2)
      await respond(requests[1], dto(SITE_A, 30))
      assert.match(document.body.textContent, /Site aaaaaaaaaaaaaaaaaaaa/)
    } finally { await app.unmount() }
  })
  await check('site A→B and actor A→B→A reject old add and re-read current site', async () => {
    const app = await setup()
    try {
      await act(() => clicks('画像で作る')); const old = requests[0]
      await app.render({ id: SITE_B })
      assert.equal(requests[1].url, `/api/popup/sites/${SITE_B}?days=30`)
      await respond(old, { popup: { id: POP_A } }); assert.deepEqual(pushes, [])
      await respond(requests[1], dto(SITE_B, 30))
      sdk = { status: 'authenticated', actor: 'userB' }; await app.render({ id: SITE_B })
      assert.doesNotMatch(document.body.textContent, /Site bbbbbbbbbbbbbbbbbbbb/)
      sdk = { status: 'authenticated', actor: 'userA' }; await app.render({ id: SITE_B })
      assert.equal(requests[2].url, `/api/popup/sites/${SITE_B}?days=30`)
      await respond(requests[2], dto(SITE_B, 30))
      assert.match(document.body.textContent, /Site bbbbbbbbbbbbbbbbbbbb/)
    } finally { await app.unmount() }
  })
  await check('pagehide and persisted pageshow discard old completion and re-read', async () => {
    const app = await setup()
    try {
      await act(() => clicks('画像で作る')); const old = requests[0]
      await act(() => window.dispatchEvent(new window.Event('pagehide')))
      await respond(old, { popup: { id: POP_A } }); assert.deepEqual(pushes, [])
      const event = new window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true })
      await act(() => window.dispatchEvent(event))
      assert.equal(requests[1].url, `/api/popup/sites/${SITE_A}?days=30`)
      await respond(requests[1], dto(SITE_A, 30))
      assert.match(document.body.textContent, /Site aaaaaaaaaaaaaaaaaaaa/)
    } finally { await app.unmount() }
  })
  await check('BFCache 500 and foreign DTO expose neutral retry without old private data', async () => {
    for (const failure of [{ body: {}, status: 500 }, { body: dto(SITE_B, 30), status: 200 }]) {
      const app = await setup()
      try {
        const page = document.querySelector('.pd-page')
        await act(() => window.dispatchEvent(new window.Event('pagehide')))
        assert.equal(page.hidden, true)
        const event = new window.Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true })
        await act(() => window.dispatchEvent(event))
        assert.equal(requests.length, 1)
        await respond(requests[0], failure.body, failure.status)
        assert.equal(page.hidden, false)
        assert.equal(page.hasAttribute('inert'), false)
        assert.match(document.body.textContent, /もう一度お試しください/)
        assert.doesNotMatch(document.body.textContent, /設置タグ/)
        await act(() => clicks('retry'))
        assert.equal(requests.length, 2)
        await respond(requests[1], dto(SITE_A, 30))
        assert.match(document.body.textContent, /設置タグ/)
      } finally { await app.unmount() }
    }
  })
  await check('current publish and undo keep one scoped PATCH each', async () => {
    const app = await setup({ popups: [popup()] })
    try {
      await act(() => clicks('公開する'))
      assert.equal(requests.length, 1); assert.equal(requests[0].options.method, 'PATCH')
      await respond(requests[0], {})
      assert.equal(requests[1].url, `/api/popup/sites/${SITE_A}?days=30`)
      await respond(requests[1], dto(SITE_A, 30, [popup()]))
      assert.match(toasts.at(-1).message, /公開しました/)
      await act(() => toasts.at(-1).undo())
      assert.equal(requests[2].options.method, 'PATCH')
      await respond(requests[2], {})
      await respond(requests[3], dto(SITE_A, 30, [popup()]))
      assert.deepEqual(pushes, [])
    } finally { await app.unmount() }
  })
  await check('old undo after pagehide cannot send PATCH', async () => {
    const app = await setup({ popups: [popup()] })
    try {
      await act(() => clicks('公開する')); await respond(requests[0], {})
      await respond(requests[1], dto(SITE_A, 30, [popup()]))
      const undo = toasts.at(-1).undo, count = requests.length
      await act(() => window.dispatchEvent(new window.Event('pagehide')))
      await act(() => undo())
      assert.equal(requests.length, count)
    } finally { await app.unmount() }
  })
  await check('current pause, duplicate, reorder and popup delete retain their request contracts', async () => {
    {
      const app = await setup({ popups: [{ ...popup(), status: 'live' }] })
      try {
        await act(() => clicks('停止する'))
        assert.equal(requests[0].options.method, 'PATCH')
        assert.deepEqual(JSON.parse(requests[0].options.body), { status: 'paused' })
        await respond(requests[0], {}); await respond(requests[1], dto(SITE_A, 30, [popup()]))
        assert.match(toasts.at(-1).message, /停止しました/)
      } finally { await app.unmount() }
    }
    {
      const app = await setup({ popups: [popup()] })
      try {
        await act(() => document.querySelector('[aria-label="複製"]').click())
        assert.equal(requests[0].options.method, 'POST')
        assert.deepEqual(JSON.parse(requests[0].options.body), { duplicateOf: POP_A })
        await respond(requests[0], {}); await respond(requests[1], dto(SITE_A, 30, [popup()]))
        assert.match(toasts.at(-1).message, /複製しました/)
      } finally { await app.unmount() }
    }
    {
      const app = await setup({ popups: [popup(POP_A), { ...popup(POP_B), sortOrder: 1 }] })
      try {
        await act(() => document.querySelector('[aria-label="下へ"]').click())
        assert.equal(requests.length, 2)
        assert.deepEqual(requests.map(r => JSON.parse(r.options.body).sortOrder).sort(), [0, 1])
        await respond(requests[0], {}); await respond(requests[1], {})
        await respond(requests[2], dto(SITE_A, 30, [popup(POP_B), popup(POP_A)]))
        assert.deepEqual(pushes, [])
      } finally { await app.unmount() }
    }
    {
      const app = await setup({ popups: [popup()] })
      try {
        await act(() => document.querySelector('[aria-label="削除"]').click())
        await act(() => clicks('confirm'))
        assert.equal(requests[0].options.method, 'DELETE')
        await respond(requests[0], {}); await respond(requests[1], dto(SITE_A, 30))
        assert.match(toasts.at(-1).message, /削除しました/)
      } finally { await app.unmount() }
    }
  })
  await check('late popup mutation responses cannot show toast, error or refresh after unmount', async () => {
    for (const scenario of [
      { click: () => clicks('公開する'), popups: [popup()] },
      { click: () => document.querySelector('[aria-label="複製"]').click(), popups: [popup()] },
      { click: () => document.querySelector('[aria-label="削除"]').click(), popups: [popup()], confirm: true },
    ]) {
      const app = await setup({ popups: scenario.popups })
      await act(() => scenario.click())
      if (scenario.confirm) await act(() => clicks('confirm'))
      const old = requests[0], before = requests.length
      await app.unmount()
      await respond(old, {})
      assert.equal(requests.length, before)
      assert.equal(toasts.length, 0)
      assert.deepEqual(pushes, [])
    }
  })
  await check('delete site current failure is visible and busy clears', async () => {
    const app = await setup()
    try {
      await act(() => clicks('このサイトを削除する'))
      await act(() => clicks('confirm'))
      assert.equal(requests[0].options.method, 'DELETE')
      await act(() => requests[0].header.reject(Error('network')))
      assert.match(document.body.textContent, /network/)
      assert.equal(button('このサイトを削除する').disabled, false)
      assert.deepEqual(pushes, [])
    } finally { await app.unmount() }
  })
  await check('delete site current success navigates once; old delete cannot navigate', async () => {
    {
      const app = await setup()
      try {
        await act(() => clicks('このサイトを削除する')); await act(() => clicks('confirm'))
        await respond(requests[0], {})
        assert.deepEqual(pushes, ['/popup'])
      } finally { await app.unmount() }
    }
    {
      const app = await setup()
      await act(() => clicks('このサイトを削除する')); await act(() => clicks('confirm'))
      const old = requests[0]
      await app.unmount(); await respond(old, {})
      assert.deepEqual(pushes, [])
    }
  })
  await check('uncertain add timeout unlocks the current view without automatic retry', async () => {
    const app = await setup()
    const originalSetTimeout = global.setTimeout
    let expire = null
    try {
      global.setTimeout = (fn, ms, ...args) => {
        if (ms === 15_000) { expire = fn; return originalSetTimeout(fn, 60_000) }
        return originalSetTimeout(fn, ms, ...args)
      }
      await act(() => clicks('一から作る'))
      assert.equal(requests.length, 1)
      assert.equal(requests[0].options.method, 'POST')
      assert.equal(typeof expire, 'function')
      await act(() => expire())
      assert.match(document.body.textContent, /結果を確認できませんでした/)
      assert.equal(button('一から作る').disabled, false)
      assert.equal(requests.length, 1)
      assert.deepEqual(pushes, [])
    } finally { global.setTimeout = originalSetTimeout; await app.unmount() }
  })
  await check('late old read 401 cannot take over a newer period', async () => {
    const app = await setup()
    try {
      await act(() => clicks('days-7'))
      const old = requests[0]
      await act(() => clicks('days-90'))
      await respond(requests[1], dto(SITE_A, 90))
      const before = window.location.href
      await respond(old, {}, 401)
      assert.equal(window.location.href, before)
      assert.match(document.body.textContent, /Site aaaaaaaaaaaaaaaaaaaa/)
      assert.equal(requests.length, 2)
    } finally { await app.unmount() }
  })
  await check('actual page binds owner read and server actor without revealing foreign or absent sites', async () => {
    let serverActor = 'userA', reads = []
    const prisma = { popupSite: { findFirst: async query => {
      reads.push(query.where)
      return query.where.userId === 'userA' && query.where.id === SITE_A ? { id: SITE_A, popups: [] } : null
    } } }
    const totals = { impressions: 0, clicks: 0, closes: 0, ctr: null }
    const actualRead = load('src/lib/popup/popup-read.ts', {
      './schema': actualSchema,
      './dto': { toSiteDto: site => ({ ...dto(site.id).site, totals }), toPopupDto: () => { throw Error('unexpected popup') } },
      './stats': { sumTotals: () => totals, sinceDay: () => new Date(), ymd: () => '', emptyTotals: () => totals },
    })
    const page = load('src/app/(shell)/popup/sites/[id]/page.tsx', {
      'react/jsx-runtime': requireRoot('react/jsx-runtime'),
      'next/navigation': { redirect: url => { throw Object.assign(Error('redirect'), { url }) } },
      '@/lib/prisma': { prisma }, '@/lib/popup/access': { getPopupUserId: async () => serverActor },
      '@/lib/popup/popup-read': actualRead, '@/lib/popup/schema': actualSchema,
      '@/components/popup/ui': { ForbiddenState: no },
      './SiteDetailClient': { default: no, __esModule: true },
    }).default
    const props = (id, created = '1') => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ created }) })
    const own = await page(props(SITE_A))
    assert.equal(own.props.serverActorId, 'userA')
    assert.equal(own.props.initial.site.id, SITE_A)
    assert.equal(own.props.created, true)
    assert.equal(own.key, `userA:${SITE_A}`)
    assert.deepEqual(reads.at(-1), { id: SITE_A, userId: 'userA', deletedAt: null })
    serverActor = 'userB'
    const foreign = await page(props(SITE_A))
    assert.equal(foreign.type, 'div')
    assert.equal(foreign.props.children.type, no)
    assert.deepEqual(reads.at(-1), { id: SITE_A, userId: 'userB', deletedAt: null })
    const beforeInvalid = reads.length
    await page(props('not-valid'))
    assert.equal(reads.length, beforeInvalid)
    serverActor = null
    await assert.rejects(() => page(props(SITE_A)), error => error.url === `/auth/signin?callbackUrl=/popup/sites/${SITE_A}`)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
