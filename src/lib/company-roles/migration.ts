// ============================================
// 今の会員を、会社の役割に割り当てる案の組み立て（純粋な関数。DB は migration.server.ts）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §4.2
import { isMemberRowRole, type CompanyRole, type MemberRowRole } from './roles'
import { proposeCompanyRole, wouldBeClamped, type ToolMembershipLike } from './tool-roles'

export interface MigrationPlanRow {
  memberId: string
  email: string
  current: MemberRowRole
  proposed: MemberRowRole
  /** 今の役割のままだと、ツールの中で下がる役割 */
  clampedNow: ToolMembershipLike[]
  /** 案の役割にしても、ツールの中で下がる役割 */
  clampedProposed: ToolMembershipLike[]
}

/** ある人たちの、会社のツールの組織での役割（純粋な組み立て。テストのため分けた） */
export function buildMigrationPlan(input: {
  members: Array<{ id: string; email: string; userId: string | null; role: string }>
  memberships: Array<ToolMembershipLike & { userId: string }>
}): MigrationPlanRow[] {
  return input.members.map((m) => {
    const mine = m.userId ? input.memberships.filter((x) => x.userId === m.userId).map(({ tool, role }) => ({ tool, role })) : []
    const current: MemberRowRole = isMemberRowRole(m.role) ? m.role : 'guest'
    const proposed = proposeCompanyRole(mine)
    return {
      memberId: m.id,
      email: m.email,
      current,
      proposed,
      clampedNow: wouldBeClamped(mine, current as CompanyRole),
      clampedProposed: wouldBeClamped(mine, proposed as CompanyRole),
    }
  })
}

