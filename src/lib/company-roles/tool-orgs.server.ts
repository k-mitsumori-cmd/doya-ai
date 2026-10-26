// ============================================
// ツールの組織と会社のつながり（サーバーだけ。読むだけ）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §4
// 決まり: ツールの組織が属する会社 ＝ その組織の最上位の役割の、いちばん古いメンバー（作った人）が持ち主の会社。
// ⚠️ 全体設計書の CompanyServiceLink（会社とツールの組織のつながりの表）ができたら、そちらを正にする。
import { prisma } from '@/lib/prisma'
import { TOOL_ROLE_TABLES, type ToolId } from './tool-roles'

export type OrgMemberDelegate = {
  findMany(args: { where: Record<string, unknown>; select: Record<string, true> }): Promise<Array<{ organizationId: string; userId: string | null; role: string }>>
  findFirst(args: { where: Record<string, unknown>; orderBy: Record<string, 'asc' | 'desc'>; select: Record<string, true> }): Promise<{ userId: string | null } | null>
}

// 組織とメンバーの表が同じ形（organizationId・userId・role・status=ACTIVE・createdAt）のツール
export const ORG_TOOLS: Array<{ tool: Exclude<ToolId, 'promane'>; delegate: () => OrgMemberDelegate }> = [
  { tool: 'kintai', delegate: () => prisma.kintaiMember as unknown as OrgMemberDelegate },
  { tool: 'hr', delegate: () => prisma.hrOrganizationMember as unknown as OrgMemberDelegate },
  { tool: 'quote', delegate: () => prisma.quoteMember as unknown as OrgMemberDelegate },
  { tool: 'income', delegate: () => prisma.incomeMember as unknown as OrgMemberDelegate },
  { tool: 'expense', delegate: () => prisma.expenseMember as unknown as OrgMemberDelegate },
  { tool: 'sfa', delegate: () => prisma.sfaMember as unknown as OrgMemberDelegate },
  { tool: 'shodan', delegate: () => prisma.shodanMember as unknown as OrgMemberDelegate },
  { tool: 'aio', delegate: () => prisma.aioMember as unknown as OrgMemberDelegate },
  { tool: 'mensetsu', delegate: () => prisma.mensetsuMember as unknown as OrgMemberDelegate },
  { tool: 'aishodan', delegate: () => prisma.aishodanMember as unknown as OrgMemberDelegate },
]

/** ツールの組織を作った人（最上位の役割のいちばん古いメンバー。プロマネはワークスペースの userId） */
export async function toolOrgCreator(tool: ToolId, organizationId: string): Promise<string | null> {
  if (tool === 'promane') {
    const ws = await prisma.promaneWorkspace.findUnique({ where: { id: organizationId }, select: { userId: true } })
    return ws?.userId ?? null
  }
  const t = ORG_TOOLS.find((x) => x.tool === tool)
  if (!t) return null
  const order = TOOL_ROLE_TABLES[tool].order
  const top = order[order.length - 1]
  const row = await t.delegate().findFirst({
    where: { organizationId, role: top, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  })
  return row?.userId ?? null
}

/** ツールの組織が属する会社（作った人が会社を持っていなければ null） */
export async function companyOfToolOrg(tool: ToolId, organizationId: string): Promise<{ companyId: string; ownerUserId: string } | null> {
  const creator = await toolOrgCreator(tool, organizationId)
  if (!creator) return null
  const company = await prisma.accountCompany.findUnique({ where: { userId: creator }, select: { id: true, userId: true } })
  return company ? { companyId: company.id, ownerUserId: company.userId } : null
}
