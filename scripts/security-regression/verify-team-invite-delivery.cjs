const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(service, { deliverySuccess = true, role = 'owner', expiredInvite = false } = {}) {
  let creations = 0;
  let emails = 0;
  let staleRemoved = 0;
  const model = `${service}Member`;
  const orgModel = `${service}Organization`;
  const prisma = {
    [model]: {
      findFirst: async () => null,
      deleteMany: async ({ where }) => { if (expiredInvite && where.status === 'PENDING' && where.createdAt.lt instanceof Date) staleRemoved++; return { count: expiredInvite ? 1 : 0 }; },
      create: async () => { creations++; return { id: 'member' }; },
    },
    [orgModel]: { findUnique: async () => ({ name: 'Acme' }) },
  };
  const api = load(`src/app/api/${service}/members/route.ts`, {
    'next/server': { NextResponse: Response },
    crypto: { randomUUID: () => 'token' },
    '@/lib/prisma': { prisma },
    '@/lib/html-escape': { escapeHtml: (text) => text },
    [`@/lib/${service}/access`]: {
      [`get${service === 'sfa' ? 'Sfa' : service === 'aio' ? 'Aio' : 'Shodan'}Context`]: async () => role === 'anonymous' ? null : { organizationId: 'org', role },
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
  console.log('PASS SFA/AIO/Shodan team invites: malformed input rejected before send and delivery truth reported');
})().catch((error) => { console.error(error); process.exitCode = 1; });
