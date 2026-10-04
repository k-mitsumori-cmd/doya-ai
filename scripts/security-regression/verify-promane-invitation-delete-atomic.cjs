const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ active = true, accepted = false, foreign = false, changed = false, revokeOnConflict = false } = {}) {
  let memberActive = active
  let attempts = 0
  let deletes = 0
  let committedDeletes = 0
  const prisma = {
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      const before = deletes
      const result = await fn({
        promaneInvitation: {
          findUnique: async ({ where }) => where.id === 'invite' ? {
            workspaceId: foreign ? 'other' : 'w', acceptedAt: accepted ? new Date() : null,
          } : null,
          deleteMany: async ({ where }) => {
            assert.equal(where.id, 'invite')
            assert.equal(where.workspaceId, 'w')
            assert.equal(where.acceptedAt, null)
            if (changed) return { count: 0 }
            deletes++
            return { count: 1 }
          },
        },
        promaneMember: { findFirst: async ({ where }) =>
          memberActive && where.workspaceId === 'w' && where.role.in.includes('admin') ? { id: 'actor' } : null },
      })
      if (revokeOnConflict && attempts === 1) {
        memberActive = false
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      committedDeletes += deletes - before
      return result
    },
  }
  const api = load('src/app/api/promane/invitations/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u', email: 'u@example.test' } }) },
    '@/lib/auth': {},
    '@/lib/prisma': { prisma },
  })
  return {
    run: () => api.DELETE({ nextUrl: new URL('https://example.test/api/promane/invitations?id=invite') }),
    state: () => ({ attempts, deletes, committedDeletes }),
  }
}

;(async () => {
  await check('current admin cancels only an unaccepted workspace invitation', async () => {
    const f = fixture()
    assert.equal((await f.run()).status, 200)
    assert.deepEqual(f.state(), { attempts: 1, deletes: 1, committedDeletes: 1 })
  })
  await check('accepted, foreign and changed invitations are not cancelled', async () => {
    for (const [options, status] of [[{ accepted: true }, 410], [{ foreign: true }, 403], [{ changed: true }, 409]]) {
      const f = fixture(options)
      assert.equal((await f.run()).status, status)
      assert.equal(f.state().committedDeletes, 0)
    }
  })
  await check('revocation after a serialization conflict prevents cancellation', async () => {
    const f = fixture({ revokeOnConflict: true })
    assert.equal((await f.run()).status, 403)
    assert.deepEqual(f.state(), { attempts: 2, deletes: 1, committedDeletes: 0 })
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
