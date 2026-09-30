const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

let row = null
let serial = 0
let failWrite = false
const prisma = {
  stripeWebhookEvent: {
    createMany: async ({ data }) => {
      if (failWrite) throw Error('database unavailable')
      if (row) return { count: 0 }
      row = { ...data[0], firstReceivedAt: new Date() }
      return { count: 1 }
    },
    findUnique: async () => row && { ...row },
    updateMany: async ({ where, data }) => {
      if (failWrite) throw Error('database unavailable')
      if (!row || row.id !== where.id) return { count: 0 }
      if (where.claimToken && row.claimToken !== where.claimToken) return { count: 0 }
      if (where.status && row.status !== where.status) return { count: 0 }
      if (where.OR && !where.OR.some((condition) =>
        condition.status === row.status &&
        (!condition.leaseExpiresAt || row.leaseExpiresAt <= condition.leaseExpiresAt.lte)
      )) return { count: 0 }
      row = { ...row, ...data, attempts: data.attempts?.increment ? row.attempts + data.attempts.increment : row.attempts }
      return { count: 1 }
    },
  },
}

const receipts = load('src/lib/stripe-webhook-receipts.ts', {
  'node:crypto': { randomUUID: () => `claim-${++serial}` },
  '@/lib/prisma': { prisma },
})

;(async () => {
  await check('receipt records first signed event and holds concurrent duplicate', async () => {
    const first = await receipts.claimStripeWebhookEvent('evt_1', 'customer.subscription.updated')
    assert.equal(first.kind, 'claimed')
    assert.equal(row.attempts, 1)
    assert.equal((await receipts.claimStripeWebhookEvent('evt_1', 'customer.subscription.updated')).kind, 'inflight')
    assert.equal(row.attempts, 1)
  })
  await check('failed receipt can be reclaimed and stale owner cannot finish', async () => {
    await receipts.finishStripeWebhookEvent('evt_1', 'claim-1', false)
    assert.equal(row.status, 'failed')
    const retry = await receipts.claimStripeWebhookEvent('evt_1', 'customer.subscription.updated')
    assert.equal(retry.kind, 'claimed')
    assert.equal(row.attempts, 2)
    await assert.rejects(() => receipts.finishStripeWebhookEvent('evt_1', 'claim-1', true))
    await receipts.finishStripeWebhookEvent('evt_1', retry.token, true)
    assert.equal(row.status, 'processed')
    assert(row.processedAt instanceof Date)
    assert.equal((await receipts.claimStripeWebhookEvent('evt_1', 'customer.subscription.updated')).kind, 'processed')
  })
  await check('expired processing lease can be reclaimed without duplicate success', async () => {
    row = null
    const original = await receipts.claimStripeWebhookEvent('evt_2', 'checkout.session.completed')
    row.leaseExpiresAt = new Date(0)
    const retry = await receipts.claimStripeWebhookEvent('evt_2', 'checkout.session.completed')
    assert.equal(retry.kind, 'claimed')
    assert.equal(row.attempts, 2)
    await assert.rejects(() => receipts.finishStripeWebhookEvent('evt_2', original.token, true))
    await receipts.finishStripeWebhookEvent('evt_2', retry.token, true)
  })
  await check('receipt database failure cannot acknowledge an event', async () => {
    row = null
    failWrite = true
    await assert.rejects(() => receipts.claimStripeWebhookEvent('evt_3', 'invoice.payment_succeeded'))
    failWrite = false
    assert.equal(row, null)
    await assert.rejects(() => receipts.claimStripeWebhookEvent('', 'invoice.payment_succeeded'))
  })
  await check('conflicting event types cannot reuse an event ID', async () => {
    row = null
    await receipts.claimStripeWebhookEvent('evt_4', 'customer.subscription.created')
    await assert.rejects(() => receipts.claimStripeWebhookEvent('evt_4', 'customer.subscription.deleted'))
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
