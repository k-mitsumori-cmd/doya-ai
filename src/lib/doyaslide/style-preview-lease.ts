import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const LEASE_MS = 360_000 // Exceeds the 300-second route lifetime.
const DAILY_BUDGET = 120 // All 32 styles can be cached once, with a small retry allowance.
const BUDGET_KEY = 'doyaslide-style-preview-budget:v1'

export class StylePreviewInProgressError extends Error {
  constructor() { super('Style preview generation is already in progress') }
}

export class StylePreviewBudgetError extends Error {
  constructor() { super('Daily style preview generation budget exhausted') }
}

function leaseKey(style: string) {
  if (!/^[a-z0-9-]{1,64}$/.test(style)) throw new Error('Invalid style preview key')
  return `doyaslide-style-preview:v1:${style}`
}

export async function claimStylePreviewLease(style: string, db: PrismaClient = prisma, now = Date.now()) {
  const key = leaseKey(style)
  const token = `${now + LEASE_MS}:${randomUUID()}`
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (row) {
      const expiresAt = Number(row.value.split(':', 1)[0])
      if (!Number.isSafeInteger(expiresAt)) throw new Error('Invalid style preview lease')
      if (expiresAt > now) throw new StylePreviewInProgressError()
    }
    await tx.systemSetting.upsert({ where: { key }, create: { key, value: token }, update: { value: token } })
  }, { timeout: 15000 })
  return token
}

export async function releaseStylePreviewLease(style: string, token: string, db: PrismaClient = prisma) {
  await db.systemSetting.deleteMany({ where: { key: leaseKey(style), value: token } })
}

/** Global provider ceiling; reserve missing pages atomically before generating any image. */
export async function reserveStylePreviewImages(amount: number, db: PrismaClient = prisma, now = new Date()) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 3) throw new Error('Invalid style preview amount')
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${BUDGET_KEY}))`
    const row = await tx.systemSetting.findUnique({ where: { key: BUDGET_KEY }, select: { value: true } })
    const value = row?.value || ''
    if (value && !/^\d{4}-\d{2}-\d{2}:\d+$/.test(value)) throw new Error('Invalid style preview budget ledger')
    const used = value.startsWith(`${day}:`) ? Number(value.slice(day.length + 1)) : 0
    if (!Number.isSafeInteger(used)) throw new Error('Invalid style preview budget ledger')
    if (used + amount > DAILY_BUDGET) throw new StylePreviewBudgetError()
    const next = `${day}:${used + amount}`
    await tx.systemSetting.upsert({ where: { key: BUDGET_KEY }, create: { key: BUDGET_KEY, value: next }, update: { value: next } })
  }, { timeout: 15000 })
}
