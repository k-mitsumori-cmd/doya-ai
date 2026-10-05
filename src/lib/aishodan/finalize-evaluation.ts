import { prisma } from '@/lib/prisma'
import type { EvaluationLease } from './evaluation-lease'
import type { EvaluationResult } from './evaluate'
import { enqueueCompletionNotification } from './completion-notification-task'

/** Commit only the transcript and session revision that the evaluator read. */
export async function finalizeEvaluation(input: {
  sessionId: string
  organizationId: string
  expectedUpdatedAt: Date
  turnIds: string[]
  result: EvaluationResult
  lease?: EvaluationLease
  notifyOnCompletion?: boolean
  manualReplacement?: { approved: boolean; overriddenAt: Date | null }
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM aishodan_sessions WHERE id = ${input.sessionId} FOR NO KEY UPDATE`
    const current = await tx.aishodanSession.findUnique({ where: { id: input.sessionId }, include: { room: { select: { isPreview: true } } } })
    if (!current || current.organizationId !== input.organizationId || !current.startedAt || !current.endedAt ||
        !['completed', 'evaluated'].includes(current.status)) return { ok: false as const, reason: 'state_changed' }
    if (!current.consentedAt || (current.purgeAfter && current.purgeAfter.getTime() <= Date.now())) {
      return { ok: false as const, reason: 'record_unavailable' }
    }
    if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      return { ok: false as const, reason: 'revision_changed' }
    }
    if (input.lease) {
      const held = await tx.systemSetting.findUnique({ where: { key: input.lease.key } })
      if (input.lease.key !== `aishodan-evaluation-lease:v1:${input.sessionId}` ||
          held?.value !== input.lease.value || input.lease.expiresAt.getTime() <= Date.now()) {
        return { ok: false as const, reason: 'lease_lost' }
      }
    }
    const turns = await tx.aishodanTurn.findMany({ where: { sessionId: input.sessionId }, select: { id: true } })
    const before = [...input.turnIds].sort()
    const after = turns.map((turn) => turn.id).sort()
    if (before.length !== after.length || before.some((id, index) => id !== after[index])) {
      return { ok: false as const, reason: 'transcript_changed' }
    }
    const outcome = await tx.aishodanOutcome.findUnique({ where: { sessionId: input.sessionId } })
    if (outcome?.overriddenAt && (!input.manualReplacement?.approved ||
        outcome.overriddenAt.getTime() !== input.manualReplacement.overriddenAt?.getTime())) {
      return { ok: false as const, reason: 'manual_outcome' }
    }
    const result = input.result
    const savedOutcome = await tx.aishodanOutcome.upsert({
      where: { sessionId: input.sessionId },
      create: { sessionId: input.sessionId, fitScore: result.fitScore, verdict: result.verdict,
        reason: result.reason, summary: { ...result.summary, conditions: result.conditions } as any,
        nextAction: result.nextAction,
        ...(input.manualReplacement?.approved ? { overriddenBy: null, overriddenAt: null } : {}) },
      update: { fitScore: result.fitScore, verdict: result.verdict,
        reason: result.reason, summary: { ...result.summary, conditions: result.conditions } as any,
        nextAction: result.nextAction,
        ...(input.manualReplacement?.approved ? { overriddenBy: null, overriddenAt: null } : {}) },
    })
    const committedRevision = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1))
    await tx.aishodanSession.update({ where: { id: input.sessionId }, data: {
      status: 'evaluated', updatedAt: committedRevision,
    } })
    if (input.notifyOnCompletion && !current.room.isPreview) {
      await enqueueCompletionNotification(tx, current.id, current.organizationId, committedRevision)
    }
    return { ok: true as const, outcome: savedOutcome }
  }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
}
