// 実行: npm run test:doyapower
// 音声（AI商談・AI面接）のドヤパワー（voice-core.ts）。メモリの上の DB の台帳だけを使う。本物の DB・課金・AI には触れない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDoyaPowerLedger } from './ledger'
import { createMemoryDb } from './memory-db'
import { createVoiceCharger, voiceActualMinutes, voiceChargeMinutes, VOICE_CHARGE_GRACE_MINUTES, type VoiceDeps } from './voice-core'
import { DOYA_POWER_COSTS } from './costs'
import { DAILY_RECOVERY_AMOUNT, SOLO_PRO_MONTHLY_GRANT } from './rules'

const PER_MIN = DOYA_POWER_COSTS['voice.minute']
const FULL = SOLO_PRO_MONTHLY_GRANT

function setup(over: { rollout?: string; email?: string | null; plan?: string | null; companyId?: string | null } = {}) {
  const t = new Date('2026-10-23T03:00:00.000Z')
  const clock = () => new Date(t.getTime())
  const mem = createMemoryDb({ now: clock })
  mem.rows('accountCompany').push({ id: 'co_owner', userId: 'owner', name: '持ち主の会社' })
  const ledger = createDoyaPowerLedger(mem.db, { now: clock, isPaidCompany: async () => (over.plan === undefined ? 'PRO' : over.plan) === 'PRO' })
  const calls: string[] = []
  const deps: VoiceDeps = {
    rollout: () => { calls.push('rollout'); return over.rollout ?? 'preview' },
    owner: async () => { calls.push('owner'); return { email: over.email === undefined ? 'owner@example.invalid' : over.email, plan: over.plan === undefined ? 'PRO' : over.plan, companyId: over.companyId === undefined ? 'co_owner' : over.companyId } },
    allowed: (email) => email === 'owner@example.invalid',
    ledger: {
      consume: (...a) => ledger.consume(...a),
      refund: (...a) => ledger.refund(...a),
      grantMonthlyForPlan: (...a) => ledger.grantMonthlyForPlan(...a),
      operationStatus: (...a) => ledger.operationStatus(...a),
    },
    log: () => {},
  }
  const voice = createVoiceCharger(deps)
  const remaining = async () => (await ledger.balance('co_owner'))?.total ?? 0
  return { voice, calls, mem, remaining }
}
const msg = { insufficient: '足りません' }

test('分数の決め方: 設定の分数 + 3分を仮に減らし、実際は始めてから終わるまで（切り上げ）', () => {
  assert.equal(voiceChargeMinutes(10), 10 + VOICE_CHARGE_GRACE_MINUTES)
  assert.equal(voiceChargeMinutes(45), 48)
  assert.equal(voiceChargeMinutes(NaN), 13)
  assert.equal(voiceActualMinutes(new Date('2026-10-23T03:00:00Z'), new Date('2026-10-23T03:07:10Z')), 8)
  assert.equal(voiceActualMinutes(null, new Date()), 0)
})

test('旗が off なら、持ち主も台帳も読まずに減らさない。相手側も今までどおり', async () => {
  const s = setup({ rollout: 'off' })
  assert.equal((await s.voice.hold('mensetsu', 'org', 'k1', 13, msg)).kind, 'skip')
  assert.equal(await s.voice.allowance('mensetsu', 'org', 'k1', 10), null)
  await s.voice.settle('mensetsu', 'org', 'k1', 5)
  assert.deepEqual([...new Set(s.calls)], ['rollout'])
  assert.equal(s.mem.rows('doyaPowerTransaction').length, 0)
})

test('preview で持ち主が許可されていない・会社が無いときは減らさない', async () => {
  for (const over of [{ email: 'other@example.invalid' }, { companyId: null }]) {
    const s = setup(over)
    assert.equal((await s.voice.hold('aishodan', 'org', 'k1', 13, msg)).kind, 'skip', JSON.stringify(over))
    assert.equal(s.mem.rows('doyaPowerTransaction').length, 0)
  }
})

test('発行（開始）のとき最大の分数ぶん減り、終わったら実際の分数との差が戻る（1回だけ）', async () => {
  const s = setup()
  const h = await s.voice.hold('mensetsu', 'org', 'k1', voiceChargeMinutes(10), msg)
  assert.equal(h.kind, 'charged')
  assert.equal(await s.remaining(), FULL - 13 * PER_MIN)
  // 相手側: 仮に減らした分数まで続けられる
  assert.deepEqual(await s.voice.allowance('mensetsu', 'org', 'k1', 10), { minutes: 13 })
  await s.voice.settle('mensetsu', 'org', 'k1', 7)
  assert.equal(await s.remaining(), FULL - 7 * PER_MIN)
  // 2回目の清算（end と cron が重なったなど）は何もしない
  await s.voice.settle('mensetsu', 'org', 'k1', 7)
  assert.equal(await s.remaining(), FULL - 7 * PER_MIN)
  // 終わったあとは、相手側は続けられない
  assert.equal(await s.voice.allowance('mensetsu', 'org', 'k1', 10), 'closed')
})

test('実際の分数が仮に減らした分を超えても、仮に減らした分までしか減らない。始めなければ全部戻る', async () => {
  const s = setup()
  await s.voice.hold('aishodan', 'org', 'k2', 13, msg)
  await s.voice.settle('aishodan', 'org', 'k2', 60)
  assert.equal(await s.remaining(), FULL - 13 * PER_MIN)
  const t = setup()
  await t.voice.hold('mensetsu', 'org', 'k3', 13, msg)
  await t.voice.settle('mensetsu', 'org', 'k3', 0)
  assert.equal(await t.remaining(), FULL)
})

test('足りなければ 402 で、発行（開始）しない', async () => {
  const s = setup({ plan: 'FREE' })
  const h = await s.voice.hold('aishodan', 'org', 'k4', voiceChargeMinutes(45), msg)
  assert.equal(h.kind, 'blocked')
  if (h.kind === 'blocked') {
    // 相手側の API（商談の開始）は response を使わず、reason を見て残りの量を出さない案内を返す
    assert.equal(h.reason, 'insufficient')
    assert.equal(h.response.status, 402)
    const j = await h.response.json()
    assert.equal(j.code, 'DOYA_POWER_INSUFFICIENT')
    assert.equal(j.required, 48 * PER_MIN)
  }
  assert.equal(await s.remaining(), DAILY_RECOVERY_AMOUNT)
})

test('旗を入れる前の面接・商談（台帳に記録なし）は、相手側は今までどおり', async () => {
  const s = setup()
  assert.equal(await s.voice.allowance('mensetsu', 'org', 'never-held', 10), null)
})
