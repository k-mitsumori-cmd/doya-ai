const { shodanLifecycleFixture } = require('./shodan-lifecycle-fixture.cjs');
const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(service, { deliverySuccess = true, role = 'owner', currentRole = role, expiredInvite = false, lifecycleAuthorityRows, lifecycleUsers, lifecycleSettings } = {}) {
  let creations = 0;
  let emails = 0;
  let staleRemoved = 0;
  const model = `${service}Member`;
  const orgModel = `${service}Organization`;
  const prisma = {
    [model]: {
      findFirst: async () => null,
      deleteMany: async ({ where }) => { if (expiredInvite && where.status === 'PENDING' && where.createdAt.lte instanceof Date) staleRemoved++; return { count: expiredInvite ? 1 : 0 }; },
      create: async ({ data }) => { creations++; return { id: 'member', ...data }; },
    },
    [orgModel]: { findUnique: async () => ({ name: 'Acme' }) },
    $queryRaw: async sql => ['aio', 'shodan', 'sfa'].includes(service) && sql.join('?').includes(`FROM ${service}_members`)
      ? ['owner', 'admin'].includes(currentRole) ? [{ role: currentRole }] : []
      : [{ id: 'org' }],
    $transaction: async (fn) => fn(prisma),
  };
  if (lifecycleSettings) prisma.systemSetting = lifecycleSettings;
  // These actor/delivery tests omitted normal DB owner/User rows; seed them explicitly, with abnormal overrides preserved.
  const lifecycle = ['shodan', 'aio'].includes(service) ? shodanLifecycleFixture(prisma, { service, mode: 'issue', role: () => currentRole, userIds: lifecycleUsers || ['user', 'owner-user'], authorityRows: lifecycleAuthorityRows || (() => currentRole === 'owner' ? [] : [{ id: 'canonical-owner', userId: 'owner-user', role: 'owner', status: 'ACTIVE', pendingEmail: null, inviteToken: null }]) }) : {};
  const api = load(`src/app/api/${service}/members/route.ts`, {
    ...lifecycle,
    'next/server': { NextResponse: Response },
    crypto: { randomUUID: () => 'token' },
    '@/lib/prisma': { prisma },
    '@/lib/html-escape': { escapeHtml: (text) => text },
    [`@/lib/${service}/access`]: {
      [`get${service === 'sfa' ? 'Sfa' : service === 'aio' ? 'Aio' : 'Shodan'}Context`]: async () => role === 'anonymous' ? null : { organizationId: 'org', role, userId: 'user', memberId: 'actor' },
      hasMinRole: (actual) => actual === 'owner' || actual === 'admin',
      orgSlugFrom: () => 'acme',
    },
    [`@/lib/${service}/types`]: { ROLE_HIERARCHY: { member: 0, manager: 1, admin: 2, owner: 3 } },
    '@/lib/email': { sendEmail: async () => { emails++; return { success: deliverySuccess }; } },
    '@/lib/sfa/limits': { withSfaAdmission: async (_org, _requested, create) => ({ created: await create(prisma) }), sfaQuotaResponse: () => Response.json({}, { status: 402 }) },
  });
  return { post: (body) => api.POST({ json: async () => body }), get creations() { return creations; }, get emails() { return emails; }, get staleRemoved() { return staleRemoved; } };
}

(async () => {
  for (const service of ['sfa', 'aio', 'shodan']) {
    const invalid = fixture(service);
    for (const body of [null, [], {}, { email: {} }, { email: 'bad' }, { email: 'valid@example.com', role: {} }, { email: 'valid@example.com', role: 'owner' }]) {
      assert.equal((await invalid.post(body)).status, 400, `${service}: ${JSON.stringify(body)}`);
      assert.equal(invalid.creations, 0);
      assert.equal(invalid.emails, 0);
    }
    const sent = fixture(service);
    const sentResponse = await sent.post({ email: ' Valid@Example.com ', role: 'member' });
    assert.equal(sentResponse.status, 200);
    const sentBody = await sentResponse.json();
    assert.equal(sentBody.emailSent, true);
    assert.equal(sentBody.inviteUrl, undefined);
    assert.equal(sentBody.member.inviteEmail, 'valid@example.com');
    assert.equal(sent.emails, 1);

    const unsent = fixture(service, { deliverySuccess: false });
    const unsentResponse = await unsent.post({ email: 'valid@example.com' });
    assert.equal(unsentResponse.status, 200);
    const unsentBody = await unsentResponse.json();
    assert.equal(unsentBody.emailSent, false);
    assert.ok(unsentBody.inviteUrl.includes(`/${service}/invite/token`));
    assert.equal(unsent.creations, 1);
    assert.equal(unsent.emails, 1);
    assert.equal((await fixture(service, { role: 'member' }).post({ email: 'valid@example.com' })).status, 403);
    assert.equal((await fixture(service, { role: 'anonymous' }).post({ email: 'valid@example.com' })).status, 401);
  }
  const expired = fixture('sfa', { expiredInvite: true, deliverySuccess: false });
  assert.equal((await expired.post({ email: 'valid@example.com' })).status, 200);
  assert.equal(expired.staleRemoved, 1, 'expired pending invite is replaced before re-inviting');
  for (const service of ['aio', 'shodan', 'sfa']) {
    for (const options of [{ role: 'owner', currentRole: 'member', inviteRole: 'member' }, { role: 'owner', currentRole: 'admin', inviteRole: 'admin' }]) {
      const stale = fixture(service, options);
      assert.equal((await stale.post({ email: 'valid@example.com', role: options.inviteRole })).status, 403);
      assert.equal(stale.creations, 0);
      assert.equal(stale.emails, 0);
    }
  }
  const authority = (id, userId, role = 'owner') => ({ id, userId, role, status: 'ACTIVE', pendingEmail: null, inviteToken: null });
  for (const [name, rows, users] of [
    ['missing owner', [], ['user']],
    ['unknown authority', [authority('bad', 'owner-user', 'toString')], ['user', 'owner-user']],
    ['multiple owners', [authority('one', 'owner-user'), authority('two', 'other-owner')], ['user', 'owner-user', 'other-owner']],
    ['ACTIVE null authority', [authority('bad', null)], ['user']],
    ['missing authority User', [authority('bad', 'missing-user')], ['user']],
  ]) {
    const bad = fixture('shodan', { role: 'admin', lifecycleAuthorityRows: () => rows, lifecycleUsers: users });
    assert.equal((await bad.post({ email: 'valid@example.com' })).status, 409, name);
    assert.equal(bad.creations, 0, name);
    assert.equal(bad.emails, 0, name);
  }
  const corrupt = fixture('shodan', { role: 'admin', lifecycleSettings: { findUnique: async () => ({ value: 'malformed' }) } });
  const corruptResponse = await corrupt.post({ email: 'valid@example.com' });
  assert.equal(corruptResponse.status, 409);
  assert.equal((await corruptResponse.json()).code, 'LIFECYCLE_STATE_UNAVAILABLE');
  assert.equal(corrupt.creations, 0);
  assert.equal(corrupt.emails, 0);
  console.log('PASS SFA/AIO/Shodan team invites: malformed input rejected before send and delivery truth reported');
})().catch((error) => { console.error(error); process.exitCode = 1; });
