import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { EVALUATION_TASK_PREFIX } from './evaluation-task'
import { COMPLETION_NOTIFICATION_PREFIX, FAILURE_NOTIFICATION_PREFIX } from './completion-notification-task'

const CURSOR_KEY = 'aishodan-record-retention-cursor:v1'
const PREFIXES = [EVALUATION_TASK_PREFIX, 'aishodan-evaluation-lease:v1:', COMPLETION_NOTIFICATION_PREFIX, FAILURE_NOTIFICATION_PREFIX]

/** Remove expired personal content while keeping the session row used by quota history. */
export async function purgeExpiredAishodanRecords() {
  const previous = await prisma.systemSetting.findUnique({ where: { key: CURSOR_KEY } })
  const cursor = previous && /^[A-Za-z0-9_-]{1,128}$/.test(previous.value) ? previous.value : ''
  const rows = await prisma.aishodanSession.findMany({
    where: { purgeAfter: { lte: new Date() }, ...(cursor ? { id: { gt: cursor } } : {}) },
    select: { id: true }, orderBy: { id: 'asc' }, take: 25,
  })
  const stats = { checked: 0, purged: 0, skipped: 0 }
  const stopAt = Date.now() + 15000
  let last = cursor
  for (const row of rows) {
    if (Date.now() >= stopAt) break
    last = row.id
    stats.checked++
    const purged = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM aishodan_sessions WHERE id = ${row.id} FOR NO KEY UPDATE`
      const current = await tx.aishodanSession.findUnique({ where: { id: row.id } })
      if (!current || !current.purgeAfter || current.purgeAfter.getTime() > Date.now()) return false
      const marker = `purged:${current.id}`
      if (current.guestId === marker && current.status === 'expired' && !current.consentedAt) return false
      await tx.aishodanQuestion.deleteMany({ where: { sessionId: current.id } })
      await tx.aishodanSlotValue.deleteMany({ where: { sessionId: current.id } })
      await tx.aishodanOutcome.deleteMany({ where: { sessionId: current.id } })
      await tx.aishodanTurn.deleteMany({ where: { sessionId: current.id } })
      await tx.systemSetting.deleteMany({ where: { key: { in: PREFIXES.map((prefix) => `${prefix}${current.id}`) } } })
      await tx.aishodanSession.update({ where: { id: current.id }, data: {
        guestId: marker, guestName: null, guestCompany: null, guestEmail: null,
        referrer: null, utm: Prisma.DbNull, schedulingClickedAt: null,
        consentedAt: null, currentPhase: 'expired', status: 'expired',
        updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
      } })
      // id, organizationId, roomId, createdAt and usage counts remain intact.
      return true
    }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
    if (purged) stats.purged++
    else stats.skipped++
  }
  const next = rows.length === 0 || (rows.length < 25 && stats.checked === rows.length) ? '' : last
  await prisma.systemSetting.upsert({ where: { key: CURSOR_KEY }, create: { key: CURSOR_KEY, value: next }, update: { value: next } })
  return stats
}
