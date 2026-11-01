const assert = require('node:assert/strict')
const ExcelJS = require('exceljs')
const JSZip = require('jszip')
const { load, check } = require('./load-typescript.cjs')

const projectName = "'[長いプロジェクト名]/\\?*:" + 'Ａ'.repeat(40) + "'"
let companyRows = [{ id: 'c', name: '企業 & <テスト>\u0001',
  createdAt: new Date('2026-09-30T00:00:00Z'), enrichedData: {} }]
let approachRows = [{ id: 'approach-1', companyId: 'c', type: 'email', subject: '合成の件名', body: '合成の本文', status: 'new', createdAt: new Date('2026-09-30T00:00:00Z') }]
let largestPage = 0
let reads = 0
let userId = 'owner'
let failFirstPage = false
let failContinuation = false
let continuationKind = 'all'
function page(rows, query) {
  if (failFirstPage || (failContinuation && query.cursor && (continuationKind === 'all' || continuationKind === (rows === approachRows ? 'approach' : 'company')))) throw Error('DATABASE_URL=private')
  reads++
  largestPage = Math.max(largestPage, query.take)
  assert(query.take <= 200, 'database reads must stay bounded')
  const offset = query.cursor ? rows.findIndex(row => row.id === query.cursor.id) + 1 : 0
  return rows.slice(offset, offset + query.take)
}
const prisma = {
  doyalistProject: { findUnique: async () => ({ id: 'p', userId: 'owner', name: projectName }) },
  doyalistCompany: { findMany: async query => page(companyRows, query) },
  doyalistApproach: { findMany: async query => page(approachRows, query) },
}
const csv = load('src/lib/doyalist/export-csv.ts')
const stream = load('src/lib/doyalist/export-stream.ts', {
  '@/lib/prisma': { prisma }, '@/lib/doyalist/export-csv': csv,
})
const xlsx = load('src/lib/doyalist/export-xlsx.ts', { archiver: require('archiver'), 'node:stream': require('node:stream'), './export-stream': stream })
const route = load('src/app/api/doyalist/export/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => userId ? ({ user: { id: userId } }) : null },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
  '@/lib/doyalist/export-stream': stream, '@/lib/doyalist/export-xlsx': xlsx,
  'node:stream': require('node:stream'),
})

;(async () => {
  await check('Excel export uses valid sheet names and escapes the actual data', async () => {
    const response = await route.GET({ url: 'https://local.test/api/doyalist/export?projectId=p&format=excel' })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    assert(response.headers.get('content-disposition').endsWith('.xlsx'))
    const bytes = Buffer.from(await response.arrayBuffer())
    if (process.env.DOYA_DOYALIST_XLSX_ARTIFACT_DIR) require('node:fs').writeFileSync(require('node:path').join(process.env.DOYA_DOYALIST_XLSX_ARTIFACT_DIR, 'doyalist-xlsx-native-synthetic-20261101.xlsx'), bytes)
    const workbook = await new ExcelJS.Workbook().xlsx.load(bytes)
    assert.equal(workbook.worksheets.length, 2)
    const sheet = workbook.worksheets[0], name = sheet.name
    assert.equal(sheet.getCell('B2').value, '企業 & <テスト>')
    assert.equal(sheet.columnCount, 13); assert.equal(sheet.rowCount, 2)
    assert.equal(workbook.worksheets[1].columnCount, 7); assert.equal(workbook.worksheets[1].rowCount, 2)
    assert(name.endsWith('_企業') && name.length <= 31)
    assert(!/[\/\\?*:\[\]]/.test(name))
    assert(!name.startsWith("'") && !name.endsWith("'"))
  })
  await check('CSV and Excel stream every row beyond the buffered response limit', async () => {
    companyRows = Array.from({ length: 5001 }, (_, index) => ({
      id: `company-${index}`, name: `企業${index}`,
      description: `${index}-` + '事業内容'.repeat(180),
      createdAt: new Date('2026-09-30T00:00:00Z'), enrichedData: {},
    }))
    approachRows = Array.from({ length: 201 }, (_, index) => ({
      id: `approach-${index}`, type: 'email', body: `本文${index}`,
      status: 'new', createdAt: new Date('2026-09-30T00:00:00Z'),
    }))
    for (const format of ['csv', 'excel']) {
      const response = await route.GET({ url: `https://local.test/api/doyalist/export?projectId=p&format=${format}` })
      assert.equal(response.status, 200)
      if (format === 'csv') {
        const body = await response.text()
        assert(Buffer.byteLength(body) > 4.5 * 1024 * 1024)
        assert(body.includes('企業5000')); assert(body.includes('approach-200'))
      } else {
        const bytes = Buffer.from(await response.arrayBuffer())
        const zip = await JSZip.loadAsync(bytes)
        assert(Buffer.byteLength(await zip.file('xl/worksheets/sheet1.xml').async('string')) > 4.5 * 1024 * 1024)
        const book = await new ExcelJS.Workbook().xlsx.load(bytes)
        assert.equal(book.worksheets[0].rowCount, 5002)
        assert.equal(book.worksheets[1].rowCount, 202)
        for (let i = 0; i < 5001; i++) assert.equal(book.worksheets[0].getCell(`B${i + 2}`).value, `企業${i}`)
        for (let i = 0; i < 201; i++) assert.equal(book.worksheets[1].getCell(`A${i + 2}`).value, `approach-${i}`)
      }
    }
    assert.equal(largestPage, 200)
  })
  await check('XLSX ownership and input checks run before company and approach reads', async () => {
    const before = reads
    userId = null
    assert.equal((await route.GET(new Request('https://local.test/api/doyalist/export?projectId=p&format=excel'))).status, 401)
    userId = 'other'
    assert.equal((await route.GET(new Request('https://local.test/api/doyalist/export?projectId=p&format=excel'))).status, 403)
    userId = 'owner'
    for (const query of ['format=excel','projectId=p&format=bad']) assert.equal((await route.GET(new Request('https://local.test/api/doyalist/export?'+query))).status, 400)
    assert.equal(reads, before)
  })
  await check('XLSX slow consumers do not eagerly read every database page', async () => {
    const crypto = require('node:crypto')
    companyRows = Array.from({ length: 10000 }, (_, i) => ({ id: `c-${i}`, name: `Company ${i}`, description: Array.from({length: 16}, (_, j) => crypto.createHash('sha256').update(`${i}:${j}`).digest('hex')).join(''), createdAt: new Date('2026-10-01T00:00:00Z'), enrichedData: {} }))
    approachRows = []
    const before = reads
    const response = await route.GET(new Request('https://local.test/api/doyalist/export?projectId=p&format=excel'))
    await new Promise(resolve => setTimeout(resolve, 1000))
    const pausedReads = reads - before
    assert(pausedReads < 20, `paused XLSX paginated ${pausedReads} times`)
    assert(pausedReads >= 2)
    const book = await new ExcelJS.Workbook().xlsx.load(Buffer.from(await response.arrayBuffer()))
    assert.equal(book.worksheets[0].rowCount, 10001)
    for (let i = 0; i < 10000; i++) {
      assert.equal(book.worksheets[0].getCell(`B${i+2}`).value, companyRows[i].name)
      assert.equal(book.worksheets[0].getCell(`K${i+2}`).value, companyRows[i].description)
    }
    console.log(JSON.stringify({ kind: 'doyalist-xlsx-backpressure', pausedMs: 1000, pausedPageReads: pausedReads, companyRows: 10000, allNamesAndDescriptionsMatched: true }))
  })
  await check('XLSX cancellation stops pagination for response and request aborts', async () => {
    for (const kind of ['reader', 'request']) {
      const controller = new AbortController()
      const response = await route.GET(new Request('https://local.test/api/doyalist/export?projectId=p&format=excel', { signal: controller.signal }))
      const reader = response.body.getReader()
      await reader.read()
      if (kind === 'reader') await reader.cancel()
      else { controller.abort(); await assert.rejects(async () => { while (!(await reader.read()).done) {} }) }
      await new Promise(resolve => setTimeout(resolve, 50))
      const after = reads
      await new Promise(resolve => setTimeout(resolve, 100))
      assert.equal(reads, after, `pagination continued after ${kind} cancellation`)
    }
  })
  await check('XLSX initial failures are redacted and continuation failures reject the download', async () => {
    failFirstPage = true
    const initial = await route.GET(new Request('https://local.test/api/doyalist/export?projectId=p&format=excel'))
    assert.equal(initial.status, 500); assert(!JSON.stringify(await initial.json()).includes('DATABASE_URL'))
    failFirstPage = false; failContinuation = true
    approachRows = Array.from({length: 201}, (_, i) => ({id: `a-${i}`, type: 'email', body: 'Body', status: 'new', createdAt: new Date()}))
    for (continuationKind of ['company', 'approach']) {
      const partial = await route.GET(new Request('https://local.test/api/doyalist/export?projectId=p&format=excel'))
      assert.equal(partial.status, 200)
      await assert.rejects(partial.arrayBuffer(), {message: 'Doyalist export failed'})
    }
    continuationKind = 'all'
    failContinuation = false
  })
  await check('XLSX empty projects retain both header-only worksheets', async () => {
    companyRows = []; approachRows = []
    const response = await route.GET(new Request('https://local.test/api/doyalist/export?projectId=p&format=excel'))
    const book = await new ExcelJS.Workbook().xlsx.load(Buffer.from(await response.arrayBuffer()))
    assert.deepEqual(book.worksheets.map(sheet => [sheet.rowCount, sheet.columnCount]), [[1,13],[1,7]])
    companyRows = Array.from({length: 201}, (_, i) => ({id: `c-${i}`, name: 'Name', createdAt: new Date(), enrichedData: {}}))
  })
  await check('export reports initial database failure and aborts incomplete streams', async () => {
    failFirstPage = true
    const initial = await route.GET({ url: 'https://local.test/api/doyalist/export?projectId=p&format=csv' })
    assert.equal(initial.status, 500)
    assert(!JSON.stringify(await initial.json()).includes('DATABASE_URL'))
    failFirstPage = false
    failContinuation = true
    const partial = await route.GET({ url: 'https://local.test/api/doyalist/export?projectId=p&format=csv' })
    assert.equal(partial.status, 200)
    await assert.rejects(partial.text())
    failContinuation = false
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
