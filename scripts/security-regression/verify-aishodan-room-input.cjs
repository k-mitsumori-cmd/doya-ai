const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const roomInput = load('src/lib/aishodan/room-input.ts')
const access = {
  getAishodanContext: async () => ({ organizationId: 'org', userId: 'user', role: 'manager' }),
  hasMinRole: () => true,
  orgSlugFrom: () => 'org',
}
let creates = 0
let updates = 0
let lastCreated
let lastUpdated
const tx = {
  $queryRaw: async () => [{ id: 'product' }],
  aishodanProduct: { findFirst: async () => ({ id: 'product' }) },
  aishodanRoom: {
    create: async ({ data }) => {
      creates++
      lastCreated = data
      return { id: 'room', name: data.name, token: data.token, expiresAt: data.expiresAt }
    },
    findFirst: async () => ({ scenario: { productId: 'product' } }),
    updateMany: async ({ data }) => {
      updates++
      lastUpdated = data
      return { count: 1 }
    },
  },
}
const prisma = {
  aishodanScenario: { findFirst: async () => ({ id: 'scenario', product: { id: 'product', name: 'Product' } }) },
  $transaction: async (fn) => fn(tx),
}
const common = {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/aishodan/access': access,
  '@/lib/aishodan/room-input': roomInput,
}
const create = load('src/app/api/aishodan/rooms/route.ts', {
  ...common,
  crypto: { randomBytes: () => Buffer.alloc(24) },
  '@/lib/service-usage': { recordServiceUsage: async () => {} },
}).POST
const update = load('src/app/api/aishodan/rooms/[id]/route.ts', common).PATCH
const request = (body) => ({ json: async () => body })
const ctx = { params: Promise.resolve({ id: 'room' }) }

;(async () => {
  for (const body of [null, [], { scenarioId: 'scenario', maxSessions: null }, { scenarioId: 'scenario', maxSessions: 5001 }, { scenarioId: 'scenario', maxSessions: 1.5 }, { scenarioId: 'scenario', expiresInDays: 'bad' }, { scenarioId: 'scenario', expiresInDays: -1 }]) {
    assert.equal((await create(request(body))).status, 400)
  }
  assert.equal(creates, 0)
  for (const body of [null, [], { isActive: 'false' }, { maxSessions: null }, { maxSessions: 5001 }, { maxSessions: 2.5 }, { expiresInDays: 'bad' }, { expiresInDays: -1 }]) {
    assert.equal((await update(request(body), ctx)).status, 400)
  }
  assert.equal(updates, 0)

  assert.equal((await create(request({ scenarioId: 'scenario', maxSessions: 5000, expiresInDays: 1 }))).status, 200)
  assert.equal(lastCreated.maxSessions, 5000)
  assert.ok(lastCreated.expiresAt instanceof Date)
  assert.equal((await update(request({ isActive: false, maxSessions: 1, expiresInDays: null }), ctx)).status, 200)
  assert.equal(lastUpdated.isActive, false)
  assert.equal(lastUpdated.maxSessions, 1)
  assert.equal(lastUpdated.expiresAt, null)
  assert.equal(creates, 1)
  assert.equal(updates, 1)
  console.log('PASS Aishodan room settings reject malformed expiry, capacity, and active state before writes')
})().catch((error) => { console.error(error); process.exitCode = 1 })
