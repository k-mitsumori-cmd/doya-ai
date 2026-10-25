// 旗 NEW_PRICING_ROLLOUT が off（または対象でない人）のとき、今の利用者に何も変化が無いことを、1か所で確かめる（2026-10-26 統括の点検 A）。
// サーバーの部品が新しい表に触れないことは scripts/security-regression/verify-new-pricing-flag-off.cjs が確かめる。
import test from 'node:test'
import assert from 'node:assert/strict'
import { decideNewPricing, parseNewPricingRollout as newPricingRollout } from './rollout'
import { decideLegacyPlanCheckout, decidePricingView, decideTeamCheckout } from './view'
import { isEnterpriseSeatCount, isTeamSeatCount, TEAM_TRIAL_DAYS } from './plans'
import { decideStarter } from './starter'
import { newPricingPlanIdForPriceId } from './prices'
import { gaugeLimit } from '../doya-power/charge-core'
import { SOLO_PRO_MONTHLY_GRANT, TEAM_MONTHLY_GRANT, DAILY_RECOVERY_CAP } from '../doya-power/rules'
import { ONBOARDING_QUESTS, onboardingQuests } from '../missions/rules'
import { buildMissionsView } from '../missions/view'

const isPaid = (p?: string | null) => p === 'PRO'

test('旗の値: 無い・空・知らない値は off', () => {
  for (const v of [undefined, '', 'on', 'true', 'yes']) assert.equal(newPricingRollout(v), 'off')
  assert.equal(decideNewPricing({ rollout: 'off', email: 'a@example.com', allow: ['a@example.com'] }), false)
})

test('off: 料金ページは今のまま・今のプランは今までどおり売る・チームの Checkout は作らない', () => {
  for (const kind of ['none', 'legacy', 'team'] as const) assert.equal(decidePricingView({ enabled: false, kind }), 'current')
  for (const kind of ['none', 'legacy', 'team'] as const) assert.deepEqual(decideLegacyPlanCheckout({ enabled: false, kind }), { ok: true })
  assert.deepEqual(decideTeamCheckout({ enabled: false, configured: true, kind: 'none', seats: 5, isValidSeats: isTeamSeatCount, isEnterpriseSeats: isEnterpriseSeatCount }), { ok: false, status: 404, code: 'NEW_PRICING_DISABLED' })
})

test('off: 有料の毎月の量は今の 3,000。ゲージの上限の基準も今のまま', () => {
  assert.equal(SOLO_PRO_MONTHLY_GRANT, 3000)
  assert.equal(TEAM_MONTHLY_GRANT, 3000)
  assert.equal(gaugeLimit(500, 'PRO', isPaid), 3000)
  assert.equal(gaugeLimit(500, 'PRO', isPaid, null), 3000)
  assert.equal(gaugeLimit(50, 'FREE', isPaid), DAILY_RECOVERY_CAP)
  // 新しい料金の対象の人だけ、毎月の量（据え置き 1,500）が基準になる
  assert.equal(gaugeLimit(500, 'PRO', isPaid, 1500), 1500)
})

test('off: はじめの手順の報酬は今の値（会社情報 +50・招待 +100）。見込みの表示も今の値', () => {
  assert.equal(onboardingQuests(false), ONBOARDING_QUESTS)
  const r = Object.fromEntries(ONBOARDING_QUESTS.map((q) => [q.id, q.reward]))
  assert.deepEqual([r.company_profile, r.invite_member], [50, 100])
  const view = buildMissionsView({ companyName: null, facts: { company: null, acceptedInvites: [], actions: [] }, counts: {} as never, tools: { quote: false, sfa: false } } as never, Date.parse('2026-10-26T03:00:00Z'))
  assert.deepEqual(view.quests.map((q) => q.reward), ONBOARDING_QUESTS.map((q) => q.reward))
})

test('off: はじめの付与（最初の100）は付けない', () => {
  assert.deepEqual(decideStarter({ ledgerAllowed: true, tablesAllowed: false, hasCompany: true, isOwner: true, email: 'a@example.com', verified: true, claimed: false }), { ok: false, reason: 'flag_off' })
})

test('チームの初月無料は既定で付けない（付けるかはユーザーの決定）', () => {
  assert.equal(TEAM_TRIAL_DAYS, 0)
})

test('チームの価格が未設定なら、今の価格は team-pro に読まれない（webhook・同期・監査の判定は今のまま）', () => {
  assert.equal(newPricingPlanIdForPriceId('price_legacy', { STRIPE_PRICE_BANNER_PRO_MONTHLY: 'price_legacy' }), null)
})
