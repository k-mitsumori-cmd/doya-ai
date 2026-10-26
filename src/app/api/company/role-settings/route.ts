// ============================================
// 会社ごとの権限の決まり GET / PUT /api/company/role-settings
// ============================================
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT の内側。見るのは管理者以上、変えるのはオーナーだけ。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { companyRolesApi, json } from '@/lib/company-roles/api.server'
import { updateRolePolicy } from '@/lib/company-roles/members.server'
import { hasMinCompanyRole } from '@/lib/company-roles/roles'
import { POLICY_KEYS, POLICY_LABEL, DEFAULT_ROLE_POLICY } from '@/lib/company-roles/policy'

export async function GET() {
  return companyRolesApi(async (s) => {
    if (!hasMinCompanyRole(s.role, 'admin')) return json({ error: '権限の決まりを見られるのは、管理者とオーナーです。' }, 403)
    return json({ policy: s.policy, defaults: DEFAULT_ROLE_POLICY, keys: POLICY_KEYS, labels: POLICY_LABEL, canChange: s.role === 'owner' })
  })
}

export async function PUT(req: NextRequest) {
  return companyRolesApi(async (s) => {
    const body = await req.json().catch(() => null)
    const d = await updateRolePolicy(s, body?.policy)
    if (!d.ok) {
      const messages = { OWNER_REQUIRED: '権限の決まりを変えられるのは、オーナーだけです。', INVALID_VALUE: '選び直してください。', NO_CHANGE: '今と同じです。' } as const
      return json({ code: d.code, error: messages[d.code] }, d.status)
    }
    return json({ ok: true, policy: d.policy, changed: d.changed })
  })
}
