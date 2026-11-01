const assert = require('node:assert/strict')
const ExcelJS = require('exceljs')
const JSZip = require('jszip')
const { JSDOM } = require('jsdom')
const browser = new JSDOM('')
const sheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const decodeXstring = value => value.replace(/_x([0-9A-Fa-f]{4})_/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
const { load, check } = require('./load-typescript.cjs')
const loadExcelExport = require('./load-excel-export.cjs')
const fixtures = [
  ['normal', '日本語 & <tag> "quote" 🚀', '日本語 & <tag> "quote" 🚀'],
  ['controls', 'Before\u0000\u0001\u000b\u001fAfter', 'BeforeAfter'],
  ['noncharacters', 'Before\ufffe\uffffAfter', 'BeforeAfter'],
  ['supplementary', '日本語\u{10000}🚀', '日本語\u{10000}🚀'],
  ['whitespace', 'A\tB\nC\rD', 'A\tB\nC\nD'],
  ['formula-like text', '\t=SUM(1,2)', '\t=SUM(1,2)'],
  ['literal OOXML escapes', '_x0041_ _x005F_ _x000D_ _x00af_ _x005F_x0041_', '_x0041_ _x005F_ _x000D_ _x00af_ _x005F_x0041_'],
  ['DEL character', 'Before\u007fAfter', 'Before\u007fAfter'],
]
function routes(value) {
  const kintai = loadExcelExport('src/app/api/kintai/attendance/export/route.ts', {
    exceljs: ExcelJS,
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
  const xlsx = load('src/lib/doyalist/export-xlsx.ts', { archiver: require('archiver'), 'node:stream': require('node:stream'), './export-stream': stream })
  const doyalist = load('src/app/api/doyalist/export/route.ts', {
    'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/doyalist/export-stream': stream, '@/lib/doyalist/export-xlsx': xlsx, 'node:stream': require('node:stream'),
  })
  return { kintai, doyalist }
}
;(async () => {
  for (const [name, value, expected] of fixtures) {
    const handlers = routes(value)
    for (const service of ['kintai', 'doyalist']) await check(`Spreadsheet text safety: ${service} ${name}`, async () => {
      const query = service === 'kintai' ? 'year=2026&month=10' : 'projectId=p'
      const response = await handlers[service].GET(new Request(`https://local.invalid/api/${service}/export?${query}&format=excel`))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      if (service === 'kintai') {
        const bytes = Buffer.from(await response.arrayBuffer())
        const book = await new ExcelJS.Workbook().xlsx.load(bytes)
        const sheet = book.getWorksheet('2026年10月')
        const textExpected = name === 'whitespace' ? value : expected
        assert.equal(sheet.rowCount, 3); assert.equal(sheet.columnCount, 10)
        assert.equal(sheet.getCell('A2').value, textExpected); assert.equal(sheet.getCell('B2').value, 'Dept ' + textExpected)
        assert.equal(sheet.getCell('A3').value, 'Empty ' + textExpected); assert.equal(sheet.getCell('B3').value, textExpected)
        assert.equal(sheet.getCell('F2').value, 0); assert.equal(sheet.getCell('J2').value, 'normal'); assert.equal(sheet.getCell('J3').value, 'データなし')
        sheet.eachRow(row => row.eachCell(cell => assert.notEqual(cell.type, ExcelJS.ValueType.Formula)))
        if (process.env.DOYA_KINTAI_TEXT_ARTIFACT_DIR && ['literal OOXML escapes', 'DEL character'].includes(name)) {
          const fs = require('node:fs'), path = require('node:path')
          fs.writeFileSync(path.join(process.env.DOYA_KINTAI_TEXT_ARTIFACT_DIR, name === 'DEL character' ? 'kintai-xlsx-del-20261101.xlsx' : 'kintai-xlsx-literal-escapes-20261101.xlsx'), bytes)
        }
      } else {
        assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()))
        const documents = await Promise.all(['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'].map(async path => {
          const doc = new browser.window.DOMParser().parseFromString(await zip.file(path).async('string'), 'application/xml')
          assert.equal(doc.getElementsByTagName('parsererror').length, 0)
          return doc
        }))
        const cells = documents.map(doc => Object.fromEntries(Array.from(doc.getElementsByTagNameNS(sheetNs, 'c')).map(cell => {
          assert.equal(cell.getAttribute('t'), 'inlineStr')
          assert.equal(cell.getElementsByTagNameNS(sheetNs, 'f').length, 0)
          return [cell.getAttribute('r'), decodeXstring(cell.textContent)]
        })))
        assert.equal(Object.keys(cells[0]).length, 26); assert.equal(Object.keys(cells[1]).length, 14)
        const textExpected = name === 'whitespace' ? value : expected
        for (const address of ['B2','D2','K2']) assert.equal(cells[0][address], textExpected)
        for (const address of ['D2','E2']) assert.equal(cells[1][address], textExpected)
        if (name === 'noncharacters') assert((await zip.file('xl/workbook.xml').async('string')).includes('Audit BeforeAfter_企業'))
      }
      const csvResponse = await handlers[service].GET(new Request(`https://local.invalid/api/${service}/export?${query}&format=csv`))
      assert.equal(csvResponse.status, 200)
      if (name === 'noncharacters') assert((await csvResponse.text()).includes(value), 'XML-only cleanup must not remove valid Unicode from CSV data')
      else if (['literal OOXML escapes', 'DEL character', 'whitespace'].includes(name)) assert((await csvResponse.text()).includes(value), 'XLSX escaping must not change the original CSV text')
      else await csvResponse.body.cancel()
    })
  }
  browser.window.close()
})().catch(error => { browser.window.close(); console.error(error); process.exitCode = 1 })
