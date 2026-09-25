import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { removeSeoStoredImages } from '@seo/lib/storage'

const PREFIX = 'seo-image-purge:v1:'

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
