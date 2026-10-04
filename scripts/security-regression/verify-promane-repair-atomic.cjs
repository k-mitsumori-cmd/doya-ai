const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ role = 'admin', revokeOnConflict = false, failAtRate = false, correctedDates = false } = {}) {
  let currentRole = role
  let attempts = 0
  let committedWrites = 0
  const startDate = new Date('2026-09-20T00:00:00Z')
  const endDate = new Date('2026-09-10T00:00:00Z')
  const prisma = {
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      assert.equal(options.timeout, 20_000)
      attempts++
      let writes = 0
      const tx = {
        promaneWorkspace: { findFirst: async ({ where }) => {
          assert.equal(where.slug, 'ws')
          return { id: 'w' }
        } },
        promaneMember: {
          findFirst: async ({ where }) => where.role.in.includes(currentRole) ? { id: 'actor' } : null,
          updateMany: async ({ where }) => {
            assert.equal(where.workspaceId, 'w')
            if (failAtRate) throw new Error('synthetic write failure')
            writes++
            return { count: 1 }
          },
        },
        promaneExpense: { updateMany: async ({ where }) => {
          assert.equal(where.project.workspaceId, 'w')
          writes++
          return { count: 1 }
        } },
        promaneTimeEntry: { updateMany: async ({ where }) => {
          assert.equal(where.member.workspaceId, 'w')
          writes++
          return { count: 1 }
        } },
        promaneTask: {
          findMany: async () => [{ id: 'task', startDate, dueDate: endDate }],
          updateMany: async ({ where }) => {
            assert.equal(where.project.workspaceId, 'w')
            assert.equal(where.startDate, startDate)
            assert.equal(where.dueDate, endDate)
            writes++
            return { count: correctedDates ? 0 : 1 }
          },
        },
        promaneProject: {
          updateMany: async ({ where }) => {
            assert.equal(where.workspaceId, 'w')
            if (where.id) {
              assert.equal(where.startDate, startDate)
              assert.equal(where.endDate, endDate)
            }
            writes++
            return { count: where.id && correctedDates ? 0 : 1 }
          },
          findMany: async () => [{ id: 'project', startDate, endDate }],
        },
      }
      const result = await fn(tx)
      if (revokeOnConflict && attempts === 1) {
        currentRole = 'member'
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      committedWrites += writes
      return result
    },
  }
  const api = load('src/app/api/promane/repair/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
    '@/lib/auth': {},
    '@/lib/prisma': { prisma },
  })
  return {
    run: () => api.POST({ nextUrl: new URL('https://example.test/api/promane/repair?workspaceSlug=ws') }),
    state: () => ({ attempts, committedWrites }),
  }
}

;(async () => {
  await check('repair commits all six categories and reports actual counts', async () => {
    const f = fixture()
    const response = await f.run()
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.totalFixed, 6)
    assert.deepEqual(Object.values(body.details), [1, 1, 1, 1, 1, 1])
    assert.deepEqual(f.state(), { attempts: 1, committedWrites: 6 })
  })
  await check('already corrected dates are skipped and not counted', async () => {
    const f = fixture({ correctedDates: true })
    const body = await (await f.run()).json()
    assert.equal(body.totalFixed, 4)
    assert.equal(body.details.reverseTaskDates, 0)
    assert.equal(body.details.reverseProjectDates, 0)
  })
  await check('non-admin and revoked admin cannot commit repair writes', async () => {
    const member = fixture({ role: 'member' })
    assert.equal((await member.run()).status, 403)
    assert.deepEqual(member.state(), { attempts: 1, committedWrites: 0 })
    const revoked = fixture({ revokeOnConflict: true })
    assert.equal((await revoked.run()).status, 403)
    assert.deepEqual(revoked.state(), { attempts: 2, committedWrites: 0 })
  })
  await check('failure in a later repair stage rolls back earlier stages', async () => {
    const f = fixture({ failAtRate: true })
    assert.equal((await f.run()).status, 500)
    assert.deepEqual(f.state(), { attempts: 1, committedWrites: 0 })
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
