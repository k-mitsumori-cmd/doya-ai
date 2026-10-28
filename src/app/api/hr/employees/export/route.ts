export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { prisma } from '@/lib/prisma'
import { privateApiJson } from '@/lib/private-api-response'
import { employeeCsv, employeeExportSelect, MAX_EMPLOYEE_EXPORT_ROWS } from '@/lib/hr/employee-export'

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    if (!hasMinRole(ctx.role, 'ADMIN')) return privateApiJson({ error: 'CSVの書き出しには組織の管理者権限が必要です。' }, { status: 403 })
    // One database statement produces a consistent snapshot; never silently truncate an export.
    const employees = await prisma.hrEmployee.findMany({
      where: { organizationId: ctx.organizationId },
      select: employeeExportSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      take: MAX_EMPLOYEE_EXPORT_ROWS + 1,
    })
    if (employees.length > MAX_EMPLOYEE_EXPORT_ROWS) {
      return privateApiJson({ error: '一度に書き出せる従業員は1万名までです。', code: 'HR_EXPORT_ROW_LIMIT' }, { status: 413 })
    }
    return new NextResponse(employeeCsv(employees), { headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="doya-hr-employees.csv"',
      'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff',
    } })
  } catch {
    console.error('[hr/employees/export]')
    return privateApiJson({ error: '従業員のCSVを書き出せませんでした。時間をおいて、もう一度お試しください。' }, { status: 500 })
  }
}
