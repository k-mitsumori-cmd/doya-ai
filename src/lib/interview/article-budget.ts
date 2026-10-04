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

/** Atomically reserve one article attempt across all app instances. */
export async function claimArticleBudget(identity: { userId: string | null; guestId: string | null; plan: InterviewPlanCode; projectId: string }): Promise<ArticleAdmission> {
  const { userId, guestId, projectId } = identity
  const subject = userId ? `user:${userId}` : guestId ? `guest:${guestId}` : null
  if (!subject) return { state: 'unavailable' }
  const limit = interviewArticleDailyLimit(identity.plan)
  const key = `interview-article:v1:${createHash('sha256').update(subject).digest('hex')}`
  const reserve = async (db: Prisma.TransactionClient | typeof prisma): Promise<ArticleAdmission> => {
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
  try {
    if (guestId && !userId) {
      // Guest claim uses the same lock. A reservation can only occur before its
      // quota transfer or after an ownership recheck rejects the stale request.
      return await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-guest-project'), hashtext(${guestId}))`
        const project = await tx.interviewProject.findUnique({
          where: { id: projectId }, select: { userId: true, guestId: true },
        })
        if (!project || project.userId || project.guestId !== guestId) return { state: 'owner_changed' }
        return reserve(tx)
      }, { timeout: 20_000 })
    }
    return await reserve(prisma)
  } catch {
    console.error('[interview] article budget unavailable')
    return { state: 'unavailable' }
  }
}

/** Refund only the same JST day's failed attempt. A DB outage fails closed. */
export async function refundArticleBudget(claim: ArticleClaim): Promise<void> {
  try {
    const decrement = async (db: Prisma.TransactionClient | typeof prisma, key: string) => db.$executeRaw`
      UPDATE "SystemSetting" SET "value" = (
        "value"::jsonb || jsonb_build_object('count', GREATEST(0, ("value"::jsonb->>'count')::integer - 1))
      )::text WHERE "key" = ${key} AND "value"::jsonb->>'day' = ${claim.day}
        AND ("value"::jsonb->>'count')::integer > 0
    `
    if (!claim.guestId) {
      await decrement(prisma, claim.key)
      return
    }
    await prisma.$transaction(async tx => {
      // This lock makes a refund and guest-to-account transfer observe one
      // another in a fixed order, including ordinary provider failures.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-guest-project'), hashtext(${claim.guestId}))`
      const row = await tx.systemSetting.findUnique({ where: { key: claim.key }, select: { value: true } })
      let transferredToUserId: string | null = null
      if (row) {
        const value = JSON.parse(row.value) as { day?: unknown; transferDay?: unknown; transferredToUserId?: unknown }
        if (value.day === claim.day && value.transferDay === claim.day && typeof value.transferredToUserId === 'string') {
          transferredToUserId = value.transferredToUserId
        }
      }
      await decrement(tx, claim.key)
      if (transferredToUserId) {
        const accountKey = `interview-article:v1:${createHash('sha256').update(`user:${transferredToUserId}`).digest('hex')}`
        await decrement(tx, accountKey)
      }
    }, { timeout: 20_000 })
  } catch {
    console.error('[interview] article budget refund unavailable')
  }
}
