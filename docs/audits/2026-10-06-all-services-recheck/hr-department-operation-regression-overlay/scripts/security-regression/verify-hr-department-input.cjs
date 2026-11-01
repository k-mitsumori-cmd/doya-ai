const operationModule = require('./load-typescript.cjs').load('src/lib/hr/department-operation.ts', {'node:crypto': require('node:crypto')});
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');
const file = 'src/app/api/hr/departments/[id]/route.ts';
const observations = [];
(async () => {
  for (const scenario of [
    { name: 'empty-department-name', body: { name: '' }, expected: 400 },
    { name: 'whitespace-department-name', body: { name: '   ' }, expected: 400 },
    { name: 'duplicate-department-code', body: { code: 'existing-code' }, expected: 400 },
    { name: 'malformed-json', raw: '{', expected: 400 },
    { name: 'valid-japanese-fields', body: { name: '営業部', code: null, parentId: null, managerId: null, sortOrder: 0, isActive: false }, expected: 200 },
    { name: 'valid-long-japanese-name', body: { name: '長'.repeat(1200), sortOrder: 2147483647 }, expected: 200 },
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
    prisma.$transaction = async action => action(prisma);
    prisma.$queryRaw = async (parts, ...values) => { const sql=parts.join('');if(sql.includes('hr_organizations')){assert.deepEqual(values,['synthetic-org']);return[{id:'synthetic-org'}]}if(sql.includes('hr_organization_members')){assert.deepEqual(values,['synthetic-member','synthetic-org','synthetic-user']);return[{role:'ADMIN',status:'ACTIVE'}]}throw Error('Unexpected validation fixture SQL') };
    const api = load(file, {
      '@/lib/hr/department-operation': operationModule, '@/lib/hr/department-input': load('src/lib/hr/department-input.ts'),
      '@/lib/hr/department-mutation': load('src/lib/hr/department-mutation.ts', { '@/lib/prisma': { prisma } }),
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'synthetic-user' } }) },
      '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
      '@/lib/department-integrity': { validDepartmentParent: async () => true },
      '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'synthetic-org', userId: 'synthetic-user', memberId: 'synthetic-member', role: 'ADMIN', employeeId: null }), hasMinRole: () => true },
    });
    const response = await api.PATCH(new Request('https://example.invalid/api/hr/departments/synthetic-dept', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: scenario.raw ?? JSON.stringify(scenario.body) }), { params: Promise.resolve({ id: 'synthetic-dept' }) });
    assert.equal(response.status, scenario.expected, scenario.name + ': validation regression');
    assert.equal(writes, scenario.expected === 200 ? 1 : 0);
    if (scenario.expected === 200) assert.equal(saved.name, scenario.body.name);
    const body = await response.json();
    observations.push({ scenario: scenario.name, observedStatus: response.status, mutationSpyCalls: writes, savedData: saved ?? null, response: body, passed: true });
  }
  assert.equal(observations.length,6);
  const result = { expected:6, passed:6, results:observations.map(c=>c.scenario), cases:observations, scope:'Mandatory actual PATCH/input/mutation helper regression with synthetic scoped Prisma and unique-constraint error. No database/provider/customer writes; realDB47 covers actual locking and unique constraints.' };
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
