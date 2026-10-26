// ============================================
// ツールの組織と会社のつながり GET（一覧）/ POST（つなぐ） /api/company/tool-orgs
// ============================================
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT の内側。つなぐのは会社の管理者以上で、そのツールの組織の最上位の役割の人だけ。
// ⚠️ つながりは消さない・移さない（ほかの会社につながっている組織は 409）。仕様: ROLES-2026-10-26.md §4.1
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { companyRolesApi, json } from '@/lib/company-roles/api.server'
import { hasMinCompanyRole } from '@/lib/company-roles/roles'
import { TOOL_ROLE_TABLES, type ToolId } from '@/lib/company-roles/tool-roles'
import { linkToolOrg } from '@/lib/company-roles/tool-orgs.server'

const isToolId = (v: unknown): v is ToolId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(TOOL_ROLE_TABLES, v)

export async function GET() {
  return companyRolesApi(async (s) => {
    if (!hasMinCompanyRole(s.role, 'admin')) return json({ error: 'つながりを見られるのは、管理者とオーナーです。' }, 403)
    const rows = await prisma.accountCompanyToolOrg.findMany({ where: { companyId: s.companyId }, orderBy: { createdAt: 'asc' }, select: { tool: true, organizationId: true, createdAt: true } })
    return json({ links: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) })
  })
}

export async function POST(req: NextRequest) {
  return companyRolesApi(async (s) => {
    const body = await req.json().catch(() => null)
    if (!isToolId(body?.tool) || typeof body?.organizationId !== 'string') return json({ error: 'ツールと組織を選び直してください。' }, 400)
    const d = await linkToolOrg({ companyId: s.companyId, actorUserId: s.userId, actorIsAdmin: hasMinCompanyRole(s.role, 'admin'), tool: body.tool, organizationId: body.organizationId })
    if (!d.ok) {
      const messages = {
        NOT_ALLOWED: '会社につなげるのは、管理者とオーナーです。',
        NOT_TOP_MEMBER: 'つなげるのは、そのツールの組織の最上位の役割の方だけです。',
        LINKED_ELSEWHERE: 'この組織は、ほかの会社につながっています。',
        INVALID: 'ツールと組織を選び直してください。',
      } as const
      return json({ code: d.code, error: messages[d.code] }, d.status)
    }
    return json({ ok: true, created: d.created }, d.created ? 201 : 200)
  })
}
