import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { InterviewPlanCode } from './types'

const ARTICLE_LIMIT: Record<InterviewPlanCode, number> = {
  GUEST: 2,
  FREE: 5,
  LIGHT: 10,
  PRO: 30,
  ENTERPRISE: 100,
}

export function interviewArticleDailyLimit(plan: InterviewPlanCode): number {
  return ARTICLE_LIMIT[plan]
}

export type ArticleClaim = { key: string; day: string; guestId: string | null }
export type ArticleAdmission =
  | { state: 'allowed'; claim: ArticleClaim; limit: number }
  | { state: 'limit'; limit: number }
  | { state: 'owner_changed' }
  | { state: 'unavailable' }

export type ArticleBudgetIdentity = { userId: string | null; guestId: string | null; plan: InterviewPlanCode; projectId: string }

type StoredArticleBudget = { day: string; count: number; transferDay?: string; transferredToUserId?: string }
function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}
function storedBudget(raw: string): StoredArticleBudget {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid interview article quota')
  const row = value as Record<string, unknown>
  if (!validDay(row.day) || typeof row.count !== 'number' || !Number.isSafeInteger(row.count)
    || row.count < 0 || row.count > 2_147_483_647) throw new Error('Invalid interview article quota')
  if (row.transferDay !== undefined || row.transferredToUserId !== undefined) {
    if (!validDay(row.transferDay) || row.transferDay !== row.day || typeof row.transferredToUserId !== 'string'
      || !/^[A-Za-z0-9_-]{1,128}$/.test(row.transferredToUserId)) throw new Error('Invalid interview article quota')
  }
  return row as StoredArticleBudget
}
/** Existing rows are validated under the same transaction's row lock as the counter update. */
async function lockedBudget(db: Prisma.TransactionClient, key: string): Promise<StoredArticleBudget | null> {
  const rows = await db.$queryRaw<Array<{ value: string }>>`
    SELECT "value" FROM "SystemSetting" WHERE "key" = ${key} FOR UPDATE
  `
  return rows.length ? storedBudget(rows[0].value) : null
}

/** Caller must hold guest/project ownership locks; throws on unavailable storage. */
export async function reserveArticleBudgetInTransaction(identity: ArticleBudgetIdentity, db: Prisma.TransactionClient): Promise<ArticleAdmission> {
  const { userId, guestId } = identity
  const subject = userId ? `user:${userId}` : guestId ? `guest:${guestId}` : null
  if (!subject) return { state: 'unavailable' }
  const limit = interviewArticleDailyLimit(identity.plan)
  const key = `interview-article:v1:${createHash('sha256').update(subject).digest('hex')}`
  await lockedBudget(db, key)
  const rows = await db.$queryRaw<Array<{ value: string }>>`
    INSERT INTO "SystemSetting" ("id", "key", "value")
    VALUES (${randomUUID()}, ${key}, jsonb_build_object(
      'day', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD'), 'count', 1
    )::text)
    ON CONFLICT ("key") DO UPDATE SET "value" = jsonb_build_object(
      'day', EXCLUDED."value"::jsonb->>'day',
      'count', CASE WHEN "SystemSetting"."value"::jsonb->>'day' = EXCLUDED."value"::jsonb->>'day'
        THEN ("SystemSetting"."value"::jsonb->>'count')::integer + 1 ELSE 1 END
    )::text
    WHERE "SystemSetting"."value"::jsonb->>'day' <> EXCLUDED."value"::jsonb->>'day'
      OR ("SystemSetting"."value"::jsonb->>'count')::integer < ${limit}
    RETURNING "value"
  `
  if (!rows.length) return { state: 'limit', limit }
  const day = (JSON.parse(rows[0].value) as { day: string }).day
  return { state: 'allowed', claim: { key, day, guestId: userId ? null : guestId }, limit }
}

/** Atomically reserve one article attempt across all app instances. */
export async function claimArticleBudget(identity: ArticleBudgetIdentity): Promise<ArticleAdmission> {
  const { userId, guestId, projectId } = identity
  try {
    return await prisma.$transaction(async tx => {
      if (guestId && !userId) {
        // Guest transfer and admission use this same ownership lock.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-guest-project'), hashtext(${guestId}))`
        const project = await tx.interviewProject.findUnique({
          where: { id: projectId }, select: { userId: true, guestId: true },
        })
        if (!project || project.userId || project.guestId !== guestId) return { state: 'owner_changed' }
      }
      return reserveArticleBudgetInTransaction(identity, tx)
    }, { timeout: 20_000 })
  } catch {
    console.error('[interview] article budget unavailable')
    return { state: 'unavailable' }
  }
}

/** Refund within the same transaction as the terminal failed/cancelled receipt. */
export async function refundArticleBudgetInTransaction(claim: ArticleClaim, db: Prisma.TransactionClient): Promise<void> {
  const decrement = async (db: Prisma.TransactionClient, key: string) => {
    await lockedBudget(db, key)
    return db.$executeRaw`
    UPDATE "SystemSetting" SET "value" = (
      "value"::jsonb || jsonb_build_object('count', GREATEST(0, ("value"::jsonb->>'count')::integer - 1))
    )::text WHERE "key" = ${key} AND "value"::jsonb->>'day' = ${claim.day}
      AND ("value"::jsonb->>'count')::integer > 0
  `
  }
  if (!claim.guestId) {
    await decrement(db, claim.key)
    return
  }
  {
    const tx = db
    // This lock makes a refund and guest-to-account transfer observe one
    // another in a fixed order, including ordinary provider failures.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-guest-project'), hashtext(${claim.guestId}))`
    const row = await tx.systemSetting.findUnique({ where: { key: claim.key }, select: { value: true } })
    let transferredToUserId: string | null = null
    if (row) {
      const value = storedBudget(row.value)
      if (value.day === claim.day && value.transferDay === claim.day && typeof value.transferredToUserId === 'string') {
        transferredToUserId = value.transferredToUserId
      }
    }
    await decrement(tx, claim.key)
    if (transferredToUserId) {
      const accountKey = `interview-article:v1:${createHash('sha256').update(`user:${transferredToUserId}`).digest('hex')}`
      await decrement(tx, accountKey)
    }
  }
}

/** Refund only the same JST day's failed attempt. A DB outage fails closed. */
export async function refundArticleBudget(claim: ArticleClaim): Promise<void> {
  try {
    await prisma.$transaction(tx => refundArticleBudgetInTransaction(claim, tx), { timeout: 20_000 })
  } catch {
    console.error('[interview] article budget refund unavailable')
  }
}
