import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Lock the parent before checking related slides. A relation filter alone can use a
// statement snapshot taken before a row-lock wait and accept stale branding.
// Keep external image/provider/Storage work outside this short transaction.
export async function withDoyaSlideProjectLock<T>(
  projectId: string,
  userId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async tx => {
    const owned = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "doyaslide_projects"
      WHERE "id" = ${projectId} AND "userId" = ${userId}
      FOR UPDATE
    `
    if (owned.length === 0) throw Object.assign(new Error('Project changed'), { code: 'P2025' })
    return work(tx)
  }, { maxWait: 10000, timeout: 15000 })
}
