// 実行: npm run test:doyapower
// 「作り直す」の半分（retry.ts と charge-core.ts）。メモリの上の DB の台帳だけを使う。本物の DB・課金・AI には触れない。
// - 前の操作から5分以内の作り直し（retryOf）は半分。5分を過ぎたら全額
// - 他社の操作のキーを retryOf に送っても全額（台帳は同じ会社の操作だけを探す。会社は1人の持ち主に1つ）
// - 同じ作り直しを2回送っても、減るのは1回だけ。作り直しの作り直しも「全額の半分」（4分の1にはならない）
// - 減らした操作のキーは、成功の応答のヘッダーでだけ返す（失敗して戻したとき・減らさなかったときは返さない）
// - 旗が off のときは、retryOf があっても台帳に触れない
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDoyaPowerLedger } from './ledger'
import { createMemoryDb } from './memory-db'
import { createDoyaPowerCharger, type ChargeDeps } from './charge-core'
import { DOYA_POWER_COSTS } from './costs'
import { createRetryMemory, halfAmount, cleanRetryKey, DOYA_POWER_OP_HEADER, RETRY_HALF_WINDOW_MS } from './retry'

const isPaid = (p?: string | null) => p === 'PRO'
const FULL = DOYA_POWER_COSTS['banner.generate']
const HALF = halfAmount(FULL)

/** 2つの会社（アリス・ボブ）が、同じ台帳（同じメモリの DB）を使う */
function world(opts: { rollout?: string } = {}) {
  let ms = new Date('2026-10-24T03:00:00.000Z').getTime()
  const clock = () => new Date(ms)
  const mem = createMemoryDb({ now: clock })
  mem.rows('accountCompany').push({ id: 'co_alice', userId: 'alice', name: 'アリス株式会社' }, { id: 'co_bob', userId: 'bob', name: 'ボブ株式会社' })
  const ledger = createDoyaPowerLedger(mem.db, { now: clock, isPaidCompany: async () => true })
  const calls: string[] = []
  let n = 0
  const chargerFor = (companyId: string) => {
    const deps: ChargeDeps = {
      rollout: () => { calls.push('rollout'); return opts.rollout ?? 'preview' },
      isEnabled: async () => { calls.push('isEnabled'); return true },
      isUiNext: async () => { calls.push('isUiNext'); return true },
      account: async () => { calls.push('account'); return { companyId, plan: 'PRO' } },
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
      newKey: () => `srv-${++n}`,
      log: () => {},
    }
    return createDoyaPowerCharger(deps)
  }
  const remaining = async (companyId: string) => (await ledger.balance(companyId))?.total ?? 0
  return { alice: chargerFor('co_alice'), bob: chargerFor('co_bob'), remaining, calls, mem, advanceSec: (s: number) => { ms += s * 1000 } }
}

const ok = () => new Response('{}', { status: 200 })

test('5分以内（4分59秒）の作り直しは半分。5分を過ぎた（5分1秒）作り直しは全額', async () => {
  const w = world()
  const first = await w.alice.charge('banner.generate', { key: 'g1' })
  assert.equal(first.kind, 'charged')
  w.advanceSec(4 * 60 + 59)
  const before = await w.remaining('co_alice')
  const retry = await w.alice.charge('banner.generate', { retryOf: 'g1' })
  assert.equal(retry.kind, 'charged')
  if (retry.kind === 'charged') {
    assert.equal(retry.halved, true)
    assert.equal(retry.amount, HALF)
  }
  assert.equal(await w.remaining('co_alice'), before - HALF)

  const w2 = world()
  await w2.alice.charge('banner.generate', { key: 'g1' })
  w2.advanceSec(5 * 60 + 1)
  const late = await w2.alice.charge('banner.generate', { retryOf: 'g1' })
  if (late.kind === 'charged') {
    assert.equal(late.halved, false)
    assert.equal(late.amount, FULL)
  } else assert.fail('late retry must be charged')
})

test('他社の操作のキーを retryOf に送っても全額（同じ会社の操作だけが相手）', async () => {
  const w = world()
  const a = await w.alice.charge('banner.generate', { key: 'alice-op' })
  assert.equal(a.kind, 'charged')
  w.advanceSec(30)
  // ボブの口座を先に作っておく（今月の付与が付いた状態から測る）
  await w.bob.charge('text.generate', { key: 'bob-warmup' })
  const bobBefore = await w.remaining('co_bob')
  const b = await w.bob.charge('banner.generate', { retryOf: 'alice-op' })
  if (b.kind === 'charged') {
    assert.equal(b.halved, false)
    assert.equal(b.amount, FULL)
  } else assert.fail('bob must be charged')
  assert.equal(await w.remaining('co_bob'), bobBefore - FULL)
  // アリスの台帳は、ボブの作り直しで動かない
  const aliceTx = w.mem.rows('doyaPowerTransaction').filter((t) => String(t.operationId ?? '').includes(':co_alice:'))
  assert.equal(aliceTx.filter((t) => t.type === 'consume').length, 1)
})

test('サーバーが作ったキー（応答のヘッダーで返す）でも、5分以内の作り直しは半分。ヘッダーは成功のときだけ', async () => {
  const w = world()
  const first = await w.alice.charge('banner.generate', { scope: 'r-aaaaaaaaaaaa' })
  const res = await w.alice.run(first, async () => ok())
  const opKey = res.headers.get(DOYA_POWER_OP_HEADER)
  assert.ok(opKey)
  assert.doesNotMatch(opKey!, /co_alice/) // 会社の ID は返さない
  w.advanceSec(60)
  const retry = await w.alice.charge('banner.generate', { retryOf: opKey, scope: 'r-aaaaaaaaaaaa' })
  if (retry.kind === 'charged') assert.equal(retry.amount, HALF)
  else assert.fail('retry must be charged')

  // 失敗して戻した操作は、キーを返さない（その作り直しは全額）
  const failed = await w.alice.charge('banner.generate', { scope: 'r-aaaaaaaaaaaa' })
  const bad = await w.alice.run(failed, async () => new Response('{}', { status: 500 }))
  assert.equal(bad.headers.get(DOYA_POWER_OP_HEADER), null)
  if (failed.kind === 'charged') {
    const again = await w.alice.charge('banner.generate', { retryOf: failed.opKey, scope: 'r-aaaaaaaaaaaa' })
    if (again.kind === 'charged') assert.equal(again.amount, FULL)
  }
})

test('同じ作り直しを2回送っても、減るのは1回だけ。作り直しの作り直しも全額の半分', async () => {
  const w = world()
  await w.alice.charge('banner.generate', { key: 'base' })
  const before = await w.remaining('co_alice')
  const r1 = await w.alice.charge('banner.generate', { key: 'retry-1', retryOf: 'base' })
  const r1again = await w.alice.charge('banner.generate', { key: 'retry-1', retryOf: 'base' })
  assert.equal(r1.kind, 'charged')
  if (r1again.kind === 'charged') assert.equal(r1again.duplicated, true)
  // 2回目の重複は、失敗しても戻さない（1回目の分まで戻らない）
  await w.alice.run(r1again, async () => new Response('{}', { status: 500 }))
  assert.equal(await w.remaining('co_alice'), before - HALF)
  w.advanceSec(60)
  const r2 = await w.alice.charge('banner.generate', { key: 'retry-2', retryOf: 'retry-1' })
  if (r2.kind === 'charged') assert.equal(r2.amount, HALF)
  assert.equal(await w.remaining('co_alice'), before - HALF * 2)
  // 自分自身のキーを retryOf にしても半分にしない
  const self = await w.alice.charge('banner.generate', { key: 'solo', retryOf: 'solo' })
  if (self.kind === 'charged') assert.equal(self.amount, FULL)
})

test('旗が off のときは、retryOf があっても台帳に触れず、キーも返さない', async () => {
  const w = world({ rollout: 'off' })
  const o = await w.alice.charge('banner.generate', { key: 'x2', retryOf: 'x1' })
  assert.equal(o.kind, 'skip')
  const res = await w.alice.run(o, async () => ok())
  assert.equal(res.headers.get(DOYA_POWER_OP_HEADER), null)
  assert.deepEqual(w.calls, ['rollout'])
  assert.equal(w.mem.rows('doyaPowerAccount').length, 0)
  assert.equal(w.mem.rows('doyaPowerTransaction').length, 0)
})

test('半分は切り上げ（札と台帳で同じ halfAmount を使う）', () => {
  assert.equal(halfAmount(10), 5)
  assert.equal(halfAmount(7), 4)
  assert.equal(halfAmount(1), 1)
  assert.equal(halfAmount(30), 15)
})

test('クライアントの控え: 5分以内だけ retryOf を返す。おかしなキーは控えない。sessionStorage から読み戻せる', () => {
  let ms = 1_000_000
  const box = new Map<string, string>()
  const storage = { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v), removeItem: (k: string) => void box.delete(k) }
  const m = createRetryMemory({ now: () => ms, storage: () => storage })
  m.remember('slot-a', 'op-1')
  assert.equal(m.retryOf('slot-a'), 'op-1')
  assert.ok(m.remainingMs('slot-a') > 0)
  assert.equal(m.retryOf('slot-b'), null)
  m.remember('slot-c', 'bad key with spaces')
  m.remember('slot-c', '<script>')
  assert.equal(m.retryOf('slot-c'), null)
  // 読み込み直し（メモリが空）でも、sessionStorage から戻る
  const reload = createRetryMemory({ now: () => ms, storage: () => storage })
  assert.equal(reload.retryOf('slot-a'), 'op-1')
  ms += RETRY_HALF_WINDOW_MS + 1
  assert.equal(m.retryOf('slot-a'), null)
  assert.equal(m.remainingMs('slot-a'), 0)
  // 壊れた中身は使わない
  storage.setItem('doya-power-retry:slot-x', '{"key":"ok","at":"nope"}')
  assert.equal(reload.retryOf('slot-x'), null)
  // storage が使えなくても落ちない
  const noStore = createRetryMemory({ now: () => ms, storage: () => { throw new Error('blocked') } })
  noStore.remember('s', 'k1')
  assert.equal(noStore.retryOf('s'), 'k1')
  assert.equal(cleanRetryKey(' k-1 '), 'k-1')
  assert.equal(cleanRetryKey(123), null)
})
