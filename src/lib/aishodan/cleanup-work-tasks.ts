import { prisma } from '@/lib/prisma'
import { EVALUATION_TASK_PREFIX } from './evaluation-task'
import { COMPLETION_NOTIFICATION_PREFIX, FAILURE_NOTIFICATION_PREFIX } from './completion-notification-task'

const LEASE_PREFIX = 'aishodan-evaluation-lease:v1:'
const PREFIXES = [EVALUATION_TASK_PREFIX, LEASE_PREFIX, COMPLETION_NOTIFICATION_PREFIX, FAILURE_NOTIFICATION_PREFIX]
const CURSOR_KEY = 'aishodan-work-cleanup-cursor:v1'
const safeSession = /^[A-Za-z0-9_-]{1,128}$/

/** Bounded, rotating metadata sweep; does not delete transcripts, outcomes or sessions. */
export async function cleanupAishodanWorkTasks() {
  const previous = await prisma.systemSetting.findUnique({ where: { key: CURSOR_KEY } })
  const cursor = previous && PREFIXES.some((prefix) => previous.value.startsWith(prefix)) ? previous.value : ''
  const rows = await prisma.systemSetting.findMany({
    where: { OR: PREFIXES.map((prefix) => ({ key: { startsWith: prefix } })), ...(cursor ? { key: { gt: cursor } } : {}) },
    orderBy: { key: 'asc' }, take: 25,
  })
  const stats = { checked: 0, removed: 0, retained: 0 }
  const stopAt = Date.now() + 15000
  let last = cursor
  for (const row of rows) {
    if (Date.now() >= stopAt) break
    const prefix = PREFIXES.find((value) => row.key.startsWith(value))!
    const sessionId = row.key.slice(prefix.length)
    last = row.key
    stats.checked++
    if (!safeSession.test(sessionId)) { stats.retained++; continue }
    const removed = await prisma.$transaction(async (tx) => {
      // Same lock as enqueue/finalize: a fresh task or lease cannot be removed by an old sweep.
      await tx.$queryRaw`SELECT id FROM aishodan_sessions WHERE id = ${sessionId} FOR NO KEY UPDATE`
      const session = await tx.aishodanSession.findUnique({ where: { id: sessionId },
        select: { consentedAt: true, purgeAfter: true } })
      const now = Date.now()
      let eligible = !session || !session.consentedAt || !!(session.purgeAfter && session.purgeAfter.getTime() <= now)
      if (!eligible && prefix === LEASE_PREFIX) {
        const [expiry, token, extra] = row.value.split('|')
        const time = Date.parse(expiry)
        eligible = !!token && extra === undefined && Number.isFinite(time) && time <= now
      }
      if (!eligible) return 0
      return (await tx.systemSetting.deleteMany({ where: { key: row.key, value: row.value } })).count
    }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
    stats.removed += removed
    if (removed === 0) stats.retained++
  }
  // A full cycle wraps, so active/stopped rows at the beginning cannot starve later rows.
  const next = rows.length === 0 || (rows.length < 25 && stats.checked === rows.length) ? '' : last
  await prisma.systemSetting.upsert({ where: { key: CURSOR_KEY }, create: { key: CURSOR_KEY, value: next }, update: { value: next } })
  return stats
}
