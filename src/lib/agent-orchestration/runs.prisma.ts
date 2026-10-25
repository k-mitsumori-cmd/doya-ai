// ============================================
// 実行の記録の表（Prisma）。runs.ts の RunRepo の本番の形
// ============================================
// ⚠️ 旗 AGENT_RUNS_STORE=db のときだけ使う（store-flag.ts）。本番DBに表が無いうちは呼ばない（MIGRATION.md）。
// ⚠️ どの読み書きも userId で絞る。
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { RunRepo, RunRow, TaskRow } from './runs'

const RETRYABLE = ['waiting', 'failed', 'blocked', 'canceled']

const runOf = (r: any): RunRow => ({ ...r, answers: (r.answers ?? {}) as Record<string, string>, plan: r.plan as RunRow['plan'] })
const taskOf = (t: any): TaskRow => ({ ...t, result: (t.result ?? null) as TaskRow['result'], resume: (t.resume ?? null) as TaskRow['resume'] })
const json = (v: unknown) => (v === null ? (null as unknown as Prisma.InputJsonValue) : (v as Prisma.InputJsonValue))

export const prismaRunRepo: RunRepo = {
  async createRun(run, tasks) {
    const row = await prisma.homeAgentRun.create({
      data: {
        userId: run.userId, recipeId: run.recipeId, title: run.title, request: run.request,
        answers: json(run.answers), plan: json(run.plan),
        tasks: { create: tasks.map((t) => ({ userId: run.userId, taskId: t.taskId, action: t.action, delegated: t.delegated, status: t.status })) },
      },
    })
    return runOf(row)
  },
  async getRun(userId, runId) {
    const row = await prisma.homeAgentRun.findFirst({ where: { id: runId, userId }, include: { tasks: true } })
    return row ? { run: runOf(row), tasks: row.tasks.map(taskOf) } : null
  },
  async listRuns(userId, since, limit) {
    const rows = await prisma.homeAgentRun.findMany({ where: { userId, createdAt: { gt: since } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit, include: { tasks: true } })
    return rows.map((r) => ({ run: runOf(r), tasks: r.tasks.map(taskOf) }))
  },
  async countRunning(userId, staleBefore) {
    return prisma.homeAgentTask.count({ where: { userId, status: 'running', startedAt: { gt: staleBefore } } })
  },
  async claimTask(userId, runId, taskId, now, staleBefore) {
    // 条件付きの更新で取る（同じ ToDo を同時に2回動かさない）
    const r = await prisma.homeAgentTask.updateMany({
      where: {
        runId, taskId, userId, delegated: true,
        OR: [{ status: { in: RETRYABLE } }, { status: 'running', OR: [{ startedAt: null }, { startedAt: { lte: staleBefore } }] }],
      },
      data: { status: 'running', attempts: { increment: 1 }, startedAt: now, endedAt: null },
    })
    return r.count === 1
  },
  async unclaimTask(userId, runId, taskId, startedAt, back) {
    await prisma.homeAgentTask.updateMany({ where: { runId, taskId, userId, status: 'running', startedAt }, data: { status: back.status, attempts: back.attempts, startedAt: back.startedAt } })
  },
  async finishTask(userId, runId, taskId, patch) {
    const { result, resume, ...rest } = patch
    await prisma.homeAgentTask.updateMany({
      where: { runId, taskId, userId, status: 'running' },
      data: {
        ...(rest as Record<string, unknown>),
        ...(result !== undefined ? { result: result === null ? Prisma.DbNull : json(result) } : {}),
        ...(resume !== undefined ? { resume: resume === null ? Prisma.DbNull : json(resume) } : {}),
      } as Prisma.HomeAgentTaskUpdateManyMutationInput,
    })
  },
  async updateRun(userId, runId, patch) {
    await prisma.homeAgentRun.updateMany({ where: { id: runId, userId }, data: patch })
  },
}
