const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

function fixture() {
  const rows = new Map()
  const db = { systemSetting: {
    findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
    create: async ({ data }) => {
      if (rows.has(data.key)) throw Object.assign(Error('duplicate'), { code: 'P2002' })
      rows.set(data.key, data.value)
    },
    updateMany: async ({ where, data }) => {
      if (rows.get(where.key) !== where.value) return { count: 0 }
      rows.set(where.key, data.value)
      return { count: 1 }
    },
  } }
  let now = 1_800_000_000_000
  const FakeDate = class extends Date { static now() { return now } }
  const module = load('src/lib/checkout-reservation.ts', {
    'node:crypto': require('node:crypto'),
    '@/lib/prisma': { prisma: db },
    '@/lib/stripe': { stripe: { checkout: { sessions: { retrieve: async () => ({ status: 'open' }) } } } },
  }, { Date: FakeDate })
  return { module, db, rows, advance: ms => { now += ms } }
}

;(async () => {
  await check('concurrent checkout requests create one Stripe session', async () => {
    const f = fixture()
    let calls = 0
    let resolveCreate
    const create = async (key, expiresAt) => {
      calls++
      await new Promise(resolve => { resolveCreate = resolve })
      return { id: 'cs_1', url: 'https://checkout.stripe.test/1', expires_at: expiresAt }
    }
    const input = { userId: 'u1', signatureParts: { priceId: 'p1' }, create }
    const first = f.module.createReservedCheckoutSession(input, f.db, async () => ({ status: 'open', id: 'cs_1', url: 'https://checkout.stripe.test/1' }))
    await new Promise(resolve => setImmediate(resolve))
    await assert.rejects(f.module.createReservedCheckoutSession(input, f.db, async () => ({ status: 'open' })), error => error.code === 'CHECKOUT_IN_PROGRESS')
    resolveCreate()
    assert.equal((await first).id, 'cs_1')
    assert.equal(calls, 1)
    assert.equal((await f.module.createReservedCheckoutSession(input, f.db, async () => ({ status: 'open', id: 'cs_1', url: 'https://checkout.stripe.test/1' }))).id, 'cs_1')
    assert.equal(calls, 1)
  })

  await check('completed checkout blocks a second session before subscription sync', async () => {
    const f = fixture()
    const input = { userId: 'u1', signatureParts: { priceId: 'p1' }, create: async (_, expiresAt) => ({ id: 'cs_1', url: 'https://checkout.stripe.test/1', expires_at: expiresAt }) }
    await f.module.createReservedCheckoutSession(input, f.db, async () => ({ status: 'open' }))
    await assert.rejects(f.module.createReservedCheckoutSession(input, f.db, async () => ({ status: 'complete' })), error => error.code === 'CHECKOUT_ALREADY_COMPLETED')
  })

  await check('different checkout entry or plan cannot create another open session', async () => {
    const f = fixture()
    let calls = 0
    const create = async (_, expiresAt) => ({ id: `cs_${++calls}`, url: `https://checkout.stripe.test/${calls}`, expires_at: expiresAt })
    await f.module.createReservedCheckoutSession({ userId: 'u1', signatureParts: { plan: 'banner-pro' }, create }, f.db, async () => ({ status: 'open' }))
    await assert.rejects(f.module.createReservedCheckoutSession({ userId: 'u1', signatureParts: { plan: 'hr-pro' }, create }, f.db, async () => ({ status: 'open' })), error => error.code === 'CHECKOUT_IN_PROGRESS')
    assert.equal(calls, 1)
    f.advance(41 * 60_000)
    assert.equal((await f.module.createReservedCheckoutSession({ userId: 'u1', signatureParts: { plan: 'hr-pro' }, create }, f.db, async () => ({ status: 'expired' }))).id, 'cs_2')
  })

  await check('Stripe status lookup failure cannot create a second session', async () => {
    const f = fixture()
    let calls = 0
    const input = { userId: 'u1', signatureParts: { plan: 'banner-pro' }, create: async (_, expiresAt) => ({ id: `cs_${++calls}`, url: 'https://checkout.stripe.test/1', expires_at: expiresAt }) }
    await f.module.createReservedCheckoutSession(input, f.db, async () => ({ status: 'open' }))
    await assert.rejects(f.module.createReservedCheckoutSession(input, f.db, async () => { throw Error('Stripe unavailable') }))
    assert.equal(calls, 1)
  })

  await check('uncertain creation retries with persisted Stripe idempotency key', async () => {
    const f = fixture()
    const seen = []
    const input = { userId: 'u1', signatureParts: { priceId: 'p1' }, create: async (key, expiresAt) => {
      seen.push({ key, expiresAt })
      if (seen.length === 1) throw Error('response lost')
      return { id: 'cs_1', url: 'https://checkout.stripe.test/1', expires_at: expiresAt }
    } }
    await assert.rejects(f.module.createReservedCheckoutSession(input, f.db, async () => ({ status: 'open' })))
    f.advance(5 * 60_000 + 1)
    assert.equal((await f.module.createReservedCheckoutSession(input, f.db, async () => ({ status: 'open' }))).id, 'cs_1')
    assert.deepEqual(seen[0], seen[1])
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
