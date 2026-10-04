const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const shift = load('src/lib/kintai/shift-records.ts')

let records = [{ id: 'in', employeeId: 'employee', type: 'clock_in', timestamp: new Date('2026-10-03T23:00:00+09:00') }]
let attendanceRows = []
let employeeReads = 0
const prisma = {
  kintaiEmployee: { findMany: async ({ where }) => {
    employeeReads++
    assert.equal(where.organizationId, 'org')
    return [{ id: 'employee', name: '夜勤', departmentId: null, department: null }]
  } },
  kintaiAttendance: { findMany: async () => attendanceRows },
  kintaiClockRecord: { findMany: async ({ where }) => {
    assert.equal(where.timestamp.gte.toISOString(), '2026-10-02T15:00:00.000Z')
    assert.equal(where.timestamp.lt.toISOString(), '2026-10-04T15:00:00.000Z')
    return records
  } },
}
const route = load('src/app/api/kintai/attendance/admin/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/kintai/access': {
    getKintaiContext: async () => ({ role: 'hr_admin', organizationId: 'org', employeeId: 'viewer' }),
    hasMinRole: () => true,
  },
  '@/lib/kintai/shift-records': shift,
})

async function main() {
  const get = date => route.GET(new Request(`http://offline.invalid/api/kintai/attendance/admin?date=${date}`))
  const open = await get('2026-10-04')
  assert.equal(open.status, 200)
  const openAttendance = (await open.json()).employees[0].attendance
  assert.equal(openAttendance.status, 'working')
  assert.equal(openAttendance.clockIn, '2026-10-03T14:00:00.000Z')
  assert.equal(openAttendance.clockOut, null)
  console.log('PASS 前日開始の未退勤シフトは管理者画面でも勤務中')

  records = [...records, { id: 'out', employeeId: 'employee', type: 'clock_out', timestamp: new Date('2026-10-04T01:00:00+09:00') }]
  const closed = await get('2026-10-04')
  assert.equal(closed.status, 200)
  assert.equal((await closed.json()).employees[0].attendance, null)
  console.log('PASS 翌日の退勤後は勤務中と誤表示しない')

  records = [...records, { id: 'next-in', employeeId: 'employee', type: 'clock_in', timestamp: new Date('2026-10-04T09:00:00+09:00') }]
  attendanceRows = [{ id: 'saved', employeeId: 'employee', clockIn: records[0].timestamp, clockOut: records[1].timestamp, workMinutes: 120, overtimeMinutes: 0, breakMinutes: 0, lateMinutes: 0, status: 'normal' }]
  const reopened = await get('2026-10-04')
  assert.equal(reopened.status, 200)
  const reopenedAttendance = (await reopened.json()).employees[0].attendance
  assert.equal(reopenedAttendance.status, 'working')
  assert.equal(reopenedAttendance.clockIn, '2026-10-04T00:00:00.000Z')
  assert.equal(reopenedAttendance.clockOut, null)
  assert.equal(reopenedAttendance.workMinutes, 120)
  console.log('PASS 保存済み実績の後に再出勤した場合も勤務中')

  const before = employeeReads
  assert.equal((await get('')).status, 400)
  assert.equal(employeeReads, before)
  console.log('PASS 空の日付指定は今日へ置き換えない')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
