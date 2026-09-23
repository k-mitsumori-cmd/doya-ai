import type { Prisma, PrismaClient } from '@prisma/client'
import { deleteFile, purgeInterviewProjectStorageBatch } from './storage'

const KEY_PREFIX = 'interview-storage-purge:v1:'
const FILE_KEY_PREFIX = 'interview-file-purge:v1:'
const FINAL_CHECK_MS = 3 * 60 * 60 * 1000
const LEASE_MS = 10 * 60 * 1000
const RETRY_MS = 5 * 60 * 1000
const SAFE_PART = /^[A-Za-z0-9_-]{1,128}$/
const SAFE_FILE = /^[A-Za-z0-9._-]{1,1024}$/

type PurgeTask = { readyAt: Date; finalAt: Date; prefix: string }

function serialize(task: PurgeTask): string {
  return `${task.readyAt.toISOString()}|${task.finalAt.toISOString()}|${task.prefix}`
}

function parse(value: string): PurgeTask | null {
  const parts = value.split('|')
  if (parts.length !== 3) return null
  const [readyAtRaw, finalAtRaw, prefix] = parts
  const readyAt = new Date(readyAtRaw)
  const finalAt = new Date(finalAtRaw)
  const segments = prefix.split('/')
  if (!Number.isFinite(readyAt.getTime()) || !Number.isFinite(finalAt.getTime()) ||
    segments.length !== 2 || segments.some(segment => !SAFE_PART.test(segment))) return null
  return { readyAt, finalAt, prefix }
}

/** Call inside the same DB transaction as project deletion. No storage call is made here. */
export async function enqueueInterviewProjectStoragePurge(
  tx: Prisma.TransactionClient,
  project: { id: string; userId: string | null; guestId: string | null },
  now = new Date(),
): Promise<void> {
  const owner = project.userId || (project.guestId ? `guest_${project.guestId}` : null)
  if (!owner || !SAFE_PART.test(owner) || !SAFE_PART.test(project.id)) {
    throw new Error('ストレージ削除対象を確認できません')
  }
  await tx.systemSetting.create({
    data: {
      key: `${KEY_PREFIX}${project.id}`,
      value: serialize({ readyAt: now, finalAt: new Date(now.getTime() + FINAL_CHECK_MS), prefix: `${owner}/${project.id}` }),
    },
  })
}

/** Queue an exact owned file in the same transaction as material deletion. */
export async function enqueueInterviewMaterialStoragePurge(
  tx: Prisma.TransactionClient,
  material: { id: string; projectId: string; filePath: string; userId: string | null; guestId: string | null },
  now = new Date(),
): Promise<void> {
  const owner = material.userId || (material.guestId ? `guest_${material.guestId}` : null)
  const parts = material.filePath.split('/')
  if (!owner || !SAFE_PART.test(owner) || !SAFE_PART.test(material.projectId) || !SAFE_PART.test(material.id) ||
    parts.length !== 3 || parts[0] !== owner || parts[1] !== material.projectId || !SAFE_FILE.test(parts[2])) {
    throw new Error('ストレージ削除対象を確認できません')
  }
  await tx.systemSetting.create({ data: {
    key: `${FILE_KEY_PREFIX}${material.id}`,
    value: serialize({ readyAt: now, finalAt: new Date(now.getTime() + FINAL_CHECK_MS), prefix: material.filePath }),
  } })
}

/** A claimed task survives process crashes and is retried after its lease expires. */
export async function purgeQueuedInterviewStorage(db: PrismaClient, now = new Date()) {
  const candidates = await db.systemSetting.findMany({
    where: { key: { startsWith: KEY_PREFIX }, value: { lte: `${now.toISOString()}|~` } },
    orderBy: { value: 'asc' },
    take: 5,
  })
  let processed = 0, finalized = 0, pending = 0, failed = 0
  for (const row of candidates) {
    const task = parse(row.value)
    if (!task || row.key !== `${KEY_PREFIX}${task.prefix.split('/')[1]}`) {
      failed++
      continue
    }
    const leased = serialize({ ...task, readyAt: new Date(now.getTime() + LEASE_MS) })
    const claim = await db.systemSetting.updateMany({ where: { key: row.key, value: row.value }, data: { value: leased } })
    if (!claim.count) continue
    processed++
    try {
      const empty = await purgeInterviewProjectStorageBatch(task.prefix)
      if (empty && now >= task.finalAt) {
        const removed = await db.systemSetting.deleteMany({ where: { key: row.key, value: leased } })
        finalized += removed.count
      } else {
        const readyAt = empty ? task.finalAt : new Date(now.getTime() + 60_000)
        await db.systemSetting.updateMany({ where: { key: row.key, value: leased }, data: { value: serialize({ ...task, readyAt }) } })
        pending++
      }
    } catch {
      await db.systemSetting.updateMany({
        where: { key: row.key, value: leased },
        data: { value: serialize({ ...task, readyAt: new Date(now.getTime() + RETRY_MS) }) },
      }).catch(() => {})
      failed++
    }
  }

  const files = await db.systemSetting.findMany({
    where: { key: { startsWith: FILE_KEY_PREFIX }, value: { lte: `${now.toISOString()}|~` } },
    orderBy: { value: 'asc' }, take: 5,
  })
  for (const row of files) {
    const parts = row.value.split('|')
    const filePath = parts[2]
    const pathParts = filePath?.split('/') || []
    const readyAt = new Date(parts[0] || '')
    const finalAt = new Date(parts[1] || '')
    if (parts.length !== 3 || !row.key.startsWith(FILE_KEY_PREFIX) || !SAFE_PART.test(row.key.slice(FILE_KEY_PREFIX.length)) ||
      pathParts.length !== 3 || !SAFE_PART.test(pathParts[0]) || !SAFE_PART.test(pathParts[1]) || !SAFE_FILE.test(pathParts[2]) ||
      !Number.isFinite(readyAt.getTime()) || !Number.isFinite(finalAt.getTime())) {
      failed++
      continue
    }
    const task = { readyAt, finalAt, prefix: filePath }
    const leased = serialize({ ...task, readyAt: new Date(now.getTime() + LEASE_MS) })
    const claim = await db.systemSetting.updateMany({ where: { key: row.key, value: row.value }, data: { value: leased } })
    if (!claim.count) continue
    processed++
    try {
      await deleteFile(filePath)
      if (now >= finalAt) {
        const removed = await db.systemSetting.deleteMany({ where: { key: row.key, value: leased } })
        finalized += removed.count
      } else {
        await db.systemSetting.updateMany({ where: { key: row.key, value: leased },
          data: { value: serialize({ ...task, readyAt: finalAt }) } })
        pending++
      }
    } catch {
      await db.systemSetting.updateMany({ where: { key: row.key, value: leased },
        data: { value: serialize({ ...task, readyAt: new Date(now.getTime() + RETRY_MS) }) } }).catch(() => {})
      failed++
    }
  }
  return { processed, finalized, pending, failed }
}
