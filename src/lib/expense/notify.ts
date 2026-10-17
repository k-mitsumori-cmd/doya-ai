// ============================================
// ドヤ支出管理: 通知（毎朝の cron から）
// ============================================
// ⚠️ 同じ通知を毎日送らない: expense_reminders の一意制約 (organizationId, kind, targetType, targetId, dueOn) で 1 回だけ
// ⚠️ 送り先は組織に登録された Slack Incoming Webhook だけ（validate.ts で hooks.slack.com に限定）
// ⚠️ 文面は丁寧語・絵文字なし
import { prisma } from '@/lib/prisma'
import { contractAlerts, scheduleActionItems } from './aggregate'
import { addDays, fromDbDate, todayJst, toDbDate } from './dates'
import { toRowLike } from './sync'

const KIND_LABEL: Record<string, string> = {
  bill_missing: '請求書待ち',
  overdue: '支払日超過',
  amount_diff: '金額差異',
  withholding_due: '源泉税の納付',
  renewal: '更新期限',
  contract_end: '契約終了',
}

const yen = (n: number) => `${n.toLocaleString('ja-JP')}円`

export async function collectAndNotify(organizationId: string): Promise<{ created: number; notified: boolean }> {
  const today = todayJst()
  const [org, rows, contracts] = await Promise.all([
    prisma.expenseOrganization.findUnique({ where: { id: organizationId }, select: { name: true, slug: true, slackWebhookUrl: true } }),
    prisma.expenseSchedule.findMany({ where: { organizationId, status: { notIn: ['paid', 'skipped'] }, plannedPayDate: { gte: toDbDate(addDays(today, -60)), lte: toDbDate(addDays(today, 40)) } } }),
    prisma.expenseContract.findMany({ where: { organizationId, status: 'active' }, select: { id: true, title: true, endDate: true, autoRenew: true, renewalNoticeDays: true, status: true, category: true } }),
  ])
  if (!org) return { created: 0, notified: false }

  const items = [
    ...scheduleActionItems(rows.map(toRowLike), today).map((i) => ({ kind: i.kind, targetType: 'schedule', targetId: i.scheduleId, dueOn: i.dueOn, text: `${i.title}（${yen(i.amount)}）: ${i.detail}` })),
    ...contractAlerts(contracts.map((c) => ({ ...c, endDate: c.endDate ? fromDbDate(c.endDate) : null })), today).map((a) => ({ kind: a.kind, targetType: 'contract', targetId: a.contractId, dueOn: a.dueOn, text: `${a.title}: ${a.detail}` })),
  ]
  const fresh: typeof items = []
  for (const it of items) {
    // 既にある通知（同じ対象・同じ期日）は作らない。新しく作れたものだけ送る
    const res = await prisma.expenseReminder.createMany({
      data: [{ organizationId, kind: it.kind, targetType: it.targetType, targetId: it.targetId, dueOn: toDbDate(it.dueOn) }],
      skipDuplicates: true,
    })
    if (res.count > 0) fresh.push(it)
  }
  if (!fresh.length || !org.slackWebhookUrl) return { created: fresh.length, notified: false }

  const base = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
  const lines = fresh.map((f) => `・【${KIND_LABEL[f.kind] ?? f.kind}】${f.text}`)
  const text = `ドヤ支出管理（${org.name}）より、確認が必要な支出のお知らせです。\n${lines.join('\n')}\n${base}/expense/${org.slug}`
  const res = await fetch(org.slackWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(10_000) }).catch(() => null)
  if (res?.ok) {
    await prisma.expenseReminder.updateMany({
      where: { organizationId, notifiedAt: null, OR: fresh.map((f) => ({ kind: f.kind, targetId: f.targetId, dueOn: toDbDate(f.dueOn) })) },
      data: { notifiedAt: new Date() },
    })
  }
  return { created: fresh.length, notified: !!res?.ok }
}
