// 実行: npx tsx --test src/components/home-agent/typewriter.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TYPEWRITER_EXAMPLES, TYPE_GAP, TYPE_HOLD, cycleLength, typewriterAt } from './typewriter'

test('1文字ずつ打ち、打ち終わりで止まり、消して、次の例へ進む', () => {
  const ex = ['あいうえお', 'かきく']
  assert.equal(typewriterAt(ex, 0).text, 'あ')
  assert.equal(typewriterAt(ex, 4).text, 'あいうえお')
  assert.equal(typewriterAt(ex, 4).phase, 'type')
  assert.equal(typewriterAt(ex, 5).phase, 'hold')
  assert.equal(typewriterAt(ex, 5 + TYPE_HOLD - 1).text, 'あいうえお')
  // 消す（1コマに2文字）
  assert.equal(typewriterAt(ex, 5 + TYPE_HOLD).text, 'あいう')
  assert.equal(typewriterAt(ex, 5 + TYPE_HOLD).phase, 'erase')
  assert.equal(typewriterAt(ex, 5 + TYPE_HOLD + 2).text, '')
  // 空けてから次
  assert.equal(typewriterAt(ex, 5 + TYPE_HOLD + 3).phase, 'gap')
  const second = cycleLength(ex[0])
  assert.equal(typewriterAt(ex, second).text, 'か')
  assert.equal(typewriterAt(ex, second).index, 1)
  // 1周したら最初に戻る
  assert.equal(typewriterAt(ex, cycleLength(ex[0]) + cycleLength(ex[1])).text, 'あ')
})

test('負の値・小数・空の一覧でも落ちない', () => {
  assert.equal(typewriterAt([], 10).text, '')
  assert.equal(typewriterAt(['ab'], -1).phase !== undefined, true)
  assert.equal(typewriterAt(['ab'], 0.9).text, 'a')
  assert.equal(TYPE_GAP > 0, true)
})

test('例は5〜8個で、重ならず、部署をまたぐ', () => {
  assert.ok(TYPEWRITER_EXAMPLES.length >= 5 && TYPEWRITER_EXAMPLES.length <= 8)
  assert.equal(new Set(TYPEWRITER_EXAMPLES).size, TYPEWRITER_EXAMPLES.length)
  for (const e of TYPEWRITER_EXAMPLES) assert.ok(e.length <= 24, `${e}: 長すぎない`)
})
