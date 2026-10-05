import { prisma } from '@/lib/prisma'
import { enqueueEvaluation } from './evaluation-task'

const CURSOR_KEY = 'aishodan-stale-session-cursor:v1'
const RECONNECT_GRACE_MS = 15 * 60 * 1000
const RECENT_ACTIVITY_MS = 5 * 60 * 1000

/** Close abandoned conversations without running AI or delivering notifications here. */
export async function recoverStaleAishodanSessions() {
  const now = Date.now(), stopAt = now + 15000
  const previous = await prisma.systemSetting.findUnique({ where: { key: CURSOR_KEY } })
  const cursor = previous && /^[A-Za-z0-9_-]{1,128}$/.test(previous.value) ? previous.value : ''
  const rows = await prisma.aishodanSession.findMany({
    where: { status: 'live', endedAt: null, startedAt: { lt: new Date(now - RECONNECT_GRACE_MS) },
      updatedAt: { lt: new Date(now - RECENT_ACTIVITY_MS) }, ...(cursor ? { id: { gt: cursor } } : {}) },
    select: { id: true }, orderBy: { id: 'asc' }, take: 25,
  })
  const stats = { checked: 0, completed: 0, aborted: 0, skipped: 0, failed: 0 }
  let last = cursor
  for (const row of rows) {
    if (Date.now() >= stopAt) break
    last = row.id
    stats.checked++
    try {
      const status = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM aishodan_sessions WHERE id = ${row.id} FOR NO KEY UPDATE`
        const current = await tx.aishodanSession.findUnique({ where: { id: row.id },
          include: { room: { select: { scenario: { select: { durationMin: true } } } } } })
        if (!current || current.status !== 'live' || current.endedAt || !current.startedAt || !current.consentedAt ||
          current.purgeAfter && current.purgeAfter.getTime() <= Date.now()) return null
        const duration = current.room.scenario.durationMin
        if (!Number.isFinite(duration) || duration <= 0 ||
          current.startedAt.getTime() + duration * 60000 + RECONNECT_GRACE_MS >= Date.now() ||
          current.updatedAt.getTime() + RECENT_ACTIVITY_MS >= Date.now()) return null
        const guestTurns = await tx.aishodanTurn.count({ where: { sessionId: current.id, speaker: 'guest' } })
        const status = guestTurns >= 2 ? 'completed' : 'aborted'
        const revision = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1))
        await tx.aishodanSession.update({ where: { id: current.id }, data: { status, endedAt: new Date(), updatedAt: revision } })
        if (status === 'completed') await enqueueEvaluation(tx, current.id, current.organizationId, revision)
        return status
      }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
      if (status === 'completed') stats.completed++
      else if (status === 'aborted') stats.aborted++
      else stats.skipped++
    } catch {
      stats.failed++
      console.error('[aishodan-work-cleanup] abandoned conversation recovery failed')
    }
  }
  const next = rows.length === 0 || (rows.length < 25 && stats.checked === rows.length) ? '' : last
  await prisma.systemSetting.upsert({ where: { key: CURSOR_KEY }, create: { key: CURSOR_KEY, value: next }, update: { value: next } })
  return stats
}
