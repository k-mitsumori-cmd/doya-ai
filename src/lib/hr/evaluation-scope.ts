import type { Prisma } from '@prisma/client'

/** Every related employee and evaluator must belong to the period's organization. */
export function evaluationOrganizationWhere(organizationId: string): Prisma.HrEvaluationWhereInput {
  return {
    period: { is: { organizationId } },
    employee: { is: { organizationId } },
    AND: [{ OR: [{ evaluatorId: null }, { evaluator: { is: { organizationId } } }] }],
  }
}

/** An inconsistent department assignment must not expose another organization's department. */
export function redactEvaluationDepartment<T extends { department: { organizationId: string } | null }>(employee: T, organizationId: string) {
  if (!employee.department || employee.department.organizationId !== organizationId) {
    return { ...employee, department: null, ...('departmentId' in employee ? { departmentId: null } : {}) }
  }
  const { organizationId: internalOrganization, ...department } = employee.department
  return { ...employee, department }
}
