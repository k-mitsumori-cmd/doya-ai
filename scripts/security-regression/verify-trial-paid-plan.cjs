// 初月無料の対象判定に DB の契約状態を加えたことの回帰テスト。
// - DB で有料（User.plan / UserServiceSubscription.plan）の利用者は、Stripe を照会せずに対象外
// - 無料で Stripe 履歴の無い利用者は今どおり対象
// - Stripe 照会の障害時は対象外（checkout は 503 で決済を作らない／表示 API は 503 eligible:false）
// - checkout と trial-eligibility が同じ select（TRIAL_USER_SELECT）と同じ判定を使う
// Stripe・DB・環境変数には触れず、すべてモックで確かめる。
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
// vm で読み込んだモジュールの値は別 realm のため、構造の比較は JSON で行う。
const sameShape = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b))

const EMAIL = 'test@example.invalid'
const unifiedPlan = load('src/lib/unified-plan.ts')

// kind: 'new'（履歴なし）/ 'old'（解約済み履歴あり）/ 'failure'（Stripe 照会が失敗）
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
  return {
    id: 'u',
    stripeCustomerId: null,
    plan,
    serviceSubscriptions: (servicePlans || []).map(p => ({ plan: p })),
  }
}

function loadCheckout(trialMod, user, captured) {
  const prices = load('src/lib/stripe.ts', { stripe: function () {}, 'node:crypto': require('node:crypto') }).STRIPE_PRICE_IDS
  return load('src/app/api/stripe/checkout/route.ts', {
    '@/lib/hr/organization-selection': load('src/lib/hr/organization-selection.ts'),
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { email: EMAIL } }) },
    '@/lib/auth': {},
    '@/lib/prisma': { prisma: { user: { findUnique: async q => { captured.select = q.select; return user } } } },
    '@/lib/unified-plan': { UNIFIED_TRIAL_DAYS: 30 },
    '@/lib/trial': trialMod,
    '@/lib/checkout-reservation': { CheckoutReservationError: class extends Error {}, createReservedCheckoutSession: ({ create }) => create('test-key', 1900000000) },
    '@/lib/stripe': {
      STRIPE_PRICE_IDS: prices,
      findActiveLikeSubscriptions: async () => [],
      createCheckoutSession: async a => { captured.args = a; return { id: 'checkout', url: 'https://offline.invalid' } },
    },
  })
}

function loadEligibility(trialMod, user, captured) {
  return load('src/app/api/stripe/trial-eligibility/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { email: EMAIL } }) },
    '@/lib/auth': {},
    '@/lib/prisma': { prisma: { user: { findUnique: async q => { captured.select = q.select; return user } } } },
    '@/lib/trial': trialMod,
  })
}

async function postCheckout(api) {
  return api.POST(new Request('https://offline.invalid', { method: 'POST', body: JSON.stringify({ planId: 'banner-pro' }) }))
}

;(async () => {
  // ---- 判定関数そのもの ----
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

  // ---- checkout（実付与）----
  const cases = [
    { name: 'paid DB user', kind: 'new', user: dbUser('PRO', ['PRO']), status: 200, trialDays: undefined, stripeCalled: false },
    { name: 'paid service row only', kind: 'new', user: dbUser('FREE', ['PRO']), status: 200, trialDays: undefined, stripeCalled: false },
    { name: 'free new user', kind: 'new', user: dbUser('FREE', ['FREE']), status: 200, trialDays: 30, stripeCalled: true },
    { name: 'free user with history', kind: 'old', user: dbUser('FREE', []), status: 200, trialDays: undefined, stripeCalled: true },
    { name: 'free user during Stripe failure', kind: 'failure', user: dbUser('FREE', []), status: 503, trialDays: undefined, stripeCalled: true },
  ]
  for (const c of cases) {
    await check(`checkout trial: ${c.name}`, async () => {
      const { mod, calls } = loadTrial(c.kind)
      const captured = {}
      const res = await postCheckout(loadCheckout(mod, c.user, captured))
      assert.equal(res.status, c.status)
      assert.equal(captured.select.plan, true)
      sameShape(captured.select.serviceSubscriptions, { select: { plan: true } })
      if (c.status === 503) {
        assert.equal((await res.json()).code, 'TRIAL_CHECK_UNAVAILABLE')
        assert.equal(captured.args, undefined)
      } else {
        assert.equal(captured.args.trialDays, c.trialDays)
      }
      assert.equal(calls.length > 0, c.stripeCalled)
    })
  }

  // ---- trial-eligibility（表示の出し分け）----
  const displayCases = [
    { name: 'paid DB user', kind: 'new', user: dbUser('PRO', ['PRO']), status: 200, eligible: false, stripeCalled: false },
    { name: 'paid service row only', kind: 'new', user: dbUser('FREE', ['ENTERPRISE']), status: 200, eligible: false, stripeCalled: false },
    { name: 'free new user', kind: 'new', user: dbUser('FREE', ['FREE']), status: 200, eligible: true, stripeCalled: true },
    { name: 'signed-in user without DB row', kind: 'new', user: null, status: 200, eligible: true, stripeCalled: true },
    { name: 'free user during Stripe failure', kind: 'failure', user: dbUser('FREE', []), status: 503, eligible: false, stripeCalled: true },
  ]
  for (const c of displayCases) {
    await check(`eligibility display: ${c.name}`, async () => {
      const { mod, calls } = loadTrial(c.kind)
      const captured = {}
      const res = await loadEligibility(mod, c.user, captured).GET()
      assert.equal(res.status, c.status)
      const body = await res.json()
      assert.equal(body.eligible, c.eligible)
      if (c.status === 503) assert.equal(body.code, 'TRIAL_CHECK_UNAVAILABLE')
      assert.equal(captured.select.plan, true)
      sameShape(captured.select.serviceSubscriptions, { select: { plan: true } })
      assert.equal(calls.length > 0, c.stripeCalled)
    })
  }

  // ---- 両ルートが同じ select を使う ----
  await check('checkout and trial-eligibility share TRIAL_USER_SELECT', async () => {
    const { mod } = loadTrial('new')
    const a = {}, b = {}
    await postCheckout(loadCheckout(mod, dbUser('FREE', []), a))
    await loadEligibility(mod, dbUser('FREE', []), b).GET()
    // stripePriceId は、新しい料金の据え置きの見分け（src/lib/pricing-v2/view.ts）に使う（2026-10-25）。トライアルの判定には使わない
    const { id, stripePriceId, ...checkoutRest } = a.select
    assert.equal(id, true)
    assert.equal(stripePriceId, true)
    sameShape(checkoutRest, b.select)
    sameShape(b.select, mod.TRIAL_USER_SELECT)
  })

  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(e => { console.error(e); process.exitCode = 1 })
