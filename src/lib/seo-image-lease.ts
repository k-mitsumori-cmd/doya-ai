import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const LEASE_MS = 360_000 // Longer than the image API's 300-second function lifetime.

export class SeoImageGenerationInProgressError extends Error {
  constructor() { super('SEO article images are already being generated') }
}

function leaseKey(articleId: string): string {
  return `seo-image-ensure:v1:${articleId}`
}

/** Prevent two serverless instances from filling the same article at once. */
export async function claimSeoImageLease(articleId: string, db: PrismaClient = prisma, now = Date.now()): Promise<string> {
  const key = leaseKey(articleId)
  const token = `${now + LEASE_MS}:${randomUUID()}`
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (row) {
      const expiresAt = Number(row.value.split(':', 1)[0])
      if (!Number.isSafeInteger(expiresAt)) throw new Error('SEO image lease invalid')
      if (expiresAt > now) throw new SeoImageGenerationInProgressError()
    }
    await tx.systemSetting.upsert({ where: { key }, create: { key, value: token }, update: { value: token } })
  }, { timeout: 15000 })
  return token
}

export async function releaseSeoImageLease(articleId: string, token: string, db: PrismaClient = prisma): Promise<void> {
  await db.systemSetting.deleteMany({ where: { key: leaseKey(articleId), value: token } })
}
