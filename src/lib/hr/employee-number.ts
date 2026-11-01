export const HR_EMPLOYEE_NUMBER_CONFLICT = {
  error: 'この社員番号はすでに使われています。別の社員番号を入力してください。',
  code: 'EMPLOYEE_NUMBER_CONFLICT',
  field: 'employeeNumber',
} as const

/** Only this organization's employee-number constraint is a user input conflict. */
export function isEmployeeNumberConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const value = error as { code?: unknown; meta?: { modelName?: unknown; target?: unknown } }
  if (value.code !== 'P2002' || !value.meta || typeof value.meta !== 'object') return false
  if (value.meta.modelName !== undefined && value.meta.modelName !== 'HrEmployee') return false
  const target = value.meta.target
  return Array.isArray(target) && target.length === 2 && target.includes('organizationId') && target.includes('employeeNumber')
}
