const assert = require('node:assert/strict');
const { load, check } = require('./load-typescript.cjs');

(async () => {
  const next = { 'next/server': { NextResponse: Response } };
  const access = load('src/lib/income/access.ts', {
    ...next, crypto: require('node:crypto'),
    'next-auth': { getServerSession: async () => null },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: {} },
    './roles': load('src/lib/income/roles.ts'),
  });
  let ctx = { userId: 'synthetic-owner', organizationId: 'synthetic-income', role: 'owner' };
  let session = null, roleAllowed = true, companyAllowed = true, contextError = null, callbacks = 0;
  const { withIncome } = load('src/lib/income/route.ts', {
    'next-auth': { getServerSession: async () => session }, '@/lib/auth': { authOptions: {} },
    './access': { ...access, getIncomeContext: async () => { if (contextError) throw contextError; return ctx; }, hasMinRole: () => roleAllowed },
    '@/lib/company-roles/access.server': { authorizeCompanyActionForSession: async () => ({ allowed: companyAllowed }) },
  });
  const run = (fn, opts) => withIncome({}, 'member', async () => { callbacks++; return fn(); }, opts);
  const privateResponse = response => {
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const vary = (response.headers.get('vary') || '').split(',').map(v => v.trim().toLowerCase());
    assert.equal(vary.filter(v => v === 'cookie').length, 1);
  };

  await check('Income successful personalized JSON keeps status/body and disables caches', async () => {
    const r = await run(() => Response.json({ contracts: [{ id: 'synthetic-private' }] }, { status: 201, headers: { Vary: 'RSC', 'Cache-Control': 'public, max-age=60' } }));
    privateResponse(r); assert.equal(r.status, 201); assert.equal(r.headers.get('vary'), 'RSC, Cookie');
    assert.deepEqual(await r.json(), { contracts: [{ id: 'synthetic-private' }] });
  });
  await check('Income PDF stream keeps bytes, download headers and separate cookies', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 10]);
    const headers = new Headers({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="synthetic.pdf"', 'Content-Length': String(bytes.length) });
    headers.append('Set-Cookie', 'fixture-a=one; HttpOnly'); headers.append('Set-Cookie', 'fixture-b=two; HttpOnly');
    const r = await run(() => new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }), { headers }));
    privateResponse(r); assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.equal(r.headers.get('content-disposition'), 'attachment; filename="synthetic.pdf"');
    assert.equal(r.headers.get('content-length'), String(bytes.length)); assert.equal(r.headers.getSetCookie().length, 2);
    assert.deepEqual(new Uint8Array(await r.arrayBuffer()), bytes);
  });
  await check('Income empty 204 response keeps empty body and custom headers', async () => {
    const r = await run(() => new Response(null, { status: 204, headers: { 'X-Fixture': 'preserved' } }));
    privateResponse(r); assert.equal(r.status, 204); assert.equal(r.headers.get('x-fixture'), 'preserved'); assert.equal(await r.text(), '');
  });
  await check('Income immutable redirect keeps target/status without mutating guarded headers', async () => {
    const r = await run(() => Response.redirect('https://example.invalid/fixture', 307));
    privateResponse(r); assert.equal(r.status, 307); assert.equal(r.headers.get('location'), 'https://example.invalid/fixture');
  });
  await check('Income existing Cookie variation is not duplicated', async () => {
    const r = await run(() => Response.json({ ok: true }, { headers: { Vary: 'RSC, cOoKiE' } }));
    privateResponse(r); assert.equal(r.headers.get('vary'), 'RSC, cOoKiE');
  });
  ctx = null;
  for (const [label, who, status] of [['guest', null, 401], ['missing organization', { user: { id: 'synthetic-owner' } }, 403]]) {
    await check('Income ' + label + ' rejection remains private without calling handler', async () => {
      session = who; const before = callbacks, r = await run(() => { throw Error('Unexpected handler'); });
      privateResponse(r); assert.equal(r.status, status); assert.equal(callbacks, before);
    });
  }
  ctx = { userId: 'synthetic-owner', organizationId: 'synthetic-income', role: 'member' };
  roleAllowed = false;
  await check('Income role rejection remains private and does not invoke handler', async () => {
    const before = callbacks, r = await run(() => { throw Error('Unexpected handler'); }); privateResponse(r); assert.equal(r.status, 403); assert.equal(callbacks, before);
  });
  roleAllowed = true; companyAllowed = false;
  await check('Income company permission rejection remains private and does not invoke handler', async () => {
    const before = callbacks, r = await run(() => { throw Error('Unexpected handler'); }, { permission: 'income.contract.edit' }); privateResponse(r); assert.equal(r.status, 403); assert.equal(callbacks, before);
  });
  companyAllowed = true;
  for (const [label, error, status] of [['domain', new access.IncomeError('synthetic valid input error'), 400], ['conflict', { code: 'P2034' }, 409], ['exception', Error('SYNTHETIC_PRIVATE_MARKER'), 500]]) {
    await check('Income ' + label + ' error keeps existing status and private response', async () => {
      const r = await run(() => { throw error; }); privateResponse(r); assert.equal(r.status, status); assert(!(await r.text()).includes('SYNTHETIC_PRIVATE_MARKER'));
    });
  }
  contextError = Error('SYNTHETIC_PRIVATE_MARKER');
  await check('Income context failure stays sanitized/private before handler invocation', async () => {
    const before = callbacks, r = await run(() => { throw Error('Unexpected handler'); }); privateResponse(r); assert.equal(r.status, 500); assert.equal(callbacks, before); assert(!(await r.text()).includes('SYNTHETIC_PRIVATE_MARKER'));
  });
  console.log('Income route response regression passed: 13 cases; actual access/wrapper/private-response modules, synthetic context/session only. No DB/providers.');
})().catch(error => { console.error(error); process.exitCode = 1; });
