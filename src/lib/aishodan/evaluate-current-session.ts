import { prisma } from '@/lib/prisma'
import { toScenarioConfig } from '@/lib/aishodan/public'
import { evaluateSession } from '@/lib/aishodan/evaluate'
import { claimEvaluationLease, releaseEvaluationLease } from '@/lib/aishodan/evaluation-lease'
import { finalizeEvaluation } from '@/lib/aishodan/finalize-evaluation'
import { clearSatisfiedEvaluationTask } from '@/lib/aishodan/evaluation-task'
import { enqueueFailureNotification } from './completion-notification-task'

/** Re-read changed transcripts; never commit the result of an older snapshot. */
export async function evaluateCurrentSession(input: {
  sessionId: string
  organizationId: string
  expectedUpdatedAt?: Date
  retryOnChange?: boolean
  skipCurrentEvaluation?: boolean
  notifyOnCompletion?: boolean
  manualReplacement?: { approved: boolean; overriddenAt: Date | null }
}) {
  const lease = await claimEvaluationLease(input.sessionId, input.organizationId)
  if (!lease) {
    // Acquisition also refuses records that are no longer eligible, not only active workers.
    // Treat terminal records separately so recovery does not defer them forever.
    const current = await prisma.aishodanSession.findFirst({
      where: { id: input.sessionId, organizationId: input.organizationId },
      select: { status: true, startedAt: true, endedAt: true, consentedAt: true, purgeAfter: true },
    })
    if (!current || !current.startedAt || !current.endedAt || !['completed', 'evaluated'].includes(current.status)) {
      return { ok: false as const, reason: 'state_changed' }
    }
    if (!current.consentedAt || (current.purgeAfter && current.purgeAfter.getTime() <= Date.now())) {
      return { ok: false as const, reason: 'record_unavailable' }
    }
    return { ok: false as const, reason: 'evaluation_busy' }
  }
  try {
    const started = Date.now()
    for (let attempt = 0; attempt < (input.retryOnChange === false ? 1 : 3) && Date.now() - started < 180000; attempt++) {
      const current = await prisma.aishodanSession.findFirst({
        where: { id: input.sessionId, organizationId: input.organizationId },
        include: {
          outcome: { select: { id: true, overriddenAt: true } },
          room: { include: { scenario: { include: { product: { select: { name: true } } } } } },
        },
      })
      if (!current || !current.startedAt || !current.endedAt || !['completed', 'evaluated'].includes(current.status)) {
        return { ok: false as const, reason: 'state_changed' }
      }
      if (attempt === 0 && input.expectedUpdatedAt && current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
        return { ok: false as const, reason: 'revision_changed' }
      }
      if (!current.consentedAt || (current.purgeAfter && current.purgeAfter.getTime() <= Date.now())) {
        return { ok: false as const, reason: 'record_unavailable' }
      }
      if (current.outcome?.overriddenAt && (!input.manualReplacement?.approved ||
          current.outcome.overriddenAt.getTime() !== input.manualReplacement.overriddenAt?.getTime())) {
        return { ok: false as const, reason: 'manual_outcome' }
      }
      // New transcript revisions move AI-evaluated sessions back to completed.
      // A leftover task after successful persistence must not purchase another evaluation.
      if (input.skipCurrentEvaluation && current.status === 'evaluated' && current.outcome?.id) {
        return { ok: false as const, reason: 'already_evaluated' }
      }
      const [turns, slotValues, unanswered] = await Promise.all([
        prisma.aishodanTurn.findMany({ where: { sessionId: current.id },
          orderBy: [{ startMs: 'asc' }, { ord: 'asc' }], select: { id: true, speaker: true, text: true } }),
        prisma.aishodanSlotValue.findMany({ where: { sessionId: current.id }, select: { key: true, value: true } }),
        prisma.aishodanQuestion.findMany({ where: { sessionId: current.id, unanswered: true }, select: { text: true } }),
      ])
      if (turns.length === 0) return { ok: false as const, reason: 'empty_transcript' }
      const cfg = toScenarioConfig(current.room.scenario)
      const result = await evaluateSession({ productName: current.room.scenario.product.name,
        icp: cfg.icp, slots: cfg.slots, slotValues,
        turns: turns.map((turn) => ({ speaker: turn.speaker, text: turn.text })),
        unansweredQuestions: unanswered.map((question) => question.text),
      })
      const finalized = await finalizeEvaluation({ ...input, lease, expectedUpdatedAt: current.updatedAt,
        turnIds: turns.map((turn) => turn.id), result,
      })
      if (finalized.ok) {
        await clearSatisfiedEvaluationTask(prisma, input.sessionId, input.organizationId, current.updatedAt)
          .catch(() => console.error('[aishodan] completed evaluation task cleanup failed'))
        return { ok: true as const, result, outcome: finalized.outcome, evaluatedRevision: current.updatedAt }
      }
      if (input.retryOnChange === false) return finalized
      if (!['revision_changed', 'transcript_changed'].includes(finalized.reason)) return finalized
    }
    return { ok: false as const, reason: 'updates_continued' }
  } catch (error) {
    if (input.notifyOnCompletion) {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM aishodan_sessions WHERE id = ${input.sessionId} FOR NO KEY UPDATE`
        const current = await tx.aishodanSession.findUnique({ where: { id: input.sessionId },
          include: { room: { select: { isPreview: true } }, outcome: { select: { overriddenAt: true } } } })
        if (!current || current.organizationId !== input.organizationId || current.room.isPreview ||
            !current.startedAt || !current.endedAt || !current.consentedAt || current.status !== 'completed' ||
            current.outcome?.overriddenAt || (current.purgeAfter && current.purgeAfter.getTime() <= Date.now())) return
        await enqueueFailureNotification(tx, current.id, current.organizationId, current.updatedAt)
      }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
        .catch(() => console.error('[aishodan] failure notification intent unavailable'))
    }
    throw error
  } finally {
    await releaseEvaluationLease(lease).catch(() => console.error('[aishodan] evaluation lease release failed'))
  }
}
