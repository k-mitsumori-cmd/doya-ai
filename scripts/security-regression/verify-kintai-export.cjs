const assert = require('node:assert/strict')
const ExcelJS = require('exceljs')
const { load, check } = require('./load-typescript.cjs')
const loadExcelExport = require('./load-excel-export.cjs')

let reads = 0
let range
const employees = [
  {
    name: '=HYPERLINK("https://example.test","x")', department: { name: '+SUM(1,2)' },
    attendances: [{ date: new Date('2026-09-01T00:00:00Z'), clockIn: null, clockOut: null,
      workMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'paid_leave' }],
  },
  { name: 'A,"B"\nC & <D>', department: { name: '開発 & 営業' },
    attendances: [{ date: new Date('2026-09-02T00:00:00Z'), clockIn: null, clockOut: null,
      workMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'special_leave' }] },
  { name: '休暇なし', department: null, attendances: [] },
  { name: '退職済み', isActive: false, department: null,
    attendances: [{ date: new Date('2026-09-03T00:00:00Z'), clockIn: null, clockOut: null,
      workMinutes: 420, overtimeMinutes: 15, lateMinutes: 7, earlyLeaveMinutes: 11, status: 'approved' }] },
]
const prisma = { kintaiEmployee: { findMany: async ({ where, include }) => {
  reads++
  assert.equal(where.organizationId, 'org')
  assert.equal(where.OR[0].isActive, true)
  assert.deepEqual(where.OR[1].attendances.some.date, include.attendances.where.date,
    'inactive employees with attendance in the requested month must remain exportable')
  range = include.attendances.where.date
  return employees
} } }
const ranks = { employee: 0, hr_admin: 2 }
const mocks = {
  exceljs: ExcelJS,
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/kintai/access': {
    getKintaiContext: async () => ({ organizationId: 'org', employeeId: 'employee', role: 'hr_admin' }),
    hasMinRole: (role, minimum) => ranks[role] >= ranks[minimum],
  },
}
const exportRoute = loadExcelExport('src/app/api/kintai/attendance/export/route.ts', mocks)
const attendanceRoute = load('src/app/api/kintai/attendance/route.ts', {
  ...mocks,
  '@/lib/prisma': { prisma: { ...prisma, kintaiAttendance: { findMany: async () => [] } } },
})
const request = (path) => new Request(`https://local.test${path}`)

;(async () => {
  await check('CSV keeps quotes and line breaks in one cell and disarms formulas', async () => {
    const response = await exportRoute.GET(request('/api/kintai/attendance/export?year=2026&month=9&format=csv'))
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Cache-Control'), /no-store/)
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf')
    const csv = bytes.toString('utf8')
    assert(csv.includes('"\'=HYPERLINK(""https://example.test"",""x"")"'))
    assert(csv.includes('"\'+SUM(1,2)"'))
    assert(csv.includes('"A,""B""\nC & <D>"'))
    assert(csv.includes('"退職済み"'))
    assert(csv.includes('"休暇なし","","","","","0","0","0","0","データなし"'))
    assert.equal(range.gte.toISOString(), '2026-09-01T00:00:00.000Z')
    assert.equal(range.lt.toISOString(), '2026-10-01T00:00:00.000Z')
  })
  await check('Excel XLSX matches extension and preserves literal text and numeric cells', async () => {
    const response = await exportRoute.GET(request('/api/kintai/attendance/export?year=2026&month=09&format=excel'))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    assert.equal(response.headers.get('Content-Type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="kintai_2026-09.xlsx"')
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.equal(bytes.subarray(0, 4).toString('hex'), '504b0304')
    const workbook = await new ExcelJS.Workbook().xlsx.load(bytes)
    const sheet = workbook.getWorksheet('2026年9月')
    assert.equal(workbook.worksheets.length, 1)
    assert.equal(sheet.rowCount, 5); assert.equal(sheet.columnCount, 10)
    assert.equal(sheet.getCell('A2').value, employees[0].name)
    assert.equal(sheet.getCell('B2').value, employees[0].department.name)
    assert.equal(sheet.getCell('A3').value, employees[1].name)
    assert.equal(sheet.getCell('B3').value, employees[1].department.name)
    assert.equal(sheet.getCell('A4').value, '休暇なし')
    assert.equal(sheet.getCell('J4').value, 'データなし')
    assert.equal(sheet.getCell('A5').value, '退職済み')
    for (const [cell, value] of [['F5',420], ['G5',15], ['H5',7], ['I5',11]]) {
      assert.equal(sheet.getCell(cell).value, value); assert.equal(sheet.getCell(cell).type, ExcelJS.ValueType.Number)
    }
    sheet.eachRow(row => row.eachCell(cell => assert.notEqual(cell.type, ExcelJS.ValueType.Formula)))
    if (process.env.DOYA_KINTAI_XLSX_ARTIFACT) require('node:fs').writeFileSync(process.env.DOYA_KINTAI_XLSX_ARTIFACT, bytes)
  })
  await check('SQL DATE month selection includes both endpoints across leap years and year changes', async () => {
    // PostgreSQL DATE parameters discard time. Comparing timestamps here would hide
    // the previous JST-offset bug (previous-month last day in, current last day out).
    for (const [year, month, previous, first, last, next] of [
      [2026, 10, '2026-09-30', '2026-10-01', '2026-10-31', '2026-11-01'],
      [2024, 2, '2024-01-31', '2024-02-01', '2024-02-29', '2024-03-01'],
      [2026, 2, '2026-01-31', '2026-02-01', '2026-02-28', '2026-03-01'],
      [2026, 12, '2026-11-30', '2026-12-01', '2026-12-31', '2027-01-01'],
      [2027, 1, '2026-12-31', '2027-01-01', '2027-01-31', '2027-02-01'],
    ]) {
      const fixtures = [previous, first, last, next].map((date, index) => ({
        name: date, isActive: false, department: null,
        attendances: [{ date: new Date(date + 'T00:00:00Z'), clockIn: null, clockOut: null,
          workMinutes: [9, 1, 2, 99][index], overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'approved' }],
      }))
      const route = loadExcelExport('src/app/api/kintai/attendance/export/route.ts', {
        ...mocks,
        '@/lib/prisma': { prisma: { kintaiEmployee: { findMany: async ({ where, include }) => {
          const sqlDate = value => value.toISOString().slice(0, 10)
          const matches = (attendance, bounds) => {
            const date = sqlDate(attendance.date)
            return date >= sqlDate(bounds.gte) && date < sqlDate(bounds.lt)
          }
          return fixtures.filter(employee => where.OR.some(condition =>
            condition.isActive === employee.isActive ||
            (condition.attendances && employee.attendances.some(a => matches(a, condition.attendances.some.date)))
          )).map(employee => ({ ...employee,
            attendances: employee.attendances.filter(a => matches(a, include.attendances.where.date)),
          }))
        } } } },
      })
      for (const format of ['csv', 'excel']) {
        const response = await route.GET(request(`/api/kintai/attendance/export?year=${year}&month=${month}&format=${format}`))
        assert.equal(response.status, 200)
        const body = format === 'csv' ? await response.text() : JSON.stringify((await new ExcelJS.Workbook().xlsx.load(Buffer.from(await response.arrayBuffer()))).getWorksheet(1).getSheetValues())
        assert(body.includes(first), `${format} must include retired employee on first day`)
        assert(body.includes(last), `${format} must include retired employee on last day`)
        assert(!body.includes(previous), `${format} must exclude previous month`)
        assert(!body.includes(next), `${format} must exclude next month`)
      }
      const now = Date.parse(last + 'T00:15:00+09:00')
      class FixedDate extends Date {
        constructor(...args) { super(...(args.length ? args : [now])) }
        static now() { return now }
      }
      const readMocks = {
        ...mocks,
        '@/lib/prisma': { prisma: {
          kintaiAttendance: { findMany: async ({ where }) => {
            assert.equal(where.employeeId, 'employee')
            const start = where.date.gte.toISOString().slice(0, 10)
            const end = where.date.lt.toISOString().slice(0, 10)
            return fixtures.flatMap(e => e.attendances).filter(a => {
              const date = a.date.toISOString().slice(0, 10)
              return date >= start && date < end
            })
          } },
          kintaiClockRecord: { findMany: async ({ where }) => {
            assert.equal(where.timestamp.gte.toISOString(), new Date(Date.parse(last + 'T00:00:00+09:00') - 86400000).toISOString(),
              'clock timestamp range must retain JST midnight and overnight carryover')
            return []
          } },
          kintaiRequest: { findMany: async () => [] },
          kintaiEmployee: { findUnique: async () => ({ name: 'synthetic' }) },
        } },
        '@/lib/kintai/format': { getClockStatusFromRecords: () => 'not_clocked_in' },
        '@/lib/kintai/shift-records': { recordsWithCarryover: records => records },
      }
      for (const implicit of [false, true]) {
        const attendance = load('src/app/api/kintai/attendance/route.ts', readMocks, { Date: FixedDate })
        const response = await attendance.GET(request('/api/kintai/attendance' +
          (implicit ? '' : `?month=${year}-${String(month).padStart(2, '0')}`)))
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.deepEqual(body.attendances.map(a => a.date.slice(0, 10)), [first, last])
        assert.equal(body.summary.totalWorkMinutes, 3)
      }
      const dashboard = load('src/app/api/kintai/dashboard/route.ts', readMocks, { Date: FixedDate })
      const response = await dashboard.GET()
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.monthlySummary.totalWorkMinutes, 3)
      assert.equal(body.todayAttendance.date.slice(0, 10), last,
        'today attendance must remain visible on the last JST day, including just after midnight')
    }
  })
  await check('Excel authorization rejects absent or lower privilege before employee reads', async () => {
    for (const role of [null, 'employee', 'manager']) {
      const before = reads
      const route = loadExcelExport('src/app/api/kintai/attendance/export/route.ts', {
        ...mocks, '@/lib/kintai/access': {
          getKintaiContext: async () => role === null ? null : ({ organizationId: 'org', role }),
          hasMinRole: () => false,
        },
      })
      const response = await route.GET(request('/api/kintai/attendance/export?year=2026&month=9&format=excel'))
      assert.equal(response.status, 403); assert.equal(reads, before)
    }
  })
  await check('Excel empty organization retains only the ten headers', async () => {
    const route = loadExcelExport('src/app/api/kintai/attendance/export/route.ts', {
      ...mocks, '@/lib/prisma': { prisma: { kintaiEmployee: { findMany: async () => [] } } },
    })
    const response = await route.GET(request('/api/kintai/attendance/export?year=2026&month=9&format=excel'))
    assert.equal(response.status, 200)
    const sheet = (await new ExcelJS.Workbook().xlsx.load(Buffer.from(await response.arrayBuffer()))).getWorksheet(1)
    assert.equal(sheet.rowCount, 1); assert.equal(sheet.columnCount, 10)
    assert.equal(sheet.getCell('A1').value, '従業員名'); assert.equal(sheet.getCell('J1').value, 'ステータス')
  })
  await check('Excel keeps calendar dates and formats real instants in JST', async () => {
    const route = loadExcelExport('src/app/api/kintai/attendance/export/route.ts', {
      ...mocks, '@/lib/prisma': { prisma: { kintaiEmployee: { findMany: async () => [{
        name: '合成の時刻検証', department: null, attendances: [{ date: new Date('2024-02-29T00:00:00Z'),
          clockIn: new Date('2024-02-28T15:05:00Z'), clockOut: new Date('2024-02-29T09:30:00Z'),
          workMinutes: 1105, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'normal' }],
      }] } } },
    })
    const response = await route.GET(request('/api/kintai/attendance/export?year=2024&month=2&format=excel'))
    assert.equal(response.status, 200)
    const sheet = (await new ExcelJS.Workbook().xlsx.load(Buffer.from(await response.arrayBuffer()))).getWorksheet('2024年2月')
    assert.equal(sheet.getCell('C2').value, '2024/2/29')
    assert.equal(sheet.getCell('D2').value, '00:05'); assert.equal(sheet.getCell('E2').value, '18:30')
    assert.equal(sheet.getCell('F2').value, 1105)
  })
  await check('Excel serialization failure returns a redacted JSON error', async () => {
    const route = loadExcelExport('src/app/api/kintai/attendance/export/route.ts', {
      ...mocks, exceljs: { Workbook: class { addWorksheet() { throw Error('SYNTHETIC_PRIVATE_EXPORT_DETAIL') } } },
    })
    const response = await route.GET(request('/api/kintai/attendance/export?year=2026&month=9&format=excel'))
    assert.equal(response.status, 500)
    assert.equal(JSON.stringify(await response.json()).includes('SYNTHETIC_PRIVATE_EXPORT_DETAIL'), false)
  })
  await check('invalid months, years and formats fail before querying employee data', async () => {
    const before = reads
    for (const path of [
      '/api/kintai/attendance/export?year=2026abc&month=9',
      '/api/kintai/attendance/export?year=2026&month=13',
      '/api/kintai/attendance/export?year=2026&month=9&format=pdf',
    ]) assert.equal((await exportRoute.GET(request(path))).status, 400)
    assert.equal(reads, before)
    assert.equal((await attendanceRoute.GET(request('/api/kintai/attendance?month=2026-13'))).status, 400)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
