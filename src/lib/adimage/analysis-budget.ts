import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { DAILY_CONCEPT_LIMIT, type AdImageIdentity } from './access'

type AnalysisLease = { key: string; token: string }
type Admission = { ok: true; lease: AnalysisLease } | { ok: false; reason: 'busy' | 'limit' | 'unavailable' }

/** Copy preparation allows four attempts per image-concept slot (FREE 20 / PRO 160). */
export async function claimAnalysisBudget(identity: AdImageIdentity): Promise<Admission> {
  if (!identity.userId || !['FREE', 'PRO'].includes(identity.plan)) return { ok: false, reason: 'unavailable' }
  const limit = DAILY_CONCEPT_LIMIT[identity.plan] * 4
  const key = `adimage-analysis:v1:${createHash('sha256').update(identity.userId).digest('hex')}`
  const token = randomUUID()
  try {
    // The existing unique key serializes requests, including simultaneous first use.
    // One row per user holds both the JST daily counter and a recoverable lease.
    // The lease outlasts this API's maxDuration=300, so active AI work cannot overlap.
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" ("id", "key", "value")
      VALUES (${randomUUID()}, ${key}, jsonb_build_object(
        'day', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD'),
        'count', 1, 'token', ${token}::text,
        'until', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP + INTERVAL '330 seconds') * 1000
      )::text)
      ON CONFLICT ("key") DO UPDATE SET "value" = jsonb_build_object(
        'day', EXCLUDED."value"::jsonb->>'day',
        'count', CASE WHEN "SystemSetting"."value"::jsonb->>'day' = EXCLUDED."value"::jsonb->>'day'
          THEN ("SystemSetting"."value"::jsonb->>'count')::integer + 1 ELSE 1 END,
        'token', EXCLUDED."value"::jsonb->>'token',
        'until', EXCLUDED."value"::jsonb->'until'
      )::text
      WHERE COALESCE(("SystemSetting"."value"::jsonb->>'until')::numeric, 0) <= EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000
        AND ("SystemSetting"."value"::jsonb->>'day' <> EXCLUDED."value"::jsonb->>'day'
          OR ("SystemSetting"."value"::jsonb->>'count')::integer < ${limit})
      RETURNING "value"
    `
    if (rows.length) return { ok: true, lease: { key, token } }
    const row = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const state = row ? JSON.parse(row.value) as { token?: string | null; until?: number } : null
    return { ok: false, reason: state?.token && Number(state.until) > Date.now() ? 'busy' : 'limit' }
  } catch {
    console.error('[adimage] shared analysis budget unavailable')
    return { ok: false, reason: 'unavailable' }
  }
}

/** Only the current lease owner can release it or refund an attempt before AI ran. */
export async function finishAnalysisBudget(lease: AnalysisLease, refund: boolean): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "SystemSetting" SET "value" = (
        "value"::jsonb || jsonb_build_object(
          'token', NULL, 'until', 0,
          'count', GREATEST(0, ("value"::jsonb->>'count')::integer - ${refund ? 1 : 0})
        )
      )::text
      WHERE "key" = ${lease.key} AND "value"::jsonb->>'token' = ${lease.token}
    `
  } catch {
    // Keep the reservation on uncertain DB failure; the lease expires automatically.
    console.error('[adimage] analysis budget release failed')
  }
}
