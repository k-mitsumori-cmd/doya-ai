const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { load, check } = require('./load-typescript.cjs')
const ns = 'urn:schemas-microsoft-com:office:spreadsheet'
const browser = new JSDOM('')
const fixtures = [
  ['normal', '日本語 & <tag> "quote" 🚀', '日本語 & <tag> "quote" 🚀'],
  ['controls', 'Before\u0000\u0001\u000b\u001fAfter', 'BeforeAfter'],
  ['noncharacters', 'Before\ufffe\uffffAfter', 'BeforeAfter'],
  ['supplementary', '日本語\u{10000}🚀', '日本語\u{10000}🚀'],
  ['whitespace', 'A\tB\nC\rD', 'A\tB\nC\nD'],
  ['formula-like text', '\t=SUM(1,2)', '\t=SUM(1,2)'],
]
function routes(value) {
  const kintai = load('src/app/api/kintai/attendance/export/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/kintai/access': { getKintaiContext: async () => ({ organizationId: 'org', role: 'hr_admin' }), hasMinRole: (role, minimum) => { assert.equal(role, 'hr_admin'); assert.equal(minimum, 'hr_admin'); return true } },
    '@/lib/prisma': { prisma: { kintaiEmployee: { findMany: async () => [
      { name: value, department: { name: 'Dept ' + value }, attendances: [{ date: new Date('2026-10-01T00:00:00Z'), clockIn: null, clockOut: null, workMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'normal' }] },
      { name: 'Empty ' + value, department: { name: value }, attendances: [] },
    ] } } },
  })
  const prisma = {
    doyalistProject: { findUnique: async () => ({ id: 'p', userId: 'owner', name: 'Audit ' + value }) },
    doyalistCompany: { findMany: async () => [{ id: 'c', name: value, description: value, createdAt: new Date('2026-10-01T00:00:00Z'), enrichedData: { address: value } }] },
    doyalistApproach: { findMany: async () => [{ id: 'a', companyId: 'c', type: 'email', subject: value, body: value, status: 'new', createdAt: new Date('2026-10-01T00:00:00Z') }] },
  }
  const csv = load('src/lib/doyalist/export-csv.ts')
  const stream = load('src/lib/doyalist/export-stream.ts', { '@/lib/prisma': { prisma }, '@/lib/doyalist/export-csv': csv })
  const doyalist = load('src/app/api/doyalist/export/route.ts', {
    'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/doyalist/export-stream': stream, 'node:stream': require('node:stream'),
  })
  return { kintai, doyalist }
}
const tableRows = table => Array.from(table.getElementsByTagNameNS(ns, 'Row')).map(row =>
  Array.from(row.getElementsByTagNameNS(ns, 'Cell')).map(cell => cell.getElementsByTagNameNS(ns, 'Data')[0].textContent))
;(async () => {
  for (const [name, value, expected] of fixtures) {
    const handlers = routes(value)
    for (const service of ['kintai', 'doyalist']) await check(`Spreadsheet XML10: ${service} ${name}`, async () => {
      const query = service === 'kintai' ? 'year=2026&month=10' : 'projectId=p'
      const response = await handlers[service].GET(new Request(`https://local.invalid/api/${service}/export?${query}&format=excel`))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      const xml = new browser.window.DOMParser().parseFromString(await response.text(), 'application/xml')
      assert.equal(xml.getElementsByTagName('parsererror').length, 0, 'successful response must be well-formed XML 1.0')
      const tables = xml.getElementsByTagNameNS(ns, 'Table')
      const first = tableRows(tables[0])
      if (service === 'kintai') {
        assert(first.every(row => row.length === 10))
        assert.equal(first[1][0], expected); assert.equal(first[1][1], 'Dept ' + expected)
        assert.equal(first[2][0], 'Empty ' + expected); assert.equal(first[2][1], expected)
        assert.equal(first[1][5], '0'); assert.equal(first[1][9], 'normal'); assert.equal(first[2][9], 'データなし')
      } else {
        assert(first.every(row => row.length === 13))
        assert.equal(first[1][1], expected); assert.equal(first[1][3], expected); assert.equal(first[1][10], expected)
        const approaches = tableRows(tables[1]); assert(approaches.every(row => row.length === 7))
        assert.equal(approaches[1][3], expected); assert.equal(approaches[1][4], expected)
        if (name === 'noncharacters') assert.equal(xml.getElementsByTagNameNS(ns, 'Worksheet')[0].getAttributeNS(ns, 'Name'), 'Audit BeforeAfter_企業')
      }
      for (const cell of xml.getElementsByTagNameNS(ns, 'Cell')) assert.equal(cell.hasAttributeNS(ns, 'Formula'), false)
      if (name === 'formula-like text') {
        const data = xml.getElementsByTagNameNS(ns, 'Data')
        assert(Array.from(data).filter(node => node.textContent.includes('=SUM')).every(node => node.getAttributeNS(ns, 'Type') === 'String'))
      }
      const csvResponse = await handlers[service].GET(new Request(`https://local.invalid/api/${service}/export?${query}&format=csv`))
      assert.equal(csvResponse.status, 200)
      if (name === 'noncharacters') assert((await csvResponse.text()).includes(value), 'XML-only cleanup must not remove valid Unicode from CSV data')
      else await csvResponse.body.cancel()
    })
  }
  browser.window.close()
})().catch(error => { browser.window.close(); console.error(error); process.exitCode = 1 })
