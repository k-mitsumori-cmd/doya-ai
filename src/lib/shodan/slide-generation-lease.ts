import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const LEASE_MS = 360_000 // Outlasts the 300-second route lifetime.

export class ShodanSlideGenerationInProgressError extends Error {
  constructor() { super('Shodan slide generation already in progress') }
}

function leaseKey(preparationId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(preparationId)) throw new Error('Invalid preparation ID')
  return `shodan-slide-generation:v1:${preparationId}`
}

/** One image batch or regeneration per preparation at a time, across serverless instances. */
export async function claimShodanSlideLease(preparationId: string, db: PrismaClient = prisma, now = Date.now()): Promise<string> {
  const key = leaseKey(preparationId)
  const token = `${now + LEASE_MS}:${randomUUID()}`
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (row) {
      const expiresAt = Number(row.value.split(':', 1)[0])
      if (!Number.isSafeInteger(expiresAt)) throw new Error('Shodan slide lease invalid')
      if (expiresAt > now) throw new ShodanSlideGenerationInProgressError()
    }
    await tx.systemSetting.upsert({ where: { key }, create: { key, value: token }, update: { value: token } })
  }, { timeout: 15_000 })
  return token
}

export async function releaseShodanSlideLease(preparationId: string, token: string, db: PrismaClient = prisma): Promise<void> {
  await db.systemSetting.deleteMany({ where: { key: leaseKey(preparationId), value: token } })
}
