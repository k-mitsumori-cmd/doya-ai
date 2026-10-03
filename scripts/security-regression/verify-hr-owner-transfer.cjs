const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const roles = { OWNER: 'OWNER', ADMIN: 'ADMIN', MANAGER: 'MANAGER', MEMBER: 'MEMBER' }
const common = {
  'next/server': { NextResponse: Response },
  '@/lib/hr/types': { HrMemberRole: roles },
  '@/lib/hr/constants': { ROLE_HIERARCHY: { OWNER: 4, ADMIN: 3, MANAGER: 2, MEMBER: 1 } },
}

function memberRoute({ targetRole = 'MEMBER', changedBeforeWrite = false } = {}) {
  let writes = 0
  const tx = {
    $queryRaw: async sql => sql.join('?').includes('hr_organizations') ? [{ id: 'org' }] : [{ id: 'actor' }, { id: 'target' }],
    hrOrganizationMember: {
      findFirst: async ({ where }) => where.id === 'actor'
        ? { id: 'actor', userId: 'user-actor', role: 'OWNER', status: 'ACTIVE' }
        : { id: 'target', userId: 'user-target', role: targetRole, status: 'ACTIVE' },
      findUnique: async () => ({ id: 'target' }),
      updateMany: async ({ where }) => {
        assert.equal(where.role, targetRole)
        writes++
        return { count: changedBeforeWrite ? 0 : 1 }
      },
      deleteMany: async ({ where }) => {
        assert.equal(where.role, targetRole)
        writes++
        return { count: changedBeforeWrite ? 0 : 1 }
      },
    },
  }
  const prisma = { $transaction: async fn => fn(tx) }
  const route = load('src/app/api/hr/organization/members/[id]/route.ts', {
    ...common,
    '@/lib/prisma': { prisma },
    '@/lib/hr/access': {
      getHrContext: async () => ({ organizationId: 'org', memberId: 'actor', userId: 'user-actor', role: 'OWNER' }),
      hasMinRole: () => true,
    },
  })
  const ctx = { params: Promise.resolve({ id: 'target' }) }
  return { writes, patch: body => route.PATCH({ json: async () => body }, ctx), remove: () => route.DELETE({}, ctx), count: () => writes }
}

function transferRoute({ duplicateOwner = false } = {}) {
  const members = {
    actor: { id: 'actor', userId: 'user-actor', role: 'OWNER', status: 'ACTIVE' },
    target: { id: 'target', userId: 'user-target', role: 'ADMIN', status: 'ACTIVE', user: { name: 'Target' } },
  }
  let locks = 0
  let writes = 0
  const tx = {
    $queryRaw: async () => { locks++; return [{ id: 'org' }] },
    hrOrganizationMember: {
      findMany: async () => duplicateOwner
        ? [{ id: 'actor' }, { id: 'other-owner' }]
        : Object.values(members).filter(m => m.role === 'OWNER' && m.status === 'ACTIVE').map(m => ({ id: m.id })),
      findFirst: async ({ where }) => {
        const member = members[where.id]
        return member?.status === 'ACTIVE' && member.role !== 'OWNER' ? member : null
      },
      updateMany: async ({ where, data }) => {
        const member = members[where.id]
        if (!member || member.status !== where.status ||
          (typeof where.role === 'string' && member.role !== where.role) ||
          (where.role?.not && member.role === where.role.not)) return { count: 0 }
        writes++
        member.role = data.role
        return { count: 1 }
      },
    },
  }
  const prisma = { $transaction: async fn => {
    const previous = structuredClone(members)
    try { return await fn(tx) } catch (error) { Object.assign(members, previous); throw error }
  } }
  const route = load('src/app/api/hr/organization/transfer-owner/route.ts', {
    ...common,
    '@/lib/prisma': { prisma },
    '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org', memberId: 'actor', userId: 'user-actor', role: 'OWNER' }) },
    '@/lib/hr/audit': { logAudit: async () => {} },
  })
  return {
    members, count: () => writes, locks: () => locks,
    request: () => route.POST({ json: async () => ({ targetMemberId: 'target' }) }),
  }
}

;(async () => {
  await check('generic member editing cannot grant or mutate OWNER', async () => {
    const ordinary = memberRoute()
    assert.equal((await ordinary.patch({ role: 'OWNER' })).status, 400)
    const owner = memberRoute({ targetRole: 'OWNER' })
    assert.equal((await owner.patch({ status: 'SUSPENDED' })).status, 403)
    assert.equal((await owner.remove()).status, 403)
    assert.equal(ordinary.count() + owner.count(), 0)
  })
  await check('member update and deletion cannot affect a newly promoted owner', async () => {
    const race = memberRoute({ changedBeforeWrite: true })
    assert.equal((await race.patch({ status: 'SUSPENDED' })).status, 409)
    assert.equal((await race.remove()).status, 409)
  })
  await check('transfer changes exactly one owner and rejects a stale second request', async () => {
    const transfer = transferRoute()
    assert.equal((await transfer.request()).status, 200)
    assert.equal(transfer.members.actor.role, 'ADMIN')
    assert.equal(transfer.members.target.role, 'OWNER')
    assert.equal((await transfer.request()).status, 409)
    assert.equal(transfer.count(), 2)
    assert.equal(transfer.locks(), 2)
  })
  await check('transfer refuses an organization with multiple active owners', async () => {
    const transfer = transferRoute({ duplicateOwner: true })
    assert.equal((await transfer.request()).status, 409)
    assert.equal(transfer.count(), 0)
  })
  console.log(JSON.stringify({ passed: results.length, results }))
})().catch(error => { console.error(error); process.exitCode = 1 })
