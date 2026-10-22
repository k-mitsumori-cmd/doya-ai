// 実行: npm run test:doyapower
// 生成の API でドヤパワーを減らす・戻す（charge-core.ts）。メモリの上の DB の台帳だけを使う。本物の DB・課金・AI には触れない。
// - off のときは、セッション・会社・台帳を一度も読まずに、今までの処理を呼ぶ
// - preview で許可された人だけ減る。許可されていない人・新しい見た目でない人・会社が未登録の人は減らない
// - 同じ操作の ID では1回だけ減る。失敗（例外・4xx/5xx）なら戻る
// - 足りなければ 402 を返し、今までの処理（有料の API）を呼ばない。台帳が読めなければ 503 で、やはり呼ばない
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDoyaPowerLedger } from './ledger'
import { createMemoryDb } from './memory-db'
import { createDoyaPowerCharger, gaugeLimit, type ChargeDeps } from './charge-core'
import { DOYA_POWER_COSTS } from './costs'
import { DAILY_RECOVERY_AMOUNT, SOLO_PRO_MONTHLY_GRANT } from './rules'

const isPaid = (p?: string | null) => p === 'PRO'

function setup(over: Partial<ChargeDeps> & { rolloutValue?: string; enabled?: boolean; uiNext?: boolean; plan?: string | null; hasCompany?: boolean } = {}) {
  const t = new Date('2026-10-23T03:00:00.000Z')
  const clock = () => new Date(t.getTime())
  const mem = createMemoryDb({ now: clock })
  mem.rows('accountCompany').push({ id: 'co_alice', userId: 'alice', name: 'アリス株式会社' })
  const ledger = createDoyaPowerLedger(mem.db, { now: clock })
  const calls: string[] = []
  let n = 0
  const deps: ChargeDeps = {
    rollout: () => { calls.push('rollout'); return over.rolloutValue ?? 'preview' },
    isEnabled: async () => { calls.push('isEnabled'); return over.enabled ?? true },
    isUiNext: async () => { calls.push('isUiNext'); return over.uiNext ?? true },
    account: async () => { calls.push('account'); return over.hasCompany === false ? null : { companyId: 'co_alice', plan: over.plan === undefined ? 'PRO' : over.plan } },
    ledger: {
      consume: (...a) => { calls.push('consume'); return ledger.consume(...a) },
      refund: (...a) => { calls.push('refund'); return ledger.refund(...a) },
      grantMonthlyForPlan: (...a) => { calls.push('grant'); return ledger.grantMonthlyForPlan(...a) },
      balance: (...a) => { calls.push('balance'); return ledger.balance(...a) },
      operationStatus: (...a) => { calls.push('status'); return ledger.operationStatus(...a) },
    },
    isPaidPlan: isPaid,
    now: clock,
    newKey: () => `k${++n}`,
    log: () => {},
    ...over,
  }
  const charger = createDoyaPowerCharger(deps)
  const remaining = async () => (await ledger.balance('co_alice'))?.total ?? 0
  return { charger, calls, mem, remaining, ledger }
}

const ok = () => new Response('{}', { status: 200 })

test('off のときは、セッション・会社・台帳を読まずに、今までの処理を呼ぶ', async () => {
  const s = setup({ rolloutValue: 'off' })
  let called = 0
  const outcome = await s.charger.charge('banner.generate')
  const res = await s.charger.run(outcome, async () => { called++; return ok() })
  assert.equal(outcome.kind, 'skip')
  assert.equal(res.status, 200)
  assert.equal(called, 1)
  assert.deepEqual(s.calls, ['rollout'])
  assert.equal(s.mem.rows('doyaPowerAccount').length, 0)
  assert.equal(await s.charger.shellState(), null)
  assert.equal(await s.charger.balanceView(), null)
})

test('preview で許可されていない人・新しい見た目でない人・会社が未登録の人は、減らさない', async () => {
  for (const over of [{ enabled: false }, { uiNext: false }, { hasCompany: false }]) {
    const s = setup(over)
    const outcome = await s.charger.charge('banner.generate')
    assert.equal(outcome.kind, 'skip', JSON.stringify(over))
    assert.ok(!s.calls.includes('consume'), JSON.stringify(over))
    assert.equal(s.mem.rows('doyaPowerTransaction').length, 0)
  }
})

test('許可された人は、表の量だけ減る（有料の人には今月の分が先に付く）', async () => {
  const s = setup()
  const outcome = await s.charger.charge('banner.generate', { units: 2 })
  assert.equal(outcome.kind, 'charged')
  if (outcome.kind === 'charged') assert.equal(outcome.amount, DOYA_POWER_COSTS['banner.generate'] * 2)
  // 今月の付与（3000）＋ 今日の回復（10）から 20 減る
  assert.equal(await s.remaining(), SOLO_PRO_MONTHLY_GRANT + DAILY_RECOVERY_AMOUNT - 20)
})

test('同じ操作の ID では1回だけ減る（今月の付与も1回だけ）', async () => {
  const s = setup()
  const a = await s.charger.charge('text.generate', { key: 'op-1' })
  const b = await s.charger.charge('text.generate', { key: 'op-1' })
  assert.equal(a.kind, 'charged')
  assert.equal(b.kind, 'charged')
  if (b.kind === 'charged') assert.equal(b.duplicated, true)
  assert.equal(await s.remaining(), SOLO_PRO_MONTHLY_GRANT + DAILY_RECOVERY_AMOUNT - 1)
  assert.equal(s.mem.rows('doyaPowerGrant').filter((g) => g.kind === 'monthly').length, 1)
})

test('失敗（4xx/5xx の応答・例外）なら戻る。成功なら戻らない', async () => {
  const s = setup()
  const full = SOLO_PRO_MONTHLY_GRANT + DAILY_RECOVERY_AMOUNT
  const r1 = await s.charger.run(await s.charger.charge('persona.generate'), async () => new Response('{}', { status: 500 }))
  assert.equal(r1.status, 500)
  assert.equal(await s.remaining(), full)
  await assert.rejects(s.charger.run(await s.charger.charge('persona.generate'), async () => { throw new Error('provider down') }), /provider down/)
  assert.equal(await s.remaining(), full)
  const r3 = await s.charger.run(await s.charger.charge('persona.generate'), async () => ok())
  assert.equal(r3.status, 200)
  assert.equal(await s.remaining(), full - DOYA_POWER_COSTS['persona.generate'])
})

test('足りなければ 402 と日本語の案内を返し、今までの処理（有料の API）を呼ばない', async () => {
  // 無料の人（今日の回復 10 だけ）がペルソナ（50）を作ろうとする
  const s = setup({ plan: 'FREE' })
  let called = 0
  const res = await s.charger.run(await s.charger.charge('persona.generate'), async () => { called++; return ok() })
  assert.equal(res.status, 402)
  assert.equal(called, 0)
  const j = await res.json()
  assert.equal(j.code, 'DOYA_POWER_INSUFFICIENT')
  assert.match(j.error, /ドヤパワーが足りません/)
  assert.match(j.error, /10月24日 0:00（日本時間）に 10 回復します/)
  assert.equal(j.balance, DAILY_RECOVERY_AMOUNT)
  assert.equal(j.required, DOYA_POWER_COSTS['persona.generate'])
  assert.equal(await s.remaining(), DAILY_RECOVERY_AMOUNT)
})

test('台帳が読めなければ 503 で止め、有料の API を呼ばない', async () => {
  const broken = setup({
    ledger: {
      consume: async () => { throw Object.assign(new Error('db down'), { code: 'P1001' }) },
      refund: async () => ({ ok: false, reason: 'not_found' }),
      grantMonthlyForPlan: async () => ({ ok: true, granted: 0, skipped: 'free_plan' }),
      balance: async () => null,
      operationStatus: async () => 'none',
    },
  })
  let called = 0
  const res = await broken.charger.run(await broken.charger.charge('slide.generate'), async () => { called++; return ok() })
  assert.equal(res.status, 503)
  assert.equal(called, 0)
})

test('減る量が 0 の操作・表に無い操作は減らさない', async () => {
  const s = setup()
  assert.equal((await s.charger.charge('kintai')).kind, 'skip')
  assert.ok(!s.calls.includes('consume'))
})

test('枠のゲージの上限は、有料の人は毎月の付与、無料の人は回復の上限', async () => {
  assert.equal(gaugeLimit(120, 'PRO', isPaid), SOLO_PRO_MONTHLY_GRANT)
  assert.equal(gaugeLimit(40, 'FREE', isPaid), 100)
  assert.equal(gaugeLimit(5000, 'PRO', isPaid), 5000)
  const s = setup()
  const st = await s.charger.shellState()
  assert.deepEqual(st, { balance: { remaining: SOLO_PRO_MONTHLY_GRANT + DAILY_RECOVERY_AMOUNT, limit: SOLO_PRO_MONTHLY_GRANT + DAILY_RECOVERY_AMOUNT }, costs: {} })
})

test('同じ ID の2回目が失敗しても、前の成功の分は戻らない（同じ ID の使い回しで、タダで作り直せない）', async () => {
  const s = setup()
  const full = SOLO_PRO_MONTHLY_GRANT + DAILY_RECOVERY_AMOUNT
  const cost = DOYA_POWER_COSTS['image.refine']
  const first = await s.charger.run(await s.charger.charge('image.refine', { key: 'op-x' }), async () => ok())
  assert.equal(first.status, 200)
  assert.equal(await s.remaining(), full - cost)
  const again = await s.charger.charge('image.refine', { key: 'op-x' })
  assert.equal(again.kind, 'charged')
  if (again.kind === 'charged') assert.equal(again.duplicated, true)
  const second = await s.charger.run(again, async () => new Response('{}', { status: 500 }))
  assert.equal(second.status, 500)
  // 1回目の成功の分は戻らない
  assert.equal(await s.remaining(), full - cost)
})

test('前に戻した操作の ID がもう一度来たら、新しい操作として減らし直す', async () => {
  const s = setup()
  const full = SOLO_PRO_MONTHLY_GRANT + DAILY_RECOVERY_AMOUNT
  const cost = DOYA_POWER_COSTS['image.refine']
  // 1回目は失敗して戻る
  await s.charger.run(await s.charger.charge('image.refine', { key: 'op-y' }), async () => new Response('{}', { status: 502 }))
  assert.equal(await s.remaining(), full)
  // 同じ ID で作り直すと、また減る（タダにならない）
  const retry = await s.charger.charge('image.refine', { key: 'op-y' })
  assert.equal(retry.kind, 'charged')
  if (retry.kind === 'charged') {
    assert.equal(retry.duplicated, false)
    assert.match(retry.operationId, /:op-y:retry-/)
  }
  assert.equal(await s.remaining(), full - cost)
})
