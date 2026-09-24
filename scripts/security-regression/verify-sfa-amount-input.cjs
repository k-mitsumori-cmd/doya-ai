const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const amount = load('src/lib/sfa/amount.ts');
for (const value of [null, Infinity, 'Infinity', 'NaN', '1e309', -1, true, {}, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(amount.parseSfaAmount(value), null, `Reject ${String(value)}`);
}
assert.equal(amount.parseSfaAmount('1.6'), 2n);
assert.equal(amount.parseSfaAmount(Number.MAX_SAFE_INTEGER), BigInt(Number.MAX_SAFE_INTEGER));

let createWrites = 0;
let updateWrites = 0;
let conversionWrites = 0;
const format = { bigIntToNumber: (value) => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? Number(item) : item)) };
const common = {
  'next/server': { NextResponse: Response },
  '@/lib/sfa/amount': amount,
  '@/lib/sfa/format': format,
  '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org-1', memberId: 'member-1', userId: 'user-1' }), orgSlugFrom: () => null },
};
const create = load('src/app/api/sfa/deals/route.ts', {
  ...common,
  '@/lib/prisma': { prisma: {
    sfaStage: { findFirst: async () => null },
    sfaDeal: { create: async ({ data }) => { createWrites++; return { id: 'deal-1', ...data }; } },
  } },
  '@/lib/service-usage': { recordServiceUsage: async () => {} },
}).POST;
const update = load('src/app/api/sfa/deals/[id]/route.ts', {
  ...common,
  '@/lib/prisma': { prisma: {
    sfaDeal: {
      findUnique: async () => ({ id: 'deal-1', organizationId: 'org-1', isActive: true }),
      update: async ({ data }) => { updateWrites++; return { id: 'deal-1', ...data }; },
    },
  } },
}).PATCH;
const convert = load('src/app/api/sfa/leads/[id]/convert/route.ts', {
  ...common,
  '@/lib/prisma': { prisma: {
    sfaLead: { findUnique: async () => ({ id: 'lead-1', organizationId: 'org-1', isActive: true, status: 'new' }) },
    $transaction: async () => { conversionWrites++; throw new Error('Invalid amount reached transaction'); },
  } },
}).POST;
const request = (body) => ({ json: async () => body });
const ctx = { params: Promise.resolve({ id: 'deal-1' }) };

(async () => {
  for (const value of [null, Infinity, 'Infinity', 'NaN', '1e309', -1, true, {}, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await create(request({ name: '商談', amount: value }))).status, 400);
    assert.equal((await update(request({ amount: value }), ctx)).status, 400);
    assert.equal((await convert(request({ amount: value }), ctx)).status, 400);
  }
  for (const body of [null, [], { name: 123, amount: 1 }, { name: '商談', startDate: '2026-02-30' }]) {
    assert.equal((await create(request(body))).status, 400);
  }
  for (const body of [null, [], { amount: 1, expectedCloseDate: '2026-02-30' }, { amount: 1, probability: Infinity }]) {
    assert.equal((await update(request(body), ctx)).status, 400);
  }
  assert.equal((await convert(request({ dealName: 123 }), ctx)).status, 400);
  assert.equal(createWrites, 0);
  assert.equal(updateWrites, 0);
  assert.equal(conversionWrites, 0);
  const created = await create(request({ name: '商談', amount: '1.6' }));
  assert.equal(created.status, 200);
  assert.equal((await created.json()).deal.amount, 2);
  const updated = await update(request({ amount: '2.4' }), ctx);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).deal.amount, 2);
  assert.equal(createWrites, 1);
  assert.equal(updateWrites, 1);
  console.log('PASS SFA amount inputs: malformed amounts and dates rejected before writes across create, update and conversion');
})().catch((error) => { console.error(error); process.exitCode = 1; });
