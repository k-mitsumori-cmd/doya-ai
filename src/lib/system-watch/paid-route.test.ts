import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffSnapshots, handlePaidRequest, type PaidRouteDeps, type Snapshot } from './paid-route'
import { wrapWithDailyCap } from './paid-run'
import type { CheckDef, CheckResult } from './types'

const SECRET = 'secret-x'
const req = (url: string, auth: string | null = `Bearer ${SECRET}`) => new Request(url, { method: 'POST', headers: auth ? { authorization: auth } : {} })
const URL_ONCE = 'https://doya-ai.surisuta.jp/api/cron/system-watch-paid?once=agent'

function makeDeps(over: Partial<PaidRouteDeps> = {}) {
  const calls = { runWatch: 0, agentRuns: 0, paidChecks: 0, tiers: [] as string[] }
  const agentCheck: CheckDef = { id: 'paid:agent-sales-prep', area: '外部サービス', label: 'B1', severity: 'urgent', threshold: 1, hints: ['x'], run: async () => { calls.agentRuns++; return { ok: true, detail: 'できました' } } }
  let snaps = 0
  const deps: PaidRouteDeps = {
    secret: SECRET,
    budgetedPaidChecks: async () => { calls.paidChecks++; return { checks: [], groups: [], skipped: [] } },
    budgetedAgentChecksOnce: () => ({ checks: [agentCheck], skipped: [] }),
    runWatch: async (tier, checks) => {
      calls.runWatch++; calls.tiers.push(tier)
      const results: CheckResult[] = []
      for (const c of checks) { const o = await c.run(); results.push({ ...o, id: c.id, area: c.area, label: c.label, severity: c.severity, hints: c.hints, at: '', ms: 0 }) }
      return { checkedAt: '2026-10-26T00:00:00.000Z', failed: results.filter(r => !r.ok), sent: [], results }
    },
    readSpend: async () => ({ yen: 0 }),
    capYen: 10,
    switchKeys: ['watch:v1:paid-enabled', 'watch:v1:paid-agent-enabled'],
    snapshot: async (): Promise<Snapshot> => (snaps++ === 0
      ? { settings: { 'watch:v1:marked:quote-document:org1:2026-10': '["q0"]', 'org-quota:v1:quoteDocuments:h:2026-10': '3' }, powerLeft: 2969 }
      : { settings: { 'watch:v1:marked:quote-document:org1:2026-10': '["q0","q1"]', 'watch:v1:marked:shodan-preparation:org1:2026-10': '["s1"]', 'org-quota:v1:quoteDocuments:h:2026-10': '3' }, powerLeft: 2938 }) as { settings: Record<string, string>; powerLeft: number },
    ...over,
  }
  return { deps, calls }
}

test('?once=agent で呼ぶと、エージェントの確認がちょうど1回だけ回る（スイッチは見ない）', async () => {
  const { deps, calls } = makeDeps()
  const r = await handlePaidRequest(req(URL_ONCE), 'POST', deps)
  assert.equal(r.status, 200)
  assert.equal(calls.runWatch, 1)
  assert.equal(calls.agentRuns, 1)
  assert.equal(calls.paidChecks, 0, 'スイッチを読む経路は通らない')
  assert.deepEqual(calls.tiers, ['paid-once'], 'ふだんの状態（paid）とは別に残す')
  assert.deepEqual(r.body.createdIds, { 'watch:v1:marked:quote-document:org1:2026-10': ['q1'], 'watch:v1:marked:shodan-preparation:org1:2026-10': ['s1'] })
  assert.deepEqual(r.body.ledgerChanges, [], '枠の台帳は増えていない')
  assert.deepEqual(r.body.powerLeft, { before: 2969, after: 2938, diff: -31 })
})

test('鍵が無い・違うときは 401 を返し、何も回さない', async () => {
  for (const auth of [null, 'Bearer wrong']) {
    const { deps, calls } = makeDeps()
    const r = await handlePaidRequest(req(URL_ONCE, auth), 'POST', deps)
    assert.equal(r.status, 401)
    assert.equal(calls.runWatch + calls.agentRuns + calls.paidChecks, 0)
  }
  const { deps, calls } = makeDeps({ secret: undefined })
  assert.equal((await handlePaidRequest(req(URL_ONCE, 'Bearer undefined'), 'POST', deps)).status, 401, 'CRON_SECRET が未設定なら誰も通さない')
  assert.equal(calls.runWatch, 0)
})

test('once=agent 以外の POST は受け付けない', async () => {
  const { deps, calls } = makeDeps()
  const r = await handlePaidRequest(req('https://doya-ai.surisuta.jp/api/cron/system-watch-paid?once=all'), 'POST', deps)
  assert.equal(r.status, 400)
  assert.equal(calls.runWatch, 0)
})

test('1日10円の上限に届いていれば、手で1回のときも中身を回さない（費用も足さない）', async () => {
  let inner = 0
  const added: string[] = []
  const check = { id: 'paid:agent-sales-prep', area: '外部サービス' as const, label: 'B1', severity: 'urgent' as const, threshold: 1, hints: ['x'], costYen: 1.8, run: async () => { inner++; return { ok: true } } }
  const capped = wrapWithDailyCap([check], { readSpend: async () => ({ yen: 10 }), addSpend: async (id) => { added.push(id) } })
  const { deps } = makeDeps({ budgetedAgentChecksOnce: () => capped })
  const r = await handlePaidRequest(req(URL_ONCE), 'POST', deps)
  assert.equal(r.status, 200)
  assert.equal(inner, 0)
  assert.deepEqual(added, [])
  assert.deepEqual(r.body.skippedByCap, ['paid:agent-sales-prep'])
})

test('上限の手前なら回し、回した分の費用を足す', async () => {
  let inner = 0
  const added: string[] = []
  const check = { id: 'paid:agent-sales-prep', area: '外部サービス' as const, label: 'B1', severity: 'urgent' as const, threshold: 1, hints: ['x'], costYen: 1.8, run: async () => { inner++; return { ok: true } } }
  const { checks } = wrapWithDailyCap([check], { readSpend: async () => ({ yen: 5 }), addSpend: async (id) => { added.push(id) } })
  await checks[0].run()
  assert.equal(inner, 1)
  assert.deepEqual(added, ['paid:agent-sales-prep'])
})

test('前後の差: 台帳の値が変わったら ledgerChanges に出す', () => {
  const d = diffSnapshots({ settings: { 'org-quota:v1:a': '3' }, powerLeft: null }, { settings: { 'org-quota:v1:a': '4' }, powerLeft: null })
  assert.deepEqual(d.ledgerChanges, [{ key: 'org-quota:v1:a', before: '3', after: '4' }])
  assert.equal(d.powerLeft.diff, null)
})

/** 足すと累計に反映される、費用の記録の偽物 */
function spendStore(start: number) {
  let yen = start
  const log: [string, number][] = []
  return { log, get yen() { return yen }, deps: { readSpend: async () => ({ yen }), addSpend: async (id: string, v: number) => { await new Promise(r => setTimeout(r, 5)); yen += v; log.push([id, v]) } } }
}
const paid = (id: string, costYen: number, run: () => Promise<{ ok: boolean; skipped?: boolean }>) => ({ id, area: '外部サービス' as const, label: id, severity: 'urgent' as const, threshold: 1, hints: ['x'], costYen, run })

test('同時に回しても上限を超えない: 累計7円なら、1.8円は回し、2.4円は足すと10円を超えるので回さない', async () => {
  const store = spendStore(7)
  const ran: string[] = []
  const { checks, skipped } = wrapWithDailyCap([
    paid('paid:agent-research-samples', 2.4, async () => { ran.push('B2'); return { ok: true } }),
    paid('paid:agent-sales-prep', 1.8, async () => { ran.push('B1'); return { ok: true } }),
  ], store.deps)
  await Promise.all(checks.map(c => c.run()))
  assert.deepEqual(ran, ['B1'])
  assert.deepEqual(skipped, ['paid:agent-research-samples'])
  assert.ok(store.yen <= 10, `累計 ${store.yen} 円`)
})

test('同時に回しても、余りがあれば両方回す（累計0円）', async () => {
  const store = spendStore(0)
  const ran: string[] = []
  const { checks } = wrapWithDailyCap([
    paid('a', 2.4, async () => { ran.push('a'); return { ok: true } }),
    paid('b', 1.8, async () => { ran.push('b'); return { ok: true } }),
  ], store.deps)
  await Promise.all(checks.map(c => c.run()))
  assert.deepEqual(ran.sort(), ['a', 'b'])
  assert.equal(Math.round(store.yen * 10) / 10, 4.2)
})

test('前提がそろわず回さなかった確認は、予約を戻す', async () => {
  const store = spendStore(0)
  const { checks } = wrapWithDailyCap([paid('b1', 1.8, async () => ({ ok: true, skipped: true }))], store.deps)
  await checks[0].run()
  assert.equal(store.yen, 0)
  assert.deepEqual(store.log, [['b1', 1.8], ['b1', -1.8]])
})

test('失敗した確認は、費用は出たとみなして予約を残す', async () => {
  const store = spendStore(0)
  const { checks } = wrapWithDailyCap([paid('b1', 1.8, async () => ({ ok: false }))], store.deps)
  await checks[0].run()
  assert.equal(store.yen, 1.8)
})

test('予約を書けなければ回さない', async () => {
  let ran = false
  const { checks, skipped } = wrapWithDailyCap([paid('b1', 1.8, async () => { ran = true; return { ok: true } })], { readSpend: async () => ({ yen: 0 }), addSpend: async () => { throw new Error('db down') } })
  const out = await checks[0].run()
  assert.equal(ran, false)
  assert.equal(out.skipped, true)
  assert.deepEqual(skipped, ['b1'])
})
