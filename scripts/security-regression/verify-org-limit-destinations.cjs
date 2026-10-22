const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const root = process.env.DOYA_SOURCE_ROOT || path.resolve(__dirname, '../..')
const candidate = process.env.DOYA_TEST_BASELINE || root
const req = Module.createRequire(path.join(root, 'package.json'))
const ts = req('typescript')
const cache = new Map()
function load(rel) {
  if (cache.has(rel)) return cache.get(rel).exports
  const filename = fs.existsSync(path.join(candidate, rel)) ? path.join(candidate, rel) : path.join(root, rel)
  const mod = new Module(filename)
  cache.set(rel, mod)
  mod.require = id => {
    if (id === './services') return load('src/lib/services.ts')
    if (id === './unified-plan') return load('src/lib/unified-plan.ts')
    if (id === './organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    throw Error('Unmocked ' + id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename)
  return mod.exports
}
const { classifyServiceLimit: classify } = load('src/lib/service-limit-ui.ts')
const cases = []
function check(name, expected, actual) { assert.deepEqual(actual, expected, name); cases.push(name) }
for (const service of ['quote', 'mensetsu', 'aishodan']) {
  const pathName = `/api/${service}/synthetic-staff-action`
  const base = { code: 'LIMIT_REACHED', error: '無料プランの上限に達しました。', canManageBilling: true }
  const scoped = `/` + service + `/pricing?org=A`
  const upgrade = classify(pathName, 402, { ...base, upgradeUrl: scoped })
  check(service + ' owner FREE scoped', { kind: 'quota', href: scoped, action: 'upgrade' },
    { kind: upgrade?.kind, href: upgrade?.pricingHref, action: upgrade?.action })
  const paid = classify(pathName, 402, { ...base, error: '今月の上限に達しました。', contactUrl: 'https://doyamarke.surisuta.jp/contact', pricingUrl: scoped })
  check(service + ' owner paid contact keeps secondary pricing', { kind: 'quota', href: scoped, action: 'contact' },
    { kind: paid?.kind, href: paid?.pricingHref, action: paid?.action })
  const unicode = `/${service}/pricing?org=${encodeURIComponent('日本語&部門')}`
  check(service + ' unicode org', unicode, classify(pathName, 402, { ...base, upgradeUrl: unicode })?.pricingHref)
  for (const [name, invalid] of [
    ['missing', undefined], ['different service', '/sfa/pricing?org=A'],
    ['duplicate org', `/${service}/pricing?org=A&org=B`],
    ['extra query', `/${service}/pricing?org=A&next=1`],
    ['external', `https://example.invalid/${service}/pricing?org=A`],
    ['scheme relative', `//example.invalid/${service}/pricing?org=A`],
    ['credentials', `https://user:pass@example.invalid/${service}/pricing?org=A`],
    ['bad escape', `/${service}/pricing?org=%ZZ`],
    ['encoded slash', `/${service}/pricing?org=A%2FB`],
    ['empty', `/${service}/pricing?org=`],
  ]) {
    const body = { ...base, ...(invalid === undefined ? {} : { upgradeUrl: invalid }) }
    check(service + ' ' + name + ' cannot self purchase', 'owner', classify(pathName, 402, body)?.kind)
  }
  check(service + ' nonowner cannot self purchase', 'owner', classify(pathName, 402, { ...base, canManageBilling: false })?.kind)
  check(service + ' conflicting destinations denied', 'owner', classify(pathName, 402,
    { ...base, upgradeUrl: scoped, pricingUrl: `/${service}/pricing?org=B` })?.kind)
  for (const [name, pricingUrl] of [
    ['paid missing origin', undefined],
    ['paid orgless origin', `/${service}/pricing`],
    ['paid foreign origin', `/sfa/pricing?org=A`],
    ['paid duplicate origin', `/${service}/pricing?org=A&org=B`],
  ]) {
    const limit = classify(pathName, 402, {
      ...base, error: '今月の上限に達しました。',
      contactUrl: 'https://doyamarke.surisuta.jp/contact', pricingUrl,
    })
    check(service + ' ' + name + ' cannot open default pricing',
      { kind: 'owner', action: 'contact' }, { kind: limit?.kind, action: limit?.action })
  }
}
check('public Aishodan preview excluded', null, classify('/api/aishodan/room/token/start', 429,
  { code: 'PREVIEW_DAILY_LIMIT', error: '本日の練習回数の上限に達しました。' }))
check('Shodan existing scoped behavior', '/shodan/pricing?org=alpha', classify('/api/shodan/preparations', 402,
  { code: 'LIMIT', canManageBilling: true, error: '無料プランの上限に達しました。', upgradeUrl: '/shodan/pricing?org=alpha' })?.pricingHref)
check('AIO owner LIMIT uses exact org', '/aio/pricing?org=alpha', classify('/api/aio/scan', 402,
  { code: 'LIMIT', canManageBilling: true, error: '無料プランの上限に達しました。', upgradeUrl: '/aio/pricing?org=alpha' })?.pricingHref)
console.log(JSON.stringify({ passed: cases.length, cases }, null, 2))
