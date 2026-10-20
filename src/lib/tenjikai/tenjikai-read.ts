// ドヤ展示会の読み取り専用関数（ADDON-SERVICES R-4）。
// 画面の API route・ホームの集計・エージェント道具（tenjikai.listTasks 等）が同じ関数を呼ぶ。
// ⚠️ 書き込みはしない。userId で必ずスコープする（他人のプロジェクトは返さない）。
// ⚠️ Tenjikai* のテーブルは本番未反映（db push 前）。呼び出し側を作るのは db push の後。

import type { Prisma } from '@prisma/client'

export interface TenjikaiReadCtx {
  db: Prisma.TransactionClient
  userId: string
}

export type TenjikaiTaskKind = 'task' | 'application' | 'submission' | 'order'

// 締切の題名から種類を決める。タスクを保存する側（engine の締切生成）がこれで kind を入れる
export function classifyTaskKind(title: string): TenjikaiTaskKind {
  if (/入稿/.test(title)) return 'submission'
  if (/発注/.test(title)) return 'order'
  if (/申込|届出|登録/.test(title)) return 'application'
  return 'task'
}

const DAY_MS = 86_400_000
const JST_OFFSET_MS = 9 * 3_600_000
const MAX_ROWS = 200

export interface TenjikaiTaskRow {
  id: string
  projectId: string
  projectName: string
  title: string
  kind: string
  owner: string
  dueAt: Date
  done: boolean
  href: string
}

/** ホームの「今日のタスク」用。未完了の準備タスクを締切順に返す */
export async function listTasks(
  ctx: TenjikaiReadCtx,
  opts: { until?: Date; includeDone?: boolean; limit?: number } = {},
): Promise<TenjikaiTaskRow[]> {
  const rows = await ctx.db.tenjikaiTask.findMany({
    where: {
      project: { userId: ctx.userId },
      ...(opts.includeDone ? {} : { done: false }),
      ...(opts.until ? { dueAt: { lte: opts.until } } : {}),
    },
    select: { id: true, projectId: true, title: true, kind: true, owner: true, dueAt: true, done: true, project: { select: { name: true } } },
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    take: Math.min(Math.max(opts.limit ?? 50, 1), MAX_ROWS),
  })
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.project.name,
    title: r.title,
    kind: r.kind,
    owner: r.owner,
    dueAt: r.dueAt,
    done: r.done,
    href: '/tenjikai/docs',
  }))
}

export interface TenjikaiCalendarEvent {
  id: string
  kind: 'event' | 'application' | 'submission' | 'order' | 'document'
  title: string
  start: Date
  /** 会期のように期間があるものだけ。終了日の翌日 0 時ではなく最終日の日付 */
  end?: Date
  projectId: string
  projectName: string
  done?: boolean
  href: string
}

/** カレンダー用。会期と、申込・入稿・発注の締切、資料の期限を [from, to) で返す */
export async function listCalendarEvents(ctx: TenjikaiReadCtx, from: Date, to: Date): Promise<TenjikaiCalendarEvent[]> {
  if (!(from < to)) return []
  // 会期は最長でも数日なので、開始日が範囲の少し前のものまで拾う
  const projects = await ctx.db.tenjikaiProject.findMany({
    where: { userId: ctx.userId, eventStart: { gte: new Date(from.getTime() - 14 * DAY_MS), lt: to } },
    select: { id: true, name: true, eventName: true, eventStart: true, eventDays: true },
    orderBy: { eventStart: 'asc' },
    take: MAX_ROWS,
  })
  const events: TenjikaiCalendarEvent[] = []
  for (const p of projects) {
    const end = new Date(p.eventStart.getTime() + (Math.max(p.eventDays, 1) - 1) * DAY_MS)
    if (end < from) continue
    events.push({ id: `event:${p.id}`, kind: 'event', title: `${p.eventName}（会期）`, start: p.eventStart, end, projectId: p.id, projectName: p.name, href: '/tenjikai/overview' })
  }

  const tasks = await ctx.db.tenjikaiTask.findMany({
    where: { project: { userId: ctx.userId }, kind: { not: 'task' }, dueAt: { gte: from, lt: to } },
    select: { id: true, projectId: true, title: true, kind: true, dueAt: true, done: true, project: { select: { name: true } } },
    orderBy: { dueAt: 'asc' },
    take: MAX_ROWS,
  })
  for (const t of tasks) {
    const kind = t.kind === 'application' || t.kind === 'submission' || t.kind === 'order' ? t.kind : 'application'
    events.push({ id: `task:${t.id}`, kind, title: t.title, start: t.dueAt, projectId: t.projectId, projectName: t.project.name, done: t.done, href: '/tenjikai/docs' })
  }

  const docs = await ctx.db.tenjikaiDocument.findMany({
    where: { project: { userId: ctx.userId }, dueAt: { gte: from, lt: to } },
    select: { id: true, projectId: true, title: true, dueAt: true, project: { select: { name: true } } },
    orderBy: { dueAt: 'asc' },
    take: MAX_ROWS,
  })
  for (const d of docs) {
    if (!d.dueAt) continue
    events.push({ id: `doc:${d.id}`, kind: 'document', title: `${d.title}の期限`, start: d.dueAt, projectId: d.projectId, projectName: d.project.name, href: '/tenjikai/docs' })
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id))
}

export interface TenjikaiPrepSummary {
  projectId: string
  projectName: string
  eventName: string
  eventStart: Date
  daysUntil: number
  openTasks: number
  overdueTasks: number
  budgetYen: number
  /** 発注済み・支払済みの予算行の合計 */
  committedYen: number
  /** committedYen / budgetYen（0〜。予算 0 のときは null） */
  budgetUsedRatio: number | null
  href: string
}

/** ホームの「展示会の準備状況」用。会期まで windowDays 日以内（既定 60 日）のプロジェクトだけを返す */
export async function summary(ctx: TenjikaiReadCtx, now = new Date(), windowDays = 60): Promise<TenjikaiPrepSummary[]> {
  // 呼出元のDateや環境TZが変わっても、1集計のJST基準時刻は動かさない。
  const reference = new Date(now.getTime())
  const todayOrdinal = Math.floor((reference.getTime() + JST_OFFSET_MS) / DAY_MS)
  const today = new Date(todayOrdinal * DAY_MS - JST_OFFSET_MS)
  const projects = await ctx.db.tenjikaiProject.findMany({
    where: { userId: ctx.userId, eventStart: { gte: today, lt: new Date(today.getTime() + (windowDays + 1) * DAY_MS) }, status: { not: 'done' } },
    select: { id: true, name: true, eventName: true, eventStart: true, budgetYen: true },
    orderBy: { eventStart: 'asc' },
    take: 20,
  })
  if (projects.length === 0) return []
  const ids = projects.map((p) => p.id)
  const [open, overdue, committed] = await Promise.all([
    ctx.db.tenjikaiTask.groupBy({ by: ['projectId'], where: { projectId: { in: ids }, done: false }, _count: { _all: true } }),
    ctx.db.tenjikaiTask.groupBy({ by: ['projectId'], where: { projectId: { in: ids }, done: false, dueAt: { lt: reference } }, _count: { _all: true } }),
    ctx.db.tenjikaiBudgetLine.groupBy({ by: ['projectId'], where: { projectId: { in: ids }, status: { in: ['ordered', 'paid'] } }, _sum: { amountYen: true } }),
  ])
  const count = (rows: { projectId: string; _count: { _all: number } }[], id: string) => rows.find((r) => r.projectId === id)?._count._all ?? 0
  return projects.map((p) => {
    const committedYen = committed.find((r) => r.projectId === p.id)?._sum.amountYen ?? 0
    return {
      projectId: p.id,
      projectName: p.name,
      eventName: p.eventName,
      eventStart: p.eventStart,
      daysUntil: Math.floor((p.eventStart.getTime() + JST_OFFSET_MS) / DAY_MS) - todayOrdinal,
      openTasks: count(open, p.id),
      overdueTasks: count(overdue, p.id),
      budgetYen: p.budgetYen,
      committedYen,
      budgetUsedRatio: p.budgetYen > 0 ? committedYen / p.budgetYen : null,
      href: '/tenjikai/overview',
    }
  })
}
