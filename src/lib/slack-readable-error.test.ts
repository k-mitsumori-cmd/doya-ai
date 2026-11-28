import { test } from 'node:test'
import assert from 'node:assert/strict'
import { errorGuide, readableErrorText } from './slack-readable-error'

// 2026-11-24: 届いていないことの監視は、処理が落ちたときの定型文と分ける
test('届いていない知らせは、監視の文で説明する', () => {
  const g = errorGuide('【ドヤAI・要確認】お問い合わせが 45日間 1件も届いていません\n最終受信: 2026/10/8 19:16:17')
  assert.match(g.summary, /監視による知らせ/)
  assert.doesNotMatch(g.summary, /原因はまだ特定できていません/)
  assert.match(g.action, /POST/)
})

test('届いていない知らせの本文に、落ちたときの定型文が入らない', () => {
  const text = readableErrorText('【ドヤAI・要確認】お問い合わせが 45日間 1件も届いていません\n最終受信: 2026/10/8 19:16:17')
  assert.match(text, /監視による知らせ/)
  assert.doesNotMatch(text, /詳しい原因はまだ特定できていません/)
})

test('処理の失敗は、これまでどおりの文のまま', () => {
  const g = errorGuide('【要対応・エラー】ドヤAI\n何が起きた：アプリの処理中にエラーを検知しました。')
  assert.match(g.summary, /詳しい原因はまだ特定できていません/)
})
