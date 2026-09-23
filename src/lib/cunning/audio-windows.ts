import { randomUUID } from 'node:crypto'
import type { Prisma, PrismaClient, CunningRecordingLease, CunningSession } from '@prisma/client'

export const CUNNING_AUDIO_WINDOW_MS = 3500
const RECOVERY_MS = 15 * 60 * 1000
const CLAIM_MS = 330000
type Owner = { userId: string; sessionId: string; recordingToken: string }
type Reserve = Owner & { speaker: 'remote' | 'self'; requestKey: string }
type Upload = Owner & { windowId: string; inputHash: string }

/** All mutations use the same User -> Session lock order as recording stop.
 * No provider work belongs in these transactions. Route/UI wiring is separate.
 */
async function locked<T>(db: PrismaClient, owner: Owner, testNow: Date | undefined,
  action: (tx: Prisma.TransactionClient, now: Date, lease: CunningRecordingLease, session: CunningSession) => Promise<T>,
) {
  if (!owner.recordingToken || owner.recordingToken.length > 128) return { state: 'invalid' as const }
  return db.$transaction(async tx => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${owner.userId} FOR UPDATE`
    if (!users.length) return { state: 'missing' as const }
    await tx.$queryRaw`SELECT id FROM cunning_sessions WHERE id = ${owner.sessionId} AND "userId" = ${owner.userId} FOR NO KEY UPDATE`
    const session = await tx.cunningSession.findUnique({ where: { id: owner.sessionId } })
    if (!session || session.userId !== owner.userId || session.status === 'deleted') return { state: 'missing' as const }
    const lease = await tx.cunningRecordingLease.findUnique({ where: { sessionId: owner.sessionId } })
    if (session.recordingVersion !== 2 || !lease || lease.userId !== owner.userId || lease.token !== owner.recordingToken) return { state: 'invalid' as const }
    if (lease.audioProtocol === 'legacy') return { state: 'invalid' as const }
    const now = testNow ?? (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now
    if (!Number.isFinite(now.getTime()) || now < lease.startedAt) return { state: 'invalid' as const }
    return action(tx, now, lease, session)
  }, { maxWait: 5000, timeout: 15000 })
}

export async function reserveCunningAudioWindow(db: PrismaClient, input: Reserve, testNow?: Date) {
  if (!['remote', 'self'].includes(input.speaker) || !/^[A-Za-z0-9_-]{1,100}$/.test(input.requestKey)) return { state: 'invalid' as const }
  return locked(db, input, testNow, async (tx, now, lease, session) => {
    const where = { sessionId: input.sessionId, recordingToken: input.recordingToken, speaker: input.speaker }
    if (!lease.audioProtocol) {
      const untracked = await tx.cunningTranscript.count({ where: { sessionId: input.sessionId, audioWindow: null } })
      if (untracked || lease.finalRemoteAcceptedAt || lease.finalSelfAcceptedAt) return { state: 'invalid' as const }
    }
    const existing = await tx.cunningAudioWindow.findFirst({ where: { ...where, requestKey: input.requestKey } })
    // A lost reservation response can be retrieved after stop; never create a new one.
    if (existing) return { state: 'reserved' as const, window: existing }
    if (session.status !== 'active' || lease.stoppedAt || now >= lease.expiresAt) return { state: 'expired' as const }
    const last = await tx.cunningAudioWindow.aggregate({ where, _max: { sequence: true } })
    const sequence = (last._max.sequence ?? -1) + 1
    // One capture window ahead is allowed; request spam cannot reserve unlimited AI jobs.
    const maximum = Math.floor((now.getTime() - lease.startedAt.getTime()) / CUNNING_AUDIO_WINDOW_MS) + 1
    if (sequence > maximum) return { state: 'too_early' as const }
    const window = await tx.cunningAudioWindow.create({ data: { ...where, sequence, requestKey: input.requestKey, reservedAt: now } })
    if (!lease.audioProtocol) await tx.cunningRecordingLease.update({ where: { sessionId: session.id }, data: { audioProtocol: 'windows' } })
    // A report that started before this reservation must not persist as complete.
    await tx.cunningSession.update({ where: { id: session.id }, data: { updatedAt: new Date(Math.max(now.getTime(), session.updatedAt.getTime() + 1)) } })
    return { state: 'reserved' as const, window }
  })
}

export async function claimCunningAudioWindow(db: PrismaClient, input: Upload, testNow?: Date) {
  if (!/^[a-f0-9]{64}$/.test(input.inputHash)) return { state: 'invalid' as const }
  return locked(db, input, testNow, async (tx, now, lease) => {
    const window = await tx.cunningAudioWindow.findFirst({ where: { id: input.windowId, sessionId: input.sessionId, recordingToken: input.recordingToken }, include: { transcript: true } })
    if (!window) return { state: 'missing' as const }
    if (window.inputHash && window.inputHash !== input.inputHash) return { state: 'conflict' as const }
    if (window.transcript) return { state: 'cached' as const, transcript: window.transcript }
    const end = Math.min(lease.expiresAt.getTime(), lease.stoppedAt?.getTime() ?? Infinity)
    if (now.getTime() > end + RECOVERY_MS) return { state: 'expired' as const }
    if (window.claimedAt && now.getTime() - window.claimedAt.getTime() < CLAIM_MS) return { state: 'busy' as const }
    if (window.attempts >= 3) return { state: 'exhausted' as const }
    const claimToken = randomUUID()
    await tx.cunningAudioWindow.update({ where: { id: window.id }, data: { inputHash: input.inputHash, claimToken, claimedAt: now, attempts: { increment: 1 } } })
    return { state: 'claimed' as const, claimToken, sequence: window.sequence, speaker: window.speaker }
  })
}

/** Empty text is a completed silent window, not an unaccounted gap. */
export async function settleCunningAudioWindow(db: PrismaClient, input: Upload & { claimToken: string; text: string }, testNow?: Date) {
  if (typeof input.text !== 'string' || input.text.length > 100000) return { state: 'invalid' as const }
  return locked(db, input, testNow, async (tx, now, _lease, session) => {
    const window = await tx.cunningAudioWindow.findFirst({ where: { id: input.windowId, sessionId: input.sessionId, recordingToken: input.recordingToken }, include: { transcript: true } })
    if (!window || window.inputHash !== input.inputHash) return { state: 'missing' as const }
    if (window.transcript) return { state: 'cached' as const, transcript: window.transcript }
    if (!window.claimedAt || window.claimToken !== input.claimToken || now.getTime() - window.claimedAt.getTime() >= CLAIM_MS) return { state: 'stale' as const }
    const transcript = await tx.cunningTranscript.create({ data: { sessionId: input.sessionId, speaker: window.speaker, text: input.text, audioReceivedAt: window.reservedAt } })
    await tx.cunningAudioWindow.update({ where: { id: window.id }, data: { transcriptId: transcript.id, claimToken: null, claimedAt: null } })
    await tx.cunningSession.update({ where: { id: session.id }, data: { updatedAt: new Date(Math.max(now.getTime(), session.updatedAt.getTime() + 1)) } })
    return { state: 'saved' as const, transcript }
  })
}

/** Release only once the provider has settled. Uncertain timeouts keep the claim. */
export async function releaseCunningAudioWindow(db: PrismaClient, input: Upload & { claimToken: string }, testNow?: Date) {
  return locked(db, input, testNow, async tx => {
    const result = await tx.cunningAudioWindow.updateMany({ where: { id: input.windowId, sessionId: input.sessionId, recordingToken: input.recordingToken, inputHash: input.inputHash, claimToken: input.claimToken, transcriptId: null }, data: { claimToken: null, claimedAt: null } })
    return { state: 'released' as const, count: result.count }
  })
}

/** Seal only after recording stop and after every reserved window has a result.
 * Empty (silent/unused) windows must also be acknowledged by the caller.
 */
export async function finalizeCunningAudioWindows(db: PrismaClient, input: Owner, testNow?: Date) {
  return locked(db, input, testNow, async (tx, now, lease, session) => {
    if (!lease.stoppedAt || session.status === 'active') return { state: 'recording' as const }
    const where = { sessionId: input.sessionId, recordingToken: input.recordingToken }
    const pending = await tx.cunningAudioWindow.count({ where: { ...where, transcriptId: null } })
    if (pending) return { state: 'pending' as const, pending }
    // Never mix the old final-only protocol with the new complete-window protocol.
    const untracked = await tx.cunningTranscript.count({ where: { sessionId: input.sessionId, audioWindow: null } })
    if (untracked) return { state: 'conflict' as const }
    const finalTranscripts: { speaker: string; transcriptId: string; sequence: number }[] = []
    let changed = false
    for (const speaker of ['remote', 'self']) {
      const last = await tx.cunningAudioWindow.findFirst({ where: { ...where, speaker }, orderBy: { sequence: 'desc' }, include: { transcript: true } })
      if (!last?.transcript) continue
      if (!last.transcript.recordingFinal) {
        await tx.cunningTranscript.update({ where: { id: last.transcript.id }, data: { recordingFinal: true } })
        changed = true
      }
      const field = speaker === 'remote' ? 'finalRemoteAcceptedAt' : 'finalSelfAcceptedAt'
      if (!lease[field]) {
        await tx.cunningRecordingLease.update({ where: { sessionId: session.id }, data: { [field]: now } })
        changed = true
      }
      finalTranscripts.push({ speaker, transcriptId: last.transcript.id, sequence: last.sequence })
    }
    if (changed) await tx.cunningSession.update({ where: { id: session.id }, data: { updatedAt: new Date(Math.max(now.getTime(), session.updatedAt.getTime() + 1)) } })
    return { state: 'complete' as const, finalTranscripts }
  })
}
