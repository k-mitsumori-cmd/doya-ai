const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const roles = { OWNER: 'OWNER', ADMIN: 'ADMIN', MANAGER: 'MANAGER', MEMBER: 'MEMBER' }
const hierarchy = { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 }

function fixture(action, scenario) {
  const actor = { id: 'actor', userId: 'user', organizationId: 'org', role: 'ADMIN', status: 'ACTIVE' }
  const target = { id: 'target', userId: 'other', organizationId: 'org', role: 'MEMBER', status: 'ACTIVE' }
  let attempts = 0
  let writes = 0
  const mutate = data => {
    if (attempts === 1 && scenario) {
      if (scenario === 'actor-revoked') actor.status = 'SUSPENDED'
      if (scenario === 'target-promoted') target.role = 'ADMIN'
      if (scenario === 'target-owner') target.role = 'OWNER'
      throw { code: 'P2034' }
    }
    writes++
    Object.assign(target, data)
    return { count: 1 }
  }
  const prisma = {
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      return fn({
        $queryRaw: async sql => {
          const statement = sql.join('?')
          assert.match(statement, /FOR UPDATE/)
          return statement.includes('hr_organizations') ? [{ id: 'org' }] : [{ id: 'actor' }, { id: 'target' }]
        },
        hrOrganizationMember: {
          findFirst: async ({ where }) => {
            if (where.id === 'actor') return actor.status === 'ACTIVE' && actor.role === 'ADMIN' ? { ...actor } : null
            return where.id === 'target' ? { ...target } : null
          },
          updateMany: async ({ data }) => mutate(data),
          deleteMany: async () => mutate({ deleted: true }),
          findUnique: async () => ({ ...target }),
        },
      })
    },
  }
  const route = load('src/app/api/hr/organization/members/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/hr/access': {
      getHrContext: async () => ({ id: 'actor', memberId: 'actor', userId: 'user', organizationId: 'org', role: 'ADMIN' }),
      hasMinRole: role => ['OWNER', 'ADMIN'].includes(role),
    },
    '@/lib/hr/types': { HrMemberRole: roles },
    '@/lib/hr/constants': { ROLE_HIERARCHY: hierarchy },
  })
  const call = (body = { status: 'SUSPENDED' }) => route[action](action === 'PATCH' ? { json: async () => body } : {}, {
    params: Promise.resolve({ id: 'target' }),
  })
  return { call, state: () => ({ attempts, writes }) }
}

;(async () => {
  for (const action of ['PATCH', 'DELETE']) {
    const valid = fixture(action)
    assert.equal((await valid.call()).status, 200, `${action} valid`)
    assert.deepEqual(valid.state(), { attempts: 1, writes: 1 })

    for (const scenario of ['actor-revoked', 'target-promoted', 'target-owner']) {
      const race = fixture(action, scenario)
      assert.equal((await race.call()).status, 403, `${action} ${scenario}`)
      assert.deepEqual(race.state(), { attempts: 2, writes: 0 })
    }
  }
  const malformed = fixture('PATCH')
  assert.equal((await malformed.call([])).status, 400)
  assert.equal((await malformed.call(null)).status, 400)
  assert.deepEqual(malformed.state(), { attempts: 0, writes: 0 })
  console.log('PASS HR member mutations recheck actor and target inside the transaction; malformed input writes nothing')
})().catch(error => { console.error(error); process.exitCode = 1 })
