const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const { actualMembership, state } = require('./hr-membership-fixture-bridge.cjs')

const roles = { OWNER: 'OWNER', ADMIN: 'ADMIN', MANAGER: 'MANAGER', MEMBER: 'MEMBER' }
const hierarchy = { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 }

function fixture(action, scenario) {
  const actor = { id: 'actor', userId: 'user', organizationId: 'org', role: 'ADMIN', status: 'ACTIVE' }
  const target = { id: 'target', userId: 'other', organizationId: 'org', role: 'MEMBER', status: 'ACTIVE' }
  const owner = { id: 'owner', userId: 'owner-user', organizationId: 'org', role: 'OWNER', status: 'ACTIVE' }
  if (scenario === 'owner-self') { actor.role = 'OWNER'; owner.role = 'ADMIN' }
  if (scenario === 'duplicate-owner') { actor.role = 'OWNER'; target.role = 'OWNER'; owner.role = 'ADMIN' }
  let attempts = 0
  let writes = 0
  const mutate = (data, where) => {
    assert.equal(where.id, 'target')
    assert.equal(where.organizationId, 'org')
    assert.equal(where.role, target.role)
    assert.equal(where.status, target.status)
    if (scenario === 'cas-changed') return { count: 0 }
    if (attempts === 1 && ['actor-revoked', 'target-promoted', 'target-owner'].includes(scenario)) {
      if (scenario === 'actor-revoked') actor.status = 'SUSPENDED'
      if (scenario === 'target-promoted') target.role = 'ADMIN'
      if (scenario === 'target-owner') { owner.role = 'ADMIN'; target.role = 'OWNER' }
      throw { code: 'P2034' }
    }
    writes++
    Object.assign(target, data)
    return { count: 1 }
  }
  const prisma = {
    hrOrganizationMember: { findMany: async () => [owner, actor, target] },
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
          findMany: async () => [owner, actor, target],
          findFirst: async ({ where }) => {
            if (where.id === 'actor') return actor.status === 'ACTIVE' && ['ADMIN', 'OWNER'].includes(actor.role) ? { ...actor } : null
            return where.id === 'target' ? { ...target } : null
          },
          updateMany: async ({ data, where }) => mutate(data, where),
          deleteMany: async ({ where }) => mutate({ deleted: true }, where),
          findUnique: async () => ({ ...target }),
        },
      })
    },
  }
  const membership = actualMembership(prisma)
  const route = load('src/app/api/hr/organization/members/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/hr/access': {
      getHrContext: async () => ({ id: 'actor', memberId: 'actor', userId: 'user', organizationId: 'org', role: actor.role }),
      hasMinRole: role => ['OWNER', 'ADMIN'].includes(role),
    },
    '@/lib/hr/types': { HrMemberRole: roles },
    '@/lib/hr/constants': { ROLE_HIERARCHY: hierarchy },
    '@/lib/hr/membership-write': membership,
    '@/lib/account-lifecycle/state': state,
  })
  const call = (body = { status: 'SUSPENDED' }) => route[action](action === 'PATCH' ? { json: async () => body } : {}, {
    params: Promise.resolve({ id: scenario === 'owner-self' ? 'actor' : 'target' }),
  })
  return { call, state: () => ({ attempts, writes }) }
}

;(async () => {
  for (const action of ['PATCH', 'DELETE']) {
    const valid = fixture(action)
    assert.equal((await valid.call()).status, 200, `${action} valid`)
    assert.deepEqual(valid.state(), { attempts: 1, writes: 1 })

    const cas = fixture(action, 'cas-changed')
    assert.equal((await cas.call()).status, 409, `${action} stale role/status compare-and-swap`)
    assert.deepEqual(cas.state(), { attempts: 1, writes: 0 })

    const owner = fixture(action, 'owner-self')
    assert.equal((await owner.call()).status, 403, `${action} existing sole OWNER`)
    assert.deepEqual(owner.state(), { attempts: 1, writes: 0 })

    const secondOwner = fixture(action, 'duplicate-owner')
    assert.equal((await secondOwner.call()).status, 409, `${action} two active OWNER rows fail closed`)
    assert.deepEqual(secondOwner.state(), { attempts: 0, writes: 0 })

    for (const scenario of ['actor-revoked', 'target-promoted', 'target-owner']) {
      const race = fixture(action, scenario)
      assert.equal((await race.call()).status, 403, `${action} ${scenario}`)
      assert.deepEqual(race.state(), { attempts: 2, writes: 0 })
    }
  }
  const malformed = fixture('PATCH')
  assert.equal((await malformed.call({ role: 'OWNER' })).status, 400)
  assert.equal((await malformed.call([])).status, 400)
  assert.equal((await malformed.call(null)).status, 400)
  assert.deepEqual(malformed.state(), { attempts: 0, writes: 0 })
  console.log('PASS HR member mutations recheck actor and target inside the transaction; malformed input writes nothing')
})().catch(error => { console.error(error); process.exitCode = 1 })
