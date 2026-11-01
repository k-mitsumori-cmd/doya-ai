// 実行: npm run test:doyapower
// ドヤパワーの内訳・履歴（台帳の history と、画面に出す名前）。メモリの上の DB だけを使う。本物の DB・課金には触れない。
// - 新しい順に並ぶ。件数の上限を守る
// - 操作の ID（会社やクライアントのキーを含む）を返さない。返すのは操作の名前だけ
// - 他の会社の記録は出ない。会社の台帳が無ければ空
// - 減った・戻した・付与・期限切れに、画面の名前が付く
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDoyaPowerLedger } from './ledger'
import { createMemoryDb } from './memory-db'
import { historyLabel, ACTION_LABELS } from './history-label'
import { DOYA_POWER_COSTS } from './costs'

function setup() {
  let t = new Date('2026-10-23T03:00:00.000Z')
  const clock = () => new Date(t.getTime())
  const mem = createMemoryDb({ now: clock })
  mem.rows('accountCompany').push({ id: 'co_alice', userId: 'alice', name: 'アリス株式会社' }, { id: 'co_bob', userId: 'bob', name: 'ボブ株式会社' })
  const ledger = createDoyaPowerLedger(mem.db, { now: clock })
  return { ledger, tick: (ms: number) => { t = new Date(t.getTime() + ms) } }
}

test('新しい順に並び、操作の ID ではなく操作の名前だけを返す', async () => {
  const s = setup()
  await s.ledger.grant('co_alice', 'bonus', 100, null, { sourceKey: 'b1' })
  s.tick(1000)
  await s.ledger.consume('co_alice', 10, 'banner.generate:co_alice:client-key-123:10')
  s.tick(1000)
  await s.ledger.consume('co_alice', 7, 'image.refine:co_alice:k2:7')
  s.tick(1000)
  await s.ledger.refund('image.refine:co_alice:k2:7', { companyId: 'co_alice' })
  const rows = await s.ledger.history('co_alice')
  const types = rows.map((r) => r.type)
  assert.equal(types[0], 'refund')
  assert.equal(types[1], 'consume')
  assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].at.getTime() >= r.at.getTime()))
  assert.equal(rows[0].action, 'image.refine')
  assert.equal(rows[0].amount, 7)
  assert.equal(rows[1].action, 'image.refine')
  assert.equal(rows[1].amount, -7)
  const banner = rows.find((r) => r.action === 'banner.generate')!
  assert.equal(banner.amount, -10)
  // 操作の ID・会社の ID・クライアントのキーは、どの欄にも入らない
  const text = JSON.stringify(rows)
  assert.ok(!text.includes('client-key-123'))
  assert.ok(!text.includes('co_alice'))
  assert.ok(!('operationId' in rows[0]))
})

test('他の会社の記録は出ない。台帳が無い会社・不正な ID は空', async () => {
  const s = setup()
  await s.ledger.grant('co_alice', 'bonus', 50, null, { sourceKey: 'b1' })
  await s.ledger.consume('co_alice', 10, 'banner.generate:co_alice:k:10')
  assert.deepEqual(await s.ledger.history('co_bob'), [])
  assert.deepEqual(await s.ledger.history(''), [])
  assert.deepEqual(await s.ledger.history('co_missing'), [])
})

test('件数の上限を守る（1〜100）', async () => {
  const s = setup()
  await s.ledger.grant('co_alice', 'bonus', 500, null, { sourceKey: 'b1' })
  for (let i = 0; i < 8; i++) {
    s.tick(1000)
    await s.ledger.consume('co_alice', 1, `text.generate:co_alice:k${i}:1`)
  }
  assert.equal((await s.ledger.history('co_alice', { limit: 3 })).length, 3)
  assert.equal((await s.ledger.history('co_alice', { limit: 0 })).length, 1)
  assert.ok((await s.ledger.history('co_alice', { limit: 1000 })).length <= 100)
})

test('画面の名前: 減った・戻した・付与・期限切れ', () => {
  assert.equal(historyLabel({ type: 'consume', action: 'seo.article', kind: null }), 'SEO 記事の作成')
  assert.equal(historyLabel({ type: 'refund', action: 'seo.article', kind: null }), 'SEO 記事の作成（失敗したので戻した分）')
  assert.equal(historyLabel({ type: 'grant', action: null, kind: 'daily_recovery' }), '毎日の回復')
  assert.equal(historyLabel({ type: 'grant', action: null, kind: 'monthly' }), '毎月の付与')
  assert.equal(historyLabel({ type: 'expire', action: null, kind: null }), '期限切れ')
  assert.equal(historyLabel({ type: 'consume', action: 'unknown.thing', kind: null }), 'そのほかの操作')
})

test('減る量の表の操作（0 でないもの）には、すべて画面の名前がある', () => {
  for (const [action, n] of Object.entries(DOYA_POWER_COSTS)) {
    if (n > 0) assert.ok(ACTION_LABELS[action], action)
  }
})
