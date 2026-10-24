import test from 'node:test'
import assert from 'node:assert/strict'
import { whatYouCanDo } from './costs'
import { usageBreakdown } from './breakdown'

test('残り3,000で、バナー300回・記事75本・ペルソナ60件', () => {
  const m = Object.fromEntries(whatYouCanDo(3000).map((w) => [w.label, w.count]))
  assert.equal(m['バナー'], 300)
  assert.equal(m['記事'], 75)
  assert.equal(m['ペルソナ'], 60)
})
test('残り0・負・NaN は 0', () => {
  for (const v of [0, -5, NaN]) assert.ok(whatYouCanDo(v).every((w) => w.count === 0))
})
test('端数は切り捨て', () => {
  assert.equal(whatYouCanDo(49).find((w) => w.label === '記事')?.count, 1)
})
test('今月の使い道: 種類ごとに合計し、戻した分は引く', () => {
  const now = new Date('2026-10-25T03:00:00Z')
  const rows = [
    { at: '2026-10-24T01:00:00Z', label: 'バナーの生成', amount: -10, type: 'consume', action: 'banner.generate' },
    { at: '2026-10-24T02:00:00Z', label: 'バナーの生成', amount: -10, type: 'consume', action: 'banner.generate' },
    { at: '2026-10-24T03:00:00Z', label: 'バナーの生成（失敗したので戻した分）', amount: 10, type: 'refund', action: 'banner.generate' },
    { at: '2026-09-01T03:00:00Z', label: 'ペルソナの生成', amount: -50, type: 'consume', action: 'persona.generate' },
    { at: '2026-10-24T03:00:00Z', label: '毎月の付与', amount: 3000, type: 'grant' },
  ]
  assert.deepEqual(usageBreakdown(rows, now), [{ label: 'バナーの生成', total: 10, count: 1 }])
})
