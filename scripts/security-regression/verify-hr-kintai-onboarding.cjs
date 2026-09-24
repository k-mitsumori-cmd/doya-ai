const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(service, { failAt, conflictOnce = false } = {}) {
  const state = { organizations: [], members: [], employees: [], rules: [], departments: [] };
  let transactions = 0;
  const prefix = service === 'hr' ? 'hr' : 'kintai';
  const tx = {
    [`${prefix}OrganizationMember`]: { findFirst: async ({ where }) => state.members.find((m) => m.userId === where.userId && m.status === 'ACTIVE') || null },
    [`${prefix}Member`]: { findFirst: async ({ where }) => state.members.find((m) => m.userId === where.userId && m.status === 'ACTIVE') || null },
    [`${prefix}Organization`]: {
      findUnique: async ({ where }) => state.organizations.find((org) => org.slug === where.slug) || null,
      create: async ({ data }) => {
        if (failAt === 'organization') throw Error('organization failed');
        const org = { id: `org-${state.organizations.length + 1}`, ...data };
        state.organizations.push(org);
        if (data.members) {
          if (failAt === 'member') throw Error('member failed');
          state.members.push({ ...data.members.create, organizationId: org.id, organization: org });
        }
        return org;
      },
    },
    kintaiMember: {
      findFirst: async ({ where }) => state.members.find((m) => m.userId === where.userId && m.status === 'ACTIVE') || null,
      create: async ({ data }) => {
        if (failAt === 'member') throw Error('member failed');
        const member = { id: 'member', ...data, organization: state.organizations.find((org) => org.id === data.organizationId) };
        state.members.push(member);
        return member;
      },
    },
    kintaiEmployee: { create: async ({ data }) => { if (failAt === 'employee') throw Error('employee failed'); state.employees.push(data); } },
    kintaiWorkRule: { create: async ({ data }) => { if (failAt === 'rule') throw Error('rule failed'); state.rules.push(data); } },
    kintaiDepartment: { create: async ({ data }) => { if (failAt === 'department') throw Error('department failed'); state.departments.push(data); } },
  };
  const prisma = { $transaction: async (callback, options) => {
    transactions++;
    assert.equal(options.isolationLevel, 'Serializable');
    if (conflictOnce && transactions === 1) throw Object.assign(Error('serialization conflict'), { code: 'P2034' });
    const snapshot = structuredClone(state);
    try { return await callback(tx); }
    catch (error) { Object.assign(state, snapshot); throw error; }
  } };
  const access = load(`src/lib/${service}/access.ts`, {
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    './types': { HrMemberRole: { OWNER: 'OWNER' }, ROLE_HIERARCHY: {} },
    './constants': { ROLE_HIERARCHY: {} },
  });
  return {
    state,
    get transactions() { return transactions; },
    create: () => service === 'hr'
      ? access.getOrCreateOrganization('user', 'Acme', { industry: 'IT', size: '1-10' })
      : access.getOrCreateOrganization('user', 'Acme', 'Owner', 'owner@example.com'),
  };
}

(async () => {
  for (const service of ['hr', 'kintai']) {
    for (const failAt of service === 'hr' ? ['organization', 'member'] : ['organization', 'member', 'employee', 'rule', 'department']) {
      const failed = fixture(service, { failAt });
      await assert.rejects(failed.create(), new RegExp(`${failAt} failed`));
      assert.deepEqual(Object.values(failed.state).map((rows) => rows.length), [0, 0, 0, 0, 0], `${service}: ${failAt}`);
    }
    const normal = fixture(service);
    const first = await normal.create();
    assert.equal((await normal.create()).id, first.id);
    assert.equal(normal.state.organizations.length, 1);
    assert.equal(normal.state.members.length, 1);
    if (service === 'kintai') {
      assert.equal(normal.state.employees.length, 1);
      assert.equal(normal.state.rules.length, 1);
      assert.equal(normal.state.departments.length, 4);
    }
    const retry = fixture(service, { conflictOnce: true });
    await retry.create();
    assert.equal(retry.transactions, 2);
    assert.equal(retry.state.organizations.length, 1);

    let creations = 0;
    const route = load(`src/app/api/${service}/organization/route.ts`, {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'user', email: 'owner@example.com' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': { prisma: {} },
      [`@/lib/${service}/access`]: {
        getOrCreateOrganization: async () => { creations++; return { id: 'org', name: 'Acme', slug: 'acme' }; },
      },
      '@/lib/hr/types': { HrMemberRole: {} },
    });
    const badBodies = service === 'hr'
      ? [null, [], {}, { name: {} }, { name: 'Acme', slug: {} }, { name: 'Acme', slug: '../bad' }, { name: 'Acme', industry: {} }]
      : [null, [], {}, { name: {} }, { name: 'Acme', employeeName: {} }, { name: ' ', employeeName: 'Owner' }];
    for (const body of badBodies) {
      assert.equal((await route.POST({ json: async () => body })).status, 400, `${service}: ${JSON.stringify(body)}`);
      assert.equal(creations, 0);
    }
    const valid = service === 'hr' ? { name: ' Acme ', industry: ' IT ' } : { name: ' Acme ', employeeName: ' Owner ' };
    assert.equal((await route.POST({ json: async () => valid })).status, 200);
    assert.equal(creations, 1);
  }
  console.log('PASS HR/Kintai onboarding: input validation, complete atomic setup, idempotency and retry');
})().catch((error) => { console.error(error); process.exitCode = 1; });
