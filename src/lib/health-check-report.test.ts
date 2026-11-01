import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bodySnippet, describeFetchError, formatHealthFailure, formatJobFailure, nextStreak } from './health-check-report'

test('タイムアウトは打ち切りの秒数とともに書く', () => {
  const e = new Error('The operation was aborted due to timeout')
  e.name = 'TimeoutError'
  const text = describeFetchError(e, 15_000)
  assert.match(text, /応答がありませんでした（15秒で打ち切り）/)
  assert.match(text, /TimeoutError/)
})

test('DNS・接続拒否・証明書のエラーを見分ける', () => {
  const dns = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND example.invalid' } })
  assert.match(describeFetchError(dns), /ドメイン名を引けませんでした（DNS: ENOTFOUND）/)
  assert.match(describeFetchError(dns), /getaddrinfo ENOTFOUND example\.invalid/)
  const refused = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
  assert.match(describeFetchError(refused), /接続を拒否されました/)
  const cert = Object.assign(new TypeError('fetch failed'), { cause: { code: 'CERT_HAS_EXPIRED' } })
  assert.match(describeFetchError(cert), /SSL 証明書/)
})

test('Error でない値も文字にして返す', () => {
  assert.match(describeFetchError('boom'), /原因不明のエラー（boom）/)
})

test('応答本文はタグを落として短くする', () => {
  assert.equal(bodySnippet('<html><script>x()</script><h1>502 Bad   Gateway</h1></html>'), '502 Bad Gateway')
  assert.equal(bodySnippet('a'.repeat(300), 10), 'aaaaaaaaaa…')
})

test('連続した失敗は回数を足し、成功で切る', () => {
  const first = nextStreak(null, true, '2026-10-25T00:00:00.000Z')
  assert.deepEqual(first, { count: 1, since: '2026-10-25T00:00:00.000Z' })
  const second = nextStreak(first, true, '2026-10-25T00:05:00.000Z')
  assert.deepEqual(second, { count: 2, since: '2026-10-25T00:00:00.000Z' })
  assert.equal(nextStreak(second, false, '2026-10-25T00:10:00.000Z'), null)
})

test('外形監視の通知に URL・状態コード・時刻・本文・連続回数を入れる', () => {
  const text = formatHealthFailure({
    url: 'https://doya-ai.surisuta.jp/api/health',
    at: '2026-10-25T00:10:00.000Z',
    status: 503,
    rttMs: 812,
    body: '{"status":"error","database":"disconnected"}',
    streak: { count: 3, since: '2026-10-25T00:00:00.000Z' },
    intervalMinutes: 5,
  })
  assert.match(text, /確認したURL：https:\/\/doya-ai\.surisuta\.jp\/api\/health/)
  assert.match(text, /状態コード：HTTP 503/)
  assert.match(text, /2026\/10\/25 9:10:00（日本時間）/)
  assert.match(text, /往復時間：812ms/)
  assert.match(text, /"database":"disconnected"/)
  assert.match(text, /連続した失敗：3回（最初の失敗 2026\/10\/25 9:00:00、約10分前から。5分ごとに確認）/)
})

test('応答が無いときは状態コードが無いと書き、エラーを載せる', () => {
  const text = formatHealthFailure({ url: 'https://x.test/', at: '2026-10-25T00:00:00.000Z', error: '応答がありませんでした（15秒で打ち切り）' })
  assert.match(text, /状態コード：なし（応答が届いていません）/)
  assert.match(text, /エラー：応答がありませんでした/)
})

test('運用ジョブの通知にモード・エラー・発生箇所・連続回数を入れる', () => {
  const e = new Error('集計データの取得に失敗しました（HTTP 500）')
  e.stack = 'Error: 集計データの取得に失敗しました（HTTP 500）\n    at serviceRows (/var/task/src/lib/service-operations-data.ts:24:30)\n    at async x (node:internal/x:1:1)'
  const text = formatJobFailure({ mode: 'daily', at: '2026-10-25T00:00:00.000Z', error: e, streak: { count: 2, since: '2026-10-24T00:00:00.000Z' } })
  assert.match(text, /mode=daily/)
  assert.match(text, /エラー：Error: 集計データの取得に失敗しました（HTTP 500）/)
  assert.match(text, /発生箇所（推定）：src\/lib\/service-operations-data\.ts:24:30/)
  assert.match(text, /連続した失敗：2回/)
})
