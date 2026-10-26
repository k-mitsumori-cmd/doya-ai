// 実行: npx tsx --test src/lib/agent-orchestration/plan.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SALES_PREP, parseSalesPrepAnswers, type SalesPrepAnswers } from './recipes'
import { ACTION_CATALOG, actionPower, planFromRecipe, planTasks, sanitizeAiPlan } from './plan'
import { DOYA_POWER_COSTS } from '@/lib/doya-power/costs'
import { readSources } from './sources'
import { STAGE_MS, todoCounts, todoViewOf } from './view'

const a = (() => {
  const p = parseSalesPrepAnswers({ url: 'https://example.co.jp', offer: 'ads', budget: 'u50', stage: 'first' })
  assert.ok(p.ok)
  return p.value as SalesPrepAnswers
})()

test('組み合わせから作戦を作る: 柱ごとのタスク・減るドヤパワー・同時に動かす数', () => {
  const plan = planFromRecipe(SALES_PREP, a)
  assert.equal(plan.version, 2)
  assert.equal(plan.source, 'recipe')
  assert.deepEqual(plan.pillars.map((p) => p.name), ['相手を知る', '条件を示す', '提案を形にする'])
  const tasks = planTasks(plan)
  assert.deepEqual(tasks.map((t) => t.id), ['research', 'quote', 'slides'])
  assert.deepEqual(tasks.map((t) => t.power), [0, DOYA_POWER_COSTS['text.generate'], DOYA_POWER_COSTS['slide.generate']])
  assert.equal(plan.totalPower, DOYA_POWER_COSTS['text.generate'] + DOYA_POWER_COSTS['slide.generate'])
  assert.equal(plan.concurrency, 3)
  assert.match(plan.goal.statement, /example\.co\.jp/)
  assert.deepEqual([plan.goal.now, plan.goal.target, plan.goal.gap, plan.goal.unit], [0, 3, 3, '点'])
  assert.ok(plan.reasons.length >= 3)
  assert.ok(plan.pillars.every((p) => p.teamGoal.length > 0))
  assert.ok(tasks.every((t) => t.delegable && t.delegate && t.ready.ok))
  assert.equal(tasks[2].title, '提案スライドの構成を作る（6枚）')
  assert.ok(tasks.every((t) => t.stages.at(-1)?.endsWith('仕上げています')))
})

test('操作の表の減る量は costs.ts から引く（数をほかに書かない）', () => {
  for (const [action, c] of Object.entries(ACTION_CATALOG)) {
    assert.equal(actionPower(action as keyof typeof ACTION_CATALOG), c.powerAction ? DOYA_POWER_COSTS[c.powerAction] : 0)
  }
})

test('AI の作戦を検査する: 表に無い操作・自分への順番・知らない順番を捨て、減る量は表から計算する', () => {
  const plan = sanitizeAiPlan({
    goal: '商談の準備',
    period: '今日',
    pillars: [
      { id: 'a', name: '相手を知る', tasks: [
        { id: 'r', action: 'shodan.research', title: '会社を調べる', power: 0 },
        { id: 'x', action: 'email.send', title: 'メールを送る' },
        { id: 'q', action: 'quote.draft', title: '見積の下書き', after: ['r', 'q', 'nope'], power: 999 },
      ] },
      { id: 'b', name: '空の柱', tasks: [{ action: 'banner.generate', title: '表に無い' }] },
    ],
  })
  assert.ok(plan)
  assert.equal(plan!.pillars.length, 1)
  const tasks = planTasks(plan!)
  assert.deepEqual(tasks.map((t) => t.id), ['r', 'q'])
  assert.deepEqual(tasks[1].after, ['r'])
  assert.equal(tasks[1].power, DOYA_POWER_COSTS['text.generate'])
  assert.equal(plan!.totalPower, DOYA_POWER_COSTS['text.generate'])
})

test('AI の作戦の循環は、順番を外して同時に動かす。タスクが無ければ null', () => {
  const plan = sanitizeAiPlan({ pillars: [{ tasks: [
    { id: 'a', action: 'quote.draft', title: 'A', after: ['b'] },
    { id: 'b', action: 'slide.structure', title: 'B', after: ['a'] },
  ] }] })
  assert.deepEqual(planTasks(plan!).map((t) => t.after), [[], []])
  assert.equal(sanitizeAiPlan({ pillars: [{ tasks: [{ action: 'x', title: 'y' }] }] }), null)
  assert.equal(sanitizeAiPlan('not json'), null)
  // タスクの数に上限を付ける
  const many = sanitizeAiPlan({ pillars: [{ tasks: Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, action: 'quote.draft', title: `T${i}` })) }] }, { maxTasks: 5 })
  assert.equal(planTasks(many!).length, 5)
})

test('ツールの組織が無いと、その ToDo は任せない初期値にし、理由と先にする画面を付ける。合計は任せる ToDo だけ', () => {
  const plan = planFromRecipe(SALES_PREP, a, { readiness: { quote: { ok: false, reason: '無い', href: '/quote', hrefLabel: '開く' } } })
  const q = planTasks(plan).find((t) => t.id === 'quote')!
  assert.equal(q.delegate, false)
  assert.equal(q.ready.href, '/quote')
  assert.equal(plan.totalPower, DOYA_POWER_COSTS['slide.generate'])
  assert.ok(plan.reasons.some((r) => r.includes('ドヤ見積もりAI') && r.includes('組織')))
})

test('分析の材料を同時に読み、読み始め→読み終わりを読み終えた順に知らせる。読めない材料は skipped で、作戦は止めない', async () => {
  const events: string[] = []
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const res = await readSources(a, {
    company: async () => { await wait(20); return 'サンプル株式会社' },
    toolOrgs: async () => { await wait(5); return { shodan: false, quote: true } },
    power: async () => { throw new Error('boom') },
  }, (s) => events.push(`${s.id}:${s.status}`))
  assert.deepEqual(events.slice(0, 4), ['request:reading', 'company:reading', 'tools:reading', 'power:reading'])
  const reads = events.slice(4)
  assert.ok(reads.indexOf('tools:read') < reads.indexOf('company:read'), '早く読み終えた材料から先に知らせる')
  assert.ok(reads.includes('power:skipped'))
  assert.deepEqual(res.sources.map((s) => s.id), ['request', 'company', 'tools', 'power'])
  assert.equal(res.companyName, 'サンプル株式会社')
  assert.equal(res.readiness.shodan.href, '/shodan')
  assert.equal(res.readiness.quote, undefined)
  assert.equal(res.power.enabled, false)
})

test('ToDo の状態を画面の4つに寄せる（待つ・進む・できた・失敗した）', () => {
  const t = { id: 'x', stages: ['a', 'b', '仕上げています'] }
  assert.equal(todoViewOf(t, undefined).status, 'waiting')
  assert.equal(todoViewOf(t, { id: 'x', status: 'running', attempts: 1, startedAt: 0 }, STAGE_MS * 1.5).stage, 1)
  assert.equal(todoViewOf(t, { id: 'x', status: 'running', attempts: 1, startedAt: 0 }, STAGE_MS * 99).stage, 2)
  const done = todoViewOf(t, { id: 'x', status: 'done', attempts: 1, power: { used: 30, refunded: 0 }, result: { summary: 's', points: [], href: '/d', hrefLabel: '開く' } })
  assert.equal(done.draft?.href, '/d')
  for (const status of ['failed', 'blocked', 'canceled'] as const) {
    const v = todoViewOf(t, { id: 'x', status, attempts: 1, error: 'e', failure: { kind: 'limit' }, power: { used: 0, refunded: 30 } })
    assert.equal(v.status, 'failed')
    assert.equal(v.retryable, true)
  }
  assert.equal(done.powerKnown, true)
  // 答えが届かなかった（通信が切れた）ときは、量が分からない
  assert.equal(todoViewOf(t, { id: 'x', status: 'failed', attempts: 1, error: 'e' }).powerKnown, false)
  const c = todoCounts([done, todoViewOf(t, { id: 'x', status: 'failed', attempts: 1, power: { used: 0, refunded: 30 } })])
  assert.deepEqual([c.done, c.failed, c.powerUsed, c.powerRefunded], [1, 1, 30, 30])
})
