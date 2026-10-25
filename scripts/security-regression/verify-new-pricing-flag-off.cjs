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
  console.log(JSON.stringify({ passed: results.length, results, scope: 'Actual pricing-v2 server modules with a recording fake Prisma. New tables throw if touched. No real DB or Stripe.' }))
})().catch((e) => { console.error(e); process.exitCode = 1 })
