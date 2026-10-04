const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

async function exercise({ sessions = 0, active = 0, found = true, fail = false } = {}) {
  let deleted = 0
  let archived = 0
  let disabledRooms = 0
  const tx = {
    aishodanProduct: {
      findFirst: async ({ where }) => {
        assert.equal(where.organizationId, 'org')
        return found ? { id: where.id, archivedAt: null } : null
      },
      delete: async () => { deleted++ },
      update: async ({ data }) => { assert.ok(data.archivedAt instanceof Date); archived++ },
    },
    aishodanSession: {
      count: async ({ where }) => {
        assert.equal(where.organizationId, 'org')
        assert.equal(where.room.scenario.productId, 'product')
        return where.status ? active : sessions
      },
    },
    aishodanRoom: { updateMany: async ({ data }) => { assert.equal(data.isActive, false); disabledRooms++ } },
  }
  const prisma = { $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    if (fail) throw Error('database unavailable')
    return fn(tx)
  } }
  const { DELETE } = load('src/app/api/aishodan/products/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/aishodan/access': {
      getAishodanContext: async () => ({ organizationId: 'org', role: 'admin' }),
      hasMinRole: () => true,
      orgSlugFrom: () => undefined,
    },
  })
  const response = await DELETE({}, { params: Promise.resolve({ id: 'product' }) })
  return { response, deleted, archived, disabledRooms }
}

;(async () => {
  for (const [opts, status, deleted] of [
    [{ sessions: 0 }, 200, 1],
    [{ sessions: 2 }, 200, 0],
    [{ sessions: 2, active: 1 }, 409, 0],
    [{ found: false }, 404, 0],
    [{ fail: true }, 503, 0],
  ]) {
    const result = await exercise(opts)
    assert.equal(result.response.status, status)
    assert.equal(result.deleted, deleted)
    assert.equal(result.archived, opts.sessions && !opts.active ? 1 : 0)
    assert.equal(result.disabledRooms, opts.sessions && !opts.active ? 1 : 0)
  }
  const { assertRoomUsable } = load('src/lib/aishodan/public.ts', { '@/lib/prisma': { prisma: {} } })
  const archivedRoom = { isActive: true, scenario: { product: { archivedAt: new Date() } } }
  assert.equal(assertRoomUsable(archivedRoom).status, 403)
  console.log('PASS Aishodan product deletion preserves existing session records')
})().catch((error) => { console.error(error); process.exitCode = 1 })
