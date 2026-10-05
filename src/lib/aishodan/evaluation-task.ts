import type { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'

export const EVALUATION_TASK_PREFIX = 'aishodan-evaluation-task:v1:'
export type EvaluationTask = { sessionId: string; organizationId: string; revision: Date; readyAt: Date; failures: number; token: string }
const SAFE = /^[A-Za-z0-9_-]{1,128}$/
export function evaluationTaskValue(task: EvaluationTask) {
  return `${task.readyAt.toISOString()}|${task.organizationId}|${task.revision.toISOString()}|${task.failures}|${task.token}`
}
export function parseEvaluationTask(key: string, value: string): EvaluationTask | null {
  const sessionId = key.slice(EVALUATION_TASK_PREFIX.length)
  const [ready, organizationId, revision, failures, token, extra] = value.split('|')
  const readyAt = new Date(ready), revisionAt = new Date(revision), count = Number(failures)
  if (!key.startsWith(EVALUATION_TASK_PREFIX) || !SAFE.test(sessionId) || !SAFE.test(organizationId || '') ||
      !SAFE.test(token || '') || extra !== undefined || !Number.isFinite(readyAt.getTime()) ||
      !Number.isFinite(revisionAt.getTime()) || !/^[0-3]$/.test(failures || '')) return null
  return { sessionId, organizationId, revision: revisionAt, readyAt, failures: count, token }
}

/** Caller holds the session row lock; task creation commits with the accepted transcript revision. */
export async function enqueueEvaluation(tx: Prisma.TransactionClient, sessionId: string, organizationId: string, revision: Date) {
  if (!SAFE.test(sessionId) || !SAFE.test(organizationId)) throw new Error('Invalid evaluation task scope')
  const key = `${EVALUATION_TASK_PREFIX}${sessionId}`
  const value = evaluationTaskValue({ sessionId, organizationId, revision, readyAt: new Date(), failures: 0, token: randomUUID() })
  await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}

/** A result may clear tasks only through the revision it actually evaluated. */
export async function clearSatisfiedEvaluationTask(db: Pick<Prisma.TransactionClient, 'systemSetting'>, sessionId: string, organizationId: string, revision: Date) {
  const key = `${EVALUATION_TASK_PREFIX}${sessionId}`
  const row = await db.systemSetting.findUnique({ where: { key } })
  const task = row ? parseEvaluationTask(row.key, row.value) : null
  if (row && task && task.organizationId === organizationId && task.revision <= revision) {
    await db.systemSetting.deleteMany({ where: { key, value: row.value } })
  }
}
