import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Provider protection; this is separate from paid recording and knowledge allowances.
export const CUNNING_COMPANY_DAILY_LIMIT = 50

export class CunningCompanyDailyLimitError extends Error {
  constructor() {
    super('Cunning company analysis daily limit reached')
  }
}

export function cunningCompanyUsageKey(userId: string): string {
  return `cunning-company-usage:v1:${createHash('sha256').update(userId).digest('hex')}`
}

/** Reserve before scraping and AI. Failed attempts count, preventing repeated provider calls. */
export async function reserveCunningCompanyAnalysis(
  userId: string,
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<void> {
  if (!userId.trim()) throw new Error('Cunning company analysis identity is required')
  const key = cunningCompanyUsageKey(userId)
  const day = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const current = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const value = current?.value || ''
    if (value && !/^\d{4}-\d{2}-\d{2}:\d+$/.test(value)) throw new Error('Cunning company analysis ledger invalid')
    const used = value.startsWith(`${day}:`) ? Number(value.slice(day.length + 1)) : 0
    if (!Number.isSafeInteger(used)) throw new Error('Cunning company analysis ledger invalid')
    if (used >= CUNNING_COMPANY_DAILY_LIMIT) throw new CunningCompanyDailyLimitError()
    await tx.systemSetting.upsert({
      where: { key },
      create: { key, value: `${day}:${used + 1}` },
      update: { value: `${day}:${used + 1}` },
    })
  }, { timeout: 15000 })
}
