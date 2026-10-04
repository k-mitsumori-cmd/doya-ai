import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { interviewJstMonthStartUtc } from './month'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const safeId = /^[A-Za-z0-9_-]{1,128}$/

type ClaimResult = { state: 'claimed'; count: number } | { state: 'busy' }

function quota(value: string): { usedSeconds: number; reservedSeconds: number } {
  const parsed = JSON.parse(value) as { usedSeconds?: unknown; reservedSeconds?: unknown }
  if (!Number.isSafeInteger(parsed.usedSeconds) || Number(parsed.usedSeconds) < 0 ||
      !Number.isSafeInteger(parsed.reservedSeconds) || Number(parsed.reservedSeconds) < 0) {
    throw new Error('Invalid interview transcription quota')
  }
  return { usedSeconds: Number(parsed.usedSeconds), reservedSeconds: Number(parsed.reservedSeconds) }
}

async function transferDailyBudget(tx: Prisma.TransactionClient, kind: 'article' | 'aux', userId: string, guestId: string, day: string) {
  const guestKey = `interview-${kind}:v1:${hash(`guest:${guestId}`)}`
  const userKey = `interview-${kind}:v1:${hash(`user:${userId}`)}`
  const guestRows = await tx.$queryRaw<Array<{ value: string }>>`
    SELECT "value" FROM "SystemSetting" WHERE "key" = ${guestKey} FOR UPDATE
  `
  if (!guestRows.length) return
  const guest = JSON.parse(guestRows[0].value) as { day?: unknown; count?: unknown }
  if (typeof guest.day !== 'string' || !Number.isSafeInteger(guest.count) || Number(guest.count) < 0) {
    throw new Error('Invalid interview daily quota')
  }
  if (guest.day !== day || guest.count === 0) return
  const count = Number(guest.count)
  await tx.$executeRaw`
    INSERT INTO "SystemSetting" ("id", "key", "value")
    VALUES (${randomUUID()}, ${userKey}, jsonb_build_object('day', ${day}, 'count', ${count})::text)
    ON CONFLICT ("key") DO UPDATE SET "value" = jsonb_build_object(
      'day', ${day},
      'count', CASE WHEN "SystemSetting"."value"::jsonb->>'day' = ${day}
        THEN ("SystemSetting"."value"::jsonb->>'count')::integer + ${count}
        ELSE ${count} END
    )::text
  `
  // Keep the transfer date with the guest counter so an in-flight failed
  // generation can refund the account copy only when this day's count moved.
  await tx.$executeRaw`
    UPDATE "SystemSetting" SET "value" = (
      "value"::jsonb || jsonb_build_object('transferredToUserId', ${userId}, 'transferDay', ${day})
    )::text WHERE "key" = ${guestKey}
  `
}

/** Claim only projects still owned by the supplied guest cookie, without moving storage objects. */
export async function claimInterviewGuestProjects(userId: string, guestId: string, now = new Date()): Promise<ClaimResult> {
  if (!safeId.test(userId) || !safeId.test(guestId)) throw new Error('Invalid interview owner')
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-guest-project'), hashtext(${guestId}))`
    const candidates = await tx.interviewProject.findMany({
      where: { guestId, userId: null }, select: { id: true }, orderBy: { id: 'asc' }, take: 101,
    })
    if (candidates.length > 100) throw new Error('Too many interview guest projects to claim')
    if (!candidates.length) return { state: 'claimed', count: 0 }
    const ids = candidates.map(project => project.id)
    for (const id of ids) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'), hashtext(${id}))`
    }
    const active = await Promise.all([
      tx.interviewMaterial.count({ where: { projectId: { in: ids }, status: 'PROCESSING' } }),
      tx.interviewTranscription.count({ where: { projectId: { in: ids }, status: 'PROCESSING' } }),
    ])
    if (active.some(count => count > 0)) return { state: 'busy' }

    const monthStart = interviewJstMonthStartUtc(now)
    const month = new Date(monthStart.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7)
    const quotaKey = `interview-transcription:v1:${hash(`user:${userId}`)}:${month}`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-transcription'), hashtext(${quotaKey}))`
    const completed = await tx.interviewMaterial.aggregate({
      where: { projectId: { in: ids }, status: 'COMPLETED', updatedAt: { gte: monthStart } },
      _sum: { duration: true },
    })
    const seconds = completed._sum.duration || 0
    if (!Number.isSafeInteger(seconds) || seconds < 0) throw new Error('Invalid interview transcription duration')
    const accountQuota = await tx.systemSetting.findUnique({ where: { key: quotaKey }, select: { value: true } })
    if (accountQuota && seconds > 0) {
      const current = quota(accountQuota.value)
      if (!Number.isSafeInteger(current.usedSeconds + seconds)) throw new Error('Interview transcription quota overflow')
      await tx.systemSetting.update({
        where: { key: quotaKey },
        data: { value: JSON.stringify({ ...current, usedSeconds: current.usedSeconds + seconds }) },
      })
    }

    const day = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await transferDailyBudget(tx, 'article', userId, guestId, day)
    await transferDailyBudget(tx, 'aux', userId, guestId, day)
    const updated = await tx.interviewProject.updateMany({
      where: { id: { in: ids }, guestId, userId: null }, data: { userId },
    })
    if (updated.count !== ids.length) throw new Error('Interview guest ownership changed during claim')
    return { state: 'claimed', count: updated.count }
  }, { timeout: 20_000 })
}
