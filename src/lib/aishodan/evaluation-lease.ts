import { prisma } from '@/lib/prisma'
import { randomUUID } from 'node:crypto'

const PREFIX = 'aishodan-evaluation-lease:v1:'
const LEASE_MS = 6 * 60 * 1000
export type EvaluationLease = { key: string; value: string; expiresAt: Date }

/** Serialize acquisition with transcript writes and evaluation commits. */
export async function claimEvaluationLease(sessionId: string, organizationId: string): Promise<EvaluationLease | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM aishodan_sessions WHERE id = ${sessionId} FOR NO KEY UPDATE`
    const session = await tx.aishodanSession.findUnique({ where: { id: sessionId } })
    const now = Date.now()
    if (!session || session.organizationId !== organizationId || !session.startedAt || !session.endedAt ||
        !session.consentedAt || !['completed', 'evaluated'].includes(session.status) ||
        (session.purgeAfter && session.purgeAfter.getTime() <= now)) return null
    const key = `${PREFIX}${sessionId}`
    const previous = await tx.systemSetting.findUnique({ where: { key } })
    if (previous) {
      const [expiry, owner, extra] = previous.value.split('|')
      const time = Date.parse(expiry)
      if (!owner || extra !== undefined || !Number.isFinite(time) || time > now) return null
    }
    const expiresAt = new Date(now + LEASE_MS)
    const value = `${expiresAt.toISOString()}|${randomUUID()}`
    await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
    return { key, value, expiresAt }
  }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
}

/** An old worker must never release a replacement worker's lease. */
export async function releaseEvaluationLease(lease: EvaluationLease) {
  await prisma.systemSetting.deleteMany({ where: { key: lease.key, value: lease.value } })
}
