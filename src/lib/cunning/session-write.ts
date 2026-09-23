import { prisma } from '@/lib/prisma'
import type { Prisma, CunningSession } from '@prisma/client'

/** Keep the revision strictly monotonic even for multiple writes in one millisecond. */
export function nextCunningRevision(previous: Date): Date {
  return new Date(Math.max(Date.now(), previous.getTime() + 1))
}

/** Serialize content writes with deletion; never revive a deleted usage marker. */
export async function writeCunningSession(
  userId: string, sessionId: string,
  write: (tx: Prisma.TransactionClient, session: CunningSession) => Promise<void | false>,
): Promise<boolean> {
  return prisma.$transaction(async tx => {
    // CunningSession currently has no User foreign key. A previously admitted
    // provider may finish after account deletion, so check again when saving.
    // Keep the same User -> Session lock order as recording admission.
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    if (!users.length) return false
    await tx.$queryRaw`SELECT id FROM cunning_sessions WHERE id = ${sessionId} AND "userId" = ${userId} FOR NO KEY UPDATE`
    const session = await tx.cunningSession.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== userId || session.status === 'deleted') return false
    if (await write(tx, session) === false) return true // No semantic change: retain the revision.
    await tx.cunningSession.update({ where: { id: sessionId }, data: { updatedAt: nextCunningRevision(session.updatedAt) } })
    return true
  })
}
