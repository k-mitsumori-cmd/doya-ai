const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const roomInput = load('src/lib/aishodan/room-input.ts')

async function exercise({ sessions = 0, found = true, fail = false } = {}) {
  let deleted = 0
  const tx = { aishodanRoom: {
    findFirst: async ({ where }) => {
      assert.equal(where.organizationId, 'org')
      return found ? { id: where.id, _count: { sessions } } : null
    },
    delete: async () => { deleted++ },
  } }
  const prisma = { $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    if (fail) throw Error('database unavailable')
    return fn(tx)
  } }
  const { DELETE } = load('src/app/api/aishodan/rooms/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/aishodan/access': {
      getAishodanContext: async () => ({ organizationId: 'org', role: 'admin' }),
      hasMinRole: () => true,
      orgSlugFrom: () => undefined,
    },
    '@/lib/aishodan/room-input': roomInput,
  })
  const response = await DELETE({}, { params: Promise.resolve({ id: 'room' }) })
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
  console.log('PASS Aishodan room deletion preserves existing session records')
})().catch((error) => { console.error(error); process.exitCode = 1 })
