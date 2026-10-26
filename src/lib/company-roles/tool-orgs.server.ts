// ============================================
// ツールの組織と会社のつながり（サーバーだけ）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §4.1
// 決まり（2026-10-26 統括の決定。推し量る決まりが点検のたびに逆向きの指摘を受けたため、明示のつながりだけを正にする）:
// - ツールの組織が属する会社は、表 account_company_tool_orgs（AccountCompanyToolOrg）だけで決める。作った人などからは推し量らない。
// - つなぐ時は3つ。①組織を作るその時（linkToolOrgAtCreation。作った人が会社の持ち主か管理者なら、その会社につなぐ）
//   ②旗を入れる前からある組織は、一度だけ流す SQL（ROLES §8.3）でつなぐ ③会社の管理者以上が、自分が最上位の役割の組織を明示してつなぐ（linkToolOrg）。
// - 表に無い組織は、どの会社にも属さない。上限も決まりも当てない。
// - つながりを外せるのは、会社のオーナーだけ（unlinkToolOrg）。外したら記録に残す。
import { prisma } from '@/lib/prisma'
import { TOOL_ROLE_TABLES, type ToolId } from './tool-roles'
import { companyRolesRollout } from './rollout'
import type { Prisma } from '@prisma/client'
import { isMemberRowRole, type CompanyRole } from './roles'
import { decideToolOrgLink, type ToolOrgLinkDecision } from './tool-org-link'
export type { ToolOrgLinkDecision }

type Db = typeof prisma | Prisma.TransactionClient

export type OrgMemberDelegate = {
  findMany(args: { where: Record<string, unknown>; select: Record<string, true> }): Promise<Array<{ organizationId: string; userId: string | null; role: string }>>
  findFirst(args: { where: Record<string, unknown>; orderBy: Array<Record<string, 'asc' | 'desc'>>; select: Record<string, true> }): Promise<{ userId: string | null } | null>
}

// 組織とメンバーの表が同じ形（organizationId・userId・role・status=ACTIVE・createdAt）のツール
export const ORG_TOOLS: Array<{ tool: Exclude<ToolId, 'promane'>; delegate: (db?: Db) => OrgMemberDelegate }> = [
  { tool: 'kintai', delegate: (db: Db = prisma) => db.kintaiMember as unknown as OrgMemberDelegate },
  { tool: 'hr', delegate: (db: Db = prisma) => db.hrOrganizationMember as unknown as OrgMemberDelegate },
  { tool: 'quote', delegate: (db: Db = prisma) => db.quoteMember as unknown as OrgMemberDelegate },
  { tool: 'income', delegate: (db: Db = prisma) => db.incomeMember as unknown as OrgMemberDelegate },
  { tool: 'expense', delegate: (db: Db = prisma) => db.expenseMember as unknown as OrgMemberDelegate },
  { tool: 'sfa', delegate: (db: Db = prisma) => db.sfaMember as unknown as OrgMemberDelegate },
  { tool: 'shodan', delegate: (db: Db = prisma) => db.shodanMember as unknown as OrgMemberDelegate },
  { tool: 'aio', delegate: (db: Db = prisma) => db.aioMember as unknown as OrgMemberDelegate },
  { tool: 'mensetsu', delegate: (db: Db = prisma) => db.mensetsuMember as unknown as OrgMemberDelegate },
  { tool: 'aishodan', delegate: (db: Db = prisma) => db.aishodanMember as unknown as OrgMemberDelegate },
]

/** ツールの組織が属する会社（表につながっていなければ null） */
export async function companyOfToolOrg(tool: ToolId, organizationId: string): Promise<{ companyId: string; ownerUserId: string } | null> {
  const link = await prisma.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool, organizationId } }, select: { companyId: true } })
  if (!link) return null
  const company = await prisma.accountCompany.findUnique({ where: { id: link.companyId }, select: { id: true, userId: true } })
  return company ? { companyId: company.id, ownerUserId: company.userId } : null
}

/**
 * 組織を作るその時に、会社とのつながりを書く。各ツールの組織を作る処理から、作成のトランザクションが確定した直後に呼ぶ
 * （トランザクションの中で失敗すると、組織の作成まで失敗するため。中では呼ばない）。
 * - 作った人が会社の持ち主なら、その会社。持ち主でなく、会社の管理者（account_company_members の role=admin、active）なら、その会社。
 * - それ以外（社員が自分で作った組織・会社を持たない人の組織）は、つながない。
 * ⚠️ 旗 COMPANY_ROLES_ROLLOUT が off のときは、何もしない（表が本番DBに無いうちに落ちないように）。旗を入れたあとに、§8.3 の SQL で抜けを埋める。
 * ⚠️ 失敗しても、組織の作成は止めない（つながらなかった組織は、管理者があとでつなげる）。
 */
export async function linkToolOrgAtCreation(input: { tool: ToolId; organizationId: string; creatorUserId: string }): Promise<boolean> {
  if (companyRolesRollout() === 'off' || !input.organizationId || !input.creatorUserId) return false
  try {
    const own = await prisma.accountCompany.findUnique({ where: { userId: input.creatorUserId }, select: { id: true } })
    let companyId = own?.id ?? null
    if (!companyId) {
      const m = await prisma.accountCompanyMember.findFirst({ where: { userId: input.creatorUserId, status: 'active', role: 'admin' }, orderBy: { joinedAt: 'asc' }, select: { companyId: true } })
      companyId = m?.companyId ?? null
    }
    if (!companyId) return false
    await prisma.accountCompanyToolOrg.upsert({
      where: { tool_organizationId: { tool: input.tool, organizationId: input.organizationId } },
      create: { tool: input.tool, organizationId: input.organizationId, companyId, linkedBy: input.creatorUserId },
      update: {},
    })
    return true
  } catch {
    // 監視のための印。ログで [company-roles:link-failed] を探す。つながらなかった組織は、ROLES §8.3 の②を流し直すと埋まる（何度流してもよい）
    console.error('[company-roles:link-failed]', JSON.stringify({ tool: input.tool, organizationId: input.organizationId }))
    return false
  }
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

/** 組織の最上位の役割（ACTIVE）の人の User.id */
async function toolOrgTopMemberIds(tool: ToolId, organizationId: string, db: typeof prisma | Prisma.TransactionClient): Promise<string[]> {
  if (tool === 'promane') {
    const rows = await db.promaneMember.findMany({ where: { workspaceId: organizationId, isActive: true, role: 'owner' }, select: { userId: true } })
    return rows.map((r) => r.userId)
  }
  const t = ORG_TOOLS.find((x) => x.tool === tool)
  if (!t) return []
  const order = TOOL_ROLE_TABLES[tool].order
  const rows = await t.delegate(db).findMany({ where: { organizationId, role: order[order.length - 1], status: 'ACTIVE' }, select: { organizationId: true, userId: true, role: true } })
  return rows.map((r) => r.userId).filter((v): v is string => !!v)
}

/** その人が、会社の持ち主か active のメンバーなら、その会社での役割 */
async function roleInCompany(userId: string, companyId: string, db: typeof prisma | Prisma.TransactionClient): Promise<CompanyRole | null> {
  const company = await db.accountCompany.findUnique({ where: { id: companyId }, select: { userId: true } })
  if (!company) return null
  if (company.userId === userId) return 'owner'
  const m = await db.accountCompanyMember.findFirst({ where: { companyId, userId, status: 'active' }, select: { role: true } })
  if (!m) return null
  return isMemberRowRole(m.role) ? m.role : 'guest'
}

/**
 * 会社の管理者以上が、自分が最上位の役割の組織を、会社につなぐ（POST /api/company/tool-orgs）。
 * 決まりは tool-org-link.ts（テストあり）。役割はトランザクションの中で読み直す。同時に送られて一意の制約に当たったら、読み直して返す（503 にしない）。
 */
export async function linkToolOrg(input: { companyId: string; actorUserId: string; tool: ToolId; organizationId: string }): Promise<ToolOrgLinkDecision> {
  if (!input.organizationId || input.organizationId.length > 128) return { ok: false, status: 400, code: 'INVALID' }
  try {
    return await prisma.$transaction(async (tx) => {
      const actorRole = await roleInCompany(input.actorUserId, input.companyId, tx)
      const top = await toolOrgTopMemberIds(input.tool, input.organizationId, tx)
      const inCompany = await Promise.all(top.map(async (uid) => (await roleInCompany(uid, input.companyId, tx)) !== null))
      const existing = await tx.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool: input.tool, organizationId: input.organizationId } }, select: { companyId: true } })
      const d = decideToolOrgLink({ actorRole, actorIsTopMember: top.includes(input.actorUserId), topMembersInCompany: inCompany, linkedCompanyId: existing?.companyId ?? null, companyId: input.companyId })
      if (!d.ok || d.action === 'none') return d
      await tx.accountCompanyToolOrg.create({ data: { tool: input.tool, organizationId: input.organizationId, companyId: input.companyId, linkedBy: input.actorUserId } })
      return d
    }, { isolationLevel: 'Serializable' })
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code !== 'P2002' && code !== 'P2034') throw e
    // 同時につながれた: 読み直す
    const again = await prisma.accountCompanyToolOrg.findUnique({ where: { tool_organizationId: { tool: input.tool, organizationId: input.organizationId } }, select: { companyId: true } })
    if (again?.companyId === input.companyId) return { ok: true, action: 'none' }
    return { ok: false, status: 409, code: 'LINKED_ELSEWHERE' }
  }
}

/** 会社のオーナーだけが、自分の会社につながった組織のつながりを外す（誤ってつながった組織を直すため。外すと上限が外れるので、管理者には許さない） */
export async function unlinkToolOrg(input: { companyId: string; actorIsOwner: boolean; tool: ToolId; organizationId: string }): Promise<{ ok: true } | { ok: false; status: number; code: 'NOT_ALLOWED' | 'NOT_FOUND' }> {
  if (!input.actorIsOwner) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  const r = await prisma.accountCompanyToolOrg.deleteMany({ where: { tool: input.tool, organizationId: input.organizationId, companyId: input.companyId } })
  return r.count === 1 ? { ok: true } : { ok: false, status: 404, code: 'NOT_FOUND' }
}
