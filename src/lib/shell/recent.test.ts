// 実行: npx tsx --test src/lib/shell/recent.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRecent, serializeRecent } from './recent'

test('cookie の値から、ツールの id だけを取り出す', () => {
  assert.deepEqual(parseRecent(undefined), [])
  assert.deepEqual(parseRecent('sfa,quote,sfa,%3Cscript%3E,AIO,a b,hr'), ['sfa', 'quote', 'hr'])
  assert.deepEqual(parseRecent(serializeRecent(['a', 'b', 'c', 'd', 'e', 'f', 'g'])), ['a', 'b', 'c', 'd', 'e', 'f'])
})
