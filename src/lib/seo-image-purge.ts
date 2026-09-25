import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { removeSeoStoredImages } from '@seo/lib/storage'

const PREFIX = 'seo-image-purge:v1:'
const PENDING_PREFIX = 'seo-image-pending:v1:'
const PENDING_GRACE_MS = 60 * 60 * 1000

/** Queue object deletion in the same transaction that removes an article. */
export async function queueSeoArticleImagePurge(tx: Prisma.TransactionClient, articleId: string) {
  const images = await tx.seoImage.findMany({ where: { articleId }, select: { filePath: true } })
  const paths = [...new Set(images.map(image => image.filePath).filter(path => path.startsWith('supabase:')))]
  if (!paths.length) return
  const key = `${PREFIX}${articleId}`
  await tx.systemSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(paths) }, update: { value: JSON.stringify(paths) } })
}

/** Retryable cleanup. A failed storage call leaves the queue intact. */
export async function purgeQueuedSeoImages(db: PrismaClient = prisma, limit = 10, articleId?: string) {
  const where = articleId ? { key: `${PREFIX}${articleId}` } : { key: { startsWith: PREFIX } }
  const rows = await db.systemSetting.findMany({ where, orderBy: { key: 'asc' }, take: limit })
  let completed = 0
  let failed = 0
  for (const row of rows) {
    try {
      const paths: unknown = JSON.parse(row.value)
      if (!Array.isArray(paths) || !paths.every(path => typeof path === 'string' && path.startsWith('supabase:'))) throw new Error('Invalid SEO purge queue')
      await removeSeoStoredImages(paths)
      await db.systemSetting.deleteMany({ where: { key: row.key, value: row.value } })
      completed++
    } catch {
      failed++
      console.error('[seo image purge] queued cleanup failed', { key: row.key })
    }
  }
  return { processed: rows.length, completed, failed }
}

/** Remove uploaded images with no DB record after the longest generation window has passed. */
export async function reconcilePendingSeoImages(db: PrismaClient = prisma, now = new Date(), limit = 200) {
  const rows = await db.systemSetting.findMany({ where: { key: { startsWith: PENDING_PREFIX } }, orderBy: { key: 'asc' }, take: limit })
  let deferred = 0
  let failed = 0
  const eligible: { key: string; path: string }[] = []
  for (const row of rows) {
    try {
      const pending: unknown = JSON.parse(row.value)
      if (!pending || typeof pending !== 'object') throw new Error('Invalid SEO pending image')
      const { path, createdAt } = pending as { path?: unknown; createdAt?: unknown }
      if (typeof path !== 'string' || !path.startsWith('supabase:images/') || typeof createdAt !== 'string') throw new Error('Invalid SEO pending image')
      const created = Date.parse(createdAt)
      if (!Number.isFinite(created) || created > now.getTime()) throw new Error('Invalid SEO pending timestamp')
      if (now.getTime() - created < PENDING_GRACE_MS) { deferred++; continue }
      eligible.push({ key: row.key, path })
    } catch {
      failed++
      console.error('[seo image purge] pending reconciliation failed', { key: row.key })
    }
  }
  if (!eligible.length) return { processed: rows.length, completed: 0, deferred, failed }
  try {
    const linked = await db.seoImage.findMany({ where: { filePath: { in: eligible.map(row => row.path) } }, select: { filePath: true } })
    const linkedPaths = new Set(linked.map(row => row.filePath))
    await removeSeoStoredImages(eligible.filter(row => !linkedPaths.has(row.path)).map(row => row.path))
    await db.systemSetting.deleteMany({ where: { key: { in: eligible.map(row => row.key) } } })
    return { processed: rows.length, completed: eligible.length, deferred, failed }
  } catch {
    console.error('[seo image purge] pending batch failed')
    return { processed: rows.length, completed: 0, deferred, failed: failed + eligible.length }
  }
}
