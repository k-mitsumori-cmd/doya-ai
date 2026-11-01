const assert = require('node:assert/strict');
const { load, check, results } = require('./load-typescript.cjs');

function fixture({ used = 2, max = 3, existing = null, email = 'invited@example.com', conflicts = 0, clock = Date } = {}) {
  let attempts = 0;
  let memberWrites = 0;
  let inviteWrites = 0;
  const invitation = {
    id: 'invite', workspaceId: 'ws', email: 'invited@example.com', role: 'member',
    acceptedAt: null, expiresAt: new Date(Date.now() + 60000),
    workspace: { id: 'ws', slug: 'team', userId: 'owner' },
  };
  const tx = {
    promaneInvitation: {
      findUnique: async () => invitation,
      update: async () => { inviteWrites++; },
    },
    promaneMember: {
      findUnique: async () => existing,
      count: async ({ where }) => {
        assert.equal(where.workspaceId, 'ws');
        assert.equal(where.isActive, true);
        return used;
      },
      create: async ({ data }) => {
        assert.equal(data.workspaceId, 'ws');
        assert.equal(data.userId, 'invited');
        memberWrites++;
      },
    },
  };
  const prisma = {
    $transaction: async (callback, options) => {
      attempts++;
      assert.equal(options.isolationLevel, 'Serializable');
      if (attempts <= conflicts) throw { code: 'P2034' };
      return callback(tx);
    },
  };
  const helper = load('src/lib/promane/invite-admission.ts', {
    '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } } },
    crypto: require('node:crypto'),
    '@/lib/prisma': { prisma },
    '@/lib/promane/limits': {
      getUserPromaneLimits: async (userId, db) => {
        assert.equal(userId, 'owner', 'the workspace owner pays for team seats');
        assert.equal(db, tx);
        return { maxMembersPerWorkspace: max };
      },
    },
  }, { Date: clock });
  return {
    run: () => helper.acceptPromaneInvitation({ token: 'token', userId: 'invited', email, displayName: '招待先' }),
    state: () => ({ attempts, memberWrites, inviteWrites }),
    invitation,
  };
}

function issueFixture({ active = 1, pending = 1, max = 3, inviterActive = true, inviterRole = 'admin', actorId = 'admin', conflicts = 0, existingInvite = false, existingRole = 'member' } = {}) {
  let attempts = 0;
  let writes = 0;
  const tx = {
    promaneMember: {
      findUnique: async () => ({ role: inviterRole, isActive: inviterActive }),
      findFirst: async () => null,
      count: async ({ where }) => {
        assert.equal(where.isActive, true);
        return active;
      },
    },
    promaneWorkspace: { findUnique: async () => ({ name: 'Team', userId: 'owner' }) },
    promaneInvitation: {
      findFirst: async () => existingInvite ? { token: 'existing', role: existingRole, expiresAt: new Date(Date.now() + 60000) } : null,
      count: async ({ where }) => {
        assert.equal(where.acceptedAt, null);
        assert.ok(where.expiresAt.gt instanceof Date);
        return pending;
      },
      create: async ({ data }) => {
        assert.equal(data.workspaceId, 'ws');
        assert.equal(data.invitedById, actorId);
        writes++;
        return { token: data.token, expiresAt: data.expiresAt };
      },
    },
  };
  const prisma = {
    $transaction: async (callback, options) => {
      attempts++;
      assert.equal(options.isolationLevel, 'Serializable');
      if (attempts <= conflicts) throw { code: 'P2034' };
      return callback(tx);
    },
  };
  const helper = load('src/lib/promane/invite-admission.ts', {
    '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } } },
    crypto: require('node:crypto'),
    '@/lib/prisma': { prisma },
    '@/lib/promane/limits': {
      getUserPromaneLimits: async (userId, db) => {
        assert.equal(userId, 'owner');
        assert.equal(db, tx);
        return { maxMembersPerWorkspace: max };
      },
    },
  });
  return {
    run: () => helper.issuePromaneInvitation({ workspaceId: 'ws', userId: actorId, email: 'invited@example.com', role: 'member' }),
    state: () => ({ attempts, writes }),
  };
}

(async () => {
  for (const role of ['admin','member','guest']) { const f=fixture(); f.invitation.role=role; assert.equal((await f.run()).success,true); }
  for (const role of ['owner','__UNRECOGNIZED__','','constructor','admin ']) { const f=fixture(); f.invitation.role=role; const r=await f.run(); assert.equal(r.success,false); assert.equal(r.response.status,404); assert.equal(f.state().memberWrites,0); assert.equal(f.state().inviteWrites,0); }
  await check('full quota returns a clear API error without sending an email', async () => {
    let deliveries = 0;
    const route = load('src/app/api/promane/invite/route.ts', {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'admin' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': { prisma: {} },
      '@/lib/email': { sendEmail: async () => { deliveries++; } },
      '@/lib/promane/invite-admission': {
        issuePromaneInvitation: async () => ({
          success: false,
          response: { status: 403, code: 'PROMANE_MEMBER_LIMIT_REACHED', error: 'メンバー上限です' },
        }),
      },
    });
    const response = await route.POST(new Request('https://example.test/api/promane/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws', email: 'invited@example.com' }),
    }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'PROMANE_MEMBER_LIMIT_REACHED');
    assert.equal(deliveries, 0);
  });
  await check('new invitation reserves an owner seat before any email delivery', async () => {
    const f = issueFixture();
    const result = await f.run();
    assert.equal(result.success, true);
    assert.equal(result.reused, false);
    assert.deepEqual(f.state(), { attempts: 1, writes: 1 });
  });
  await check('full including pending invitations rejects before token creation', async () => {
    const f = issueFixture({ pending: 2 });
    const result = await f.run();
    assert.equal(result.response.code, 'PROMANE_MEMBER_LIMIT_REACHED');
    assert.equal(result.response.limitReached, true);
    assert.equal(result.response.canManageBilling, false);
    assert.deepEqual(f.state(), { attempts: 1, writes: 0 });
  });
  await check('workspace owner receives owner billing guidance at the seat cap', async () => {
    const f = issueFixture({ pending: 2, inviterRole: 'owner', actorId: 'owner' });
    const result = await f.run();
    assert.equal(result.response.canManageBilling, true);
    assert.match(result.response.error, /プランをご確認/);
  });
  await check('another owner-role member is directed to the paying workspace owner', async () => {
    const f = issueFixture({ pending: 2, inviterRole: 'owner', actorId: 'admin' });
    const result = await f.run();
    assert.equal(result.response.canManageBilling, false);
    assert.match(result.response.error, /契約者にご相談/);
  });
  await check('existing invitation is reused only while an active seat remains', async () => {
    const reusable = issueFixture({ existingInvite: true });
    assert.equal((await reusable.run()).reused, true);
    assert.equal(reusable.state().writes, 0);
    const full = issueFixture({ existingInvite: true, active: 3 });
    assert.equal((await full.run()).response.code, 'PROMANE_MEMBER_LIMIT_REACHED');
    assert.equal(full.state().writes, 0);
  });
  await check('a different role cannot silently reuse the old invitation', async () => {
    const f = issueFixture({ existingInvite: true, existingRole: 'guest' });
    assert.equal((await f.run()).response.code, 'PROMANE_INVITE_ROLE_CONFLICT');
    assert.equal(f.state().writes, 0);
  });
  await check('inactive inviter cannot create an invitation', async () => {
    const f = issueFixture({ inviterActive: false });
    assert.equal((await f.run()).response.status, 403);
    assert.equal(f.state().writes, 0);
  });
  await check('issuance retries serialization conflict before reservation', async () => {
    const f = issueFixture({ conflicts: 1 });
    assert.equal((await f.run()).success, true);
    assert.deepEqual(f.state(), { attempts: 2, writes: 1 });
  });
  await check('available owner seat accepts and consumes exactly one place', async () => {
    const f = fixture();
    assert.equal((await f.run()).success, true);
    assert.deepEqual(f.state(), { attempts: 1, memberWrites: 1, inviteWrites: 1 });
  });
  await check('full owner seat blocks before member and invitation writes', async () => {
    const f = fixture({ used: 3 });
    const result = await f.run();
    assert.equal(result.success, false);
    assert.equal(result.response.code, 'PROMANE_MEMBER_LIMIT_REACHED');
    assert.equal(result.response.canManageBilling, false);
    assert.match(result.response.error, /契約者にご相談/);
    assert.deepEqual(f.state(), { attempts: 1, memberWrites: 0, inviteWrites: 0 });
  });
  await check('inactive membership cannot be revived by an invitation', async () => {
    const f = fixture({ existing: { id: 'old', isActive: false } });
    const result = await f.run();
    assert.equal(result.response.status, 403);
    assert.deepEqual(f.state(), { attempts: 1, memberWrites: 0, inviteWrites: 0 });
  });
  await check('an existing active member can consume an invitation without another seat', async () => {
    const f = fixture({ used: 3, existing: { id: 'old', isActive: true } });
    const result = await f.run();
    assert.equal(result.success, true);
    assert.equal(result.alreadyMember, true);
    assert.deepEqual(f.state(), { attempts: 1, memberWrites: 0, inviteWrites: 1 });
  });
  await check('wrong account and expired invitation never write', async () => {
    const wrong = fixture({ email: 'other@example.com' });
    assert.equal((await wrong.run()).response.code, 'email_mismatch');
    assert.equal(wrong.state().memberWrites, 0);
    const expired = fixture();
    expired.invitation.expiresAt = new Date(Date.now() - 1000);
    assert.equal((await expired.run()).response.status, 410);
    assert.equal(expired.state().inviteWrites, 0);
  });
  await check('accepted and expiry codes match GET and admission at the exact deadline without writes', async () => {
    const now = Date.parse('2026-10-06T01:00:00.000Z');
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
    for (const accepted of [false, true]) {
      const f = fixture({ clock: Clock });
      f.invitation.expiresAt = new Date(now);
      if (accepted) f.invitation.acceptedAt = new Date(now - 1000);
      const result = await f.run();
      assert.equal(result.response.status, 410);
      assert.equal(result.response.code, accepted ? 'PROMANE_INVITE_ACCEPTED' : 'PROMANE_INVITE_EXPIRED');
      assert.equal(f.state().memberWrites, 0); assert.equal(f.state().inviteWrites, 0);
      let writes = 0;
      const route = load('src/app/api/promane/invite/[token]/route.ts', {
        'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => null }, '@/lib/auth': { authOptions: {} },
        '@/lib/prisma': { prisma: { promaneInvitation: { findUnique: async () => ({ ...f.invitation, workspace: { id: 'ws', name: 'Synthetic', slug: 'team' }, invitedBy: { name: null } }), update: async () => { writes++; } } } },
        '@/lib/promane/invite-admission': { acceptPromaneInvitation: async () => { throw Error('GET must not accept'); } },
      }, { Date: Clock });
      const response = await route.GET({}, { params: Promise.resolve({ token: 'synthetic' }) });
      assert.equal(response.status, 410); assert.equal((await response.json()).code, result.response.code); assert.equal(writes, 0);
    }
  });
  await check('serialization conflict retries before admitting', async () => {
    const f = fixture({ conflicts: 1 });
    assert.equal((await f.run()).success, true);
    assert.deepEqual(f.state(), { attempts: 2, memberWrites: 1, inviteWrites: 1 });
  });
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
