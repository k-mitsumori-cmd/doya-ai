const assert = require('node:assert/strict');
const { load, check } = require('./load-typescript.cjs');
const cases = [];
const verify = async (name, fn) => { await check(name, fn); cases.push(name); };

(async () => {
  const next = { 'next/server': { NextResponse: Response } };
  const constants = load('src/lib/expense/constants.ts');
  let session = { user: { id: 'synthetic-owner', name: 'Session owner' } };
  let member = { id: 'member-a', userId: 'synthetic-owner', organizationId: 'expense-a', role: 'owner', organization: { slug: 'expense-a' } };
  let ceiling = null, contextError = null, callbacks = 0;
  const access = load('src/lib/expense/access.ts', {
    ...next, 'next-auth': { getServerSession: async () => session }, '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: 'synthetic-owner' }) }, expenseMember: { findFirst: async () => { if (contextError) throw contextError; return member; } } } },
    './constants': constants, '@/lib/company-roles/access.server': { ceilToolRole: async input => ceiling || input.toolRole },
  });
  const req = (org = 'expense-a') => ({ url: 'https://example.invalid/api/expense/vendors' + (org ? '?org=' + org : ''), nextUrl: { pathname: '/api/expense/vendors' } });
  const run = (fn, minimum = 'member', request = req()) => access.withExpense(request, minimum, async () => { callbacks++; return fn(); });
  const privacy = r => {
    assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.equal((r.headers.get('vary') || '').split(',').filter(v => v.trim().toLowerCase() === 'cookie').length, 1);
  };
  await verify('Expense successful personalized JSON keeps payload/status and disables caches', async () => {
    const r = await run(() => Response.json({ vendors: [{ id: 'synthetic-private' }] }, { status: 201, headers: { 'Cache-Control': 'public, max-age=60', Vary: 'RSC' } }));
    privacy(r); assert.equal(r.status, 201); assert.equal(r.headers.get('vary'), 'RSC, Cookie'); assert.deepEqual(await r.json(), { vendors: [{ id: 'synthetic-private' }] });
  });
  await verify('Expense streamed CSV retains UTF8 bytes and download metadata', async () => {
    const text = 'name,amount\n合成,1200\n', bytes = new TextEncoder().encode(text);
    const r = await run(() => new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 7)); c.enqueue(bytes.slice(7)); c.close(); } }), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="synthetic.csv"', Vary: 'Accept' } }));
    privacy(r); assert.equal(r.headers.get('content-disposition'), 'attachment; filename="synthetic.csv"'); assert.equal(r.headers.get('content-type'), 'text/csv; charset=utf-8'); assert.equal(await r.text(), text);
  });
  await verify('Expense missing organization remains400 without invoking handler', async () => {
    const before = callbacks, r = await run(() => { throw Error('Unexpected callback'); }, 'member', req(null)); privacy(r); assert.equal(r.status, 400); assert.equal(callbacks, before);
  });
  session = null;
  await verify('Expense anonymous rejection remains401 without invoking handler', async () => {
    const before = callbacks, r = await run(() => { throw Error('Unexpected callback'); }); privacy(r); assert.equal(r.status, 401); assert.equal(callbacks, before);
  });
  session = { user: { id: 'synthetic-owner', name: 'Session owner' } }; const originalMember = member; member = null;
  await verify('Expense missing membership remains403 without invoking handler', async () => {
    const before = callbacks, r = await run(() => { throw Error('Unexpected callback'); }); privacy(r); assert.equal(r.status, 403); assert.equal(callbacks, before);
  });
  member = { ...originalMember, role: 'member' };
  await verify('Expense member cannot enter manager callback', async () => {
    const before = callbacks, r = await run(() => { throw Error('Unexpected callback'); }, 'manager'); privacy(r); assert.equal(r.status, 403); assert.equal(callbacks, before);
  });
  member = originalMember; ceiling = 'member';
  await verify('Expense company role ceiling still prevents manager callback', async () => {
    const before = callbacks, r = await run(() => { throw Error('Unexpected callback'); }, 'manager'); privacy(r); assert.equal(r.status, 403); assert.equal(callbacks, before);
  });
  ceiling = null;
  for (const [label, error, status, code] of [
    ['domain', new access.ExpenseHttpError(409, 'Synthetic conflict', 'SYNTHETIC_CONFLICT'), 409, 'SYNTHETIC_CONFLICT'],
    ['FX input', Object.assign(Error('通貨のレートを登録してください'), { name: 'FxRateMissingError' }), 400, 'FX_RATE_MISSING'],
    ['unexpected', Error('SYNTHETIC_PRIVATE_MARKER'), 500, undefined],
  ]) await verify('Expense ' + label + ' failure preserves existing response semantics', async () => {
    const r = await run(() => { throw error; }); privacy(r); assert.equal(r.status, status); const body = await r.json(); assert.equal(body.code, code); assert(!JSON.stringify(body).includes('SYNTHETIC_PRIVATE_MARKER'));
  });
  contextError = Error('SYNTHETIC_PRIVATE_MARKER');
  await verify('Expense context exception is sanitized/private before callback', async () => {
    const before = callbacks, r = await run(() => { throw Error('Unexpected callback'); }); privacy(r); assert.equal(r.status, 500); assert.equal(callbacks, before); assert(!(await r.text()).includes('SYNTHETIC_PRIVATE_MARKER'));
  });
  contextError = null;

  let resolvedUser = 'synthetic-owner', company = null, created = [], createFailure = false;
  const unused = () => { throw Error('Unrelated organization update must not run'); };
  const organization = load('src/app/api/expense/organization/route.ts', {
    ...next, '@/lib/prisma': { prisma: {} }, 'next-auth': { getServerSession: async () => session }, '@/lib/auth': { authOptions: {} },
    '@/lib/shell/company.server': { getOwnCompany: async () => company },
    '@/lib/expense/access': { ...access, resolveUserId: async () => resolvedUser, createOrganization: async (...args) => { if (createFailure) throw Error('SYNTHETIC_PRIVATE_MARKER'); created.push(args); return { id: 'org-new', name: args[1], slug: 'org-new' }; } },
    '@/lib/expense/constants': constants, '@/lib/expense/sync': { syncWithholding: unused, retryOnConflict: unused }, '@/lib/expense/validate': { oneOf: unused, slackWebhook: unused, str: unused },
  });
  const post = value => organization.POST({ json: async () => value });
  resolvedUser = null;
  await verify('Expense onboarding anonymous response is private401', async () => { const r = await post({}); privacy(r); assert.equal(r.status, 401); assert.equal(created.length, 0); });
  resolvedUser = 'synthetic-owner';
  await verify('Expense onboarding invalid input stays private400 without create', async () => { const r = await post(null); privacy(r); assert.equal(r.status, 400); assert.equal(created.length, 0); });
  await verify('Expense missing account company stays private409 without create', async () => { const r = await post({ fromAccountCompany: true }); privacy(r); assert.equal(r.status, 409); assert.equal((await r.json()).code, 'COMPANY_REQUIRED'); assert.equal(created.length, 0); });
  await verify('Expense legacy onboarding keeps200 and exact organization payload', async () => {
    const r = await post({ name: ' Synthetic organization ', memberName: ' Synthetic member ' }); privacy(r); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { organization: { id: 'org-new', name: 'Synthetic organization', slug: 'org-new' } }); assert.deepEqual(created[0], ['synthetic-owner', 'Synthetic organization', 'Synthetic member']);
  });
  company = { name: ' Account company ' };
  await verify('Expense account-company onboarding still ignores client-supplied identity', async () => {
    const r = await post({ fromAccountCompany: true, name: 'Wrong company', memberName: 'Wrong member' }); privacy(r); assert.equal(r.status, 200); assert.deepEqual(created[1], ['synthetic-owner', 'Account company', 'Session owner']);
  });
  createFailure = true;
  await verify('Expense onboarding failure remains sanitized private500', async () => { const r = await post({ name: 'Synthetic', memberName: 'Synthetic' }); privacy(r); assert.equal(r.status, 500); assert(!(await r.text()).includes('SYNTHETIC_PRIVATE_MARKER')); });

  let memberships = [], usageContext = null, claimed = 0, claimError = false;
  const usage = load('src/app/api/expense/usage/route.ts', {
    ...next, '@/lib/expense/access': { resolveUserId: async () => resolvedUser, claimPendingMemberships: async () => { if (claimError) throw Error('SYNTHETIC_PRIVATE_MARKER'); claimed++; }, listMemberships: async () => memberships, getExpenseContext: async slug => slug === 'foreign-org' ? null : usageContext },
  });
  resolvedUser = null;
  await verify('Expense usage anonymous payload remains private401 without claiming invites', async () => { const r = await usage.GET({ url: 'https://example.invalid/api/expense/usage' }); privacy(r); assert.equal(r.status, 401); assert.deepEqual(await r.json(), { onboarded: false, memberships: [] }); assert.equal(claimed, 0); });
  resolvedUser = 'synthetic-owner';
  await verify('Expense usage empty account remains private200', async () => { const r = await usage.GET({ url: 'https://example.invalid/api/expense/usage' }); privacy(r); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { onboarded: false, organization: null, role: null, memberships: [] }); assert.equal(claimed, 1); });
  memberships = [{ slug: 'expense-a', name: 'Synthetic org', role: 'owner' }]; usageContext = { organizationSlug: 'expense-a', role: 'owner' };
  await verify('Expense usage retains own context and memberships', async () => { const r = await usage.GET({ url: 'https://example.invalid/api/expense/usage' }); privacy(r); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { onboarded: true, organization: { slug: 'expense-a' }, role: 'owner', memberships }); });
  await verify('Expense usage foreign explicit scope stays empty and does not leak foreign role', async () => { const r = await usage.GET({ url: 'https://example.invalid/api/expense/usage?org=foreign-org' }); privacy(r); assert.equal(r.status, 200); const body = await r.json(); assert.equal(body.organization, null); assert.equal(body.role, null); assert.deepEqual(body.memberships, memberships); });
  claimError = true;
  await verify('Expense usage failure remains sanitized private500', async () => { const r = await usage.GET({ url: 'https://example.invalid/api/expense/usage' }); privacy(r); assert.equal(r.status, 500); assert(!(await r.text()).includes('SYNTHETIC_PRIVATE_MARKER')); });
  console.log(JSON.stringify({ passed: cases.length, scope: 'Actual Expense access wrapper, onboarding POST and usage GET with synthetic session/DB/auth dependencies. No live DB, invitations, providers or customer data.' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
