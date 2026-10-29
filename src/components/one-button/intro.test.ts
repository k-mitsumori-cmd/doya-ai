// 実行: npx tsx --test src/components/one-button/intro.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toolForPath, toolIntroLine } from './intro'

test('ツールの画面なら、できることを1つ返す', () => {
  assert.ok(toolIntroLine('/quote').length > 0)
  assert.equal(toolForPath('/quote/documents/abc')?.id, 'quote')
})

test('ホームや知らない画面では、何も返さない', () => {
  assert.equal(toolIntroLine('/home'), '')
  assert.equal(toolIntroLine(''), '')
  assert.equal(toolIntroLine('/no-such-tool'), '')
})
