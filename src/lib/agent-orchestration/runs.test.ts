// 実行: npx tsx --test src/lib/agent-orchestration/runs.test.ts
// 実行の記録（メモリの上の表）・失敗したときの戻し・同時の上限を、ツールとドヤパワーの台帳を差し替えて確かめる
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SALES_PREP, parseSalesPrepAnswers, type SalesPrepAnswers } from './recipes'
import { planFromRecipe } from './plan'
import { createMemoryRunRepo, createRun, latestOpenRun, runStoredTask, runViewOf, statesOfRun, STALE_MS } from './runs'
import { AGENT_MAX_CONCURRENT, BUSY_MESSAGE, createLimiter } from './execute'
import { AgentTaskError, runAgentTasks } from './runner'
import { fakeToolDeps, runSalesPrepTask, type SalesPrepTaskId, type ToolDeps, type ToolRouteId } from './tools'

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

test('見積の案はできて保存だけ失敗した: 減ったドヤパワーは戻さず、案を残して、やり直しは AI を呼ばずに保存だけ行う', async () => {
  const calls: ToolRouteId[] = []
  let failCreate = true
  const base = fakeToolDeps({ delayMs: 0, powerOn: true })
  const deps: ToolDeps = { ...base, call: async (route, body) => {
    calls.push(route)
    if (route === 'quote.create' && failCreate) return { status: 402, data: { error: '無料プランは3件までです。', code: 'LIMIT_REACHED' } }
    return base.call(route, body)
  } }
  const { repo, run } = await newRun(['quote'])
  const exec = (c: { answers: Record<string, string>; resume?: Record<string, string> }) => runSalesPrepTask('quote', a, deps, c.resume)
  await assert.rejects(runStoredTask(repo, { userId: U, runId: run.id, taskId: 'quote' }, exec), (e: AgentTaskError) => {
    assert.equal(e.kind, 'limit')
    // 品目の案の AI は使った（1 減った）。戻さない
    assert.deepEqual(e.power, { used: 1, refunded: 0 })
    return true
  })
  const t = repo.tasks.find((x) => x.taskId === 'quote')!
  assert.deepEqual([t.powerUsed, t.powerRefunded], [1, 0])
  const draft = JSON.parse(t.resume!.quoteDraft)
  assert.equal(draft.length, 3)
  assert.equal(draft[0].itemName, '要件の整理と設計')
  // やり直し: 品目の案（AI）は呼ばず、保存だけ
  failCreate = false
  calls.length = 0
  const r = await runStoredTask(repo, { userId: U, runId: run.id, taskId: 'quote' }, exec)
  assert.deepEqual(calls, ['quote.create'])
  assert.equal(r.href, '/quote/documents/quote_sample')
  assert.deepEqual(r.power, { used: 0, refunded: 0 })
  assert.deepEqual([t.powerUsed, t.powerRefunded, t.attempts], [1, 0, 2])
})

test('残した品目の案は、もう一度整えてから保存に使う（壊れた案・大きすぎる案は使わず、AI で作り直す）', async () => {
  const seen: Record<string, unknown>[] = []
  const base = fakeToolDeps({ delayMs: 0 })
  const deps: ToolDeps = { ...base, call: async (route, body) => { if (route === 'quote.create') seen.push(body); return base.call(route, body) } }
  const long = 'x'.repeat(5000)
  const r = await runSalesPrepTask('quote', a, deps, { quoteDraft: JSON.stringify([{ itemName: '手作業', spec: long, qty: -3, unitPrice: 1e15, taxRate: 99, unit: 'あいうえおかきくけこさしすせそ' }]) })
  assert.ok(r.href)
  const item = (seen[0].items as Record<string, unknown>[])[0]
  assert.equal((item.spec as string).length, 300)
  assert.deepEqual([item.qty, item.unitPrice, item.taxRate, (item.unit as string).length], [1, 1_000_000_000, 10, 12])
  // 壊れた JSON なら、案を使わずに AI で作り直す
  const calls: string[] = []
  await runSalesPrepTask('quote', a, { ...base, call: async (route, body) => { calls.push(route); return base.call(route, body) } }, { quoteDraft: '{broken' })
  assert.deepEqual(calls, ['quote.suggest', 'quote.create'])
})

test('AI の生成そのものが失敗したときは、包み（ルート）が戻した分が refunded に入る（ここでは戻しを足さない）', async () => {
  await assert.rejects(runSalesPrepTask('slides', a, fakeToolDeps({ delayMs: 0, powerOn: true, failSlidesOnce: { done: false } })), (e: AgentTaskError) => {
    assert.deepEqual(e.power, { used: 0, refunded: 30 })
    return true
  })
})

test('同時の上限は、取ったあとにもう一度数え、超えていたら取る前に戻す（数えるのと取るのが同時に来ても、上限を超えて動かない）', async () => {
  const repo = createMemoryRunRepo()
  const runs = await Promise.all([1, 2].map(() => createRun(repo, { userId: U, recipeId: 'sales-prep', title: 't', request: null, answers, plan, delegate: ['research', 'quote', 'slides'] })))
  // 2つは動いている。数えたときは2つだったが、取るまでのあいだに、ほかの呼び出しがもう1つ取った、という順をまねる
  const mine = repo.tasks.filter((x) => x.runId === runs[0].id)
  for (const t of mine.slice(0, 2)) Object.assign(t, { status: 'running', startedAt: new Date() })
  const realCount = repo.countRunning.bind(repo)
  let first = true
  repo.countRunning = async (u, s) => {
    const n = await realCount(u, s)
    if (first) { first = false; Object.assign(mine[2], { status: 'running', startedAt: new Date() }) }
    return n
  }
  const target = repo.tasks.find((x) => x.runId === runs[1].id && x.taskId === 'quote')!
  await assert.rejects(runStoredTask(repo, { userId: U, runId: runs[1].id, taskId: 'quote' }, execOk('quote')), (e: AgentTaskError) => e.userMessage === BUSY_MESSAGE)
  assert.deepEqual([target.status, target.attempts, target.startedAt], ['waiting', 0, null], '取る前の状態に戻す')
  assert.equal(repo.tasks.filter((x) => x.status === 'running').length, AGENT_MAX_CONCURRENT)
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

// 2026-10-26 統括の指摘: 関数の時間の上限で止められると catch が走らず、作ったスライドの ID が表に残らなかった
test('途中の checkpoint は表に残り、止められたあとのやり直し（6分後に取り直す）で使われる', async () => {
  const { repo, run } = await newRun()
  let t0 = new Date('2026-10-26T03:00:00Z')
  const now = () => t0
  const made: string[] = []
  const deps = (structure: 'hang' | 'ok'): ToolDeps => ({
    ...fakeToolDeps({ delayMs: 0 }),
    slideStructureWaitMs: 300,
    call: async (route: ToolRouteId, body: Record<string, unknown>) => {
      if (route === 'slide.project') { made.push('p' + (made.length + 1)); return { status: 201, data: { project: { id: made.at(-1) } } } }
      if (route === 'slide.structure') return structure === 'hang' ? new Promise(() => {}) : { status: 200, data: { slides: [{ headline: String(body.projectId) }] } }
      return { status: 500, data: {} }
    },
  })
  const exec = (structure: 'hang' | 'ok') => async ({ answers: ans, resume, checkpoint }: { answers: Record<string, string>; resume?: Record<string, string>; checkpoint: (r: Record<string, string>) => Promise<void> }) => {
    const p = parseSalesPrepAnswers(ans)
    assert.ok(p.ok)
    return runSalesPrepTask('slides', (p as { value: SalesPrepAnswers }).value, { ...deps(structure), checkpoint }, resume)
  }
  // 1回目: 構成の途中で止められた（runStoredTask は終わらない）
  const first = runStoredTask(repo, { userId: U, runId: run.id, taskId: 'slides', now }, exec('hang')).catch(() => null)
  await new Promise((r) => setTimeout(r, 10))
  const task = repo.tasks.find((x) => x.taskId === 'slides')!
  assert.equal(task.status, 'running')
  assert.deepEqual(task.resume, { projectId: 'p1' })
  // 動いている間は、取り直せない
  await assert.rejects(runStoredTask(repo, { userId: U, runId: run.id, taskId: 'slides', now }, exec('ok')), /いま動いています/)
  // 6分たったら取り直し、残った ID のスライドで構成を作る（新しく作らない）
  t0 = new Date(t0.getTime() + STALE_MS + 1000)
  const r = await runStoredTask(repo, { userId: U, runId: run.id, taskId: 'slides', now }, exec('ok'))
  assert.equal(r.href, '/doyaslide/p1')
  assert.deepEqual(made, ['p1'])
  assert.equal(task.status, 'done')
  assert.equal(task.resume, null)
  // 古い試みがあとから終わっても、済んだ ToDo を書き換えない
  await first
  assert.equal(task.status, 'done')
})

test('checkpoint は、自分が取った ToDo にだけ書く（取り直されたあとの古い試みは書かない）', async () => {
  const { repo, run } = await newRun()
  const task = repo.tasks.find((x) => x.taskId === 'slides')!
  Object.assign(task, { status: 'running', startedAt: new Date('2026-10-26T03:10:00Z') })
  await repo.saveResume(U, run.id, 'slides', new Date('2026-10-26T03:00:00Z'), { projectId: 'old' })
  assert.equal(task.resume ?? null, null)
  await repo.saveResume('u_2', run.id, 'slides', new Date('2026-10-26T03:10:00Z'), { projectId: 'x' })
  assert.equal(task.resume ?? null, null)
  await repo.saveResume(U, run.id, 'slides', new Date('2026-10-26T03:10:00Z'), { projectId: 'p9' })
  assert.deepEqual(task.resume, { projectId: 'p9' })
})

test('結果は、自分が取った試みにだけ書く（6分たって取り直されたあとに古い試みが終わっても、新しい試みを書き換えない）', async () => {
  const { repo, run } = await newRun()
  const task = repo.tasks.find((x) => x.taskId === 'slides')!
  const newer = new Date('2026-10-26T03:10:00Z')
  Object.assign(task, { status: 'running', startedAt: newer })
  await repo.finishTask(U, run.id, 'slides', new Date('2026-10-26T03:00:00Z'), { status: 'failed', error: '古い試み' })
  assert.equal(task.status, 'running')
  assert.equal(task.error ?? null, null)
  await repo.finishTask(U, run.id, 'slides', newer, { status: 'done' })
  assert.equal(task.status, 'done')
})
