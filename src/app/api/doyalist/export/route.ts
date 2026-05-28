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
    '企業ID',
    '企業名',
    'ウェブサイト',
    '業種',
    '地域',
    '規模',
    '事業概要',
    '担当者',
    'メール',
    '電話',
    'スコア',
    'ステータス',
    'ソース',
    'メモ',
    '作成日',
  ]
  lines.push(companyHeaders.map(csvEscape).join(','))
  for (const c of companies) {
    lines.push(
      [
        c.id,
        c.name,
        c.website || '',
        c.industry || '',
        c.region || '',
        c.size || '',
        c.description || '',
        c.contactPerson || '',
        c.contactEmail || '',
        c.contactPhone || '',
        c.score ?? '',
        c.status,
        c.source || '',
        c.notes || '',
        c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
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
    '企業ID',
    '企業名',
    'ウェブサイト',
    '業種',
    '地域',
    '規模',
    '事業概要',
    '担当者',
    'メール',
    '電話',
    'スコア',
    'ステータス',
    'ソース',
    'メモ',
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
      const cells = [
        cell(c.id),
        cell(c.name),
        cell(c.website || ''),
        cell(c.industry || ''),
        cell(c.region || ''),
        cell(c.size || ''),
        cell(c.description || ''),
        cell(c.contactPerson || ''),
        cell(c.contactEmail || ''),
        cell(c.contactPhone || ''),
        cell(c.score ?? '', 'Number'),
        cell(c.status),
        cell(c.source || ''),
        cell(c.notes || ''),
        cell(c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt),
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
