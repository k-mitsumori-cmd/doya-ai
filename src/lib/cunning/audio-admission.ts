import type { Prisma, PrismaClient } from '@prisma/client'

/** A stopped recorder may deliver one final window per channel for at most 15s.
 * Admission precedes the provider call. Already accepted work may finish afterwards.
 * Final retries must contain the same audio/language hash. At most three attempts
 * are allowed within 15 minutes of stop; successful results can be recovered later.
 * A claim can be reclaimed after 330s (beyond the route's 300s execution budget).
 * Every save must fence against the current claimedAt under the User/Session locks.
 */
export async function admitCunningAudio(db: PrismaClient, userId: string, sessionId: string,
  token: string, speaker: 'remote' | 'self', final: boolean, testNow?: Date, inputHash?: string,
): Promise<'accepted' | 'missing' | 'invalid' | 'expired' | 'duplicate' |
  { state: 'accepted'; claimedAt?: Date; receivedAt: Date } | { state: 'cached'; text: string; transcriptId: string }> {
  if (!token || token.length > 128) return 'invalid'
  return db.$transaction(async tx => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (!users.length) return 'missing'
    await tx.$queryRaw`SELECT id FROM cunning_sessions WHERE id = ${sessionId} AND "userId" = ${userId} FOR NO KEY UPDATE`
    const session = await tx.cunningSession.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== userId || session.status === 'deleted') return 'missing'
    if (session.recordingVersion !== 2) return 'invalid'
    const lease = await tx.cunningRecordingLease.findUnique({ where: { sessionId } })
    if (!lease || lease.userId !== userId || lease.token !== token) return 'invalid'
    if (lease.audioProtocol === 'windows') return 'invalid'
    const field = speaker === 'self' ? 'finalSelfAcceptedAt' : 'finalRemoteAcceptedAt'
    const hashField = speaker === 'self' ? 'finalSelfInputHash' : 'finalRemoteInputHash'
    const claimField = speaker === 'self' ? 'finalSelfClaimedAt' : 'finalRemoteClaimedAt'
    const attemptsField = speaker === 'self' ? 'finalSelfAttempts' : 'finalRemoteAttempts'
    if (final && inputHash && lease[hashField] === inputHash) {
      const saved = await tx.cunningTranscript.findFirst({ where: { sessionId, speaker, recordingFinal: true }, select: { id: true, text: true } })
      if (saved) return { state: 'cached', text: saved.text, transcriptId: saved.id }
    }
    const now = testNow ?? (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now
    if (!Number.isFinite(now.getTime()) || now < lease.startedAt) return 'invalid'
    const endedAt = Math.min(lease.expiresAt.getTime(), lease.stoppedAt?.getTime() ?? Infinity)
    const grace = final && lease[field] && lease[hashField] ? 900000 : 15000
    if (now.getTime() >= endedAt && (!final || now.getTime() > endedAt + grace)) return 'expired'
    if (session.status !== 'active' && !final) return 'expired'
    if (final) {
      if (!inputHash || !/^[a-f0-9]{64}$/.test(inputHash)) return 'invalid'
      const claim = lease[claimField]
      const claimLive = claim !== null && now.getTime() - claim.getTime() < 330000
      if ((lease[field] && lease[hashField] !== inputHash) || claimLive || lease[attemptsField] >= 3) return 'duplicate'
      await tx.cunningRecordingLease.update({ where: { sessionId }, data: {
        audioProtocol: 'legacy',
        [field]: lease[field] ?? now, [hashField]: inputHash,
        [claimField]: now, [attemptsField]: { increment: 1 },
      } })
      return { state: 'accepted', claimedAt: now, receivedAt: lease[field] ?? now }
    }
    if (lease[field]) return 'duplicate'
    if (!lease.audioProtocol) await tx.cunningRecordingLease.update({ where: { sessionId }, data: { audioProtocol: 'legacy' } })
    return { state: 'accepted', receivedAt: now }
  }, { maxWait: 5000, timeout: 15000 })
}

/** Only call after the provider promise has settled and saving has failed. */
export async function releaseFailedCunningAudio(db: PrismaClient, userId: string, sessionId: string,
  token: string, speaker: 'remote' | 'self', claimedAt: Date,
): Promise<void> {
  await db.$transaction(async tx => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (!users.length) return
    await tx.$queryRaw`SELECT id FROM cunning_sessions WHERE id = ${sessionId} AND "userId" = ${userId} FOR NO KEY UPDATE`
    const session = await tx.cunningSession.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== userId || session.status === 'deleted') return
    if (await tx.cunningTranscript.count({ where: { sessionId, speaker, recordingFinal: true } })) return
    const claimField = speaker === 'self' ? 'finalSelfClaimedAt' : 'finalRemoteClaimedAt'
    await tx.cunningRecordingLease.updateMany({ where: { sessionId, userId, token, [claimField]: claimedAt }, data: { [claimField]: null } })
  }, { maxWait: 5000, timeout: 15000 })
}

/** Call only inside writeCunningSession while its User/Session locks are held. */
export async function hasCurrentCunningAudioClaim(tx: Prisma.TransactionClient,
  userId: string, sessionId: string, token: string, speaker: 'remote' | 'self', claimedAt: Date,
): Promise<boolean> {
  const field = speaker === 'self' ? 'finalSelfClaimedAt' : 'finalRemoteClaimedAt'
  return !!await tx.cunningRecordingLease.findFirst({
    where: { sessionId, userId, token, [field]: claimedAt }, select: { sessionId: true },
  })
}
