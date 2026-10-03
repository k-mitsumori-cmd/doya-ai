const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function fixture(action, scenario) {
  const actor = { id: 'actor', organizationId: 'org', userId: 'user', status: 'ACTIVE', role: 'admin' }
  const target = { id: 'target', organizationId: 'org', status: 'ACTIVE', role: 'member' }
  let attempts = 0, writes = 0
  const mutate = data => {
    if (attempts === 1 && scenario === 'actor-revoked') {
      actor.status = 'INACTIVE'
      throw { code: 'P2034' }
    }
    if (attempts === 1 && scenario === 'target-promoted') {
      target.role = 'admin'
      throw { code: 'P2034' }
    }
    writes++
    Object.assign(target, data)
    return { ...target }
  }
  const prisma = {
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      return fn({ $queryRaw: async sql => {
        assert.match(sql.join('?'), /ORDER BY id FOR UPDATE/)
        return [{ id: 'actor' }, { id: 'target' }]
      }, aioMember: {
        findFirst: async ({ where }) => {
          assert.equal(where.organizationId, 'org')
          if (where.userId) return actor.status === 'ACTIVE' && ['owner', 'admin'].includes(actor.role) ? { ...actor } : null
          return where.id === target.id ? { ...target } : null
        },
        update: async ({ data }) => mutate(data),
        delete: async () => mutate({ deleted: true }),
      } })
    },
  }
  const route = load('src/app/api/aio/members/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/aio/access': {
      getAioContext: async () => ({ userId: 'user', memberId: 'actor', organizationId: 'org', role: 'admin' }),
      hasMinRole: role => ['admin', 'owner'].includes(role),
      orgSlugFrom: () => undefined,
    },
    '@/lib/aio/types': { ROLE_HIERARCHY: { member: 0, manager: 1, admin: 2, owner: 3 } },
  })
  const call = () => route[action](action === 'PATCH'
    ? { json: async () => ({ role: 'manager' }) } : {}, { params: Promise.resolve({ id: 'target' }) })
  return { call, state: () => ({ attempts, writes, target }) }
}

;(async () => {
  for (const action of ['PATCH', 'DELETE']) {
    const valid = fixture(action)
    assert.equal((await valid.call()).status, 200)
    assert.deepEqual({ attempts: valid.state().attempts, writes: valid.state().writes }, { attempts: 1, writes: 1 })

    for (const scenario of ['actor-revoked', 'target-promoted']) {
      const race = fixture(action, scenario)
      assert.equal((await race.call()).status, 403, `${action} ${scenario}`)
      assert.deepEqual({ attempts: race.state().attempts, writes: race.state().writes }, { attempts: 2, writes: 0 })
    }
  }
  console.log('PASS AIO member update/delete recheck active actor and target rank after a conflict')
})().catch(error => { console.error(error); process.exitCode = 1 })
