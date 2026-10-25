import test from 'node:test'
import assert from 'node:assert/strict'
import { decideInvite, decideSeatChange, findSeatItem, isSeatCacheFresh, isValidOperationKey, jstMonthRemainingFraction, memberLimit, normalizeEmail, seatAddGrants, seatsUsed, teamMonthlyGrant, SEAT_CACHE_TTL_MS } from './team'
import { subscriptionAmount, tieredAmount, tieredPriceIdsMissingTiers, type TierLike } from './amount'
import { powerPackPriceId } from './prices'
import { TEAM_SEAT_TIERS, teamMonthly, teamMonthlyPoints, withTax } from './plans'

const owner = { ownerUserId: 'u-owner', ownerEmail: 'Owner@Example.com' }

// ---------- メンバーの数え方 ----------

test('持ち主は行が無くても1人目。招待中と参加を数え、外した人は数えない', () => {
  assert.equal(seatsUsed({ ...owner, members: [] }), 1)
  assert.equal(seatsUsed({ ...owner, members: [
    { email: 'a@example.com', userId: null, status: 'invited' },
    { email: 'b@example.com', userId: 'u-b', status: 'active' },
    { email: 'c@example.com', userId: 'u-c', status: 'removed' },
  ] }), 3)
})

test('持ち主と同じ人の行は、重ねて数えない（メールの大文字・小文字の違いも同じ人）', () => {
  assert.equal(seatsUsed({ ...owner, members: [
    { email: 'owner@example.com', userId: null, status: 'active' },
    { email: 'x@example.com', userId: 'u-owner', status: 'active' },
  ] }), 1)
})

test('メールは小文字にそろえ、形が違えば null', () => {
  assert.equal(normalizeEmail('  Taro@Example.COM '), 'taro@example.com')
  for (const v of ['', 'taro', 'a@b', 'a b@example.com', null, 3]) assert.equal(normalizeEmail(v), null)
})

test('招待: 人数がいっぱいなら断る。同じ人・持ち主・形の違うメールも断る', () => {
  const members = [{ email: 'a@example.com', userId: null, status: 'invited' }]
  assert.deepEqual(decideInvite({ email: 'b@example.com', ownerEmail: owner.ownerEmail, members, used: 2, seats: 3 }), { ok: true })
  assert.deepEqual(decideInvite({ email: 'b@example.com', ownerEmail: owner.ownerEmail, members, used: 3, seats: 3 }), { ok: false, status: 409, code: 'NO_SEAT' })
  assert.deepEqual(decideInvite({ email: 'A@example.com', ownerEmail: owner.ownerEmail, members, used: 2, seats: 5 }), { ok: false, status: 409, code: 'ALREADY_MEMBER' })
  assert.deepEqual(decideInvite({ email: 'owner@example.com', ownerEmail: owner.ownerEmail, members, used: 2, seats: 5 }), { ok: false, status: 400, code: 'OWNER_SELF' })
  assert.deepEqual(decideInvite({ email: 'nope', ownerEmail: owner.ownerEmail, members, used: 2, seats: 5 }), { ok: false, status: 400, code: 'INVALID_EMAIL' })
})

test('外した人は、もう一度招待できる', () => {
  const members = [{ email: 'a@example.com', userId: 'u-a', status: 'removed' }]
  assert.deepEqual(decideInvite({ email: 'a@example.com', ownerEmail: null, members, used: 1, seats: 3 }), { ok: true })
})

test('入れる人数の上限: チーム＝買った人数、フリー＝3人、据え置き＝1人', () => {
  assert.equal(memberLimit('team', 12), 12)
  assert.equal(memberLimit('none', null), 3)
  assert.equal(memberLimit('legacy', null), 1)
  assert.equal(memberLimit('team', null), 1)
})

// ---------- 人数の変更 ----------

test('増やす: その場で日割りを請求する。増えた席の番号を返す', () => {
  assert.deepEqual(decideSeatChange({ current: 5, requested: 8, used: 4 }), { ok: true, direction: 'up', prorationBehavior: 'always_invoice', addedSeats: [6, 7, 8] })
})

test('増えた席の付与: 席の番号ごとに月1回。量は 1人分 × 今月の残りの割合', () => {
  const start = new Date('2026-10-31T15:00:00.000Z') // 11/1 0:00 JST
  assert.equal(jstMonthRemainingFraction(start), 1)
  const g = seatAddGrants({ subscriptionId: 'sub_1', monthKey: '2026-11', addedSeats: [6, 7], now: start })
  assert.deepEqual(g, [
    { sourceKey: 'seat-add:sub_1:2026-11:seat-6', amount: 300 },
    { sourceKey: 'seat-add:sub_1:2026-11:seat-7', amount: 300 },
  ])
  // 月の半ば（11/16 0:00 JST）は半分
  assert.equal(seatAddGrants({ subscriptionId: 'sub_1', monthKey: '2026-11', addedSeats: [6], now: new Date('2026-11-15T15:00:00.000Z') })[0]!.amount, 150)
  // 月の終わりの直前は 0 で、付けない
  assert.deepEqual(seatAddGrants({ subscriptionId: 'sub_1', monthKey: '2026-11', addedSeats: [6], now: new Date('2026-11-30T14:59:59.000Z') }), [])
})

test('減らしてまた増やしても、同じ月の同じ席の番号は同じ sourceKey（台帳で二重に付かない）', () => {
  const now = new Date('2026-11-10T03:00:00.000Z')
  const first = seatAddGrants({ subscriptionId: 'sub_1', monthKey: '2026-11', addedSeats: decideSeatChange({ current: 5, requested: 8, used: 1 }).ok ? [6, 7, 8] : [], now })
  const again = seatAddGrants({ subscriptionId: 'sub_1', monthKey: '2026-11', addedSeats: [6, 7, 8], now })
  assert.deepEqual(first.map((g) => g.sourceKey), again.map((g) => g.sourceKey))
})

test('操作 ID は 16〜64 文字の英数字・ハイフン・下線だけ', () => {
  assert.ok(isValidOperationKey('a1b2c3d4e5f6g7h8'))
  for (const v of ['short', 'x'.repeat(65), 'has space 1234567890', null, 1]) assert.ok(!isValidOperationKey(v))
})

test('減らす: 返金なし。使っている人数より下げられない', () => {
  assert.deepEqual(decideSeatChange({ current: 8, requested: 6, used: 4 }), { ok: true, direction: 'down', prorationBehavior: 'none', addedSeats: [] })
  assert.deepEqual(decideSeatChange({ current: 8, requested: 3, used: 4 }), { ok: false, status: 409, code: 'BELOW_USED' })
})

test('人数の変更: 同じ人数・範囲外・50人以上は断る', () => {
  assert.deepEqual(decideSeatChange({ current: 5, requested: 5, used: 1 }), { ok: false, status: 400, code: 'NO_CHANGE' })
  assert.deepEqual(decideSeatChange({ current: 5, requested: 50, used: 1 }), { ok: false, status: 400, code: 'ENTERPRISE_QUOTE' })
  for (const r of [0, -1, 2.5, '6', null]) assert.deepEqual(decideSeatChange({ current: 5, requested: r, used: 1 }), { ok: false, status: 400, code: 'INVALID_SEATS' })
})

test('チームの毎月の付与は人数から。人数が分からなければ null（今までの量を使う）', () => {
  assert.equal(teamMonthlyGrant(10), teamMonthlyPoints(10))
  assert.equal(teamMonthlyGrant(null), null)
  assert.equal(teamMonthlyGrant(80), null)
})

test('人数の明細は、新しい料金の人数の価格で探す', () => {
  const items = [{ id: 'si_base', quantity: 1, price: { id: 'price_base' } }, { id: 'si_seat', quantity: 7, price: { id: 'price_seat' } }]
  assert.equal(findSeatItem(items, new Set(['price_seat']))?.id, 'si_seat')
  assert.equal(findSeatItem(items, new Set(['price_other'])), null)
})

test('人数の控えは1日で古くなる。未来の時刻は信じない', () => {
  const now = new Date('2026-10-25T00:00:00Z')
  assert.ok(isSeatCacheFresh(new Date(now.getTime() - 1000), now))
  assert.ok(!isSeatCacheFresh(new Date(now.getTime() - SEAT_CACHE_TTL_MS), now))
  assert.ok(!isSeatCacheFresh(new Date(now.getTime() + 60_000), now))
  assert.ok(!isSeatCacheFresh(null, now))
})

// ---------- 明細ごとの金額（日次監査の月次売上） ----------

const SEAT_TIERS_TAXED: TierLike[] = TEAM_SEAT_TIERS.map((t, i) => ({
  up_to: i === TEAM_SEAT_TIERS.length - 1 ? null : t.upTo,
  unit_amount: withTax(t.unitMonthly),
  flat_amount: null,
}))

test('段階別（graduated）: 1〜10人目 3,278円、11人目から 2,728円（税込）', () => {
  assert.equal(tieredAmount(SEAT_TIERS_TAXED, 5, 'graduated'), 5 * 3278)
  assert.equal(tieredAmount(SEAT_TIERS_TAXED, 12, 'graduated'), 10 * 3278 + 2 * 2728)
  assert.equal(tieredAmount(SEAT_TIERS_TAXED, 0, 'graduated'), 0)
})

test('段階別（volume）: 入る段の単価 × 数量', () => {
  assert.equal(tieredAmount(SEAT_TIERS_TAXED, 12, 'volume'), 12 * 2728)
})

test('チームの契約（基本料＋人数）の1回の請求額は、税込の月額と同じ', () => {
  for (const n of [1, 10, 11, 30, 49]) {
    const items = [
      { quantity: 1, price: { id: 'price_base', unit_amount: withTax(9800), recurring: { interval: 'month', interval_count: 1 } } },
      { quantity: n, price: { id: 'price_seat', unit_amount: null, billing_scheme: 'tiered', tiers_mode: 'graduated', recurring: { interval: 'month', interval_count: 1 } } },
    ]
    const r = subscriptionAmount(items, new Map([['price_seat', SEAT_TIERS_TAXED]]))
    assert.equal(r.known, true)
    assert.equal(r.amount, withTax(9800) + tieredAmount(SEAT_TIERS_TAXED, n, 'graduated'))
    // 税込の単価で足したもの（円未満の切り捨てが行ごとなので、税抜の合計の税込と最大で数円ずれる）
    assert.ok(Math.abs(r.amount - withTax(teamMonthly(n)!)) <= n + 1)
  }
})

test('段階の表が無い段階別の価格は数えない（known=false）。表を取りに行く価格 ID を返す', () => {
  const items = [
    { quantity: 1, price: { id: 'price_base', unit_amount: 10780 } },
    { quantity: 3, price: { id: 'price_seat', unit_amount: null, billing_scheme: 'tiered', tiers_mode: 'graduated' } },
  ]
  assert.deepEqual(subscriptionAmount(items).known, false)
  assert.equal(subscriptionAmount(items).amount, 10780)
  assert.deepEqual(tieredPriceIdsMissingTiers(items), ['price_seat'])
})

test('今の契約（明細1つの定額）は、今までと同じ額', () => {
  const r = subscriptionAmount([{ quantity: 1, price: { id: 'price_legacy', unit_amount: 9980, recurring: { interval: 'month' } } }])
  assert.deepEqual(r, { amount: 9980, known: true, interval: 'month', intervalCount: 1 })
})

// ---------- 追加購入の価格 ----------

test('追加購入の価格: 未設定・形が違う・今の価格やチームの価格と同じなら売らない', () => {
  const base = { STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy', STRIPE_PRICE_TEAM_BASE_MONTHLY: 'price_tb_m', STRIPE_PRICE_TEAM_BASE_YEARLY: 'price_tb_y', STRIPE_PRICE_TEAM_SEAT_MONTHLY: 'price_ts_m', STRIPE_PRICE_TEAM_SEAT_YEARLY: 'price_ts_y' }
  assert.equal(powerPackPriceId({ ...base, STRIPE_PRICE_POWER_PACK: 'price_pack' }), 'price_pack')
  assert.equal(powerPackPriceId(base), null)
  assert.equal(powerPackPriceId({ ...base, STRIPE_PRICE_POWER_PACK: 'pack' }), null)
  assert.equal(powerPackPriceId({ ...base, STRIPE_PRICE_POWER_PACK: 'price_legacy' }), null)
  assert.equal(powerPackPriceId({ ...base, STRIPE_PRICE_POWER_PACK: 'price_ts_m' }), null)
})

// ---------- 支払いの状態の見せ方 ----------
import { billingStatusView, BILLING_PORTAL_HREF } from './billing'

test('支払いの遅れ（past_due）は、今のプランのままと伝え、お支払い方法の更新へ案内する', () => {
  const v = billingStatusView({ status: 'past_due', cancelAtPeriodEnd: false })
  assert.equal(v.tone, 'bad')
  assert.equal(v.action?.href, BILLING_PORTAL_HREF)
  assert.match(v.body, /今のプランのまま/)
})

test('解約の予約は、期間の終わりまで使えて取り消せると伝える。ふつうの契約は案内を出さない', () => {
  assert.equal(billingStatusView({ status: 'active', cancelAtPeriodEnd: true }).tone, 'note')
  assert.equal(billingStatusView({ status: 'active', cancelAtPeriodEnd: false }).action, null)
  assert.equal(billingStatusView({ status: 'unpaid', cancelAtPeriodEnd: false }).tone, 'bad')
  assert.equal(billingStatusView({ status: 'trialing', cancelAtPeriodEnd: false }).tone, 'ok')
})

test('カスタマーポータルの戻り先は料金ページ', () => {
  assert.equal(decodeURIComponent(BILLING_PORTAL_HREF.split('returnTo=')[1]!), '/pricing')
})

// ---------- 招待の期限（7日） ----------
import { INVITE_TTL_DAYS, isInviteAlive } from './team'

test('招待の期限: 7日を過ぎた招待は使えず、席にも数えない。招待し直せる', () => {
  const now = new Date('2026-10-26T00:00:00Z')
  const fresh = new Date(now.getTime() - 6 * 24 * 3600_000)
  const old = new Date(now.getTime() - INVITE_TTL_DAYS * 24 * 3600_000)
  assert.ok(isInviteAlive(fresh, now))
  assert.ok(!isInviteAlive(old, now))
  assert.ok(!isInviteAlive(null, now))
  const members = [
    { email: 'a@example.com', userId: null, status: 'invited', invitedAt: fresh },
    { email: 'b@example.com', userId: null, status: 'invited', invitedAt: old },
  ]
  assert.equal(seatsUsed({ ...owner, members, now }), 2)
  assert.deepEqual(decideInvite({ email: 'b@example.com', ownerEmail: owner.ownerEmail, members, used: 2, seats: 3, now }), { ok: true })
})
