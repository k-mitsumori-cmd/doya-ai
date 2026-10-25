// 実行: npx tsx --test src/lib/shodan/clean-text.test.ts（src/lib/shodan/research.ts の stripControlChars）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripControlChars } from './research'

test('NUL と制御文字を、入れ子の文字・キーからも取り除き、改行とタブは残す', () => {
  const out = stripControlChars({
    pressReleases: [{ title: '2026年5月12日 10\u0000時30分', url: 'https://prtimes.jp/x', date: null }],
    'a\u0000b': 'x\u0007y',
    note: '1行目\n2行目\tタブ',
    n: 3, ok: true, none: null,
  })
  assert.equal(out.pressReleases[0].title, '2026年5月12日 10時30分')
  assert.equal((out as Record<string, unknown>).ab, 'xy')
  assert.equal(out.note, '1行目\n2行目\tタブ')
  assert.deepEqual([out.n, out.ok, out.none], [3, true, null])
  assert.equal(JSON.stringify(out).includes('\\u0000'), false)
})
