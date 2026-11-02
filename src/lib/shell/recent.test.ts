// 実行: npx tsx --test src/lib/shell/recent.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRecent, serializeRecent } from './recent'

test('cookie の値から、ツールの id だけを取り出す', () => {
  assert.deepEqual(parseRecent(undefined), [])
  assert.deepEqual(parseRecent('sfa,quote,sfa,%3Cscript%3E,AIO,a b,hr'), ['sfa', 'quote', 'hr'])
  assert.deepEqual(parseRecent(serializeRecent(['a', 'b', 'c', 'd', 'e', 'f', 'g'])), ['a', 'b', 'c', 'd', 'e', 'f'])
})

test('メニューのまとまりの開閉を、cookie から読む', async () => {
  const { parseNavGroups, serializeNavGroups } = await import('./nav-groups')
  assert.deepEqual(parseNavGroups(undefined), {})
  assert.deepEqual(parseNavGroups('marketing:1,sales:0,marketing:0,HR:1,admin:2,%3Cx%3E:1'), { marketing: true, sales: false })
  assert.deepEqual(parseNavGroups(serializeNavGroups({ hr: true, other: false })), { hr: true, other: false })
})
