// 「1人いくら」の料金の旗 PER_SEAT_PRICING_ROLLOUT が off（または対象でない人）のとき、今の本番の動きが1円も変わらないことを確かめる（2026-11-10）。
//   - 金額・付与の表（plans.ts）は、model を省くと基本料 9,800円・11人目から 2,480円・1,500 ＋ 1人 300 のまま
//   - 1人いくらの価格の環境変数（STRIPE_PRICE_SEAT_ONLY_*）が入っていても、旗が off なら Checkout の明細は「基本料1 ＋ 人数」
//   - 旗が off のとき、1人いくらの価格だけでは新しい料金の仕組みを動かさない
//   - 旗が all の人だけ、基本料の明細なし・人数だけの明細になる（対照）
// 本物の DB・Stripe には触れない（差し替えだけ）。
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg)

const BASE_ENV = {
  STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy_m',
  STRIPE_PRICE_TEAM_BASE_MONTHLY: 'price_tb_m', STRIPE_PRICE_TEAM_BASE_YEARLY: 'price_tb_y',
  STRIPE_PRICE_TEAM_SEAT_MONTHLY: 'price_ts_m', STRIPE_PRICE_TEAM_SEAT_YEARLY: 'price_ts_y',
}
// 公開前に用意しておく想定: 1人いくらの価格が env にあっても、旗が off なら使わない
const SEAT_ONLY_ENV = { STRIPE_PRICE_SEAT_ONLY_MONTHLY: 'price_so_m', STRIPE_PRICE_SEAT_ONLY_YEARLY: 'price_so_y' }

function modules(env) {
  const globals = { process: { env } }
  const uiNext = load('src/lib/ui-next.ts', {}, globals)
  const rollout = load('src/lib/pricing-v2/rollout.ts', { '@/lib/ui-next': uiNext }, globals)
  const plans = load('src/lib/pricing-v2/plans.ts', {}, globals)
  const prices = load('src/lib/pricing-v2/prices.ts', {}, globals)
  return { globals, rollout, plans, prices }
}

async function postTeamCheckout(env, email) {
  const m = modules(env)
  const calls = []
  const route = load('src/app/api/stripe/checkout/route.ts', {
    '@/lib/hr/organization-selection': load('src/lib/hr/organization-selection.ts'),
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u', email } }) },
    '@/lib/auth': {},
    '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: 'u', email, stripeCustomerId: null, stripePriceId: null, plan: 'FREE', serviceSubscriptions: [] }) } } },
    '@/lib/unified-plan': load('src/lib/unified-plan.ts'),
    '@/lib/trial': { isTrialEligible: async () => true, TRIAL_USER_SELECT: { stripeCustomerId: true, plan: true, serviceSubscriptions: { select: { plan: true } } } },
    '@/lib/checkout-reservation': { CheckoutReservationError: class extends Error {}, createReservedCheckoutSession: ({ create }) => create('k', 1900000000) },
    '@/lib/pricing-v2/team-checkout-seat.server': { TeamCheckoutSeatError: class extends Error {}, createTeamSeatCheckout: async (o) => o.create('k', 1900000000) },
    '@/lib/stripe': { STRIPE_PRICE_IDS: {}, findActiveLikeSubscriptions: async () => [], createCheckoutSession: async (a) => { calls.push(a); return { id: 'cs', url: 'https://offline.invalid' } } },
    '@/lib/pricing-v2/rollout': m.rollout,
    '@/lib/pricing-v2/prices': m.prices,
    '@/lib/pricing-v2/plans': m.plans,
    '@/lib/pricing-v2/view': load('src/lib/pricing-v2/view.ts', { '@/lib/unified-plan': load('src/lib/unified-plan.ts') }, m.globals),
  }, m.globals)
  const res = await route.POST(new Request('https://offline.invalid', { method: 'POST', body: JSON.stringify({ planId: 'team-pro', seats: 5, billingPeriod: 'monthly' }) }))
  return { status: res.status, calls }
}

;(async () => {
  await check('plans: omitting the model keeps the current base fee, tiers and monthly points', async () => {
    const { plans } = modules({})
    assert.equal(plans.teamMonthly(1), 12780)
    assert.equal(plans.teamMonthly(5), 24700)
    assert.equal(plans.teamMonthly(11), 42080)
    assert.equal(plans.teamMonthlyPoints(1), 1800)
    assert.equal(plans.teamMonthlyPoints(10), 4500)
    assert.equal(plans.teamYearly(5), 247000)
    same(plans.seatBreakdown(12).map((l) => [l.from, l.to, l.unitMonthly]), [[1, 10, 2980], [11, 12, 2480]])
    same(plans.planConfig('base_plus_seat').tiers, plans.TEAM_SEAT_TIERS)
  })

  await check('rollout: off / unset / unknown value never turn per-seat pricing on, even when NEW_PRICING_ROLLOUT is all', async () => {
    for (const per of [undefined, '', 'on', 'true', 'off']) {
      const { rollout } = modules({ NEW_PRICING_ROLLOUT: 'all', ...(per === undefined ? {} : { PER_SEAT_PRICING_ROLLOUT: per }), UI_PREVIEW_EMAILS: 'buyer@example.com' })
      assert.equal(rollout.isPerSeatPricingFor('buyer@example.com'), false, `PER_SEAT_PRICING_ROLLOUT=${per}`)
      assert.equal(rollout.isPerSeatPricingFor(null), false)
    }
    const preview = modules({ NEW_PRICING_ROLLOUT: 'all', PER_SEAT_PRICING_ROLLOUT: 'preview', UI_PREVIEW_EMAILS: 'someone-else@example.com' }).rollout
    assert.equal(preview.isPerSeatPricingFor('buyer@example.com'), false, 'preview で許可されていない人')
    // 新しい料金の仕組みが off の人には、1人いくらの旗が all でも出さない
    const noNew = modules({ NEW_PRICING_ROLLOUT: 'off', PER_SEAT_PRICING_ROLLOUT: 'all' }).rollout
    assert.equal(noNew.isPerSeatPricingFor('buyer@example.com'), false)
  })

  await check('prices: with the flag off, seat-only price ids in env do not widen what counts as configured', async () => {
    const { prices } = modules({ ...BASE_ENV, ...SEAT_ONLY_ENV })
    // 旗 off（値なし）: 基本料ありの 4 つだけで動く。1人いくらの価格だけの環境は動かさない
    assert.equal(prices.teamPricingOperable({ ...BASE_ENV, ...SEAT_ONLY_ENV }), true)
    assert.equal(prices.teamPricingOperable({ STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy_m', ...SEAT_ONLY_ENV }), false)
    assert.equal(prices.teamPricingOperable({ STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy_m', ...SEAT_ONLY_ENV, PER_SEAT_PRICING_ROLLOUT: 'off' }), false)
    assert.equal(prices.checkoutConfigured('base_plus_seat', { STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy_m', ...SEAT_ONLY_ENV }), false)
    // 基本料ありの契約は、いつも基本料ありの形
    assert.equal(prices.contractPricingModel('price_tb_m', { ...BASE_ENV, ...SEAT_ONLY_ENV }), 'base_plus_seat')
    assert.equal(prices.contractPricingModel('price_ts_y', { ...BASE_ENV, ...SEAT_ONLY_ENV }), 'base_plus_seat')
    // 1人いくらの価格が env に無ければ、新しい料金の価格 ID は基本料ありの 4 つだけ
    same([...prices.newPricingPriceIds(BASE_ENV)].sort(), ['price_tb_m', 'price_tb_y', 'price_ts_m', 'price_ts_y'])
  })

  await check('checkout: flag off + seat-only prices in env -> team line items are still base x1 + seats', async () => {
    const r = await postTeamCheckout({ ...BASE_ENV, ...SEAT_ONLY_ENV, NEW_PRICING_ROLLOUT: 'all' }, 'buyer@example.com')
    assert.equal(r.status, 200)
    assert.equal(r.calls.length, 1)
    same(r.calls[0].lineItems, [{ price: 'price_tb_m', quantity: 1 }, { price: 'price_ts_m', quantity: 5 }])
  })

  await check('checkout: preview but not allowed -> still base x1 + seats', async () => {
    const r = await postTeamCheckout({ ...BASE_ENV, ...SEAT_ONLY_ENV, NEW_PRICING_ROLLOUT: 'all', PER_SEAT_PRICING_ROLLOUT: 'preview', UI_PREVIEW_EMAILS: 'someone-else@example.com' }, 'buyer@example.com')
    assert.equal(r.status, 200)
    same(r.calls[0].lineItems, [{ price: 'price_tb_m', quantity: 1 }, { price: 'price_ts_m', quantity: 5 }])
  })

  await check('checkout (control): flag all -> seat-only line item, no base fee line', async () => {
    const r = await postTeamCheckout({ ...BASE_ENV, ...SEAT_ONLY_ENV, NEW_PRICING_ROLLOUT: 'all', PER_SEAT_PRICING_ROLLOUT: 'all' }, 'buyer@example.com')
    assert.equal(r.status, 200)
    same(r.calls[0].lineItems, [{ price: 'price_so_m', quantity: 5 }])
  })

  await check('checkout (control): flag all but seat-only prices are missing -> refused with 503, no Checkout is created', async () => {
    const r = await postTeamCheckout({ ...BASE_ENV, NEW_PRICING_ROLLOUT: 'all', PER_SEAT_PRICING_ROLLOUT: 'all' }, 'buyer@example.com')
    assert.equal(r.status, 503)
    assert.equal(r.calls.length, 0)
  })

  console.log(JSON.stringify({ passed: results.length, results, scope: 'Actual pricing-v2 pure modules and the checkout route with synthetic collaborators. No real DB or Stripe.' }))
})().catch((e) => { console.error(e); process.exitCode = 1 })
