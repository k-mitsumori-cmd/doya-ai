import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSystemWatchName, isSystemWatchRequest, SYSTEM_WATCH_HEADER, SYSTEM_WATCH_PREFIX, systemWatchToken, withSystemWatchPrefix } from './marker'

const headers = (v?: string) => ({ get: (n: string) => (n === SYSTEM_WATCH_HEADER ? v ?? null : null) })

test('合図は CRON_SECRET から作り、同じ秘密のときだけ受け付ける', () => {
  const t = systemWatchToken('secret-a')
  assert.ok(t && t.length === 64)
  assert.notEqual(t, 'secret-a', 'CRON_SECRET そのものは送らない')
  assert.equal(isSystemWatchRequest(headers(t!), 'secret-a'), true)
  assert.equal(isSystemWatchRequest(headers(t!), 'secret-b'), false)
  assert.equal(isSystemWatchRequest(headers(), 'secret-a'), false)
  assert.equal(isSystemWatchRequest(headers('x'), 'secret-a'), false)
  assert.equal(systemWatchToken(''), null)
  assert.equal(isSystemWatchRequest(headers(t!), ''), false, '秘密が無ければ受け付けない')
})

test('名前の先頭に印を付け、二重に付けず、長さの上限を守る', () => {
  assert.equal(withSystemWatchPrefix('surisuta.jp 様への提案'), '【自動点検】surisuta.jp 様への提案')
  assert.equal(withSystemWatchPrefix('【自動点検】a'), '【自動点検】a')
  assert.equal(withSystemWatchPrefix('あ'.repeat(200), 120).length, 120)
  assert.ok(withSystemWatchPrefix('あ'.repeat(200), 120).startsWith(SYSTEM_WATCH_PREFIX))
})

test('自動点検が作った物かを見分ける', () => {
  assert.equal(isSystemWatchName('【自動点検】見積'), true)
  assert.equal(isSystemWatchName('見積【自動点検】'), false)
  assert.equal(isSystemWatchName(null), false)
})
