// 実行: npx tsx --test src/lib/system-watch/watch-gate.test.ts
// 自動点検の合図は、点検用の利用者が本人で、今日（日本時間）のその人の値のときだけ通る（2026-10-26 統括の監査）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { isSystemWatchFor, jstDate, systemWatchTokenFor, systemWatchUserId } from './watch-gate'

const env = { CRON_SECRET: 'test-secret', SYSTEM_WATCH_TEST_USER_ID: 'u-watch' }
const at = new Date('2026-10-26T03:00:00Z') // 日本時間 12:00
const headers = (v?: string | null) => new Headers(v ? { 'x-doya-system-watch': v } : {})

test('日本時間の日付で区切る', () => {
  assert.equal(jstDate(new Date('2026-10-25T14:59:59Z')), '2026-10-25')
  assert.equal(jstDate(new Date('2026-10-25T15:00:00Z')), '2026-10-26')
})

test('本人・今日・正しい値のときだけ通る', () => {
  const token = systemWatchTokenFor('u-watch', at, env.CRON_SECRET)!
  assert.equal(isSystemWatchFor(headers(token), 'u-watch', at, env), true)
  // 前の日・次の日の値は通らない
  assert.equal(isSystemWatchFor(headers(systemWatchTokenFor('u-watch', new Date(at.getTime() - 86_400_000), env.CRON_SECRET)), 'u-watch', at, env), false)
  assert.equal(isSystemWatchFor(headers(token), 'u-watch', new Date(at.getTime() + 86_400_000), env), false)
  // ほかの利用者: その人の値でも、点検用の利用者でなければ通らない
  assert.equal(isSystemWatchFor(headers(systemWatchTokenFor('other', at, env.CRON_SECRET)), 'other', at, env), false)
  assert.equal(isSystemWatchFor(headers(token), 'other', at, env), false)
  // 古い形（決まった値）・でたらめ・無し
  const v1 = crypto.createHmac('sha256', env.CRON_SECRET).update('doya-system-watch:v1').digest('hex')
  for (const bad of [v1, '0'.repeat(64), token.slice(0, -1), '', null]) assert.equal(isSystemWatchFor(headers(bad), 'u-watch', at, env), false)
  assert.equal(isSystemWatchFor(undefined, 'u-watch', at, env), false)
  assert.equal(isSystemWatchFor(headers(token), null, at, env), false)
})

test('設定が欠けたら何も通さない（fail-closed）', () => {
  const token = systemWatchTokenFor('u-watch', at, env.CRON_SECRET)!
  assert.equal(systemWatchUserId({}), null)
  assert.equal(systemWatchUserId({ SYSTEM_WATCH_TEST_USER_ID: '  ' }), null)
  assert.equal(isSystemWatchFor(headers(token), 'u-watch', at, { CRON_SECRET: env.CRON_SECRET }), false)
  assert.equal(isSystemWatchFor(headers(token), 'u-watch', at, { SYSTEM_WATCH_TEST_USER_ID: 'u-watch' }), false)
  assert.equal(systemWatchTokenFor('u-watch', at, undefined), null)
  assert.equal(systemWatchTokenFor('', at, env.CRON_SECRET), null)
})
