const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const routes = [
  'audit-logs', 'billing/checkout', 'billing/portal', 'departments/[id]',
  'departments', 'one-on-one/[id]/ai-summary', 'organization/invite/[token]',
  'organization/invite/accept', 'organization/invite', 'organization/members/[id]',
  'organization/members', 'organization', 'organization/transfer-owner', 'settings', 'upload',
];
let checks = 0;
function privateResponse(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('vary'), /(?:^|,\s*)Cookie(?:,|$)/i);
  assert.match(response.headers.get('content-type'), /application\/json/);
  checks++;
}
function route(name, { fail = false, context = null, invitation = null, members = [] } = {}) {
  const file = `src/app/api/hr/${name}/route.ts`;
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let unexpectedCalls = 0;
  function forbidden() { unexpectedCalls++; throw Error('Unexpected database/provider/write'); }
  const mocks = {};
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const module = statement.moduleSpecifier.text;
    if (module === '@/lib/private-api-response') continue; // Load the real response helper.
    if (module === '@/lib/direct-upload/flag') { mocks[module] = { directUploadRollout: () => false, isDirectConfirm: () => false }; continue; } // 旗 off（これまでの経路）
    const names = statement.importClause?.namedBindings;
    mocks[module] = {};
    if (names && ts.isNamedImports(names)) for (const element of names.elements) {
      if (!element.isTypeOnly) mocks[module][(element.propertyName || element.name).text] = forbidden;
    }
  }
  const authentication = async () => { if (fail) throw Error('Synthetic authentication outage'); return null; };
  mocks['next/server'] = { NextRequest: Request, NextResponse: Response };
  mocks['next-auth'] = { getServerSession: authentication };
  mocks['@/lib/auth'] = { authOptions: {} };
  mocks['@/lib/hr/access'] = { ...mocks['@/lib/hr/access'], getHrContext: async () => {
    if (fail) throw Error('Synthetic context outage'); return context;
  }, hasMinRole: () => true };
  mocks['@/lib/stripe'] = { ...mocks['@/lib/stripe'], STRIPE_PRICE_IDS: { hr: { starter: {}, pro: {}, enterprise: {} } } };
  mocks['@/lib/hr/types'] = { HrMemberRole: { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER' } };
  mocks['@/lib/prisma'] = { prisma: new Proxy({}, { get(_target, key) {
    if (key === 'hrInvitation') return { findUnique: async () => {
      if (fail) throw Error('Synthetic database outage'); return invitation;
    }, updateMany: forbidden };
    if (key === 'hrOrganizationMember') return { findMany: async () => members };
    return new Proxy(forbidden, { get: () => forbidden });
  } }) };
  return { handlers: load(file, mocks), noEffects: () => assert.equal(unexpectedCalls, 0, name) };
}
function request(method) {
  return new Request('http://localhost/api/hr/audit-test', { method,
    ...(['POST', 'PATCH', 'DELETE'].includes(method) ? { body: '{}' } : {}) });
}
(async () => {
  for (const name of routes) for (const fail of [false, true]) {
    const instance = route(name, { fail });
    for (const [method, handler] of Object.entries(instance.handlers)) {
      if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) continue;
      const response = await handler(request(method), { params: Promise.resolve({ id: 'synthetic', token: 'synthetic' }) });
      privateResponse(response, fail ? 500 : name === 'organization/invite/[token]' ? 404 : 401);
      const body = await response.json();
      assert.equal(typeof body.error, 'string');
      instance.noEffects();
    }
  }
  const invitation = { id: 'invitation', email: 'synthetic@example.invalid', role: 'MEMBER',
    status: 'PENDING', expiresAt: new Date('2100-01-01T00:00:00.000Z'),
    organization: { id: 'org', name: 'Synthetic', slug: 'synthetic', logoUrl: null } };
  const publicInvite = route('organization/invite/[token]', { invitation });
  const inviteResponse = await publicInvite.handlers.GET(request('GET'), { params: Promise.resolve({ token: 'synthetic' }) });
  privateResponse(inviteResponse, 200);
  const inviteBody = await inviteResponse.json();
  assert.equal(inviteBody.invitation.email, invitation.email);
  assert.deepEqual(inviteBody.invitation.organization, invitation.organization);
  publicInvite.noEffects();
  const members = [{ id: 'member', user: { email: 'synthetic@example.invalid' } }];
  const authenticated = route('organization/members', { context: { organizationId: 'org', role: 'OWNER', memberId: 'member' }, members });
  const memberResponse = await authenticated.handlers.GET();
  privateResponse(memberResponse, 200);
  assert.deepEqual((await memberResponse.json()).members, members);
  authenticated.noEffects();
  console.log(`PASS HR private JSON: ${checks} actual handler responses across ${routes.length} routes, no provider/email/payment/write calls`);
})().catch(error => { console.error(error); process.exitCode = 1; });
