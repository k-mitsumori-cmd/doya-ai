import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Operational provider guard, separate from monthly preparation entitlements.
export const SHODAN_PROFILE_DAILY_LIMIT = 50

export class ShodanProfileDailyLimitError extends Error {
  constructor() {
    super('Shodan profile extraction daily limit reached')
  }
}

export function shodanProfileUsageKey(organizationId: string): string {
  return `shodan-profile-extraction:v1:${createHash('sha256').update(organizationId).digest('hex')}`
}

/** Reserve before website fetch and AI. Failed attempts count to prevent retry storms. */
export async function reserveShodanProfileExtraction(
  organizationId: string,
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<void> {
  if (!organizationId.trim()) throw new Error('Shodan organization identity is required')
  const key = shodanProfileUsageKey(organizationId)
  const day = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const current = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const value = current?.value || ''
    if (value && !/^\d{4}-\d{2}-\d{2}:\d+$/.test(value)) throw new Error('Shodan profile extraction ledger invalid')
    const used = value.startsWith(`${day}:`) ? Number(value.slice(day.length + 1)) : 0
    if (!Number.isSafeInteger(used)) throw new Error('Shodan profile extraction ledger invalid')
    if (used >= SHODAN_PROFILE_DAILY_LIMIT) throw new ShodanProfileDailyLimitError()
    await tx.systemSetting.upsert({
      where: { key },
      create: { key, value: `${day}:${used + 1}` },
      update: { value: `${day}:${used + 1}` },
    })
  }, { timeout: 15000 })
}
