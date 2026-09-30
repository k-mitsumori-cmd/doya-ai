const assert = require('node:assert/strict')
const { XMLValidator, XMLParser } = require('fast-xml-parser')
const { load, check } = require('./load-typescript.cjs')

const projectName = "'[長いプロジェクト名]/\\?*:" + 'Ａ'.repeat(40) + "'"
const prisma = {
  doyalistProject: { findUnique: async () => ({ id: 'p', userId: 'owner', name: projectName }) },
  doyalistCompany: { findMany: async () => [{ id: 'c', name: '企業 & <テスト>\u0001',
    createdAt: new Date('2026-09-30T00:00:00Z'), enrichedData: {} }] },
  doyalistApproach: { findMany: async () => [] },
}
const route = load('src/app/api/doyalist/export/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
  '@/lib/doyalist/export-csv': { buildDoyalistCsv: () => '' },
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
})().catch(error => { console.error(error); process.exitCode = 1 })
