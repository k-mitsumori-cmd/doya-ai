import { prisma } from '@/lib/prisma'
import { enqueueEvaluation } from './evaluation-task'
import { voiceCharger } from '@/lib/doya-power/voice'
import { voiceActualMinutes } from '@/lib/doya-power/voice-core'
import { doyaPowerRollout } from '@/lib/doya-power/flag'

const CURSOR_KEY = 'aishodan-stale-session-cursor:v1'
const RECONNECT_GRACE_MS = 15 * 60 * 1000
const RECENT_ACTIVITY_MS = 5 * 60 * 1000
/** 同意してからこの時間たっても始まらない商談は、中止にして、仮に減らしたドヤパワーを戻す */
const UNSTARTED_HOLD_MS = 60 * 60 * 1000

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
    const toSettle: { args: { organizationId: string; startedAt: Date; lastActivity: Date } | null } = { args: null }
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
        // ドヤパワーの清算のために、始めた時刻と最後の動き（updatedAt）を返す。放置のあとに閉じるので、終わりは最後の動き
        toSettle.args = { organizationId: current.organizationId, startedAt: current.startedAt, lastActivity: current.updatedAt }
        return status
      }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
      // ドヤパワー（旗の内側だけ）: 仮に減らした分を戻し、実際の分数ぶんを減らし直す
      const a = toSettle.args
      if (a) await voiceCharger.settle('aishodan', a.organizationId, `session-${row.id}`, voiceActualMinutes(a.startedAt, a.lastActivity))
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

/**
 * ドヤパワー（旗の内側だけ）: 同意したまま始まらなかった商談の、仮に減らした分を戻す。
 * ⚠️ ルームの URL は誰でも開けるので、/start だけを繰り返されると、発行した会社の残りが仮に減ったまま残る。
 *    1時間たっても始まらない商談を中止にしてから（もう始められない）、0分で清算する。
 * - 台帳に仮に減らした記録がある商談だけを中止にする（旗を入れる前の商談・減らさない会社の商談には触れない）
 * - 旗が off なら、何も読まない
 */
export async function releaseUnstartedAishodanHolds() {
  const stats = { checked: 0, released: 0 }
  if (doyaPowerRollout() === 'off') return stats
  const rows = await prisma.aishodanSession.findMany({
    where: { status: 'pending', startedAt: null, endedAt: null, createdAt: { lt: new Date(Date.now() - UNSTARTED_HOLD_MS), gt: new Date(Date.now() - 7 * 24 * 3600_000) } },
    select: { id: true, organizationId: true, room: { select: { scenario: { select: { durationMin: true } } } } },
    orderBy: { createdAt: 'asc' }, take: 50,
  })
  for (const row of rows) {
    stats.checked++
    try {
      const held = await voiceCharger.allowance('aishodan', row.organizationId, `session-${row.id}`, row.room.scenario.durationMin)
      if (!held || held === 'closed') continue
      const closed = await prisma.aishodanSession.updateMany({
        where: { id: row.id, status: 'pending', startedAt: null, endedAt: null },
        data: { status: 'aborted', endedAt: new Date() },
      })
      if (closed.count === 1) {
        await voiceCharger.settle('aishodan', row.organizationId, `session-${row.id}`, 0)
        stats.released++
      }
    } catch {
      console.error('[aishodan-work-cleanup] unstarted hold release failed')
    }
  }
  return stats
}
