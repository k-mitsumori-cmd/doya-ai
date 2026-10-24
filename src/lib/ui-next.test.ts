// 実行: npx tsx --test src/lib/ui-next.test.ts
// 新しい見た目は全員に出し終えた（2026-10-24）。旗はやめ、いつも新しい見た目。
// 許可した人の一覧（UI_PREVIEW_EMAILS）は、ドヤパワーの旗（preview）が使うので、その読み方を確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canPreviewUiNext, isUiNext, uiPreviewEmails } from './ui-next'

const allow = ['owner@example.invalid']

test('新しい見た目は、旗を見ずにいつも出す', async () => {
  assert.equal(await isUiNext(), true)
})

test('UI_PREVIEW_EMAILS はカンマ区切り。前後の空白と大文字小文字を無視する', () => {
  assert.deepEqual(uiPreviewEmails(' Owner@Example.invalid , ,b@example.invalid'), ['owner@example.invalid', 'b@example.invalid'])
  // ⚠️ undefined を渡すと既定値として process.env.UI_PREVIEW_EMAILS を読む。本番のビルドでは値があるので、空文字で確かめる（2026-10-19）
  assert.deepEqual(uiPreviewEmails(''), [])
})

test('許可した人の一覧にあるメールだけが真になる', () => {
  assert.equal(canPreviewUiNext('OWNER@example.invalid', allow), true)
  assert.equal(canPreviewUiNext('other@example.invalid', allow), false)
  assert.equal(canPreviewUiNext('', allow), false)
  assert.equal(canPreviewUiNext(null, allow), false)
  assert.equal(canPreviewUiNext('owner@example.invalid', []), false)
})
