// 実行: npx tsx --test src/lib/agent-orchestration/runs.test.ts
// 実行の記録（メモリの上の表）・失敗したときの戻し・同時の上限を、ツールとドヤパワーの台帳を差し替えて確かめる
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SALES_PREP, parseSalesPrepAnswers, type SalesPrepAnswers } from './recipes'
import { planFromRecipe } from './plan'
import { createMemoryRunRepo, createRun, latestOpenRun, runStoredTask, runViewOf, statesOfRun, STALE_MS } from './runs'
import { AGENT_MAX_CONCURRENT, BUSY_MESSAGE, createLimiter, executeSalesPrepTask } from './execute'
import { AgentTaskError, runAgentTasks, type AgentCharge } from './runner'
import { fakeToolDeps, runSalesPrepTask, type SalesPrepTaskId, type ToolDeps } from './tools'

const answers = { url: 'https://example.co.jp', offer: 'web', budget: '50to200', stage: 'proposal' }
const a = (() => { const p = parseSalesPrepAnswers(answers); assert.ok(p.ok); return p.value as SalesPrepAnswers })()
const plan = planFromRecipe(SALES_PREP, a)
const U = 'u_1'

const newRun = async (delegate = ['research', 'quote', 'slides'], repo = createMemoryRunRepo()) => {
  const run = await createRun(repo, { userId: U, recipeId: 'sales-prep', title: SALES_PREP.title, request: '商談の準備', answers, plan, delegate })
  return { repo, run }
}
const execOk = (taskId: SalesPrepTaskId) => async ({ answers: ans, resume }: { answers: Record<string, string>; resume?: Record<string, string> }) => {
  const p = parseSalesPrepAnswers(ans)
  assert.ok(p.ok)
  return runSalesPrepTask(taskId, (p as { value: SalesPrepAnswers }).value, fakeToolDeps({ delayMs: 0, powerOn: true }), resume)
}

test('作戦を保存する: 任せない ToDo は skipped で動かさない。1つも任せないなら断る', async () => {
  const { repo, run } = await newRun(['quote', 'slides', 'nope'])
  assert.deepEqual(run.delegated, ['quote', 'slides'])
  assert.deepEqual(run.remaining, ['quote', 'slides'])
  assert.equal(run.status, 'planned')
  assert.equal(repo.tasks.find((t) => t.taskId === 'research')?.status, 'skipped')
  await assert.rejects(runStoredTask(repo, { userId: U, runId: run.id, taskId: 'research' }, execOk('research')), /任せていません/)
  await assert.rejects(newRun([]), /1つ以上/)
})

test('始められない ToDo（組織が無い）は、任せても動かさない', async () => {
  const p = planFromRecipe(SALES_PREP, a, { readiness: { quote: { ok: false, reason: '無い', href: '/quote' } } })
  const repo = createMemoryRunRepo()
  const run = await createRun(repo, { userId: U, recipeId: 'sales-prep', title: 't', request: null, answers, plan: p, delegate: ['quote', 'slides'] })
  assert.deepEqual(run.delegated, ['slides'])
})

test('他人の実行は読めず、動かせない', async () => {
  const { repo, run } = await newRun()
  assert.equal(await repo.getRun('u_2', run.id), null)
  await assert.rejects(runStoredTask(repo, { userId: 'u_2', runId: run.id, taskId: 'quote' }, execOk('quote')), /見つかりませんでした/)
  assert.equal(await latestOpenRun(repo, 'u_2'), null)
})

test('ToDo を動かすと、結果・ドヤパワー・状態が表に残り、済んだ ToDo は動かし直さない', async () => {
  const { repo, run } = await newRun()
  const r = await runStoredTask(repo, { userId: U, runId: run.id, taskId: 'slides' }, execOk('slides'))
  assert.equal(r.href, '/doyaslide/slide_sample')
  const t = repo.tasks.find((x) => x.taskId === 'slides')!
  assert.deepEqual([t.status, t.attempts, t.powerUsed, t.powerRefunded], ['done', 1, 30, 0])
  assert.equal(repo.runs[0].status, 'partial')
  assert.equal(repo.runs[0].powerUsed, 30)
  let called = 0
  await runStoredTask(repo, { userId: U, runId: run.id, taskId: 'slides' }, async () => { called++; throw new Error('x') })
  assert.equal(called, 0)
})

test('同じ ToDo は同時に2回動かさない。止まった running は取り直せる', async () => {
  const { repo, run } = await newRun()
  let release!: () => void
  const slow = new Promise<void>((r) => { release = r })
  const first = runStoredTask(repo, { userId: U, runId: run.id, taskId: 'quote' }, async (c) => { await slow; return execOk('quote')(c) })
  await new Promise((r) => setTimeout(r, 5))
  await assert.rejects(runStoredTask(repo, { userId: U, runId: run.id, taskId: 'quote' }, execOk('quote')), /いま動いています/)
  release()
  await first
  // 止まった running（STALE_MS より古い）は失敗として見せ、取り直せる
  const { repo: r2, run: run2 } = await newRun()
  const t = r2.tasks.find((x) => x.taskId === 'research')!
  Object.assign(t, { status: 'running', attempts: 1, startedAt: new Date(Date.now() - STALE_MS - 1000) })
  assert.equal(statesOfRun(r2.tasks).research.status, 'failed')
  await runStoredTask(r2, { userId: U, runId: run2.id, taskId: 'research' }, execOk('research'))
  assert.equal(t.status, 'done')
  assert.equal(t.attempts, 2)
})

test(`本人ごとに、同時に動かせるのは ${AGENT_MAX_CONCURRENT} つまで`, async () => {
  const repo = createMemoryRunRepo()
  const runs = await Promise.all([1, 2].map(() => createRun(repo, { userId: U, recipeId: 'sales-prep', title: 't', request: null, answers, plan, delegate: ['research', 'quote', 'slides'] })))
  for (const t of repo.tasks.filter((x) => x.runId === runs[0].id)) Object.assign(t, { status: 'running', startedAt: new Date() })
  await assert.rejects(runStoredTask(repo, { userId: U, runId: runs[1].id, taskId: 'quote' }, execOk('quote')), (e: AgentTaskError) => e.userMessage === BUSY_MESSAGE && e.kind === 'limit')
  // 他人の分は数えない
  const other = await createRun(repo, { userId: 'u_2', recipeId: 'sales-prep', title: 't', request: null, answers, plan, delegate: ['quote'] })
  await runStoredTask(repo, { userId: 'u_2', runId: other.id, taskId: 'quote' }, execOk('quote'))
})

test('前の ToDo（after）が済むまで動かさない', async () => {
  const p = { ...plan, pillars: plan.pillars.map((x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === 'slides' ? { ...t, after: ['research'] } : t)) })) }
  const repo = createMemoryRunRepo()
  const run = await createRun(repo, { userId: U, recipeId: 'sales-prep', title: 't', request: null, answers, plan: p, delegate: ['research', 'slides'] })
  await assert.rejects(runStoredTask(repo, { userId: U, runId: run.id, taskId: 'slides' }, execOk('slides')), /前の ToDo/)
  await runStoredTask(repo, { userId: U, runId: run.id, taskId: 'research' }, execOk('research'))
  await runStoredTask(repo, { userId: U, runId: run.id, taskId: 'slides' }, execOk('slides'))
})

test('続きを進める: 失敗した ToDo と、まだの ToDo だけが残り、画面の runner で残りだけを動かせる', async () => {
  const { repo, run } = await newRun()
  await runStoredTask(repo, { userId: U, runId: run.id, taskId: 'research' }, execOk('research'))
  // スライドは構成で失敗（プロジェクトは作れた）→ resume が残る
  await assert.rejects(runStoredTask(repo, { userId: U, runId: run.id, taskId: 'slides' }, async () => { throw new AgentTaskError('構成の生成に失敗しました。', 'tool', { projectId: 'p_1' }, undefined, { used: 0, refunded: 30 }) }))
  const open = await latestOpenRun(repo, U)
  assert.ok(open)
  assert.deepEqual(open!.remaining, ['quote', 'slides'])
  assert.equal(open!.status, 'partial')
  assert.deepEqual(open!.states.slides.resume, { projectId: 'p_1' })
  assert.deepEqual(open!.power, { used: 0, refunded: 30 })
  // 画面の runner に prev として渡すと、済んだ research は動かさない
  const ran: string[] = []
  const tasks = SALES_PREP.tasks.filter((t) => open!.delegated.includes(t.id))
  const out = await runAgentTasks({
    tasks, prev: open!.states,
    execute: async (t, ctx) => { ran.push(`${t.id}:${ctx.resume?.projectId ?? ''}`); return runStoredTask(repo, { userId: U, runId: run.id, taskId: t.id }, execOk(t.id as SalesPrepTaskId)) },
  })
  assert.deepEqual(ran.sort(), ['quote:', 'slides:p_1'])
  assert.equal(out.slides.status, 'done')
  // slides の power は試みごとに足す（1回目で戻した 30、2回目で減った 30）
  assert.deepEqual(statesOfRun(repo.tasks).slides.power, { used: 30, refunded: 30 })
  assert.equal(await latestOpenRun(repo, U), null)
  assert.equal(runViewOf(repo.runs[0], repo.tasks).status, 'done')
})

test('失敗したら、その ToDo で減ったままのドヤパワーを戻す（見積の案は作れたが、保存で失敗した）', async () => {
  const deps: ToolDeps = fakeToolDeps({ delayMs: 0, powerOn: true })
  const base = deps.call
  deps.call = async (route, body) => (route === 'quote.create' ? { status: 402, data: { error: '無料プランは3件までです。', code: 'LIMIT_REACHED' } } : base(route, body))
  const refunded: AgentCharge[][] = []
  await assert.rejects(executeSalesPrepTask('quote', a, { tools: deps, refund: async (c) => { refunded.push(c); return c.reduce((n, x) => n + x.amount, 0) } }), (e: AgentTaskError) => {
    assert.equal(e.kind, 'limit')
    assert.deepEqual(e.power, { used: 0, refunded: 1 })
    assert.equal(e.charges, undefined, '減ったままの操作の中身は画面に返さない')
    return true
  })
  assert.deepEqual(refunded, [[{ route: 'quote.suggest', action: 'text.generate', opKey: 'op-quote.suggest', amount: 1 }]])
  // 戻せなかった（台帳が戻し済みなど）ときは、量を変えない
  await assert.rejects(executeSalesPrepTask('quote', a, { tools: deps, refund: async () => 0 }), (e: AgentTaskError) => { assert.deepEqual(e.power, { used: 1, refunded: 0 }); return true })
  // 包みが自分で戻した失敗（構成の失敗）は、減ったままの操作が無いので、戻しを呼ばない
  let calls = 0
  await assert.rejects(executeSalesPrepTask('slides', a, { tools: fakeToolDeps({ delayMs: 0, powerOn: true, failSlidesOnce: { done: false } }), refund: async () => { calls++; return 0 } }))
  assert.equal(calls, 0)
  // 成功したときは戻さない
  const ok = await executeSalesPrepTask('quote', a, { tools: fakeToolDeps({ delayMs: 0, powerOn: true }), refund: async () => { throw new Error('呼ばれない') } })
  assert.deepEqual(ok.power, { used: 1, refunded: 0 })
})

test('このサーバーの中の同時の上限: 本人ごとに数え、終わったら空く', () => {
  const lim = createLimiter(2)
  const r1 = lim.acquire('a')!
  const r2 = lim.acquire('a')!
  assert.equal(lim.acquire('a'), null)
  assert.ok(lim.acquire('b'))
  r1(); r1()
  assert.equal(lim.count('a'), 1)
  assert.ok(lim.acquire('a'))
  r2()
})
