const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let writes = 0;
const prisma = {
  sfaDeal: { findFirst: async ({ where }) => {
    assert.equal(where.organizationId, 'org-1');
    assert.equal(where.isActive, true);
    return where.id === 'own' ? { id: 'own' } : null;
  } },
  sfaTask: { create: async ({ data }) => { writes++; return { id: `task-${writes}`, ...data }; } },
};
const { POST } = load('src/app/api/sfa/tasks/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org-1', memberId: 'member-1' }), orgSlugFrom: () => null },
});
const request = (body) => ({ json: async () => body });

(async () => {
  for (const body of [null, [], { title: 3 }, { title: '作業', dealId: 123 },
    { title: '作業', dealId: 'foreign' }, { title: '作業', dealId: 'inactive' },
    { title: '作業', dueDate: '2026-02-30' }, { title: '作業', dueDate: 3 },
    { title: '作業', dueDate: 'invalid' }]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal(writes, 0, 'Invalid inputs must not create detached tasks');
  const response = await POST(request({ title: '  見積を送る  ', dealId: ' own ', dueDate: '2026-09-30' }));
  assert.equal(response.status, 200);
  const { task } = await response.json();
  assert.equal(task.title, '見積を送る');
  assert.equal(task.dealId, 'own');
  assert.equal(writes, 1);
  console.log('PASS SFA task create: invalid date or relation rejected without writes; valid task keeps its deal');
})().catch((error) => { console.error(error); process.exitCode = 1; });
