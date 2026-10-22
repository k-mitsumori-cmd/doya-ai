// Actual EditClient save, publish, pause and undo copy with synthetic HTTP/React; no browser/CDN/DB.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..')
const requireRoot = Module.createRequire(path.join(root, 'package.json'))
const React = requireRoot('react'), { createRoot } = requireRoot('react-dom/client')
const { JSDOM } = requireRoot('jsdom'), ts = requireRoot('typescript')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/popup/edit/pppppppppppppppppppppppp' })
global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true
const no = () => null
function load(file, mocks = {}) {
  const filename = path.join(root, file), mod = new Module(filename); mod.filename = filename
  mod.require = id => id in mocks ? mocks[id] : requireRoot(id)
  const body = fs.readFileSync(filename, 'utf8')
  mod._compile(ts.transpileModule(body, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename)
  return mod.exports
}
const schema = load('src/lib/popup/schema.ts')
const toasts = [], requests = []
const id = 'p'.repeat(24), siteId = 's'.repeat(24)
const initial = { id, siteId, name: 'Current offer', kind: 'cta', status: 'paused', sortOrder: 0,
  creative: schema.sanitizeCreative({ headline: 'Contact', buttonLabel: 'Open', buttonUrl: 'https://example.com/contact' }),
  trigger: schema.DEFAULT_TRIGGER, targeting: schema.DEFAULT_TARGETING, frequency: schema.DEFAULT_FREQUENCY,
  imageUrl: null, reason: null, issues: [], totals: { impressions: 0, clicks: 0, closes: 0, ctr: null }, updatedAt: new Date().toISOString() }
const site = { id: siteId, name: 'Test site', pages: [], colors: [] }
let patchStatus = 200
const mocks = {
  react: React, 'react/jsx-runtime': requireRoot('react/jsx-runtime'),
  'lucide-react': new Proxy({}, { get: () => no }),
  '@/lib/popup/schema': schema,
  '@/components/popup/PopupPreview': { default: no, __esModule: true },
  '@/components/ds/charts': { AreaChart: no },
  '@/components/shell/ui-next-context': { useUiNext: () => false },
  '@/components/popup/ui': {
    DaysSwitch: no, ErrorState: ({ message }) => React.createElement('div', null, message),
    KindBadge: no, PageHeader: ({ title }) => React.createElement('h1', null, title),
    StatTile: no, StatusBadge: no, fmt: String,
    useToast: () => ({ show: item => toasts.push(item), node: null }),
  },
}
const EditClient = load('src/app/(shell)/popup/edit/[id]/EditClient.tsx', mocks).default
const act = async fn => React.act(async () => { await fn(); await new Promise(done => setImmediate(done)) })
const button = label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label)
global.fetch = async (url, init = {}) => {
  requests.push({ url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null })
  if (String(url).includes('/stats')) return Response.json({ days: 30, series: [], totals: initial.totals })
  if (patchStatus !== 200) return Response.json({ error: '保存できませんでした。' }, { status: patchStatus })
  return Response.json({ popup: { ...initial, status: JSON.parse(init.body).status || initial.status } })
}
;(async () => {
  const host = document.getElementById('root'), mount = createRoot(host)
  try {
    await act(() => mount.render(React.createElement(EditClient, { initialPopup: initial, site })))
    assert(button('公開する'), 'actual editor publish control')
    await act(() => button('公開する').click())
    const live = requests.filter(r => r.method === 'PATCH')
    assert.equal(live.length, 1); assert.equal(live[0].body.status, 'live')
    assert.match(toasts[0].message, /1分ほど待って対象サイトを再読み込み/)
    assert.equal(typeof toasts[0].undo, 'function')
    await act(() => toasts[0].undo())
    const writes = requests.filter(r => r.method === 'PATCH')
    assert.equal(writes.length, 2); assert.equal(writes[1].body.status, 'paused')
    assert.match(toasts[1].message, /開いたままのページには以前の設定が残る/)
    patchStatus = 500
    await act(() => button('公開する').click())
    assert.equal(requests.filter(r => r.method === 'PATCH').length, 3)
    assert.equal(toasts.length, 2, 'failed save must not announce publish')
    assert.match(document.body.textContent, /保存できませんでした/)
    console.log(JSON.stringify({ passed: 3, actualEditClient: true, livePatch: 1, undoPausedPatch: 1,
      failedPublishToast: 0, scope: 'synthetic HTTP and jsdom; no browser/CDN/DB' }))
  } finally { await act(() => mount.unmount()); dom.window.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
