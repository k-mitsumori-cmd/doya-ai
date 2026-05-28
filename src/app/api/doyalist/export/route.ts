export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function csvEscape(value: any): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // CSV式インジェクション対策: =/+/-/@/タブ/改行で始まる値の先頭にシングルクォート付与
  // Excel/LibreOffice等が数式として実行するのを防ぐ
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function xmlEscape(value: any): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildCsv(companies: any[], approaches: any[]): string {
  const BOM = '﻿'
  const lines: string[] = []

  // 企業セクション
  lines.push('# 企業一覧')
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
  lines.push(companyHeaders.map(csvEscape).join(','))
  for (const c of companies) {
    const ed = (c.enrichedData as any) || {}
    lines.push(
      [
        ed.corporateNumber || '',
        c.name,
        c.industry || ed.industry || '',
        ed.address || c.region || '',
        ed.prefecture || '',
        ed.representative || c.contactPerson || '',
        ed.employeeCount || c.size || '',
        ed.capital || '',
        ed.foundedYear || '',
        c.website || '',
        ed.businessSummary || c.description || '',
        c.source || '',
        c.createdAt instanceof Date ? c.createdAt.toISOString().slice(0, 10) : String(c.createdAt).slice(0, 10),
      ]
        .map(csvEscape)
        .join(',')
    )
  }

  // アプローチセクション
  lines.push('')
  lines.push('# アプローチ一覧')
  const approachHeaders = [
    'アプローチID',
    '企業ID',
    'タイプ',
    '件名',
    '本文',
    'ステータス',
    '作成日',
  ]
  lines.push(approachHeaders.map(csvEscape).join(','))
  for (const a of approaches) {
    lines.push(
      [
        a.id,
        a.companyId || '',
        a.type,
        a.subject || '',
        a.body || '',
        a.status,
        a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
      ]
        .map(csvEscape)
        .join(',')
    )
  }

  return BOM + lines.join('\r\n')
}

function buildXlsXml(
  project: any,
  companies: any[],
  approaches: any[]
): string {
  const cell = (v: any, type: 'String' | 'Number' = 'String') => {
    if (v === null || v === undefined || v === '') {
      return '<Cell><Data ss:Type="String"></Data></Cell>'
    }
    if (type === 'Number') {
      return `<Cell><Data ss:Type="Number">${xmlEscape(v)}</Data></Cell>`
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

  const companyRows = companies
    .map((c) => {
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
    })
    .join('')

  const approachRows = approaches
    .map((a) => {
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
    })
    .join('')

  const header = (labels: string[]) =>
    `<Row>${labels.map((l) => cell(l)).join('')}</Row>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${xmlEscape(project.name)}_企業">
  <Table>
   ${header(companyHeaders)}
   ${companyRows}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="アプローチ">
  <Table>
   ${header(approachHeaders)}
   ${approachRows}
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

    const [companies, approaches] = await Promise.all([
      prisma.doyalistCompany.findMany({
        where: { projectId },
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.doyalistApproach.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const safeName = (project.name || 'doyalist').replace(/[\\/:*?"<>|]/g, '_')

    if (format === 'csv') {
      const csv = buildCsv(companies, approaches)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
            safeName
          )}.csv`,
        },
      })
    }

    // excel (XML SpreadSheet 2003)
    const xml = buildXlsXml(project, companies, approaches)
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
          safeName
        )}.xls`,
      },
    })
  } catch (e: any) {
    console.error('[doyalist/export][GET]', e)
    return NextResponse.json(
      { error: e?.message || 'エクスポートに失敗しました' },
      { status: 500 }
    )
  }
}
