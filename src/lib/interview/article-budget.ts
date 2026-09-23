import { createHash, randomUUID } from 'node:crypto'
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

export type ArticleClaim = { key: string; day: string }
export type ArticleAdmission =
  | { state: 'allowed'; claim: ArticleClaim; limit: number }
  | { state: 'limit'; limit: number }
  | { state: 'unavailable' }

/** Atomically reserve one article attempt across all app instances. */
export async function claimArticleBudget(identity: { userId: string | null; guestId: string | null; plan: InterviewPlanCode }): Promise<ArticleAdmission> {
  const subject = identity.userId ? `user:${identity.userId}` : identity.guestId ? `guest:${identity.guestId}` : null
  if (!subject) return { state: 'unavailable' }
  const limit = interviewArticleDailyLimit(identity.plan)
  const key = `interview-article:v1:${createHash('sha256').update(subject).digest('hex')}`
  try {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
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
    return { state: 'allowed', claim: { key, day }, limit }
  } catch {
    console.error('[interview] article budget unavailable')
    return { state: 'unavailable' }
  }
}

/** Refund only the same JST day's failed attempt. A DB outage fails closed. */
export async function refundArticleBudget(claim: ArticleClaim): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "SystemSetting" SET "value" = (
        "value"::jsonb || jsonb_build_object('count', GREATEST(0, ("value"::jsonb->>'count')::integer - 1))
      )::text
      WHERE "key" = ${claim.key} AND "value"::jsonb->>'day' = ${claim.day}
        AND ("value"::jsonb->>'count')::integer > 0
    `
  } catch {
    console.error('[interview] article budget refund unavailable')
  }
}
