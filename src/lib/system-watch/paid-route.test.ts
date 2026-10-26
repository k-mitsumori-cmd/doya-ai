import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffSnapshots, handlePaidRequest, type PaidRouteDeps } from './paid-route'
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
    snapshot: async () => (snaps++ === 0
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
