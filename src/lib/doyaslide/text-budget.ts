import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type DoyaSlideTextTool = 'url-analysis' | 'structure'

// Provider protection, separate from the plan's monthly project and slide allowances.
export const DOYASLIDE_TEXT_DAILY_LIMITS: Record<DoyaSlideTextTool, number> = {
  'url-analysis': 50,
  structure: 50,
}

export class DoyaSlideTextLimitError extends Error {
  constructor(readonly limit: number) {
    super('DoyaSlide text tool daily limit reached')
  }
}

export function doyaSlideTextUsageKey(userId: string, tool: DoyaSlideTextTool): string {
  const identity = createHash('sha256').update(userId).digest('hex')
  return `doyaslide-text-usage:v1:${tool}:${identity}`
}

/** Reserve before external fetches and provider calls. Failed attempts still count. */
export async function reserveDoyaSlideTextCall(
  userId: string,
  tool: DoyaSlideTextTool,
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<{ used: number; remaining: number }> {
  if (!userId.trim()) throw new Error('DoyaSlide text tool identity is required')
  const limit = DOYASLIDE_TEXT_DAILY_LIMITS[tool]
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Unknown DoyaSlide text tool')
  const key = doyaSlideTextUsageKey(userId, tool)
  const day = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const current = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const value = current?.value || ''
    if (value && !/^\d{4}-\d{2}-\d{2}:\d+$/.test(value)) throw new Error('DoyaSlide text usage ledger invalid')
    const used = value.startsWith(`${day}:`) ? Number(value.slice(day.length + 1)) : 0
    if (!Number.isSafeInteger(used)) throw new Error('DoyaSlide text usage ledger invalid')
    if (used >= limit) throw new DoyaSlideTextLimitError(limit)
    await tx.systemSetting.upsert({
      where: { key },
      create: { key, value: `${day}:${used + 1}` },
      update: { value: `${day}:${used + 1}` },
    })
    return { used: used + 1, remaining: limit - used - 1 }
  }, { timeout: 15000 })
}
