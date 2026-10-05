import type { PrismaClient } from '@prisma/client'
import { deleteRecording } from './storage'

const PREFIX = 'mensetsu-recording-purge:v1:'
const UPLOAD_FINAL_CHECK_MS = 3 * 60 * 60 * 1000
const LEASE_MS = 10 * 60 * 1000
const RETRY_MS = 5 * 60 * 1000
const SAFE_PART = /^[A-Za-z0-9_-]{1,128}$/
type Task = { readyAt: Date; finalAt: Date; path: string }
const serialize = (task: Task) => `${task.readyAt.toISOString()}|${task.finalAt.toISOString()}|${task.path}`
function parse(key: string, value: string): Task | null {
  const [ready, final, path, extra] = value.split('|')
  const parts = path?.split('/') || []
  const readyAt = new Date(ready), finalAt = new Date(final)
  if (extra !== undefined || parts.length !== 3 || parts[0] !== 'sessions' || parts[2] !== 'interview.webm' ||
      !SAFE_PART.test(parts[1]) || key !== `${PREFIX}${parts[1]}` ||
      !Number.isFinite(readyAt.getTime()) || !Number.isFinite(finalAt.getTime())) return null
  return { readyAt, finalAt, path }
}

/** Keep every issued upload traceable before exposing its signed URL. Does not mark audio as saved. */
export async function trackMensetsuRecordingUpload(db: PrismaClient, sessionId: string, now = new Date()): Promise<boolean> {
  if (!SAFE_PART.test(sessionId)) return false
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM mensetsu_sessions WHERE id = ${sessionId} FOR NO KEY UPDATE`
    const session = await tx.mensetsuSession.findUnique({ where: { id: sessionId }, include: { organization: { select: { recordAudio: true } } } })
    const checkedAt = new Date(Math.max(now.getTime(), Date.now()))
    if (!session || !session.consentedAt || !session.startedAt || session.status !== 'live' ||
        !session.organization.recordAudio || session.expiresAt <= checkedAt || !session.purgeAfter || session.purgeAfter <= checkedAt) return false
    const key = `${PREFIX}${sessionId}`
    const previous = await tx.systemSetting.findUnique({ where: { key } })
    const prior = previous ? parse(key, previous.value) : null
    const task = { readyAt: session.purgeAfter, finalAt: new Date(Math.max(session.purgeAfter.getTime(), checkedAt.getTime() + UPLOAD_FINAL_CHECK_MS, prior?.finalAt.getTime() || 0)), path: `sessions/${sessionId}/interview.webm` }
    const value = serialize(task)
    await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
    return true
  }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
}

/** Claims and failed deletions remain durable. A final pass also catches uploads arriving after an early purge. */
export async function purgeQueuedMensetsuRecordings(db: PrismaClient, now = new Date(), limit = 200) {
  const candidates = await db.systemSetting.findMany({
    where: { key: { startsWith: PREFIX }, value: { lte: `${now.toISOString()}|~` } }, orderBy: { value: 'asc' }, take: limit,
  })
  let processed = 0, finalized = 0, deferred = 0, failed = 0
  const stopAt = Date.now() + 60000
  for (const row of candidates) {
    if (Date.now() >= stopAt) break
    const task = parse(row.key, row.value)
    if (!task) { failed++; continue }
    const leased = serialize({ ...task, readyAt: new Date(now.getTime() + LEASE_MS) })
    const claim = await db.systemSetting.updateMany({ where: { key: row.key, value: row.value }, data: { value: leased } })
    if (!claim.count) continue
    processed++
    try {
      const sessionId = task.path.split('/')[1]
      const session = await db.mensetsuSession.findUnique({ where: { id: sessionId }, select: { purgeAfter: true } })
      // A changed/unknown retention policy must not cause premature deletion.
      if (session && (!session.purgeAfter || session.purgeAfter > now)) {
        const readyAt = session.purgeAfter || new Date(now.getTime() + 86400000)
        await db.systemSetting.updateMany({ where: { key: row.key, value: leased }, data: { value: serialize({ ...task, readyAt, finalAt: new Date(Math.max(task.finalAt.getTime(), readyAt.getTime())) }) } })
        deferred++
        continue
      }
      await deleteRecording(task.path)
      if (now >= task.finalAt) {
        const removed = await db.systemSetting.deleteMany({ where: { key: row.key, value: leased } })
        finalized += removed.count
      } else {
        await db.systemSetting.updateMany({ where: { key: row.key, value: leased }, data: { value: serialize({ ...task, readyAt: task.finalAt }) } })
        deferred++
      }
    } catch {
      await db.systemSetting.updateMany({ where: { key: row.key, value: leased }, data: { value: serialize({ ...task, readyAt: new Date(now.getTime() + RETRY_MS) }) } }).catch(() => {})
      failed++
    }
  }
  const queued = await db.systemSetting.count({ where: { key: { startsWith: PREFIX } } })
  return { processed, finalized, deferred, failed, queued }
}
