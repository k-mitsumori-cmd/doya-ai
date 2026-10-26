// 汎用のエラー通知（runtime-alert）に、既知の警告の「種類の名前」だけを載せる（2026-10-26 統括の依頼）。
// 中身（console.error の引数）は通知にもログにも載せない。合わないときは今までどおり。オフラインの検査（Slack も DB も偽物）。
const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..') + path.sep
function load(file, mocks = {}, env = {}, globals = {}) {
  const exports = {}
  const ctx = vm.createContext({ exports, require: name => {
    if (name in mocks) return mocks[name]
    if (name.startsWith('node:')) return require(name)
    throw Error('Unmocked dependency: ' + name)
  }, process: { env }, console: { error() {}, warn() {} }, Error, Date, URL, Request, Headers, Uint8Array, TextDecoder, AbortSignal, ...globals })
  vm.runInContext(ts.transpileModule(fs.readFileSync(root + file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, ctx)
  return { exports, ctx }
}
const results = []
function runtime() {
  const logs = [], diagnostics = [], notifications = [], tasks = []
  const r = load('src/lib/runtime-alert.ts', {
    './slack-voice': { voicePayload: x => x },
    '@vercel/functions': { waitUntil: p => tasks.push(p) },
    './alert': { getAlertWebhook: async () => 'https://mock.invalid' },
    './runtime-alert-limit': { claimRuntimeAlert: async () => ({ state: 'allowed' }), releaseRuntimeAlertClaim: async () => {} },
  }, { VERCEL_ENV: 'production' }, { console: { error: (...a) => logs.push(a), warn: (...a) => diagnostics.push(a) }, fetch: async (u, o) => { notifications.push(JSON.parse(o.body)); return { ok: true } } })
  return { r, logs, diagnostics, notifications, tasks }
}
;(async () => {
  const { r } = runtime()
  const cases = [
    ['(node:7) MaxListenersExceededWarning: Possible EventTarget memory leak detected. 11 abort listeners added to [AbortSignal]. private-canary', 'max-listeners'],
    ['(node:7) ExperimentalWarning: The Fetch API is an experimental feature. private-canary', 'experimental'],
    ['[Anthropic] retrying request private-canary', 'anthropic-sdk'],
    ['[GoogleGenerativeAI Error]: private-canary', 'google-genai-sdk'],
    ['prisma:warn private-canary', 'prisma'],
    ['Warning: Each child in a list should have a unique "key" prop. private-canary', 'react-warning'],
    ['(node:7) [UNDICI-EHPA] Warning: EnvHttpProxyAgent is experimental private-canary', 'node-warning'],
    ['ordinary failure text private-canary', null],
    ['[shodan/preparations] research failed', null],
  ]
  for (const [text, kind] of cases) {
    const got = r.exports.warningKind([text])
    assert.equal(got, kind, text)
    if (got) assert.ok(r.exports.WARNING_KINDS.includes(got))
  }
  assert.equal(r.exports.warningKind([42]), null)
  assert.equal(r.exports.warningKind([]), null)
  results.push('known warning kinds are identified by fixed names only')

  // 合うとき: 通知とログには種類の名前だけが載り、中身は載らない
  {
    const t = runtime()
    t.r.exports.installRuntimeAlerts()
    t.r.ctx.console.error('(node:7) MaxListenersExceededWarning: Possible EventTarget memory leak detected. private-canary secret@example.com')
    await Promise.all(t.tasks)
    assert.equal(t.notifications.length, 1)
    const body = JSON.stringify(t.notifications)
    assert.match(body, /種類：max-listeners/)
    assert.ok(!body.includes('private-canary') && !body.includes('secret@example.com') && !body.includes('MaxListenersExceededWarning'), '通知に中身を載せない')
    const diag = JSON.stringify(t.diagnostics)
    assert.match(diag, /"warningKind":"max-listeners"/)
    assert.ok(!diag.includes('private-canary') && !diag.includes('secret@example.com'), 'ログ（診断の行）にも中身を載せない')
  }
  results.push('a matched kind sends only its name, never the content')

  // 合わないとき: 今までどおり（種類の行は無い）
  {
    const t = runtime()
    t.r.exports.installRuntimeAlerts()
    t.r.ctx.console.error('ordinary failure text private-canary')
    await Promise.all(t.tasks)
    assert.equal(t.notifications.length, 1)
    const body = JSON.stringify(t.notifications)
    assert.ok(!body.includes('種類：'))
    assert.ok(!body.includes('private-canary'))
    assert.ok(!JSON.stringify(t.diagnostics).includes('warningKind'))
  }
  results.push('unmatched errors behave as before (no kind line)')

  // 非推奨の警告（1つの引数）は、今までどおり通知しない
  {
    const t = runtime()
    t.r.exports.installRuntimeAlerts()
    t.r.ctx.console.error('(node:7) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized')
    await Promise.all(t.tasks)
    assert.equal(t.notifications.length, 0)
  }
  results.push('single-argument deprecation warnings stay silent')

  for (const r of results) console.log('PASS ' + r)
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(e => { console.error(e); process.exit(1) })
