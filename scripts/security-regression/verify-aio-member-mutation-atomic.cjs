const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function fixture(service, action, scenario) {
  const title = service === 'aio' ? 'Aio' : service === 'sfa' ? 'Sfa' : 'Shodan'
  const model = `${service}Member`
  const actor = { id: 'actor', organizationId: 'org', userId: 'user', status: 'ACTIVE', role: 'admin' }
  const target = { id: 'target', organizationId: 'org', status: 'ACTIVE', role: scenario === 'unknown-target-role' ? 'legacy-unknown' : 'member' }
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
    ...(service === 'aio' ? { [model]: { findFirst: async ({ where }) => where.id === target.id ? { ...target, userId: 'other' } : null } } : {}),
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      return fn({ $queryRaw: async sql => {
        assert.match(sql.join('?'), /ORDER BY id FOR UPDATE/)
        assert.match(sql.join('?'), new RegExp(`FROM ${service}_members`))
        return [{ id: 'actor' }, { id: 'target' }]
      }, [model]: {
        findFirst: async ({ where }) => {
          assert.equal(where.organizationId, 'org')
          if (where.userId) return actor.status === 'ACTIVE' && ['owner', 'admin'].includes(actor.role) ? { ...actor } : null
          return where.id === target.id ? { ...target, userId: service === 'aio' ? 'other' : undefined } : null
        },
        update: async ({ data }) => mutate(data),
        delete: async () => mutate({ deleted: true }),
      } })
    },
  }
  let lifecycleMocks = {}
  if (service === 'aio') {
    // This legacy fixture checks the route's actor/rank behavior. The actual
    // User/org/member lock and retirement fence require the separate PG gate.
    lifecycleMocks = {
      '@/lib/account-lifecycle/state': { LifecycleError: class extends Error {} },
      '@/lib/account-lifecycle/organization-fence': {
        withLifecycleOrganizationWrite: async (_db, _scope, work) => prisma.$transaction(work, { isolationLevel: 'Serializable' }),
      },
    }
  }
  if (service === 'shodan') {
    const { Prisma } = require('@prisma/client')
    const crypto = require('node:crypto')
    const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
    const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state })
    const types = load('src/lib/shodan/types.ts')
    // Supply real participant projections without changing the existing observable target object.
    const rows = () => [
      { id: 'owner', organizationId: 'org', userId: 'owner-user', role: 'owner', status: 'ACTIVE', inviteEmail: null, inviteToken: null },
      { ...actor, inviteEmail: null, inviteToken: null },
      { ...target, userId: 'other', inviteEmail: null, inviteToken: null },
    ].sort((a, b) => a.id.localeCompare(b.id))
    prisma[model] = { findMany: async () => rows() }
    prisma.$transaction = async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      return fn({
        $queryRaw: async sql => {
          const query = Array.isArray(sql) ? sql.join('?') : sql.sql
          if (query.includes('FROM "User"')) {
            assert.match(query, /ORDER BY id FOR UPDATE/)
            assert.deepEqual(sql.values, ['other', 'owner-user', 'user'])
            return ['other', 'owner-user', 'user'].map(id => ({ id }))
          }
          if (query.includes('FROM shodan_organizations')) return [{ id: 'org' }]
          assert.match(query, /FROM shodan_members/)
          assert.match(query, /ORDER BY id FOR UPDATE/)
          return rows().map(({ id }) => ({ id }))
        },
        systemSetting: { findUnique: async () => null },
        [model]: { findMany: async () => rows(), update: async ({ data }) => mutate(data), delete: async () => mutate({ deleted: true }) },
      })
    }
    const writer = load('src/lib/shodan/member-write.ts', { '@/lib/prisma': { prisma }, '@/lib/account-lifecycle/state': state, '@/lib/account-lifecycle/store': store, './types': types })
    lifecycleMocks = { '@/lib/shodan/member-write': writer, '@/lib/account-lifecycle/state': state }
  }
  const route = load(`src/app/api/${service}/members/[id]/route.ts`, {
    ...lifecycleMocks,
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    [`@/lib/${service}/access`]: {
      [`get${title}Context`]: async () => ({ userId: 'user', memberId: 'actor', organizationId: 'org', role: 'admin' }),
      hasMinRole: role => ['admin', 'owner'].includes(role),
      orgSlugFrom: () => undefined,
    },
    [`@/lib/${service}/types`]: { ROLE_HIERARCHY: { member: 0, manager: 1, admin: 2, owner: 3 } },
  })
  const call = (body = { role: 'manager' }) => route[action](action === 'PATCH'
    ? { json: async () => body } : {}, { params: Promise.resolve({ id: 'target' }) })
  return { call, state: () => ({ attempts, writes, target }) }
}

;(async () => {
  for (const service of ['aio', 'shodan', 'sfa']) {
    const invalid = fixture(service, 'PATCH')
    assert.equal((await invalid.call(null)).status, 400, `${service} null role body`)
    assert.deepEqual(invalid.state(), { attempts: 0, writes: 0, target: { id: 'target', organizationId: 'org', status: 'ACTIVE', role: 'member' } })
    for (const action of ['PATCH', 'DELETE']) {
      const valid = fixture(service, action)
      const response=await valid.call();assert.equal(response.status,200)
      if(action==='DELETE'&&['aio','shodan'].includes(service))assert.equal((await response.json()).memberId,'target')
      assert.deepEqual({ attempts: valid.state().attempts, writes: valid.state().writes }, { attempts: 1, writes: 1 })

      for (const scenario of ['actor-revoked', 'target-promoted', 'unknown-target-role']) {
        const race = fixture(service, action, scenario)
        assert.equal((await race.call()).status, 403, `${service} ${action} ${scenario}`)
        assert.deepEqual({ attempts: race.state().attempts, writes: race.state().writes }, { attempts: scenario === 'unknown-target-role' ? 1 : 2, writes: 0 })
      }
    }
  }
  console.log('PASS AIO/Shodan/SFA member update/delete recheck active actor and target rank after a conflict')
})().catch(error => { console.error(error); process.exitCode = 1 })
