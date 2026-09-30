import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'

const LEASE_MS = 5 * 60 * 1000

type Claim =
  | { kind: 'claimed'; token: string }
  | { kind: 'processed' }
  | { kind: 'inflight' }

/** 署名検証後に呼ぶ。処理中の重複通知には再送を要求する。 */
export async function claimStripeWebhookEvent(id: string, type: string): Promise<Claim> {
  if (!id || !type) throw new Error('Stripe event identity is missing')
  const now = new Date()
  const token = randomUUID()
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS)

  const created = await prisma.stripeWebhookEvent.createMany({
    data: [{ id, type, status: 'processing', attempts: 1, lastReceivedAt: now, leaseExpiresAt, claimToken: token }],
    skipDuplicates: true,
  })
  if (created.count === 1) return { kind: 'claimed', token }

  const existing = await prisma.stripeWebhookEvent.findUnique({ where: { id } })
  if (!existing) throw new Error('Stripe event receipt disappeared after duplicate key')
  if (existing.type !== type) throw new Error('Stripe event ID has conflicting types')
  if (existing.status === 'processed') return { kind: 'processed' }
  if (existing.status !== 'failed' && existing.status !== 'processing') {
    throw new Error('Stripe event receipt has an unknown status')
  }

  const updated = await prisma.stripeWebhookEvent.updateMany({
    where: {
      id,
      OR: [
        { status: 'failed' },
        { status: 'processing', leaseExpiresAt: { lte: now } },
      ],
    },
    data: {
      status: 'processing',
      attempts: { increment: 1 },
      lastReceivedAt: now,
      leaseExpiresAt,
      claimToken: token,
      processedAt: null,
    },
  })
  return updated.count === 1 ? { kind: 'claimed', token } : { kind: 'inflight' }
}

export async function finishStripeWebhookEvent(id: string, token: string, succeeded: boolean): Promise<void> {
  const updated = await prisma.stripeWebhookEvent.updateMany({
    where: { id, claimToken: token, status: 'processing' },
    data: succeeded
      ? { status: 'processed', processedAt: new Date(), leaseExpiresAt: null, claimToken: null }
      : { status: 'failed', leaseExpiresAt: null, claimToken: null },
  })
  if (updated.count !== 1) throw new Error('Stripe event receipt claim was lost')
}
