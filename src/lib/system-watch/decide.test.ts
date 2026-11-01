import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide, failureSignature, REPEAT_MS } from './decide'
import { formatFailures, formatObservedChanges, formatRecoveries } from './format'
import type { CheckResult, CheckState, WatchEvent } from './types'

const T0 = '2026-10-26T00:00:00.000Z'
const at = (min: number) => new Date(Date.parse(T0) + min * 60000).toISOString()
const result = (over: Partial<CheckResult> = {}): CheckResult => ({
  id: 'page:/banner', area: '画面', label: 'ドヤバナー（/banner）', severity: 'action', hints: ['デプロイの状態を確認する'],
  ok: false, url: 'https://doya-ai.surisuta.jp/banner', status: 500, error: 'HTTP 500: Internal Server Error', at: T0, ms: 120, ...over,
})

function run(steps: { r: Partial<CheckResult>; min: number }[], threshold = 2) {
  let state: Record<string, CheckState | undefined> = {}
  const log: WatchEvent[][] = []
  for (const s of steps) {
    const out = decide([result(s.r)], state, { 'page:/banner': threshold }, at(s.min))
    state = out.next
    log.push(out.events)
  }
  return { log, state }
}

test('しきい値に届くまでは知らせない（一時的な揺れを間引く）', () => {
  const { log } = run([{ r: {}, min: 0 }, { r: { ok: true, status: 200, error: undefined }, min: 10 }])
  assert.equal(log.flat().length, 0, '1回だけ失敗して直ったものは失敗も復旧も知らせない')
})

test('続けて失敗したら1回知らせ、その後は6時間ごと', () => {
  const steps = [0, 10, 20, 30].map(min => ({ r: {}, min }))
  steps.push({ r: {}, min: 10 + REPEAT_MS / 60000 })
  const { log } = run(steps)
  assert.deepEqual(log.map(e => e.length), [0, 1, 0, 0, 1])
  const first = log[1][0]
  assert.equal(first.type, 'failure')
  if (first.type === 'failure') { assert.equal(first.reason, 'new'); assert.equal(first.state.failCount, 2); assert.equal(first.state.since, at(0)) }
  const repeat = log[4][0]
  if (repeat.type === 'failure') assert.equal(repeat.reason, 'repeat')
})

test('失敗の中身が変わったらすぐ知らせ直す', () => {
  const { log } = run([{ r: {}, min: 0 }, { r: {}, min: 10 }, { r: { status: 404, error: 'HTTP 404' }, min: 20 }])
  const ev = log[2][0]
  assert.equal(ev?.type, 'failure')
  if (ev?.type === 'failure') assert.equal(ev.reason, 'changed')
})

test('時刻や件数の違いでは見分けが変わらない', () => {
  assert.equal(failureSignature({ status: 500, error: '3件の失敗 12:00' }), failureSignature({ status: 500, error: '7件の失敗 13:10' }))
})

test('知らせた失敗が直ったら「直りました」を出し、状態を戻す', () => {
  const { log, state } = run([{ r: {}, min: 0 }, { r: {}, min: 10 }, { r: { ok: true, status: 200, error: undefined, detail: 'HTTP 200（0.5秒）' }, min: 40 }])
  const ev = log[2][0]
  assert.equal(ev?.type, 'recovery')
  if (ev?.type === 'recovery') { assert.equal(ev.downSince, at(0)); assert.equal(ev.failCount, 2) }
  assert.equal(state['page:/banner']?.ok, true)
  assert.equal(state['page:/banner']?.failCount, 0)
})

test('旗などの観測値が変わったら知らせる（初回は知らせない）', () => {
  let s: Record<string, CheckState | undefined> = {}
  const r = (observed: string) => result({ id: 'flag:x', ok: true, status: undefined, error: undefined, observed })
  s = decide([r('off')], s, {}, at(0)).next
  const out = decide([r('on')], s, {}, at(10))
  assert.equal(out.events.length, 1)
  assert.equal(out.events[0].type, 'observed-change')
})

test('失敗の通知に、場所・URL・状態コード・エラー・時刻・回数・直し方を書く', () => {
  const { log } = run([{ r: {}, min: 0 }, { r: {}, min: 10 }])
  const { title, text } = formatFailures(log[1] as Extract<WatchEvent, { type: 'failure' }>[], at(10))
  assert.equal(title, '画面「ドヤバナー（/banner）」の確認に失敗しました')
  assert.match(text, /■ 画面：ドヤバナー（\/banner）（新しい失敗）/)
  assert.match(text, /確認した URL: https:\/\/doya-ai\.surisuta\.jp\/banner/)
  assert.match(text, /状態コード: HTTP 500/)
  assert.match(text, /エラー: HTTP 500: Internal Server Error/)
  assert.match(text, /最初の失敗: 2026\/10\/26 9:00:00（約10分前から、2回続けて失敗）/)
  assert.match(text, /1\. デプロイの状態を確認する/)
})

test('復旧と設定の変化の文面', () => {
  const rec = formatRecoveries([{ type: 'recovery', result: result({ ok: true, detail: 'HTTP 200' }), downSince: at(0), failCount: 9 }], at(95))
  assert.equal(rec.title, '画面「ドヤバナー（/banner）」が直りました')
  assert.match(rec.text, /約1時間35分（失敗 9回）/)
  const obs = formatObservedChanges([{ type: 'observed-change', result: result({ label: '旗「ドヤパワー」', observed: 'on' }), before: 'off' }], at(0))
  assert.match(obs.text, /前: off\n- 今: on/)
})
