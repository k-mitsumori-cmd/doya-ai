export const HrMemberRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
} as const
export type HrMemberRole = (typeof HrMemberRole)[keyof typeof HrMemberRole]

export const EmployeeStatus = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  RESIGNED: 'RESIGNED',
  RETIRED: 'RETIRED',
} as const
export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus]

export const EmploymentType = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACT',
  INTERN: 'INTERN',
  TEMPORARY: 'TEMPORARY',
} as const
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType]

export const EvaluationStatus = {
  DRAFT: 'DRAFT',
  SELF_EVALUATION: 'SELF_EVALUATION',
  MANAGER_REVIEW: 'MANAGER_REVIEW',
  SUBMITTED: 'SUBMITTED',
  REVIEWED: 'REVIEWED',
  FINALIZED: 'FINALIZED',
} as const
export type EvaluationStatus = (typeof EvaluationStatus)[keyof typeof EvaluationStatus]

export const EvaluationPeriodStatus = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  CLOSED: 'CLOSED',
} as const
export type EvaluationPeriodStatus =
  (typeof EvaluationPeriodStatus)[keyof typeof EvaluationPeriodStatus]

export const HistoryChangeType = {
  HIRE: 'HIRE',
  TRANSFER: 'TRANSFER',
  PROMOTION: 'PROMOTION',
  DEMOTION: 'DEMOTION',
  LEAVE: 'LEAVE',
  RETURN: 'RETURN',
  RESIGN: 'RESIGN',
  RETIRE: 'RETIRE',
  OTHER: 'OTHER',
} as const
export type HistoryChangeType =
  (typeof HistoryChangeType)[keyof typeof HistoryChangeType]

export const OneOnOneStatus = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const
export type OneOnOneStatus = (typeof OneOnOneStatus)[keyof typeof OneOnOneStatus]

export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const
export type InvitationStatus =
  (typeof InvitationStatus)[keyof typeof InvitationStatus]

export const MemberStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus]

export interface HrContext {
  userId: string
  organizationId: string
  role: HrMemberRole
  memberId: string
}

export interface HrApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface OrgChartNode {
  department: {
    id: string
    name: string
    code: string | null
    managerId: string | null
  }
  employees: {
    id: string
    firstName: string
    lastName: string
    position: string | null
    photoUrl: string | null
    employeeNumber: string | null
  }[]
  children: OrgChartNode[]
}
