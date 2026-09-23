import { randomUUID } from 'crypto'
import type { PrismaClient, Prisma } from '@prisma/client'
import { isPaidPlan } from '@/lib/unified-plan'
import type { PersonaImageIntent } from './image-entitlements'
import { personaUsageDay } from './usage-day'
import { releasePersonaProjectReservation } from './project-ledger'
export { personaUsageDay } from './usage-day'

export function personaExtraImageLimit(plan: string | null): number {
  return isPaidPlan(plan) ? 30 : 5
}

type ReserveImage = {
  userId: string
  projectId: string
  requestKey: string
  /** SHA-256 of the server-resolved image input; not a client-provided digest. */
  inputHash: string
  slotKey: string
  kind: 'portrait' | 'scene' | 'banner'
  intent: PersonaImageIntent
}

/** No provider call inside the transaction. The returned lease is required to settle. */
export async function reservePersonaImage(db: PrismaClient, input: ReserveImage, now = new Date()) {
  if (!['included', 'extra', 'regenerate'].includes(input.intent) || !['portrait', 'scene', 'banner'].includes(input.kind) ||
      !/^[a-f0-9]{64}$/.test(input.inputHash) || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.slotKey) ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(input.requestKey)) throw new Error('Invalid image reservation')
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { plan: true } })
    if (!user) return { state: 'unauthorized' as const }
    const project = await tx.personaProject.findFirst({ where: { id: input.projectId, userId: input.userId, status: 'succeeded', deletedAt: null } })
    if (!project) return { state: 'not_found' as const }
    if (input.intent === 'included') {
      const grants = project.includedImages
      if (!Array.isArray(grants) || !grants.some(slot => slot && typeof slot === 'object' && !Array.isArray(slot) && slot.key === input.slotKey && slot.kind === input.kind)) {
        return { state: 'invalid_grant' as const }
      }
    }
    // Old workers cannot settle after expiry. A new token fences any retried attempt.
    const expired = await tx.personaImageJob.findMany({
      where: { project: { userId: input.userId }, status: 'pending', leaseExpiresAt: { lte: now } },
    })
    for (const job of expired) {
      if (job.intent !== 'included') await releaseImageReservation(tx, input.userId, job.usageDay, false)
      await tx.personaImageJob.update({ where: { id: job.id }, data: { status: 'failed', failureCode: 'LEASE_EXPIRED' } })
    }
    const requestKey = input.intent === 'included' ? `included:${input.slotKey}` : `request:${input.requestKey}`
    const existing = await tx.personaImageJob.findUnique({ where: { projectId_requestKey: { projectId: input.projectId, requestKey } } })
    if (existing) {
      if (existing.intent !== input.intent || existing.inputHash !== input.inputHash || existing.slotKey !== input.slotKey || existing.kind !== input.kind) return { state: 'conflict' as const }
      if (existing.status === 'succeeded') return { state: 'cached' as const, job: existing }
      if (existing.status === 'pending') return { state: 'pending' as const, job: existing }
    }
    if (input.intent === 'regenerate') {
      const original = await tx.personaImageJob.findFirst({ where: { projectId: input.projectId, slotKey: input.slotKey, kind: input.kind, status: 'succeeded' } })
      if (!original) return { state: 'missing_original' as const }
    }
    const usageDay = personaUsageDay(now)
    const limit = personaExtraImageLimit(user.plan)
    if (input.intent !== 'included') {
      const bucket = await tx.personaImageUsageDay.upsert({
        where: { userId_day: { userId: input.userId, day: usageDay } },
        create: { userId: input.userId, day: usageDay }, update: {},
      })
      const used = bucket.reserved + bucket.used
      if (used >= limit) return { state: 'limit' as const, used, limit, resetAt: new Date(usageDay.getTime() + 86400000).toISOString() }
      await tx.personaImageUsageDay.update({ where: { userId_day: { userId: input.userId, day: usageDay } }, data: { reserved: { increment: 1 } } })
    }
    const leaseToken = randomUUID()
    const data = { inputHash: input.inputHash, slotKey: input.slotKey, kind: input.kind, intent: input.intent, usageDay,
      status: 'pending', leaseToken, leaseExpiresAt: new Date(now.getTime() + 15 * 60 * 1000), failureCode: null, outputRef: null }
    const job = existing
      ? await tx.personaImageJob.update({ where: { id: existing.id }, data })
      : await tx.personaImageJob.create({ data: { ...data, projectId: input.projectId, requestKey } })
    return { state: 'reserved' as const, job }
  }, { maxWait: 10000, timeout: 10000 })
}

/** Failure releases the reservation once. Success only follows durable image storage. */
export async function settlePersonaImage(db: PrismaClient, userId: string, jobId: string, token: string,
  result: { outputRef: string } | { failureCode: 'PROVIDER_FAILED' | 'STORAGE_FAILED' }, now = new Date()) {
  if ('outputRef' in result && (!result.outputRef || result.outputRef.length > 2000)) throw new Error('Invalid image output reference')
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const job = await tx.personaImageJob.findFirst({ where: { id: jobId, project: { userId } } })
    if (!job) return false
    const updated = await tx.personaImageJob.updateMany({ where: {
      id: jobId, project: { userId }, leaseToken: token, status: 'pending', leaseExpiresAt: { gt: now },
    }, data: 'outputRef' in result ? { status: 'succeeded', outputRef: result.outputRef, failureCode: null }
      : { status: 'failed', failureCode: result.failureCode } })
    if (updated.count === 1 && job.intent !== 'included') await releaseImageReservation(tx, userId, job.usageDay, 'outputRef' in result)
    return updated.count === 1
  }, { maxWait: 10000, timeout: 10000 })
}

async function releaseImageReservation(tx: Prisma.TransactionClient, userId: string, day: Date, succeeded: boolean) {
  const released = await tx.personaImageUsageDay.updateMany({ where: { userId, day, reserved: { gt: 0 } },
    data: { reserved: { decrement: 1 }, ...(succeeded ? { used: { increment: 1 } } : {}) } })
  if (released.count !== 1) throw new Error('Persona image reservation accounting mismatch')
}

/** Keep usage receipts, fence outstanding workers, and erase project content in one transaction. */
export async function deletePersonaProject(db: PrismaClient, userId: string, projectId: string, now = new Date()) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const project = await tx.personaProject.findFirst({ where: { id: projectId, userId } })
    if (!project) return false
    if (project.deletedAt) {
      await eraseDeletedPersonaContent(tx, userId, projectId)
      return true
    }
    const pending = await tx.personaImageJob.findMany({ where: { projectId, status: 'pending' } })
    for (const job of pending) {
      if (job.intent !== 'included') await releaseImageReservation(tx, userId, job.usageDay, false)
      await tx.personaImageJob.update({ where: { id: job.id }, data: { status: 'failed', failureCode: 'PROJECT_DELETED' } })
    }
    if (project.status === 'pending') await releasePersonaProjectReservation(tx, userId, project.usageDay, false, now)
    await tx.personaProject.update({ where: { id: projectId }, data: {
      deletedAt: now,
      ...(project.status === 'pending' ? { status: 'failed', failureCode: 'PROJECT_DELETED' } : {}),
    } })
    await eraseDeletedPersonaContent(tx, userId, projectId)
    return true
  }, { maxWait: 10000, timeout: 10000 })
}

async function eraseDeletedPersonaContent(tx: Prisma.TransactionClient, userId: string, projectId: string) {
  // SQL NULL, not JSON null. Restrict erasure to the same owner's already-deleted row.
  // Keep IDs/hashes/usage receipts so retries cannot recreate a deleted result or refund consumed usage.
  await tx.$executeRaw`UPDATE persona_projects
    SET data = NULL, "includedImages" = NULL, "sourceUrl" = NULL
    WHERE id = ${projectId} AND "userId" = ${userId} AND "deletedAt" IS NOT NULL`
}
