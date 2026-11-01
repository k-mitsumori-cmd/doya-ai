// 実InstallCardとCopyButtonをSSR→hydrateし、設置確認日時の日本時間表示を検査する。
process.env.NODE_ENV = 'development'
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..'), req = name => require(path.join(root, 'node_modules', name))
const React = req('react'), { renderToString } = req('react-dom/server'), ts = req('typescript'), { JSDOM } = req('jsdom')
const file = 'src/app/(shell)/popup/sites/[id]/SiteDetailClient.tsx'
function extract(file, name) {
  const source = fs.readFileSync(file, 'utf8'), sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const fn = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert(fn, name + ' must exist in actual source')
  return fn.getText(sf).replace(/^function /, 'export function ')
}
const copy = extract(path.join(root, 'src/components/popup/ui.tsx'), 'CopyButton')
const sourcePath = process.env.DOYA_POPUP_INSTALL_TIME_BASELINE || path.join(root, file)
const card = extract(sourcePath, 'InstallCard')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(copy + '\n' + card, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports: exportsObject, require: name => { assert.equal(name, 'react/jsx-runtime'); return req(name) }, useState: React.useState, Date,
  Check: () => React.createElement('svg'), Copy: () => React.createElement('svg'), CheckCircle2: () => React.createElement('svg'), CircleDashed: () => React.createElement('svg'),
  Image: ({ alt }) => React.createElement('span', { 'data-image': alt }),
  navigator: { clipboard: { writeText() { throw Error('No clipboard operation during SSR/hydration test') } } }, setTimeout, clearTimeout,
}, { filename: file })
const C = exportsObject.InstallCard, priorTz = process.env.TZ, priorFetch = global.fetch
const pairs = [['UTC', 'Asia/Tokyo'], ['Asia/Tokyo', 'UTC'], ['UTC', 'America/Los_Angeles']]
const timestamps = [
  { iso: '2026-10-18T23:29:00.000Z', label: '10/19 08:29' },
  { iso: '2026-12-31T23:59:00.000Z', label: '1/1 08:59' },
  { iso: '2026-01-01T00:01:00.000Z', label: '1/1 09:01' },
  { iso: null, label: null },
]
const results = [], report = { passed: 0, cases: results, sourcePath, sourceSha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'), scope: 'Actual InstallCard and actual CopyButton, React SSR/hydrateRoot/jsdom; synthetic site, decorative image/icons only. Three server/client zone pairs and day/year boundaries plus never-installed state. No real browser/network/DB/provider/clipboard.' }
const output = process.env.DOYA_POPUP_INSTALL_TIME_OUTPUT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/popup-install-time-hydration-results.json')
global.fetch = async () => { throw Error('Popup time hydration regression forbids network') }
global.IS_REACT_ACT_ENVIRONMENT = true
;(async () => {
  for (const timestamp of timestamps) for (const [serverTz, clientTz] of pairs) {
    const site = { id: 'synthetic-site', domain: 'example.invalid', embedCode: '<script data-site="synthetic"></script>', lastSeenAt: timestamp.iso }
    const before = JSON.stringify(site), element = () => React.createElement(C, { site })
    process.env.TZ = serverTz; const server = renderToString(element())
    process.env.TZ = clientTz; const client = renderToString(element())
    assert.equal(client, server, 'Server/client first markup must match for ' + timestamp.iso + ' ' + serverTz + '→' + clientTz)
    const dom = new JSDOM('<!doctype html><html><body><div id="root">' + server + '</div></body></html>', { url: 'https://example.invalid', pretendToBeVisual: true })
    const names = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event'], descriptors = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(global, name)]))
    for (const name of names) Object.defineProperty(global, name, { configurable: true, writable: true, value: name === 'window' ? dom.window : dom.window[name] })
    let mounted
    try {
      const container = dom.window.document.getElementById('root'), html = container.innerHTML, first = container.firstElementChild, recoverable = []
      if (timestamp.label) {
        assert(container.textContent.includes('設置を確認しました（' + timestamp.label + '）'))
        assert(!container.textContent.includes('まだ設置を確認できていません'))
      } else {
        assert(container.textContent.includes('まだ設置を確認できていません'))
        assert(!container.textContent.includes('設置を確認しました（'))
      }
      assert(!container.textContent.includes('Invalid Date'))
      assert.equal(container.querySelector('button').textContent, 'タグをコピー')
      assert.equal(container.querySelector('pre code').textContent, site.embedCode)
      await React.act(async () => { mounted = req('react-dom/client').hydrateRoot(container, element(), { onRecoverableError: e => recoverable.push(e.message) }); await new Promise(resolve => setTimeout(resolve, 0)) })
      assert.equal(recoverable.length, 0, 'Actual hydration must keep the server tree')
      assert.equal(container.innerHTML, html); assert.equal(container.firstElementChild, first); assert.equal(JSON.stringify(site), before)
      results.push({ timestamp: timestamp.iso, serverTz, clientTz, expectedJapanLabel: timestamp.label, firstMarkupMatched: true, recoverableErrors: 0, originalDomRetained: true, siteUnchanged: true })
      console.log('PASS Popup install time hydration: ' + (timestamp.iso || 'never-installed') + ' ' + serverTz + '→' + clientTz)
    } finally {
      if (mounted) await React.act(async () => mounted.unmount())
      dom.window.close()
      for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(global, name, descriptor); else delete global[name] }
    }
  }
  assert.equal(results.length, 12); report.passed = results.length
})().catch(e => { report.failure = { type: e.constructor.name, message: e.message.slice(0, 300) }; console.error(report.failure); process.exitCode = 1 }).finally(() => {
  if (priorTz === undefined) delete process.env.TZ; else process.env.TZ = priorTz
  global.fetch = priorFetch; fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, scope: report.scope }))
})
