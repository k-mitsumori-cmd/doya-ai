// ============================================
// 今の会員を、会社の役割に割り当てる案（読むだけ。書かない）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §4.2
// 決まり:
// - 会社のツールの組織 ＝ 会社の持ち主が ACTIVE で入っている組織（持ち主が作った組織も、招かれた組織も）。
// - メンバーごとに、その組織での役割を写して、いちばん高いものを案にする（proposeCompanyRole）。
// - 旗を on にすると、ツールの中の役割が下がる人も一覧にする（wouldBeClamped）。
// ⚠️ ここでは何も書かない。オーナーが画面で決めたら、/api/company/members/[id]/role で変える（記録は kind=role_changed）。
import { prisma } from '@/lib/prisma'
import { buildMigrationPlan, type MigrationPlanRow } from './migration'
import type { ToolId, ToolMembershipLike } from './tool-roles'

export type { MigrationPlanRow }

type OrgMemberDelegate = {
  findMany(args: { where: Record<string, unknown>; select: Record<string, true> }): Promise<Array<{ organizationId: string; userId: string | null; role: string }>>
}

// 組織とメンバーの表が同じ形（organizationId・userId・role・status=ACTIVE）のツール
const ORG_TOOLS: Array<{ tool: ToolId; delegate: () => OrgMemberDelegate }> = [
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

/** 会社の移行の案（オーナーの画面で見せる） */
export async function loadMigrationPlan(companyId: string): Promise<MigrationPlanRow[]> {
  const company = await prisma.accountCompany.findUnique({ where: { id: companyId }, select: { userId: true } })
  if (!company) return []
  const members = await prisma.accountCompanyMember.findMany({
    where: { companyId, status: 'active', userId: { not: null } },
    select: { id: true, email: true, userId: true, role: true },
  })
  const userIds = members.map((m) => m.userId).filter((v): v is string => !!v)
  if (userIds.length === 0) return []
  const memberships: Array<ToolMembershipLike & { userId: string }> = []
  for (const t of ORG_TOOLS) {
    const d = t.delegate()
    const ownerOrgs = await d.findMany({ where: { userId: company.userId, status: 'ACTIVE' }, select: { organizationId: true, userId: true, role: true } })
    const orgIds = [...new Set(ownerOrgs.map((o) => o.organizationId))]
    if (orgIds.length === 0) continue
    const rows = await d.findMany({ where: { organizationId: { in: orgIds }, userId: { in: userIds }, status: 'ACTIVE' }, select: { organizationId: true, userId: true, role: true } })
    for (const r of rows) if (r.userId) memberships.push({ tool: t.tool, role: r.role, userId: r.userId })
  }
  // プロマネは workspaceId と isActive
  const ownerWs = await prisma.promaneMember.findMany({ where: { userId: company.userId, isActive: true }, select: { workspaceId: true } })
  if (ownerWs.length) {
    const rows = await prisma.promaneMember.findMany({ where: { workspaceId: { in: ownerWs.map((w) => w.workspaceId) }, userId: { in: userIds }, isActive: true }, select: { userId: true, role: true } })
    for (const r of rows) memberships.push({ tool: 'promane', role: r.role, userId: r.userId })
  }
  return buildMigrationPlan({ members, memberships })
}
