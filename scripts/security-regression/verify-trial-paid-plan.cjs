// DB paid projection and the v2 checkout/trial-eligibility principal contract.
// Stripe, DB, and checkout coordinator are synthetic; the actual route builders and helper are loaded.
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const { routeUnitDeps, routeUnitGlobals, genericStart } = require('./checkout-route-unit-fixture.cjs')
const sameShape = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b))
const EMAIL = 'test@example.invalid'
const unifiedPlan = load('src/lib/unified-plan.ts')

function makeStripe(kind) {
  const calls = []
  const stripe = {
    customers: {
      list: async q => {
        calls.push('customers.list')
        if (kind === 'failure') throw Error('offline')
        return { data: [{ id: 'cus_1', email: q.email }], has_more: false }
      },
      retrieve: async id => {
        calls.push('customers.retrieve')
        if (kind === 'failure') throw Error('offline')
        return { id, email: EMAIL }
      },
    },
    subscriptions: {
      list: async () => {
        calls.push('subscriptions.list')
        if (kind === 'failure') throw Error('offline')
        return { data: kind === 'old' ? [{ id: 'sub_old', status: 'canceled' }] : [], has_more: false }
      },
    },
  }
  return { stripe, calls }
}

function loadTrial(kind) {
  const { stripe, calls } = makeStripe(kind)
  const mod = load('src/lib/trial.ts', { '@/lib/stripe': { stripe }, '@/lib/unified-plan': unifiedPlan })
  return { mod, calls }
}

function dbUser(plan, servicePlans) {
  return { id: 'u', email: EMAIL, stripeCustomerId: null, plan,
    serviceSubscriptions: (servicePlans || []).map(p => ({ plan: p })) }
}

function loadCheckout(trialMod, user, captured) {
  const prices = load('src/lib/stripe.ts', { stripe: function () {}, 'node:crypto': require('node:crypto'),
    './checkout-legacy-guard': load('src/lib/checkout-legacy-guard.ts') }).STRIPE_PRICE_IDS
  const prisma = { user: { findUnique: async query => {
    if (query.select) captured.select = query.select
    return user
  } } }
  return load('src/app/api/stripe/checkout/route.ts', {
    ...routeUnitDeps({ prisma, onStart: async request => {
      captured.args = request
      return { id: 'cs_checkout', url: 'https://offline.invalid/checkout' }
    } }),
    '@/lib/hr/organization-selection': load('src/lib/hr/organization-selection.ts'),
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u', email: EMAIL } }) },
    '@/lib/auth': {}, '@/lib/prisma': { prisma },
    '@/lib/unified-plan': { UNIFIED_TRIAL_DAYS: 30 }, '@/lib/trial': trialMod,
    '@/lib/stripe': { STRIPE_PRICE_IDS: { ...prices, banner: { ...prices.banner,
      pro: { monthly: 'price_synthetic', yearly: 'price_synthetic' } } },
      findActiveLikeSubscriptions: async () => [] },
  }, routeUnitGlobals)
}

function loadEligibility(trialMod, user, captured) {
  const prisma = { user: { findUnique: async query => { captured.select = query.select; return user } } }
  return load('src/app/api/stripe/trial-eligibility/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u', email: EMAIL } }) },
    '@/lib/auth': {}, '@/lib/prisma': { prisma }, '@/lib/trial': trialMod,
  })
}

const eligibilityRequest = () => ({ nextUrl: new URL('https://offline.invalid/api/stripe/trial-eligibility?expectedKind=authenticated&expectedActor=u') })
const postCheckout = api => api.POST(new Request('https://offline.invalid/api/stripe/checkout', {
  method: 'POST', body: JSON.stringify(genericStart()),
}))
function assertProjectionSelect(select, mod) {
  assert.equal(select.id, true)
  assert.equal(select.email, true)
  assert.equal(select.plan, true)
  sameShape(select.serviceSubscriptions, { select: { plan: true } })
  const { id, email, ...projection } = select
  sameShape(projection, mod.TRIAL_USER_SELECT)
}

;(async () => {
  for (const plan of ['PRO', 'pro', 'ENTERPRISE', 'BUNDLE', 'LIGHT']) {
    await check(`paid User.plan ${plan} is not eligible without querying Stripe`, async () => {
      const { mod, calls } = loadTrial('new')
      assert.equal(await mod.isTrialEligible({ email: EMAIL, stripeCustomerId: 'cus_1', plan, servicePlans: [] }), false)
      assert.deepEqual(calls, [])
    })
  }
  await check('paid service row is not eligible even when User.plan is FREE', async () => {
    const { mod, calls } = loadTrial('new')
    assert.equal(await mod.isTrialEligible({ email: EMAIL, plan: 'FREE', servicePlans: ['FREE', 'PRO'] }), false)
    assert.deepEqual(calls, [])
  })
  await check('paid DB user is not eligible even while Stripe is unavailable', async () => {
    const { mod, calls } = loadTrial('failure')
    assert.equal(await mod.isTrialEligible({ email: EMAIL, plan: 'PRO', servicePlans: [] }), false)
    assert.deepEqual(calls, [])
  })
  for (const plan of ['FREE', null, undefined, 'UNKNOWN']) {
    await check(`free user (${plan}) without Stripe history stays eligible`, async () => {
      const { mod, calls } = loadTrial('new')
      assert.equal(await mod.isTrialEligible({ email: EMAIL, plan, servicePlans: ['FREE'] }), true)
      assert.ok(calls.includes('customers.list'))
    })
  }
  await check('free user with Stripe history stays not eligible', async () => {
    const { mod } = loadTrial('old')
    assert.equal(await mod.isTrialEligible({ email: EMAIL, plan: 'FREE', servicePlans: [] }), false)
  })
  await check('free user rejects when Stripe is unavailable (fail-closed)', async () => {
    const { mod } = loadTrial('failure')
    await assert.rejects(mod.isTrialEligible({ email: EMAIL, plan: 'FREE', servicePlans: [] }))
  })

  const cases = [
    { name: 'paid DB user', kind: 'new', user: dbUser('PRO', ['PRO']), status: 200, trialDays: 0, stripeCalled: false },
    { name: 'paid service row only', kind: 'new', user: dbUser('FREE', ['PRO']), status: 200, trialDays: 0, stripeCalled: false },
    { name: 'free new user', kind: 'new', user: dbUser('FREE', ['FREE']), status: 200, trialDays: 30, stripeCalled: true },
    { name: 'free user with history', kind: 'old', user: dbUser('FREE', []), status: 200, trialDays: 0, stripeCalled: true },
    { name: 'free user during Stripe failure', kind: 'failure', user: dbUser('FREE', []), status: 503, stripeCalled: true },
  ]
  for (const c of cases) {
    await check(`checkout trial: ${c.name}`, async () => {
      const { mod, calls } = loadTrial(c.kind)
      const captured = {}
      const res = await postCheckout(loadCheckout(mod, c.user, captured))
      assert.equal(res.status, c.status)
      assertProjectionSelect(captured.select, mod)
      if (c.status === 503) {
        assert.equal((await res.json()).code, 'TRIAL_CHECK_UNAVAILABLE')
        assert.equal(captured.args, undefined)
      } else assert.equal(captured.args.terms.trialDays, c.trialDays)
      assert.equal(calls.length > 0, c.stripeCalled)
    })
  }

  const displayCases = [
    { name: 'paid DB user', kind: 'new', user: dbUser('PRO', ['PRO']), status: 200, eligible: false, stripeCalled: false },
    { name: 'paid service row only', kind: 'new', user: dbUser('FREE', ['ENTERPRISE']), status: 200, eligible: false, stripeCalled: false },
    { name: 'free new user', kind: 'new', user: dbUser('FREE', ['FREE']), status: 200, eligible: true, stripeCalled: true },
    { name: 'signed-in user without DB row', kind: 'new', user: null, status: 503, code: 'USER_UNAVAILABLE', stripeCalled: false },
    { name: 'free user during Stripe failure', kind: 'failure', user: dbUser('FREE', []), status: 503, code: 'TRIAL_CHECK_UNAVAILABLE', stripeCalled: true },
  ]
  for (const c of displayCases) {
    await check(`eligibility display: ${c.name}`, async () => {
      const { mod, calls } = loadTrial(c.kind)
      const captured = {}
      const res = await loadEligibility(mod, c.user, captured).GET(eligibilityRequest())
      assert.equal(res.status, c.status)
      assert.equal(res.headers.get('cache-control'), 'private, no-store')
      assert.match(res.headers.get('vary'), /Cookie/i)
      assertProjectionSelect(captured.select, mod)
      const body = await res.json()
      if (c.status === 200) assert.equal(body.eligible, c.eligible)
      else { assert.equal(body.code, c.code); assert.equal(Object.hasOwn(body, 'eligible'), false) }
      assert.equal(calls.length > 0, c.stripeCalled)
    })
  }

  await check('checkout and trial-eligibility share TRIAL_USER_SELECT', async () => {
    const { mod } = loadTrial('new')
    const a = {}, b = {}
    await postCheckout(loadCheckout(mod, dbUser('FREE', []), a))
    await loadEligibility(mod, dbUser('FREE', []), b).GET(eligibilityRequest())
    assertProjectionSelect(a.select, mod)
    assertProjectionSelect(b.select, mod)
    sameShape(a.select, b.select)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(e => { console.error(e); process.exitCode = 1 })
