import test from 'node:test'
import assert from 'node:assert/strict'
import { phraseSegments } from './phrase'

const join = (s: string[]) => s.join('')

test('phraseSegments: 分けても、つなげると元の文と同じ', () => {
  for (const t of ['キーワードから、検索とAIに強い長文の記事を作ります。', 'まだ記事が無いので、キーワードを入れて1本目の記事を作りましょう。', 'ログインしてください']) {
    assert.equal(join(phraseSegments(t)), t)
  }
})

test('phraseSegments: 「記事」「入れて」のような言葉の途中では切らない', () => {
  const a = phraseSegments('キーワードから、検索とAIに強い長文の記事を作ります。')
  assert.ok(a.some((s) => s.includes('記事')), JSON.stringify(a))
  assert.ok(!a.some((s) => s.endsWith('記') || s.startsWith('事')), JSON.stringify(a))
  const b = phraseSegments('まだ記事が無いので、キーワードを入れて1本目の記事を作りましょう。')
  assert.ok(!b.some((s) => s.endsWith('入') && !s.endsWith('入れ')), JSON.stringify(b))
  assert.ok(b.some((s) => s.includes('入れて')), JSON.stringify(b))
  assert.ok(b.length >= 4, JSON.stringify(b))
})

test('phraseSegments: 句読点・短い助詞は前の語にくっつけ、行頭に来ない', () => {
  for (const s of phraseSegments('検索で読まれる記事を、すぐに作ります。').slice(1)) assert.doesNotMatch(s, /^[、。を]/)
})

test('phraseSegments: 分けられない環境（segmenter なし）では、そのまま返す。空は空', () => {
  assert.deepEqual(phraseSegments('テスト', null), ['テスト'])
  assert.deepEqual(phraseSegments('', null), [])
})
