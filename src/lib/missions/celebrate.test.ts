// 実行: npx tsx --test src/lib/missions/celebrate.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { doneIds, newlyDoneQuests, parseSeenIds } from './celebrate'

const q = (done: boolean[]) => done.map((d, i) => ({ id: `q${i}`, done: d }))

test('初めて見るときは祝わない', () => {
  assert.deepEqual(newlyDoneQuests(null, q([true, false])), { fresh: [], allJustDone: false })
})
test('新しく済んだ手順だけを返す', () => {
  assert.deepEqual(newlyDoneQuests(['q0'], q([true, true, false])), { fresh: ['q1'], allJustDone: false })
})
test('最後の1つが済んだら全部そろった印を立てる', () => {
  assert.deepEqual(newlyDoneQuests(['q0', 'q1'], q([true, true, true])), { fresh: ['q2'], allJustDone: true })
})
test('もう全部済んでいたものは、また祝わない', () => {
  assert.deepEqual(newlyDoneQuests(['q0', 'q1'], q([true, true])), { fresh: [], allJustDone: false })
})
test('済んだ id の並びと読み込み', () => {
  assert.deepEqual(doneIds(q([true, false, true])), ['q0', 'q2'])
  assert.deepEqual(parseSeenIds('["a","b"]'), ['a', 'b'])
  assert.equal(parseSeenIds('{'), null)
  assert.equal(parseSeenIds(null), null)
  assert.equal(parseSeenIds('[1]'), null)
})
