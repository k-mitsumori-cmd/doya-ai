// 実行: npm run test:tenjikai
// tenjikai-read.ts（エージェントの read 道具・ホームの集計）を、DB を使わずに確かめる。
// 偽の db に渡された where を記録し、どの問い合わせも userId で絞っていることを見る。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyTaskKind, listCalendarEvents, listTasks, summary, type TenjikaiReadCtx } from './tenjikai-read'

type Call = { model: string; op: string; args: any }

function fakeDb(rows: Record<string, any>) {
  const calls: Call[] = []
  const model = (name: string) => ({
    findMany: async (args: any) => {
      calls.push({ model: name, op: 'findMany', args })
      return rows[`${name}.findMany`] ?? []
    },
    groupBy: async (args: any) => {
      calls.push({ model: name, op: 'groupBy', args })
      const key = `${name}.groupBy.${JSON.stringify(args.where)}`
      return rows[key] ?? rows[`${name}.groupBy`] ?? []
    },
  })
  const db = { tenjikaiTask: model('tenjikaiTask'), tenjikaiProject: model('tenjikaiProject'), tenjikaiDocument: model('tenjikaiDocument'), tenjikaiBudgetLine: model('tenjikaiBudgetLine') }
  return { db: db as unknown as TenjikaiReadCtx['db'], calls }
}

function scopedToUser(call: Call, userId: string) {
  const w = call.args.where
  return w?.userId === userId || w?.project?.userId === userId || Array.isArray(w?.projectId?.in)
}

test('締切の題名から種類を決める', () => {
  assert.equal(classifyTaskKind('大判グラフィックの入稿'), 'submission')
  assert.equal(classifyTaskKind('ノベルティ・チラシの発注締切'), 'order')
  assert.equal(classifyTaskKind('出展申込・小間位置の確定'), 'application')
  assert.equal(classifyTaskKind('電気工事・小間装飾の届出'), 'application')
  assert.equal(classifyTaskKind('説明トークのリハーサル・役割分担'), 'task')
})

test('listTasks は自分のプロジェクトの未完了タスクだけを締切順で返す', async () => {
  const dueAt = new Date('2026-11-01T00:00:00Z')
  const { db, calls } = fakeDb({
    'tenjikaiTask.findMany': [{ id: 't1', projectId: 'p1', title: '大判グラフィックの入稿', kind: 'submission', owner: '印刷・ノベルティ', dueAt, done: false, project: { name: '展示会A' } }],
  })
  const rows = await listTasks({ db, userId: 'u1' })
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], { id: 't1', projectId: 'p1', projectName: '展示会A', title: '大判グラフィックの入稿', kind: 'submission', owner: '印刷・ノベルティ', dueAt, done: false, href: '/tenjikai?section=docs' })
  assert.equal(calls[0].args.where.project.userId, 'u1')
  assert.equal(calls[0].args.where.done, false)
  assert.deepEqual(calls[0].args.orderBy, [{ dueAt: 'asc' }, { id: 'asc' }])
})

test('listTasks の件数は 1〜200 に収める', async () => {
  const { db, calls } = fakeDb({})
  await listTasks({ db, userId: 'u1' }, { limit: 10_000 })
  await listTasks({ db, userId: 'u1' }, { limit: 0 })
  assert.equal(calls[0].args.take, 200)
  assert.equal(calls[1].args.take, 1)
})

test('listCalendarEvents は会期・締切・資料の期限を日付順に返し、すべて userId で絞る', async () => {
  const from = new Date('2026-11-01T00:00:00Z')
  const to = new Date('2026-12-01T00:00:00Z')
  const { db, calls } = fakeDb({
    'tenjikaiProject.findMany': [
      { id: 'p1', name: '展示会A', eventName: 'マーケティングWeek', eventStart: new Date('2026-11-20T00:00:00Z'), eventDays: 3 },
      // 範囲より前に終わった会期は出さない
      { id: 'p0', name: '展示会0', eventName: '前の展示会', eventStart: new Date('2026-10-20T00:00:00Z'), eventDays: 2 },
    ],
    'tenjikaiTask.findMany': [{ id: 't1', projectId: 'p1', title: '大判グラフィックの入稿', kind: 'submission', dueAt: new Date('2026-11-05T00:00:00Z'), done: false, project: { name: '展示会A' } }],
    'tenjikaiDocument.findMany': [{ id: 'd1', projectId: 'p1', title: '出展者マニュアル', dueAt: new Date('2026-11-10T00:00:00Z'), project: { name: '展示会A' } }],
  })
  const events = await listCalendarEvents({ db, userId: 'u1' }, from, to)
  assert.deepEqual(events.map((e) => e.id), ['task:t1', 'doc:d1', 'event:p1'])
  assert.equal(events[2].kind, 'event')
  assert.equal(events[2].end?.toISOString(), '2026-11-22T00:00:00.000Z')
  assert.ok(calls.every((c) => scopedToUser(c, 'u1')))
  assert.deepEqual(calls.find((c) => c.model === 'tenjikaiTask')!.args.where.kind, { not: 'task' })
})

test('listCalendarEvents は範囲が逆なら問い合わせずに空を返す', async () => {
  const { db, calls } = fakeDb({})
  const d = new Date('2026-11-01T00:00:00Z')
  assert.deepEqual(await listCalendarEvents({ db, userId: 'u1' }, d, d), [])
  assert.equal(calls.length, 0)
})

test('summary は会期まで60日以内のプロジェクトの準備状況を返す', async () => {
  const now = new Date(2026, 10, 1, 9, 0, 0)
  const eventStart = new Date(2026, 10, 21)
  const { db, calls } = fakeDb({
    'tenjikaiProject.findMany': [{ id: 'p1', name: '展示会A', eventName: 'マーケティングWeek', eventStart, budgetYen: 4_500_000 }],
    [`tenjikaiTask.groupBy.${JSON.stringify({ projectId: { in: ['p1'] }, done: false })}`]: [{ projectId: 'p1', _count: { _all: 7 } }],
    [`tenjikaiTask.groupBy.${JSON.stringify({ projectId: { in: ['p1'] }, done: false, dueAt: { lt: now } })}`]: [{ projectId: 'p1', _count: { _all: 2 } }],
    'tenjikaiBudgetLine.groupBy': [{ projectId: 'p1', _sum: { amountYen: 1_800_000 } }],
  })
  const [s] = await summary({ db, userId: 'u1' }, now)
  assert.equal(s.daysUntil, 20)
  assert.equal(s.openTasks, 7)
  assert.equal(s.overdueTasks, 2)
  assert.equal(s.committedYen, 1_800_000)
  assert.equal(s.budgetUsedRatio, 0.4)
  assert.equal(calls[0].args.where.userId, 'u1')
  assert.deepEqual(calls.find((c) => c.model === 'tenjikaiBudgetLine')!.args.where.status, { in: ['ordered', 'paid'] })
})

test('summary は対象のプロジェクトが無ければ集計を問い合わせない', async () => {
  const { db, calls } = fakeDb({})
  assert.deepEqual(await summary({ db, userId: 'u1' }), [])
  assert.equal(calls.length, 1)
})
