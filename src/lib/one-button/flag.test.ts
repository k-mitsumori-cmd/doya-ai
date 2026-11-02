// 「これ1つで全部進む」帯の旗（ONE_BUTTON_ROLLOUT）のテスト。
// ⚠️ 既定の引数に undefined を渡さない（環境変数を読んでしまい、本番と同じ旗のビルドで落ちる）。空の文字を渡す
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideOneButton, oneButtonRollout } from './flag'

test('旗: 既定は off。preview と all だけを受け付ける', () => {
  assert.equal(oneButtonRollout(''), 'off')
  assert.equal(oneButtonRollout('on'), 'off')
  assert.equal(oneButtonRollout(' Preview '), 'preview')
  assert.equal(oneButtonRollout('ALL'), 'all')
})

test('判定: off は誰にも出さない。preview は許可した人だけ。all は全員', () => {
  assert.equal(decideOneButton({ rollout: 'off', email: 'a@x.jp', allow: ['a@x.jp'] }), false)
  assert.equal(decideOneButton({ rollout: 'preview', email: 'a@x.jp', allow: ['a@x.jp'] }), true)
  assert.equal(decideOneButton({ rollout: 'preview', email: 'b@x.jp', allow: ['a@x.jp'] }), false)
  assert.equal(decideOneButton({ rollout: 'preview', email: null, allow: ['a@x.jp'] }), false)
  assert.equal(decideOneButton({ rollout: 'all', email: null, allow: [] }), true)
})
