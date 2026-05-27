export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext, hasMinRole } from '@/lib/kintai/access'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getKintaiContext()
    if (!ctx || !hasMinRole(ctx.role, 'hr_admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const format = searchParams.get('format') || 'csv' // csv or excel

    const jstOffset = 9 * 60 * 60 * 1000
    const monthStart = new Date(Date.UTC(year, month - 1, 1) - jstOffset)
    const monthEnd = new Date(Date.UTC(year, month, 1) - jstOffset)

    const employees = await prisma.kintaiEmployee.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
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

      const csvContent = BOM + [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="kintai_${year}-${String(month).padStart(2, '0')}.csv"`,
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
  <Cell><Data ss:Type="String">${emp.name}</Data></Cell>
  <Cell><Data ss:Type="String">${emp.department?.name || ''}</Data></Cell>
  <Cell><Data ss:Type="String">${date}</Data></Cell>
  <Cell><Data ss:Type="String">${clockIn}</Data></Cell>
  <Cell><Data ss:Type="String">${clockOut}</Data></Cell>
  <Cell><Data ss:Type="Number">${att.workMinutes}</Data></Cell>
  <Cell><Data ss:Type="Number">${att.overtimeMinutes}</Data></Cell>
  <Cell><Data ss:Type="Number">${att.lateMinutes}</Data></Cell>
  <Cell><Data ss:Type="Number">${att.earlyLeaveMinutes}</Data></Cell>
  <Cell><Data ss:Type="String">${att.status}</Data></Cell>
</Row>`
      }
    }

    const xmlFooter = `</Table></Worksheet></Workbook>`
    const excelContent = xmlHeader + xmlRows + xmlFooter

    return new NextResponse(excelContent, {
      headers: {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': `attachment; filename="kintai_${year}-${String(month).padStart(2, '0')}.xls"`,
      },
    })
  } catch (e) {
    console.error('[kintai/attendance/export]', e)
    return NextResponse.json({ error: 'エクスポートに失敗しました' }, { status: 500 })
  }
}
