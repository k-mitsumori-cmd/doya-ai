// 実行: npx tsx --test src/lib/shell/frequent.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyState, jstDate, parseState, serializeState, recordVisit, rankByDays, computeOrder, ensureOrder, togglePin,
  actorHash, serializeFreqCookie, parseFreqCookie, pruneDays, daysBetween, FREQ_MAX,
} from './frequent'
import { decideShellFrequent, shellFrequentRollout } from './frequent-flag'

const valid = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g'])

test('日本時間の日付（UTC の夕方は翌日になる）', () => {
  assert.equal(jstDate(new Date('2026-11-12T14:59:00Z')), '2026-11-12')
  assert.equal(jstDate(new Date('2026-11-12T15:00:00Z')), '2026-11-13')
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2)
})

test('同じ日に何度開いても1日と数える', () => {
  let s = emptyState()
  for (let i = 0; i < 10; i++) s = recordVisit(s, 'a', '2026-11-01')
  assert.deepEqual(s.days.a, ['2026-11-01'])
  assert.deepEqual(rankByDays(s.days, '2026-11-01', valid), [])
})

test('開いた日数が2日以上のものだけ、多い順に並ぶ', () => {
  let s = emptyState()
  for (const d of ['2026-11-01', '2026-11-02', '2026-11-03']) s = recordVisit(s, 'b', d)
  for (const d of ['2026-11-02', '2026-11-03']) s = recordVisit(s, 'a', d)
  s = recordVisit(s, 'c', '2026-11-03')
  assert.deepEqual(rankByDays(s.days, '2026-11-04', valid), ['b', 'a'])
})

test('30日より古い記録は捨てる', () => {
  const days = { a: ['2026-10-01', '2026-10-14', '2026-11-12'], b: ['2026-09-01'] }
  assert.deepEqual(pruneDays(days, '2026-11-12'), { a: ['2026-10-14', '2026-11-12'] })
})

test('固定が先で、残りの枠によく使う順。最大5つ', () => {
  let s = emptyState()
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) for (const d of ['2026-11-01', '2026-11-02']) s = recordVisit(s, id, d)
  s = { ...s, pinned: ['g', 'f'] }
  assert.deepEqual(computeOrder(s, '2026-11-03', valid), ['g', 'f', 'a', 'b', 'c'])
  assert.ok(computeOrder(s, '2026-11-03', valid).length <= FREQ_MAX)
})

test('見えないツール（一覧に無い id）は出さない', () => {
  let s = emptyState()
  for (const d of ['2026-11-01', '2026-11-02']) s = recordVisit(s, 'hidden', d)
  s = { ...s, pinned: ['hidden2'] }
  assert.deepEqual(computeOrder(s, '2026-11-03', valid), [])
})

test('並びは1日1回だけ作る。画面を移っても変わらず、翌日に変わる', () => {
  let s = emptyState()
  for (const d of ['2026-11-01', '2026-11-02']) s = recordVisit(s, 'a', d)
  s = ensureOrder(s, '2026-11-03', valid)
  assert.deepEqual(s.order, { date: '2026-11-03', ids: ['a'] })
  // その日のうちに b が2日ぶんになっても、並びは動かない
  s = recordVisit(recordVisit(s, 'b', '2026-11-02'), 'b', '2026-11-03')
  assert.deepEqual(ensureOrder(s, '2026-11-03', valid).order.ids, ['a'])
  assert.deepEqual(ensureOrder(s, '2026-11-04', valid).order, { date: '2026-11-04', ids: ['b', 'a'] })
})

test('固定の切り替えはすぐ並びに出る。6つ目は固定できない', () => {
  let s = ensureOrder(emptyState(), '2026-11-03', valid)
  for (const id of ['a', 'b', 'c', 'd', 'e']) s = togglePin(s, id, '2026-11-03', valid).state
  assert.deepEqual(s.order.ids, ['a', 'b', 'c', 'd', 'e'])
  const six = togglePin(s, 'f', '2026-11-03', valid)
  assert.equal(six.changed, false)
  assert.deepEqual(six.state.pinned, ['a', 'b', 'c', 'd', 'e'])
  const off = togglePin(s, 'a', '2026-11-03', valid)
  assert.deepEqual(off.state.pinned, ['b', 'c', 'd', 'e'])
  assert.equal(togglePin(s, 'zzz', '2026-11-03', valid).changed, false)
})

test('壊れた保存は捨てる', () => {
  assert.deepEqual(parseState(undefined), emptyState())
  assert.deepEqual(parseState('{broken'), emptyState())
  assert.deepEqual(parseState('[1,2]'), emptyState())
  assert.deepEqual(parseState('"x"'), emptyState())
  const s = parseState(JSON.stringify({
    days: { a: ['2026-11-01', 'bad', 5, '2026-11-01'], 'B<': ['2026-11-01'], c: 'x' },
    pinned: ['a', 'A', 3, 'a'],
    order: { date: 'nope', ids: ['a'] },
  }))
  assert.deepEqual(s.days, { a: ['2026-11-01'] })
  assert.deepEqual(s.pinned, ['a'])
  assert.deepEqual(s.order, { date: '', ids: [] })
  assert.deepEqual(parseState(serializeState(s)), s)
})

test('cookie は、同じアカウントのときだけ読める', () => {
  const raw = serializeFreqCookie('user-1', ['a', 'b', 'c'], 1)
  assert.deepEqual(parseFreqCookie(raw, 'user-1'), { ids: ['a', 'b', 'c'], pinnedCount: 1 })
  assert.deepEqual(parseFreqCookie(raw, 'user-2'), { ids: [], pinnedCount: 0 })
  assert.deepEqual(parseFreqCookie(undefined, 'user-1'), { ids: [], pinnedCount: 0 })
  assert.deepEqual(parseFreqCookie(raw, ''), { ids: [], pinnedCount: 0 })
  assert.notEqual(actorHash('user-1'), actorHash('user-2'))
})

test('cookie の中の変な文字・多すぎる id・壊れた値は通さない', () => {
  const h = actorHash('u')
  assert.deepEqual(parseFreqCookie(encodeURIComponent(`${h}.a,<x>,B,b,a,c,d,e,f,g.9`), 'u'), { ids: ['a', 'b', 'c', 'd', 'e'], pinnedCount: 5 })
  assert.deepEqual(parseFreqCookie('%E0%A4%A', 'u'), { ids: [], pinnedCount: 0 })
  assert.deepEqual(parseFreqCookie(encodeURIComponent(`${h}.a.x`), 'u'), { ids: ['a'], pinnedCount: 0 })
})

test('旗: 既定は off。preview は許可した人だけ。all は全員', () => {
  assert.equal(shellFrequentRollout(undefined), 'off')
  assert.equal(shellFrequentRollout('xyz'), 'off')
  assert.equal(shellFrequentRollout(' ALL '), 'all')
  assert.equal(decideShellFrequent({ rollout: 'off', email: 'a@x.jp', allow: ['a@x.jp'] }), false)
  assert.equal(decideShellFrequent({ rollout: 'preview', email: 'A@x.jp', allow: ['a@x.jp'] }), true)
  assert.equal(decideShellFrequent({ rollout: 'preview', email: 'b@x.jp', allow: ['a@x.jp'] }), false)
  assert.equal(decideShellFrequent({ rollout: 'all', email: null, allow: [] }), true)
})
