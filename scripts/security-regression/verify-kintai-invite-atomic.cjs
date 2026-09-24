const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture({ email = 'invited@example.com', employee = true, existing = false, failClaim = false, conflictOnce = false } = {}) {
  let rows = [
    { id: 'invite', organizationId: 'org', userId: 'pending', status: 'PENDING', inviteToken: 'token', inviteEmail: 'invited@example.com', createdAt: new Date(), employee: employee ? { email: 'invited@example.com' } : null, organization: { name: 'Acme' } },
    { id: 'old', organizationId: 'other', userId: 'user', status: 'ACTIVE' },
  ];
  if (existing) rows.push({ id: 'existing', organizationId: 'org', userId: 'user', status: 'ACTIVE', employee: { email } });
  let transactions = 0;
  let deletions = 0;
  const tx = { kintaiMember: {
    findFirst: async ({ where }) => rows.find((row) =>
      (where.inviteToken === undefined || row.inviteToken === where.inviteToken) &&
      (where.status === undefined || row.status === where.status) &&
      (where.organizationId === undefined || row.organizationId === where.organizationId) &&
      (where.userId === undefined || row.userId === where.userId) &&
      (where.id?.not === undefined || row.id !== where.id.not)) || null,
    updateMany: async ({ where, data }) => {
      if (failClaim && where.id === 'invite') throw Error('claim failed');
      const matches = rows.filter((row) =>
        (typeof where.id !== 'string' || row.id === where.id) &&
        (where.id?.not === undefined || row.id !== where.id.not) &&
        (where.userId === undefined || row.userId === where.userId) &&
        (where.status === undefined || row.status === where.status) &&
        (where.inviteToken === undefined || row.inviteToken === where.inviteToken));
      for (const row of matches) Object.assign(row, data);
      return { count: matches.length };
    },
    delete: async () => { deletions++; },
  } };
  const prisma = {
    user: { findUnique: async () => ({ id: 'user' }) },
    $transaction: async (callback, options) => {
      transactions++;
      assert.equal(options.isolationLevel, 'Serializable');
      if (conflictOnce && transactions === 1) throw Object.assign(Error('conflict'), { code: 'P2034' });
      const snapshot = structuredClone(rows);
      try { return await callback(tx); }
      catch (error) { rows = snapshot; throw error; }
    },
  };
  const route = load('src/app/api/kintai/invite/[token]/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'user', email } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
  });
  return { post: () => route.POST({}, { params: Promise.resolve({ token: 'token' }) }), get rows() { return rows; }, get transactions() { return transactions; }, get deletions() { return deletions; } };
}

(async () => {
  const normal = fixture();
  assert.equal((await normal.post()).status, 200);
  assert.equal(normal.rows.find((row) => row.id === 'old').status, 'INACTIVE');
  assert.equal(normal.rows.find((row) => row.id === 'invite').status, 'ACTIVE');
  assert.equal((await normal.post()).status, 404);

  for (const [options, status] of [[{ email: 'other@example.com' }, 403], [{ employee: false }, 409], [{ existing: true }, 409]]) {
    const f = fixture(options);
    assert.equal((await f.post()).status, status);
    assert.equal(f.rows.find((row) => row.id === 'old').status, 'ACTIVE');
    assert.equal(f.rows.find((row) => row.id === 'invite').status, 'PENDING');
    assert.equal(f.deletions, 0);
  }

  const failed = fixture({ failClaim: true });
  assert.equal((await failed.post()).status, 500);
  assert.equal(failed.rows.find((row) => row.id === 'old').status, 'ACTIVE');
  assert.equal(failed.rows.find((row) => row.id === 'invite').status, 'PENDING');

  const retry = fixture({ conflictOnce: true });
  assert.equal((await retry.post()).status, 200);
  assert.equal(retry.transactions, 2);
  console.log('PASS Kintai invite: email match, no destructive merge, atomic transfer, retry and replay rejection');
})().catch((error) => { console.error(error); process.exitCode = 1; });
