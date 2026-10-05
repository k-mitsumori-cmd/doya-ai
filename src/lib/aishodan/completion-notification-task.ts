import type { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { EVALUATION_TASK_PREFIX, evaluationTaskValue, parseEvaluationTask } from './evaluation-task'

export const COMPLETION_NOTIFICATION_PREFIX = 'aishodan-completion-notification:v1:'
export const FAILURE_NOTIFICATION_PREFIX = 'aishodan-evaluation-failure-notification:v1:'

export function parseFailureNotification(key: string, value: string) {
  if (!key.startsWith(FAILURE_NOTIFICATION_PREFIX)) return null
  return parseEvaluationTask(`${EVALUATION_TASK_PREFIX}${key.slice(FAILURE_NOTIFICATION_PREFIX.length)}`, value)
}

export function parseCompletionNotification(key: string, value: string) {
  if (!key.startsWith(COMPLETION_NOTIFICATION_PREFIX)) return null
  return parseEvaluationTask(`${EVALUATION_TASK_PREFIX}${key.slice(COMPLETION_NOTIFICATION_PREFIX.length)}`, value)
}

/** Commit delivery intent with the automatic result, without storing guest data or webhook details. */
export async function enqueueCompletionNotification(tx: Prisma.TransactionClient, sessionId: string, organizationId: string, revision: Date) {
  const key = `${COMPLETION_NOTIFICATION_PREFIX}${sessionId}`
  const value = evaluationTaskValue({ sessionId, organizationId, revision, readyAt: new Date(), failures: 0, token: randomUUID() })
  if (!parseCompletionNotification(key, value)) throw new Error('Invalid completion notification scope')
  await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
  await tx.systemSetting.deleteMany({ where: { key: `${FAILURE_NOTIFICATION_PREFIX}${sessionId}` } })
}

/** Caller holds the session lock; repeated evaluation failures for one revision share one notice. */
export async function enqueueFailureNotification(tx: Prisma.TransactionClient, sessionId: string, organizationId: string, revision: Date) {
  const key = `${FAILURE_NOTIFICATION_PREFIX}${sessionId}`
  const previous = await tx.systemSetting.findUnique({ where: { key } })
  const task = previous ? parseFailureNotification(previous.key, previous.value) : null
  if (task && task.organizationId === organizationId && task.revision.getTime() === revision.getTime()) return
  const value = evaluationTaskValue({ sessionId, organizationId, revision, readyAt: new Date(), failures: 0, token: randomUUID() })
  if (!parseFailureNotification(key, value)) throw new Error('Invalid failure notification scope')
  await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}
