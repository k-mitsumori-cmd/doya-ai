const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const escapeHtml = load('src/lib/html-escape.ts');

(async () => {
  let sent = 0;
  let warning = '';
  const unsent = load('src/lib/hr/email.ts', {
    '@/lib/email': { sendEmail: async () => { sent++; return { success: true }; } },
    '@/lib/html-escape': escapeHtml,
  }, { process: { env: {} }, console: { warn: (message) => { warning += message; }, error() {} } });
  const email = { to: 'test@example.com', organizationName: '<b>Org</b>', inviterName: '<img src=x>', role: 'MEMBER', inviteUrl: 'https://example.com/hr/invite/secret-token', expiresAt: new Date() };
  assert.equal(await unsent.sendInvitationEmail(email), false);
  assert.equal(sent, 0);
  assert.equal(warning.includes('secret-token'), false);

  let html = '';
  const failed = load('src/lib/hr/email.ts', {
    '@/lib/email': { sendEmail: async ({ html: body }) => { html = body; return { success: false, error: 'private provider detail' }; } },
    '@/lib/html-escape': escapeHtml,
  }, { process: { env: { RESEND_API_KEY: 'mock-key' } }, console: { warn() {}, error: (...parts) => { assert.equal(parts.join(' ').includes('private provider detail'), false); } } });
  assert.equal(await failed.sendInvitationEmail(email), false);
  assert.equal(html.includes('<img src=x>'), false);
  assert.equal(html.includes('&lt;img src=x&gt;'), true);
  assert.equal(html.includes('<b>Org</b>'), false);

  const invitations = [];
  let previous = Promise.resolve();
  let deliveries = 0;
  const prisma = {
    $transaction: async (work) => {
      let release;
      const before = previous;
      previous = new Promise((resolve) => { release = resolve; });
      const tx = {
        $queryRaw: async () => { await before; return [{ id: 'org' }]; },
        hrOrganizationMember: { findFirst: async () => null },
        hrInvitation: {
          findFirst: async ({ where }) => invitations.find((row) => row.email === where.email && row.expiresAt > new Date()) || null,
          create: async ({ data }) => { const row = { ...data, id: `inv-${invitations.length + 1}` }; invitations.push(row); return row; },
        },
        hrOrganization: { findUnique: async () => ({ name: 'Org' }) },
      };
      try { return await work(tx); } finally { release(); }
    },
  };
  const { POST } = load('src/app/api/hr/organization/invite/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    'next-auth': { getServerSession: async () => ({ user: { id: 'admin', name: 'Admin' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org', userId: 'admin', role: 'ADMIN' }), hasMinRole: () => true },
    '@/lib/hr/types': { HrMemberRole: { MEMBER: 'MEMBER', ADMIN: 'ADMIN', OWNER: 'OWNER' } },
    '@/lib/hr/billing': { checkMemberLimit: async () => null },
    '@/lib/hr/email': { sendInvitationEmail: async () => { deliveries++; return false; } },
    '@/lib/hr/audit': { logAudit: async () => {} },
    crypto: require('node:crypto'),
  });
  const request = () => POST({ json: async () => ({ email: 'test@example.com' }) });
  const responses = await Promise.all([request(), request()]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
  assert.equal(invitations.length, 1);
  assert.equal(deliveries, 1);
  assert.equal((await responses.find((response) => response.status === 200).json()).emailSent, false);
  console.log('PASS HR invite issuance: concurrent duplicate guard, truthful delivery, escaped HTML, no token logs');
})().catch((error) => { console.error(error); process.exitCode = 1; });
