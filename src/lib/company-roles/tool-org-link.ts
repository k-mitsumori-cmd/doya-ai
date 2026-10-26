// ============================================
// 管理者が手でツールの組織を会社につないでよいか（純粋な関数。DB は tool-orgs.server.ts）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §4.1
// 決まり（2026-10-26 統括の再監査 重大1 への対応）:
// - つなぐ人は、会社の管理者以上（トランザクションの中で読み直した役割）で、その組織の最上位の役割（ACTIVE）にいること。
// - その組織の最上位の役割（ACTIVE）の人が全員、つなぐ先の会社の人（持ち主か active のメンバー）であること。
//   ほかの会社の人が最上位にいる組織（例: 別の会社の持ち主が作った組織）は、つながない（他社の組織を取れないように）。
// - すでにほかの会社につながっていれば、つながない。同じ会社なら、何もしないで成功。
import { hasMinCompanyRole, type CompanyRole } from './roles'

export type ToolOrgLinkDecision =
  | { ok: true; action: 'create' | 'none' }
  | { ok: false; status: number; code: 'NOT_ALLOWED' | 'NOT_TOP_MEMBER' | 'FOREIGN_TOP_MEMBER' | 'LINKED_ELSEWHERE' | 'INVALID' }

export function decideToolOrgLink(input: {
  /** つなぐ人の、つなぐ先の会社での役割（読み直したもの。会社にいなければ null） */
  actorRole: CompanyRole | null
  actorIsTopMember: boolean
  /** 組織の最上位の役割（ACTIVE）の人ごとに、つなぐ先の会社の人かどうか */
  topMembersInCompany: boolean[]
  /** 今のつながりの会社（無ければ null） */
  linkedCompanyId: string | null
  companyId: string
}): ToolOrgLinkDecision {
  if (!input.actorRole || !hasMinCompanyRole(input.actorRole, 'admin')) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  if (!input.actorIsTopMember) return { ok: false, status: 403, code: 'NOT_TOP_MEMBER' }
  if (input.linkedCompanyId) {
    return input.linkedCompanyId === input.companyId ? { ok: true, action: 'none' } : { ok: false, status: 409, code: 'LINKED_ELSEWHERE' }
  }
  if (input.topMembersInCompany.length === 0 || input.topMembersInCompany.some((v) => !v)) return { ok: false, status: 409, code: 'FOREIGN_TOP_MEMBER' }
  return { ok: true, action: 'create' }
}
