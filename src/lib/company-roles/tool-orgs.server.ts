// ============================================
// ツールの組織と会社のつながり（サーバーだけ。読むだけ）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §4
// 決まり（統括の再監査 2026-10-26 中A・中B を受けて、つながりを表に持つ形にした）:
// - ツールの組織が属する会社は、表 account_company_tool_orgs（AccountCompanyToolOrg）が正。つながりは消えない・移らない。
// - 表に無い組織は、作った人（いちばん古いメンバーの行。プロマネはワークスペースの作成者）が会社の持ち主で、今も最上位の役割で組織にいるときだけ、初めて判定したときにつなぐ（自動）。
// - 会社のオーナーだけが、自分の会社につながった組織のつながりを外せる（unlinkToolOrg）。外したら記録に残す。
// - 作った人が引き継いだあとの組織は表につながず、作った人の会社の社員にだけ、その会社の役割を当てる（linked: false）。
//   作った人が会社の持ち主でない組織（社員が自分で作った組織・会社を持たない人の組織）は、どの会社にもつながない。上限も決まりも当てない。
// - 会社の管理者以上は、自分が最上位の役割の組織を、明示してつなげる（linkToolOrg。/api/company/tool-orgs）。
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { CompanyToolLinkDecision } from './link-seat.server'
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

/**
 * ツールの組織が属する会社（つながっていなければ null）。
 * linked: false は「表にはつないでいないが、作った人の会社が分かる」組織（作った人が引き継いだあと）。
 * この組織では、その会社の持ち主とメンバーにだけ会社の役割を当て、会社に入っていない人には当てない（access.ts）。
 */
export async function companyOfToolOrg(tool: ToolId, organizationId: string): Promise<{ companyId: string; ownerUserId: string; linked: boolean } | null> {
  const link = await prisma.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool, organizationId } }, select: { companyId: true } })
  if (link) {
    const company = await prisma.accountCompany.findUnique({ where: { id: link.companyId }, select: { id: true, userId: true } })
    return company ? { companyId: company.id, ownerUserId: company.userId, linked: true } : null
  }
  // 表に無い: 作った人が会社の持ち主なら、その会社につなぐ（初めの1回だけ。同時でも1つにまとまる）
  const creator = await toolOrgCreator(tool, organizationId)
  if (!creator) return null
  const own = await prisma.accountCompany.findUnique({ where: { userId: creator }, select: { id: true, userId: true } })
  if (!own) return null
  // 作った人が今も最上位の役割で組織にいるときだけ、自動でつなぐ（引き継いだあとの組織を、前の持ち主の会社につながない）。
  // つながないときも「作った人の会社」は返し、その会社の社員には上限を当てる（社員が最上位を引き継いで上限を外すことを防ぐ。自動の点検の指摘 2026-10-26）
  if (!(await isToolOrgTopMember(tool, organizationId, creator))) return { companyId: own.id, ownerUserId: own.userId, linked: false }
  try {
    const row = await prisma.accountCompanyToolOrg.upsert({
      where: { tool_organizationId: { tool, organizationId } },
      create: { tool, organizationId, companyId: own.id, linkedBy: own.userId },
      update: {},
      select: { companyId: true },
    })
    if (row.companyId !== own.id) {
      const other = await prisma.accountCompany.findUnique({ where: { id: row.companyId }, select: { id: true, userId: true } })
      return other ? { companyId: other.id, ownerUserId: other.userId, linked: true } : null
    }
  } catch {
    // 同時に作られた（unique の衝突）: 読み直す
    const again = await prisma.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool, organizationId } }, select: { companyId: true } })
    if (!again) return null
    const c = await prisma.accountCompany.findUnique({ where: { id: again.companyId }, select: { id: true, userId: true } })
    return c ? { companyId: c.id, ownerUserId: c.userId, linked: true } : null
  }
  return { companyId: own.id, ownerUserId: own.userId, linked: true }
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

export type LinkToolOrgDecision = CompanyToolLinkDecision

/** Current company/tool authority and destination seats are pinned until commit. */
export async function linkToolOrg(input: { companyId: string; actorUserId: string; actorIsAdmin: boolean; tool: ToolId; organizationId: string }, options: { onLinked?: (tx: Prisma.TransactionClient) => Promise<void> } = {}): Promise<LinkToolOrgDecision> {
  const { linkCompanyToolOrganization } = await import('./link-seat.server')
  return linkCompanyToolOrganization(input, options)
}

/** 会社のオーナーだけが、自分の会社につながった組織のつながりを外す（誤ってつながった組織を直すため。外すと上限が外れるので、管理者には許さない） */
export async function unlinkToolOrg(input: { companyId: string; actorIsOwner: boolean; tool: ToolId; organizationId: string }): Promise<{ ok: true } | { ok: false; status: number; code: 'NOT_ALLOWED' | 'NOT_FOUND' }> {
  if (!input.actorIsOwner) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  const r = await prisma.accountCompanyToolOrg.deleteMany({ where: { tool: input.tool, organizationId: input.organizationId, companyId: input.companyId } })
  return r.count === 1 ? { ok: true } : { ok: false, status: 404, code: 'NOT_FOUND' }
}


/** Read the existing company attribution inside a guarded write transaction.
 * No profile, central membership, or inferred link is created here. Company
 * rows precede link/central-membership/domain locks. Missing or changed explicit
 * links are unavailable rather than an unowned scope that removes the ceiling.
 * Full admission/context/link-writer coordination remains the caller's job.
 */
export async function readCompanyOfToolOrgInTransaction(tool: ToolId, organizationId: string, tx: Prisma.TransactionClient): Promise<{ companyId: string; ownerUserId: string; linked: boolean } | null> {
  if (!organizationId || !Object.prototype.hasOwnProperty.call(TOOL_ROLE_TABLES, tool)) throw new Error('INVALID_TOOL_SCOPE')
  const first = await tx.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool, organizationId } }, select: { companyId: true } })
  if (first) {
    const companies = await tx.$queryRaw<Array<{ id: string; userId: string }>>`SELECT id, "userId" FROM account_companies WHERE id = ${first.companyId} FOR SHARE`
    if (companies.length !== 1) throw new Error('COMPANY_SCOPE_UNAVAILABLE')
    const links = await tx.$queryRaw<Array<{ companyId: string }>>`SELECT "companyId" FROM account_company_tool_orgs WHERE tool = ${tool} AND "organizationId" = ${organizationId} FOR SHARE`
    if (links.length !== 1 || links[0].companyId !== first.companyId) throw new Error('COMPANY_SCOPE_CHANGED')
    return { companyId: companies[0].id, ownerUserId: companies[0].userId, linked: true }
  }
  const readers = {
    kintai: tx.kintaiMember, hr: tx.hrOrganizationMember, quote: tx.quoteMember,
    income: tx.incomeMember, expense: tx.expenseMember, sfa: tx.sfaMember,
    shodan: tx.shodanMember, aio: tx.aioMember, mensetsu: tx.mensetsuMember,
    aishodan: tx.aishodanMember,
  } as unknown as Record<Exclude<ToolId, 'promane'>, OrgMemberDelegate>
  const creator = tool === 'promane'
    ? (await tx.promaneWorkspace.findUnique({ where: { id: organizationId }, select: { userId: true } }))?.userId
    : (await readers[tool].findFirst({ where: { organizationId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { userId: true } }))?.userId
  if (!creator) return null
  const companies = await tx.$queryRaw<Array<{ id: string; userId: string }>>`SELECT id, "userId" FROM account_companies WHERE "userId" = ${creator} FOR SHARE`
  if (!companies.length) return null
  if (companies.length !== 1) throw new Error('COMPANY_SCOPE_UNAVAILABLE')
  const company = companies[0]
  const links = await tx.$queryRaw<Array<{ companyId: string }>>`SELECT "companyId" FROM account_company_tool_orgs WHERE tool = ${tool} AND "organizationId" = ${organizationId} FOR SHARE`
  if (links.length) {
    if (links.length !== 1 || links[0].companyId !== company.id) throw new Error('COMPANY_SCOPE_CHANGED')
    return { companyId: company.id, ownerUserId: company.userId, linked: true }
  }
  const top = tool === 'promane'
    ? await tx.promaneMember.findFirst({ where: { workspaceId: organizationId, userId: creator, role: 'owner', isActive: true }, select: { id: true } })
    : await readers[tool].findFirst({ where: { organizationId, userId: creator, role: TOOL_ROLE_TABLES[tool].order.at(-1)!, status: 'ACTIVE' }, orderBy: [{ createdAt: 'asc' }], select: { userId: true } })
  // Match the existing inferred-attribution policy without persisting a link.
  return { companyId: company.id, ownerUserId: company.userId, linked: !!top }
}
