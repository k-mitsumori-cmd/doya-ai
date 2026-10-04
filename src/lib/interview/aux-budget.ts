import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { InterviewPlanCode } from './types'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'

const AUX_LIMIT: Record<InterviewPlanCode, number> = {
  GUEST: 2,
  FREE: 5,
  LIGHT: 10,
  PRO: 30,
  ENTERPRISE: 100,
}

export type AuxClaim = { key: string; day: string; guestId: string | null }
export type AuxAdmission =
  | { state: 'allowed'; claim: AuxClaim; limit: number }
  | { state: 'limit'; limit: number }
  | { state: 'owner_changed' }
  | { state: 'unavailable' }

export function auxAdmissionError(admission: Exclude<AuxAdmission, { state: 'allowed' }>, plan: InterviewPlanCode): NextResponse {
  if (admission.state === 'owner_changed') {
    return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません。画面を再読み込みしてください。' }, { status: 404 })
  }
  if (admission.state === 'limit') {
    return NextResponse.json({
      success: false,
      code: 'INTERVIEW_AUX_LIMIT_REACHED',
      error: `本日の追加AI編集上限（${admission.limit}回）に達しました。`,
      limit: admission.limit,
      ...(plan === 'PRO' || plan === 'ENTERPRISE' ? { contactUrl: SUPPORT_CONTACT_URL } : { upgradeUrl: '/interview/pricing' }),
    }, { status: 429 })
  }
  return NextResponse.json({ success: false, error: '利用状況を確認できません。時間をおいて再試行してください。' }, { status: 503 })
}

export function interviewAuxDailyLimit(plan: InterviewPlanCode): number {
  return AUX_LIMIT[plan]
}

/** Reserve one manual AI-assisted edit across all app instances. */
export async function claimAuxBudget(identity: { userId: string | null; guestId: string | null; plan: InterviewPlanCode; projectId: string }): Promise<AuxAdmission> {
  const { userId, guestId, projectId } = identity
  const subject = userId ? `user:${userId}` : guestId ? `guest:${guestId}` : null
  if (!subject) return { state: 'unavailable' }
  const limit = interviewAuxDailyLimit(identity.plan)
  const key = `interview-aux:v1:${createHash('sha256').update(subject).digest('hex')}`
  const reserve = async (db: Prisma.TransactionClient | typeof prisma): Promise<AuxAdmission> => {
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
    return { state: 'allowed', claim: { key, day: (JSON.parse(rows[0].value) as { day: string }).day, guestId: userId ? null : guestId }, limit }
  }
  try {
    if (guestId && !userId) {
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
    console.error('[interview] auxiliary budget unavailable')
    return { state: 'unavailable' }
  }
}

export async function refundAuxBudget(claim: AuxClaim): Promise<void> {
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
        const accountKey = `interview-aux:v1:${createHash('sha256').update(`user:${transferredToUserId}`).digest('hex')}`
        await decrement(tx, accountKey)
      }
    }, { timeout: 20_000 })
  } catch {
    console.error('[interview] auxiliary budget refund unavailable')
  }
}

export type IncludedProofreadClaim = { key: string; lease: string }
export type IncludedProofreadAdmission =
  | { state: 'allowed'; claim: IncludedProofreadClaim }
  | { state: 'already' | 'busy' | 'unavailable' }

/** Every generated draft includes one proofreading attempt; a lease prevents concurrent free calls. */
export async function claimIncludedProofread(draftId: string): Promise<IncludedProofreadAdmission> {
  const key = `interview-proofread-included:v1:${createHash('sha256').update(draftId).digest('hex')}`
  const lease = randomUUID()
  try {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" ("id", "key", "value")
      VALUES (${randomUUID()}, ${key}, jsonb_build_object(
        'state', 'pending', 'lease', ${lease}, 'expires', extract(epoch FROM clock_timestamp()) + 600
      )::text)
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
      WHERE "SystemSetting"."value"::jsonb->>'state' = 'pending'
        AND ("SystemSetting"."value"::jsonb->>'expires')::double precision < extract(epoch FROM clock_timestamp())
      RETURNING "value"
    `
    if (rows.length) return { state: 'allowed', claim: { key, lease } }
    const existing = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT "value" FROM "SystemSetting" WHERE "key" = ${key}
    `
    const state = existing.length ? (JSON.parse(existing[0].value) as { state: string }).state : null
    return { state: state === 'done' ? 'already' : 'busy' }
  } catch {
    console.error('[interview] included proofread admission unavailable')
    return { state: 'unavailable' }
  }
}

export async function finishIncludedProofread(claim: IncludedProofreadClaim): Promise<boolean> {
  try {
    const changed = await prisma.$executeRaw`
      UPDATE "SystemSetting" SET "value" = jsonb_build_object('state', 'done')::text
      WHERE "key" = ${claim.key} AND "value"::jsonb->>'state' = 'pending'
        AND "value"::jsonb->>'lease' = ${claim.lease}
    `
    return changed === 1
  } catch {
    console.error('[interview] included proofread settlement unavailable')
    return false
  }
}

export async function refundIncludedProofread(claim: IncludedProofreadClaim): Promise<void> {
  try {
    await prisma.$executeRaw`
      DELETE FROM "SystemSetting" WHERE "key" = ${claim.key}
        AND "value"::jsonb->>'state' = 'pending'
        AND "value"::jsonb->>'lease' = ${claim.lease}
    `
  } catch {
    console.error('[interview] included proofread refund unavailable')
  }
}
