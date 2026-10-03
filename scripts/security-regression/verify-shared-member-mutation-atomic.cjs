const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function fixture(service, action, scenario) {
  const model = `${service}Member`
  const title = service[0].toUpperCase() + service.slice(1)
  const actor = { id: 'actor', organizationId: 'org', userId: 'user', status: 'ACTIVE', role: scenario === 'actor-revoked' ? 'member' : 'admin' }
  const target = { id: 'target', organizationId: 'org', userId: 'other', status: 'ACTIVE', role: scenario === 'unknown-target-role' ? 'legacy-unknown' : 'member' }
  let attempts = 0
  let writes = 0
  const mutate = data => {
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
      return fn({
        $queryRaw: async sql => {
          assert.match(sql.join('?'), new RegExp(`FROM ${service}_members`))
          assert.match(sql.join('?'), /ORDER BY id FOR UPDATE/)
          return [{ id: 'actor' }, { id: 'target' }]
        },
        [model]: {
          findFirst: async ({ where }) => {
            assert.equal(where.organizationId, 'org')
            if (where.userId) return actor.role === 'admin' ? { ...actor } : null
            return where.id === target.id ? { ...target } : null
          },
          update: async ({ data }) => mutate(data),
          delete: async () => mutate({ deleted: true }),
        },
      })
    },
  }
  const route = load(`src/app/api/${service}/members/[id]/route.ts`, {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    [`@/lib/${service}/access`]: {
      [`get${title}Context`]: async () => ({ userId: 'user', organizationId: 'org', role: 'admin' }),
      hasMinRole: role => ['admin', 'owner'].includes(role),
      orgSlugFrom: () => undefined,
    },
    [`@/lib/${service}/types`]: { ROLE_HIERARCHY: { member: 0, manager: 1, admin: 2, owner: 3 } },
  })
  const call = () => route[action](action === 'PATCH'
    ? { json: async () => ({ role: 'manager' }) } : {}, { params: Promise.resolve({ id: 'target' }) })
  return { call, state: () => ({ attempts, writes }) }
}

;(async () => {
  for (const service of ['quote', 'aishodan', 'mensetsu']) {
    for (const action of ['PATCH', 'DELETE']) {
      const valid = fixture(service, action)
      assert.equal((await valid.call()).status, 200, `${service} ${action} valid`)
      assert.deepEqual(valid.state(), { attempts: 1, writes: 1 })

      for (const scenario of ['actor-revoked', 'target-promoted', 'unknown-target-role']) {
        const race = fixture(service, action, scenario)
        assert.equal((await race.call()).status, 403, `${service} ${action} ${scenario}`)
        assert.equal(race.state().writes, 0, `${service} ${action} ${scenario} must not mutate`)
      }
    }
  }
  console.log('PASS Quote/Aishodan/Mensetsu member update/delete recheck actor and target after concurrent changes')
})().catch(error => { console.error(error); process.exitCode = 1 })
