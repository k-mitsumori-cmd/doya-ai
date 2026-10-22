// 実行: npm run test:doyapower
// 件数の読み方（count.ts）。課金とハンドラが同じ値を使う
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCount } from './count'

test('数と数の文字列は、整数に切り捨てて範囲に収める。未指定は既定値', () => {
  assert.equal(parseCount(undefined, 1, 4, 1), 1)
  assert.equal(parseCount(null, 1, 4, 1), 1)
  assert.equal(parseCount(3, 1, 4, 1), 3)
  assert.equal(parseCount('3', 1, 4, 1), 3)
  assert.equal(parseCount(' 2 ', 1, 4, 1), 2)
  assert.equal(parseCount(2.9, 1, 4, 1), 2)
  assert.equal(parseCount(10, 1, 4, 1), 4)
  assert.equal(parseCount(0, 1, 4, 1), 1)
  assert.equal(parseCount(-5, 1, 4, 1), 1)
})

test('数でも数の文字列でもないものは null（呼び出し側は 400 で断る）', () => {
  for (const v of ['4abc', '', 'abc', true, [], [3], {}, NaN, Infinity, '1e3', '0x3']) assert.equal(parseCount(v, 1, 4, 1), null, String(v))
})
