export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { createWithinEmployeeLimit, employeeLimitMessage } from '@/lib/hr/billing'
import { privateApiJson } from '@/lib/private-api-response'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'

const MAX_CSV_CHARS = 1_000_000
const MAX_CSV_ROWS = 500
// JSON may encode each CSV UTF-16 code unit as a six-byte Unicode escape.
const MAX_JSON_BYTES = MAX_CSV_CHARS * 6 + 1024

function parseCSV(text: string): { row: number; cells: string[] }[] {
  const rows: { row: number; cells: string[] }[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let closedQuote = false
  let line = 1
  let rowLine = 1
  const finishCell = () => { cells.push(cell.trim()); cell = ''; closedQuote = false }
  const finishRow = () => {
    finishCell()
    if (cells.some((value) => value !== '')) rows.push({ row: rowLine, cells })
    cells = []
    rowLine = line + 1
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }
        else { quoted = false; closedQuote = true }
      } else if (ch === '\r' && text[i + 1] === '\n') {
        cell += '\n'; i++; line++
      } else {
        cell += ch
        if (ch === '\n' || ch === '\r') line++
      }
    } else if (ch === '"' && cell === '' && !closedQuote) {
      quoted = true
    } else if (ch === ',') {
      finishCell()
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      finishRow()
      line++
    } else if (ch === '"' || closedQuote) {
      throw new Error(`CSVの${line}行目に不正な引用符があります`)
    } else {
      cell += ch
    }
  }
  if (quoted) throw new Error(`CSVの${rowLine}行目の引用符が閉じられていません`)
  if (cell !== '' || cells.length > 0 || closedQuote) finishRow()
  return rows
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    }

    const ctx = await getHrContext()
    if (!ctx) {
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    }

    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return privateApiJson({ error: 'この操作に必要な権限がありません。組織の管理者にご相談ください。' }, { status: 403 })
    }

    const body = await readOperationalJson(req, MAX_JSON_BYTES)
    const { csvText } = body

    if (!csvText || typeof csvText !== 'string') {
      return privateApiJson({ error: 'CSVの内容が空です。ファイルを選ぶか、内容を貼り付けてください。' }, { status: 400 })
    }
    if (csvText.length > MAX_CSV_CHARS) {
      return privateApiJson({ error: 'CSVは100万文字以内にしてください' }, { status: 413 })
    }

    let rows: { row: number; cells: string[] }[]
    try {
      rows = parseCSV(csvText.replace(/^\uFEFF/, ''))
    } catch (error) {
      return privateApiJson({ error: (error as Error).message }, { status: 400 })
    }
    if (rows.length < 2) {
      return privateApiJson({ error: 'CSVには見出しの行と1行以上のデータが必要です。内容を確かめてください。' }, { status: 400 })
    }
    if (rows.length - 1 > MAX_CSV_ROWS) {
      return privateApiJson({ error: `一度に登録できるのは${MAX_CSV_ROWS}名までです` }, { status: 413 })
    }

    const headers = rows[0].cells.map((h) => h.toLowerCase().trim())
    const dataRows = rows.slice(1)

    const colMap: Record<string, number> = {}
    const knownKeys = [
      'employeenumber', 'lastname', 'firstname',
      'lastnamekana', 'firstnamekana', 'email', 'phone',
      'departmentcode', 'position', 'grade',
      'employmenttype', 'hiredate', 'birthdate', 'gender',
    ]
    for (const key of knownKeys) {
      const idx = headers.findIndex((h) =>
        h.replace(/[_\s-]/g, '') === key ||
        h === key
      )
      if (idx >= 0) colMap[key] = idx
    }

    const lastNameIdx = colMap['lastname']
    const firstNameIdx = colMap['firstname']
    if (lastNameIdx === undefined || firstNameIdx === undefined) {
      return privateApiJson(
        { error: 'CSVに lastName と firstName の列が必要です。見出しを確かめてください。' },
        { status: 400 }
      )
    }

    const deptCodeIdx = colMap['departmentcode']
    let deptMap: Record<string, string> = {}
    if (deptCodeIdx !== undefined) {
      const depts = await prisma.hrDepartment.findMany({
        where: { organizationId: ctx.organizationId },
        select: { id: true, code: true },
      })
      deptMap = Object.fromEntries(
        depts.filter((d) => d.code).map((d) => [d.code!, d.id])
      )
    }

    const results: { row: number; success: boolean; error?: string; employeeId?: string }[] = []
    let limitNotice: { message: string; upgradeUrl?: string; contactUrl?: string } | null = null

    for (let i = 0; i < dataRows.length; i++) {
      const { cells: row, row: rowNumber } = dataRows[i]
      try {
        const lastName = row[lastNameIdx]
        const firstName = row[firstNameIdx]
        if (!lastName || !firstName) {
          results.push({ row: rowNumber, success: false, error: 'この行は姓か名が空です。入力してから、もう一度取り込んでください。' })
          continue
        }
        if (limitNotice) {
          results.push({ row: rowNumber, success: false, error: limitNotice.message })
          continue
        }

        const get = (key: string) => {
          const idx = colMap[key]
          return idx !== undefined ? row[idx] || null : null
        }

        const deptCode = get('departmentcode')
        const departmentId = deptCode ? deptMap[deptCode] || null : null
        const hireDateStr = get('hiredate')
        const birthDateStr = get('birthdate')

        const admission = await createWithinEmployeeLimit(ctx.organizationId, async (tx) => {
          const employee = await tx.hrEmployee.create({
            data: {
              organizationId: ctx.organizationId,
              employeeNumber: get('employeenumber'),
              lastName,
              firstName,
              lastNameKana: get('lastnamekana'),
              firstNameKana: get('firstnamekana'),
              email: get('email'),
              phone: get('phone'),
              departmentId,
              position: get('position'),
              grade: get('grade'),
              employmentType: get('employmenttype') || 'FULL_TIME',
              hireDate: hireDateStr ? new Date(hireDateStr) : null,
              birthDate: birthDateStr ? new Date(birthDateStr) : null,
              gender: get('gender'),
              status: 'ACTIVE',
            },
          })

          await tx.hrEmployeeHistory.create({
            data: {
              employeeId: employee.id,
              changeType: 'HIRE',
              effectiveDate: hireDateStr ? new Date(hireDateStr) : new Date(),
              reason: 'CSV import',
            },
          })
          return employee
        })
        if (!admission.allowed) {
          const message = employeeLimitMessage(admission.plan, admission.limit)
          const canUpgrade = !['PRO', 'BUNDLE', 'ENTERPRISE'].includes(admission.plan.toUpperCase())
          limitNotice = canUpgrade
            ? { message, upgradeUrl: '/hr/pricing' }
            : { message, contactUrl: 'https://doyamarke.surisuta.jp/contact' }
          results.push({ row: rowNumber, success: false, error: message })
          continue
        }
        const employee = admission.value

        results.push({ row: rowNumber, success: true, employeeId: employee.id })
      } catch (err: any) {
        console.error('[hr/employees/import][row]')
        results.push({ row: rowNumber, success: false, error: err?.code === 'P2002' ? '社員番号が重複しています' : 'この行の登録に失敗しました' })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return privateApiJson({
      success: true,
      imported: successCount,
      failed: failCount,
      details: results,
      ...(limitNotice ? { code: 'HR_ORG_EMPLOYEE_LIMIT', limitNotice } : {}),
    })
  } catch (e: any) {
    if (e instanceof OperationalBodyError) {
      return privateApiJson(
        { error: e.status === 413 ? '送信内容が大きすぎます。CSVは100万文字以内にしてください。' : '送信内容を読み取れませんでした。CSVを選び直すか、内容を貼り直してください。' },
        { status: e.status }
      )
    }
    console.error('[hr/employees/import]')
    return privateApiJson(
      { error: '従業員の一括登録に失敗しました' },
      { status: 500 }
    )
  }
}
