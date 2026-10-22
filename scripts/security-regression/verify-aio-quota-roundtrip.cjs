process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const crypto = require('node:crypto')
const root = process.env.DOYA_SOURCE_ROOT || path.resolve(__dirname, '../..')
const sourceRoot = process.env.AIO_SOURCE_ROOT || process.env.DOYA_TEST_BASELINE || root
const phase = process.env.AIO_PHASE === 'before' ? 'before' : process.env.AIO_PHASE === 'candidate' ? 'candidate' : ''
const requireRepo = Module.createRequire(path.join(root, 'package.json'))
const ts = requireRepo('typescript')
const React = requireRepo('react')
const { JSDOM } = requireRepo('jsdom')
const { createRoot } = requireRepo('react-dom/client')
const { renderToStaticMarkup } = requireRepo('react-dom/server')
const dom = new JSDOM('<main id="root"></main>', { url: 'https://example.invalid/aio/A' })
global.window = dom.window
global.document = dom.window.document
global.CustomEvent = dom.window.CustomEvent
global.IS_REACT_ACT_ENVIRONMENT = true
const sourceHashes = {}
let mocks = {}, cache = new Map()
function load(rel) {
  const key = `${mocks.__phase || ''}:${rel}`
  if (cache.has(key)) return cache.get(key).exports
  const overlay = path.join(sourceRoot, phase, rel)
  const filename = rel === 'src/app/(shell)/aio/pricing/page.tsx' && process.env.AIO_PRICING_BASELINE
    ? process.env.AIO_PRICING_BASELINE : fs.existsSync(overlay) ? overlay : path.join(root, rel)
  const mod = new Module(filename)
  cache.set(key, mod)
  mod.require = id => {
    if (id in mocks) return mocks[id]
    if (id === './services') return load('src/lib/services.ts')
    if (id === './unified-plan' || id === '@/lib/unified-plan') return load('src/lib/unified-plan.ts')
    if (id === './organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    if (id === '@/lib/organization-workspace-selection') return load('src/lib/organization-workspace-selection.ts')
    if (id === '@/lib/service-limit-ui') return load('src/lib/service-limit-ui.ts')
    throw Error(`Unmocked ${id} from ${rel}`)
  }
  const bytes = fs.readFileSync(filename)
  sourceHashes[rel] = crypto.createHash('sha256').update(bytes).digest('hex')
  mod._compile(ts.transpileModule(bytes.toString('utf8'), { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename)
  return mod.exports
}
const tick = () => new Promise(resolve => setImmediate(resolve))
const act = fn => React.act(async () => { await fn(); await tick(); await tick(); await tick() })
const link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
const NextResponse = Response
let role = 'owner', plan = 'FREE', guest = false, activeSlug = 'A', result = { status: 'failed', code: 'LIMIT', error: '無料プランは直近7日間で1回までスキャンできます。', upgradeAvailable: true }
let calls = { provider: 0, usage: 0, promptCreate: 0 }
const ctx = () => ({ userId: 'actor', memberId: 'member', organizationId: 'org-A', organizationSlug: activeSlug, role })
const orgFrom = req => new URL(req.url).searchParams.get('org') || undefined
const apiPrisma = {
  aioBrandProfile: { findUnique: async () => ({ brandName: 'A Brand' }) },
  aioPrompt: { findMany: async () => [{ id: 'p', text: 'Question' }] },
  $transaction: async fn => fn({
    $queryRaw: async () => [{ id: 'org-A' }],
    aioPrompt: { count: async () => 3, create: async () => { calls.promptCreate++; return { id: 'new' } } },
  }),
}
mocks = {
  __phase: 'scan', 'next/server': { NextResponse }, '@prisma/client': { Prisma: {} },
  '@/lib/prisma': { prisma: apiPrisma },
  '@/lib/aio/access': { getAioContext: async slug => !guest && slug === activeSlug ? ctx() : null, orgSlugFrom: orgFrom },
  '@/lib/aio/types': { availableEngines: () => ['gemini'], AIO_FREE_PROMPT_LIMIT: 3 },
  '@/lib/aio/run': { runAndPersistScan: async () => result },
  '@/lib/aio/scan-cursor': {}, '@/lib/aio/coverage': {},
  '@/lib/service-usage': { recordServiceUsage: async () => { calls.usage++ } },
  '@/lib/pricing': { HIGH_USAGE_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
}
const scans = load('src/app/api/aio/scans/route.ts')
mocks = {
  ...mocks, __phase: 'prompt',
  '@/lib/aio/access': { getAioContext: async slug => !guest && slug === activeSlug ? ctx() : null,
    hasMinRole: current => ['owner', 'admin', 'manager'].includes(current), orgSlugFrom: orgFrom },
  '@/lib/aio/prompt-mutation': {
    lockPromptActor: async () => ({ role }), promptBody: x => x,
    promptIdForOperation: () => 'id', promptOperationId: x => x,
  },
  '@/lib/aio/billing': { getAioBilling: async () => ({ plan }) },
}
const prompts = load('src/app/api/aio/prompts/route.ts')
async function apiReply(kind) {
  const req = new Request(`https://example.invalid/api/aio/${kind}?org=${encodeURIComponent(activeSlug)}`, { method: 'POST', body: kind === 'prompts' ? JSON.stringify({ text: 'Question' }) : '{}' })
  return kind === 'scans' ? scans.POST(req) : prompts.POST(req)
}
async function modal(reply, expected) {
  let session = { user: { id: 'actor', plan: 'FREE' } }
  let navigation = '/aio/A'
  window.fetch = async () => reply.clone()
  mocks = {
    __phase: 'provider', react: React, 'react/jsx-runtime': requireRepo('react/jsx-runtime'),
    'react-dom': requireRepo('react-dom'), 'next-auth/react': { useSession: () => ({ data: session, status: 'authenticated' }) },
    'next/navigation': { usePathname: () => navigation, useSearchParams: () => new URLSearchParams() },
    '@/components/TrialCallout': { TrialNote: () => null, useTrialEligible: () => false, TRIAL_DAYS: 30 },
    '@/lib/pricing': { HIGH_USAGE_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
    '@/lib/plan-utils': { tierFrom: () => 'FREE' },
  }
  const Provider = load('src/components/limits/ServiceLimitProvider.tsx').default
  const mounted = createRoot(document.getElementById('root'))
  await act(() => mounted.render(React.createElement(Provider)))
  const original = await window.fetch(`/api/aio/scans?org=${encodeURIComponent(activeSlug)}`, { method: 'POST' })
  assert.equal(original.status, reply.status)
  await act(async () => {})
  const dialog = document.querySelector('[role=dialog]')
  if (expected === null) assert.equal(dialog, null)
  else {
    assert.ok(dialog, 'actual observer reaches actual provider')
    const links = [...dialog.querySelectorAll('a')].map(a => a.getAttribute('href'))
    assert.deepEqual(links, expected)
  }
  await act(() => mounted.unmount())
  return dialog ? [...dialog.querySelectorAll('a')].map(a => a.getAttribute('href')) : []
}
let pricingSeq = 0
async function pricing(href, expected) {
  const url = new URL(href, 'https://example.invalid')
  let selected = null, billingFor = null, props = null, scopeExpected = null
  mocks = {
    __phase: `pricing-${++pricingSeq}`, 'react/jsx-runtime': requireRepo('react/jsx-runtime'),
    'next/link': { __esModule: true, default: link },
    'next/navigation': { redirect: () => { throw Error('unexpected checkout return marker') } },
    'next-auth': { getServerSession: async () => ({ user: { id: 'actor' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/aio/billing-return-route': { aioReturnRedirect: () => null },
    '@/components/UnifiedPricingPlans': { UnifiedPricingPlans: p => { props = p; return React.createElement('div', { 'data-pricing': true }) } },
    '@/components/aio/AioPricingScope': { AioPricingScope: ({ expected: value }) => {
      scopeExpected = value
      props = { currentPlan: value.plan, planSource: 'organization', canPurchase: value.role === 'owner' }
      return React.createElement('div', { 'data-scope': true })
    } },
    '@/components/aio/ui': { DoyaKun: () => null },
    '@/lib/aio/access': { getAioContext: async slug => { selected = slug; return slug === activeSlug ? { userId: 'actor', organizationId: 'org-A', organizationSlug: activeSlug, role: 'owner' } : slug === 'B' ? { userId: 'actor', organizationId: 'org-B', organizationSlug: 'B', role: 'owner' } : null } },
    '@/lib/aio/billing': { getAioBilling: async (_, id) => { billingFor = id; return { plan: id === 'org-A' ? 'PRO' : 'FREE' } } },
    '@/lib/prisma': { prisma: {} },
  }
  const page = load('src/app/(shell)/aio/pricing/page.tsx')
  const html = renderToStaticMarkup(await page.default({ searchParams: Promise.resolve(url.search ? { org: url.searchParams.get('org') } : {}) }))
  assert.equal(selected, expected.selected)
  assert.equal(billingFor, expected.billingFor)
  assert.equal(props?.planSource, expected.planSource)
  assert.equal(props?.currentPlan, expected.plan)
  assert.equal(props?.canPurchase, expected.canPurchase)
  if (expected.planSource === 'organization') {
    assert.equal(scopeExpected?.actorId, 'actor')
    assert.equal(scopeExpected?.organizationId, expected.billingFor)
    assert.equal(scopeExpected?.slug, expected.selected)
  } else assert.equal(scopeExpected, null)
  if (expected.back) assert.ok(html.includes(`href="${expected.back}"`))
}
// The production organization POST truncates names at 120 characters. Its actual
// access helper may append a collision suffix; neither slug is a made-up URL ID.
async function createdSlugs() {
  let duplicate = false, locks = 0, writes = 0
  const tx = {
    aioMember: { findFirst: async () => null, create: async () => { writes++ } },
    aioOrganization: {
      findUnique: async () => duplicate ? { id: 'existing' } : null,
      create: async ({ data }) => ({ id: 'org-A', ...data }),
    },
  }
  const prisma = { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(tx) } }
  mocks = {
    __phase: 'creator-access', 'next-auth': { getServerSession: async () => ({ user: { id: 'actor' } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
    '@/lib/account-lifecycle/store': { lockLifecycleUsers: async () => { locks++ }, assertRetirementMembershipWritable: async () => {} },
    './types': { ROLE_HIERARCHY: { member: 0, manager: 1, admin: 2, owner: 3 } },
  }
  const access = load('src/lib/aio/access.ts')
  mocks = {
    __phase: 'creator-route', 'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'actor' } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
    '@/lib/account-lifecycle/state': { LifecycleError: class LifecycleError extends Error {} },
    '@/lib/aio/access': access,
  }
  const route = load('src/app/api/aio/organization/route.ts')
  const create = async () => {
    const response = await route.POST({ json: async () => ({ name: 'a'.repeat(130), memberName: 'Member' }) })
    assert.equal(response.status, 200)
    return (await response.json()).organization.slug
  }
  const base = await create()
  duplicate = true
  const suffixed = await create()
  assert.equal(base, 'a'.repeat(120))
  assert.match(suffixed, /^a{120}-[0-9]+$/)
  assert.ok(suffixed.length > 120)
  assert.equal(writes, 2)
  assert.equal(locks, 2)
  return [base, suffixed]
}
async function main() {
  const scan = await apiReply('scans')
  assert.equal(scan.status, 402)
  const body = await scan.clone().json()
  assert.equal(body.code, 'LIMIT')
  assert.equal(body.canManageBilling, true)
  const target = '/aio/pricing?org=A'
  if (phase === 'before') {
    assert.equal(body.upgradeUrl, '/aio/pricing')
    const hrefs = await modal(scan, ['/aio/pricing'])
    await pricing(hrefs[0], { selected: null, billingFor: null, planSource: 'account', plan: undefined, canPurchase: true })
    result = { ...result, upgradeAvailable: false }
    const paid = await apiReply('scans')
    assert.equal((await paid.clone().json()).pricingUrl, undefined)
    const paidLinks = await modal(paid, ['https://doyamarke.surisuta.jp/contact', '/aio/pricing'])
    await pricing(paidLinks[1], { selected: null, billingFor: null, planSource: 'account', plan: undefined, canPurchase: true })
    console.log('OBSERVED BEFORE: org A LIMIT -> generic account pricing without A')
  } else {
    assert.equal(body.upgradeUrl, target)
    const hrefs = await modal(scan, [target])
    await pricing(hrefs[0], { selected: 'A', billingFor: 'org-A', planSource: 'organization', plan: 'PRO', canPurchase: true, back: '/aio/A' })
    const prompt = await apiReply('prompts')
    assert.equal((await prompt.clone().json()).upgradeUrl, target)
    await modal(prompt, [target])
    result = { ...result, upgradeAvailable: false }
    const paid = await apiReply('scans')
    const paidBody = await paid.clone().json()
    assert.equal(paidBody.contactUrl, 'https://doyamarke.surisuta.jp/contact')
    assert.equal(paidBody.pricingUrl, target)
    await modal(paid, ['https://doyamarke.surisuta.jp/contact', target])
    for (const created of await createdSlugs()) {
      activeSlug = created
      result = { ...result, upgradeAvailable: true }
      const longScan = await apiReply('scans')
      const longHref = `/aio/pricing?org=${encodeURIComponent(created)}`
      assert.equal((await longScan.clone().json()).upgradeUrl, longHref)
      await modal(longScan, [longHref])
      await pricing(longHref, { selected: created, billingFor: 'org-A', planSource: 'organization', plan: 'PRO', canPurchase: true, back: `/aio/${encodeURIComponent(created)}` })
    }
    activeSlug = '日本語'
    result = { ...result, upgradeAvailable: true }
    const unicode = await apiReply('scans')
    const unicodeHref = `/aio/pricing?org=${encodeURIComponent(activeSlug)}`
    assert.equal((await unicode.clone().json()).upgradeUrl, unicodeHref)
    await modal(unicode, [unicodeHref])
    activeSlug = 'bad/slug'
    const malformed = await apiReply('scans')
    assert.equal((await malformed.clone().json()).upgradeUrl, undefined)
    await modal(malformed, [])
    activeSlug = 'A'
    await pricing('/aio/pricing?org=foreign', { selected: 'foreign', billingFor: null, planSource: undefined, plan: undefined, canPurchase: undefined })
    role = 'manager'
    result = { ...result, upgradeAvailable: true }
    const managerScan = await apiReply('scans')
    assert.equal((await managerScan.clone().json()).canManageBilling, false)
    await modal(managerScan, [])
    const managerPrompt = await apiReply('prompts')
    assert.equal(managerPrompt.status, 402)
    assert.equal((await managerPrompt.clone().json()).upgradeUrl, undefined)
    await modal(managerPrompt, [])
    role = 'member'
    assert.equal((await apiReply('prompts')).status, 403)
    guest = true
    await modal(await apiReply('scans'), null)
    await modal(await apiReply('prompts'), null)
    guest = false
    role = 'owner'
    result = { status: 'failed', code: 'PROMPT_LIMIT', error: '1回のスキャンは30件までです。' }
    await modal(await apiReply('scans'), null)
    result = { status: 'failed', code: 'INFLIGHT', error: 'すでにスキャンを実行中です。', id: 'active' }
    await modal(await apiReply('scans'), null)
    result = { status: 'failed', error: 'AIエンジンで失敗しました。' }
    await modal(await apiReply('scans'), null)
    result = { status: 'done', id: 'normal', summary: {}, recommendations: [] }
    await modal(await apiReply('scans'), null)
    console.log('PASS after: scan, prompt and paid-contact retain org A')
  }
  assert.equal(calls.provider, 0)
  assert.equal(calls.usage, phase === 'before' ? 0 : 1)
  assert.equal(calls.promptCreate, 0)
  console.log(JSON.stringify({ phase, sourceHashes, calls }))
}
main().catch(e => { console.error(e); process.exitCode = 1 })
