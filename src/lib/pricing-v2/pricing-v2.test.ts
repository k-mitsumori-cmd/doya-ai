import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COST_PER_POINT_TYPICAL, COST_PER_POINT_WORST, ENTERPRISE_MIN_SEATS, FREE_MAX_MEMBERS, LEGACY_PRO_MONTHLY_POINTS,
  LEGACY_PRO_PRICE_TAX_INCLUDED, POWER_PACK, TEAM_BASE_MONTHLY, TEAM_SEAT_TIERS, grossMarginRate, isEnterpriseSeatCount,
  isTeamSeatCount, seatBreakdown, teamMonthly, teamMonthlyPoints, teamPrice, teamYearly, withTax,
} from './plans'
import { decideNewPricing, newPricingRollout } from './rollout'
import { buildTeamLineItems, legacyPriceIds, newPricingPlanIdForPriceId, newPricingPriceIds, teamPriceConfig, TEAM_PLAN_ID } from './prices'
import { decideLegacyPlanCheckout, decidePricingView, decideTeamCheckout, subscriberKind } from './view'

// 本番に近い環境変数の形（値は見本。実在の ID ではない）
const LEGACY_ENV = {
  STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy_pro_m',
  STRIPE_PRICE_BANNER_PRO_YEARLY: 'price_legacy_pro_y',
  STRIPE_PRICE_BANNER_LIGHT_MONTHLY: 'price_legacy_light_m',
}
const TEAM_ENV = {
  STRIPE_PRICE_TEAM_BASE_MONTHLY: 'price_team_base_m',
  STRIPE_PRICE_TEAM_BASE_YEARLY: 'price_team_base_y',
  STRIPE_PRICE_TEAM_SEAT_MONTHLY: 'price_team_seat_m',
  STRIPE_PRICE_TEAM_SEAT_YEARLY: 'price_team_seat_y',
}
const ENV = { ...LEGACY_ENV, ...TEAM_ENV }

// ---------- 人数が増えたときの計算 ----------

test('月額: 基本料 9,800 ＋ 1〜10人目 2,980 ＋ 11人目から 2,480', () => {
  assert.equal(teamMonthly(1), 9800 + 2980)
  assert.equal(teamMonthly(3), 9800 + 3 * 2980)
  assert.equal(teamMonthly(10), 9800 + 10 * 2980)
  assert.equal(teamMonthly(11), 9800 + 10 * 2980 + 2480)
  assert.equal(teamMonthly(20), 9800 + 10 * 2980 + 10 * 2480)
  assert.equal(teamMonthly(49), 9800 + 10 * 2980 + 39 * 2480)
})

test('人数を1人増やすと、月額は必ず増え、増える額は段階の単価と同じ', () => {
  for (let n = 1; n < ENTERPRISE_MIN_SEATS - 1; n++) {
    const diff = teamMonthly(n + 1)! - teamMonthly(n)!
    const tier = TEAM_SEAT_TIERS.find((t) => n + 1 <= t.upTo)!
    assert.equal(diff, tier.unitMonthly, `${n}→${n + 1}人`)
    assert.ok(diff > 0)
  }
})

test('Stripe の段階別（graduated）の計算と、表の計算が同じ', () => {
  // Stripe の graduated: 各段階の upTo までの人数 × その段階の単価 を足す
  const stripeGraduated = (q: number) => {
    let sum = 0, prev = 0
    for (const t of TEAM_SEAT_TIERS) {
      const n = Math.max(0, Math.min(q, t.upTo) - prev)
      sum += n * t.unitMonthly
      prev = t.upTo
    }
    return sum
  }
  for (let n = 1; n < ENTERPRISE_MIN_SEATS; n++) assert.equal(teamMonthly(n)! - TEAM_BASE_MONTHLY, stripeGraduated(n))
})

test('内訳の人数の合計は、申し込んだ人数と同じ', () => {
  for (const n of [1, 9, 10, 11, 25, 49]) assert.equal(seatBreakdown(n).reduce((s, l) => s + l.seats, 0), n)
  assert.deepEqual(seatBreakdown(0), [])
})

test('50人以上は個別見積（チームの額を出さない）。0人・小数・負も出さない', () => {
  for (const n of [0, -1, 1.5, NaN, 50, 120]) assert.equal(teamMonthly(n), null)
  assert.ok(isEnterpriseSeatCount(50))
  assert.ok(!isEnterpriseSeatCount(49))
  assert.ok(isTeamSeatCount(49))
  assert.ok(!isTeamSeatCount('3'))
})

test('年払いは2か月分を引く（月額 × 10）', () => {
  for (const n of [1, 10, 11, 49]) {
    assert.equal(teamYearly(n), teamMonthly(n)! * 10)
    assert.equal(teamPrice(n, 'yearly'), teamYearly(n))
    assert.equal(teamPrice(n, 'monthly'), teamMonthly(n))
  }
})

test('税込: 10% を足し、円未満を切り捨て', () => {
  assert.equal(withTax(9800), 10780)
  assert.equal(withTax(2980), 3278)
  assert.equal(withTax(2480), 2728)
})

test('付与のポイント: 1,500 ＋ 1人 300', () => {
  assert.equal(teamMonthlyPoints(1), 1800)
  assert.equal(teamMonthlyPoints(10), 4500)
  assert.equal(teamMonthlyPoints(50), null)
})

test('付与を全部使い、原価が高い側に振れても、チームは粗利 35% 以上を残す（数を変えたときの歯止め）', () => {
  for (let n = 1; n < ENTERPRISE_MIN_SEATS; n++) {
    const rate = grossMarginRate({ revenueMonthly: teamMonthly(n)!, points: teamMonthlyPoints(n)!, usage: 1, costPerPoint: COST_PER_POINT_WORST })
    assert.ok(rate >= 0.35, `${n}人: ${(rate * 100).toFixed(1)}%`)
  }
})

test('据え置きの 9,980円 は、毎月の付与（1,500）を全部使っても赤字にならない', () => {
  const revenue = Math.round(LEGACY_PRO_PRICE_TAX_INCLUDED / 1.1)
  const rate = grossMarginRate({ revenueMonthly: revenue, points: LEGACY_PRO_MONTHLY_POINTS, usage: 1, costPerPoint: COST_PER_POINT_WORST })
  assert.ok(rate > 0.25, `${(rate * 100).toFixed(1)}%`)
})

test('追加購入のパックは、原価が高い側でも赤字にならない', () => {
  const rate = grossMarginRate({ revenueMonthly: POWER_PACK.price, points: POWER_PACK.points, usage: 1, costPerPoint: COST_PER_POINT_WORST })
  assert.ok(rate > 0.2)
  assert.ok(COST_PER_POINT_TYPICAL < COST_PER_POINT_WORST)
})

test('フリーは3人まで', () => {
  assert.equal(FREE_MAX_MEMBERS, 3)
})

// ---------- 旗 ----------

test('旗: 値が無い・知らない値は off。preview と all だけを受け付ける', () => {
  assert.equal(newPricingRollout(undefined), 'off')
  assert.equal(newPricingRollout(''), 'off')
  assert.equal(newPricingRollout('on'), 'off')
  assert.equal(newPricingRollout(' Preview '), 'preview')
  assert.equal(newPricingRollout('ALL'), 'all')
})

test('旗: off なら誰にも出さない。preview は許可した人だけ', () => {
  const allow = ['a@example.com']
  assert.equal(decideNewPricing({ rollout: 'off', email: 'a@example.com', allow }), false)
  assert.equal(decideNewPricing({ rollout: 'preview', email: 'A@example.com', allow }), true)
  assert.equal(decideNewPricing({ rollout: 'preview', email: 'b@example.com', allow }), false)
  assert.equal(decideNewPricing({ rollout: 'all', email: null, allow }), true)
})

test('旗が off なら、今の料金のまま（契約の有無にかかわらず current）', () => {
  for (const kind of ['none', 'legacy', 'team'] as const) assert.equal(decidePricingView({ enabled: false, kind }), 'current')
})

test('旗が off なら、チームの Checkout は作らない', () => {
  const d = decideTeamCheckout({ enabled: false, configured: true, kind: 'none', seats: 5, isValidSeats: isTeamSeatCount, isEnterpriseSeats: isEnterpriseSeatCount })
  assert.deepEqual(d, { ok: false, status: 404, code: 'NEW_PRICING_DISABLED' })
})

// ---------- 既存契約者（据え置き） ----------

test('今の価格で払っている人・運営が手で付けた人は「据え置き」', () => {
  const ids = newPricingPriceIds(ENV)
  assert.equal(subscriberKind({ plan: 'PRO', stripePriceId: 'price_legacy_pro_m', newPriceIds: ids }), 'legacy')
  assert.equal(subscriberKind({ plan: 'PRO', stripePriceId: null, newPriceIds: ids }), 'legacy')
  assert.equal(subscriberKind({ plan: 'ENTERPRISE', stripePriceId: 'price_unknown', newPriceIds: ids }), 'legacy')
  assert.equal(subscriberKind({ plan: 'LIGHT', stripePriceId: 'price_legacy_light_m', newPriceIds: ids }), 'legacy')
  assert.equal(subscriberKind({ plan: 'FREE', stripePriceId: 'price_legacy_pro_m', newPriceIds: ids }), 'none')
  assert.equal(subscriberKind({ plan: 'PRO', stripePriceId: 'price_team_seat_m', newPriceIds: ids }), 'team')
})

test('据え置きの人は、旗が on でもチームの Checkout を作らない（新しい金額で請求しない）', () => {
  const ids = newPricingPriceIds(ENV)
  const kind = subscriberKind({ plan: 'PRO', stripePriceId: 'price_legacy_pro_m', newPriceIds: ids })
  for (const seats of [1, 5, 30]) {
    const d = decideTeamCheckout({ enabled: true, configured: true, kind, seats, isValidSeats: isTeamSeatCount, isEnterpriseSeats: isEnterpriseSeatCount })
    assert.deepEqual(d, { ok: false, status: 409, code: 'LEGACY_KEEPS_PRICE' })
  }
  assert.equal(decidePricingView({ enabled: true, kind }), 'legacy')
})

test('今の価格は、新しい料金の planId にならない（webhook・同期・監査で PRO のまま、team-pro に化けない）', () => {
  for (const id of Object.values(LEGACY_ENV)) assert.equal(newPricingPlanIdForPriceId(id, ENV), null)
  assert.equal(newPricingPlanIdForPriceId('price_team_base_m', ENV), TEAM_PLAN_ID)
  assert.equal(newPricingPlanIdForPriceId('price_team_seat_y', ENV), TEAM_PLAN_ID)
  assert.equal(newPricingPlanIdForPriceId('', ENV), null)
})

test('新しい価格 ID が今の価格と同じなら、設定の誤りとして使わない', () => {
  const bad = { ...ENV, STRIPE_PRICE_TEAM_BASE_MONTHLY: 'price_legacy_pro_m' }
  assert.deepEqual(teamPriceConfig(bad), { ok: false, reason: 'overlaps_legacy' })
  assert.equal(newPricingPlanIdForPriceId('price_legacy_pro_m', bad), null)
  assert.equal(newPricingPriceIds(bad).size, 0)
  assert.ok(legacyPriceIds(ENV).has('price_legacy_pro_m'))
  assert.ok(!legacyPriceIds(ENV).has('price_team_base_m'))
})

test('価格 ID が足りない・形が違うときは未設定（Checkout を作らない）', () => {
  assert.deepEqual(teamPriceConfig(LEGACY_ENV), { ok: false, reason: 'missing' })
  assert.deepEqual(teamPriceConfig({ ...ENV, STRIPE_PRICE_TEAM_SEAT_YEARLY: 'price_team_seat_m' }), { ok: false, reason: 'duplicated' })
  assert.deepEqual(teamPriceConfig({ ...ENV, STRIPE_PRICE_TEAM_SEAT_MONTHLY: 'seat' }), { ok: false, reason: 'missing' })
  assert.equal(buildTeamLineItems({ seats: 3, interval: 'monthly' }, isTeamSeatCount, LEGACY_ENV), null)
  const d = decideTeamCheckout({ enabled: true, configured: false, kind: 'none', seats: 3, isValidSeats: isTeamSeatCount, isEnterpriseSeats: isEnterpriseSeatCount })
  assert.deepEqual(d, { ok: false, status: 503, code: 'NEW_PRICING_NOT_CONFIGURED' })
})

test('チームの明細: 基本料1 ＋ 人数。年払いは年の価格。税率があれば付ける', () => {
  assert.deepEqual(buildTeamLineItems({ seats: 12, interval: 'monthly' }, isTeamSeatCount, ENV), [
    { price: 'price_team_base_m', quantity: 1 },
    { price: 'price_team_seat_m', quantity: 12 },
  ])
  assert.deepEqual(buildTeamLineItems({ seats: 2, interval: 'yearly' }, isTeamSeatCount, { ...ENV, STRIPE_TAX_RATE_JP_10: 'txr_1' }), [
    { price: 'price_team_base_y', quantity: 1, tax_rates: ['txr_1'] },
    { price: 'price_team_seat_y', quantity: 2, tax_rates: ['txr_1'] },
  ])
  assert.equal(buildTeamLineItems({ seats: 50, interval: 'monthly' }, isTeamSeatCount, ENV), null)
})

test('まだ契約していない人は、人数が正しければチームを申し込める。50人以上は見積へ', () => {
  const base = { enabled: true, configured: true, kind: 'none' as const, isValidSeats: isTeamSeatCount, isEnterpriseSeats: isEnterpriseSeatCount }
  assert.deepEqual(decideTeamCheckout({ ...base, seats: 4 }), { ok: true })
  assert.deepEqual(decideTeamCheckout({ ...base, seats: 50 }), { ok: false, status: 400, code: 'ENTERPRISE_QUOTE' })
  assert.deepEqual(decideTeamCheckout({ ...base, seats: '4' }), { ok: false, status: 400, code: 'INVALID_SEATS' })
  assert.deepEqual(decideTeamCheckout({ ...base, kind: 'team', seats: 4 }), { ok: false, status: 409, code: 'ALREADY_ON_TEAM' })
})

test('旗が on の人には、今のプラン（9,980円）を新しく売らない。off なら今までどおり売る', () => {
  assert.deepEqual(decideLegacyPlanCheckout({ enabled: true, kind: 'none' }), { ok: false, status: 410, code: 'LEGACY_PLAN_CLOSED' })
  assert.deepEqual(decideLegacyPlanCheckout({ enabled: false, kind: 'none' }), { ok: true })
})

test('据え置きの人は、旗が on でも今の契約の中でプランを変えられる（旧ライト → プロ など）', () => {
  assert.deepEqual(decideLegacyPlanCheckout({ enabled: true, kind: 'legacy' }), { ok: true })
})
