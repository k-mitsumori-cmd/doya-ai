const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const crypto = require('node:crypto');
const { Prisma } = require('@prisma/client');
const lifecycleState = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto });
const lifecycleStore = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': lifecycleState });
const privateApiResponse = load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } });

function fixture(service, { failAt, conflictOnce = false, onCreate = () => {} } = {}) {
  const state = { organizations: [], members: [], employees: [], rules: [], departments: [] };
  let transactions = 0, lifecycleLocks = 0, lifecycleFenceReads = 0;
  const settings = new Map();
  const prefix = service === 'hr' ? 'hr' : 'kintai';
  const tx = {
    $queryRaw: async (query) => {
      assert.match(query.sql, /^SELECT id FROM \"User\" WHERE id IN \(\?\) ORDER BY id FOR UPDATE$/);
      assert.deepEqual(query.values, ['user']);
      lifecycleLocks++;
      return [{ id: 'user' }];
    },
    systemSetting: { findUnique: async ({ where }) => {
      assert.equal(where.key, lifecycleState.lifecycleFenceKey('user'));
      lifecycleFenceReads++;
      return settings.get(where.key) ?? null;
    } },
    [`${prefix}OrganizationMember`]: { findFirst: async ({ where }) => state.members.find((m) => m.userId === where.userId && m.status === 'ACTIVE') || null },
    [`${prefix}Member`]: { findFirst: async ({ where }) => state.members.find((m) => m.userId === where.userId && m.status === 'ACTIVE') || null },
    [`${prefix}Organization`]: {
      findUnique: async ({ where }) => state.organizations.find((org) => org.slug === where.slug) || null,
      create: async ({ data }) => {
        if (failAt === 'organization') throw Error('organization failed');
        const org = { id: `org-${state.organizations.length + 1}`, ...data };
        state.organizations.push(org);
        onCreate();
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
    ...(service === 'hr' ? { 'next/headers': { headers: async () => new Headers() }, './organization-selection': load('src/lib/hr/organization-selection.ts') } : {}),
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    './types': { HrMemberRole: { OWNER: 'OWNER' }, ROLE_HIERARCHY: {} },
    './constants': { ROLE_HIERARCHY: {} },
    ...(service === 'hr' ? { '@/lib/account-lifecycle/store': lifecycleStore } : {}),
  });
  return {
    state, settings, prisma, access,
    get transactions() { return transactions; },
    get lifecycleLocks() { return lifecycleLocks; },
    get lifecycleFenceReads() { return lifecycleFenceReads; },
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
    if (service === 'hr') {
      assert.equal(normal.lifecycleLocks, 2);
      assert.equal(normal.lifecycleFenceReads, 1);
      const malformedFence = fixture('hr');
      malformedFence.settings.set(lifecycleState.lifecycleFenceKey('user'), { value: '{invalid-json' });
      await assert.rejects(malformedFence.create());
      assert.equal(malformedFence.state.organizations.length, 0);
      assert.equal(malformedFence.state.members.length, 0);
      assert.equal(malformedFence.lifecycleLocks, 1);
      assert.equal(malformedFence.lifecycleFenceReads, 1);
    }
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
    const routeFixture = fixture(service, { onCreate: () => { creations++; } });
    const membershipWrite = service === 'hr'
      ? load('src/lib/hr/membership-write.ts', { '@prisma/client': { Prisma }, '@/lib/prisma': { prisma: routeFixture.prisma }, '@/lib/account-lifecycle/store': lifecycleStore })
      : null;
    const route = load(`src/app/api/${service}/organization/route.ts`, {
      '@/lib/private-api-response': privateApiResponse,
      'next/server': { NextResponse: Response },
      '@prisma/client': { Prisma },
      'next-auth': { getServerSession: async () => ({ user: { id: 'user', email: 'owner@example.com' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': { prisma: routeFixture.prisma },
      [`@/lib/${service}/access`]: routeFixture.access,
      ...(service === 'hr' ? { '@/lib/hr/membership-write': membershipWrite, '@/lib/account-lifecycle/state': lifecycleState } : {}),
      '@/lib/hr/types': { HrMemberRole: {} },
      '@/lib/hr/organization-choices': load('src/lib/hr/organization-choices.ts', { 'node:crypto': require('node:crypto'), './types': { HrMemberRole: {} } }),
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
    if (service === 'hr') { assert.equal(routeFixture.lifecycleLocks, 1); assert.equal(routeFixture.lifecycleFenceReads, 1); }
  }
  console.log('PASS HR/Kintai onboarding: input validation, complete atomic setup, idempotency and retry');
})().catch((error) => { console.error(error); process.exitCode = 1; });
