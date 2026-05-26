export type KintaiMemberRole = 'system_admin' | 'hr_admin' | 'manager' | 'employee'
export type EmploymentType = 'full_time' | 'part_time' | 'contract'
export type ClockType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
export type ClockSource = 'pc' | 'mobile' | 'manual'
export type AttendanceStatus = 'normal' | 'absent' | 'holiday' | 'paid_leave' | 'special_leave'
export type RequestType = 'clock_fix' | 'leave' | 'overtime' | 'holiday_work'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'
export type ClockStatus = 'not_clocked_in' | 'working' | 'on_break' | 'clocked_out'

export interface KintaiContext {
  userId: string
  organizationId: string
  role: KintaiMemberRole
  memberId: string
  employeeId: string
}

export interface MonthlyAttendanceSummary {
  totalWorkDays: number
  totalWorkMinutes: number
  totalOvertimeMinutes: number
  totalLateMinutes: number
  totalLateCount: number
  totalEarlyLeaveMinutes: number
  totalNightMinutes: number
  totalAbsentDays: number
  totalLeaveDays: number
  totalHolidayWorkDays: number
}

export const ROLE_HIERARCHY: Record<string, number> = {
  employee: 0,
  manager: 1,
  hr_admin: 2,
  system_admin: 3,
}

export const ROLE_LABELS: Record<string, string> = {
  system_admin: 'システム管理者',
  hr_admin: '人事管理者',
  manager: '部門管理者',
  employee: '一般',
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: '正社員',
  part_time: 'パート',
  contract: '契約社員',
}

export const CLOCK_TYPE_LABELS: Record<string, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
}

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  clock_fix: '打刻修正',
  leave: '休暇',
  overtime: '残業',
  holiday_work: '休日出勤',
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: '承認待ち',
  approved: '承認済',
  rejected: '却下',
  withdrawn: '取下げ',
}

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  normal: '通常',
  absent: '欠勤',
  holiday: '休日',
  paid_leave: '有給休暇',
  special_leave: '特別休暇',
}
