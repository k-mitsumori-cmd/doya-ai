const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const day = '2026-09-21';
const records = [
  { id: 'in', type: 'clock_in', timestamp: new Date('2026-09-20T23:00:00+09:00'), createdAt: new Date('2026-09-20T23:00:00+09:00') },
  { id: 'out', type: 'clock_out', timestamp: new Date('2026-09-21T01:00:00+09:00'), createdAt: new Date('2026-09-21T01:00:00+09:00') },
];
const request = { id: 'request', status: 'pending', type: 'clock_fix', employeeId: 'employee', employee: { organizationId: 'org' },
  details: { date: day, clockType: 'clock_out', correctedTime: '02:00', recordId: 'out', expectedTimestamp: records[1].timestamp.toISOString() } };
const recalculated = [];
const db = {
  $queryRaw: async () => [{ id: 'employee' }],
  kintaiRequest: {
    findUnique: async () => request,
    updateMany: async ({ where, data }) => { if (request.status !== where.status) return { count: 0 }; Object.assign(request, data); return { count: 1 }; },
  },
  kintaiEmployee: { findUnique: async () => ({ departmentId: 'department' }) },
  kintaiAttendance: { findFirst: async () => null },
  kintaiClockRecord: {
    findMany: async ({ where }) => records.filter(record =>
      (!where.id || record.id === where.id) && (!where.type || record.type === where.type) &&
      (!where.timestamp?.gte || record.timestamp >= where.timestamp.gte) &&
      (!where.timestamp?.lt || record.timestamp < where.timestamp.lt)),
    update: async ({ where, data }) => Object.assign(records.find(record => record.id === where.id), data),
  },
};
const prisma = { ...db, $transaction: async fn => fn(db) };
const route = load('src/app/api/kintai/requests/[id]/route.ts', {
  'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
  '@/lib/kintai/access': { getKintaiContext: async () => ({ organizationId: 'org', employeeId: 'admin', role: 'hr_admin' }), hasMinRole: () => true },
  '@/lib/kintai/recalculate': { recalculateDayForEmployee: async (_employee, _org, date) => recalculated.push(date.toISOString()) },
  '@/lib/kintai/shift-records': load('src/lib/kintai/shift-records.ts'),
});

(async () => {
  const response = await route.PATCH({ json: async () => ({ status: 'approved' }) }, { params: Promise.resolve({ id: 'request' }) });
  assert.equal(response.status, 200);
  assert.equal(records[1].timestamp.toISOString(), '2026-09-20T17:00:00.000Z');
  assert.deepEqual(recalculated, ['2026-09-20T00:00:00.000Z', '2026-09-21T00:00:00.000Z']);
  console.log('PASS Kintai overnight correction refreshes both the shift workday and the correction calendar day');
})().catch(error => { console.error(error); process.exitCode = 1; });
