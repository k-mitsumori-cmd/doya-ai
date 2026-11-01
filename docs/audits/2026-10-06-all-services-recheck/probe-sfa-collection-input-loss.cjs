const assert = require('node:assert/strict');
const { load } = require('../../../scripts/security-regression/load-typescript.cjs');
(async () => {
  const results = [];
  const definitions = {
    accounts: { name: 200, industry: 80, prefecture: 40, url: 300, note: 2000 },
    contacts: { name: 80, title: 80, department: 80, email: 200, phone: 40, note: 2000 },
    leads: { name: 200, corporateNumber: 20, contactName: 80, email: 200, phone: 40, note: 2000 },
  };
  for (const [collection, fields] of Object.entries(definitions)) {
    let saved;
    const model = { accounts: 'sfaAccount', contacts: 'sfaContact', leads: 'sfaLead' }[collection];
    const prisma = { [model]: { create: async ({ data }) => { saved = data; return { id: 'synthetic', ...data }; } } };
    const { POST } = load(`src/app/api/sfa/${collection}/route.ts`, {
      'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
      '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org', userId: 'user', memberId: 'member' }), orgSlugFrom: () => 'alpha' },
      '@/lib/sfa/format': load('src/lib/sfa/format.ts'),
      '@/lib/sfa/limits': { withSfaAdmission: async (_org, _counts, create) => ({ created: await create(prisma) }) },
    });
    for (const [field, limit] of Object.entries(fields)) {
      const value = 'x'.repeat(limit + 1), body = { name: 'synthetic', [field]: value };
      const response = await POST({ json: async () => body });
      assert.equal(response.status, 200); assert.equal(saved[field].length, limit);
      results.push({ collection, field, submittedLength: value.length, savedLength: saved[field].length, status: response.status });
    }
  }
  console.log(JSON.stringify({ status: 'confirmed-open', cases: results.length, results, scope: 'Actual SFA collection POST routes and format helper, synthetic auth/Prisma/admission. Input truncation proven; quota behavior and real DB/user submissions unproven. No real customer/provider writes.' }, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
