import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { enqueueInterviewMaterialStoragePurge, enqueueInterviewProjectStoragePurge } from '@/lib/interview/storage-purge-queue'

const RETIRED_PREFIX = 'shanai-storage-retired:v1:'
export const SHANAI_TRANSCRIPT_ATTEMPT_PREFIX = 'shanai-transcription-attempt:v1:'
const SAFE_PART = /^[A-Za-z0-9_-]{1,128}$/

function fileId(path: string) {
  return `shanai_file_${createHash('sha256').update(path).digest('hex')}`
}

/** Serialize registration, replacement and deletion for one interview. */
export async function lockShanaiStorage(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('shanai-storage-lifecycle'), hashtext(${id}))`
}

/** Keep the marker after the purge job completes: a stale confirmation must not resurrect the path. */
export async function isShanaiFileRetired(tx: Prisma.TransactionClient, path: string) {
  return !!await tx.systemSetting.findUnique({ where: { key: `${RETIRED_PREFIX}${fileId(path)}` }, select: { key: true } })
}

export async function enqueueShanaiFileStoragePurge(
  tx: Prisma.TransactionClient,
  interview: { id: string; userId: string },
  path: string,
) {
  const parts = path.split('/')
  if (!SAFE_PART.test(interview.id) || !SAFE_PART.test(interview.userId) || parts.length !== 3 ||
    parts[0] !== interview.userId || parts[2] === '.' || parts[2] === '..' ||
    !['audio', 'photo'].some(kind => parts[1] === `shanai_${kind}_${interview.id}`)) {
    throw new Error('ストレージ削除対象を確認できません')
  }
  if (await isShanaiFileRetired(tx, path)) return
  await tx.systemSetting.create({ data: {
    key: `${RETIRED_PREFIX}${fileId(path)}`, value: `${interview.userId}/${interview.id}`,
  } })
  await enqueueInterviewMaterialStoragePurge(tx, {
    id: fileId(path), projectId: parts[1], filePath: path, userId: interview.userId, guestId: null,
  })
}

/** Prefix jobs also collect unconfirmed and delayed uploads. No storage request occurs in this transaction. */
export async function enqueueShanaiInterviewStoragePurge(tx: Prisma.TransactionClient, interview: { id: string; userId: string }) {
  for (const kind of ['audio', 'photo']) {
    await enqueueInterviewProjectStoragePurge(tx, { id: `shanai_${kind}_${interview.id}`, userId: interview.userId, guestId: null })
  }
  // The parent is deleted in this transaction, so no later confirmation can resolve these paths.
  await tx.systemSetting.deleteMany({ where: { key: { startsWith: RETIRED_PREFIX }, value: `${interview.userId}/${interview.id}` } })
  await tx.systemSetting.deleteMany({ where: { key: { startsWith: `${SHANAI_TRANSCRIPT_ATTEMPT_PREFIX}${interview.id}:` } } })
}
