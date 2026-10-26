import test from 'node:test'
import assert from 'node:assert/strict'
import { FEEDBACK_ITEM_MAX, FEEDBACK_SCORE_KEYS, feedbackTotalMax } from './score-max'

test('合計の満点は項目数 × 1項目の満点（5項目 × 5点 = 25）', () => {
  assert.equal(FEEDBACK_SCORE_KEYS.length, 5)
  assert.equal(FEEDBACK_ITEM_MAX, 5)
  assert.equal(feedbackTotalMax(), 25)
})

test('合計の満点は1項目の満点にならない（23 / 5 の誤表示を防ぐ）', () => {
  assert.notEqual(feedbackTotalMax(), FEEDBACK_ITEM_MAX)
  assert.ok(feedbackTotalMax() >= 23)
})

test('項目数や満点を変えても掛け算で追従する', () => {
  assert.equal(feedbackTotalMax(4, 5), 20)
  assert.equal(feedbackTotalMax(5, 10), 50)
})
