import { randomUUID } from 'crypto'
import type { PrismaClient, Prisma } from '@prisma/client'
import { getPersonaDailyLimitByUserPlan, isWithinFreeHour } from '@/lib/pricing'
import { includedPersonaImages } from './image-entitlements'
import { personaUsageDay } from './usage-day'

type ProjectInput = { userId: string; requestKey: string; inputHash: string; sourceUrl?: string | null }

/** The server computes inputHash from validated input. No AI call runs inside this transaction. */
export async function reservePersonaProject(db: PrismaClient, input: ProjectInput, now = new Date()) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(input.requestKey) || !/^[a-f0-9]{64}$/.test(input.inputHash)) throw new Error('Invalid persona reservation')
  if (input.sourceUrl != null && (typeof input.sourceUrl !== 'string' || input.sourceUrl.length > 8192)) throw new Error('Invalid persona source URL')
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { plan: true, firstLoginAt: true } })
    if (!user) return { state: 'unauthorized' as const }
    const day = personaUsageDay(now)
    // One-time carry-forward of today's usage when activating the new ledger.
    const legacy = await tx.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId: input.userId, serviceId: 'persona' } } })
    const carriedUsage = legacy?.lastUsageReset && personaUsageDay(legacy.lastUsageReset).getTime() === day.getTime() ? Math.max(0, legacy.dailyUsage) : 0
    await tx.personaUsageDay.upsert({ where: { userId_day: { userId: input.userId, day } },
      create: { userId: input.userId, day, used: carriedUsage }, update: {} })
    const expired = await tx.personaProject.findMany({ where: { userId: input.userId, status: 'pending', leaseExpiresAt: { lte: now } } })
    for (const project of expired) {
      await releasePersonaProjectReservation(tx, input.userId, project.usageDay, false, now)
      await tx.personaProject.update({ where: { id: project.id }, data: { status: 'failed', failureCode: 'LEASE_EXPIRED' } })
    }
    const existing = await tx.personaProject.findUnique({ where: { userId_requestKey: { userId: input.userId, requestKey: input.requestKey } } })
    if (existing) {
      if (existing.inputHash !== input.inputHash) return { state: 'conflict' as const }
      if (existing.deletedAt) return { state: 'deleted' as const }
      if (existing.status === 'succeeded') return { state: 'cached' as const, project: existing }
      if (existing.status === 'pending') return { state: 'pending' as const, project: existing }
    }
    const bucket = await tx.personaUsageDay.findUniqueOrThrow({ where: { userId_day: { userId: input.userId, day } } })
    const limit = getPersonaDailyLimitByUserPlan(user.plan)
    const used = bucket.used + bucket.reserved
    if (limit >= 0 && !isWithinFreeHour(user.firstLoginAt) && used >= limit) {
      return { state: 'limit' as const, used, limit, resetAt: new Date(day.getTime() + 86400000).toISOString() }
    }
    const lease = { status: 'pending', usageDay: day, leaseToken: randomUUID(), leaseExpiresAt: new Date(now.getTime() + 15 * 60000), failureCode: null }
    const project = existing
      ? await tx.personaProject.update({ where: { id: existing.id }, data: { ...lease, sourceUrl: input.sourceUrl ?? null } })
      : await tx.personaProject.create({ data: { ...input, ...lease } })
    await tx.personaUsageDay.update({ where: { userId_day: { userId: input.userId, day } }, data: { reserved: { increment: 1 } } })
    await mirrorCurrentUsage(tx, input.userId, day, now)
    return { state: 'reserved' as const, project, used: used + 1, limit }
  }, { maxWait: 10000, timeout: 10000 })
}

/** Store the immutable text and server-derived image grants in the same commit as quota settlement. */
export async function settlePersonaProject(db: PrismaClient, userId: string, projectId: string, token: string,
  result: { data: Parameters<typeof includedPersonaImages>[0] } | { failureCode: 'PROVIDER_FAILED' | 'INVALID_RESULT' }, now = new Date()) {
  const success = 'data' in result ? { data: result.data as Prisma.InputJsonObject, includedImages: includedPersonaImages(result.data) } : null
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const project = await tx.personaProject.findFirst({ where: { id: projectId, userId, deletedAt: null, status: 'pending', leaseToken: token, leaseExpiresAt: { gt: now } } })
    if (!project) return false
    await tx.personaProject.update({ where: { id: projectId }, data: success
      ? { status: 'succeeded', ...success, failureCode: null }
      : { status: 'failed', failureCode: 'failureCode' in result ? result.failureCode : 'INVALID_RESULT' } })
    await releasePersonaProjectReservation(tx, userId, project.usageDay, !!success, now)
    return true
  }, { maxWait: 10000, timeout: 10000 })
}

/** Caller holds the User row lock. Never infer usage from visible/deletable project history. */
export async function releasePersonaProjectReservation(tx: Prisma.TransactionClient, userId: string, day: Date, succeeded: boolean, now: Date) {
  const released = await tx.personaUsageDay.updateMany({ where: { userId, day, reserved: { gt: 0 } },
    data: { reserved: { decrement: 1 }, ...(succeeded ? { used: { increment: 1 } } : {}) } })
  if (released.count !== 1) throw new Error('Persona text reservation accounting mismatch')
  await mirrorCurrentUsage(tx, userId, day, now)
}

async function mirrorCurrentUsage(tx: Prisma.TransactionClient, userId: string, day: Date, now: Date) {
  if (personaUsageDay(now).getTime() !== day.getTime()) return
  const bucket = await tx.personaUsageDay.findUniqueOrThrow({ where: { userId_day: { userId, day } } })
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } })
  // Compatibility display only. The ledger above remains authoritative after initialization.
  await tx.userServiceSubscription.upsert({ where: { userId_serviceId: { userId, serviceId: 'persona' } },
    create: { userId, serviceId: 'persona', plan: user.plan || 'FREE', dailyUsage: bucket.used + bucket.reserved, lastUsageReset: day },
    update: { dailyUsage: bucket.used + bucket.reserved, lastUsageReset: day } })
}
