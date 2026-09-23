import type { Prisma, PrismaClient } from '@prisma/client'
import { purgeInterviewProjectStorageBatch } from './storage'

const KEY_PREFIX = 'interview-storage-purge:v1:'
const FINAL_CHECK_MS = 3 * 60 * 60 * 1000
const LEASE_MS = 10 * 60 * 1000
const RETRY_MS = 5 * 60 * 1000
const SAFE_PART = /^[A-Za-z0-9_-]{1,128}$/

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
  return { processed, finalized, pending, failed }
}
