// ============================================
// 役割の変更の記録 GET /api/company/role-events?before=<ISO>
// ============================================
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT の内側。管理者以上だけ。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { companyRolesApi, json } from '@/lib/company-roles/api.server'
import { listRoleEvents } from '@/lib/company-roles/members.server'

export async function GET(req: NextRequest) {
  return companyRolesApi(async (s) => {
    const before = new URL(req.url).searchParams.get('before') ?? undefined
    const r = await listRoleEvents(s, { before })
    if (!r) return json({ error: '変更の記録を見られるのは、管理者とオーナーです。' }, 403)
    return json(r)
  })
}
