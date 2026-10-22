// 実行: npx tsx --test src/components/ds/chart-math.test.ts
// ds/charts の純粋な計算（目盛り・積み上げ・割合・しきい値・数え上げ）を確かめる。git と環境変数は使わない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  barPercents, countFrame, formatCompactJa, formatCount, labelEvery, niceStep, niceTicks,
  percentStack, radarPoints, ratioIn, seriesColor, stackExtent, stackValues, thresholdFor, SERIES_TONES,
} from './chart-math'

test('niceStep は 1・2・2.5・5 ×10^k に丸める', () => {
  assert.equal(niceStep(0.7), 1)
  assert.equal(niceStep(1.7), 2)
  assert.equal(niceStep(2.3), 2.5)
  assert.equal(niceStep(37), 50)
  assert.equal(niceStep(0.03), 0.05)
  assert.equal(niceStep(0), 1)
  assert.equal(niceStep(Number.NaN), 1)
})

test('niceTicks は値を含むきりのよい範囲を返し、0 を含む', () => {
  const t = niceTicks(0, 87, 5)
  assert.equal(t.min, 0)
  assert.equal(t.max, 100)
  assert.deepEqual(t.ticks, [0, 25, 50, 75, 100])
})

test('niceTicks は負の値でも 0 をまたぐ目盛りを返す', () => {
  const t = niceTicks(-30, 70, 5)
  assert.ok(t.min <= -30 && t.max >= 70)
  assert.ok(t.ticks.includes(0))
  for (let i = 1; i < t.ticks.length; i++) assert.equal(Number((t.ticks[i] - t.ticks[i - 1]).toFixed(9)), t.step)
})

test('niceTicks は小数の刻みで端数を出さない', () => {
  const t = niceTicks(0, 0.3, 4)
  assert.deepEqual(t.ticks, [0, 0.1, 0.2, 0.3])
})

test('niceTicks は全部同じ値・NaN でも範囲を作る', () => {
  assert.deepEqual(niceTicks(0, 0).ticks.length > 1, true)
  const pos = niceTicks(5, 5)
  assert.equal(pos.min, 0)
  assert.ok(pos.max >= 5)
  const neg = niceTicks(-5, -5)
  assert.equal(neg.max, 0)
  const bad = niceTicks(Number.NaN, Number.NaN)
  assert.equal(bad.min, 0)
  assert.equal(bad.max, 1)
})

test('niceTicks は fixed の範囲（0〜100）をそのまま使う', () => {
  const t = niceTicks(3, 40, 5, [0, 100])
  assert.equal(t.min, 0)
  assert.equal(t.max, 100)
  assert.deepEqual(t.ticks, [0, 25, 50, 75, 100])
})

test('ratioIn は範囲の外を 0〜1 に収める', () => {
  assert.equal(ratioIn(50, 0, 100), 0.5)
  assert.equal(ratioIn(-10, 0, 100), 0)
  assert.equal(ratioIn(200, 0, 100), 1)
  assert.equal(ratioIn(1, 1, 1), 0)
})

test('formatCompactJa は万・億で短くする', () => {
  assert.equal(formatCompactJa(0), '0')
  assert.equal(formatCompactJa(9500), '9,500')
  assert.equal(formatCompactJa(12000), '1.2万')
  assert.equal(formatCompactJa(-2500000), '-250万')
  assert.equal(formatCompactJa(350000000), '3.5億')
})

test('stackValues は正を上へ、負を下へ積む', () => {
  const st = stackValues([[10, 5, -2], [20, -3, -4]])
  assert.deepEqual(st[0], [[0, 10], [0, 5], [-2, 0]])
  assert.deepEqual(st[1], [[10, 30], [-3, 0], [-6, -2]])
  assert.deepEqual(stackExtent([[10, 5, -2], [20, -3, -4]]), [-6, 30])
})

test('stackValues は長さの違う系列と NaN を 0 として扱う', () => {
  const st = stackValues([[1], [Number.NaN, 2]])
  assert.deepEqual(st[0], [[0, 1], [0, 0]])
  assert.deepEqual(st[1], [[1, 1], [0, 2]])
})

test('percentStack の表示用の整数は合計が必ず 100 になる', () => {
  const p = percentStack([1, 1, 1])
  assert.deepEqual(p.labels, [34, 33, 33])
  assert.equal(p.labels.reduce((a, b) => a + b, 0), 100)
  const q = percentStack([12.5, 37.5, 50])
  assert.deepEqual(q.labels.reduce((a, b) => a + b, 0), 100)
  assert.ok(Math.abs(q.percents.reduce((a, b) => a + b, 0) - 100) < 1e-9)
})

test('percentStack は負の値を 0 とし、合計 0 なら全部 0', () => {
  assert.deepEqual(percentStack([-5, 5]).labels, [0, 100])
  const z = percentStack([0, 0])
  assert.equal(z.total, 0)
  assert.deepEqual(z.labels, [0, 0])
})

test('barPercents は max 基準と total 基準を切り替える', () => {
  assert.deepEqual(barPercents([50, 25, 25]), [100, 50, 50])
  assert.deepEqual(barPercents([50, 25, 25], 'total'), [50, 25, 25])
  assert.deepEqual(barPercents([0, 0], 'total'), [0, 0])
  assert.deepEqual(barPercents([-1, 4]), [0, 100])
})

test('thresholdFor は at 以上で一番大きいしきい値を選ぶ', () => {
  const th = [{ at: 0.8, tone: 'good' }, { at: 0, tone: 'poor' }, { at: 0.5, tone: 'fair' }]
  assert.equal(thresholdFor(0.9, th)?.tone, 'good')
  assert.equal(thresholdFor(0.8, th)?.tone, 'good')
  assert.equal(thresholdFor(0.6, th)?.tone, 'fair')
  assert.equal(thresholdFor(0.1, th)?.tone, 'poor')
  assert.equal(thresholdFor(-1, th)?.tone, 'poor')
  assert.equal(thresholdFor(1, []), undefined)
})

test('radarPoints は最初の軸を真上に置き、時計回りに並べる', () => {
  const p = radarPoints([10, 10, 10, 10], 10, 100, 0, 0)
  assert.deepEqual(p[0], [0, -100])
  assert.deepEqual(p[1], [100, 0])
  assert.deepEqual(p[2], [0, 100])
  assert.deepEqual(p[3], [-100, 0])
  // 範囲の外は収める
  assert.deepEqual(radarPoints([20], 10, 50, 0, 0)[0], [0, -50])
  assert.deepEqual(radarPoints([5], 0, 50, 0, 0)[0], [0, -50])
})

test('countFrame は 0 で始まり、1 以上で必ず最後の値になる', () => {
  assert.equal(countFrame(0, 1234, 0), 0)
  assert.equal(countFrame(0, 1234, 1), 1234)
  assert.equal(countFrame(0, 1234, 5), 1234)
  assert.equal(countFrame(0, 1234, Number.NaN), 1234) // 時間が分からないときは最後の値
  const mid = countFrame(0, 100, 0.5)
  assert.ok(mid > 50 && mid < 100)
})

test('formatCount は最後の値の小数の桁にそろえる', () => {
  assert.equal(formatCount(1234.4, 2000), '1,234')
  assert.equal(formatCount(3.14159, 4.25), '3.14')
  assert.equal(formatCount(0, 12.5), '0.0')
})

test('labelEvery は幅に入るように横軸の文字を間引く', () => {
  assert.equal(labelEvery(12, 560), 1)
  assert.equal(labelEvery(12, 300), 2)
  assert.equal(labelEvery(30, 300), 5)
  assert.equal(labelEvery(1, 10), 1)
})

test('seriesColor は6色以上を順に返し、tone の指定を優先する', () => {
  assert.ok(SERIES_TONES.length >= 6)
  const colors = new Set(Array.from({ length: 6 }, (_, i) => seriesColor(i)))
  assert.equal(colors.size, 6)
  assert.match(seriesColor(0, 'pink'), /--pink/)
  assert.equal(seriesColor(0, '#123456'), '#123456')
})
