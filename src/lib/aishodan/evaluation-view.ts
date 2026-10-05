import { EVALUATION_TASK_PREFIX, parseEvaluationTask } from './evaluation-task'

export type EvaluationStatus = 'ready' | 'manual' | 'pending' | 'retrying' | 'stopped' | 'unavailable' | null
export function evaluationView<T extends { overriddenAt?: Date | string | null }>(session: {
  id: string; organizationId: string; status: string
  startedAt: Date | null; endedAt: Date | null; outcome: T | null
}, row: { key: string; value: string } | null) {
  const visible = session.outcome && (session.outcome.overriddenAt || session.status === 'evaluated') ? session.outcome : null
  let evaluationStatus: EvaluationStatus = null
  if (visible) evaluationStatus = visible.overriddenAt ? 'manual' : 'ready'
  else if (session.startedAt && session.endedAt && ['completed', 'evaluated'].includes(session.status)) {
    const task = row && row.key === `${EVALUATION_TASK_PREFIX}${session.id}` ? parseEvaluationTask(row.key, row.value) : null
    evaluationStatus = task && task.organizationId === session.organizationId
      ? task.failures >= 3 ? 'stopped' : task.failures > 0 ? 'retrying' : 'pending'
      : 'unavailable'
  }
  return { outcome: visible, evaluationStatus, hasPreviousOutcome: !!session.outcome && !visible }
}
