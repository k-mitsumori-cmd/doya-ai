const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const shift = load('src/lib/kintai/shift-records.ts')

let role = 'hr_admin'
let reads = 0
const attendance = {
  id: 'historical-attendance', employeeId: 'former', date: new Date('2026-09-20T00:00:00Z'),
  clockIn: new Date('2026-09-19T15:00:00Z'), clockOut: new Date('2026-09-19T23:00:00Z'),
  workMinutes: 480, overtimeMinutes: 0, breakMinutes: 60, lateMinutes: 0, status: 'normal',
}
const prisma = {
  kintaiEmployee: {
    findUnique: async () => ({ departmentId: 'sales' }),
    findMany: async ({ where }) => {
      reads++
      assert.equal(where.organizationId, 'org')
      assert.equal(where.departmentId, role === 'manager' ? 'sales' : undefined)
      assert.equal(where.OR[0].isActive, true)
      assert.equal(where.OR[1].attendances.some.date.gte.toISOString(), '2026-09-20T00:00:00.000Z')
      assert.equal(where.OR[1].attendances.some.date.lt.toISOString(), '2026-09-21T00:00:00.000Z')
      assert.equal(where.OR[2].clockRecords.some.timestamp.gte.toISOString(), '2026-09-19T15:00:00.000Z')
      return [{ id: 'former', name: '退職済み', departmentId: 'sales', department: { name: '営業' }, isActive: false }]
    },
  },
  kintaiAttendance: { findMany: async ({ where }) => {
    assert.equal(where.employeeId.in[0], 'former')
    return [attendance]
  } },
  kintaiClockRecord: { findMany: async () => [] },
}
const ranks = { employee: 0, manager: 1, hr_admin: 2 }
const route = load('src/app/api/kintai/attendance/admin/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/kintai/shift-records': shift,
  '@/lib/kintai/access': {
    getKintaiContext: async () => ({ organizationId: 'org', employeeId: 'viewer', role }),
    hasMinRole: (actual, required) => ranks[actual] >= ranks[required],
  },
})
const get = (date) => route.GET(new Request(`https://local.invalid/api/kintai/attendance/admin?date=${date}`))

;(async () => {
  for (const currentRole of ['hr_admin', 'manager']) {
    role = currentRole
    const response = await get('2026-09-20')
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Cache-Control'), /no-store/)
    const data = await response.json()
    assert.equal(data.employees.length, 1)
    assert.equal(data.employees[0].name, '退職済み')
    assert.equal(data.employees[0].attendance.id, attendance.id)
  }
  const before = reads
  for (const date of ['', '2026-02-29', '2026-13-01', '2026-09-20extra']) {
    assert.equal((await get(date)).status, 400)
  }
  assert.equal(reads, before, 'invalid dates must not query employee records')
  console.log('PASS Kintai admin history: former employees with past records remain visible, scoped managers and invalid dates')
})().catch((error) => { console.error(error); process.exitCode = 1 })
