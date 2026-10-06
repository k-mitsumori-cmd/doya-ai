import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getInterviewGuestLimits } from '@/lib/pricing'

type Identity = { userId: string | null; guestId: string | null }
type Material = { id: string; projectId: string; filePath: string }
export type LegacyTranscriptionAdmission =
  | { state: 'started' | 'processing' | 'completed'; transcriptionId: string; externalJobId: string | null }
  | { state: 'limit'; usedSeconds: number; limitSeconds: number }
  | { state: 'unavailable' }

/** Both legacy entry points claim the same row before any provider submission. */
export async function claimLegacyInterviewTranscription(identity: Identity, material: Material): Promise<LegacyTranscriptionAdmission> {
  if (!identity.userId && !identity.guestId) return { state: 'unavailable' }
  try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'), hashtext(${material.projectId}))`
      const current = await tx.interviewMaterial.findUnique({ where: { id: material.id }, select: {
        projectId: true, filePath: true, fileUrl: true, type: true, status: true,
        project: { select: { userId: true, guestId: true } },
      } })
      if (!current || current.projectId !== material.projectId || current.filePath !== material.filePath || !current.fileUrl ||
        !['audio', 'video'].includes(current.type) || (identity.userId ? current.project.userId !== identity.userId
          : current.project.userId !== null || current.project.guestId !== identity.guestId)) return { state: 'unavailable' }
      const existing = await tx.interviewTranscription.findFirst({ where: { materialId: material.id, status: { in: ['PROCESSING', 'COMPLETED'] } },
        orderBy: { createdAt: 'desc' }, select: { id: true, status: true, externalJobId: true } })
      if (existing) return { state: existing.status === 'COMPLETED' ? 'completed' : 'processing', transcriptionId: existing.id, externalJobId: existing.externalJobId }
      if (!['COMPLETED', 'ERROR'].includes(current.status)) return { state: 'unavailable' }
      if (!identity.userId) {
        const limitSeconds = getInterviewGuestLimits().transcriptionMinutes * 60
        const aggregate = await tx.interviewMaterial.aggregate({ _sum: { duration: true }, where: { project: { guestId: identity.guestId }, status: 'COMPLETED' } })
        const usedSeconds = aggregate._sum.duration || 0
        if (!Number.isSafeInteger(usedSeconds) || usedSeconds < 0) return { state: 'unavailable' }
        if (usedSeconds >= limitSeconds) return { state: 'limit', usedSeconds, limitSeconds }
      }
      const marker = `submitting:${randomUUID()}`
      const transcription = await tx.interviewTranscription.create({ data: {
        projectId: material.projectId, materialId: material.id, text: '', status: 'PROCESSING', provider: null, externalJobId: marker,
      }, select: { id: true } })
      const changed = await tx.interviewMaterial.updateMany({ where: { id: material.id, projectId: material.projectId, filePath: material.filePath,
        status: { in: ['COMPLETED', 'ERROR'] } }, data: { status: 'PROCESSING', error: null } })
      if (changed.count !== 1) throw new Error('Material changed before legacy claim')
      return { state: 'started', transcriptionId: transcription.id, externalJobId: marker }
    }, { maxWait: 10000, timeout: 15000 })
  } catch {
    console.error('[interview] legacy transcription admission unavailable')
    return { state: 'unavailable' }
  }
}
