const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let writes = 0;
const route = load('src/app/api/kintai/requests/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { kintaiRequest: { create: async ({ data }) => { writes++; return { id: 'request', ...data }; } } } },
  '@/lib/kintai/access': { getKintaiContext: async () => ({ employeeId: 'employee' }), hasMinRole: () => false },
});

const submit = async details => route.POST({ json: async () => ({ type: 'clock_fix', details, reason: 'Test correction' }) });

(async () => {
  for (const details of [
    { date: '2099-01-01', clockType: 'clock_in', correctedTime: '09:00' },
    { date: '2026-02-30', clockType: 'clock_in', correctedTime: '09:00' },
    { date: '2026-09-20', clockType: 'unknown', correctedTime: '09:00' },
    { date: '2026-09-20', clockType: 'clock_in', correctedTime: '25:00' },
  ]) {
    assert.equal((await submit(details)).status, 400);
  }
  assert.equal(writes, 0, 'invalid and future corrections cannot be saved');
  assert.equal((await submit({ date: '2026-09-20', clockType: 'clock_out', correctedTime: '01:00' })).status, 201);
  assert.equal(writes, 1);
  console.log('PASS Kintai correction admission rejects future and malformed times before saving');
})().catch(error => { console.error(error); process.exitCode = 1; });
