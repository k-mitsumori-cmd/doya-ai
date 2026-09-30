const assert = require('node:assert/strict')
const { XMLValidator, XMLParser } = require('fast-xml-parser')
const { load, check } = require('./load-typescript.cjs')

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
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/kintai/access': {
    getKintaiContext: async () => ({ organizationId: 'org', employeeId: 'employee', role: 'hr_admin' }),
    hasMinRole: (role, minimum) => ranks[role] >= ranks[minimum],
  },
}
const exportRoute = load('src/app/api/kintai/attendance/export/route.ts', mocks)
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
    assert.equal(range.gte.toISOString(), '2026-08-31T15:00:00.000Z')
    assert.equal(range.lt.toISOString(), '2026-09-30T15:00:00.000Z')
  })
  await check('Excel XML escapes employee text and remains parseable', async () => {
    const response = await exportRoute.GET(request('/api/kintai/attendance/export?year=2026&month=09&format=excel'))
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Cache-Control'), /no-store/)
    const xml = await response.text()
    assert.equal(XMLValidator.validate(xml), true)
    assert(xml.includes('A,&quot;B&quot;'))
    assert(xml.includes('C &amp; &lt;D&gt;'))
    assert(xml.includes('開発 &amp; 営業'))
    const parsed = new XMLParser().parse(xml)
    const rows = parsed.Workbook.Worksheet.Table.Row
    assert.equal(rows.length, 5)
    assert(rows.every(row => row.Cell.length === 10), 'Excel rows must align with the ten column headers')
    const values = rows.map(row => row.Cell.map(cell => cell.Data))
    assert(values.some(row => row[0] === '休暇なし' && row[9] === 'データなし'))
    assert(values.some(row => row[0] === '退職済み' && row[7] === 7 && row[8] === 11))
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
