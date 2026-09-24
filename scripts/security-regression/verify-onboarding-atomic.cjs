const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(service, { failMember = false, conflictOnce = false, existingSlug = false } = {}) {
  const organizations = existingSlug ? [{ id: 'prior', name: 'Prior', slug: 'acme' }] : [];
  const members = [];
  const profiles = [];
  const prompts = [];
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
      create: async ({ data }) => {
        if (organizations.some((org) => org.slug === data.slug)) throw Object.assign(Error('slug collision'), { code: 'P2002' });
        const org = { id: `org-${organizations.length + 1}`, ...data };
        organizations.push(org);
        return org;
      },
    },
    aioBrandProfile: { create: async ({ data }) => { profiles.push(data); return data; } },
    aioPrompt: { createMany: async ({ data }) => { prompts.push(...data); return { count: data.length }; } },
  };
  const prisma = { $transaction: async (callback, options) => {
    transactions++;
    if (options) assert.equal(options.isolationLevel, 'Serializable');
    if (conflictOnce && transactions === 1) throw Object.assign(Error('serialization conflict'), { code: 'P2034' });
    const before = { organizations: structuredClone(organizations), members: structuredClone(members), profiles: structuredClone(profiles), prompts: structuredClone(prompts) };
    try { return await callback(tx); }
    catch (error) { organizations.splice(0, organizations.length, ...before.organizations); members.splice(0, members.length, ...before.members); profiles.splice(0, profiles.length, ...before.profiles); prompts.splice(0, prompts.length, ...before.prompts); throw error; }
  } };
  const deps = {
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    './types': { ROLE_HIERARCHY: {} },
  };
  const api = load(`src/lib/${service}/access.ts`, deps);
  return {
    organizations, members, profiles, prompts,
    get transactions() { return transactions; },
    create: () => api.getOrCreateOrganization('user', 'Acme', 'Owner'),
    quickStart: service === 'aio' ? (initialize) => api.createAioOrganization('user', 'Acme', 'Owner', initialize) : null,
  };
}

(async () => {
  for (const service of ['shodan', 'aio']) {
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

    let calls = 0;
    const route = load(`src/app/api/${service}/organization/route.ts`, {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': { prisma: {} },
      [`@/lib/${service}/access`]: { getOrCreateOrganization: async () => { calls++; return { id: 'org', name: 'Acme', slug: 'acme' }; } },
    });
    for (const body of [null, [], {}, { name: 42, memberName: 'Owner' }, { name: 'Acme', memberName: {} }]) {
      assert.equal((await route.POST({ json: async () => body })).status, 400);
      assert.equal(calls, 0);
    }
    assert.equal((await route.POST({ json: async () => ({ name: ' Acme ', memberName: ' Owner ' }) })).status, 200);
    assert.equal(calls, 1);
  }

  const failedQuickStart = fixture('aio', { failMember: true });
  await assert.rejects(failedQuickStart.quickStart(), /member creation failed/);
  assert.equal(failedQuickStart.organizations.length, 0);
  const failedSetup = fixture('aio');
  await assert.rejects(failedSetup.quickStart(async (tx, org) => {
    await tx.aioBrandProfile.create({ data: { organizationId: org.id, brandUrl: 'https://example.com' } });
    throw Error('prompt setup failed');
  }), /prompt setup failed/);
  assert.equal(failedSetup.organizations.length, 0);
  assert.equal(failedSetup.members.length, 0);
  assert.equal(failedSetup.profiles.length, 0);
  const collidedQuickStart = fixture('aio', { existingSlug: true });
  const created = await collidedQuickStart.quickStart();
  assert.notEqual(created.slug, 'acme');
  assert.equal(collidedQuickStart.organizations.length, 2);
  assert.equal(collidedQuickStart.members.length, 1);

  const sequence = [];
  const saved = { profiles: [], prompts: [] };
  const quickStartRoute = load('src/app/api/aio/quick-start/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'user', name: 'Owner' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { aioMember: { findMany: async () => [] } } },
    '@/lib/aio/access': { createAioOrganization: async (_user, _brand, _member, initialize) => {
      sequence.push('create');
      const org = { id: 'org', slug: 'acme' };
      await initialize({
        aioBrandProfile: { create: async ({ data }) => { saved.profiles.push(data); } },
        aioPrompt: { createMany: async ({ data }) => { saved.prompts.push(...data); } },
      }, org);
      return org;
    } },
    '@/lib/aio/suggest': {
      normalizeUrl: (value) => typeof value === 'string' && value.startsWith('https://') ? value : null,
      deriveBrandFromUrl: async () => { sequence.push('derive'); return { brandName: 'Acme' }; },
      suggestBrandSetup: async () => { sequence.push('suggest'); return { category: 'SaaS', aliases: [], competitors: [], prompts: ['比較したい'] }; },
    },
  });
  for (const body of [null, [], {}, { url: {} }]) {
    assert.equal((await quickStartRoute.POST({ json: async () => body })).status, 400);
    assert.equal(sequence.length, 0);
  }
  assert.equal((await quickStartRoute.POST({ json: async () => ({ url: 'https://example.com' }) })).status, 200);
  assert.deepEqual(sequence, ['derive', 'suggest', 'create']);
  assert.equal(saved.profiles[0].brandUrl, 'https://example.com');
  assert.equal(saved.prompts.length, 1);
  console.log('PASS Shodan/AIO onboarding: validation, atomic owner creation, idempotency and slug retry');
})().catch((error) => { console.error(error); process.exitCode = 1; });
