// 実行: npx tsx --test src/lib/agent-orchestration/runner.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AgentTaskError, progressOf, runAgentTasks, runningCount, validateTasks, type AgentStates, type AgentTaskResult } from './runner'

const ok = (id: string): AgentTaskResult => ({ summary: id, points: [], href: `/${id}`, hrefLabel: id })
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('依存の無い作業は同時に動き、同時に動く数は上限まで', async () => {
  let peak = 0
  const seen: AgentStates[] = []
  const tasks = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
  const out = await runAgentTasks({
    tasks,
    concurrency: 3,
    execute: async (t) => { await wait(15); return ok(t.id) },
    onChange: (s) => { seen.push(s); peak = Math.max(peak, runningCount(s)) },
  })
  assert.equal(peak, 3)
  assert.deepEqual(Object.values(out).map((s) => s.status), ['done', 'done', 'done', 'done'])
  assert.equal(progressOf(out).finished, true)
})

test('前の作業の結果を、あとの作業に渡す', async () => {
  const order: string[] = []
  const out = await runAgentTasks({
    tasks: [{ id: 'persona' }, { id: 'copy', dependsOn: ['persona'] }, { id: 'seo', dependsOn: ['persona'] }],
    execute: async (t, { upstream }) => {
      order.push(t.id)
      if (t.id !== 'persona') assert.equal(upstream.persona.summary, 'persona')
      return ok(t.id)
    },
  })
  assert.equal(order[0], 'persona')
  assert.equal(out.copy.status, 'done')
})

test('失敗した作業と、それに頼る作業だけが残り、やり直すと済んだ作業は動かさない', async () => {
  const calls: string[] = []
  let failOnce = true
  const tasks = [{ id: 'a' }, { id: 'b' }, { id: 'c', dependsOn: ['b'] }]
  const execute = async (t: { id: string }) => {
    calls.push(t.id)
    if (t.id === 'b' && failOnce) throw new AgentTaskError('きょうの上限に達しました。', 'limit')
    return ok(t.id)
  }
  const first = await runAgentTasks({ tasks, execute })
  assert.equal(first.a.status, 'done')
  assert.equal(first.b.status, 'failed')
  assert.equal(first.b.error, 'きょうの上限に達しました。')
  assert.equal(first.c.status, 'blocked')
  failOnce = false
  calls.length = 0
  const second = await runAgentTasks({ tasks, execute, prev: first })
  assert.deepEqual(calls, ['b', 'c'])
  assert.equal(second.a.attempts, 1)
  assert.equal(second.b.attempts, 2)
  assert.equal(second.c.status, 'done')
})

test('内部の失敗の文は利用者に見せない', async () => {
  const out = await runAgentTasks({ tasks: [{ id: 'a' }], execute: async () => { throw new Error('500 Internal: prisma.x') } })
  assert.equal(out.a.error, 'うまく作れませんでした。もう一度お試しください。')
})

test('中断すると、まだ始めていない作業は止まり、動いている作業には signal が届く', async () => {
  const ctrl = new AbortController()
  let gotAbort = false
  const p = runAgentTasks({
    tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    concurrency: 1,
    signal: ctrl.signal,
    execute: (t, { signal }) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(ok(t.id)), 200)
      signal.addEventListener('abort', () => { gotAbort = true; clearTimeout(timer); reject(Object.assign(new Error('x'), { name: 'AbortError' })) })
    }),
  })
  await wait(10)
  ctrl.abort()
  const out = await p
  assert.equal(gotAbort, true)
  assert.deepEqual(Object.values(out).map((s) => s.status), ['canceled', 'canceled', 'canceled'])
})

test('依存の決まりの誤りを見つける', () => {
  assert.equal(validateTasks([{ id: 'a', dependsOn: ['x'] }]), 'unknown dependency: x')
  assert.equal(validateTasks([{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: ['a'] }]), 'cycle')
  assert.equal(validateTasks([{ id: 'a' }, { id: 'a' }]), 'duplicate id')
  assert.equal(validateTasks([{ id: 'a' }, { id: 'b', dependsOn: ['a'] }]), null)
})
