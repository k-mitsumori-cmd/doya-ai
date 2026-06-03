// ============================================
// ドヤ営業管理（SFA）型定義
// ============================================
export type SfaRole = 'owner' | 'admin' | 'manager' | 'member'

export interface SfaContext {
  userId: string
  organizationId: string
  organizationSlug: string
  role: SfaRole
  memberId: string
}

export const ROLE_HIERARCHY: Record<string, number> = {
  member: 0,
  manager: 1,
  admin: 2,
  owner: 3,
}

export const ROLE_LABEL: Record<SfaRole, string> = {
  member: 'メンバー（営業担当）',
  manager: 'マネージャー',
  admin: '管理者',
  owner: 'オーナー',
}

export type LeadStatus = 'new' | 'working' | 'nurturing' | 'qualified' | 'converted' | 'disqualified'
export type DealStatus = 'open' | 'won' | 'lost'
export type ActivityType = 'call' | 'meeting' | 'email' | 'note'
export type TaskStatus = 'open' | 'done'
export type MemberStatus = 'ACTIVE' | 'PENDING' | 'INACTIVE'
