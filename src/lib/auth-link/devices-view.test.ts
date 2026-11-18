import test from 'node:test'
import assert from 'node:assert/strict'
import { deviceName, lastUsedText, platformLabel, revokeConfirmText, revokeErrorText, sortDevices } from './devices-view'

const NOW = new Date('2026-11-18T03:00:00Z')

test('deviceName: 名前が無い・空白だけのときは、種類の名前', () => {
  assert.equal(deviceName({ deviceLabel: 'Taro の iPhone', platform: 'ios' }), 'Taro の iPhone')
  assert.equal(deviceName({ deviceLabel: null, platform: 'ios' }), 'iPhone・iPad')
  assert.equal(deviceName({ deviceLabel: '  ', platform: 'android' }), 'Android')
  assert.equal(platformLabel('web'), 'アプリ')
})

test('lastUsedText: たったいま・分・時間・日付', () => {
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
  assert.equal(lastUsedText(ago(10_000), NOW), '最後に使ったのは、たったいまです')
  assert.equal(lastUsedText(ago(5 * 60_000), NOW), '最後に使ったのは、5分前です')
  assert.equal(lastUsedText(ago(3 * 3600_000), NOW), '最後に使ったのは、3時間前です')
  assert.equal(lastUsedText(ago(3 * 86400_000), NOW), '最後に使ったのは、2026年11月15日です')
  assert.equal(lastUsedText('not-a-date', NOW), '最後に使った日時は不明です')
  // 未来の時刻でも、負の値の文にならない
  assert.equal(lastUsedText(new Date(NOW.getTime() + 60_000).toISOString(), NOW), '最後に使ったのは、たったいまです')
})

test('sortDevices: いまの端末が先頭、残りは新しい順。元の配列は変えない', () => {
  const list = [
    { id: 'a', isCurrent: false, lastUsedAt: '2026-11-10T00:00:00Z' },
    { id: 'b', isCurrent: false, lastUsedAt: '2026-11-17T00:00:00Z' },
    { id: 'c', isCurrent: true, lastUsedAt: '2026-11-01T00:00:00Z' },
  ]
  assert.deepEqual(sortDevices(list).map((d) => d.id), ['c', 'b', 'a'])
  assert.deepEqual(list.map((d) => d.id), ['a', 'b', 'c'])
})

test('文言: 確認の文と、エラーコードの対応', () => {
  assert.match(revokeConfirmText({ deviceLabel: 'iPhone', platform: 'ios', isCurrent: true }), /いまお使いの端末/)
  assert.match(revokeConfirmText({ deviceLabel: null, platform: 'android', isCurrent: false }), /^Androidからログアウトします/)
  assert.match(revokeErrorText(401), /有効期限/)
  assert.match(revokeErrorText(404, 'NOT_FOUND'), /すでにログアウト/)
  assert.match(revokeErrorText(500), /しばらくしてから/)
})
