import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type SeoTool = 'title-suggestions' | 'compare-candidates' | 'swipe-questions'

// These ceilings protect external provider capacity; they are not paid plan allowances.
export const SEO_TOOL_DAILY_LIMITS: Record<SeoTool, number> = {
  'title-suggestions': 50,
  'compare-candidates': 10,
  'swipe-questions': 50,
}

export class SeoToolRateLimitError extends Error {
  constructor(readonly limit: number) {
    super('SEO tool daily rate limit reached')
  }
}

function jstDay(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function seoToolUsageKey(userId: string, tool: SeoTool): string {
  const identity = createHash('sha256').update(userId).digest('hex')
  return `seo-tool-usage:v1:${tool}:${identity}`
}

/** Reserve one provider call before making it. A failed call still counts as an attempt. */
export async function reserveSeoToolCall(
  userId: string,
  tool: SeoTool,
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<{ used: number; remaining: number }> {
  if (!userId.trim()) throw new Error('SEO tool identity is required')
  const key = seoToolUsageKey(userId, tool)
  const day = jstDay(now)
  const limit = SEO_TOOL_DAILY_LIMITS[tool]

  return db.$transaction(async tx => {
    // The lock serializes the read/check/write sequence across serverless instances.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const current = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const value = current?.value || ''
    if (value && !/^\d{4}-\d{2}-\d{2}:\d+$/.test(value)) throw new Error('SEO tool usage ledger invalid')
    const used = value.startsWith(`${day}:`) ? Number(value.slice(day.length + 1)) : 0
    if (!Number.isSafeInteger(used)) throw new Error('SEO tool usage ledger invalid')
    if (used >= limit) throw new SeoToolRateLimitError(limit)
    await tx.systemSetting.upsert({
      where: { key },
      create: { key, value: `${day}:${used + 1}` },
      update: { value: `${day}:${used + 1}` },
    })
    return { used: used + 1, remaining: limit - used - 1 }
  }, { timeout: 15000 })
}
