import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getInterviewGuestLimits, getInterviewLimitsByPlan, INTERVIEW_PRICING } from '@/lib/pricing'
import { interviewJstMonthStartUtc } from './month'
import type { InterviewPlanCode } from './types'

type Identity = { userId: string | null; guestId: string | null; plan: InterviewPlanCode }
type Material = { id: string; projectId: string }
type QuotaState = { usedSeconds: number; reservedSeconds: number }
type Reservation = { quotaKey: string; seconds: number; transcriptionId: string }

export type TranscriptionAdmission =
  | { state: 'started' | 'processing' | 'completed'; transcriptionId: string; externalJobId?: string | null }
  | { state: 'limit'; limitSeconds: number; usedSeconds: number; reservedSeconds: number; requiredSeconds: number }
  | { state: 'too-long'; maxSeconds: number }
  | { state: 'unavailable' }

function integer(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function parseQuota(raw: string): QuotaState {
  const value = JSON.parse(raw) as Partial<QuotaState>
  if (!integer(value.usedSeconds) || !integer(value.reservedSeconds)) throw new Error('Invalid transcription quota')
  return { usedSeconds: value.usedSeconds, reservedSeconds: value.reservedSeconds }
}

function parseReservation(raw: string): Reservation {
  const value = JSON.parse(raw) as Partial<Reservation>
  if (!value.quotaKey?.startsWith('interview-transcription:v1:') || !integer(value.seconds) ||
    !value.transcriptionId || !/^[A-Za-z0-9_-]{1,128}$/.test(value.transcriptionId)) {
    throw new Error('Invalid transcription reservation')
  }
  return value as Reservation
}

function identityKey(identity: Identity, now: Date): { quotaKey: string; monthStart: Date | null; limitSeconds: number } | null {
  const subject = identity.userId ? `user:${identity.userId}` : identity.guestId ? `guest:${identity.guestId}` : null
  if (!subject) return null
  const hash = createHash('sha256').update(subject).digest('hex')
  const monthStart = identity.userId ? interviewJstMonthStartUtc(now) : null
  const month = monthStart ? new Date(monthStart.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7) : 'all'
  const limitMinutes = identity.userId
    ? getInterviewLimitsByPlan(identity.plan).transcriptionMinutes
    : getInterviewGuestLimits().transcriptionMinutes
  return { quotaKey: `interview-transcription:v1:${hash}:${month}`, monthStart, limitSeconds: limitMinutes < 0 ? -1 : limitMinutes * 60 }
}

function reservationKey(materialId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(materialId)) throw new Error('Invalid material ID')
  return `interview-transcription-reservation:v1:${materialId}`
}

export async function getInterviewTranscriptionUsage(identity: Identity, now = new Date()): Promise<{ usedSeconds: number; reservedSeconds: number; limitSeconds: number }> {
  const config = identityKey(identity, now)
  if (!config) throw new Error('Transcription identity unavailable')
  const row = await prisma.systemSetting.findUnique({ where: { key: config.quotaKey }, select: { value: true } })
  if (row) return { ...parseQuota(row.value), limitSeconds: config.limitSeconds }
  const result = await prisma.interviewMaterial.aggregate({
    _sum: { duration: true },
    where: {
      project: identity.userId ? { userId: identity.userId } : { guestId: identity.guestId! },
      status: 'COMPLETED',
      ...(config.monthStart ? { updatedAt: { gte: config.monthStart } } : {}),
    },
  })
  const usedSeconds = result._sum.duration || 0
  if (!integer(usedSeconds)) throw new Error('Invalid transcription usage')
  return { usedSeconds, reservedSeconds: 0, limitSeconds: config.limitSeconds }
}

async function baselineSeconds(tx: Prisma.TransactionClient, identity: Identity, monthStart: Date | null): Promise<number> {
  const result = await tx.interviewMaterial.aggregate({
    _sum: { duration: true },
    where: {
      project: identity.userId ? { userId: identity.userId } : { guestId: identity.guestId! },
      status: 'COMPLETED',
      ...(monthStart ? { updatedAt: { gte: monthStart } } : {}),
    },
  })
  const seconds = result._sum.duration || 0
  if (!integer(seconds)) throw new Error('Invalid transcription baseline')
  return seconds
}

/** Material and project deletion must preserve completed usage before removing source rows. */
export async function preserveInterviewTranscriptionUsageBeforeDelete(
  tx: Prisma.TransactionClient,
  owner: { userId: string | null; guestId: string | null },
  now = new Date(),
): Promise<void> {
  if (process.env.INTERVIEW_TRANSCRIPTION_QUOTA_ENABLED !== '1') return
  const identity: Identity = { ...owner, plan: 'FREE' }
  const config = identityKey(identity, now)
  if (!config) throw new Error('Transcription identity unavailable')
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('interview-transcription'), hashtext(${config.quotaKey}))`
  if (await tx.systemSetting.findUnique({ where: { key: config.quotaKey }, select: { value: true } })) return
  const usedSeconds = await baselineSeconds(tx, identity, config.monthStart)
  await tx.systemSetting.create({ data: { key: config.quotaKey,
    value: JSON.stringify({ usedSeconds, reservedSeconds: 0 }) } })
}

/** Reserve verified media seconds and create the processing row in one transaction. */
export async function reserveInterviewTranscription(identity: Identity, material: Material, seconds: number, now = new Date()): Promise<TranscriptionAdmission> {
  const config = identityKey(identity, now)
  if (!config || !integer(seconds) || seconds === 0) return { state: 'unavailable' }
  const maxSeconds = INTERVIEW_PRICING.maxSingleTranscriptionMinutes * 60
  if (seconds > maxSeconds) return { state: 'too-long', maxSeconds }
  const key = reservationKey(material.id)
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'), hashtext(${material.projectId}))`
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('interview-transcription'), hashtext(${config.quotaKey}))`
      const existing = await tx.interviewTranscription.findFirst({
        where: { materialId: material.id, status: 'PROCESSING' }, orderBy: { createdAt: 'desc' },
        select: { id: true, externalJobId: true },
      })
      if (existing) {
        const reservationRow = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
        if (!reservationRow || parseReservation(reservationRow.value).transcriptionId !== existing.id) {
          throw new Error('Processing transcription has no reservation')
        }
        return { state: 'processing', transcriptionId: existing.id, externalJobId: existing.externalJobId }
      }
      const completed = await tx.interviewTranscription.findFirst({
        where: { materialId: material.id, status: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, select: { id: true },
      })
      if (completed) return { state: 'completed', transcriptionId: completed.id }
      if (await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })) throw new Error('Existing transcription reservation')

      const quotaRow = await tx.systemSetting.findUnique({ where: { key: config.quotaKey }, select: { value: true } })
      const quota = quotaRow ? parseQuota(quotaRow.value) : { usedSeconds: await baselineSeconds(tx, identity, config.monthStart), reservedSeconds: 0 }
      if (config.limitSeconds >= 0 && quota.usedSeconds + quota.reservedSeconds + seconds > config.limitSeconds) {
        return { state: 'limit', limitSeconds: config.limitSeconds, usedSeconds: quota.usedSeconds,
          reservedSeconds: quota.reservedSeconds, requiredSeconds: seconds }
      }

      const transcription = await tx.interviewTranscription.create({
        data: { projectId: material.projectId, materialId: material.id, text: '', status: 'PROCESSING', provider: null },
        select: { id: true },
      })
      const updated = await tx.interviewMaterial.updateMany({
        where: { id: material.id, projectId: material.projectId, status: { in: ['UPLOADED', 'COMPLETED', 'ERROR'] } },
        data: { status: 'PROCESSING', error: null },
      })
      if (updated.count !== 1) throw new Error('Material changed before transcription')
      await tx.systemSetting.upsert({
        where: { key: config.quotaKey },
        create: { key: config.quotaKey, value: JSON.stringify({ ...quota, reservedSeconds: quota.reservedSeconds + seconds }) },
        update: { value: JSON.stringify({ ...quota, reservedSeconds: quota.reservedSeconds + seconds }) },
      })
      await tx.systemSetting.create({ data: { key, value: JSON.stringify({ quotaKey: config.quotaKey, seconds, transcriptionId: transcription.id }) } })
      return { state: 'started', transcriptionId: transcription.id }
    }, { timeout: 10_000 })
  } catch {
    console.error('[interview] transcription reservation unavailable')
    return { state: 'unavailable' }
  }
}

/** Call in the same transaction as saving a completed transcript and material. */
export async function settleInterviewTranscription(tx: Prisma.TransactionClient, materialId: string, transcriptionId: string): Promise<number> {
  const key = reservationKey(materialId)
  const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (!row) throw new Error('Transcription reservation missing')
  const reservation = parseReservation(row.value)
  if (reservation.transcriptionId !== transcriptionId) throw new Error('Transcription reservation mismatch')
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('interview-transcription'), hashtext(${reservation.quotaKey}))`
  const currentRow = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (!currentRow || currentRow.value !== row.value) throw new Error('Transcription reservation changed')
  const quotaRow = await tx.systemSetting.findUnique({ where: { key: reservation.quotaKey }, select: { value: true } })
  if (!quotaRow) throw new Error('Transcription quota missing')
  const quota = parseQuota(quotaRow.value)
  if (quota.reservedSeconds < reservation.seconds) throw new Error('Transcription reservation exceeds quota')
  await tx.systemSetting.update({
    where: { key: reservation.quotaKey },
    data: { value: JSON.stringify({ usedSeconds: quota.usedSeconds + reservation.seconds, reservedSeconds: quota.reservedSeconds - reservation.seconds }) },
  })
  await tx.systemSetting.delete({ where: { key } })
  return reservation.seconds
}

/** Release a failed job's reservation; never release a successful job's charge. */
export async function releaseInterviewTranscription(tx: Prisma.TransactionClient, materialId: string, transcriptionId: string): Promise<void> {
  const key = reservationKey(materialId)
  const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (!row) return
  const reservation = parseReservation(row.value)
  if (reservation.transcriptionId !== transcriptionId) return
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('interview-transcription'), hashtext(${reservation.quotaKey}))`
  const currentRow = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (!currentRow || currentRow.value !== row.value) return
  const quotaRow = await tx.systemSetting.findUnique({ where: { key: reservation.quotaKey }, select: { value: true } })
  if (!quotaRow) throw new Error('Transcription quota missing')
  const quota = parseQuota(quotaRow.value)
  if (quota.reservedSeconds < reservation.seconds) throw new Error('Transcription reservation exceeds quota')
  await tx.systemSetting.update({
    where: { key: reservation.quotaKey },
    data: { value: JSON.stringify({ ...quota, reservedSeconds: quota.reservedSeconds - reservation.seconds }) },
  })
  await tx.systemSetting.delete({ where: { key } })
}
