export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

function csvCell(value: string): string {
  // Quoting alone does not prevent spreadsheet applications from running formulas.
  const guarded = /^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${guarded.replace(/"/g, '""')}"`
}

function xmlText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx || !hasMinRole(ctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    if ((yearParam !== null && !/^[1-9]\d{3}$/.test(yearParam)) ||
        (monthParam !== null && !/^(0?[1-9]|1[0-2])$/.test(monthParam))) {
      return NextResponse.json({ error: '対象年月が正しくありません' }, { status: 400 })
    }
    const year = yearParam === null ? jstNow.getUTCFullYear() : Number(yearParam)
    const month = monthParam === null ? jstNow.getUTCMonth() + 1 : Number(monthParam)
    const format = searchParams.get('format') || 'csv' // csv or excel
    if (format !== 'csv' && format !== 'excel') {
      return NextResponse.json({ error: '出力形式が正しくありません' }, { status: 400 })
    }

    const jstOffset = 9 * 60 * 60 * 1000
    const monthStart = new Date(Date.UTC(year, month - 1, 1) - jstOffset)
    const monthEnd = new Date(Date.UTC(year, month, 1) - jstOffset)

    const employees = await prisma.kintaiEmployee.findMany({
      // 退職・無効化後でも、対象月に勤怠がある従業員は過去月の出力に含める。
      where: {
        organizationId: ctx.organizationId,
        OR: [
          { isActive: true },
          { attendances: { some: { date: { gte: monthStart, lt: monthEnd } } } },
        ],
      },
      include: {
        department: { select: { name: true } },
        attendances: {
          where: { date: { gte: monthStart, lt: monthEnd } },
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    if (format === 'csv') {
      const BOM = '﻿'
      const header = ['従業員名', '部署', '日付', '出勤', '退勤', '勤務時間(分)', '残業時間(分)', '遅刻(分)', '早退(分)', 'ステータス']
      const rows = []

      for (const emp of employees) {
        for (const att of emp.attendances) {
          const date = new Date(att.date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
          const clockIn = att.clockIn ? new Date(att.clockIn).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false, hour: '2-digit', minute: '2-digit' }) : ''
          const clockOut = att.clockOut ? new Date(att.clockOut).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false, hour: '2-digit', minute: '2-digit' }) : ''
          rows.push([
            emp.name,
            emp.department?.name || '',
            date,
            clockIn,
            clockOut,
            String(att.workMinutes),
            String(att.overtimeMinutes),
            String(att.lateMinutes),
            String(att.earlyLeaveMinutes),
            att.status,
          ])
        }
        if (emp.attendances.length === 0) {
          rows.push([emp.name, emp.department?.name || '', '', '', '', '0', '0', '0', '0', 'データなし'])
        }
      }

      const csvContent = BOM + [header, ...rows].map(r => r.map(c => csvCell(c)).join(',')).join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="kintai_${year}-${String(month).padStart(2, '0')}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    // Excel format using simple XML spreadsheet
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${year}年${month}月">
<Table>
<Row>
  <Cell><Data ss:Type="String">従業員名</Data></Cell>
  <Cell><Data ss:Type="String">部署</Data></Cell>
  <Cell><Data ss:Type="String">日付</Data></Cell>
  <Cell><Data ss:Type="String">出勤</Data></Cell>
  <Cell><Data ss:Type="String">退勤</Data></Cell>
  <Cell><Data ss:Type="String">勤務時間(分)</Data></Cell>
  <Cell><Data ss:Type="String">残業時間(分)</Data></Cell>
  <Cell><Data ss:Type="String">遅刻(分)</Data></Cell>
  <Cell><Data ss:Type="String">早退(分)</Data></Cell>
  <Cell><Data ss:Type="String">ステータス</Data></Cell>
</Row>`

    let xmlRows = ''
    for (const emp of employees) {
      for (const att of emp.attendances) {
        const date = new Date(att.date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
        const clockIn = att.clockIn ? new Date(att.clockIn).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false, hour: '2-digit', minute: '2-digit' }) : ''
        const clockOut = att.clockOut ? new Date(att.clockOut).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false, hour: '2-digit', minute: '2-digit' }) : ''
        xmlRows += `<Row>
  <Cell><Data ss:Type="String">${xmlText(emp.name)}</Data></Cell>
  <Cell><Data ss:Type="String">${xmlText(emp.department?.name || '')}</Data></Cell>
  <Cell><Data ss:Type="String">${date}</Data></Cell>
  <Cell><Data ss:Type="String">${clockIn}</Data></Cell>
  <Cell><Data ss:Type="String">${clockOut}</Data></Cell>
  <Cell><Data ss:Type="Number">${att.workMinutes}</Data></Cell>
  <Cell><Data ss:Type="Number">${att.overtimeMinutes}</Data></Cell>
  <Cell><Data ss:Type="Number">${att.lateMinutes}</Data></Cell>
  <Cell><Data ss:Type="Number">${att.earlyLeaveMinutes}</Data></Cell>
  <Cell><Data ss:Type="String">${xmlText(att.status)}</Data></Cell>
</Row>`
      }
      if (emp.attendances.length === 0) {
        xmlRows += `<Row>
  <Cell><Data ss:Type="String">${xmlText(emp.name)}</Data></Cell>
  <Cell><Data ss:Type="String">${xmlText(emp.department?.name || '')}</Data></Cell>
  <Cell><Data ss:Type="String"></Data></Cell>
  <Cell><Data ss:Type="String"></Data></Cell>
  <Cell><Data ss:Type="String"></Data></Cell>
  <Cell><Data ss:Type="Number">0</Data></Cell>
  <Cell><Data ss:Type="Number">0</Data></Cell>
  <Cell><Data ss:Type="Number">0</Data></Cell>
  <Cell><Data ss:Type="Number">0</Data></Cell>
  <Cell><Data ss:Type="String">データなし</Data></Cell>
</Row>`
      }
    }

    const xmlFooter = `</Table></Worksheet></Workbook>`
    const excelContent = xmlHeader + xmlRows + xmlFooter

    return new NextResponse(excelContent, {
      headers: {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': `attachment; filename="kintai_${year}-${String(month).padStart(2, '0')}.xls"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    console.error('[kintai/attendance/export]', e)
    return NextResponse.json({ error: 'エクスポートに失敗しました' }, { status: 500 })
  }
}
