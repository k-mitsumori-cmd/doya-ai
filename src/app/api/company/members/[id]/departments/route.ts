// ============================================
// メンバーの部署を決める PUT /api/company/members/[id]/departments  body: { departments: DepartmentId[] }
// ============================================
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT の内側。管理者以上だけ。id は account_company_members の id、持ち主は 'owner'。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { companyRolesApi, json } from '@/lib/company-roles/api.server'
import { setMemberDepartments } from '@/lib/company-roles/departments.server'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  return companyRolesApi(async (s) => {
    const { id } = await ctx.params
    if (!id || id.length > 64) return json({ error: 'メンバーを選び直してください。' }, 400)
    const body = await req.json().catch(() => null)
    const d = await setMemberDepartments(s, id, body?.departments)
    if (!d.ok) {
      const messages = { NOT_ALLOWED: '部署を決められるのは、管理者とオーナーです。', NOT_FOUND: 'メンバーが見つかりませんでした（参加したあとに決められます）。', INVALID_VALUE: '部署を選び直してください。' } as const
      return json({ code: d.code, error: messages[d.code] }, d.status)
    }
    return json({ ok: true, departments: d.departments })
  })
}
