const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(service, { failMember = false, conflictOnce = false } = {}) {
  const organizations = [];
  const members = [];
  let transactions = 0;
  const orgModel = `${service}Organization`;
  const memberModel = `${service}Member`;
  const tx = {
    [memberModel]: {
      findFirst: async ({ where }) => {
        const member = members.find((item) => item.userId === where.userId && item.status === 'ACTIVE');
        return member ? { ...member, organization: organizations.find((org) => org.id === member.organizationId) } : null;
      },
      create: async ({ data }) => { if (failMember) throw Error('member creation failed'); members.push(data); return data; },
    },
    [orgModel]: {
      findUnique: async ({ where }) => organizations.find((org) => org.slug === where.slug) || null,
      create: async ({ data }) => { const org = { id: `org-${organizations.length + 1}`, ...data }; organizations.push(org); return org; },
    },
  };
  const prisma = { $transaction: async (callback, options) => {
    transactions++;
    assert.equal(options.isolationLevel, 'Serializable');
    if (conflictOnce && transactions === 1) throw Object.assign(Error('conflict'), { code: 'P2034' });
    const before = { organizations: structuredClone(organizations), members: structuredClone(members) };
    try { return await callback(tx); }
    catch (error) { organizations.splice(0, organizations.length, ...before.organizations); members.splice(0, members.length, ...before.members); throw error; }
  } };
  const api = load(`src/lib/${service}/access.ts`, {
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    './types': { ROLE_HIERARCHY: {}, hasMinRole: () => false },
  });
  return { organizations, members, get transactions() { return transactions; }, create: () => api.getOrCreateOrganization('user', 'Acme', 'Owner') };
}

(async () => {
  for (const service of ['quote', 'mensetsu', 'aishodan']) {
    const failed = fixture(service, { failMember: true });
    await assert.rejects(failed.create(), /member creation failed/);
    assert.equal(failed.organizations.length, 0, service);
    assert.equal(failed.members.length, 0, service);

    const normal = fixture(service);
    const first = await normal.create();
    assert.equal((await normal.create()).id, first.id);
    assert.equal(normal.organizations.length, 1);
    assert.equal(normal.members.length, 1);

    const retry = fixture(service, { conflictOnce: true });
    await retry.create();
    assert.equal(retry.transactions, 2);
    assert.equal(retry.organizations.length, 1);

    let creations = 0;
    const route = load(`src/app/api/${service}/organizations/route.ts`, {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: {} },
      [`@/lib/${service}/access`]: {
        resolveUserId: async () => 'user',
        getOrCreateOrganization: async () => { creations++; return { id: 'org', name: 'Acme', slug: 'acme' }; },
      },
    });
    for (const body of [null, [], {}, { name: {} }, { name: 'Acme', memberName: {} }]) {
      assert.equal((await route.POST({ json: async () => body })).status, 400, `${service}: ${JSON.stringify(body)}`);
      assert.equal(creations, 0);
    }
    assert.equal((await route.POST({ json: async () => ({ name: ' Acme ', memberName: ' Owner ' }) })).status, 200);
    assert.equal(creations, 1);
  }
  console.log('PASS Quote/Mensetsu/Aishodan onboarding: validation, atomic owner creation, idempotency and retry');
})().catch((error) => { console.error(error); process.exitCode = 1; });
