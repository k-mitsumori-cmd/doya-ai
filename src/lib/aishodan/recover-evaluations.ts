import { prisma } from '@/lib/prisma'
import { evaluateCurrentSession } from '@/lib/aishodan/evaluate-current-session'
import { EVALUATION_TASK_PREFIX, evaluationTaskValue, parseEvaluationTask } from './evaluation-task'

/** Failed workers leave a durable task. CAS prevents old workers from deleting later transcript revisions. */
export async function recoverEvaluations(limit = 10) {
  const now = new Date(), stopAt = Date.now() + 120000
  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: EVALUATION_TASK_PREFIX }, value: { lte: `${now.toISOString()}|~` } },
    orderBy: { value: 'asc' }, take: limit,
  })
  const stats = { processed: 0, completed: 0, busy: 0, retried: 0, exhausted: 0, skipped: 0 }
  for (const row of rows) {
    if (Date.now() >= stopAt) break
    const task = parseEvaluationTask(row.key, row.value)
    if (!task || task.failures >= 3) {
      // Keep invalid metadata for investigation, but remove it from the due queue.
      // Otherwise a malformed oldest row can occupy every one-session cron run.
      const stoppedAt = new Date('9999-01-01T00:00:00.000Z')
      const value = task ? evaluationTaskValue({ ...task, readyAt: stoppedAt })
        : `${stoppedAt.toISOString()}|quarantined|${row.value}`
      const stopped = await prisma.systemSetting.updateMany({ where: { key: row.key, value: row.value }, data: { value } })
      if (stopped.count === 1) stats.exhausted++
      else stats.skipped++
      continue
    }
    const leased = evaluationTaskValue({ ...task, readyAt: new Date(Date.now() + 360000) })
    const claimed = await prisma.systemSetting.updateMany({ where: { key: row.key, value: row.value }, data: { value: leased } })
    if (claimed.count !== 1) continue
    stats.processed++
    try {
      const result = await evaluateCurrentSession({ sessionId: task.sessionId, organizationId: task.organizationId, skipCurrentEvaluation: true, notifyOnCompletion: true })
      if (result.ok) {
        stats.completed++
        const latest = await prisma.systemSetting.findUnique({ where: { key: row.key } })
        const pending = latest ? parseEvaluationTask(latest.key, latest.value) : null
        if (latest && pending && pending.organizationId === task.organizationId && pending.revision <= result.evaluatedRevision) {
          await prisma.systemSetting.deleteMany({ where: { key: latest.key, value: latest.value } })
        }
        continue
      }
      if (result.reason === 'evaluation_busy') {
        const deferred = await prisma.systemSetting.updateMany({ where: { key: row.key, value: leased }, data: {
          value: evaluationTaskValue({ ...task, readyAt: new Date(Date.now() + 360000) }),
        } })
        if (deferred.count === 1) stats.busy++
        else stats.skipped++
        continue
      }
      if (['state_changed', 'record_unavailable', 'manual_outcome', 'empty_transcript', 'already_evaluated'].includes(result.reason)) {
        await prisma.systemSetting.deleteMany({ where: { key: row.key, value: leased } })
        stats.skipped++
        continue
      }
    } catch {
      // Provider/transport details are deliberately not stored in the task.
    }
    const failures = task.failures + 1
    const readyAt = failures >= 3 ? new Date('9999-01-01T00:00:00.000Z') : new Date(Date.now() + 300000 * 2 ** (failures - 1))
    const failed = await prisma.systemSetting.updateMany({ where: { key: row.key, value: leased }, data: {
      value: evaluationTaskValue({ ...task, failures, readyAt }),
    } })
    if (failed.count !== 1) stats.skipped++
    else if (failures >= 3) stats.exhausted++
    else stats.retried++
  }
  return stats
}
