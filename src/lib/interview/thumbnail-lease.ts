import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const LEASE_MS = 360_000 // Longer than the 300-second route lifetime.

export class ThumbnailGenerationInProgressError extends Error {
  constructor() { super('Thumbnail generation already in progress') }
}

function leaseKey(projectId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) throw new Error('Invalid project ID')
  return `interview-thumbnail-lease:v1:${projectId}`
}

export async function claimThumbnailLease(projectId: string, db: PrismaClient = prisma, now = Date.now()): Promise<string> {
  const key = leaseKey(projectId)
  const token = `${now + LEASE_MS}:${randomUUID()}`
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (row) {
      const expiresAt = Number(row.value.split(':', 1)[0])
      if (!Number.isSafeInteger(expiresAt)) throw new Error('Invalid thumbnail lease')
      if (expiresAt > now) throw new ThumbnailGenerationInProgressError()
    }
    await tx.systemSetting.upsert({ where: { key }, create: { key, value: token }, update: { value: token } })
  }, { timeout: 15_000 })
  return token
}

export async function releaseThumbnailLease(projectId: string, token: string, db: PrismaClient = prisma): Promise<void> {
  await db.systemSetting.deleteMany({ where: { key: leaseKey(projectId), value: token } })
}
