const assert = require('node:assert/strict');
const { load, check, results } = require('./load-typescript.cjs');
const deadline = Date.parse('2026-10-06T03:00:00Z');
const ttl = 48 * 60 * 60 * 1000;
function fixture(service, { offset = -1, delayAt = '', full = false, existing = false } = {}) {
  let now = deadline + offset, attempted = 0, rollbacks = 0, committed = 0;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const delay = stage => { if (delayAt === stage) now = deadline; };
  const member = { id: 'invite', organizationId: 'org', userId: 'pending', status: 'PENDING', inviteToken: 'token', inviteEmail: 'qa@example.invalid', role: 'member', createdAt: new Date(deadline - ttl), employee: { email: 'qa@example.invalid' }, organization: { name: 'Synthetic', slug: 'team' } };
  const invitation = { id: 'invite', token: 'token', workspaceId: 'org', email: 'qa@example.invalid', role: 'member', expiresAt: new Date(deadline), acceptedAt: null, invitedBy: { name: null }, workspace: { id: 'org', name: 'Synthetic', slug: 'team', userId: 'owner' } };
  let state = { member: structuredClone(member), oldStatus: 'ACTIVE', promaneMembers: 0, acceptedAt: null };
  const membership = {
    findUnique: async () => structuredClone(state.member),
    findFirst: async ({ where }) => {
      if (where.inviteToken) return structuredClone(state.member);
      if (where.role === 'owner') { delay('owner'); return { userId: 'owner' }; }
      delay('existing'); return existing ? { id: 'existing', userId: 'user', isActive: true } : null;
    },
    count: async () => { delay('quota'); return full ? 3 : 1; },
    deleteMany: async () => { attempted++; state.member = null; return { count: 1 }; },
    updateMany: async ({ where, data }) => {
      attempted++;
      if (where.id === 'invite') {
        if (where.createdAt?.gt && !(state.member.createdAt > where.createdAt.gt)) return { count: 0 };
        Object.assign(state.member, data); delay('claim');
      } else { state.oldStatus = data.status; delay('transfer'); }
      return { count: 1 };
    },
  };
  const tx = {
    sfaMember: membership, kintaiMember: membership,
    user: { findUnique: async () => ({ plan: 'FREE', id: 'user' }) },
    promaneInvitation: {
      findUnique: async () => structuredClone({ ...invitation, acceptedAt: state.acceptedAt }),
      update: async () => { attempted++; state.acceptedAt = new Clock(); delay('claim'); },
    },
    promaneMember: {
      findUnique: async () => { delay('existing'); return existing ? { id: 'existing', isActive: true } : null; },
      count: async () => { delay('quota'); return full ? 3 : 1; },
      create: async () => { attempted++; state.promaneMembers++; delay('create'); },
    },
  };
  const prisma = { ...tx, kintaiEmployee: { findFirst: async () => ({ name: 'Synthetic', email: 'qa@example.invalid' }) }, $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    const before = structuredClone(state);
    try { const value = await fn(tx); committed += attempted; return value; }
    catch (error) { state = before; rollbacks++; throw error; }
  } };
  const common = { 'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { id: 'user', email: 'qa@example.invalid' } }) }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma } };
  const tokenHelpers = load('src/lib/kintai/invite-token.ts', {}, { Date: Clock, crypto: require('node:crypto').webcrypto });
  const limits = load('src/lib/sfa/limits.ts', { ...common, '@/lib/plan-utils': load('src/lib/plan-utils.ts') }, { Date: Clock });
  const promane = load('src/lib/promane/invite-admission.ts', { ...common, '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } } }, crypto: require('node:crypto'), '@/lib/promane/limits': { getUserPromaneLimits: async () => ({ maxMembersPerWorkspace: 3 }) } }, { Date: Clock });
  const route = load(`src/app/api/${service}/invite/[token]/route.ts`, { ...common, '@/lib/kintai/invite-token': tokenHelpers, '@/lib/sfa/limits': limits, '@/lib/promane/invite-admission': promane }, { Date: Clock });
  return { get: () => route.GET({}, { params: Promise.resolve({ token: 'token' }) }), post: () => route.POST({}, { params: Promise.resolve({ token: 'token' }) }), snapshot: () => structuredClone(state), stats: () => ({ attempted, rollbacks, committed }), tokenHelpers, Clock };
}
(async () => {
  for (const service of ['sfa', 'kintai', 'promane']) {
    await check(`${service}: GET and POST expire at the exact deadline and after it without writes`, async () => {
      for (const offset of [0, 1]) for (const method of ['get', 'post']) {
        const f = fixture(service, { offset }); const before = f.snapshot(); const r = await f[method]();
        assert.equal(r.status, 410); assert.deepEqual(f.snapshot(), before); assert.equal(f.stats().attempted, 0);
      }
    });
    await check(`${service}: one millisecond before expiry still admits normally`, async () => {
      const f = fixture(service); assert.equal((await f.get()).status, 200); assert.equal((await f.post()).status, 200);
      if (service === 'promane') { assert.equal(f.snapshot().promaneMembers, 1); assert.ok(f.snapshot().acceptedAt); }
      else assert.equal(f.snapshot().member.status, 'ACTIVE');
      if (service === 'kintai') assert.equal(f.snapshot().oldStatus, 'INACTIVE');
    });
    await check(`${service}: delayed existing-member read cannot admit or consume a now-expired invite`, async () => {
      for (const existing of [false, true]) { const f = fixture(service, { delayAt: 'existing', existing }); const before = f.snapshot(); assert.equal((await f.post()).status, 410); assert.deepEqual(f.snapshot(), before); assert.equal(f.stats().attempted, 0); }
    });
    if (service !== 'kintai') await check(`${service}: expiry while counting seats takes precedence over quota guidance`, async () => {
      for (const full of [false, true]) { const f = fixture(service, { delayAt: 'quota', full }); const before = f.snapshot(); assert.equal((await f.post()).status, 410); assert.deepEqual(f.snapshot(), before); assert.equal(f.stats().attempted, 0); }
    });
    await check(`${service}: delayed claim rolls back every membership and invitation write`, async () => {
      const f = fixture(service, { delayAt: 'claim' }); const before = f.snapshot(); const r = await f.post(); assert.equal(r.status, 410); assert.deepEqual(f.snapshot(), before); assert.ok(f.stats().attempted > 0); assert.equal(f.stats().rollbacks, 1); assert.equal(f.stats().committed, 0);
    });
  }
  await check('Kintai: expiry during old-organization deactivation rolls back the transfer', async () => {
    const f = fixture('kintai', { delayAt: 'transfer' }); const before = f.snapshot(); assert.equal((await f.post()).status, 410); assert.deepEqual(f.snapshot(), before); assert.equal(f.stats().rollbacks, 1);
  });
  await check('Promane: expiry during member creation rolls back both membership and invitation', async () => {
    const f = fixture('promane', { delayAt: 'create' }); const before = f.snapshot(); assert.equal((await f.post()).status, 410); assert.deepEqual(f.snapshot(), before); assert.equal(f.stats().rollbacks, 1);
  });
  await check('Kintai: timestamped reissued and legacy tokens share a strict expiry boundary', async () => {
    for (const offset of [-1, 0, 1]) {
      const f = fixture('kintai', { offset }); const issuedAt = deadline - ttl;
      assert.equal(f.tokenHelpers.isKintaiInviteExpired(f.tokenHelpers.createKintaiInviteToken(issuedAt), new Date(0)), offset >= 0);
      assert.equal(f.tokenHelpers.isKintaiInviteExpired('legacy', new Date(issuedAt)), offset >= 0);
    }
  });
  console.log(JSON.stringify({ passed: results.length, scope: 'Actual API/helper/seat admission with synthetic clock and transactional rollback model; no real database or external API', results }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
