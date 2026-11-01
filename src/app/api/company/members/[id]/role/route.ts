// ============================================
// メンバーの役割を変える PATCH /api/company/members/[id]/role  body: { role }
// ============================================
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT の内側。off なら 404。
// ⚠️ 自分自身・オーナー・同じか上の役割の人は変えられない。変えたら account_company_role_events に残す（同じトランザクション）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { companyRolesApi, json } from '@/lib/company-roles/api.server'
import { changeMemberRole } from '@/lib/company-roles/members.server'
import { ROLE_CHANGE_MESSAGE } from '@/lib/company-roles/roles'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return companyRolesApi(async (s) => {
    const { id } = await ctx.params
    if (!id || id.length > 64) return json({ error: 'メンバーを選び直してください。' }, 400)
    const body = await req.json().catch(() => null)
    const d = await changeMemberRole(s, id, body?.role)
    if (!d.ok) return json({ code: d.code, error: d.status === 404 ? 'メンバーが見つかりませんでした。' : ROLE_CHANGE_MESSAGE[d.code] }, d.status)
    return json({ ok: true, from: d.from, to: d.to })
  })
}
