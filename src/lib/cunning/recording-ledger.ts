import { randomUUID } from 'crypto'
import type { Prisma, PrismaClient, CunningRecordingLease } from '@prisma/client'
import { tierFrom } from '@/lib/plan-utils'
import { CUNNING_LIMITS } from './limit-config'
import { cunningMonthStart, splitCunningInterval } from './usage-interval'
import { carryLegacyCunningUsage } from './legacy-usage'

const LEASE_MS = 60_000

function safeNumber(value: bigint) {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid recording usage')
  return Number(value)
}

/** Authoritative usage including outstanding reservations. Route integration must be
 * atomic with token-based transcription acceptance: an existing recorder may consume
 * its own reservation even when there is no unreserved allowance for a new session.
 */
export async function readCunningRecordingUsage(db: PrismaClient, userId: string, testNow?: Date) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const user = await tx.user.findUnique({ where: { id: userId }, select: { plan: true } })
    if (!user) return null
    await carryLegacyCunningUsage(tx, userId)
    const now = testNow ?? (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now
    const monthStart = cunningMonthStart(now)
    const leases = await tx.cunningRecordingLease.findMany({ where: { userId, stoppedAt: null } })
    for (const lease of leases) {
      if (now < lease.settledThrough) throw new Error('Recording clock moved backwards')
      await settle(tx, lease, now)
      if (lease.expiresAt <= now) await closeExpired(tx, lease)
    }
    const totals = await tx.cunningUsageAllocation.aggregate({ where: { userId, monthStart }, _sum: { usedMs: true, reservedMs: true } })
    const used = totals._sum.usedMs ?? 0n, reserved = totals._sum.reservedMs ?? 0n
    const tier = process.env.DOYA_DISABLE_LIMITS === '1' ? 'ENTERPRISE' : tierFrom(user.plan)
    const limits = CUNNING_LIMITS[tier]
    const remaining = BigInt(Math.max(0, limits.maxMinutesPerMonth)) * 60_000n - used - reserved
    const usedSeconds = safeNumber((used + 999n) / 1000n)
    const occupiedSeconds = safeNumber((used + reserved + 999n) / 1000n)
    return {
      tier, limits, usedMilliseconds: safeNumber(used), reservedMilliseconds: safeNumber(reserved),
      usedSeconds, reservedSeconds: occupiedSeconds - usedSeconds,
      remainingSeconds: limits.maxMinutesPerMonth < 0 ? -1 : safeNumber(remaining > 0n ? remaining / 1000n : 0n),
      resetAt: cunningMonthStart(new Date(monthStart.getTime() + 32 * 86400000)),
    }
  }, { maxWait: 5000, timeout: 15000 })
}

type Command = { action: 'start'; requestKey: string } | { action: 'heartbeat' | 'stop'; token: string }
type Result = { state: 'active'; token: string; expiresAt: Date; validForMs: number } | { state: 'missing' | 'conflict' | 'stopped' | 'limit' | 'legacy' }

async function closeExpired(tx: Prisma.TransactionClient, lease: CunningRecordingLease) {
  await tx.cunningRecordingLease.update({ where: { sessionId: lease.sessionId }, data: { stoppedAt: lease.expiresAt } })
  await tx.cunningSession.updateMany({ where: { id: lease.sessionId, recordingVersion: 2, status: 'active' }, data: { status: 'ended', endedAt: lease.expiresAt } })
}

async function settle(tx: Prisma.TransactionClient, lease: CunningRecordingLease, at: Date) {
  const end = new Date(Math.max(lease.settledThrough.getTime(), Math.min(at.getTime(), lease.expiresAt.getTime())))
  if (end.getTime() === lease.settledThrough.getTime()) return end
  for (const part of splitCunningInterval(lease.settledThrough, end)) {
    await tx.cunningUsageAllocation.update({
      where: { sessionId_monthStart: { sessionId: lease.sessionId, monthStart: part.monthStart } },
      data: { usedMs: { increment: BigInt(part.milliseconds) }, reservedMs: { decrement: BigInt(part.milliseconds) } },
    })
  }
  await tx.cunningRecordingLease.update({ where: { sessionId: lease.sessionId }, data: { settledThrough: end } })
  const usage = await tx.cunningUsageAllocation.aggregate({ where: { sessionId: lease.sessionId }, _sum: { usedMs: true } })
  await tx.cunningSession.update({ where: { id: lease.sessionId }, data: { durationSec: Number(((usage._sum.usedMs ?? 0n) + 999n) / 1000n) } })
  return end
}

/** Server clock and User row serialize reservation across tabs, sessions and both audio channels.
 * Not yet wired to routes: legacy duration backfill and client cutover must precede activation.
 * testNow is for deterministic local DB tests only; routes must never forward client time.
 */
export async function updateCunningRecording(db: PrismaClient, userId: string, sessionId: string, command: Command, testNow?: Date): Promise<Result> {
  const key = command.action === 'start' ? command.requestKey : command.token
  if (typeof key !== 'string' || !key || key.length > 128) return { state: 'conflict' }
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const user = await tx.user.findUnique({ where: { id: userId }, select: { plan: true } })
    if (!user) return { state: 'missing' }
    await carryLegacyCunningUsage(tx, userId)
    const clock = testNow ?? (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now
    if (!Number.isFinite(clock.getTime())) throw new Error('Invalid recording clock')
    // Expired reservations become final usage, never an unbounded charge after a crash.
    const expired = await tx.cunningRecordingLease.findMany({ where: { userId, stoppedAt: null, expiresAt: { lte: clock } } })
    for (const lease of expired) {
      await settle(tx, lease, lease.expiresAt)
      await closeExpired(tx, lease)
    }
    await tx.$queryRaw`SELECT id FROM cunning_sessions WHERE id = ${sessionId} AND "userId" = ${userId} FOR NO KEY UPDATE`
    const session = await tx.cunningSession.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== userId || session.status === 'deleted') return { state: 'missing' }
    if (session.recordingVersion !== 2) return { state: 'legacy' }
    let lease = await tx.cunningRecordingLease.findUnique({ where: { sessionId } })
    if (command.action === 'start') {
      if (lease) {
        if (lease.requestKey !== command.requestKey) return { state: 'conflict' }
        return lease.stoppedAt || session.status !== 'active' ? { state: 'stopped' } : { state: 'active', token: lease.token, expiresAt: lease.expiresAt, validForMs: Math.max(0, lease.expiresAt.getTime() - clock.getTime()) }
      }
      if (session.status !== 'active' || session.durationSec !== 0) return { state: 'stopped' }
    } else {
      if (!lease || lease.token !== command.token) return { state: 'conflict' }
      if (lease.stoppedAt) return { state: 'stopped' }
      if (clock < lease.settledThrough) return { state: 'conflict' }
      await settle(tx, lease, clock)
      await tx.cunningUsageAllocation.updateMany({ where: { sessionId }, data: { reservedMs: 0n } })
      if (command.action === 'stop' || session.status !== 'active') {
        await tx.cunningRecordingLease.update({ where: { sessionId }, data: { stoppedAt: clock } })
        if (session.status === 'active') await tx.cunningSession.update({ where: { id: sessionId }, data: {
          status: 'ended', endedAt: clock,
        } })
        return { state: 'stopped' }
      }
    }
    const limit = process.env.DOYA_DISABLE_LIMITS === '1' ? -1 : CUNNING_LIMITS[tierFrom(user.plan)].maxMinutesPerMonth
    const cap = limit < 0 ? null : BigInt(limit) * 60_000n
    let allowedMs = 0
    const pieces: { monthStart: Date; milliseconds: number }[] = []
    for (const part of splitCunningInterval(clock, new Date(clock.getTime() + LEASE_MS))) {
      const used = await tx.cunningUsageAllocation.aggregate({ where: { userId, monthStart: part.monthStart }, _sum: { usedMs: true, reservedMs: true } })
      const available = cap === null ? BigInt(part.milliseconds) : cap - (used._sum.usedMs ?? 0n) - (used._sum.reservedMs ?? 0n)
      const granted = available <= 0n ? 0 : Number(available < BigInt(part.milliseconds) ? available : BigInt(part.milliseconds))
      if (granted) pieces.push({ monthStart: part.monthStart, milliseconds: granted })
      allowedMs += granted
      if (granted < part.milliseconds) break
    }
    if (!allowedMs) {
      if (lease) {
        await tx.cunningRecordingLease.update({ where: { sessionId }, data: { stoppedAt: clock } })
        await tx.cunningSession.updateMany({ where: { id: sessionId, status: 'active' }, data: { status: 'ended', endedAt: clock } })
      }
      return { state: 'limit' }
    }
    const expiresAt = new Date(clock.getTime() + allowedMs)
    if (!lease) lease = await tx.cunningRecordingLease.create({ data: { sessionId, userId, requestKey: key, token: randomUUID(), startedAt: clock, settledThrough: clock, expiresAt } })
    else lease = await tx.cunningRecordingLease.update({ where: { sessionId }, data: { expiresAt } })
    for (const part of pieces) await tx.cunningUsageAllocation.upsert({
      where: { sessionId_monthStart: { sessionId, monthStart: part.monthStart } },
      create: { sessionId, userId, monthStart: part.monthStart, reservedMs: BigInt(part.milliseconds) },
      update: { reservedMs: BigInt(part.milliseconds) },
    })
    return { state: 'active', token: lease.token, expiresAt, validForMs: allowedMs }
  }, { maxWait: 5000, timeout: 15000 })
}
