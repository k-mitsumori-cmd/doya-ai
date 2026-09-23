const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const shift = load('src/lib/kintai/shift-records.ts');
const attendance = load('src/lib/kintai/attendance.ts');
const now = new Date('2026-09-21T01:00:00+09:00');
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [+now])); } }
let records = [{ id: 'in', type: 'clock_in', timestamp: new Date('2026-09-20T23:00:00+09:00'), createdAt: new Date('2026-09-20T23:00:00+09:00') }];
let saved = null;
let leaveChecks = 0;
const findRecords = async ({ where }) => records.filter(record => record.timestamp >= where.timestamp.gte && record.timestamp < where.timestamp.lt);
const db = {
  $queryRaw: async () => [{ id: 'e1' }],
  kintaiClockRecord: {
    findMany: findRecords,
    create: async ({ data }) => { const record = { id: `r${records.length}`, createdAt: new Date(data.timestamp), ...data }; records.push(record); return record; },
  },
  kintaiAttendance: {
    findFirst: async () => { leaveChecks++; return { status: 'paid_leave' }; },
    findMany: async () => [],
    upsert: async ({ create }) => { saved = create; return create; },
  },
  kintaiEmployee: {
    findFirst: async () => ({ id: 'e1' }),
    findUnique: async () => ({ id: 'e1', name: 'Test', workRule: { workStart: '22:00', workEnd: '06:00', breakMinutes: 0 } }),
  },
  kintaiWorkRule: { findFirst: async () => null },
  kintaiRequest: { findMany: async () => [] },
};
const prisma = { ...db, $transaction: async fn => fn(db) };
const recalc = load('src/lib/kintai/recalculate.ts', { '@/lib/prisma': { prisma }, './attendance': attendance, './shift-records': shift });
const access = { getKintaiContext: async () => ({ employeeId: 'e1', organizationId: 'o1', userId: 'u1' }) };
const clock = load('src/app/api/kintai/clock/route.ts', {
  'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma }, '@/lib/kintai/access': access,
  '@/lib/kintai/recalculate': recalc, '@/lib/kintai/shift-records': shift,
  '@/lib/service-usage': { recordServiceUsage: async () => {} },
}, { Date: FixedDate });
const dashboard = load('src/app/api/kintai/dashboard/route.ts', {
  'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma }, '@/lib/kintai/access': access,
  '@/lib/kintai/format': load('src/lib/kintai/format.ts'), '@/lib/kintai/shift-records': shift,
}, { Date: FixedDate });

(async () => {
  let response = await dashboard.GET();
  assert.equal((await response.json()).clockStatus, 'working');
  response = await clock.POST({ json: async () => ({ type: 'clock_out' }), headers: new Headers() });
  assert.equal(response.status, 200);
  assert.equal(leaveChecks, 0, 'next-day leave does not block closing yesterday shift');
  assert.equal(saved.date.toISOString(), '2026-09-20T00:00:00.000Z');
  assert.equal(saved.workMinutes, 120);
  assert.equal(saved.nightMinutes, 120);
  assert.equal(saved.clockOut.toISOString(), now.toISOString());
  response = await clock.GET({ url: 'https://offline.invalid/api/kintai/clock?date=2026-09-21' });
  const body = await response.json();
  assert.equal(body.date, '2026-09-21');
  assert.equal(body.clockStatus, 'clocked_out');
  assert.equal(body.records.length, 1, 'date-specific correction list excludes yesterday clock-in');
  assert.equal(body.activeShiftRecords[0].id, 'in');
  assert.equal(body.activeShiftRecords.length, 2);
  response = await clock.POST({ json: async () => ({ type: 'clock_out' }), headers: new Headers() });
  assert.equal(response.status, 400);
  response = await clock.POST({ json: async () => ({ type: 'clock_in' }), headers: new Headers() });
  assert.equal(response.status, 409);
  const monthStart = new Date('2026-09-30T00:00:00+09:00');
  const monthEnd = new Date('2026-10-01T00:00:00+09:00');
  const crossMonth = [
    { id: 'm1', type: 'clock_in', timestamp: new Date('2026-09-30T23:00:00+09:00') },
    { id: 'm2', type: 'clock_out', timestamp: new Date('2026-10-01T01:00:00+09:00') },
    { id: 'm3', type: 'clock_in', timestamp: new Date('2026-10-01T09:00:00+09:00') },
  ];
  const attributed = shift.recordsForWorkday(crossMonth, monthStart, monthEnd);
  assert.deepEqual(Array.from(attributed, record => record.id), ['m1', 'm2']);
  assert.equal(shift.jstWorkdayDate(crossMonth[1].timestamp).toISOString(), '2026-10-01T00:00:00.000Z');
  assert.deepEqual(Array.from(shift.recordsWithCarryover(crossMonth, monthEnd), record => record.id), ['m2', 'm3']);
  console.log('PASS Kintai overnight: prior-day shift remains active, next-day clock-out recalculates workday, leave and duplicates are safe');
})().catch(error => { console.error(error); process.exitCode = 1; });
