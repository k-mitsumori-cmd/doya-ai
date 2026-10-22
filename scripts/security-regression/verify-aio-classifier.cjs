const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const root = process.env.DOYA_SOURCE_ROOT || path.resolve(__dirname, '../..')
const phase = process.env.AIO_PHASE === 'before' ? 'before' : process.env.AIO_PHASE === 'candidate' ? 'candidate' : ''
const requireRepo = Module.createRequire(path.join(root, 'package.json'))
const ts = requireRepo('typescript')
const fs = require('node:fs')
const base = process.env.AIO_SOURCE_ROOT || process.env.DOYA_TEST_BASELINE || root
const services = require(path.join(root, 'scripts/security-regression/load-typescript.cjs'))
const unified = services.load('src/lib/unified-plan.ts')
const actualServices = services.load('src/lib/services.ts', { './unified-plan': unified })
const selection = services.load('src/lib/organization-workspace-selection.ts')
const rel = 'src/lib/service-limit-ui.ts'
const file = path.join(base, phase, rel)
const mod = new Module(file)
mod.require = id => {
  if (id === './services') return actualServices
  if (id === './organization-workspace-selection') return selection
  throw Error(`Unmocked ${id}`)
}
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText, file)
const classify = mod.exports.classifyServiceLimit
const baseBody = { code: 'LIMIT', canManageBilling: true, error: '無料プランは直近7日間で1回までスキャンできます。' }
const good = '/aio/pricing?org=A'
for (const value of [
  '/aio/pricing', '/aio/pricing?org=', '/aio/pricing?org=A&org=B',
  '/aio/pricing?org=A&next=x', '/aio/pricing?org=A#frag',
  '//foreign.invalid/aio/pricing?org=A', 'https://foreign.invalid/aio/pricing?org=A',
  '/quote/pricing?org=A', '/aio/pricing?org=%2F',
  '/aio/pricing?org=A%26next%3Dx', '/aio/pricing?org=%ZZ',
]) {
  const result = classify('/api/aio/scans', 402, { ...baseBody, upgradeUrl: value })
  assert.equal(result?.kind, 'owner', value)
}
const unicode = '/aio/pricing?org=%E6%97%A5%E6%9C%AC%E8%AA%9E'
assert.equal(classify('/api/aio/scans', 402, { ...baseBody, upgradeUrl: unicode }).pricingHref, unicode)
assert.equal(classify('/api/aio/scans', 402, { ...baseBody, upgradeUrl: good }).pricingHref, good)
assert.equal(classify('/api/aio/scans', 402, { ...baseBody, upgradeUrl: good, pricingUrl: good }).kind, 'owner')
assert.equal(classify('/api/aio/scans', 402, { ...baseBody, upgradeUrl: good, pricingUrl: '/aio/pricing?org=B' }).kind, 'owner')
assert.equal(classify('/api/aio/scans', 402, { ...baseBody, canManageBilling: false, upgradeUrl: good }).kind, 'owner')
assert.equal(classify('/api/aio/scans', 402, { ...baseBody, canManageBilling: true, contactUrl: 'https://doyamarke.surisuta.jp/contact', pricingUrl: good }).action, 'contact')
assert.equal(classify('/api/aio/scans', 402, { ...baseBody, canManageBilling: true, contactUrl: 'https://doyamarke.surisuta.jp/contact', pricingUrl: good }).pricingHref, good)
assert.equal(classify('/api/aio/scans', 400, { code: 'PROMPT_LIMIT', error: '1回のスキャンは30件までです。' }), null)
assert.equal(classify('/api/aio/scans', 409, { code: 'INFLIGHT', error: 'すでにスキャンを実行中です。' }), null)
assert.equal(classify('/api/aio/scans', 500, { code: 'UNAVAILABLE', error: 'AIエンジン利用不可' }), null)
assert.equal(classify('/api/aio/quick-start', 402, { code: 'WORKSPACE_LIMIT', error: '登録できるワークスペースの上限に達しました。不要なワークスペースを整理してください。' }), null)
assert.equal(classify('/api/aio/scans', 200, { ...baseBody, upgradeUrl: good }), null)
console.log('PASS strict AIO LIMIT URL, owner, capacity and non-quota cases')
