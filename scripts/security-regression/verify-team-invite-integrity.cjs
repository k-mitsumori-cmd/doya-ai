const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load, check, results } = require('./load-typescript.cjs')

const services = [
  { id: 'aio', model: 'aioMember', organization: 'aioOrganization', context: 'getAioContext' },
  { id: 'shodan', model: 'shodanMember', organization: 'shodanOrganization', context: 'getShodanContext' },
  { id: 'quote', model: 'quoteMember', organization: 'quoteOrganization', context: 'getQuoteContext' },
  { id: 'mensetsu', model: 'mensetsuMember', organization: 'mensetsuOrganization', context: 'getMensetsuContext' },
  { id: 'aishodan', model: 'aishodanMember', organization: 'aishodanOrganization', context: 'getAishodanContext' },
]
const token = 'test-token-long-enough'
const invitedEmail = 'invited@example.test'
const response = { NextResponse: Response }

function acceptanceFixture(service, { createdAt = new Date(), role = 'member', existing = false } = {}) {
  let accountEmail = invitedEmail
  let updates = 0
  let deletes = 0
  const member = {
    id: 'invite', organizationId: 'org', organization: { id: 'org', name: 'Example', slug: 'example' },
    role, status: 'PENDING', inviteToken: token, inviteEmail: invitedEmail, createdAt,
  }
  const membership = {
    findUnique: async ({ where }) => where.id === 'invite' || where.inviteToken === member.inviteToken ? member : null,
    findFirst: async () => existing ? { id: 'existing' } : null,
    updateMany: async ({ where, data }) => {
      assert.equal(where.status, 'PENDING')
      assert.equal(where.inviteToken, token)
      if (member.status !== 'PENDING' || member.inviteToken !== token) return { count: 0 }
      Object.assign(member, data)
      updates++
      return { count: 1 }
    },
    deleteMany: async ({ where }) => {
      assert.equal(where.status, 'PENDING')
      if (member.status !== 'PENDING') return { count: 0 }
      member.status = 'DELETED'
      member.inviteToken = null
      deletes++
      return { count: 1 }
    },
  }
  const tx = {
    $queryRaw: async () => [{ id: 'org' }],
    [service.model]: membership,
    user: { findUnique: async () => ({ email: accountEmail }) },
  }
  const prisma = { [service.model]: membership, $transaction: async fn => fn(tx) }
  const api = load(`src/app/api/${service.id}/invite/[token]/route.ts`, {
    'next/server': response,
    'next-auth': { getServerSession: async () => ({ user: { id: 'user', email: invitedEmail, name: 'Invited' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    [`@/lib/${service.id}/access`]: { resolveUserId: async () => 'user' },
  })
  const ctx = { params: Promise.resolve({ token }) }
  return {
    member,
    setAccountEmail: value => { accountEmail = value },
    post: () => api.POST({}, ctx),
    get: () => api.GET({}, ctx),
    counts: () => ({ updates, deletes }),
  }
}

function creationFixture(service, { currentRole = 'owner', clock = Date } = {}) {
  const pending = []
  let sent = 0
  let sequence = 0
  let queue = Promise.resolve()
  const member = {
    findFirst: async ({ where }) => pending.find(row => row.inviteEmail === where.inviteEmail &&
      (row.status === 'ACTIVE' || row.createdAt > where.OR[1].createdAt.gt)) || null,
    deleteMany: async ({ where }) => {
      const before = pending.length
      for (let i = pending.length - 1; i >= 0; i--) {
        if (pending[i].inviteEmail === where.inviteEmail && pending[i].status === 'PENDING' && pending[i].createdAt <= where.createdAt.lte) pending.splice(i, 1)
      }
      return { count: before - pending.length }
    },
    create: async ({ data }) => {
      const row = { id: `invite-${++sequence}`, createdAt: new clock(), ...data }
      pending.push(row)
      return row
    },
  }
  const tx = {
    $queryRaw: async sql => sql.join('?').includes(`FROM ${service.id}_members`)
      ? ['owner', 'admin'].includes(currentRole) ? [{ role: currentRole }] : []
      : [{ id: 'org' }],
    [service.model]: member,
  }
  const prisma = {
    [service.organization]: { findUnique: async () => ({ name: 'Example' }) },
    $transaction: fn => {
      const result = queue.then(() => fn(tx))
      queue = result.then(() => {}, () => {})
      return result
    },
  }
  const api = load(`src/app/api/${service.id}/members/route.ts`, {
    'next/server': response,
    crypto,
    '@/lib/prisma': { prisma },
    '@/lib/html-escape': { escapeHtml: value => value },
    [`@/lib/${service.id}/access`]: {
      [service.context]: async () => ({ organizationId: 'org', organizationName: 'Example', userId: 'owner', memberId: 'actor', role: 'owner' }),
      hasMinRole: () => true,
      orgSlugFrom: () => undefined,
    },
    [`@/lib/${service.id}/types`]: { ROLE_HIERARCHY: { owner: 4, admin: 3, manager: 2, member: 1 } },
    '@/lib/email': { sendEmail: async () => { sent++; return { success: true } } },
  }, { Date: clock })
  return {
    pending,
    sent: () => sent,
    invite: (role = 'member') => api.POST({ json: async () => ({ email: invitedEmail, role }) }),
  }
}

;(async () => {
  for (const service of services) {
    await check(`${service.id} rejects unknown invite roles before saving`, async () => {
      const fixture = creationFixture(service)
      assert.equal((await fixture.invite('admni')).status, 400)
      assert.equal(fixture.pending.length, 0)
      assert.equal(fixture.sent(), 0)
    })
    await check(`${service.id} invite requires the invited account`, async () => {
      const fixture = acceptanceFixture(service)
      fixture.setAccountEmail('other@example.test')
      assert.equal((await fixture.post()).status, 403)
      assert.deepEqual(fixture.counts(), { updates: 0, deletes: 0 })
      fixture.setAccountEmail(invitedEmail)
      assert.equal((await fixture.post()).status, 200)
      assert.deepEqual(fixture.counts(), { updates: 1, deletes: 0 })
      assert.equal(fixture.member.inviteToken, null)
      assert.notEqual((await fixture.post()).status, 200)
    })
    await check(`${service.id} expired and owner-role invites cannot be claimed`, async () => {
      const expired = acceptanceFixture(service, { createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) })
      assert.equal((await expired.get()).status, 410)
      assert.equal((await expired.post()).status, 410)
      assert.equal(expired.counts().updates, 0)
      const owner = acceptanceFixture(service, { role: 'owner' })
      assert.notEqual((await owner.post()).status, 200)
      assert.equal(owner.counts().updates, 0)
    })
    await check(`${service.id} concurrent invites dedupe and expired invites can be replaced`, async () => {
      const fixture = creationFixture(service)
      const statuses = await Promise.all([fixture.invite(), fixture.invite()]).then(rows => rows.map(row => row.status).sort())
      assert.deepEqual(statuses, [200, 409])
      assert.equal(fixture.sent(), 1, 'mock sender only; no external email is sent')
      assert.equal(fixture.pending.length, 1)
      fixture.pending[0].createdAt = new Date(Date.now() - 49 * 60 * 60 * 1000)
      assert.equal((await fixture.invite()).status, 200)
      assert.equal(fixture.pending.length, 1)
      assert.equal(fixture.sent(), 2)
    })
    await check(`${service.id} can replace an invite exactly at expiry while an unexpired invite still dedupes`, async () => {
      const now = Date.parse('2026-10-06T04:00:00Z');
      class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
      for (const offset of [-1, 0, 1]) {
        const f = creationFixture(service, { clock: Clock }); assert.equal((await f.invite()).status, 200);
        f.pending[0].createdAt = new Date(now - 48 * 60 * 60 * 1000 + offset);
        assert.equal((await f.invite()).status, offset <= 0 ? 200 : 409);
        assert.equal(f.pending.length, 1); assert.equal(f.sent(), offset <= 0 ? 2 : 1);
      }
    })
    if (['aio', 'shodan', 'quote', 'mensetsu', 'aishodan'].includes(service.id)) {
      await check(`${service.id} revoked inviter cannot create or send an invite`, async () => {
        const fixture = creationFixture(service, { currentRole: 'member' })
        assert.equal((await fixture.invite()).status, 403)
        assert.equal(fixture.pending.length, 0)
        assert.equal(fixture.sent(), 0, 'mock sender only; no external email is sent')
      })
    }
  }
  console.log(JSON.stringify({ passed: results.length, results }))
})().catch(error => { console.error(error); process.exitCode = 1 })
