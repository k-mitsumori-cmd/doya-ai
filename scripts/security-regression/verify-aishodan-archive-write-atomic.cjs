const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const roomInput = load('src/lib/aishodan/room-input.ts')

const access = {
  getAishodanContext: async () => ({ organizationId: 'org', userId: 'user', role: 'owner' }),
  orgSlugFrom: () => 'org',
}

;(async () => {
  for (const archivedAfterInitialRead of [false, true]) {
    for (const existingPreview of [false, true]) {
      await check(`preview ${existingPreview ? 'reuse' : 'create'} ${archivedAfterInitialRead ? 'rejects archive race' : 'writes while active'}`, async () => {
        let writes = 0
        let locks = 0
        const tx = {
          $queryRaw: async () => { locks++; return [{ id: 'product' }] },
          aishodanProduct: { findFirst: async ({ where }) => { assert.equal(where.archivedAt, null); return archivedAfterInitialRead ? null : { id: 'product' } } },
          aishodanRoom: {
            findFirst: async () => existingPreview ? { id: 'preview', sessionCount: 2 } : null,
            update: async () => { writes++; return { token: 'existing' } },
            create: async () => { writes++; return { token: 'new' } },
          },
        }
        const prisma = {
          aishodanScenario: { findFirst: async () => ({ id: 'scenario', product: { id: 'product', name: 'Product' } }) },
          $transaction: async fn => fn(tx),
        }
        const route = load('src/app/api/aishodan/scenarios/[id]/preview/route.ts', {
          crypto: { randomBytes: () => Buffer.alloc(24) }, 'next/server': { NextResponse: Response },
          '@/lib/prisma': { prisma }, '@/lib/aishodan/access': access,
        })
        const response = await route.POST({}, { params: Promise.resolve({ id: 'scenario' }) })
        assert.equal(response.status, archivedAfterInitialRead ? 409 : 200)
        assert.equal(locks, 1)
        assert.equal(writes, archivedAfterInitialRead ? 0 : 1)
      })
    }

    await check(`room reactivation ${archivedAfterInitialRead ? 'rejects archive race' : 'writes while active'}`, async () => {
      let writes = 0
      let locks = 0
      const tx = {
        aishodanRoom: {
          findFirst: async () => ({ scenario: { productId: 'product' } }),
          updateMany: async () => { writes++; return { count: 1 } },
        },
        $queryRaw: async () => { locks++; return [{ id: 'product' }] },
        aishodanProduct: { findFirst: async ({ where }) => { assert.equal(where.archivedAt, null); return archivedAfterInitialRead ? null : { id: 'product' } } },
      }
      const prisma = { $transaction: async fn => fn(tx) }
      const route = load('src/app/api/aishodan/rooms/[id]/route.ts', {
        'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
        '@/lib/aishodan/access': { ...access, hasMinRole: () => true },
        '@/lib/aishodan/room-input': roomInput,
      })
      const response = await route.PATCH({ json: async () => ({ isActive: true }) }, { params: Promise.resolve({ id: 'room' }) })
      assert.equal(response.status, archivedAfterInitialRead ? 409 : 200)
      assert.equal(locks, 1)
      assert.equal(writes, archivedAfterInitialRead ? 0 : 1)
    })

    await check(`room issue ${archivedAfterInitialRead ? 'rejects archive race' : 'writes while active'}`, async () => {
      let writes = 0
      const tx = {
        $queryRaw: async () => [{ id: 'product' }],
        aishodanProduct: { findFirst: async ({ where }) => { assert.equal(where.archivedAt, null); return archivedAfterInitialRead ? null : { id: 'product' } } },
        aishodanRoom: { create: async ({ data }) => { writes++; return { id: 'room', name: data.name, token: data.token, expiresAt: null } } },
      }
      const prisma = {
        aishodanScenario: { findFirst: async () => ({ id: 'scenario', product: { id: 'product', name: 'Product' } }) },
        $transaction: async (fn) => fn(tx),
      }
      const route = load('src/app/api/aishodan/rooms/route.ts', {
        crypto: { randomBytes: () => Buffer.alloc(24) }, 'next/server': { NextResponse: Response },
        '@/lib/prisma': { prisma }, '@/lib/aishodan/access': access,
        '@/lib/service-usage': { recordServiceUsage: async () => {} },
        '@/lib/aishodan/room-input': roomInput,
      })
      const response = await route.POST({ json: async () => ({ scenarioId: 'scenario' }) })
      assert.equal(response.status, archivedAfterInitialRead ? 409 : 200)
      assert.equal(writes, archivedAfterInitialRead ? 0 : 1)
    })

    await check(`manual knowledge ${archivedAfterInitialRead ? 'rejects archive race' : 'uses locked transaction'}`, async () => {
      let ingests = 0
      const tx = {
        $queryRaw: async () => [{ id: 'product' }],
        aishodanProduct: { findFirst: async ({ where }) => { assert.equal(where.archivedAt, null); return archivedAfterInitialRead ? null : { id: 'product' } } },
      }
      const prisma = {
        aishodanProduct: { findFirst: async () => ({ id: 'product' }) },
        $transaction: async (fn) => fn(tx),
      }
      const route = load('src/app/api/aishodan/products/[id]/sources/route.ts', {
        'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma }, '@/lib/aishodan/access': access,
        '@/lib/aishodan/knowledge': { ingestManual: async (_id, _title, _text, db) => { assert.equal(db, tx); ingests++; return 2 } },
      })
      const response = await route.POST({ json: async () => ({ text: 'FAQ answer' }) }, { params: Promise.resolve({ id: 'product' }) })
      assert.equal(response.status, archivedAfterInitialRead ? 409 : 200)
      assert.equal(ingests, archivedAfterInitialRead ? 0 : 1)
    })

    await check(`scenario edit ${archivedAfterInitialRead ? 'rejects archive race' : 'commits profile and scenario together'}`, async () => {
      let profileWrites = 0
      let scenarioWrites = 0
      const scenario = { id: 'scenario', productId: 'product', product: { id: 'product', name: 'Product', archivedAt: null } }
      const tx = {
        $queryRaw: async () => [{ id: 'product' }],
        aishodanProduct: {
          findFirst: async ({ where }) => { assert.equal(where.archivedAt, null); return archivedAfterInitialRead ? null : { id: 'product' } },
          update: async () => { profileWrites++ },
        },
        aishodanScenario: { update: async () => { scenarioWrites++ } },
      }
      const prisma = {
        aishodanScenario: { findFirst: async () => scenario },
        $transaction: async (fn) => fn(tx),
      }
      const route = load('src/app/api/aishodan/scenarios/[id]/route.ts', {
        'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma }, '@/lib/aishodan/access': access,
        '@/lib/aishodan/public': { toScenarioConfig: () => ({}) },
        '@/lib/aishodan/scheduling': { normalizeSchedulingLabel: () => '', validateSchedulingUrl: () => ({ ok: true, url: null }) },
      })
      const response = await route.PUT({ json: async () => ({ name: 'Updated', profile: { note: 'Updated' } }) }, { params: Promise.resolve({ id: 'scenario' }) })
      assert.equal(response.status, archivedAfterInitialRead ? 409 : 200)
      assert.equal(profileWrites, archivedAfterInitialRead ? 0 : 1)
      assert.equal(scenarioWrites, archivedAfterInitialRead ? 0 : 1)
    })
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
