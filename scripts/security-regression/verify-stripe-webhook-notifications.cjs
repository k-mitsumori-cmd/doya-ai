const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

let receipt = { id: 'evt1', type: 'invoice.payment_failed', status: 'processing', claimToken: 'owner' }
const rows = new Map()
let serial = 0
let deliveries = 0
let failDelivery = false
let releaseDelivery = null
let failWrite = false

const eligible = (row, now) =>
  (row.status === 'pending' && row.nextAttemptAt <= now) ||
  (row.status === 'sending' && row.leaseExpiresAt <= now)

const prisma = {
  $transaction: async (fn) => fn(prisma),
  stripeWebhookEvent: {
    findFirst: async ({ where }) =>
      receipt && Object.entries(where).every(([key, value]) => receipt[key] === value) ? { id: receipt.id } : null,
  },
  stripeWebhookNotification: {
    createMany: async ({ data, skipDuplicates }) => {
      if (failWrite) throw Error('database unavailable')
      assert.equal(skipDuplicates, true)
      const item = data[0]
      if (rows.has(item.eventId)) return { count: 0 }
      rows.set(item.eventId, {
        ...item, status: 'pending', attempts: 0, nextAttemptAt: new Date(0),
        leaseExpiresAt: null, claimToken: null, sentAt: null, createdAt: new Date(),
      })
      return { count: 1 }
    },
    updateMany: async ({ where, data }) => {
      if (failWrite) throw Error('database unavailable')
      const row = rows.get(where.eventId)
      if (!row) return { count: 0 }
      if (where.status && row.status !== where.status) return { count: 0 }
      if (where.claimToken && row.claimToken !== where.claimToken) return { count: 0 }
      if (where.OR && !eligible(row, new Date())) return { count: 0 }
      const attempts = row.attempts
      Object.assign(row, data)
      if (data.attempts?.increment) row.attempts = attempts + data.attempts.increment
      return { count: 1 }
    },
    findUnique: async ({ where }) => rows.get(where.eventId) || null,
    findMany: async ({ where, take }) => [...rows.values()]
      .filter((row) => eligible(row, new Date()))
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, take)
      .map(({ eventId }) => ({ eventId })),
    deleteMany: async ({ where }) => {
      let count = 0
      for (const [id, row] of rows) {
        if (row.status === where.status && row.sentAt < where.sentAt.lt) {
          rows.delete(id); count++
        }
      }
      return { count }
    },
  },
}

const outbox = load('src/lib/stripe-webhook-notifications.ts', {
  'node:crypto': { randomUUID: () => 'notification-' + (++serial) },
  '@/lib/prisma': { prisma },
  '@/lib/notifications': {
    sendEventNotificationStrict: async () => {
      deliveries++
      if (failDelivery) throw Error('Slack unavailable')
      if (releaseDelivery) await new Promise((resolve) => { releaseDelivery = resolve })
    },
  },
})

;(async () => {
  const payload = { type: 'payment_failed', userEmail: 'owner@example.test', details: 'invoice: in1' }
  await check('outbox requires current matching receipt owner', async () => {
    await assert.rejects(() => outbox.enqueueStripeWebhookNotification('evt1', receipt.type, 'stale', payload))
    assert.equal(rows.size, 0)
  })
  await check('outbox queue failure cannot acknowledge notification creation', async () => {
    failWrite = true
    await assert.rejects(() => outbox.enqueueStripeWebhookNotification('evt1', receipt.type, 'owner', payload))
    failWrite = false
    assert.equal(rows.size, 0)
  })
  await check('outbox queues one notice per Stripe event', async () => {
    await outbox.enqueueStripeWebhookNotification('evt1', receipt.type, 'owner', payload)
    await outbox.enqueueStripeWebhookNotification('evt1', receipt.type, 'owner', payload)
    assert.equal(rows.size, 1)
    assert.equal(rows.get('evt1').payload.type, 'payment_failed')
  })
  await check('billing operation notice is durable and deduplicated without webhook receipt', async () => {
    const id = 'billing-cancel-failed:u1:1:abc'
    const alert = { type: 'cancellation_incomplete', userEmail: 'owner@example.test', details: 'partial cancellation' }
    failWrite = true
    await assert.rejects(() => outbox.enqueueBillingOperationalNotification(id, 'billing.cancel.failed', alert))
    failWrite = false
    await outbox.enqueueBillingOperationalNotification(id, 'billing.cancel.failed', alert)
    await outbox.enqueueBillingOperationalNotification(id, 'billing.cancel.failed', alert)
    assert.equal(rows.get(id).payload.type, 'cancellation_incomplete')
    assert.equal([...rows.keys()].filter((key) => key === id).length, 1)
    assert.equal(await outbox.deliverStripeWebhookNotification(id), 'sent')
  })
  await check('concurrent workers cannot send the same notice twice', async () => {
    const before = deliveries
    releaseDelivery = true
    const first = outbox.deliverStripeWebhookNotification('evt1')
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(await outbox.deliverStripeWebhookNotification('evt1'), 'skipped')
    releaseDelivery()
    assert.equal(await first, 'sent')
    releaseDelivery = null
    assert.equal(deliveries, before + 1)
    assert.equal(rows.get('evt1').status, 'sent')
  })
  await check('Slack failure remains pending and later Cron retry succeeds', async () => {
    receipt = { id: 'evt2', type: 'invoice.payment_failed', status: 'processing', claimToken: 'owner2' }
    await outbox.enqueueStripeWebhookNotification('evt2', receipt.type, 'owner2', payload)
    failDelivery = true
    assert.equal(await outbox.deliverStripeWebhookNotification('evt2'), 'failed')
    assert.equal(rows.get('evt2').status, 'pending')
    assert.equal(rows.get('evt2').attempts, 1)
    assert.equal(await outbox.deliverStripeWebhookNotification('evt2'), 'skipped')
    failDelivery = false
    rows.get('evt2').nextAttemptAt = new Date(0)
    const result = await outbox.deliverPendingStripeWebhookNotifications()
    assert.equal(result.sent, 1)
    assert.equal(rows.get('evt2').status, 'sent')
    assert.equal(rows.get('evt2').attempts, 2)
  })
  await check('expired sending lease can be reclaimed', async () => {
    receipt = { id: 'evt3', type: 'invoice.payment_failed', status: 'processing', claimToken: 'owner3' }
    await outbox.enqueueStripeWebhookNotification('evt3', receipt.type, 'owner3', payload)
    Object.assign(rows.get('evt3'), {
      status: 'sending', claimToken: 'expired-owner', leaseExpiresAt: new Date(0),
    })
    assert.equal(await outbox.deliverStripeWebhookNotification('evt3'), 'sent')
    assert.equal(rows.get('evt3').status, 'sent')
  })
  await check('retry endpoint requires Cron secret and delegates only authorized calls', async () => {
    let calls = 0
    const route = load('src/app/api/cron/stripe-notifications/route.ts', {
      'next/server': { NextResponse: { json: (body, options) => ({ status: options?.status || 200, body }) } },
      '@/lib/stripe-webhook-notifications': { deliverPendingStripeWebhookNotifications: async () => {
        calls++
        return { examined: 0, sent: 0, failed: 0 }
      } },
    }, { process: { env: { CRON_SECRET: 'local-secret' } } })
    assert.equal((await route.GET({ headers: new Headers() })).status, 401)
    assert.equal(calls, 0)
    assert.equal((await route.GET({ headers: new Headers({ authorization: 'Bearer local-secret' }) })).status, 200)
    assert.equal(calls, 1)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
