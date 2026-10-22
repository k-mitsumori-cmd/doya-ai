const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { Prisma } = require('@prisma/client')
const { load, check, results } = require('./load-typescript.cjs')

const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const store = load('src/lib/account-lifecycle/store.ts', {
  'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state,
})
const now = '2026-10-22T00:00:00.000Z'

function fence(userId, kind = 'retirement') {
  const operationId = crypto.randomUUID(), generation = crypto.randomUUID()
  const identity = { operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: userId, operationId, kind }
  const receipt = { version: 2, targetHash: state.lifecycleSubject(userId), operationId, operator: identity.operator,
    kind, inputDigest: 'a'.repeat(64), generation, token: crypto.randomUUID(), revision: 0,
    phase: 'reserved', reason: null, createdAt: now, updatedAt: now }
  return [
    [state.lifecycleFenceKey(userId), JSON.stringify({ version: 2, operationId, generation, kind, state: 'active' })],
    [state.lifecycleReceiptKey(identity), JSON.stringify(receipt)],
  ]
}

function fixture({ mode = 'accept', retiring = null, billing = null, malformed = null, existing = null, faults = [], recipientDrift = false, roleDrift = false, ownerDrift = false, unauthorized = false, sessionEmail = 'recipient@example.test' } = {}) {
  const settings = new Map([
    ...(retiring ? fence(retiring) : []), ...(billing ? fence(billing, 'checkout') : []),
    ...(malformed ? [[state.lifecycleFenceKey(malformed), '{broken']] : []),
  ])
  const initialSettings = [...settings]
  const observed = { userLock: [], workspaceLock: 0, workspaceReads: 0, members: 0, accepted: 0, invites: 0, deliveries: 0, reads: 0, transactions: 0 }
  const invitation = { id: 'inv', workspaceId: 'ws', email: 'recipient@example.test', role: 'guest',
    acceptedAt: null, expiresAt: new Date(Date.now() + 60000), workspace: { id: 'ws', slug: 'team', userId: 'owner' } }
  const tx = {
    $queryRaw: async query => {
      const sql = query.strings.join('')
      if (sql.includes('FROM "User"')) {
        const ids = query.values.flat().filter(value => typeof value === 'string')
        assert.deepEqual(ids, [...new Set(ids)].sort(), 'all User locks are canonical and unique')
        observed.userLock.push(ids)
        return ids.map(id => ({ id }))
      }
      if (sql.includes('FROM promane_workspaces')) {
        assert.equal(observed.userLock.length, observed.workspaceLock + 1, 'workspace lock follows all User locks on each attempt')
        observed.workspaceLock++
        return [{ id: 'ws', userId: ownerDrift ? 'other-owner' : 'owner' }]
      }
      if (sql.includes('FROM promane_members')) return [{ id: 'actor-member' }]
      if (sql.includes('FROM promane_invitations')) return [{ id: 'inv' }]
      throw Error(`unexpected SQL ${sql}`)
    },
    systemSetting: { findUnique: async ({ where }) => { observed.reads++; const value = settings.get(where.key); return value === undefined ? null : { value } } },
    user: {
      findMany: async () => {
        observed.recipientReads = (observed.recipientReads || 0) + 1
        return recipientDrift && observed.recipientReads % 2 === 0 ? [] : [{ id: 'recipient', email: 'recipient@example.test' }]
      },
      findUnique: async () => ({ email: 'recipient@example.test', name: 'Recipient' }),
    },
    promaneWorkspace: { findUnique: async () => { observed.workspaceReads++; return { name: 'Team', userId: 'owner' } } },
    promaneMember: {
      findUnique: async () => mode === 'issue' ? { role: 'admin', isActive: !unauthorized } : existing,
      findFirst: async () => null, count: async () => 1,
      create: async ({ data }) => { assert.equal(data.role, 'guest'); observed.members++ },
    },
    promaneInvitation: {
      findUnique: async () => {
        observed.invitationReads = (observed.invitationReads || 0) + 1
        return roleDrift && observed.invitationReads % 2 === 0 ? { ...invitation, role: 'admin' } : invitation
      },
      findFirst: async () => null, count: async () => 0,
      create: async ({ data }) => { observed.invites++; return { token: data.token, expiresAt: data.expiresAt } },
      update: async ({ data }) => { assert.ok(data.acceptedAt instanceof Date); observed.accepted++ },
    },
  }
  const prisma = { $transaction: async (work, options) => {
    observed.transactions++
    assert.equal(options.isolationLevel, mode === 'issue' ? 'ReadCommitted' : 'Serializable')
    const fault = faults[observed.transactions - 1]
    if (fault) throw fault
    return work(tx)
  },
    user: { findUnique: async () => ({ name: 'Inviter', email: 'admin@example.test' }) } }
  const helper = load('src/lib/promane/invite-admission.ts', {
    '@prisma/client': { Prisma }, crypto, '@/lib/prisma': { prisma },
    '@/lib/promane/limits': { getUserPromaneLimits: async () => ({ maxMembersPerWorkspace: 3 }) },
    '@/lib/account-lifecycle/store': store, '@/lib/account-lifecycle/state': state,
  })
  const routeMocks = { 'next/server': { NextResponse: Response }, 'next-auth': {
    getServerSession: async () => ({ user: { id: mode === 'issue' ? 'admin' : 'recipient', email: sessionEmail, name: 'Recipient' } }),
  }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/promane/invite-admission': helper,
    '@/lib/email': { sendEmail: async () => { observed.deliveries++; return { success: true } } } }
  const route = load(mode === 'issue' ? 'src/app/api/promane/invite/route.ts' : 'src/app/api/promane/invite/[token]/route.ts', routeMocks)
  return { observed, settings, initialSettings, helper, run: () => mode === 'issue'
    ? route.POST(new Request('https://example.test/api/promane/invite', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws', email: invitation.email, role: 'guest' }) }))
    : route.POST(new Request('https://example.test/api/promane/invite/token', { method: 'POST' }), { params: Promise.resolve({ token: 'token' }) }) }
}

;(async () => {
  for (const [mode, subjects] of [
    ['accept', ['recipient', 'owner']], ['issue', ['admin', 'owner', 'recipient']],
  ]) for (const subject of subjects) await check(`${mode} refuses retirement on ${subject} before writes`, async () => {
    const f = fixture({ mode, retiring: subject }), response = await f.run(), body = await response.json()
    assert.equal(response.status, 409)
    assert.equal(body.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.deepEqual({ members: f.observed.members, accepted: f.observed.accepted, invites: f.observed.invites, deliveries: f.observed.deliveries },
      { members: 0, accepted: 0, invites: 0, deliveries: 0 })
    assert.deepEqual([...f.settings], f.initialSettings)
    assert.match(response.headers.get('cache-control'), /private.*no-store/)
    assert.match(response.headers.get('vary'), /Cookie/i)
  })
  for (const mode of ['accept', 'issue']) await check(`${mode} rejects malformed fence without writes`, async () => {
    const f = fixture({ mode, malformed: mode === 'issue' ? 'admin' : 'recipient' }), response = await f.run()
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'LIFECYCLE_STATE_UNAVAILABLE')
    assert.equal(f.observed.members + f.observed.accepted + f.observed.invites + f.observed.deliveries, 0)
  })
  for (const mode of ['accept', 'issue']) await check(`${mode} permits billing-only fence`, async () => {
    const f = fixture({ mode, billing: mode === 'issue' ? 'admin' : 'recipient' }), response = await f.run()
    assert.equal(response.status, 200)
    assert.equal((await response.json()).success, true)
    assert.deepEqual({ members: f.observed.members, accepted: f.observed.accepted, invites: f.observed.invites, deliveries: f.observed.deliveries },
      mode === 'issue' ? { members: 0, accepted: 0, invites: 1, deliveries: 1 } : { members: 1, accepted: 1, invites: 0, deliveries: 0 })
  })
  await check('unknown existing member role never consumes an invitation or gains membership', async () => {
    const f = fixture({ existing: { id: 'old', isActive: true, role: '__UNRECOGNIZED__' } }), response = await f.run()
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'PROMANE_MEMBER_ROLE_UNAVAILABLE')
    assert.equal(f.observed.members + f.observed.accepted, 0)
  })
  await check('unauthorized issuer cannot lock or read foreign workspace and recipient', async () => {
    const f = fixture({ mode: 'issue', unauthorized: true }), response = await f.run()
    assert.equal(response.status, 403)
    assert.equal(f.observed.workspaceReads, 0)
    assert.equal(f.observed.userLock.length, 0)
    assert.equal(f.observed.invites + f.observed.deliveries, 0)
  })
  await check('foreign-email claimant cannot lock owner before rejection', async () => {
    const f = fixture({ mode: 'accept', sessionEmail: 'other@example.test' }), response = await f.run()
    assert.equal(response.status, 403)
    assert.equal((await response.json()).code, 'email_mismatch')
    assert.equal(f.observed.userLock.length + f.observed.workspaceLock + f.observed.members + f.observed.accepted, 0)
  })
  const prismaFault = (code, metaCode) => Object.assign(new Error('synthetic fault'), { code, ...(metaCode ? { meta: { code: metaCode } } : {}) })
  for (const mode of ['accept', 'issue']) for (const fault of [prismaFault('P2034'), prismaFault('P2010', '40001'), prismaFault('P2010', '40P01')]) {
    await check(`${mode} retries only a whole transaction for ${fault.meta?.code || fault.code}`, async () => {
      const f = fixture({ mode, faults: [fault] }), response = await f.run()
      assert.equal(response.status, 200)
      assert.equal(f.observed.transactions, 2)
      assert.equal(f.observed.userLock.length, 1)
    })
  }
  for (const mode of ['accept', 'issue']) for (const fault of [prismaFault('P2010', '23505'), prismaFault('P2010'), prismaFault('P2002')]) {
    await check(`${mode} does not retry ${fault.meta?.code || fault.code}`, async () => {
      const f = fixture({ mode, faults: [fault] }), response = await f.run()
      assert.equal(response.status, 500)
      assert.equal(f.observed.transactions, 1)
      assert.equal(f.observed.members + f.observed.accepted + f.observed.invites + f.observed.deliveries, 0)
    })
  }
  for (const [mode, variation] of [['issue', { recipientDrift: true }], ['accept', { roleDrift: true }],
    ['issue', { ownerDrift: true }], ['accept', { ownerDrift: true }]]) {
    await check(`${mode} refuses discovered scope drift before writes`, async () => {
      const f = fixture({ mode, ...variation }), response = await f.run()
      assert.equal(response.status, 409, `${mode} ${JSON.stringify(variation)} ${JSON.stringify(f.observed)}`)
      assert.equal((await response.json()).code, 'PROMANE_INVITE_STATE_CHANGED')
      assert.equal(f.observed.members + f.observed.accepted + f.observed.invites + f.observed.deliveries, 0)
      assert.equal(f.observed.transactions, 5)
    })
  }
  console.log(JSON.stringify({ passed: results.length, results, scope: 'Actual routes/helper/store/state with synthetic transaction; not native PostgreSQL or provider.' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
