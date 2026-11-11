const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { test } = require('node:test')

const route = 'src/app/(shell)/banner/dashboard/history/page.tsx'
const file = path.resolve(process.env.DOYA_TEST_BASELINE || path.join(__dirname, '../..'), route)
const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
const callbacks = new Map()
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['fetchFullImage', 'handleDownload'].includes(node.name.getText(ast))) {
    callbacks.set(node.name.getText(ast), node.initializer.getText(ast))
  }
  ts.forEachChild(node, visit)
}
visit(ast)
assert.equal(callbacks.size, 2)

const source = ts.transpileModule(
  Array.from(callbacks, ([name, code]) => `const ${name} = ${code};`).join('\n') + '\nexports.download = handleDownload;',
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText

async function checkStall(stage) {
  const exports = {}
  const timers = new Map()
  const signals = []
  const toasts = []
  const downloads = []
  let now = 0
  let nextId = 0
  const url = 'data:image/png;base64,c3ludGhldGlj'
  vm.runInNewContext(source, {
    exports, AbortController, encodeURIComponent, Date,
    window: {
      setTimeout(fn, ms) { timers.set(++nextId, { fn, deadline: now + ms }); return nextId },
      clearTimeout(id) { timers.delete(id) },
    },
    toast: Object.fromEntries(['loading', 'error', 'success'].map(name => [name, text => toasts.push({ name, text })])),
    document: {
      createElement() { return { click() { downloads.push({ url: this.href, filename: this.download }) } } },
      body: { appendChild() {}, removeChild() {} },
    },
    async fetch(request, options) {
      assert.equal(request, '/api/banner/history/image?id=audit%20image')
      const signal = options?.signal
      signals.push(signal)
      const stall = () => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('Stopped')), { once: true }))
      if (signals.length === 1 && stage === 'response') return stall()
      return { ok: true, json: () => signals.length === 1 ? stall() : Promise.resolve({ image: url }) }
    },
  })

  async function advance(ms) {
    now += ms
    for (const [id, timer] of timers) {
      if (timer.deadline > now) continue
      timers.delete(id)
      timer.fn()
    }
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }

  const first = exports.download('audit image', 2)
  await advance(14_999)
  assert.equal(timers.size, 1, `A ${stage} stall must keep the download deadline`)
  assert.equal(toasts.at(-1).name, 'loading')
  await advance(1)
  assert.equal(signals[0].aborted, true)
  await first
  assert.equal(toasts.at(-1).name, 'error')
  assert.match(toasts.at(-1).text, /タイムアウト.*再試行/)
  assert.equal(downloads.length, 0)
  assert.equal(timers.size, 0)

  await exports.download('audit image', 2)
  assert.equal(signals[1].aborted, false)
  assert.equal(toasts.at(-1).name, 'success')
  assert.equal(downloads.length, 1)
  assert.equal(downloads[0].url, url)
  assert.match(downloads[0].filename, /^doya_banner_\d+_2\.png$/)
  assert.equal(timers.size, 0)
  console.log(`PASS Banner history download ${stage} deadline and retry`)
}

test('Banner history download response deadline and retry', () => checkStall('response'))
test('Banner history download body deadline and retry', () => checkStall('body'))
