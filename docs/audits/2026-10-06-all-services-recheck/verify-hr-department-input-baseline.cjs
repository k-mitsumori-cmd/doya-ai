const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { load } = require('../../../scripts/security-regression/load-typescript.cjs');
const file = 'src/app/api/hr/departments/[id]/route.ts';
const observations = [];
(async () => {
  for (const scenario of [
    { name: 'empty-department-name', body: { name: '' }, expected: 200 },
    { name: 'whitespace-department-name', body: { name: '   ' }, expected: 200 },
    { name: 'duplicate-department-code', body: { code: 'existing-code' }, expected: 500 },
    { name: 'malformed-json', raw: '{', expected: 500 },
  ]) {
    let writes = 0;
    let saved;
    const prisma = { hrDepartment: {
      findFirst: async query => { assert.equal(query.where.organizationId, 'synthetic-org'); return { id: 'synthetic-dept', name: 'Original' }; },
      update: async query => {
        if (query.data.code === 'existing-code') throw Object.assign(new Error('Synthetic schema unique constraint'), { code: 'P2002' });
        writes++; saved = query.data; return { id: 'synthetic-dept', ...query.data };
      },
    } };
    const api = load(file, {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'synthetic-user' } }) },
      '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
      '@/lib/department-integrity': { validDepartmentParent: async () => true },
      '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'synthetic-org', userId: 'synthetic-user', memberId: 'synthetic-member', role: 'ADMIN', employeeId: null }), hasMinRole: () => true },
    });
    const response = await api.PATCH(new Request('https://example.invalid/api/hr/departments/synthetic-dept', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: scenario.raw ?? JSON.stringify(scenario.body) }), { params: Promise.resolve({ id: 'synthetic-dept' }) });
    assert.equal(response.status, scenario.expected, scenario.name + ': baseline behavior changed; inspect before interpreting');
    const body = await response.json();
    observations.push({ scenario: scenario.name, observedStatus: response.status, mutationSpyCalls: writes, savedData: saved ?? null, response: body, defectReproduced: true });
  }
  const result = { checkedAt: new Date().toISOString(), observations, defectsReproduced: observations.length, sourceHashes: Object.fromEntries([file, 'prisma/schema.prisma', __filename].map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])), scope: 'Actual current root PATCH handler with synthetic authenticated admin, scoped Prisma spies and synthetic P2002 matching the schema unique organization/code constraint. Empty and whitespace names reach update with200; malformed JSON and duplicate code produce500. This is a defect baseline, not a passing repair verification or real database/production proof. No database/customer/provider writes.' };
  fs.writeFileSync(__dirname + '/hr-department-input-baseline.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
