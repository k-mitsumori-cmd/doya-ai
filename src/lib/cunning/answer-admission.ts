import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient, CunningAnswer } from '@prisma/client'

/** The last remote audio may finish transcription after stop. Permit one answer,
 * based on that saved text, within a bounded completion window. Successful results
 * can be retrieved again without rerunning the provider, including after the window.
 */
export async function admitCunningAnswer(db: PrismaClient, userId: string, sessionId: string,
  token: string, finalTranscriptId?: string, testNow?: Date, contextTranscriptIds: string[] = [], language: 'ja' | 'en' | 'auto' = 'ja',
): Promise<{ accepted: false; reason?: 'busy' | 'expired' | 'exhausted' | 'conflict'; retryAfterSeconds?: number } | { accepted: true; claimedAt?: Date; finalQuestion?: string; cached?: Pick<CunningAnswer, 'summary' | 'script' | 'sources' | 'model' | 'latencyMs'> }> {
  if (!token || token.length > 128 || (finalTranscriptId !== undefined && (!finalTranscriptId || finalTranscriptId.length > 128))) return { accepted: false }
  if (!Array.isArray(contextTranscriptIds) || contextTranscriptIds.length > 64 ||
    contextTranscriptIds.some(id => typeof id !== 'string' || !id || id.length > 128 || id === finalTranscriptId) ||
    new Set(contextTranscriptIds).size !== contextTranscriptIds.length || (!finalTranscriptId && contextTranscriptIds.length)) return { accepted: false }
  return db.$transaction(async tx => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (!users.length) return { accepted: false }
    await tx.$queryRaw`SELECT id FROM cunning_sessions WHERE id = ${sessionId} AND "userId" = ${userId} FOR NO KEY UPDATE`
    const session = await tx.cunningSession.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== userId || session.status === 'deleted' || session.recordingVersion !== 2) return { accepted: false }
    const lease = await tx.cunningRecordingLease.findUnique({ where: { sessionId } })
    if (!lease || lease.userId !== userId || lease.token !== token) return { accepted: false }
    if (finalTranscriptId) {
      const cached = await tx.cunningAnswer.findFirst({ where: {
        sessionId, finalTranscriptId,
        finalTranscript: { sessionId, speaker: 'remote', recordingFinal: true },
      }, select: { summary: true, script: true, sources: true, model: true, latencyMs: true } })
      if (cached) return { accepted: true, cached }
    }
    const now = testNow ?? (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now
    if (!Number.isFinite(now.getTime()) || now < lease.startedAt) return { accepted: false }
    const deadline = Math.min(lease.expiresAt.getTime(), lease.stoppedAt?.getTime() ?? Infinity)
    if (!finalTranscriptId) return { accepted: session.status === 'active' && now.getTime() < deadline }
    if (!lease.finalRemoteAcceptedAt) return { accepted: false }
    // Pre-cutover running claims have no immutable input binding. Do not guess
    // their input or take them over; deployment requires old-worker drain.
    if (lease.finalAnswerClaimedAt && !lease.finalAnswerInputHash) return { accepted: false, reason: 'conflict' }
    const transcript = await tx.cunningTranscript.findFirst({ where: {
      id: finalTranscriptId, sessionId, speaker: 'remote', recordingFinal: true,
    }, select: { text: true, createdAt: true, audioReceivedAt: true } })
    if (!transcript) return { accepted: false }
    const context = contextTranscriptIds.length ? await tx.cunningTranscript.findMany({ where: {
      id: { in: contextTranscriptIds }, sessionId, speaker: 'remote', recordingFinal: false,
      ...(transcript.audioReceivedAt ? { audioReceivedAt: { lte: transcript.audioReceivedAt } } : { createdAt: { lte: transcript.createdAt } }),
    }, select: { id: true, text: true } }) : []
    if (context.length !== contextTranscriptIds.length) return { accepted: false }
    const finalQuestion = [...contextTranscriptIds.map(id => context.find(row => row.id === id)!.text), transcript.text].join(' ').trim()
    if (!finalQuestion) return { accepted: false }
    const inputHash = createHash('sha256').update(JSON.stringify([finalTranscriptId, contextTranscriptIds, finalQuestion, language])).digest('hex')
    if (lease.finalAnswerInputHash && lease.finalAnswerInputHash !== inputHash) return { accepted: false, reason: 'conflict' }
    // A permitted audio retry may finish after stop. Allow the saved final text
    // its own completion window rather than expiring before it becomes available.
    const grace = lease.finalAnswerInputHash ? 900000 : 120000
    if (now.getTime() > Math.max(deadline, transcript.createdAt.getTime(), lease.finalRemoteAcceptedAt.getTime()) + grace) return { accepted: false, reason: 'expired' }
    if (lease.finalAnswerClaimedAt && now.getTime() - lease.finalAnswerClaimedAt.getTime() < 330000) return {
      accepted: false, reason: 'busy', retryAfterSeconds: Math.ceil((330000 - (now.getTime() - lease.finalAnswerClaimedAt.getTime())) / 1000),
    }
    if (lease.finalAnswerAttempts >= 3) return { accepted: false, reason: 'exhausted' }
    await tx.cunningRecordingLease.update({ where: { sessionId }, data: { finalAnswerClaimedAt: now, finalAnswerInputHash: inputHash, finalAnswerAttempts: { increment: 1 } } })
    return { accepted: true, finalQuestion, claimedAt: now }
  }, { maxWait: 5000, timeout: 15000 })
}

/** Release only a finished unsuccessful attempt, never a running provider or a
 * saved result. A crash keeps its claim for330s; recovery binds the same input and
 * every final-answer save must fence against the current claim under session locks.
 */
export async function releaseFailedCunningAnswer(db: PrismaClient, userId: string,
  sessionId: string, token: string, claimedAt: Date,
): Promise<void> {
  await db.$transaction(async tx => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (!users.length) return
    await tx.$queryRaw`SELECT id FROM cunning_sessions WHERE id = ${sessionId} AND "userId" = ${userId} FOR NO KEY UPDATE`
    const session = await tx.cunningSession.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== userId || session.status === 'deleted') return
    const saved = await tx.cunningAnswer.count({ where: { sessionId, finalTranscriptId: { not: null } } })
    if (saved) return
    await tx.cunningRecordingLease.updateMany({
      where: { sessionId, userId, token, finalAnswerClaimedAt: claimedAt },
      data: { finalAnswerClaimedAt: null },
    })
  }, { maxWait: 5000, timeout: 15000 })
}

/** Call only inside writeCunningSession while User/Session locks are held. */
export async function hasCurrentCunningAnswerClaim(tx: Prisma.TransactionClient, userId: string,
  sessionId: string, token: string, claimedAt: Date,
): Promise<boolean> {
  return !!await tx.cunningRecordingLease.findFirst({ where: { sessionId, userId, token, finalAnswerClaimedAt: claimedAt }, select: { sessionId: true } })
}
