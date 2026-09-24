const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let writes = 0;
const findUnique = async ({ where }) => where.id === 'missing' ? null : ({
  organizationId: where.id === 'foreign' ? 'org-2' : 'org-1',
  isActive: where.id !== 'inactive',
});
const prisma = {
  sfaAccount: { findUnique }, sfaDeal: { findUnique }, sfaContact: { findUnique },
  $transaction: async (callback) => callback({
    sfaActivity: { create: async ({ data }) => { writes++; return { id: 'activity-1', ...data }; } },
    sfaDeal: { updateMany: async () => ({ count: 1 }) },
  }),
};
const { POST } = load('src/app/api/sfa/activities/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org-1', memberId: 'member-1' }), orgSlugFrom: () => null },
});
const request = (body) => ({ json: async () => ({ subject: '確認', ...body }) });

(async () => {
  for (const field of ['accountId', 'dealId', 'contactId']) {
    for (const value of ['foreign', 'inactive', 'missing', 123]) {
      const response = await POST(request({ [field]: value }));
      assert.equal(response.status, 400, `${field}=${value} must not be silently removed`);
    }
  }
  assert.equal((await POST(request({ subject: 123 }))).status, 400);
  assert.equal((await POST({ json: async () => null })).status, 400);
  assert.equal(writes, 0);
  const response = await POST(request({ accountId: 'own', dealId: 'own', contactId: 'own' }));
  assert.equal(response.status, 200);
  const { activity } = await response.json();
  assert.equal(activity.accountId, 'own');
  assert.equal(activity.dealId, 'own');
  assert.equal(activity.contactId, 'own');
  assert.equal(writes, 1);
  console.log('PASS SFA activity relations: foreign, inactive and malformed IDs rejected without writes');
})().catch((error) => { console.error(error); process.exitCode = 1; });
