import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DAILY_CONCEPT_LIMIT, isPaid, type AdImageIdentity } from './access'

export type AnalysisLease = { key: string; token: string }
type Admission = { ok: true; lease: AnalysisLease } | { ok: false; reason: 'busy' | 'limit' | 'unavailable' }

/** Copy preparation allows four attempts per image-concept slot (FREE 20 / PRO 160). */
type QueryClient = Pick<Prisma.TransactionClient, '$queryRaw' | 'systemSetting'>

/** Legacy standalone entry point; durable operations use the transaction form below. */
export async function claimAnalysisBudget(identity: AdImageIdentity): Promise<Admission> {
  try { return await claimWithClient(prisma, identity) }
  catch {
    console.error('[adimage] shared analysis budget unavailable')
    return { ok: false, reason: 'unavailable' }
  }
}

async function claimWithClient(client: QueryClient, identity: AdImageIdentity): Promise<Admission> {
  if (!identity.userId || !['FREE', 'PRO'].includes(identity.plan)) return { ok: false, reason: 'unavailable' }
  const limit = DAILY_CONCEPT_LIMIT[identity.plan] * 4
  const key = `adimage-analysis:v1:${createHash('sha256').update(identity.userId).digest('hex')}`
  const token = randomUUID()
  // The existing unique key serializes requests, including simultaneous first use.
  // One row per user holds both the JST daily counter and a recoverable lease.
  // The lease outlasts this API's maxDuration=300, so active AI work cannot overlap.
  const rows = await client.$queryRaw<Array<{ value: string }>>`
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
  const row = await client.systemSetting.findUnique({ where: { key }, select: { value: true } })
  const state = row ? JSON.parse(row.value) as { token?: string | null; until?: number } : null
  return { ok: false, reason: state?.token && Number(state.until) > Date.now() ? 'busy' : 'limit' }
}

/** Admit under the same lock/transaction as the durable operation receipt.
 * The paid limit comes from the locked User row, never a stale session/parameter.
 * Database errors propagate so callers cannot commit a partial admission.
 */
export async function claimAnalysisBudgetInTransaction(tx: Prisma.TransactionClient, actor: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(actor)) throw new Error('Analysis actor is invalid')
  const users = await tx.$queryRaw<Array<{ plan: string }>>`SELECT plan FROM "User" WHERE id = ${actor} FOR UPDATE`
  if (!users[0]) return { ok: false as const, reason: 'unavailable' as const }
  const key = `adimage-analysis:v1:${createHash('sha256').update(actor).digest('hex')}`
  const prior = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (prior) {
    if (Buffer.byteLength(prior.value) > 2048) throw new Error('Analysis budget state is invalid')
    const state = JSON.parse(prior.value)
    if (!state || typeof state !== 'object' || Array.isArray(state) || typeof state.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.day)
      || !Number.isFinite(Date.parse(state.day + 'T00:00:00Z')) || new Date(state.day + 'T00:00:00Z').toISOString().slice(0, 10) !== state.day
      || !Number.isSafeInteger(state.count) || state.count < 0 || typeof state.until !== 'number' || !Number.isFinite(state.until) || state.until < 0
      || (state.token !== null && (typeof state.token !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(state.token)))
      || (state.token === null ? state.until !== 0 : state.until === 0)) throw new Error('Analysis budget state is invalid')
  }
  const plan: 'PRO' | 'FREE' = isPaid(users[0].plan) ? 'PRO' : 'FREE'
  const admission = await claimWithClient(tx, { userId: actor, guestId: null, plan })
  const current = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  const used = current ? JSON.parse(current.value).count as number : 0
  return { ...admission, plan, limit: DAILY_CONCEPT_LIMIT[plan] * 4, used }
}

/** Finalization is part of result/receipt commit. An expired worker cannot save,
 * release or refund anything, even when no replacement worker has arrived yet.
 */
export async function finishAnalysisBudgetInTransaction(tx: Prisma.TransactionClient, lease: AnalysisLease, refund: boolean): Promise<boolean> {
  if (!/^adimage-analysis:v1:[a-f0-9]{64}$/.test(lease.key) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(lease.token)) throw new Error('Analysis lease is invalid')
  const changed = await tx.$executeRaw`
    UPDATE "SystemSetting" SET "value" = (
      "value"::jsonb || jsonb_build_object(
        'token', NULL, 'until', 0,
        'count', GREATEST(0, ("value"::jsonb->>'count')::integer - ${refund ? 1 : 0})
      )
    )::text
    WHERE "key" = ${lease.key} AND "value"::jsonb->>'token' = ${lease.token}
      AND ("value"::jsonb->>'until')::numeric > EXTRACT(EPOCH FROM clock_timestamp()) * 1000
  `
  return changed === 1
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
