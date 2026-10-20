import { test } from 'node:test'
import assert from 'node:assert/strict'
import { homeContractDate, homeJstDateKey, homeSnapshotClock } from './clock'

test('挨拶と更新時刻は取得時刻のJSTを使う', () => {
  const clock = homeSnapshotClock('2026-10-20T06:24:00Z')
  assert.equal(clock.greeting, 'こんにちは')
  assert.equal(clock.updated, '15:24')
  assert.equal(clock.today, '2026-10-20')
  assert.equal(clock.epoch, Date.parse('2026-10-20T06:24:00Z'))
})

test('挨拶の境界もJSTで決まる', () => {
  assert.equal(homeSnapshotClock('2026-10-20T01:59:59Z').greeting, 'おはようございます')
  assert.equal(homeSnapshotClock('2026-10-20T02:00:00Z').greeting, 'こんにちは')
  assert.equal(homeSnapshotClock('2026-10-20T08:59:59Z').greeting, 'こんにちは')
  assert.equal(homeSnapshotClock('2026-10-20T09:00:00Z').greeting, 'おつかれさまです')
})

test('UTC15時の月替わりを日付と契約日に共通で使う', () => {
  assert.equal(homeJstDateKey('2026-10-31T14:59:59Z'), '2026-10-31')
  assert.equal(homeJstDateKey('2026-10-31T15:00:00Z'), '2026-11-01')
  assert.equal(homeContractDate('2026-10-31T15:00:00Z'), '2026/11/1')
})

test('無効な取得時刻は現在時刻で補わず未取得にする', () => {
  for (const value of ['', 'invalid', '2026-10-20T15:24:00', '2026-10-20', '+275760-09-13T00:00:00.000Z']) {
    assert.deepEqual(homeSnapshotClock(value), { epoch: null, today: null, greeting: 'こんにちは', updated: '—' })
    assert.equal(homeContractDate(value), null)
  }
  assert.equal(homeContractDate(null), null)
})

test('明示offsetは同じ瞬間になり、日付だけの予定は従来の意味を保つ', () => {
  assert.deepEqual(homeSnapshotClock('2026-10-20T15:24:00+09:00'), homeSnapshotClock('2026-10-20T06:24:00Z'))
  assert.equal(homeJstDateKey('2026-10-20'), '2026-10-20')
  assert.equal(homeJstDateKey('2026-10-20T15:24:00'), null)
})
