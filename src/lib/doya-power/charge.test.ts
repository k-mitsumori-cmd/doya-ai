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
import { createDoyaPowerCharger, gaugeLimit, DOYA_POWER_CONSUMED_HEADER, type ChargeDeps } from './charge-core'
import { DOYA_POWER_COSTS } from './costs'
import { DAILY_RECOVERY_AMOUNT, SOLO_PRO_MONTHLY_GRANT } from './rules'

const isPaid = (p?: string | null) => p === 'PRO'

function setup(over: Partial<ChargeDeps> & { rolloutValue?: string; enabled?: boolean; uiNext?: boolean; plan?: string | null; hasCompany?: boolean } = {}) {
  const t = new Date('2026-10-23T03:00:00.000Z')
  const clock = over.now ?? (() => new Date(t.getTime()))
  const mem = createMemoryDb({ now: clock })
  mem.rows('accountCompany').push({ id: 'co_alice', userId: 'alice', name: 'アリス株式会社' })
  const planOf = over.plan === undefined ? 'PRO' : over.plan
  const ledger = createDoyaPowerLedger(mem.db, { now: clock, isPaidCompany: async () => isPaid(planOf) })
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
      recentConsume: (...a) => { calls.push('recent'); return ledger.recentConsume(...a) },
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
  // 今月の付与（3000）だけ（有料の人には毎日の回復は付かない）から 20 減る
  assert.equal(await s.remaining(), SOLO_PRO_MONTHLY_GRANT - 20)
})

test('同じ操作の ID では1回だけ減る（今月の付与も1回だけ）', async () => {
  const s = setup()
  const a = await s.charger.charge('text.generate', { key: 'op-1' })
  const b = await s.charger.charge('text.generate', { key: 'op-1' })
  assert.equal(a.kind, 'charged')
  assert.equal(b.kind, 'charged')
  if (b.kind === 'charged') assert.equal(b.duplicated, true)
  assert.equal(await s.remaining(), SOLO_PRO_MONTHLY_GRANT - 1)
  assert.equal(s.mem.rows('doyaPowerGrant').filter((g) => g.kind === 'monthly').length, 1)
})

test('失敗（4xx/5xx の応答・例外）なら戻る。成功なら戻らない', async () => {
  const s = setup()
  const full = SOLO_PRO_MONTHLY_GRANT
  const r1 = await s.charger.run(await s.charger.charge('persona.generate'), async () => new Response('{}', { status: 500 }))
  assert.equal(r1.status, 500)
  assert.equal(await s.remaining(), full)
  await assert.rejects(s.charger.run(await s.charger.charge('persona.generate'), async () => { throw new Error('provider down') }), /provider down/)
  assert.equal(await s.remaining(), full)
  const r3 = await s.charger.run(await s.charger.charge('persona.generate'), async () => ok())
  assert.equal(r3.status, 200)
  assert.equal(await s.remaining(), full - DOYA_POWER_COSTS['persona.generate'])
})

test('有料の AI を呼んだあとの失敗（印つきの応答）は戻らない。印は利用者に返す前に外す', async () => {
  const s = setup()
  const full = SOLO_PRO_MONTHLY_GRANT
  const res = await s.charger.run(await s.charger.charge('persona.generate'), async () => new Response('{}', { status: 502, headers: { [DOYA_POWER_CONSUMED_HEADER]: '1' } }))
  assert.equal(res.status, 502)
  assert.equal(res.headers.get(DOYA_POWER_CONSUMED_HEADER), null)
  assert.equal(await s.remaining(), full - DOYA_POWER_COSTS['persona.generate'])
  // 印の値が '1' でなければ、今までどおり戻る
  await s.charger.run(await s.charger.charge('persona.generate'), async () => new Response('{}', { status: 502, headers: { [DOYA_POWER_CONSUMED_HEADER]: 'yes' } }))
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
      recentConsume: async () => null,
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
  assert.deepEqual(st, { balance: { remaining: SOLO_PRO_MONTHLY_GRANT, limit: SOLO_PRO_MONTHLY_GRANT }, costs: {} })
})

test('同じ ID の2回目が失敗しても、前の成功の分は戻らない（同じ ID の使い回しで、タダで作り直せない）', async () => {
  const s = setup()
  const full = SOLO_PRO_MONTHLY_GRANT
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
  const full = SOLO_PRO_MONTHLY_GRANT
  const cost = DOYA_POWER_COSTS['image.refine']
  // 1回目は失敗して戻る
  await s.charger.run(await s.charger.charge('image.refine', { key: 'op-y' }), async () => new Response('{}', { status: 502 }))
  assert.equal(await s.remaining(), full)
  // 同じ ID で作り直すと、また減る（タダにならない）
  const retry = await s.charger.charge('image.refine', { key: 'op-y' })
  assert.equal(retry.kind, 'charged')
  if (retry.kind === 'charged') {
    assert.equal(retry.duplicated, false)
    assert.match(retry.operationId, /:op-y:\d+:retry-/)
  }
  assert.equal(await s.remaining(), full - cost)
})

// ---- 5分以内の作り直しは半分 ----
function withClock(over: Parameters<typeof setup>[0] = {}) {
  let ms = new Date('2026-10-23T03:00:00.000Z').getTime()
  const clock = () => new Date(ms)
  const s = setup({ now: clock, ...over })
  return { s, advance: (m: number) => { ms += m * 60_000 } }
}

test('作り直し（retryOf）が5分以内なら、減る量は半分（切り上げ）。5分を過ぎたら全額', async () => {
  const w = withClock()
  const first = await w.s.charger.charge('banner.generate', { key: 'a1' })
  assert.equal(first.kind, 'charged')
  if (first.kind === 'charged') assert.equal(first.halved, false)
  const before = await w.s.remaining()
  w.advance(4)
  const retry = await w.s.charger.charge('banner.generate', { key: 'a2', retryOf: 'a1' })
  assert.equal(retry.kind, 'charged')
  if (retry.kind === 'charged') {
    assert.equal(retry.halved, true)
    assert.equal(retry.amount, 5)
  }
  assert.equal(await w.s.remaining(), before - 5)
  // 6分後は全額
  w.advance(6)
  const late = await w.s.charger.charge('banner.generate', { key: 'a3', retryOf: 'a2' })
  if (late.kind === 'charged') {
    assert.equal(late.halved, false)
    assert.equal(late.amount, 10)
  }
})

test('半分は切り上げ（7 は 4）。retryOf も target も無ければ半分にしない', async () => {
  const w = withClock()
  await w.s.charger.charge('image.refine', { key: 'b1' })
  const r = await w.s.charger.charge('image.refine', { key: 'b2', retryOf: 'b1' })
  if (r.kind === 'charged') assert.equal(r.amount, 4)
  const plain = await w.s.charger.charge('image.refine', { key: 'b3' })
  if (plain.kind === 'charged') assert.equal(plain.amount, 7)
})

test('半分になるのは、同じ会社・同じ操作の名前だけ。別の操作・存在しない前の操作・戻した前の操作は全額', async () => {
  const w = withClock()
  await w.s.charger.charge('banner.generate', { key: 'c1' })
  // 別の操作の名前
  const other = await w.s.charger.charge('image.refine', { key: 'c2', retryOf: 'c1' })
  if (other.kind === 'charged') assert.equal(other.amount, 7)
  // 存在しない前の操作
  const ghost = await w.s.charger.charge('banner.generate', { key: 'c3', retryOf: 'nothing' })
  if (ghost.kind === 'charged') assert.equal(ghost.amount, 10)
  // 前の操作が失敗して戻っていたら、作り直しも全額（半分にしない）
  const failed = await w.s.charger.charge('slide.generate', { key: 'd1' })
  await w.s.charger.run(failed, async () => new Response('{}', { status: 500 }))
  const again = await w.s.charger.charge('slide.generate', { key: 'd2', retryOf: 'd1' })
  if (again.kind === 'charged') assert.equal(again.amount, 30)
})

test('同じ対象のキー（target）でも、5分以内なら半分。別の対象は全額', async () => {
  const w = withClock()
  await w.s.charger.charge('seo.article', { key: 'e1', target: 'doc-1' })
  w.advance(2)
  const same = await w.s.charger.charge('seo.article', { key: 'e2', target: 'doc-1' })
  if (same.kind === 'charged') assert.equal(same.amount, 20)
  const diff = await w.s.charger.charge('seo.article', { key: 'e3', target: 'doc-2' })
  if (diff.kind === 'charged') assert.equal(diff.amount, 40)
})

test('旗が off のときは、作り直しの確認でも台帳に触れない', async () => {
  const s = setup({ rolloutValue: 'off' })
  const o = await s.charger.charge('banner.generate', { key: 'x2', retryOf: 'x1' })
  assert.equal(o.kind, 'skip')
  assert.ok(!s.calls.includes('recent'))
})

// ---- 毎日の回復は無料プランだけ ----
test('毎日の回復は無料の会社だけ。有料の会社には毎月の付与だけ付く', async () => {
  const paid = setup({ plan: 'PRO' })
  const pb = await paid.ledger.balance('co_alice')
  await paid.charger.charge('text.generate', { key: 'p1' })
  assert.equal(pb!.byKind.daily_recovery, 0)
  assert.equal(pb!.nextRecoveryAt, null)
  assert.equal(paid.mem.rows('doyaPowerGrant').filter((g) => g.kind === 'daily_recovery').length, 0)
  assert.equal(await paid.remaining(), SOLO_PRO_MONTHLY_GRANT - 1)

  const free = setup({ plan: 'FREE' })
  const fb = await free.ledger.balance('co_alice')
  assert.equal(fb!.byKind.daily_recovery, DAILY_RECOVERY_AMOUNT)
  assert.equal(fb!.total, DAILY_RECOVERY_AMOUNT)
  assert.equal(free.mem.rows('doyaPowerGrant').filter((g) => g.kind === 'monthly').length, 0)
})

test('ルートの名前空間（scope）がちがえば、同じ操作の名前・同じキーでも別の操作。安いルートで払ったキーを別のルートに送ってもタダにならない', async () => {
  const s = setup()
  const a = await s.charger.charge('text.generate', { key: 'same-key', scope: 'r-aaaaaaaaaaaa' })
  assert.equal(a.kind, 'charged')
  const after = await s.remaining()
  const b = await s.charger.charge('text.generate', { key: 'same-key', scope: 'r-bbbbbbbbbbbb' })
  assert.equal(b.kind, 'charged')
  if (a.kind === 'charged' && b.kind === 'charged') {
    assert.equal(b.duplicated, false)
    assert.notEqual(a.operationId, b.operationId)
  }
  assert.ok((await s.remaining()) < after)
  // 同じルートの同じキーは、今までどおり支払い済みの重複
  const c = await s.charger.charge('text.generate', { key: 'same-key', scope: 'r-aaaaaaaaaaaa' })
  if (c.kind === 'charged') assert.equal(c.duplicated, true)
  // 操作の名前がちがえば、同じルートの名前空間でも別の操作
  const d = await s.charger.charge('image.refine', { key: 'same-key', scope: 'r-aaaaaaaaaaaa' })
  if (d.kind === 'charged') assert.equal(d.duplicated, false)
})

test('scope があっても、作り直し（retryOf）は前の操作を見つけて半分になる', async () => {
  const s = setup()
  const a = await s.charger.charge('image.refine', { key: 'first', scope: 'r-aaaaaaaaaaaa' })
  assert.equal(a.kind, 'charged')
  const b = await s.charger.charge('image.refine', { key: 'second', retryOf: 'first', scope: 'r-aaaaaaaaaaaa' })
  if (a.kind === 'charged' && b.kind === 'charged') assert.equal(b.halved, true)
})
