// 実行: npx tsx --test src/lib/agent-orchestration/failures.test.ts
// 失敗のチェックリスト（docs/architecture/agent-orchestration/FAILURE-CHECKLIST.md）の、モックで確かめる行。
// 原因（cause）と次の一手（actions）が、失敗ごとに正しく付くことを見る（AI・DB・課金には触れない）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentTaskError, runAgentTasks, type AgentTaskResult } from './runner'
import { parseSalesPrepAnswers, type SalesPrepAnswers } from './recipes'
import { runSalesPrepTask, toTaskError, type ToolCallResult, type ToolDeps, type ToolRouteId } from './tools'
import { todoViewOf } from './view'

const kinds = (e: AgentTaskError) => (e.actions ?? []).map((a) => a.kind)
const answers = () => {
  const p = parseSalesPrepAnswers({ url: 'example.co.jp', offer: 'web', budget: '50to200', stage: 'proposal' })
  assert.ok(p.ok)
  return p.value as SalesPrepAnswers
}

test('失敗の行 401 商談準備: 組織が無い。setup・商談準備を開く・やり直す', () => {
  const e = toTaskError('shodan', { status: 401, data: {} }, 'x')
  assert.equal(e.kind, 'setup')
  assert.equal(e.cause, 'no_org')
  assert.deepEqual(kinds(e), ['href', 'retry'])
  assert.deepEqual(e.actions?.[0], { kind: 'href', href: '/shodan', label: '商談準備を開く' })
})

test('失敗の行 401 ドヤスライド: ログインが切れた。auth・ログインへの道だけ', () => {
  const e = toTaskError('doyaslide', { status: 401, data: {} }, 'x')
  assert.equal(e.kind, 'auth')
  assert.equal(e.cause, 'auth')
  assert.deepEqual(kinds(e), ['href'])
  assert.equal((e.actions?.[0] as { href: string }).href, '/auth/signin?callbackUrl=/home')
})

test('失敗の行 RESEARCH_FAILED: 原因ごとの次の一手（会社名で調べ直す・やり直す）', () => {
  const cases: [string, string, string[]][] = [
    ['dns', 'dns', ['input']],
    ['timeout', 'timeout', ['input', 'retry']],
    ['network', 'network', ['input', 'retry']],
    ['http', 'http', ['input', 'retry']],
    ['redirect', 'redirect', ['input', 'retry']],
    ['body', 'body', ['input', 'retry']],
    ['url_rejected', 'url_rejected', ['input']],
    ['content_type', 'content_type', ['input']],
    ['js_rendered', 'js_rendered', ['input']],
    ['no_facts', 'no_facts', ['input']],
    ['save', 'save', ['retry']],
    ['なにかしらない理由', 'unknown', ['input', 'retry']],
  ]
  for (const [reason, cause, expected] of cases) {
    const e = toTaskError('shodan', { status: 422, data: { code: 'RESEARCH_FAILED', reason, error: 'サイトが見つかりませんでした。' } }, 'x')
    assert.equal(e.kind, 'input', reason)
    assert.equal(e.cause, cause, reason)
    assert.deepEqual(kinds(e), expected, reason)
    assert.equal(e.userMessage, 'サイトが見つかりませんでした。', reason)
    const input = e.actions?.find((a) => a.kind === 'input')
    if (input) assert.equal((input as { field: string }).field, 'companyName', reason)
  }
  // reason が文字列でなければ unknown
  assert.equal(toTaskError('shodan', { status: 422, data: { code: 'RESEARCH_FAILED', reason: 1 } }, 'x').cause, 'unknown')
})

test('失敗の行 402 LIMIT_REACHED: 上限。料金を見る道だけで、やり直しは出さない', () => {
  const e = toTaskError('quote', { status: 402, data: { code: 'LIMIT_REACHED', error: '今月の上限です。', upgradeUrl: '/quote/pricing' } }, 'x')
  assert.equal(e.kind, 'limit')
  assert.equal(e.cause, 'limit_reached')
  assert.deepEqual(kinds(e), ['href'])
  assert.equal((e.actions?.[0] as { href: string }).href, '/quote/pricing')
  assert.equal(e.href?.href, '/quote/pricing')
})

test('失敗の行 ドヤパワー不足: power・やり直しは出さない', () => {
  const e = toTaskError('quote', { status: 402, data: { code: 'DOYA_POWER_INSUFFICIENT', error: 'ドヤパワーが足りません。' } }, 'x')
  assert.equal(e.kind, 'power')
  assert.equal(e.cause, 'power')
  assert.ok(!kinds(e).includes('retry'))
})

test('失敗の行 ドヤスライドの 1日の上限（429）: limit・やり直しは出さない', () => {
  const e = toTaskError('doyaslide', { status: 429, data: { code: 'DOYASLIDE_TEXT_DAILY_LIMIT' } }, '既定の文')
  assert.equal(e.kind, 'limit')
  assert.equal(e.cause, 'doyaslide_text_daily_limit')
  assert.ok(!kinds(e).includes('retry'))
})

test('失敗の行 403 LIMIT_REACHED（プロジェクトの数の上限）: limit・やり直しは出さない', () => {
  const e = toTaskError('doyaslide', { status: 403, data: { code: 'LIMIT_REACHED', upgradeUrl: '/pricing' } }, 'x')
  assert.equal(e.kind, 'limit')
  assert.deepEqual(kinds(e), ['href'])
})

test('失敗の行 502 / 500 / 409: 原因の名前とやり直し', () => {
  const ai = toTaskError('doyaslide', { status: 502, data: { error: '構成の生成に失敗しました。' } }, 'x')
  assert.equal(ai.cause, 'ai_failed')
  assert.deepEqual(kinds(ai), ['retry'])
  const srv = toTaskError('quote', { status: 500, data: {} }, 'x')
  assert.equal(srv.cause, 'server_error')
  assert.deepEqual(kinds(srv), ['retry'])
  const conflict = toTaskError('quote', { status: 409, data: {} }, 'x')
  assert.equal(conflict.kind, 'input')
  assert.deepEqual(kinds(conflict), ['retry'])
  // 入力の誤り（400）は、そのままのやり直しを出さない
  assert.deepEqual(kinds(toTaskError('quote', { status: 400, data: {} }, 'x')), [])
})

test('失敗の行 外のサイトへの upgradeUrl（//evil）は使わない', () => {
  const e = toTaskError('quote', { status: 402, data: { code: 'LIMIT_REACHED', upgradeUrl: '//evil.example/x' } }, 'x')
  assert.equal(e.href, undefined)
  assert.deepEqual(kinds(e), [])
})

/** 呼ばれたルートと本文を記録しつつ、決めた答えを返す差し替え */
function deps(handler: (route: ToolRouteId, body: Record<string, unknown>) => ToolCallResult) {
  const calls: { route: ToolRouteId; body: Record<string, unknown> }[] = []
  const d: ToolDeps = { shodanSlug: async () => 'acme', call: async (route, body) => { calls.push({ route, body }); return handler(route, body) } }
  return { d, calls }
}
const researched = (diagnostics: Record<string, unknown>, extra: Record<string, unknown> = {}) => (): ToolCallResult => ({ status: 200, data: { id: 'prep_1', research: { companyName: '例商事', description: '説明です。', diagnostics, ...extra } } })

test('失敗の行 S21 会社名を入れてやり直す: resume の companyName を shodan.prepare に渡す', async () => {
  const { d, calls } = deps(researched({ companyNameFrom: 'input', homepage: { ok: false, reason: 'dns' } }))
  await runSalesPrepTask('research', answers(), d, { companyName: '株式会社例' })
  assert.equal(calls[0].route, 'shodan.prepare')
  assert.equal(calls[0].body.companyName, '株式会社例')
  // 会社名が無い・長すぎるときは渡さない
  const none = deps(researched({}))
  await runSalesPrepTask('research', answers(), none.d, { companyName: '  ' })
  assert.ok(!('companyName' in none.calls[0].body))
})

test('失敗の行 S21・S12・S20 結果に、どう調べたかの一文を添える', async () => {
  const a = answers()
  const byInput = await runSalesPrepTask('research', a, deps(researched({ companyNameFrom: 'input', homepage: { ok: false, reason: 'dns' } })).d)
  assert.ok(byInput.points.includes('サイトは読めなかったため、入力した会社名で調べました。'))
  const summary = await runSalesPrepTask('research', a, deps(researched({ usedPageSummary: true, homepage: { ok: true }, aiExtracted: true })).d)
  assert.ok(summary.points.some((p) => p.includes('ページの題と説明から読み取りました')))
  const noAi = await runSalesPrepTask('research', a, deps(researched({ aiExtracted: false, homepage: { ok: true } })).d)
  assert.ok(noAi.points.some((p) => p.includes('分かった範囲でまとめています')))
  // AI の答えが無くても、サイトが読めていなければ「分かった範囲」の文は出さない
  const failedSite = await runSalesPrepTask('research', a, deps(researched({ aiExtracted: false, homepage: { ok: false, reason: 'dns' } })).d)
  assert.ok(!failedSite.points.some((p) => p.includes('分かった範囲でまとめています')))
})

const okResult = (id: string): AgentTaskResult => ({ summary: id, points: [], href: `/${id}`, hrefLabel: id })

test('失敗の行 runner: AgentTaskError の cause と actions を状態に残す', async () => {
  const actions = [{ kind: 'input' as const, label: '会社名で調べ直す', field: 'companyName' as const, placeholder: '例' }, { kind: 'retry' as const, label: 'やり直す' }]
  const out = await runAgentTasks({
    tasks: [{ id: 'a' }],
    execute: async () => { throw new AgentTaskError('応答しませんでした。', 'input').withHelp('timeout', actions) },
  })
  assert.equal(out.a.status, 'failed')
  assert.equal(out.a.failure?.cause, 'timeout')
  assert.deepEqual(out.a.failure?.actions, actions)
  assert.equal(out.a.failure?.kind, 'input')
})

test('失敗の行 runner: 知らない例外は cause unknown とやり直しの道', async () => {
  const out = await runAgentTasks({ tasks: [{ id: 'a' }], execute: async () => { throw new Error('boom: secret detail') } })
  assert.equal(out.a.status, 'failed')
  assert.equal(out.a.failure?.cause, 'unknown')
  assert.deepEqual(out.a.failure?.actions, [{ kind: 'retry', label: 'やり直す' }])
  // 内部の文は見せない
  assert.ok(!out.a.error?.includes('boom'))
})

test('失敗の行 view: 次の一手が無い失敗（前の作業が済まなかった・止めた）は、やり直すだけを出す', async () => {
  const task = { id: 'a', stages: ['読む', '考える', 'まとめる'] }
  const blocked = todoViewOf(task, { id: 'a', status: 'blocked', attempts: 0, error: '前の作業が終わらなかったため、まだ動かしていません。' })
  assert.equal(blocked.status, 'failed')
  assert.deepEqual(blocked.error?.actions, [{ kind: 'retry', label: 'やり直す' }])
  const canceled = todoViewOf(task, { id: 'a', status: 'canceled', attempts: 1, error: '止めました。' })
  assert.deepEqual(canceled.error?.actions, [{ kind: 'retry', label: 'やり直す' }])
  // 次の一手があるときは、それをそのまま使う
  const actions = [{ kind: 'href' as const, label: '料金プランを見る', href: '/pricing' }]
  const failed = todoViewOf(task, { id: 'a', status: 'failed', attempts: 1, failure: { kind: 'limit', cause: 'limit', actions } })
  assert.deepEqual(failed.error?.actions, actions)
  assert.equal(failed.error?.cause, 'limit')
  // 済んだ作業の結果は影響を受けない
  assert.equal(todoViewOf(task, { id: 'a', status: 'done', attempts: 1, result: okResult('a') }).status, 'done')
})
