// 実行: npm run test:doyapower
// ドヤパワーの台帳（二重に減らさない・戻しは1回だけ・期限の近い順・日本時間の切り替え・月の上限）。
// メモリの上の DB（memory-db.ts）だけを使う。本物の DB・課金・外部 API には触れない。環境変数にも頼らない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDoyaPowerLedger } from './ledger'
import { createMemoryDb } from './memory-db'
import {
  DAILY_RECOVERY_AMOUNT,
  DAILY_RECOVERY_CAP,
  MONTHLY_BONUS_CAP,
  TEAM_MONTHLY_GRANT,
  allocate,
  clampPurchaseExpiresAt,
  jstDayKey,
  jstMonthKey,
  jstMonthStart,
  jstNextDayStart,
  monthlyGrantExpiresAt,
} from './rules'

function setup(start = '2026-10-19T03:00:00.000Z') {
  let t = new Date(start)
  const clock = () => new Date(t.getTime())
  const mem = createMemoryDb({ now: clock })
  mem.rows('accountCompany').push(
    { id: 'co_alice', userId: 'alice', name: 'アリス株式会社' },
    { id: 'co_bob', userId: 'bob', name: 'ボブ株式会社' },
  )
  const ledger = createDoyaPowerLedger(mem.db, { now: clock })
  return {
    ...mem,
    ledger,
    set: (iso: string) => {
      t = new Date(iso)
    },
    grantsOf: (companyId: string) => {
      const acc = mem.rows('doyaPowerAccount').find((a) => a.companyId === companyId)
      return mem.rows('doyaPowerGrant').filter((g) => g.accountId === acc?.id)
    },
    txOf: (companyId: string) => {
      const acc = mem.rows('doyaPowerAccount').find((a) => a.companyId === companyId)
      return mem.rows('doyaPowerTransaction').filter((x) => x.accountId === acc?.id)
    },
  }
}

test('日本時間の日付と月の切り替え', () => {
  assert.equal(jstDayKey(new Date('2026-10-19T14:59:59.999Z')), '2026-10-19')
  assert.equal(jstDayKey(new Date('2026-10-19T15:00:00.000Z')), '2026-10-20')
  assert.equal(jstMonthKey(new Date('2026-10-31T15:00:00.000Z')), '2026-11')
  assert.equal(jstMonthStart(new Date('2026-10-19T03:00:00Z')).toISOString(), '2026-09-30T15:00:00.000Z')
  assert.equal(jstNextDayStart(new Date('2026-10-19T03:00:00Z')).toISOString(), '2026-10-19T15:00:00.000Z')
  // 毎月の付与は翌月の終わりまで（10月の分は 12/1 0:00 JST に切れる）
  assert.equal(monthlyGrantExpiresAt(new Date('2026-10-05T00:00:00Z')).toISOString(), '2026-11-30T15:00:00.000Z')
  // 12月の分は年をまたいで 2/1 0:00 JST
  assert.equal(monthlyGrantExpiresAt(new Date('2026-12-31T14:00:00Z')).toISOString(), '2027-01-31T15:00:00.000Z')
})

test('追加購入の期限は 6 か月以内に収める', () => {
  const at = new Date('2026-08-31T03:00:00Z')
  assert.equal(clampPurchaseExpiresAt(at, null)!.toISOString(), '2027-02-28T03:00:00.000Z')
  assert.equal(clampPurchaseExpiresAt(at, new Date('2030-01-01T00:00:00Z'))!.toISOString(), '2027-02-28T03:00:00.000Z')
  assert.equal(clampPurchaseExpiresAt(at, new Date('2026-09-30T00:00:00Z'))!.toISOString(), '2026-09-30T00:00:00.000Z')
  assert.equal(clampPurchaseExpiresAt(at, new Date('2026-08-01T00:00:00Z')), null)
})

test('割り当ては期限の近い順・期限なしは最後・足りなければ null', () => {
  const now = new Date('2026-10-19T00:00:00Z')
  const g = (id: string, remaining: number, exp: string | null) => ({ id, kind: 'x', remaining, expiresAt: exp ? new Date(exp) : null, grantedAt: now })
  const grants = [g('none', 50, null), g('late', 50, '2026-12-01T00:00:00Z'), g('soon', 30, '2026-11-01T00:00:00Z'), g('gone', 99, '2026-10-01T00:00:00Z')]
  assert.deepEqual(allocate(grants, 60, now), [
    { grantId: 'soon', amount: 30 },
    { grantId: 'late', amount: 30 },
  ])
  assert.equal(allocate(grants, 131, now), null)
})

test('同じ operationId では1回だけ減らす（順に・同時に・書き込みが遅れて見えるときも）', async () => {
  const s = setup()
  await s.ledger.grant('co_alice', 'purchase', 100, null)
  const first = await s.ledger.consume('co_alice', 30, 'op-1')
  assert.deepEqual(first, { ok: true, operationId: 'op-1', amount: 30, balance: 80, duplicated: false }) // 100 + 毎日の回復 10 − 30
  const again = await s.ledger.consume('co_alice', 30, 'op-1')
  assert.equal(again.ok && again.duplicated, true)
  const [a, b] = await Promise.all([s.ledger.consume('co_alice', 5, 'op-2'), s.ledger.consume('co_alice', 5, 'op-2')])
  assert.equal([a, b].filter((r) => r.ok && !r.duplicated).length, 1)
  assert.equal((await s.ledger.balance('co_alice'))!.total, 75)
  assert.equal(s.txOf('co_alice').filter((x) => x.type === 'consume').length, 2)

  // 先の確認では同時に来た記録がまだ見えず、unique 制約で止まる場合（取引ごと取り消し、やり直しで重複と分かる）
  const r = setup()
  await r.ledger.grant('co_alice', 'purchase', 100, null)
  await r.ledger.consume('co_alice', 40, 'op-x')
  const stale = { n: 1 }
  const db = r.db
  const orig = db.doyaPowerTransaction.findUnique
  db.doyaPowerTransaction.findUnique = async (args: { where: Record<string, unknown> }) => {
    if (stale.n > 0 && args.where.operationId === 'op-x') {
      stale.n--
      return null
    }
    return orig(args)
  }
  const dup = await r.ledger.consume('co_alice', 40, 'op-x')
  assert.equal(dup.ok && dup.duplicated, true)
  assert.equal((await r.ledger.balance('co_alice'))!.total, 70)
  assert.equal(r.txOf('co_alice').filter((x) => x.type === 'consume').length, 1)
})

test('残りが足りなければ減らさずに拒む', async () => {
  const s = setup()
  await s.ledger.grant('co_alice', 'purchase', 20, null)
  const r = await s.ledger.consume('co_alice', 31, 'op-big')
  assert.deepEqual(r, { ok: false, reason: 'insufficient', balance: 30 })
  assert.equal(s.txOf('co_alice').filter((x) => x.type === 'consume').length, 0)
  assert.equal((await s.ledger.balance('co_alice'))!.total, 30)
  // 失敗した operationId は、残りが増えたあとに使える
  await s.ledger.grant('co_alice', 'purchase', 10, null)
  assert.equal((await s.ledger.consume('co_alice', 31, 'op-big')).ok, true)
})

test('戻しは1回だけ・減らした付与に戻す・他の会社の操作は戻さない', async () => {
  const s = setup()
  await s.ledger.grant('co_alice', 'purchase', 100, null)
  await s.ledger.consume('co_alice', 50, 'op-r')
  assert.deepEqual(await s.ledger.refund('op-r', { companyId: 'co_bob' }), { ok: false, reason: 'not_found' })
  assert.deepEqual(await s.ledger.refund('op-r'), { ok: true, operationId: 'op-r', amount: 50, duplicated: false })
  assert.deepEqual(await s.ledger.refund('op-r'), { ok: true, operationId: 'op-r', amount: 50, duplicated: true })
  const both = await Promise.all([s.ledger.refund('op-r'), s.ledger.refund('op-r')])
  assert.equal(both.every((x) => x.ok && x.duplicated), true)
  assert.equal((await s.ledger.balance('co_alice'))!.total, 110)
  assert.equal(s.txOf('co_alice').filter((x) => x.type === 'refund').length, 1)
  assert.deepEqual(await s.ledger.refund('op-none'), { ok: false, reason: 'not_found' })
  // 戻したあとに同じ operationId で減らしても、二重には減らない（記録は1つ）
  const re = await s.ledger.consume('co_alice', 50, 'op-r')
  assert.equal(re.ok && re.duplicated, true)
})

test('期限の近い順に減らし、期限切れは記録を付けて 0 にする', async () => {
  const s = setup('2026-10-05T03:00:00.000Z')
  await s.ledger.grant('co_alice', 'monthly', 100, null) // 12/1 0:00 JST まで
  await s.ledger.grant('co_alice', 'purchase', 100, new Date('2026-10-20T00:00:00Z'))
  await s.ledger.consume('co_alice', 120, 'op-e')
  const g = s.grantsOf('co_alice')
  assert.equal(g.find((x) => x.kind === 'purchase')!.remaining, 0)
  assert.equal(g.find((x) => x.kind === 'monthly')!.remaining, 80)
  assert.equal(g.find((x) => x.kind === 'daily_recovery')!.remaining, 10)

  // 11月の付与。10月の使い残し 80 は繰り越して先に使う
  s.set('2026-11-02T03:00:00.000Z')
  await s.ledger.grant('co_alice', 'monthly', 100, null)
  await s.ledger.consume('co_alice', 50, 'op-e2')
  const oct = s.grantsOf('co_alice').find((x) => x.sourceKey === 'monthly:2026-10')!
  const nov = s.grantsOf('co_alice').find((x) => x.sourceKey === 'monthly:2026-11')!
  assert.equal(oct.remaining, 30)
  assert.equal(nov.remaining, 100)

  // 12/1 0:00 JST で10月の残り 30 が切れる（2か月目は繰り越さない）
  s.set('2026-11-30T15:00:00.000Z')
  const b = (await s.ledger.balance('co_alice'))!
  assert.equal(b.byKind.monthly, 100)
  const exp = s.txOf('co_alice').filter((x) => x.type === 'expire')
  assert.equal(exp.length, 1)
  assert.equal(exp[0].amount, -30)
})

test('毎月の付与は月に1回（日本時間の月）・今の 1人の PRO はチームと同じ量・無料は付けない', async () => {
  const s = setup('2026-10-31T14:59:00.000Z') // 10/31 23:59 JST
  const r1 = await s.ledger.grantMonthlyForPlan('co_alice', 'PRO')
  assert.equal(r1.ok && r1.granted, TEAM_MONTHLY_GRANT)
  const r2 = await s.ledger.grantMonthlyForPlan('co_alice', 'PRO')
  assert.equal(r2.ok && 'duplicated' in r2 && r2.duplicated, true)
  s.set('2026-10-31T15:00:00.000Z') // 11/1 0:00 JST
  const r3 = await s.ledger.grantMonthlyForPlan('co_alice', 'PRO')
  assert.equal(r3.ok && 'duplicated' in r3 && r3.duplicated, false)
  assert.deepEqual(await s.ledger.grantMonthlyForPlan('co_bob', 'FREE'), { ok: true, granted: 0, skipped: 'free_plan' })
  assert.equal(s.grantsOf('co_bob').filter((g) => g.kind === 'monthly').length, 0)
})

test('毎日の回復は日本時間の 0:00 で1日分・上限まで・次の回復の時刻', async () => {
  const s = setup('2026-10-19T14:00:00.000Z') // 10/19 23:00 JST
  let b = (await s.ledger.balance('co_alice'))!
  assert.equal(b.byKind.daily_recovery, DAILY_RECOVERY_AMOUNT)
  assert.equal(b.nextRecoveryAt!.toISOString(), '2026-10-19T15:00:00.000Z')
  s.set('2026-10-19T14:59:59.000Z')
  assert.equal((await s.ledger.balance('co_alice'))!.total, 10)
  s.set('2026-10-19T15:00:00.000Z') // 10/20 0:00 JST
  assert.equal((await s.ledger.balance('co_alice'))!.total, 20)
  s.set('2026-11-30T03:00:00.000Z') // 長く空いても上限まで
  b = (await s.ledger.balance('co_alice'))!
  assert.equal(b.byKind.daily_recovery, DAILY_RECOVERY_CAP)
  assert.equal(b.nextRecoveryAt, null)
  assert.deepEqual(await s.ledger.grant('co_alice', 'daily_recovery', 10, null), { ok: false, reason: 'recovery_cap' })
  await s.ledger.consume('co_alice', 5, 'op-d')
  s.set('2026-11-30T15:00:00.000Z')
  assert.equal((await s.ledger.balance('co_alice'))!.byKind.daily_recovery, DAILY_RECOVERY_CAP)
})

test('bonus と mission は会社ごとに月の上限まで（日本時間の月で切り替え）', async () => {
  const s = setup('2026-10-19T03:00:00.000Z')
  assert.equal((await s.ledger.grant('co_alice', 'bonus', 150, null, { sourceKey: 'onboarding:first' })).ok, true)
  const m = await s.ledger.grant('co_alice', 'mission', 100, null, { sourceKey: 'mission:a' })
  assert.equal(m.ok && m.granted, MONTHLY_BONUS_CAP - 150)
  assert.deepEqual(await s.ledger.grant('co_alice', 'mission', 10, null, { sourceKey: 'mission:b' }), { ok: false, reason: 'monthly_bonus_cap' })
  const dup = await s.ledger.grant('co_alice', 'bonus', 150, null, { sourceKey: 'onboarding:first' })
  assert.equal(dup.ok && dup.duplicated, true)
  // 他の会社には影響しない
  assert.equal((await s.ledger.grant('co_bob', 'mission', 200, null)).ok, true)
  // 来月はまた付く
  s.set('2026-10-31T15:00:00.000Z')
  const next = await s.ledger.grant('co_alice', 'mission', 10, null, { sourceKey: 'mission:b' })
  assert.equal(next.ok && next.granted, 10)
})

test('追加購入は期限を 6 か月以内にして付与する', async () => {
  const s = setup('2026-10-19T03:00:00.000Z')
  await s.ledger.grant('co_alice', 'purchase', 500, new Date('2028-01-01T00:00:00Z'))
  const p = s.grantsOf('co_alice').find((g) => g.kind === 'purchase')!
  assert.equal(p.expiresAt.toISOString(), '2027-04-19T03:00:00.000Z')
  assert.deepEqual(await s.ledger.grant('co_alice', 'purchase', 500, new Date('2026-10-01T00:00:00Z')), { ok: false, reason: 'invalid' })
})

test('会社ごとに分かれ、ユーザーからは本人の会社だけを引く', async () => {
  const s = setup()
  await s.ledger.grant('co_bob', 'purchase', 999, null)
  const alice = (await s.ledger.balanceForUser('alice'))!
  assert.equal(alice.companyId, 'co_alice')
  assert.equal(alice.total, 10)
  assert.equal(await s.ledger.balanceForUser('nobody'), null)
  assert.equal(await s.ledger.balance('co_missing'), null)
  assert.deepEqual(await s.ledger.consume('co_missing', 1, 'op-m'), { ok: false, reason: 'company_not_found' })
})

test('正しくない入力は DB に触らずに拒む', async () => {
  const s = setup()
  for (const r of [
    await s.ledger.consume('co_alice', 0, 'op'),
    await s.ledger.consume('co_alice', -5, 'op'),
    await s.ledger.consume('co_alice', 1.5, 'op'),
    await s.ledger.consume('co_alice', 1, ''),
    await s.ledger.consume('', 1, 'op'),
    await s.ledger.grant('co_alice', 'gift' as never, 10, null),
    await s.ledger.grant('co_alice', 'bonus', Number.NaN, null),
    await s.ledger.refund(''),
  ]) assert.equal((r as { reason?: string }).reason, 'invalid')
  assert.equal(s.calls.length, 0)
})
