import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type SeoTool = 'title-suggestions' | 'compare-candidates' | 'swipe-questions' | 'article-images' | 'image-suggestions'

// These ceilings protect external provider capacity; they are not paid plan allowances.
export const SEO_TOOL_DAILY_LIMITS: Record<SeoTool, number> = {
  'title-suggestions': 50,
  'compare-candidates': 10,
  'swipe-questions': 50,
  'article-images': 100,
  'image-suggestions': 50,
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
  return reserveSeoToolCalls(userId, tool, 1, db, now)
}

/** Atomically reserve every image in a batch before any provider call starts. */
export async function reserveSeoToolCalls(
  userId: string,
  tool: SeoTool,
  amount: number,
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<{ used: number; remaining: number }> {
  if (!userId.trim()) throw new Error('SEO tool identity is required')
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > SEO_TOOL_DAILY_LIMITS[tool]) throw new Error('Invalid SEO tool reservation amount')
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
    if (used + amount > limit) throw new SeoToolRateLimitError(limit)
    await tx.systemSetting.upsert({
      where: { key },
      create: { key, value: `${day}:${used + amount}` },
      update: { value: `${day}:${used + amount}` },
    })
    return { used: used + amount, remaining: limit - used - amount }
  }, { timeout: 15000 })
}
