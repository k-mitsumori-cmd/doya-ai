// 実行: npx tsx --test src/components/shell-next/motion-count.test.ts
// 数え上がり・動きの強さの回帰テスト。画面は描かない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countValue, dayKey, easeOutQuart, formatCount, isFirstOfDay, motionTimes, parseCount } from './motion-count'

test('parseCount: 桁区切り・小数を読み、数字でない表示は読まない', () => {
  assert.deepEqual(parseCount('1,284'), { n: 1284, decimals: 0, grouped: true })
  assert.deepEqual(parseCount('1.8'), { n: 1.8, decimals: 1, grouped: false })
  assert.deepEqual(parseCount('24'), { n: 24, decimals: 0, grouped: false })
  assert.equal(parseCount('—'), null)
  assert.equal(parseCount('12abc'), null)
  assert.equal(parseCount('1,28'), null)
})

test('formatCount: もとの表示と同じ形（桁区切り・小数）で出す', () => {
  assert.equal(formatCount(1284, { decimals: 0, grouped: true }), '1,284')
  assert.equal(formatCount(312.4, { decimals: 0, grouped: false }), '312')
  assert.equal(formatCount(1.84, { decimals: 1, grouped: false }), '1.8')
  assert.equal(formatCount(0, { decimals: 0, grouped: true }), '0')
  assert.equal(formatCount(1234567, { decimals: 0, grouped: true }), '1,234,567')
})

test('countValue: 0 から始まり、減速して、最後は目標の値ちょうどで止まる', () => {
  const spec = { n: 1284, decimals: 0, grouped: true }
  assert.equal(countValue(spec, 0), 0)
  assert.equal(countValue(spec, 1), 1284)
  assert.equal(countValue(spec, 1.5), 1284)
  // 減速: 前半の増え方のほうが、後半より大きい
  const a = countValue(spec, 0.5) - countValue(spec, 0)
  const b = countValue(spec, 1) - countValue(spec, 0.5)
  assert.ok(a > b)
  // 単調に増える
  let prev = -1
  for (let i = 0; i <= 20; i++) { const v = countValue(spec, i / 20); assert.ok(v >= prev); prev = v }
  assert.equal(easeOutQuart(-1), 0)
})

test('motionTimes: 動きを減らす設定は 0、2回目以降は短く、最初は約1秒', () => {
  assert.deepEqual(motionTimes('none'), { count: 0, cardStep: 0, settle: 0 })
  assert.equal(motionTimes('short').count < motionTimes('full').count, true)
  assert.equal(motionTimes('short').cardStep, 0)
  const full = motionTimes('full')
  assert.ok(full.count >= 800 && full.count <= 1200)
  assert.equal(motionTimes('full', 4).count, full.count * 4)
  assert.equal(motionTimes('full', Number.NaN).count, full.count)
})

test('その日の最初: 記録が今日と違えばフル、同じなら短く', () => {
  const today = dayKey(new Date(2026, 9, 29))
  assert.equal(today, '2026-10-29')
  assert.equal(isFirstOfDay(null, today), true)
  assert.equal(isFirstOfDay('2026-10-28', today), true)
  assert.equal(isFirstOfDay(today, today), false)
})
