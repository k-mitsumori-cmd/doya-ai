import { test } from 'node:test'
import assert from 'node:assert/strict'
import { B1_CHECK_TIMEOUT_MS, B1_TASK_TIMEOUT_MS, judgeSalesPrep, paidAgentChecks } from './agent-checks'
import { runChecks } from './run'
import type { CheckDef } from './types'

const ok = (taskId: string) => ({ taskId, status: 200, ok: true, message: 'できました' })
const timeout = (taskId: string) => ({ taskId, status: 0, ok: false, message: '応答がありませんでした（230秒で打ち切り）' })

test('3つとも応答が成功なら成功', () => {
  const r = judgeSalesPrep([ok('research'), ok('quote'), ok('slides')], { research: ['s1'], quote: ['q1'], slides: ['p1'] })
  assert.equal(r.ok, true)
})

test('応答が時間切れでも、その ToDo の記録ができていれば作業は済んだとみなす（2026-10-26 本番の手動の1回）', () => {
  const r = judgeSalesPrep([ok('research'), ok('quote'), timeout('slides')], { research: ['s1'], quote: ['q1'], slides: ['p1'] })
  assert.equal(r.ok, true)
  assert.match(r.detail ?? '', /slides: 応答は届かなかったが、記録ができた（p1）/)
})

test('応答が時間切れで、記録も無ければ失敗', () => {
  const r = judgeSalesPrep([ok('research'), ok('quote'), timeout('slides')], { research: ['s1'], quote: ['q1'], slides: [] })
  assert.equal(r.ok, false)
  assert.match(r.error ?? '', /slides: .*（記録も見つからない）/)
})

test('4xx・5xx の応答は、記録があっても失敗（作業が途中で断られた）', () => {
  const r = judgeSalesPrep([ok('research'), { taskId: 'quote', status: 402, ok: false, message: 'ドヤパワーが足りません（kind=power）' }, ok('slides')], { research: ['s1'], quote: ['q1'], slides: ['p1'] })
  assert.equal(r.ok, false)
  assert.equal(r.status, 402)
})

test('B1 の時間の上限は、ToDo の上限より長く、ルートの maxDuration（300秒）より短い', () => {
  const b1 = paidAgentChecks().find(c => c.id === 'paid:agent-sales-prep')
  assert.equal(b1?.timeoutMs, B1_CHECK_TIMEOUT_MS)
  assert.ok(B1_TASK_TIMEOUT_MS < B1_CHECK_TIMEOUT_MS && B1_CHECK_TIMEOUT_MS < 300_000)
})

test('確認ごとの時間の上限: 決めた上限で打ち切り、上限が長ければ既定の25秒を超えても待つ', async () => {
  const slow = (id: string, ms: number, timeoutMs?: number): CheckDef => ({ id, area: 'API', label: id, severity: 'action', threshold: 1, hints: ['x'], timeoutMs, run: () => new Promise(r => setTimeout(() => r({ ok: true }), ms)) })
  const [cut, waited] = await runChecks([slow('cut', 80, 20), slow('waited', 80, 500)])
  assert.equal(cut.ok, false)
  assert.match(cut.error ?? '', /0\.02秒で終わりませんでした/)
  assert.equal(waited.ok, true)
})
