export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Readable } from 'node:stream'
import {
  type DoyalistExportFirstPage,
  encodeDoyalistExport,
  iterateDoyalistApproaches,
  iterateDoyalistCompanies,
  iterateDoyalistCsv,
  preflightDoyalistExport,
} from '@/lib/doyalist/export-stream'

function xmlEscape(value: any): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function worksheetName(projectName: string): string {
  const cleaned = String(projectName || '').replace(/[\/\\?*:\[\]\u0000-\u001F]/g, '_')
    .trim().replace(/^'+|'+$/g, '').trim() || 'プロジェクト'
  let prefix = ''
  for (const character of cleaned) {
    if (prefix.length + character.length > 28) break
    prefix += character
  }
  return `${prefix}_企業`
}

function cell(v: any): string {
  if (v === null || v === undefined || v === '') {
    return '<Cell><Data ss:Type="String"></Data></Cell>'
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`
}

const companyHeaders = [
    '法人番号',
    '企業名',
    '業種',
    '所在地',
    '都道府県',
    '代表者',
    '従業員数',
    '資本金',
    '設立年',
    'ウェブサイト',
    '事業概要',
    '取得元',
    '作成日',
]
const approachHeaders = [
    'アプローチID',
    '企業ID',
    'タイプ',
    '件名',
    '本文',
    'ステータス',
    '作成日',
]

function companyXmlRow(c: any): string {
  const ed = (c.enrichedData as any) || {}
  const cells = [
        cell(ed.corporateNumber || ''),
        cell(c.name),
        cell(c.industry || ed.industry || ''),
        cell(ed.address || c.region || ''),
        cell(ed.prefecture || ''),
        cell(ed.representative || c.contactPerson || ''),
        cell(ed.employeeCount || c.size || ''),
        cell(ed.capital || ''),
        cell(ed.foundedYear || ''),
        cell(c.website || ''),
        cell(ed.businessSummary || c.description || ''),
        cell(c.source || ''),
        cell(c.createdAt instanceof Date ? c.createdAt.toISOString().slice(0, 10) : String(c.createdAt).slice(0, 10)),
  ]
  return `<Row>${cells.join('')}</Row>`
}

function approachXmlRow(a: any): string {
  const cells = [
        cell(a.id),
        cell(a.companyId || ''),
        cell(a.type),
        cell(a.subject || ''),
        cell(a.body || ''),
        cell(a.status),
        cell(a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt),
  ]
  return `<Row>${cells.join('')}</Row>`
}

function header(labels: string[]): string {
  return `<Row>${labels.map(cell).join('')}</Row>`
}

async function* iterateXlsXml(projectName: string, projectId: string, firstPage: DoyalistExportFirstPage): AsyncGenerator<string> {
  yield `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${xmlEscape(worksheetName(projectName))}">
  <Table>
   ${header(companyHeaders)}\n`
  for await (const company of iterateDoyalistCompanies(projectId, firstPage.companies)) {
    yield `${companyXmlRow(company)}\n`
  }
  yield `  </Table>
 </Worksheet>
 <Worksheet ss:Name="アプローチ">
  <Table>
   ${header(approachHeaders)}\n`
  for await (const approach of iterateDoyalistApproaches(projectId, firstPage.approaches)) {
    yield `${approachXmlRow(approach)}\n`
  }
  yield `
  </Table>
 </Worksheet>
</Workbook>`
}

/**
 * GET /api/doyalist/export?projectId=xxx&format=csv|excel
 * 企業＋アプローチをCSV(UTF-8 BOM)またはExcel XML SpreadSheet 2003でエクスポート
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const format = (searchParams.get('format') || 'csv').toLowerCase()

    if (!projectId) {
      return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })
    }
    if (format !== 'csv' && format !== 'excel') {
      return NextResponse.json(
        { error: 'formatはcsvまたはexcelを指定してください' },
        { status: 400 }
      )
    }

    const project = await prisma.doyalistProject.findUnique({
      where: { id: projectId },
    })
    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })
    }

    // Fail with a normal 500 response if the database is already unavailable.
    const firstPage = await preflightDoyalistExport(projectId)
    const safeName = (project.name || 'doyalist').replace(/[\\/:*?"<>|]/g, '_')

    if (format === 'csv') {
      const body = Readable.toWeb(Readable.from(encodeDoyalistExport(iterateDoyalistCsv(projectId, firstPage)))) as ReadableStream
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
            safeName
          )}.csv`,
        },
      })
    }

    // excel (XML SpreadSheet 2003)
    const body = Readable.toWeb(Readable.from(encodeDoyalistExport(iterateXlsXml(project.name, projectId, firstPage)))) as ReadableStream
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
          safeName
        )}.xls`,
      },
    })
  } catch {
    console.error('[doyalist/export][GET] failed')
    return NextResponse.json(
      { error: 'エクスポートに失敗しました' },
      { status: 500 }
    )
  }
}
