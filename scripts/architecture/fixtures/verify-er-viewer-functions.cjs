// Source-only contract for the final generated viewer script. No browser, DOM package or renderer is used.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm')
const crypto = require('node:crypto'), { spawnSync } = require('node:child_process')
const generator = process.env.DOYA_ER_GENERATOR
const mode = process.env.DOYA_ER_EXPECT
assert(generator && path.isAbsolute(generator) && fs.statSync(generator).isFile())
assert(['before', 'after'].includes(mode))
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
const owned = fs.mkdtempSync(path.join(os.tmpdir(), 'doya-er-viewer-'))
const deadline = setTimeout(() => { console.error('Source-only viewer fixture timed out'); process.exit(1) }, 5000)
const cases = []
const check = (name, fn) => fn().then(() => { cases.push(name); console.log('PASS ' + name) })
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const tick = async () => { await Promise.resolve(); await Promise.resolve() }
function element() {
  let html = '', text = ''
  return {
    value: '', disabled: false, style: {}, children: [],
    get innerHTML() { return html }, set innerHTML(value) { html = value; text = '' },
    get textContent() { return text }, set textContent(value) { text = value; html = '' },
    replaceChildren() { this.children = [] }, append(item) { this.children.push(item) },
    querySelector(selector) { return selector === 'svg' && html.includes('<svg') ? { style: {} } : null },
  }
}
function fixture(script) {
  const nodes = Object.fromEntries(['nav', 'search', 'title', 'status', 'canvas', 'dictionary', 'svg', 'mmd', 'fit', 'summary'].map(id => [id, element()]))
  const renders = [], blobs = [], urls = [], clicks = [], timers = [], config = []
  const window = {}, document = { getElementById: id => nodes[id], createElement: tag => tag === 'a'
    ? { click() { clicks.push({ name: this.download, href: this.href }) } }
    : { click() { if (this.onclick) return this.onclick() } } }
  const mermaid = { initialize: options => config.push(options), render: (id, code) => {
    const d = deferred(); renders.push({ id, code, ...d }); return d.promise
  } }
  class Blob { constructor(parts, options) { this.parts = parts; this.type = options.type; blobs.push(this) } }
  const URL = { createObjectURL(blob) { const uri = 'blob:synthetic-' + urls.length; urls.push({ uri, blob }); return uri },
    revokeObjectURL(uri) { const item = urls.find(value => value.uri === uri); assert(item); item.revoked = true } }
  vm.runInNewContext(script, { window, document, mermaid, Blob, URL, setTimeout: fn => timers.push(fn), Error, String, Object }, { filename: 'generated-final-viewer.js' })
  assert.equal(config.length, 1)
  assert.equal(config[0].securityLevel, 'strict')
  const next = code => { const render = renders.find(item => item.code === code && !item.settled); assert(render, 'Expected renderer request: ' + code); render.settled = true; return render }
  const save = () => { nodes.svg.onclick(); return { blobs: blobs.length, urls: urls.length, clicks: clicks.length } }
  return { nodes, window, renders, blobs, urls, clicks, timers, next, save, flushTimers: () => { for (const run of timers.splice(0)) run() } }
}
;(async () => {
  const charts = [
    { id: 'overview', title: 'Overview', names: ['M'], code: 'graph overview' },
    { id: 'A', title: 'Chart A', names: ['M'], code: 'graph A' },
    { id: 'B', title: 'Chart B', names: ['M'], code: 'graph B' },
  ]
  const data = { manifest: { date: '2099-01-01', sourceCommit: 'a'.repeat(40), models: 1, relations: 0, publicServices: 1 }, charts, models: { M: { raw: 'M { id String PK }' } } }
  const dataBytes = Buffer.from(JSON.stringify(data))
  const mermaidBytes = Buffer.from('/* synthetic dependency bytes; the library script is never executed */')
  fs.writeFileSync(path.join(owned, 'data.json'), dataBytes)
  fs.writeFileSync(path.join(owned, 'mermaid.js'), mermaidBytes)
  fs.writeFileSync(path.join(owned, 'manifest.json'), JSON.stringify({ date: data.manifest.date, sourceCommit: data.manifest.sourceCommit,
    outputSha256: { 'data.json': sha(dataBytes), 'mermaid.js': sha(mermaidBytes) } }))
  const generated = spawnSync('python3', [generator, '--root', owned, '--input-dir', owned, '--out-dir', owned, '--date', data.manifest.date], { encoding: 'utf8', timeout: 10000 })
  assert.equal(generated.status, 0, generated.stderr || generated.stdout)
  const html = fs.readFileSync(path.join(owned, 'index.html'), 'utf8')
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1])
  assert.equal(scripts.length, 2)
  const script = scripts[1]
  new vm.Script(script)
  if (mode === 'before') {
    await check('before initial pending SVG handler passes undefined into Blob', async () => {
      const f = fixture(script)
      f.save()
      assert.equal(f.blobs.length, 1)
      assert.equal(f.blobs[0].parts[0], undefined)
    })
    await check('before stale A failure overwrites ready B', async () => {
      const f = fixture(script), first = f.window.show('A'), second = f.window.show('B')
      f.next('graph B').resolve({ svg: '<svg>B</svg>' }); await second
      assert.equal(f.nodes.canvas.innerHTML, '<svg>B</svg>')
      f.next('graph A').reject(Error('old A failure')); await assert.rejects(first)
      assert.equal(f.nodes.canvas.textContent, '描画できませんでした')
    })
  } else {
    await check('initial pending SVG is blocked, current ready saves exact SVG and filename', async () => {
      const f = fixture(script)
      assert.equal(f.nodes.svg.disabled, true)
      assert.deepEqual(f.save(), { blobs: 0, urls: 0, clicks: 0 })
      f.next('graph overview').resolve({ svg: '<svg>Overview</svg>' }); await tick()
      assert.equal(f.nodes.svg.disabled, false)
      f.save(); assert.deepEqual(Array.from(f.blobs[0].parts), ['<svg>Overview</svg>'])
      assert.equal(f.clicks[0].name, 'er-overview.svg')
      f.flushTimers(); assert.equal(f.urls[0].revoked, true)
    })
    await check('current failure stays visible and explicit retry can save', async () => {
      const f = fixture(script), current = f.window.show('A')
      f.next('graph A').reject(Error('current failure')); assert.equal(await current, false)
      assert.equal(f.nodes.status.textContent, 'current failure')
      assert.equal(f.nodes.svg.disabled, true); assert.equal(f.save().blobs, 0)
      const retry = f.window.show('A'); f.next('graph A').resolve({ svg: '<svg>A retry</svg>' }); assert.equal(await retry, true)
      f.save(); assert.deepEqual(Array.from(f.blobs[0].parts), ['<svg>A retry</svg>'])
    })
    await check('stale A rejection cannot replace ready B', async () => {
      const f = fixture(script), first = f.window.show('A'), second = f.window.show('B')
      f.next('graph B').resolve({ svg: '<svg>B</svg>' }); assert.equal(await second, true)
      f.next('graph A').reject(Error('old A failure')); assert.equal(await first, false)
      assert.equal(f.nodes.title.textContent, 'Chart B'); assert.equal(f.nodes.canvas.innerHTML, '<svg>B</svg>')
      assert.equal(f.nodes.dictionary.textContent, 'M { id String PK }'); assert.equal(f.nodes.status.textContent, '1モデル')
      f.save(); assert.deepEqual(Array.from(f.blobs[0].parts), ['<svg>B</svg>']); assert.equal(f.clicks[0].name, 'er-B.svg')
    })
    await check('stale A success and A-B-A ABA cannot adopt the old attempt', async () => {
      const f = fixture(script), oldA = f.window.show('A'), b = f.window.show('B')
      f.next('graph B').resolve({ svg: '<svg>B</svg>' }); await b
      f.next('graph A').resolve({ svg: '<svg>old A</svg>' }); assert.equal(await oldA, false)
      assert.equal(f.nodes.canvas.innerHTML, '<svg>B</svg>')
      const g = fixture(script), oldAgain = g.window.show('A'), middle = g.window.show('B'), current = g.window.show('A')
      const aRenders = g.renders.filter(item => item.code === 'graph A')
      assert.equal(aRenders.length, 2)
      aRenders[1].settled = true; aRenders[1].resolve({ svg: '<svg>fresh A</svg>' }); assert.equal(await current, true)
      aRenders[0].settled = true; aRenders[0].reject(Error('stale same-id A')); assert.equal(await oldAgain, false)
      assert.equal(g.nodes.canvas.innerHTML, '<svg>fresh A</svg>')
      g.save(); assert.deepEqual(Array.from(g.blobs[0].parts), ['<svg>fresh A</svg>']); assert.equal(g.clicks[0].name, 'er-A.svg')
      g.next('graph B').resolve({ svg: '<svg>late B</svg>' }); assert.equal(await middle, false)
    })
    await check('pending selection ignores previous cache and renderAll cache alone cannot enable SVG', async () => {
      const f = fixture(script)
      f.next('graph overview').resolve({ svg: '<svg>Overview</svg>' }); await tick()
      const pending = f.window.show('B')
      assert.equal(f.nodes.svg.disabled, true); assert.equal(f.nodes.canvas.innerHTML, '')
      assert.deepEqual(f.save(), { blobs: 0, urls: 0, clicks: 0 })
      const all = f.window.renderAll()
      f.next('graph A').resolve({ svg: '<svg>A cache</svg>' }); await tick()
      const bRenders = f.renders.filter(item => item.code === 'graph B')
      assert.equal(bRenders.length, 2)
      bRenders[1].settled = true; bRenders[1].resolve({ svg: '<svg>B cache</svg>' }); await all
      assert.equal(f.nodes.svg.disabled, true); assert.equal(f.save().blobs, 0)
      bRenders[0].settled = true; bRenders[0].resolve({ svg: '<svg>B current</svg>' }); assert.equal(await pending, true)
      f.save(); assert.deepEqual(Array.from(f.blobs[0].parts), ['<svg>B current</svg>'])
      const cached = await f.window.show('A')
      assert.equal(cached, true); f.save(); assert.deepEqual(Array.from(f.blobs[1].parts), ['<svg>A cache</svg>'])
    })
    await check('pending Mermaid source is exact, invalid id and malformed SVG do not unlock save', async () => {
      const f = fixture(script), pending = f.window.show('A')
      f.nodes.mmd.onclick(); assert.deepEqual(Array.from(f.blobs[0].parts), ['graph A']); assert.equal(f.clicks[0].name, 'er-A.mmd')
      assert.equal(await f.window.show('missing'), false); assert.equal(f.nodes.title.textContent, 'Chart A')
      f.next('graph A').resolve({ svg: undefined }); assert.equal(await pending, false)
      assert.equal(f.nodes.svg.disabled, true); assert.equal(f.save().blobs, 1)
      const retry = f.window.show('A')
      f.next('graph A').resolve({ svg: '<svg>A current</svg>' }); assert.equal(await retry, true)
      assert.equal(await f.window.show('missing'), false)
      assert.equal(f.nodes.svg.disabled, false); assert.equal(f.nodes.canvas.innerHTML, '<svg>A current</svg>')
      f.save(); assert.deepEqual(Array.from(f.blobs[1].parts), ['<svg>A current</svg>'])
      assert.equal(f.clicks[1].name, 'er-A.svg')
    })
  }
  console.log(JSON.stringify({ mode, passed: cases.length, cases, generatorSha256: sha(fs.readFileSync(generator)),
    dataSha256: sha(dataBytes), generatedHtmlSha256: sha(Buffer.from(html)), inlineSha256: sha(Buffer.from(script)),
    rendererCalls: 0, browserCalls: 0, networkCalls: 0, temporaryDirectory: 'owned; finally cleanup',
    scope: 'Generated inline JS with plain fake elements and deferred Mermaid stub only.' }))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { clearTimeout(deadline); fs.rmSync(owned, { recursive: true, force: true }) })
