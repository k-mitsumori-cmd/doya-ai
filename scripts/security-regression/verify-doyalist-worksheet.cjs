const assert = require('node:assert/strict')
const { XMLValidator, XMLParser } = require('fast-xml-parser')
const { load, check } = require('./load-typescript.cjs')

const projectName = "'[長いプロジェクト名]/\\?*:" + 'Ａ'.repeat(40) + "'"
let companyRows = [{ id: 'c', name: '企業 & <テスト>\u0001',
  createdAt: new Date('2026-09-30T00:00:00Z'), enrichedData: {} }]
let approachRows = []
let largestPage = 0
let failFirstPage = false
let failContinuation = false
function page(rows, query) {
  if (failFirstPage || (failContinuation && query.cursor)) throw Error('DATABASE_URL=private')
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
const route = load('src/app/api/doyalist/export/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
  '@/lib/doyalist/export-stream': stream,
  'node:stream': require('node:stream'),
})

;(async () => {
  await check('Excel export uses valid sheet names and escapes the actual data', async () => {
    const response = await route.GET({ url: 'https://local.test/api/doyalist/export?projectId=p&format=excel' })
    assert.equal(response.status, 200)
    const xml = await response.text()
    assert.equal(XMLValidator.validate(xml), true)
    assert(xml.includes('企業 &amp; &lt;テスト&gt;'))
    assert(!xml.includes('\u0001'))
    const workbook = new XMLParser({ ignoreAttributes: false }).parse(xml).Workbook
    const sheets = workbook.Worksheet
    assert.equal(sheets.length, 2)
    const name = sheets[0]['@_ss:Name']
    assert(name.endsWith('_企業'))
    assert(name.length <= 31)
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
      const body = await response.text()
      assert(Buffer.byteLength(body) > 4.5 * 1024 * 1024, `${format} must cross the former buffered response cap`)
      assert(body.includes('企業5000'), `${format} lost the last company`)
      assert(body.includes('approach-200'), `${format} lost the last approach`)
    }
    assert.equal(largestPage, 200)
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
