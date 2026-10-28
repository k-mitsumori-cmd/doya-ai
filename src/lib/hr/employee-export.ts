import type { Prisma } from '@prisma/client'

export const MAX_EMPLOYEE_EXPORT_ROWS = 10_000
export const employeeExportSelect = {
  employeeNumber: true, lastName: true, firstName: true, lastNameKana: true, firstNameKana: true,
  email: true, phone: true, department: { select: { code: true } }, position: true, grade: true,
  employmentType: true, hireDate: true, birthDate: true, gender: true, status: true,
} satisfies Prisma.HrEmployeeSelect
type ExportEmployee = Prisma.HrEmployeeGetPayload<{ select: typeof employeeExportSelect }>

function csvCell(value: unknown) {
  let text = value == null ? '' : String(value)
  if (/^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text
  return `"${text.replace(/"/g, '""')}"`
}
const date = (value: Date | null) => value ? value.toISOString().slice(0, 10) : ''

/** Export standard employee fields only, excluding internal IDs, photos and custom/private fields. */
export function employeeCsv(employees: ExportEmployee[]) {
  const headers = ['社員番号', '姓', '名', '姓(カナ)', '名(カナ)', 'メール', '電話番号', '部署コード', '役職', '等級', '雇用形態', '入社日', '生年月日', '性別', '在籍状況']
  const records = employees.map(employee => [
    employee.employeeNumber, employee.lastName, employee.firstName, employee.lastNameKana, employee.firstNameKana,
    employee.email, employee.phone, employee.department?.code, employee.position, employee.grade,
    employee.employmentType, date(employee.hireDate), date(employee.birthDate), employee.gender, employee.status,
  ])
  return '\uFEFF' + [headers, ...records].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
