import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export class InterviewUploadReplayError extends Error {
  constructor(public code: 'UPLOAD_REQUEST_CONFLICT' | 'UPLOAD_REQUEST_UNAVAILABLE') { super('Upload request unavailable') }
}

export async function prepareInterviewUpload(data: Prisma.InterviewMaterialUncheckedCreateInput, userId: string | null, guestId: string | null, requestKey: string, existingMaterialId?: string) {
  const receiptKey = 'interview-material-create:v1:' + createHash('sha256').update(JSON.stringify([
    userId ? ['user', userId] : ['guest', guestId], data.projectId, requestKey.toLowerCase(),
  ])).digest('hex')
  const inputHash = createHash('sha256').update(JSON.stringify({
    projectId: data.projectId, fileName: data.fileName, type: data.type,
    mimeType: data.mimeType, fileSize: String(data.fileSize),
  })).digest('hex')
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'), hashtext(${data.projectId}))`
    const project = await tx.interviewProject.findUnique({ where: { id: data.projectId }, select: { userId: true, guestId: true } })
    if (!project || (userId ? project.userId !== userId : !guestId || project.userId !== null || project.guestId !== guestId)) throw new InterviewUploadReplayError('UPLOAD_REQUEST_UNAVAILABLE')
    const receipt = await tx.systemSetting.findUnique({ where: { key: receiptKey }, select: { value: true } })
    if (receipt) {
      let saved: { version?: unknown; materialId?: unknown; inputHash?: unknown } | null = null
      try { saved = JSON.parse(receipt.value) } catch { /* Preserve corrupt receipts and fail closed. */ }
      if (!saved || saved.version !== 1 || typeof saved.materialId !== 'string' || typeof saved.inputHash !== 'string') throw new Error('Invalid upload receipt')
      if (existingMaterialId && saved.materialId !== existingMaterialId) throw new InterviewUploadReplayError('UPLOAD_REQUEST_CONFLICT')
      if (saved.inputHash !== inputHash) throw new InterviewUploadReplayError('UPLOAD_REQUEST_CONFLICT')
      const material = await tx.interviewMaterial.findUnique({ where: { id: saved.materialId } })
      if (!material || material.projectId !== data.projectId || material.status !== 'UPLOADED' || !material.filePath ||
        material.fileName !== data.fileName || material.type !== data.type ||
        material.mimeType !== data.mimeType || material.fileSize !== data.fileSize) throw new InterviewUploadReplayError('UPLOAD_REQUEST_UNAVAILABLE')
      return material
    }
    const material = existingMaterialId
      ? await tx.interviewMaterial.findUnique({ where: { id: existingMaterialId } })
      : await tx.interviewMaterial.create({ data })
    if (!material || material.projectId !== data.projectId || material.status !== 'UPLOADED' || !material.filePath ||
      material.fileName !== data.fileName || material.type !== data.type ||
      material.mimeType !== data.mimeType || material.fileSize !== data.fileSize) throw new InterviewUploadReplayError('UPLOAD_REQUEST_UNAVAILABLE')
    await tx.systemSetting.create({ data: { key: receiptKey, value: JSON.stringify({ version: 1, inputHash, materialId: material.id }) } })
    return material
  }, { maxWait: 10000, timeout: 15000 })
}
