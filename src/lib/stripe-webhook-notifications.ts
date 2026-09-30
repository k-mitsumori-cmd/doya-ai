import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEventNotificationStrict, type EventNotification } from '@/lib/notifications'

const LEASE_MS = 2 * 60 * 1000
const BATCH_SIZE = 25

/** Stripe APIの同期・解約経路で発生した運営通知も同じ再送キューへ保存する。 */
export async function enqueueBillingOperationalNotification(
  eventId: string,
  eventType: string,
  payload: EventNotification
): Promise<void> {
  await prisma.stripeWebhookNotification.createMany({
    data: [{ eventId, eventType, payload: payload as unknown as Prisma.InputJsonValue }],
    skipDuplicates: true,
  })
}

/** Webhook受信履歴の所有者だけが通知を登録できる。同じイベントIDは一度だけ登録する。 */
export async function enqueueStripeWebhookNotification(
  eventId: string,
  eventType: string,
  receiptToken: string,
  payload: EventNotification
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const receipt = await tx.stripeWebhookEvent.findFirst({
      where: { id: eventId, type: eventType, status: 'processing', claimToken: receiptToken },
      select: { id: true },
    })
    if (!receipt) throw new Error('Stripe webhook receipt claim was lost before notification enqueue')
    await tx.stripeWebhookNotification.createMany({
      data: [{
        eventId,
        eventType,
        payload: payload as unknown as Prisma.InputJsonValue,
      }],
      skipDuplicates: true,
    })
  })
}

/** 同時実行では条件付き更新で一件だけが送る。失敗はpendingに戻しCronへ委ねる。 */
export async function deliverStripeWebhookNotification(eventId: string): Promise<'sent' | 'failed' | 'skipped'> {
  const now = new Date()
  const token = randomUUID()
  const claimed = await prisma.stripeWebhookNotification.updateMany({
    where: {
      eventId,
      OR: [
        { status: 'pending', nextAttemptAt: { lte: now } },
        { status: 'sending', leaseExpiresAt: { lte: now } },
      ],
    },
    data: {
      status: 'sending',
      attempts: { increment: 1 },
      claimToken: token,
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
    },
  })
  if (claimed.count !== 1) return 'skipped'

  try {
    const row = await prisma.stripeWebhookNotification.findUnique({ where: { eventId } })
    if (!row || row.claimToken !== token) throw new Error('Stripe notification claim was lost')
    await sendEventNotificationStrict(row.payload as unknown as EventNotification)
    const done = await prisma.stripeWebhookNotification.updateMany({
      where: { eventId, status: 'sending', claimToken: token },
      data: { status: 'sent', sentAt: new Date(), claimToken: null, leaseExpiresAt: null },
    })
    if (done.count !== 1) throw new Error('Stripe notification delivery claim was lost')
    return 'sent'
  } catch (error) {
    // Slackが受領した直後のDB障害では再送で重複する可能性がある。取りこぼし防止を優先する。
    const row = await prisma.stripeWebhookNotification.findUnique({ where: { eventId } }).catch(() => null)
    const backoffMs = Math.min(30 * 60_000, 30_000 * 2 ** Math.min(row?.attempts || 1, 6))
    await prisma.stripeWebhookNotification.updateMany({
      where: { eventId, status: 'sending', claimToken: token },
      data: {
        status: 'pending',
        claimToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: new Date(Date.now() + backoffMs),
      },
    })
    console.error('[Stripe webhook notification] delivery failed:', eventId, error)
    return 'failed'
  }
}

export async function deliverPendingStripeWebhookNotifications(): Promise<{
  examined: number
  sent: number
  failed: number
}> {
  const now = new Date()
  const pending = await prisma.stripeWebhookNotification.findMany({
    where: {
      OR: [
        { status: 'pending', nextAttemptAt: { lte: now } },
        { status: 'sending', leaseExpiresAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
    select: { eventId: true },
  })
  let sent = 0
  let failed = 0
  for (const row of pending) {
    const result = await deliverStripeWebhookNotification(row.eventId)
    if (result === 'sent') sent++
    if (result === 'failed') failed++
  }
  // 送信済みの個人情報を無期限に重複保管しない。受信履歴のイベントIDは残る。
  await prisma.stripeWebhookNotification.deleteMany({
    where: { status: 'sent', sentAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60_000) } },
  })
  return { examined: pending.length, sent, failed }
}
