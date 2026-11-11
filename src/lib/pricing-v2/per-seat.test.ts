// 「1人いくら」の料金（旗 PER_SEAT_PRICING_ROLLOUT。2026-11-10）の検査。
// 旗が off のときに今の料金が1円も変わらないこと、on のときの値と粗利の下限、Stripe の明細、契約の見分けを確かめる。
// DB と Stripe には触れない。
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import {
  COST_PER_POINT_WORST, ENTERPRISE_MIN_SEATS, PER_SEAT_PLAN, seatMonthlyPoints, seatUnitMonthly, TEAM_BASE_MONTHLY, TEAM_MONTHLY_POINTS_BASE, TEAM_MONTHLY_POINTS_PER_SEAT,
  grossMarginRate, isTeamSeatCount, planConfig, seatBreakdown, teamMonthly, teamMonthlyPoints, teamPrice, teamYearly, withTax,
} from './plans'
import { decidePerSeatPricing, isPerSeatPricingPublic, parsePerSeatPricingRollout } from './rollout'
import {
  buildTeamLineItems, checkoutConfigured, contractPricingModel, newPricingPlanIdForPriceId, newPricingPriceIds, perSeatPriceConfig,
  seatItemInterval, seatItemPriceIds, teamPriceConfig, teamPricingConfigured, teamPricingOperable,
} from './prices'
import { subscriberKind } from './view'
import { seatAddGrants, teamMonthlyGrant } from './team'
import { parseTeamSeatsView } from './seat-operation-view'
import { decideUpsell } from './upsell'

const BASE_ENV = {
  STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy_pro_m',
  STRIPE_PRICE_TEAM_BASE_MONTHLY: 'price_tb_m', STRIPE_PRICE_TEAM_BASE_YEARLY: 'price_tb_y',
  STRIPE_PRICE_TEAM_SEAT_MONTHLY: 'price_ts_m', STRIPE_PRICE_TEAM_SEAT_YEARLY: 'price_ts_y',
}
const SEAT_ONLY_ENV = { STRIPE_PRICE_SEAT_ONLY_MONTHLY: 'price_so_m', STRIPE_PRICE_SEAT_ONLY_YEARLY: 'price_so_y' }

// ---------- 旗が off（引数を省く）のとき、今の本番の値のまま ----------

test('off: 引数を省くと、基本料 9,800円・10人目まで 2,980円・11人目から 2,480円・1,500 ＋ 1人 300 のまま', () => {
  assert.equal(TEAM_BASE_MONTHLY, 9800)
  assert.equal(teamMonthly(1), 12780)
  assert.equal(teamMonthly(5), 24700)
  assert.equal(teamMonthly(10), 39600)
  assert.equal(teamMonthly(11), 42080)
  assert.equal(teamMonthly(49), 9800 + 10 * 2980 + 39 * 2480)
  assert.equal(teamMonthlyPoints(1), TEAM_MONTHLY_POINTS_BASE + TEAM_MONTHLY_POINTS_PER_SEAT)
  assert.equal(teamMonthlyPoints(10), 1500 + 300 * 10)
  assert.equal(teamYearly(5), 24700 * 10)
  assert.deepEqual(seatBreakdown(12).map((l) => [l.from, l.to, l.unitMonthly]), [[1, 10, 2980], [11, 12, 2480]])
  // 'base_plus_seat' を明示しても同じ
  for (let n = 1; n < ENTERPRISE_MIN_SEATS; n++) {
    assert.equal(teamMonthly(n, 'base_plus_seat'), teamMonthly(n))
    assert.equal(teamMonthlyPoints(n, 'base_plus_seat'), teamMonthlyPoints(n))
  }
})

test('off: 旗の値が無い・知らない値は off。新しい料金の仕組みが off の人には、1人いくらも出さない', () => {
  for (const v of [undefined, '', 'on', 'true', 'yes']) assert.equal(parsePerSeatPricingRollout(v), 'off')
  const allow = ['a@example.com']
  assert.equal(decidePerSeatPricing({ newPricing: 'all', perSeat: 'off', email: 'a@example.com', allow }), false)
  assert.equal(decidePerSeatPricing({ newPricing: 'off', perSeat: 'all', email: 'a@example.com', allow }), false)
  assert.equal(decidePerSeatPricing({ newPricing: 'all', perSeat: 'all', email: null, allow }), true)
  assert.equal(decidePerSeatPricing({ newPricing: 'all', perSeat: 'preview', email: 'a@example.com', allow }), true)
  assert.equal(decidePerSeatPricing({ newPricing: 'all', perSeat: 'preview', email: 'b@example.com', allow }), false)
  assert.equal(decidePerSeatPricing({ newPricing: 'all', perSeat: 'preview', email: null, allow }), false)
  // ログイン前のページは、ビルドに埋め込まれた値が 'on' のときだけ
  assert.equal(isPerSeatPricingPublic(''), false)
  assert.equal(isPerSeatPricingPublic(undefined as unknown as string), false)
  assert.equal(isPerSeatPricingPublic('on'), true)
})

test('off: 1人いくらの価格が env に無ければ、設定は今までどおり（基本料ありの 4 つだけ）', () => {
  assert.equal(perSeatPriceConfig(BASE_ENV).ok, false)
  assert.deepEqual(newPricingPriceIds(BASE_ENV), new Set(['price_tb_m', 'price_tb_y', 'price_ts_m', 'price_ts_y']))
  assert.equal(checkoutConfigured('base_plus_seat', BASE_ENV), true)
  assert.equal(teamPricingOperable({ ...BASE_ENV }), true)
  // 旗が off のとき、1人いくらの価格だけでは動かさない
  assert.equal(teamPricingOperable({ ...SEAT_ONLY_ENV, STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy_pro_m' }), false)
  assert.equal(teamPricingOperable({ ...SEAT_ONLY_ENV, PER_SEAT_PRICING_ROLLOUT: 'all' }), true)
  assert.equal(contractPricingModel('price_tb_m', { ...BASE_ENV, ...SEAT_ONLY_ENV }), 'base_plus_seat')
  assert.equal(contractPricingModel(null, { ...BASE_ENV, ...SEAT_ONLY_ENV }), 'base_plus_seat')
})

test('off: 基本料ありの Checkout の明細は、基本料1 ＋ 人数（model を省いても同じ）', () => {
  const expected = [{ price: 'price_tb_m', quantity: 1 }, { price: 'price_ts_m', quantity: 12 }]
  assert.deepEqual(buildTeamLineItems({ seats: 12, interval: 'monthly' }, isTeamSeatCount, BASE_ENV), expected)
  assert.deepEqual(buildTeamLineItems({ seats: 12, interval: 'monthly' }, isTeamSeatCount, BASE_ENV, 'base_plus_seat'), expected)
})

test('off: 毎月の付与・日割りの付与・人数の応答の検査は、model を省くと今のまま', () => {
  assert.equal(teamMonthlyGrant(4), 1500 + 300 * 4)
  const g = seatAddGrants({ subscriptionId: 'sub_1', monthKey: '2026-11', addedSeats: [2], now: new Date('2026-11-01T00:00:00+09:00') })
  assert.equal(g[0]!.amount, 300)
  assert.deepEqual(
    parseTeamSeatsView({ seats: 3, used: 1, interval: 'month', monthly: teamMonthly(3), points: teamMonthlyPoints(3) }),
    { kind: 'ready', seats: 3, used: 1, interval: 'month' },
  )
  const free = decideUpsell({ kind: 'free', isOwner: true, trigger: 'empty', seats: null, canBuyPack: false, canCheckoutTeam: true })
  assert.equal(free.body, 'チームにすると、毎月 1,500 ＋ 1人 300 が付きます。')
})

// ---------- 旗が on のときの値 ----------

test('on: 基本料なし・段ごとに積み上げ（1〜10人 3,980円・11〜30人 2,980円・31〜49人 2,480円）。付与も段ごと（500・400・350）', () => {
  assert.equal(PER_SEAT_PLAN.baseMonthly, 0)
  const expectedMonthly = (n: number) => Math.min(n, 10) * 3980 + Math.max(0, Math.min(n, 30) - 10) * 2980 + Math.max(0, n - 30) * 2480
  const expectedPoints = (n: number) => Math.min(n, 10) * 500 + Math.max(0, Math.min(n, 30) - 10) * 400 + Math.max(0, n - 30) * 350
  for (let n = 1; n < ENTERPRISE_MIN_SEATS; n++) {
    assert.equal(teamMonthly(n, 'per_seat'), expectedMonthly(n), `${n}人`)
    assert.equal(teamYearly(n, 'per_seat'), expectedMonthly(n) * 10)
    assert.equal(teamPrice(n, 'yearly', 'per_seat'), teamYearly(n, 'per_seat'))
    assert.equal(teamMonthlyPoints(n, 'per_seat'), expectedPoints(n), `${n}人の付与`)
  }
  // 三森さんの決定の確かめ（税抜）
  for (const [n, m] of [[5, 19900], [10, 39800], [20, 69600], [30, 99400], [49, 146520]] as const) assert.equal(teamMonthly(n, 'per_seat'), m, `${n}人`)
  assert.equal(teamMonthlyPoints(12, 'per_seat'), 500 * 10 + 400 * 2)
  assert.equal(withTax(teamMonthly(1, 'per_seat')!), 4378)
  assert.equal(teamMonthly(ENTERPRISE_MIN_SEATS, 'per_seat'), null)
  assert.deepEqual(seatBreakdown(12, 'per_seat').map((l) => [l.from, l.to, l.unitMonthly]), [[1, 10, 3980], [11, 12, 2980]])
  assert.deepEqual([seatUnitMonthly(10, 'per_seat'), seatUnitMonthly(11, 'per_seat'), seatUnitMonthly(31, 'per_seat')], [3980, 2980, 2480])
  assert.deepEqual([seatMonthlyPoints(10, 'per_seat'), seatMonthlyPoints(11, 'per_seat'), seatMonthlyPoints(31, 'per_seat')], [500, 400, 350])
  assert.equal(planConfig('per_seat').pointsBase, 0)
  // 値下げは追加の人にだけ。人数が増えても、合計は必ず増える（全員が安くなる形ではない）
  for (let n = 1; n < ENTERPRISE_MIN_SEATS - 1; n++) assert.ok(teamMonthly(n + 1, 'per_seat')! > teamMonthly(n, 'per_seat')!)
})

test('on: 付与を全部使い、原価が高い側に振れても、チームは粗利 35% 以上を残す（1〜49人）', () => {
  for (let n = 1; n < ENTERPRISE_MIN_SEATS; n++) {
    const rate = grossMarginRate({ revenueMonthly: teamMonthly(n, 'per_seat')!, points: teamMonthlyPoints(n, 'per_seat')!, usage: 1, costPerPoint: COST_PER_POINT_WORST })
    assert.ok(rate >= 0.35, `${n}人: ${(rate * 100).toFixed(1)}%`)
  }
})

test('on: Checkout の明細は人数だけ（基本料の明細なし）。価格 ID は STRIPE_PRICE_SEAT_ONLY_*', () => {
  const env = { ...BASE_ENV, ...SEAT_ONLY_ENV }
  assert.deepEqual(buildTeamLineItems({ seats: 7, interval: 'monthly' }, isTeamSeatCount, env, 'per_seat'), [{ price: 'price_so_m', quantity: 7 }])
  assert.deepEqual(buildTeamLineItems({ seats: 2, interval: 'yearly' }, isTeamSeatCount, { ...env, STRIPE_TAX_RATE_JP_10: 'txr_1' }, 'per_seat'), [{ price: 'price_so_y', quantity: 2, tax_rates: ['txr_1'] }])
  // 基本料ありの価格がなくても作れる
  assert.deepEqual(buildTeamLineItems({ seats: 3, interval: 'monthly' }, isTeamSeatCount, { ...SEAT_ONLY_ENV, STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy_pro_m' }, 'per_seat'), [{ price: 'price_so_m', quantity: 3 }])
  // 人数が範囲外・価格が無いときは作らない（申し込みを止める）
  assert.equal(buildTeamLineItems({ seats: 50, interval: 'monthly' }, isTeamSeatCount, env, 'per_seat'), null)
  assert.equal(buildTeamLineItems({ seats: 3, interval: 'monthly' }, isTeamSeatCount, BASE_ENV, 'per_seat'), null)
  assert.equal(checkoutConfigured('per_seat', BASE_ENV), false)
  assert.equal(checkoutConfigured('per_seat', env), true)
})

test('on: 1人いくらの価格の設定の誤りは使わない（今の価格と同じ・月と年が同じ・基本料ありの価格と同じ）', () => {
  assert.deepEqual(perSeatPriceConfig({ ...BASE_ENV, STRIPE_PRICE_SEAT_ONLY_MONTHLY: 'price_so_m' }), { ok: false, reason: 'missing' })
  assert.deepEqual(perSeatPriceConfig({ ...BASE_ENV, STRIPE_PRICE_SEAT_ONLY_MONTHLY: 'price_x', STRIPE_PRICE_SEAT_ONLY_YEARLY: 'price_x' }), { ok: false, reason: 'duplicated' })
  assert.deepEqual(perSeatPriceConfig({ ...BASE_ENV, STRIPE_PRICE_SEAT_ONLY_MONTHLY: 'price_legacy_pro_m', STRIPE_PRICE_SEAT_ONLY_YEARLY: 'price_so_y' }), { ok: false, reason: 'overlaps_legacy' })
  assert.deepEqual(perSeatPriceConfig({ ...BASE_ENV, STRIPE_PRICE_SEAT_ONLY_MONTHLY: 'price_ts_m', STRIPE_PRICE_SEAT_ONLY_YEARLY: 'price_so_y' }), { ok: false, reason: 'duplicated' })
  // 新しい価格の環境変数は、今の価格の一覧に混ざらない
  assert.equal(teamPriceConfig({ ...BASE_ENV, ...SEAT_ONLY_ENV }).ok, true)
})

test('on: 契約の見分け。1人いくらの価格は team-pro として読まれ、契約の料金の形は価格で決まる', () => {
  const env = { ...BASE_ENV, ...SEAT_ONLY_ENV }
  const ids = newPricingPriceIds(env)
  for (const id of ['price_tb_m', 'price_ts_y', 'price_so_m', 'price_so_y']) assert.ok(ids.has(id), id)
  assert.equal(newPricingPlanIdForPriceId('price_so_y', env), 'team-pro')
  assert.equal(newPricingPlanIdForPriceId('price_legacy_pro_m', env), null)
  assert.equal(subscriberKind({ plan: 'PRO', stripePriceId: 'price_so_m', newPriceIds: ids }), 'team')
  assert.equal(subscriberKind({ plan: 'PRO', stripePriceId: 'price_legacy_pro_m', newPriceIds: ids }), 'legacy')
  assert.equal(contractPricingModel('price_so_m', env), 'per_seat')
  assert.equal(contractPricingModel('price_so_y', env), 'per_seat')
  assert.equal(contractPricingModel('price_tb_m', env), 'base_plus_seat')
  assert.equal(contractPricingModel('price_legacy_pro_m', env), 'base_plus_seat')
  assert.deepEqual(seatItemPriceIds(env), new Set(['price_ts_m', 'price_ts_y', 'price_so_m', 'price_so_y']))
  assert.equal(seatItemInterval('price_so_y', env), 'year')
  assert.equal(seatItemInterval('price_so_m', env), 'month')
  assert.equal(seatItemInterval('price_ts_y', env), 'year')
  assert.equal(seatItemInterval('price_tb_m', env), null)
})

test('on: 付与・日割り・人数の応答は、契約の料金の形で決まる', () => {
  assert.equal(teamMonthlyGrant(4, 'per_seat'), 2000)
  const g = seatAddGrants({ subscriptionId: 'sub_1', monthKey: '2026-11', addedSeats: [2], now: new Date('2026-11-01T00:00:00+09:00'), model: 'per_seat' })
  assert.equal(g[0]!.amount, 500)
  const g11 = seatAddGrants({ subscriptionId: 'sub_1', monthKey: '2026-11', addedSeats: [11, 31], now: new Date('2026-11-01T00:00:00+09:00'), model: 'per_seat' })
  assert.deepEqual(g11.map((x) => x.amount), [400, 350])
  assert.deepEqual(
    parseTeamSeatsView({ seats: 3, used: 1, interval: 'month', monthly: 11940, points: 1500, perSeat: true }),
    { kind: 'ready', seats: 3, used: 1, interval: 'month', perSeat: true },
  )
  // 料金の形と合わない額は受け付けない
  assert.equal(parseTeamSeatsView({ seats: 3, used: 1, interval: 'month', monthly: teamMonthly(3), points: teamMonthlyPoints(3), perSeat: true }), null)
  assert.equal(parseTeamSeatsView({ seats: 3, used: 1, interval: 'month', monthly: 11940, points: 1500 }), null)
})

test('on: 足りないときの案内は、1人いくらの言い方になる', () => {
  const free = decideUpsell({ kind: 'free', isOwner: true, trigger: 'empty', seats: null, canBuyPack: false, canCheckoutTeam: true, perSeat: true })
  assert.match(free.body, /1人 月 ¥3,980（税抜）/)
  assert.match(free.body, /500/)
  assert.match(free.body, /11人目からはもっと安く/)
  assert.ok(!free.body.includes('1,500'))
  assert.match(free.primary.kind === 'link' ? free.primary.sub ?? '' : '', /¥3,980/)
  const team = decideUpsell({ kind: 'team', isOwner: true, trigger: 'low', seats: 5, canBuyPack: true, canCheckoutTeam: true, perSeat: true })
  const manage = team.secondary.find((a) => a.kind === 'link' && a.href === '/pricing#manage')
  assert.match(manage?.sub ?? '', /¥3,980/)
  assert.match(manage?.sub ?? '', /500/)
  // 10人のとき、次の1人（11人目）は 2,980円・400
  const t10 = decideUpsell({ kind: 'team', isOwner: true, trigger: 'low', seats: 10, canBuyPack: true, canCheckoutTeam: true, perSeat: true })
  const m10 = t10.secondary.find((a) => a.kind === 'link' && a.href === '/pricing#manage')
  assert.match(m10?.sub ?? '', /¥2,980/)
  assert.match(m10?.sub ?? '', /400/)
})

test('公開用の言い方: 旗が off なら今のまま、on なら1人いくら（環境ごとに別のプロセスで読む）', () => {
  // public-copy は読み込み時に値を決めるので、環境変数を変えて別のプロセスで読む
  const read = (flag: string) => JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '-e',
    "import('./src/lib/pricing-v2/public-copy.ts').then((ns) => { const m = ns.PUBLIC_PRICE ? ns : ns.default; console.log(JSON.stringify({ sentence: m.PUBLIC_PRICE_SENTENCE, isPerSeat: m.PUBLIC_PRICE.isPerSeat, meta: m.PRICING_META_SENTENCE, upgrade: m.UPGRADE_LEAD })) })"],
  { env: { ...process.env, NEXT_PUBLIC_PER_SEAT_PRICING_PUBLIC: flag }, encoding: 'utf8', cwd: process.cwd() })) as { sentence: string; isPerSeat: boolean; meta: string; upgrade: string }
  const off = read('')
  assert.equal(off.sentence, '3人までは無料で使えます。有料のチームは、基本料 ¥9,800＋使う人数×¥2,980（月額・税抜。11人目からは1人 ¥2,480）です。5人なら月 ¥24,700（税抜）、税込 ¥27,170。料金は会社ごとで、全ツールを使えます。')
  assert.equal(off.meta, '3人までは無料で、人数が増えたら有料のチームです。5人なら月 ¥24,700（税抜）、税込 ¥27,170。料金は会社ごとで、全ツールを使えます。')
  assert.equal(off.upgrade, '人数が増えたら有料のチームへ')
  assert.equal(off.isPerSeat, false)
  const on = read('on')
  assert.equal(on.sentence, '0円で使えます（3人まで）。もっと使いたいとき・4人以上で使うときは、1人 月 ¥3,980（税抜。税込 ¥4,378）です。11人目からは、1人あたりがもっと安くなります。5人なら月 ¥19,900（税抜）、税込 ¥21,890。料金は会社ごとで、全ツールを使えます。')
  assert.ok(!on.sentence.includes('基本料'))
  assert.equal(on.meta, on.sentence)
  assert.equal(on.isPerSeat, true)
})
