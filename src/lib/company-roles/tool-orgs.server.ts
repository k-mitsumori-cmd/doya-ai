// ============================================
// ツールの組織と会社のつながり（サーバーだけ。読むだけ）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §4
// 決まり（統括の再監査 2026-10-26 中A・中B を受けて、つながりを表に持つ形にした）:
// - ツールの組織が属する会社は、表 account_company_tool_orgs（AccountCompanyToolOrg）が正。つながりは消えない・移らない。
// - 表に無い組織は、作った人（いちばん古いメンバーの行。プロマネはワークスペースの作成者）が会社の持ち主のときだけ、初めて判定したときにつなぐ（自動）。
//   作った人が会社の持ち主でない組織（社員が自分で作った組織・会社を持たない人の組織）は、どの会社にもつながない。上限も決まりも当てない。
// - 会社の管理者以上は、自分が最上位の役割の組織を、明示してつなげる（linkToolOrg。/api/company/tool-orgs）。
import { prisma } from '@/lib/prisma'
import { TOOL_ROLE_TABLES, type ToolId } from './tool-roles'

export type OrgMemberDelegate = {
  findMany(args: { where: Record<string, unknown>; select: Record<string, true> }): Promise<Array<{ organizationId: string; userId: string | null; role: string }>>
  findFirst(args: { where: Record<string, unknown>; orderBy: Array<Record<string, 'asc' | 'desc'>>; select: Record<string, true> }): Promise<{ userId: string | null } | null>
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

/** ツールの組織を作った人（いちばん古いメンバーの行。プロマネはワークスペースの userId）。自動でつなぐときだけ使う */
export async function toolOrgCreator(tool: ToolId, organizationId: string): Promise<string | null> {
  if (tool === 'promane') {
    const ws = await prisma.promaneWorkspace.findUnique({ where: { id: organizationId }, select: { userId: true } })
    return ws?.userId ?? null
  }
  const t = ORG_TOOLS.find((x) => x.tool === tool)
  if (!t) return null
  const row = await t.delegate().findFirst({
    where: { organizationId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { userId: true },
  })
  return row?.userId ?? null
}

/** ツールの組織が属する会社（つながっていなければ null） */
export async function companyOfToolOrg(tool: ToolId, organizationId: string): Promise<{ companyId: string; ownerUserId: string } | null> {
  const link = await prisma.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool, organizationId } }, select: { companyId: true } })
  if (link) {
    const company = await prisma.accountCompany.findUnique({ where: { id: link.companyId }, select: { id: true, userId: true } })
    return company ? { companyId: company.id, ownerUserId: company.userId } : null
  }
  // 表に無い: 作った人が会社の持ち主なら、その会社につなぐ（初めの1回だけ。同時でも1つにまとまる）
  const creator = await toolOrgCreator(tool, organizationId)
  if (!creator) return null
  const own = await prisma.accountCompany.findUnique({ where: { userId: creator }, select: { id: true, userId: true } })
  if (!own) return null
  try {
    const row = await prisma.accountCompanyToolOrg.upsert({
      where: { tool_organizationId: { tool, organizationId } },
      create: { tool, organizationId, companyId: own.id, linkedBy: own.userId },
      update: {},
      select: { companyId: true },
    })
    if (row.companyId !== own.id) {
      const other = await prisma.accountCompany.findUnique({ where: { id: row.companyId }, select: { id: true, userId: true } })
      return other ? { companyId: other.id, ownerUserId: other.userId } : null
    }
  } catch {
    // 同時に作られた（unique の衝突）: 読み直す
    const again = await prisma.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool, organizationId } }, select: { companyId: true } })
    if (!again) return null
    const c = await prisma.accountCompany.findUnique({ where: { id: again.companyId }, select: { id: true, userId: true } })
    return c ? { companyId: c.id, ownerUserId: c.userId } : null
  }
  return { companyId: own.id, ownerUserId: own.userId }
}

/** 本人が、そのツールの組織の最上位の役割（ACTIVE）か */
export async function isToolOrgTopMember(tool: ToolId, organizationId: string, userId: string): Promise<boolean> {
  if (tool === 'promane') {
    const m = await prisma.promaneMember.findFirst({ where: { workspaceId: organizationId, userId, isActive: true, role: 'owner' }, select: { id: true } })
    return !!m
  }
  const t = ORG_TOOLS.find((x) => x.tool === tool)
  if (!t) return false
  const order = TOOL_ROLE_TABLES[tool].order
  const row = await t.delegate().findFirst({ where: { organizationId, userId, role: order[order.length - 1], status: 'ACTIVE' }, orderBy: [{ createdAt: 'asc' }], select: { userId: true } })
  return !!row
}

export type LinkToolOrgDecision =
  | { ok: true; created: boolean }
  | { ok: false; status: number; code: 'NOT_ALLOWED' | 'NOT_TOP_MEMBER' | 'LINKED_ELSEWHERE' | 'INVALID' }

/** 会社の管理者以上が、自分が最上位の役割の組織を、会社につなぐ。ほかの会社につながっていればつながない */
export async function linkToolOrg(input: { companyId: string; actorUserId: string; actorIsAdmin: boolean; tool: ToolId; organizationId: string }): Promise<LinkToolOrgDecision> {
  if (!input.actorIsAdmin) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  if (!input.organizationId || input.organizationId.length > 128) return { ok: false, status: 400, code: 'INVALID' }
  if (!(await isToolOrgTopMember(input.tool, input.organizationId, input.actorUserId))) return { ok: false, status: 403, code: 'NOT_TOP_MEMBER' }
  const existing = await prisma.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool: input.tool, organizationId: input.organizationId } }, select: { companyId: true } })
  if (existing) return existing.companyId === input.companyId ? { ok: true, created: false } : { ok: false, status: 409, code: 'LINKED_ELSEWHERE' }
  await prisma.accountCompanyToolOrg.create({ data: { tool: input.tool, organizationId: input.organizationId, companyId: input.companyId, linkedBy: input.actorUserId } })
  return { ok: true, created: true }
}
