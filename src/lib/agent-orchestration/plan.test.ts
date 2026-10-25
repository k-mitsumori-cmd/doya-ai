// 実行: npx tsx --test src/lib/agent-orchestration/plan.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SALES_PREP, parseSalesPrepAnswers, type SalesPrepAnswers } from './recipes'
import { ACTION_CATALOG, actionPower, planFromRecipe, planTasks, sanitizeAiPlan } from './plan'
import { DOYA_POWER_COSTS } from '@/lib/doya-power/costs'

const a = (() => {
  const p = parseSalesPrepAnswers({ url: 'https://example.co.jp', offer: 'ads', budget: 'u50', stage: 'first' })
  assert.ok(p.ok)
  return p.value as SalesPrepAnswers
})()

test('組み合わせから作戦を作る: 柱ごとのタスク・減るドヤパワー・同時に動かす数', () => {
  const plan = planFromRecipe(SALES_PREP, a)
  assert.equal(plan.version, 1)
  assert.equal(plan.source, 'recipe')
  assert.deepEqual(plan.pillars.map((p) => p.name), ['相手を知る', '条件を示す', '提案を形にする'])
  const tasks = planTasks(plan)
  assert.deepEqual(tasks.map((t) => t.id), ['research', 'quote', 'slides'])
  assert.deepEqual(tasks.map((t) => t.power), [0, DOYA_POWER_COSTS['text.generate'], DOYA_POWER_COSTS['slide.generate']])
  assert.equal(plan.totalPower, DOYA_POWER_COSTS['text.generate'] + DOYA_POWER_COSTS['slide.generate'])
  assert.equal(plan.concurrency, 3)
  assert.match(plan.goal, /example\.co\.jp/)
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
