// 枚数の見積もり。課金 API は使わない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boothImageCount, defaultSelection, needSummary } from './image-budget'

test('残りが足りないときは、足りない枚数を出す。残りが分からないときは、止めない', () => {
  assert.deepEqual(needSummary(8, 5), { need: 8, remaining: 5, short: 3, enough: false })
  assert.equal(needSummary(8, 8).enough, true)
  assert.equal(needSummary(8, 0).short, 8)
  assert.equal(needSummary(8, null).enough, true)
})

test('足りないときは、先頭から残りの枚数ぶんだけを選ぶ', () => {
  const ids = ['a', 'b', 'c', 'd']
  assert.deepEqual(defaultSelection(ids, 2), ['a', 'b'])
  assert.deepEqual(defaultSelection(ids, 0), [])
  assert.deepEqual(defaultSelection(ids, 9), ids)
  assert.deepEqual(defaultSelection(ids, null), ids)
})

test('ブース1つを作りきる枚数', () => {
  assert.equal(boothImageCount({ keyVisual: true, otherPanels: 5, creatives: 6, renders: 1 }), 13)
})
