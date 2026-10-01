import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import type { InterviewPlanCode } from './types'

const RECIPE_LIMIT: Record<InterviewPlanCode, number> = {
  GUEST: 0,
  FREE: 5,
  LIGHT: 10,
  PRO: 30,
  ENTERPRISE: 100,
}

export type RecipeClaim = { key: string; day: string }
export type RecipeAdmission =
  | { state: 'allowed'; claim: RecipeClaim; limit: number }
  | { state: 'limit'; limit: number }
  | { state: 'unavailable' }

export function interviewRecipeDailyLimit(plan: InterviewPlanCode): number {
  return RECIPE_LIMIT[plan]
}

/** One successful recipe-generation attempt per claim, shared across app instances. */
export async function claimRecipeBudget(userId: string, plan: InterviewPlanCode): Promise<RecipeAdmission> {
  if (!userId.trim()) return { state: 'unavailable' }
  const limit = interviewRecipeDailyLimit(plan)
  if (limit === 0) return { state: 'limit', limit }
  const key = `interview-recipe:v1:${createHash('sha256').update(userId).digest('hex')}`
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
    console.error('[interview] recipe budget unavailable')
    return { state: 'unavailable' }
  }
}

/** Refund only a failed attempt on the same JST day. */
export async function refundRecipeBudget(claim: RecipeClaim): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "SystemSetting" SET "value" = (
        "value"::jsonb || jsonb_build_object('count', GREATEST(0, ("value"::jsonb->>'count')::integer - 1))
      )::text
      WHERE "key" = ${claim.key} AND "value"::jsonb->>'day' = ${claim.day}
        AND ("value"::jsonb->>'count')::integer > 0
    `
  } catch {
    console.error('[interview] recipe budget refund unavailable')
  }
}
