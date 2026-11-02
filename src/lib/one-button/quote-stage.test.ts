// 実行: npx tsx --test src/lib/one-button/quote-stage.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quoteOneButtonStage } from './quote-stage'

test('商材も品目も無ければ、URLの解析から', () => {
  assert.equal(quoteOneButtonStage({ createdId: '', itemCount: 0, selectedProduct: '' }), 'analyze')
})

test('商材を選んでいて品目が無ければ、品目の候補を出す（URLを求めない）', () => {
  assert.equal(quoteOneButtonStage({ createdId: '', itemCount: 0, selectedProduct: 'p1' }), 'suggest')
})

test('品目があれば、見積書を作る', () => {
  assert.equal(quoteOneButtonStage({ createdId: '', itemCount: 3, selectedProduct: 'p1' }), 'create')
  assert.equal(quoteOneButtonStage({ createdId: '', itemCount: 1, selectedProduct: '' }), 'create')
})

test('作ったあとは、作った見積書を開く', () => {
  assert.equal(quoteOneButtonStage({ createdId: 'd1', itemCount: 3, selectedProduct: 'p1' }), 'open')
})
