import type { PrismaClient } from '@prisma/client'
import { purgeDeletedPersonaImageBatch } from './image-storage'

/** Workers last at most 300s. Also wait one hour beyond every recorded image lease. */
export async function purgeDeletedPersonaImages(db: PrismaClient, now = new Date()) {
  // A database DELETE trigger records these before project/user cascades remove the rows.
  // Reserve one slot for orphaned namespaces while keeping capacity for ordinary deletions.
  const orphaned = await db.personaImagePurgeTask.findMany({
    where: { readyAt: { lte: now } },
    orderBy: [{ attemptedAt: { sort: 'asc', nulls: 'first' } }, { projectId: 'asc' }], take: 1,
  })
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000)
  const eligible = {
    deletedAt: { lte: cutoff }, imagesPurgedAt: null,
    images: { none: { leaseExpiresAt: { gt: cutoff } } },
  }
  const targets = await db.personaProject.findMany({
    where: eligible,
    orderBy: [{ imagesPurgeAttemptedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    select: { id: true }, take: 3 - orphaned.length,
  })
  let completed = 0, failed = 0, processed = 0
  for (const task of orphaned) {
    const claimed = await db.personaImagePurgeTask.updateMany({
      where: { projectId: task.projectId, readyAt: { lte: now } }, data: { attemptedAt: now },
    })
    if (!claimed.count) continue
    processed++
    try {
      if (await db.personaProject.count({ where: { id: task.projectId } })) {
        failed++
        continue
      }
      if (await purgeDeletedPersonaImageBatch(task.projectId)) {
        const removed = await db.personaImagePurgeTask.deleteMany({
          where: { projectId: task.projectId, readyAt: task.readyAt },
        })
        completed += removed.count
      }
    } catch {
      failed++
    }
  }
  for (const project of targets) {
    // Persist before storage: failures rotate behind unattempted projects, not starve them.
    const claimed = await db.personaProject.updateMany({
      where: { id: project.id, ...eligible }, data: { imagesPurgeAttemptedAt: now },
    })
    if (!claimed.count) continue
    processed++
    try {
      if (await purgeDeletedPersonaImageBatch(project.id)) {
        const saved = await db.personaProject.updateMany({
          where: { id: project.id, ...eligible }, data: { imagesPurgedAt: now },
        })
        completed += saved.count
      }
    } catch {
      // Keep the tombstone and references; never log file paths or generated content.
      failed++
    }
  }
  return { processed, completed, failed }
}
