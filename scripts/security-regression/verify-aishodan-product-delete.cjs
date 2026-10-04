const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

async function exercise({ sessions = 0, found = true, fail = false } = {}) {
  let deleted = 0
  const tx = {
    aishodanProduct: {
      findFirst: async ({ where }) => {
        assert.equal(where.organizationId, 'org')
        return found ? { id: where.id } : null
      },
      delete: async () => { deleted++ },
    },
    aishodanSession: {
      count: async ({ where }) => {
        assert.equal(where.organizationId, 'org')
        assert.equal(where.room.scenario.productId, 'product')
        return sessions
      },
    },
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
  return { response, deleted }
}

;(async () => {
  for (const [opts, status, deleted] of [
    [{ sessions: 0 }, 200, 1],
    [{ sessions: 2 }, 409, 0],
    [{ found: false }, 404, 0],
    [{ fail: true }, 503, 0],
  ]) {
    const result = await exercise(opts)
    assert.equal(result.response.status, status)
    assert.equal(result.deleted, deleted)
  }
  console.log('PASS Aishodan product deletion preserves existing session records')
})().catch((error) => { console.error(error); process.exitCode = 1 })
