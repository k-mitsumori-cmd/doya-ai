const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { check } = require('./load-typescript.cjs')

const root = path.resolve(__dirname, '../..')

function sourceParts(file, names) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const parts = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
  assert.equal(parts.length, names.length)
  return parts.map(node => node.getText(parsed)).join('\n')
}

function harness(file, keyName, reader, writer, component) {
  const values = new Map()
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  let auth = { status: 'authenticated', data: { user: { id: 'account-a' } } }
  const source = `const ${keyName} = 'test-cache';\n${sourceParts(file, [reader, writer, component])}\nexports.reader=${reader};exports.writer=${writer};exports.page=${component};`
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, {
    exports, sessionStorage: storage, Date, JSON, Array,
    useSession: () => auth,
    useEffect: callback => callback(),
    BannerHistoryContent: () => null,
    StatsContent: () => null,
    require: name => name === 'react/jsx-runtime'
      ? { jsx: (_component, props, key) => ({ props, key }) }
      : (() => { throw new Error(`Unexpected import ${name}`) })(),
  })
  return { ...exports, values, setAuth: next => { auth = next } }
}

;(async () => {
  for (const config of [
    ['src/app/banner/dashboard/history/page.tsx', 'HISTORY_CACHE_KEY', 'readHistoryCache', 'writeHistoryCache', 'BannerHistoryPage'],
    ['src/app/banner/dashboard/stats/page.tsx', 'STATS_CACHE_KEY', 'readStatsCache', 'writeStatsCache', 'StatsPage'],
  ]) {
    const [file, keyName, reader, writer, component] = config
    await check(`${component} cache is scoped to its authenticated owner`, () => {
      const app = harness(file, keyName, reader, writer, component)
      const item = component === 'BannerHistoryPage'
        ? { id: 'private', createdAt: new Date(), banners: [], bannerCount: 1 }
        : { id: 'private', createdAt: new Date().toISOString(), bannerCount: 1 }
      app.writer('account-a', [item], null)
      assert.equal(app.reader('account-a').items[0].id, 'private')
      assert.equal(app.reader('account-b'), null)
      assert.equal(app.values.has('test-cache'), false)
      assert.equal(app.page().key, 'user:account-a')
      app.setAuth({ status: 'authenticated', data: { user: { id: 'account-b' } } })
      assert.equal(app.page().key, 'user:account-b')
      app.setAuth({ status: 'unauthenticated', data: null })
      assert.equal(app.page().key, 'status:unauthenticated')
      app.values.set('test-cache', JSON.stringify({ items: [item], ts: Date.now() }))
      assert.equal(app.reader('account-a'), null)
    })
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
