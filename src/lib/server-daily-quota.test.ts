// 実行: npm run test:syscheck
// サーバー側の回数上限の、キーの作り方と接続元 IP の取り方を確かめる（DB には接続しない）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientIp, dailyQuotaKey, jstDayKey, quotaSubject } from './server-daily-quota'

test('日付は JST で区切る', () => {
  assert.equal(jstDayKey(Date.parse('2026-10-17T14:59:59Z')), '20261017')
  assert.equal(jstDayKey(Date.parse('2026-10-17T15:00:00Z')), '20261018')
})

test('キーは決まった形で、範囲外の scope は受け付けない', () => {
  assert.equal(dailyQuotaKey('nagusame-chat-ip', 'abc', '20261018'), 'rl:v1:nagusame-chat-ip:20261018:abc')
  assert.throws(() => dailyQuotaKey('Bad Scope', 'abc'))
  assert.throws(() => dailyQuotaKey('a:b', 'abc'))
})

test('IP は生のまま使わず、鍵付きハッシュにする', () => {
  const s = quotaSubject('203.0.113.7')
  assert.notEqual(s, '203.0.113.7')
  assert.ok(!s.includes('203'))
  assert.equal(s, quotaSubject('203.0.113.7'))
  assert.notEqual(s, quotaSubject('203.0.113.8'))
})

test('接続元 IP は Vercel のヘッダーを優先し、先頭の値だけを使う', () => {
  assert.equal(clientIp(new Headers({ 'x-vercel-forwarded-for': '198.51.100.1', 'x-forwarded-for': '10.0.0.1' })), '198.51.100.1')
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' })), '198.51.100.2')
  assert.equal(clientIp(new Headers()), 'unknown')
})
