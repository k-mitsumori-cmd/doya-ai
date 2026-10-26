// 新しい料金（NEW_PRICING_ROLLOUT）が off のとき、または preview で許可されていない人のとき、
// 新しい表（account_company_members / account_company_billing / doya_power_starter_claims）に一度も触れず、
// 量も今のまま（毎月の量は null ＝ 今の 3,000、はじめの付与なし、参加している会社を探さない）ことを確かめる（2026-10-26 統括の点検）。
// 本物の DB・Stripe には触れない（差し替えの DB が、触った表を記録する。新しい表に触れたら失敗にする）。
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
// vm の中で作った値は、比べる前に JSON で同じ形にそろえる（プロトタイプの違いで失敗しないように）
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg)

const NEW_TABLES = new Set(['accountCompanyMember', 'accountCompanyBilling', 'doyaPowerStarterClaim'])
const TEAM_ENV = {
  STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy_m',
  STRIPE_PRICE_TEAM_BASE_MONTHLY: 'price_tb_m', STRIPE_PRICE_TEAM_BASE_YEARLY: 'price_tb_y',
  STRIPE_PRICE_TEAM_SEAT_MONTHLY: 'price_ts_m', STRIPE_PRICE_TEAM_SEAT_YEARLY: 'price_ts_y',
}

function fakePrisma(touched) {
  const owner = { id: 'u_owner', email: 'owner@example.com', stripeCustomerId: null, stripePriceId: 'price_ts_m', plan: 'PRO', emailVerified: new Date() }
  const rows = {
    accountCompany: { findUnique: async (q) => (q.where.userId === 'u_member' ? null : { id: 'co', userId: 'u_owner', user: owner }) },
    user: { findUnique: async (q) => (q.where.id === 'u_member' ? { email: 'member@example.com', plan: 'FREE', emailVerified: new Date() } : owner) },
    account: { findFirst: async () => ({ id: 'acc' }) },
  }
  return new Proxy({}, {
    get(_t, model) {
      return new Proxy({}, {
        get(_m, method) {
          touched.push(`${String(model)}.${String(method)}`)
          if (NEW_TABLES.has(String(model))) return async () => { throw new Error(`new table touched: ${String(model)}`) }
          const fn = rows[model]?.[method]
          return fn || (async () => null)
        },
      })
    },
  })
}

function loadModules(env) {
  const touched = []
  const globals = { process: { env } }
  const prisma = fakePrisma(touched)
  const stripe = new Proxy({}, { get() { throw new Error('stripe touched') } })
  const uiNext = load('src/lib/ui-next.ts', {}, globals)
  const rollout = load('src/lib/pricing-v2/rollout.ts', { '@/lib/ui-next': uiNext }, globals)
  const plans = load('src/lib/pricing-v2/plans.ts', {}, globals)
  const prices = load('src/lib/pricing-v2/prices.ts', {}, globals)
  const unifiedPlan = load('src/lib/unified-plan.ts', {}, globals)
  const team = load('src/lib/pricing-v2/team.ts', { './plans': plans }, globals)
  const teamServer = load('src/lib/pricing-v2/team.server.ts', {
    '@/lib/prisma': { prisma }, '@/lib/stripe': { stripe, findActiveLikeSubscriptions: async () => { throw new Error('stripe touched') } },
    '@/lib/unified-plan': unifiedPlan, './rollout': rollout, './plans': plans, './prices': prices, './team': team,
  }, globals)
  const starter = load('src/lib/pricing-v2/starter.ts', { 'node:crypto': require('node:crypto') }, globals)
  const starterServer = load('src/lib/pricing-v2/starter.server.ts', {
    '@/lib/prisma': { prisma }, '@/lib/doya-power/flag': { doyaPowerLedgerAllowed: () => true },
    './rollout': rollout, './starter': starter,
  }, globals)
  return { touched, rollout, teamServer, starterServer }
}

async function assertUnchanged(env, label) {
  const m = loadModules(env)
  assert.equal(await m.teamServer.teamSeatsForCompany('co'), null, `${label}: teamSeatsForCompany`)
  assert.equal(await m.teamServer.newPricingMonthlyGrant('co'), null, `${label}: newPricingMonthlyGrant（null ＝ 今の量）`)
  assert.equal(await m.teamServer.teamSeatsUsed('co'), 1, `${label}: teamSeatsUsed`)
  assert.equal(await m.teamServer.resolveCompanyForUser('u_member'), null, `${label}: 参加している会社を探さない`)
  const owner = await m.teamServer.resolveCompanyForUser('u_owner')
  same(owner && { companyId: owner.companyId, role: owner.role }, { companyId: 'co', role: 'owner' }, `${label}: 持ち主の会社は今までどおり`)
  const st = await m.starterServer.ensureStarterGrant('u_owner')
  assert.equal(st.granted, 0, `${label}: はじめの付与なし`)
  same(st.decision, { ok: false, reason: 'flag_off' }, `${label}: はじめの付与の判定`)
  const bad = m.touched.filter((t) => NEW_TABLES.has(t.split('.')[0]))
  same(bad, [], `${label}: 新しい表に触れた: ${bad.join(', ')}`)
}

;(async () => {
  await check('flag off (unset): no new table, no Stripe, current amounts', async () => {
    await assertUnchanged({ ...TEAM_ENV }, 'off（値なし）')
  })
  await check('flag off (unknown value): same as off', async () => {
    await assertUnchanged({ ...TEAM_ENV, NEW_PRICING_ROLLOUT: 'on' }, 'off（知らない値）')
  })
  await check('flag preview but the owner is not allowed: per-person, same as off', async () => {
    await assertUnchanged({ ...TEAM_ENV, NEW_PRICING_ROLLOUT: 'preview', UI_PREVIEW_EMAILS: 'someone-else@example.com' }, 'preview（許可されていない人）')
  })
  await check('flag all but team prices are not configured: no new table', async () => {
    const m = loadModules({ STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy_m', NEW_PRICING_ROLLOUT: 'all' })
    assert.equal(await m.teamServer.teamSeatsForCompany('co'), null)
    assert.equal(await m.teamServer.resolveCompanyForUser('u_member'), null)
    same(m.touched.filter((t) => t.startsWith('accountCompanyMember') || t.startsWith('accountCompanyBilling')), [], '価格が未設定なら新しい表に触れない')
  })
  await check('flag preview and the owner is allowed: switches per person, and falls back to the legacy amount when the seats cannot be read', async () => {
    const m = loadModules({ ...TEAM_ENV, NEW_PRICING_ROLLOUT: 'preview', UI_PREVIEW_EMAILS: 'owner@example.com' })
    // 人数の控え（新しい表）は差し替えで失敗させてある → 据え置きの量（1,500）で続ける（統括の点検 B5）
    assert.equal(await m.teamServer.newPricingMonthlyGrant('co'), 1500)
    assert.ok(m.touched.includes('accountCompanyBilling.findUnique'), '許可された人は、人数の控えを読みに行く')
  })
  // ---- つなぎ（Checkout・charge.ts・load.server.ts）。旗が off（process.env が空）で、今のままか ----
  await check('wiring: checkout with the flag off refuses team-pro (404) and sells the current plan with the trial as before', async () => {
    const { DEFAULT_MOCKS } = require('./load-typescript.cjs')
    const calls = []
    const prices = load('src/lib/stripe.ts', { stripe: function () {}, 'node:crypto': require('node:crypto') }).STRIPE_PRICE_IDS
    const route = () => load('src/app/api/stripe/checkout/route.ts', {
      '@/lib/hr/organization-selection': load('src/lib/hr/organization-selection.ts'),
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { email: 'buyer@example.com' } }) },
      '@/lib/auth': {},
      '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: 'u', stripeCustomerId: null, stripePriceId: null, plan: 'FREE', serviceSubscriptions: [] }) } } },
      '@/lib/unified-plan': load('src/lib/unified-plan.ts'),
      '@/lib/trial': { isTrialEligible: async () => true, TRIAL_USER_SELECT: { stripeCustomerId: true, plan: true, serviceSubscriptions: { select: { plan: true } } } },
      '@/lib/checkout-reservation': { CheckoutReservationError: class extends Error {}, createReservedCheckoutSession: ({ create }) => create('k', 1900000000) },
      '@/lib/stripe': { STRIPE_PRICE_IDS: prices, findActiveLikeSubscriptions: async () => [], createCheckoutSession: async (a) => { calls.push(a); return { id: 'cs', url: 'https://offline.invalid' } } },
      '@/lib/pricing-v2/rollout': DEFAULT_MOCKS['@/lib/pricing-v2/rollout'],
    })
    const post = (body) => route().POST(new Request('https://offline.invalid', { method: 'POST', body: JSON.stringify(body) }))
    const team = await post({ planId: 'team-pro', seats: 5, billingPeriod: 'monthly' })
    assert.equal(team.status, 404)
    assert.equal(calls.length, 0, 'チームの Checkout は作らない')
    const pro = await post({ planId: 'banner-pro', billingPeriod: 'monthly' })
    assert.equal(pro.status, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].trialDays, 30, '今のプロは今までどおり初月無料')
    assert.equal(calls[0].lineItems, undefined, '明細は今までどおり1つ（priceId）')
    assert.equal(calls[0].allowPromotionCodes, undefined, '割引コードの欄は今までどおり（既定）')
  })

  await check('wiring: charge.ts account() with the flag off returns the own company and no new-pricing amount (gauge stays 3,000)', async () => {
    const m = loadModules({ ...TEAM_ENV })
    let deps = null
    load('src/lib/doya-power/charge.ts', {
      'node:crypto': require('node:crypto'),
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: {} },
      '@/lib/unified-plan': load('src/lib/unified-plan.ts'),
      '@/lib/shell/company.server': { currentUserId: async () => 'u_owner' },
      '@/lib/pricing-v2/team.server': m.teamServer,
      '@/lib/pricing-v2/starter.server': m.starterServer,
      './flag': { doyaPowerRollout: () => 'all', isDoyaPowerEnabled: async () => true },
      './index': {},
      './charge-core': { createDoyaPowerCharger: (d) => { deps = d; return {} }, DOYA_POWER_CONSUMED_HEADER: 'x' },
      './retry': { DOYA_POWER_RETRY_HEADER: 'x' },
      '@/lib/operational-json': { readOperationalJson: async () => null, OperationalBodyError: class extends Error {} },
      './count': { parseCount: () => 1 },
    }, { process: { env: { ...TEAM_ENV } } })
    const who = await deps.account()
    same(who, { companyId: 'co', plan: 'PRO', monthlyGrant: null }, '持ち主の会社・プランのまま、新しい料金の量は無い')
    const bad = m.touched.filter((t) => NEW_TABLES.has(t.split('.')[0]))
    same(bad, [], 'charge.ts から新しい表に触れない')
  })

  await check('wiring: load.server.ts with the flag off builds the missions with the current rewards', async () => {
    let opts = null
    const missions = load('src/lib/missions/load.server.ts', {
      '@/lib/prisma': { prisma: new Proxy({}, { get: () => new Proxy({}, { get: () => async () => null }) }) },
      './jst': load('src/lib/missions/jst.ts'),
      './view': { buildMissionsView: (_input, _now, o) => { opts = o; return { ok: true } } },
      '@/lib/pricing-v2/rollout': loadModules({}).rollout,
    }, { process: { env: {} } })
    await missions.loadMissionsView('u_owner', new Date('2026-10-26T03:00:00Z'))
    same(opts, { newPricing: false }, 'はじめの手順は今の報酬の表（newPricing: false）')
  })

  console.log(JSON.stringify({ passed: results.length, results, scope: 'Actual pricing-v2 server modules with a recording fake Prisma. New tables throw if touched. No real DB or Stripe.' }))
})().catch((e) => { console.error(e); process.exitCode = 1 })
