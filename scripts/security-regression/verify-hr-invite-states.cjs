const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const epoch = 1800000000000
async function acceptCase({ status = 'PENDING', delta = 60000, locked = {}, failedClaim = false, claimResult = {}, members = 1, body = { token: 'opaque-token' }, malformed = false } = {}) {
  let now = epoch, created = 0, claims = 0, expiredWrites = 0, lookups = 0, currentReads = 0, audits = 0, locks = 0
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  const invitation = { id: 'invite', token: 'opaque-token', organizationId: 'org', email: 'invited@example.invalid', role: 'MEMBER', status, expiresAt: new Date(epoch + delta), createdAt: new Date(epoch - 10000), organization: { id: 'org', name: 'Synthetic org' } }
  const tx = {
    $queryRaw: async () => { locks++; return [{ id: 'org' }] },
    hrInvitation: {
      findUnique: async () => { currentReads++; return locked === null ? null : { ...invitation, ...locked, ...(currentReads > 1 ? claimResult : {}) } },
      updateMany: async ({ where }) => { claims++; assert.equal(where.token, invitation.token); assert.equal(where.organizationId, invitation.organizationId); assert.equal(where.role, 'MEMBER'); assert.equal(where.email, invitation.email); assert.equal(where.status, 'PENDING'); assert.ok(where.expiresAt.gt instanceof Date); if (failedClaim) now = epoch + delta + 1; return { count: failedClaim ? 0 : 1 } },
    },
    hrOrganizationMember: { count: async () => members, create: async () => { created++; return { id: 'member' } } },
  }
  const prisma = { hrInvitation: { findUnique: async () => { lookups++; return invitation }, updateMany: async ({ where }) => { assert.equal(where.status, 'PENDING'); assert.ok(where.expiresAt.lte); expiredWrites++; return { count: 1 } } }, user: { findUnique: async () => ({ email: 'Invited@Example.Invalid' }) }, hrOrganizationMember: { findFirst: async () => null }, $transaction: async work => work(tx) }
  const api = load('src/app/api/hr/organization/invite/accept/route.ts', { 'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { id: 'synthetic-user' } }) }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/hr/audit': { logAudit: async () => { audits++ } }, '@/lib/hr/billing': { getOrgPlan: async () => 'FREE', getOrgPlanLimits: () => ({ maxMembers: 2 }) } }, { Date: Clock })
  const res = await api.POST({ json: async () => { if (malformed) throw SyntaxError('PRIVATE_INPUT'); return body } })
  return { status: res.status, body: await res.json(), created, claims, expiredWrites, lookups, audits, locks, currentReads }
}
;(async () => {
  await check('invalid invitation bodies return 400 before lookup or mutation', async () => { for (const opts of [{ malformed: true }, ...[null, [], {}, { token: 1 }, { token: ' ' }, { token: 'x'.repeat(257) }].map(body => ({ body }))]) { const r = await acceptCase(opts); assert.equal(r.status, 400); assert.equal(r.body.code, 'INVALID_INVITATION_INPUT'); assert.equal(r.lookups, 0); assert.equal(r.created, 0); assert.equal(r.claims, 0); assert.ok(!JSON.stringify(r.body).includes('PRIVATE_INPUT')) } })
  await check('pending expiry including the exact deadline returns 410 without claiming membership', async () => { for (const delta of [-1, 0]) { const r = await acceptCase({ delta }); assert.equal(r.status, 410); assert.equal(r.body.code, 'INVITE_EXPIRED'); assert.equal(r.created, 0); assert.equal(r.claims, 0); assert.equal(r.expiredWrites, 1); assert.equal(r.audits, 0) } })
  await check('stored expiry returns 410 while accepted and cancelled invitations return 409', async () => { for (const status of ['EXPIRED', 'ACCEPTED', 'CANCELLED']) { const r = await acceptCase({ status, delta: -1 }); assert.equal(r.status, status === 'EXPIRED' ? 410 : 409); assert.equal(r.body.code, status === 'EXPIRED' ? 'INVITE_EXPIRED' : 'INVITE_UNAVAILABLE'); assert.equal(r.created, 0); assert.equal(r.claims, 0); assert.equal(r.expiredWrites, 0) } })
  await check('expiry while waiting for the organization lock takes priority over the member limit', async () => { const r = await acceptCase({ locked: { expiresAt: new Date(epoch) }, members: 2 }); assert.equal(r.status, 410); assert.equal(r.body.code, 'INVITE_EXPIRED'); assert.equal(r.locks, 1); assert.equal(r.created, 0); assert.equal(r.claims, 0) })
  await check('changed, removed or consumed invitation under the organization lock is never claimed', async () => { for (const locked of [null, { token: 'different' }, { organizationId: 'foreign' }, { role: 'OWNER' }, { email: 'other@example.invalid' }, { status: 'ACCEPTED' }, { status: 'CANCELLED' }]) { const r = await acceptCase({ locked }); assert.equal(r.status, 409); assert.equal(r.body.code, 'INVITE_UNAVAILABLE'); assert.equal(r.created, 0); assert.equal(r.claims, 0); assert.equal(r.audits, 0) } })
  await check('expiry between the locked check and claim returns 410 with no member or audit', async () => { for (const claimResult of [{}, { status: 'EXPIRED' }]) { const r = await acceptCase({ failedClaim: true, claimResult }); assert.equal(r.status, 410); assert.equal(r.body.code, 'INVITE_EXPIRED'); assert.equal(r.currentReads, 2); assert.equal(r.created, 0); assert.equal(r.audits, 0) } })
  await check('failed claim on a cancelled invitation returns 409 rather than guessing expiry', async () => { const r = await acceptCase({ failedClaim: true, claimResult: { status: 'CANCELLED' } }); assert.equal(r.status, 409); assert.equal(r.body.code, 'INVITE_UNAVAILABLE'); assert.equal(r.created, 0); assert.equal(r.audits, 0) })
  await check('a valid organization at capacity rejects before consuming the invite', async () => { const r = await acceptCase({ members: 2 }); assert.equal(r.status, 403); assert.equal(r.body.code, 'HR_ORG_MEMBER_LIMIT'); assert.equal(r.claims, 0); assert.equal(r.created, 0) })
  await check('valid matching invitation preserves atomic membership creation and audit', async () => { const r = await acceptCase(); assert.equal(r.status, 200); assert.equal(r.body.success, true); assert.equal(r.created, 1); assert.equal(r.claims, 1); assert.equal(r.locks, 1); assert.equal(r.audits, 1) })
  await check('invite lookup preserves consumed and cancelled states, and expires pending exactly at its deadline', async () => {
    for (const [status, delta, expected, writes] of [['PENDING', 1, 'PENDING', 0], ['PENDING', 0, 'EXPIRED', 1], ['PENDING', -1, 'EXPIRED', 1], ['EXPIRED', 1, 'EXPIRED', 0], ['ACCEPTED', -1, 'ACCEPTED', 0], ['CANCELLED', -1, 'CANCELLED', 0]]) {
      let updates = 0; class Clock extends Date { constructor(...args) { super(...(args.length ? args : [epoch])) } static now() { return epoch } }
      const invitation = { id: 'invite', status, expiresAt: new Date(epoch + delta), email: 'invited@example.invalid', role: 'MEMBER', organization: { id: 'org', name: 'Synthetic org', slug: 'org', logoUrl: null } }
      const api = load('src/app/api/hr/organization/invite/[token]/route.ts', { 'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma: { hrInvitation: { findUnique: async () => invitation, updateMany: async ({ where }) => { assert.equal(where.status, 'PENDING'); updates++; return { count: 1 } } } } } }, { Date: Clock })
      const r = await api.GET({}, { params: Promise.resolve({ token: 'opaque-token' }) }); assert.equal(r.status, 200); assert.equal((await r.json()).invitation.status, expected); assert.equal(updates, writes)
    }
  })
  console.log(JSON.stringify({ passed: results.length, scope: 'actual API; synthetic clock/auth/transaction; not a PostgreSQL concurrency or production write test', results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
