process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const { load } = require('../load-typescript.cjs')
const { actualMembership, state } = require('../hr-membership-fixture-bridge.cjs')
const privateApiResponse = load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } })

async function scenario({ contextRole, currentRole }) {
  let writes = 0, mail = 0, actorReads = 0, memberReads = 0
  const actor = { id: 'actor', userId: 'user-actor', role: currentRole, status: 'ACTIVE' }
  const owner = currentRole === 'OWNER' ? actor : { id: 'owner', userId: 'user-owner', role: 'OWNER', status: 'ACTIVE' }
  const members = { findMany: async () => { memberReads++; return owner === actor ? [actor] : [owner, actor] },
    count: async () => 2, findFirst: async () => null }
  const tx = {
    $queryRaw: async sql => {
      const query = Array.from(sql).join('?')
      if (query.includes('hr_organizations')) return [{ id: 'org' }]
      if (query.includes('role IN')) { actorReads++; return ['OWNER', 'ADMIN'].includes(currentRole) ? [{ id: actor.id, role: currentRole }] : [] }
      if (query.includes('hr_organization_members')) return [{ id: owner.id }, { id: actor.id }]
      throw Error('Unexpected SQL')
    },
    user: { findUnique: async () => null },
    hrOrganizationMember: members,
    hrInvitation: { findFirst: async () => null, create: async () => { writes++; throw Error('Quota-denied invite wrote') } },
  }
  const prisma = { ...tx, $transaction: async work => work(tx) }
  const api = load('src/app/api/hr/organization/invite/route.ts', {
    'next/server': { NextResponse: Response }, '@/lib/private-api-response': privateApiResponse,
    'next-auth': { getServerSession: async () => ({ user: { id: actor.userId } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
    '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org', memberId: actor.id,
      userId: actor.userId, role: contextRole }), hasMinRole: role => role === 'OWNER' || role === 'ADMIN' },
    '@/lib/hr/types': { HrMemberRole: { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER' } },
    '@/lib/hr/billing': { getOrgPlan: async () => 'FREE', getOrgPlanLimits: () => ({ maxMembers: 2 }) },
    '@/lib/hr/membership-write': actualMembership(prisma), '@/lib/account-lifecycle/state': state,
    '@/lib/hr/email': { sendInvitationEmail: async () => { mail++; throw Error('Quota-denied invite mailed') } },
    '@/lib/hr/audit': { logAudit: async () => { throw Error('Quota-denied invite audited') } },
    crypto: require('node:crypto'),
  })
  const response = await api.POST({ json: async () => ({ email: 'recipient@example.invalid' }) })
  return { status: response.status, body: await response.json(), writes, mail, actorReads, memberReads }
}

;(async () => {
  const demoted = await scenario({ contextRole: 'OWNER', currentRole: 'ADMIN' })
  assert.equal(demoted.status, 403)
  assert.equal(demoted.body.code, 'HR_ORG_MEMBER_LIMIT')
  assert.equal(demoted.body.canManageBilling, false)
  assert.equal(demoted.writes, 0); assert.equal(demoted.mail, 0)
  assert.equal(demoted.actorReads, 1); assert.ok(demoted.memberReads >= 2)
  const promoted = await scenario({ contextRole: 'ADMIN', currentRole: 'OWNER' })
  assert.equal(promoted.status, 403)
  assert.equal(promoted.body.code, 'HR_ORG_MEMBER_LIMIT')
  assert.equal(promoted.body.canManageBilling, true)
  assert.equal(promoted.writes, 0); assert.equal(promoted.mail, 0)
  assert.equal(promoted.actorReads, 1); assert.ok(promoted.memberReads >= 2)
  const revoked = await scenario({ contextRole: 'OWNER', currentRole: 'MEMBER' })
  assert.equal(revoked.status, 403)
  assert.equal(revoked.body.canManageBilling, undefined)
  assert.equal(revoked.writes, 0); assert.equal(revoked.mail, 0)
  assert.equal(revoked.actorReads, 1)
  console.log(JSON.stringify({ passed: 3, scope: 'Actual HR invite route and membership writer with synthetic transaction and no email/DB',
    demotedOwnerBilling: demoted.body.canManageBilling, promotedOwnerBilling: promoted.body.canManageBilling,
    revokedActorNoBilling: revoked.body.canManageBilling === undefined }))
})().catch(error => { console.error(error); process.exitCode = 1 })
