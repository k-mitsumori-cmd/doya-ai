import { prisma } from '@/lib/prisma'
import { postToSlackBlocks } from '@/lib/notifications'
import { COMPLETION_NOTIFICATION_PREFIX, FAILURE_NOTIFICATION_PREFIX, parseCompletionNotification, parseFailureNotification } from './completion-notification-task'
import { evaluationTaskValue } from './evaluation-task'
import { VERDICT_LABELS, type Verdict } from './types'

const slackText = (value: string | null | undefined, fallback: string) =>
  (value || fallback).slice(0, 500).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Durable notification recovery. This path never generates another AI evaluation. */
async function deliverNotifications(limit = 1, scope?: { sessionId: string; organizationId: string }, failedEvaluation = false) {
  const prefix = failedEvaluation ? FAILURE_NOTIFICATION_PREFIX : COMPLETION_NOTIFICATION_PREFIX
  const rows = await prisma.systemSetting.findMany({
    where: { key: scope ? `${prefix}${scope.sessionId}` : { startsWith: prefix }, value: { lte: `${new Date().toISOString()}|~` } },
    orderBy: { value: 'asc' }, take: Math.max(1, Math.min(10, Math.floor(limit))),
  })
  const stats = { sent: 0, retried: 0, exhausted: 0, skipped: 0 }
  for (const row of rows) {
    const task = failedEvaluation ? parseFailureNotification(row.key, row.value) : parseCompletionNotification(row.key, row.value)
    if (scope && task && task.organizationId !== scope.organizationId) { stats.skipped++; continue }
    if (!task || task.failures >= 3) {
      const stopped = await prisma.systemSetting.updateMany({ where: { key: row.key, value: row.value }, data: {
        value: task ? evaluationTaskValue({ ...task, readyAt: new Date('9999-01-01T00:00:00.000Z') })
          : `9999-01-01T00:00:00.000Z|quarantined|${row.value}`,
      } })
      if (stopped.count === 1) stats.exhausted++
      else stats.skipped++
      continue
    }
    const held = evaluationTaskValue({ ...task, readyAt: new Date(Date.now() + 60000) })
    const claim = await prisma.systemSetting.updateMany({ where: { key: row.key, value: row.value }, data: { value: held } })
    if (claim.count !== 1) { stats.skipped++; continue }
    try {
      const session = await prisma.aishodanSession.findFirst({
        where: { id: task.sessionId, organizationId: task.organizationId },
        include: { outcome: true, room: { include: { organization: { select: { name: true } },
          scenario: { include: { product: { select: { name: true } } } } } } },
      })
      if (!session || session.room.isPreview || !session.consentedAt || !session.startedAt || !session.endedAt ||
          (session.purgeAfter && session.purgeAfter.getTime() <= Date.now()) || session.status !== (failedEvaluation ? 'completed' : 'evaluated') ||
          session.updatedAt.getTime() !== task.revision.getTime() || (!failedEvaluation && !session.outcome) || session.outcome?.overriddenAt) {
        await prisma.systemSetting.deleteMany({ where: { key: row.key, value: held } })
        stats.skipped++
        continue
      }
      // Replaced tasks belong to a later result; never send this worker's old snapshot.
      const currentTask = await prisma.systemSetting.findUnique({ where: { key: row.key } })
      if (currentTask?.value !== held) { stats.skipped++; continue }
      const verdict = session.outcome ? VERDICT_LABELS[session.outcome.verdict as Verdict] : null
      if (!failedEvaluation && (!verdict || !Number.isFinite(session.outcome?.fitScore))) throw new Error('Invalid notification result')
      const title = failedEvaluation ? 'AI商談が完了しました（判定は未確定）' : 'AI商談の判定が確定しました'
      const lines = [
        `*${title}*（${slackText(session.room.organization.name, '組織名未取得')}）`,
        `相手: ${slackText(session.guestCompany, '会社名未取得')} / ${slackText(session.guestName, 'お名前未取得')}`,
        `商材: ${slackText(session.room.scenario.product.name, '商材名未取得')}`,
        failedEvaluation ? '適合判定を確定できませんでした。会話の記録は保存されています。管理画面でご確認ください。'
          : `判定: ${verdict}（${session.outcome!.fitScore}点）`,
        session.schedulingClickedAt ? '日程調整: 予約ページを開きました' : '日程調整: 未（こちらから連絡が必要）',
        !failedEvaluation && session.outcome?.nextAction ? `次アクション: ${slackText(session.outcome.nextAction, '')}` : '',
        `${process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'}/aishodan/sessions/${task.sessionId}`,
      ].filter(Boolean)
      await postToSlackBlocks(title, [{ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } }], AbortSignal.timeout(15000))
      if (failedEvaluation) {
        // Keep a receipt so repeated provider failures for this revision do not repeat the notice.
        await prisma.systemSetting.updateMany({ where: { key: row.key, value: held }, data: {
          value: evaluationTaskValue({ ...task, readyAt: new Date('9999-01-01T00:00:00.000Z') }),
        } })
      } else await prisma.systemSetting.deleteMany({ where: { key: row.key, value: held } })
      stats.sent++
    } catch {
      const failures = task.failures + 1
      const updated = await prisma.systemSetting.updateMany({ where: { key: row.key, value: held }, data: {
        value: evaluationTaskValue({ ...task, failures, readyAt: failures >= 3
          ? new Date('9999-01-01T00:00:00.000Z') : new Date(Date.now() + 300000 * 2 ** (failures - 1)) }),
      } })
      if (updated.count !== 1) stats.skipped++
      else if (failures >= 3) stats.exhausted++
      else stats.retried++
    }
  }
  return stats
}

export function deliverPendingCompletionNotifications(limit = 1, scope?: { sessionId: string; organizationId: string }) {
  return deliverNotifications(limit, scope)
}

export function deliverPendingFailureNotifications(limit = 1, scope?: { sessionId: string; organizationId: string }) {
  return deliverNotifications(limit, scope, true)
}
