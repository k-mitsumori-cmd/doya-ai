// ============================================
// 会社の役割（自分の役割・メンバーの一覧・会社の決まり） GET /api/company/roles
// ============================================
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT の内側。off なら 404。画面の出し分けは、ここで返す can* をそのまま使う（画面で判定しない）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { companyRolesApi, json } from '@/lib/company-roles/api.server'
import { listMembersWithRoles } from '@/lib/company-roles/members.server'
import { canCompany, permissionMatrix } from '@/lib/company-roles/permissions'
import { COMPANY_ROLE_DESCRIPTION, COMPANY_ROLE_LABEL } from '@/lib/company-roles/roles'

export async function GET() {
  return companyRolesApi(async (s) => {
    const canViewMembers = canCompany(s.role, 'members.view', {}, s.policy)
    const members = canViewMembers ? await listMembersWithRoles(s) : []
    const mine = permissionMatrix(s.policy).filter((row) => row.allowed.includes(s.role)).map((row) => row.permission)
    return json({
      mode: s.mode,
      me: { role: s.role, label: COMPANY_ROLE_LABEL[s.role], description: COMPANY_ROLE_DESCRIPTION[s.role], permissions: mine },
      can: {
        viewMembers: canViewMembers,
        changeRoles: canCompany(s.role, 'members.role.change', {}, s.policy),
        viewEvents: canCompany(s.role, 'members.role_events.view', {}, s.policy),
        changePolicy: s.role === 'owner',
      },
      members,
      policy: s.policy,
    })
  })
}
