const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const limit = { resource: 'accounts', used: 50, limit: 50, upgradeAvailable: true };
let attempted = 0;
let emailed = 0;
const quota = {
  withSfaAdmission: async () => ({ limit }),
  sfaQuotaResponse: (value) => Response.json({ code: 'SFA_LIMIT_REACHED', resource: value.resource }, { status: 402 }),
};
const shared = {
  'next/server': { NextResponse: Response },
  '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org', memberId: 'member', userId: 'actor', role: 'owner' }), orgSlugFrom: () => 'org', hasMinRole: () => true },
  '@/lib/sfa/format': { bigIntToNumber: (value) => value },
  '@/lib/sfa/limits': quota,
};
const request = (body) => ({ url: 'http://local/api/sfa', headers: { get: () => null }, json: async () => body });

(async () => {
  const account = load('src/app/api/sfa/accounts/route.ts', {
    ...shared,
    '@/lib/prisma': { prisma: { sfaAccount: { create: async () => { attempted++; } } } },
  }).POST;
  assert.equal((await account(request({ name: '会社' }))).status, 402);

  const deal = load('src/app/api/sfa/deals/route.ts', {
    ...shared,
    '@/lib/prisma': { prisma: { sfaStage: { findFirst: async () => null }, sfaDeal: { create: async () => { attempted++; } } } },
    '@/lib/sfa/amount': { parseSfaAmount: () => 0n },
    '@/lib/service-usage': { recordServiceUsage: async () => { attempted++; } },
  }).POST;
  assert.equal((await deal(request({ name: '商談' }))).status, 402);

  const convert = load('src/app/api/sfa/leads/[id]/convert/route.ts', {
    ...shared,
    '@/lib/prisma': { prisma: {
      sfaLead: { findUnique: async () => ({ id: 'lead', organizationId: 'org', isActive: true, status: 'new', convertedAccountId: null }) },
      sfaPipeline: { findFirst: async () => null },
      sfaAccount: { create: async () => { attempted++; } },
    } },
    '@/lib/sfa/amount': { parseSfaAmount: () => 0n },
  }).POST;
  assert.equal((await convert(request({}), { params: Promise.resolve({ id: 'lead' }) })).status, 402);

  const members = load('src/app/api/sfa/members/route.ts', {
    ...shared,
    crypto: require('node:crypto'),
    '@/lib/prisma': { prisma: { sfaOrganization: { findUnique: async () => ({ name: '組織' }) }, sfaMember: { findFirst: async () => null } } },
    '@/lib/html-escape': { escapeHtml: (value) => value },
    '@/lib/sfa/types': { ROLE_HIERARCHY: { owner: 3, admin: 2, manager: 1, member: 0 } },
    '@/lib/email': { sendEmail: async () => { emailed++; return { success: true }; } },
  }).POST;
  assert.equal((await members(request({ email: 'member@example.com', role: 'member' }))).status, 402);
  assert.equal(emailed, 0, 'a blocked invitation must not send email');

  const invite = load('src/app/api/sfa/invite/[token]/route.ts', {
    ...shared,
    'next-auth': { getServerSession: async () => ({ user: { id: 'invitee', email: 'member@example.com' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { sfaMember: {
      findUnique: async () => ({ id: 'invite', organizationId: 'org', organization: { slug: 'org' }, status: 'PENDING', createdAt: new Date(), inviteEmail: 'member@example.com' }),
      findFirst: async () => null,
      updateMany: async () => { attempted++; return { count: 1 }; },
    } } },
  }).POST;
  assert.equal((await invite(request({}), { params: Promise.resolve({ token: 'token' }) })).status, 402);
  assert.equal(attempted, 0, 'blocked quota must stop every database write and usage event');
  console.log('PASS SFA admission routes: every creation path blocks at quota without writes or email');
})().catch((error) => { console.error(error); process.exitCode = 1; });
