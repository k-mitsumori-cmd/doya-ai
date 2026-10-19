// 実行: npx tsx --test src/lib/ui-next.test.ts
// 新しい見た目を出すかの判定（UI-QUALITY-CHECKLIST §5.1）。環境変数・cookie・メールの組み合わせを確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canPreviewUiNext, decideUiNext, safeReturnPath, uiNextRollout, uiPreviewEmails } from './ui-next'

const allow = ['owner@example.invalid']

test('UI_NEXT_ROLLOUT は off / preview / all。それ以外と未設定は preview', () => {
  assert.equal(uiNextRollout('off'), 'off')
  assert.equal(uiNextRollout(' ALL '), 'all')
  assert.equal(uiNextRollout('preview'), 'preview')
  // undefined は process.env.UI_NEXT_ROLLOUT を読むので、未設定は空文字で確かめる
  assert.equal(uiNextRollout(''), 'preview')
  assert.equal(uiNextRollout('yes'), 'preview')
})

test('UI_PREVIEW_EMAILS はカンマ区切り。前後の空白と大文字小文字を無視する', () => {
  assert.deepEqual(uiPreviewEmails(' Owner@Example.invalid , ,b@example.invalid'), ['owner@example.invalid', 'b@example.invalid'])
  // ⚠️ undefined を渡すと既定値として process.env.UI_PREVIEW_EMAILS を読む。本番のビルドでは値があるので、空文字で確かめる（2026-10-19）
  assert.deepEqual(uiPreviewEmails(''), [])
})

test('許可したメールの人だけが切り替えを使える', () => {
  assert.equal(canPreviewUiNext('OWNER@example.invalid', allow), true)
  assert.equal(canPreviewUiNext('other@example.invalid', allow), false)
  assert.equal(canPreviewUiNext('', allow), false)
  assert.equal(canPreviewUiNext(null, allow), false)
  assert.equal(canPreviewUiNext('owner@example.invalid', []), false)
})

test('判定の組み合わせ', () => {
  const cases: [Parameters<typeof decideUiNext>[0], boolean][] = [
    [{ rollout: 'all', cookie: null, email: null, allow }, true],
    [{ rollout: 'off', cookie: '1', email: 'owner@example.invalid', allow }, false],
    [{ rollout: 'preview', cookie: '1', email: 'owner@example.invalid', allow }, true],
    [{ rollout: 'preview', cookie: null, email: 'owner@example.invalid', allow }, false],
    [{ rollout: 'preview', cookie: '0', email: 'owner@example.invalid', allow }, false],
    [{ rollout: 'preview', cookie: 'true', email: 'owner@example.invalid', allow }, false],
    // ⚠️ 許可していない人が cookie を手で付けても、今の見た目のまま
    [{ rollout: 'preview', cookie: '1', email: 'other@example.invalid', allow }, false],
    [{ rollout: 'preview', cookie: '1', email: null, allow }, false],
    [{ rollout: 'preview', cookie: '1', email: 'owner@example.invalid', allow: [] }, false],
  ]
  for (const [input, want] of cases) assert.equal(decideUiNext(input), want, JSON.stringify(input))
})

test('戻る先は同じサイトの中のパスだけ', () => {
  assert.equal(safeReturnPath('/shodan/acme?tab=1'), '/shodan/acme?tab=1')
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/api/ui-preview?on=1', '/a\r\nSet-Cookie: x=1', '/\t/evil.example', '/\u0000/evil.example', '', null]) {
    assert.equal(safeReturnPath(bad), '/home', String(bad))
  }
})
