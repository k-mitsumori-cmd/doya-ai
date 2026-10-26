// ============================================
// 会社の役割で、操作を通すかどうか（サーバーだけ。DB は引数で受け取る）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §5
// 決まり:
// - 会社の役割は、userId だけから決める（body や query の companyId・role は信じない）。
// - 持ち主（account_companies.userId）ならオーナー。そうでなければ、参加（active）しているメンバーの行の役割。
// - 行の役割が知らない値なら、いちばん低いゲストとして扱う（既定は拒否の側に倒す）。
// - 旗が off なら、何も読まずに「判定しない」を返す（今の各ツールの判定のまま）。
// - shadow なら、判定はするが止めない。止めるはずだったことを記録の関数に渡す。
// 実際の DB の読み方は access.server.ts。テストは company-roles.test.ts（偽の DB を渡す）。
import { decideCompanyPermission, type CompanyPermission, type PermissionDecision, type PermissionTarget } from './permissions'
import { normalizeRolePolicy, DEFAULT_ROLE_POLICY, type CompanyRolePolicy } from './policy'
import { isMemberRowRole, type CompanyRole } from './roles'
import { effectiveToolRole, type ToolId } from './tool-roles'
import type { CompanyRolesMode } from './rollout'

export interface CompanyRoleDb {
  /** 本人が持ち主の会社 */
  findOwnedCompany(userId: string): Promise<{ id: string } | null>
  /** 本人が参加している会社のメンバーの行（status = active のいちばん古いもの） */
  findActiveMembership(userId: string): Promise<{ companyId: string; role: string } | null>
  /** 会社ごとの切り替え（account_company_role_settings.policy）。無ければ null */
  findPolicy?(companyId: string): Promise<unknown | null>
  /** ツールの組織が属する会社（組織の最上位の人＝作った人が持ち主の会社）。分からなければ null */
  findCompanyOfToolOrg?(tool: ToolId, organizationId: string): Promise<{ companyId: string; ownerUserId: string; linked?: boolean } | null>
  /** その会社での、本人のメンバーの行（status = active） */
  findMembershipIn?(userId: string, companyId: string): Promise<{ role: string } | null>
}

/**
 * ツールの組織での、会社の役割（監査 2026-10-26 の重大1への対応）。
 * - その組織が属する会社を先に決め、その会社での本人の役割を返す。本人が自分で別の会社を作っても、ほかの会社の組織では使えない。
 * - 組織が会社につながっていない（account_company_tool_orgs に無く、作った人が会社の持ち主でもない）なら null。上限も決まりも当てない（設計書 §4.1。再監査の中B）。
 * - 会社の持ち主はオーナー。会社のメンバーの行があればその役割（知らない値はゲスト）。
 * - 会社のメンバーでない人（ツールだけに招かれた人）は、メンバーとして扱う（ツールの中で一般の役割まで）。
 */
export async function resolveCompanyRoleForOrg(userId: string, tool: ToolId, organizationId: string, db: CompanyRoleDb): Promise<CompanyRoleContext | null> {
  if (!userId || !organizationId || !db.findCompanyOfToolOrg) return null
  const org = await db.findCompanyOfToolOrg(tool, organizationId)
  if (!org) return null
  if (org.ownerUserId === userId) return { companyId: org.companyId, role: 'owner' }
  const m = db.findMembershipIn ? await db.findMembershipIn(userId, org.companyId) : null
  // 表にはつないでいない組織（作った人が引き継いだあと）では、会社に入っていない人に上限を当てない
  if (!m && org.linked === false) return null
  if (!m) return { companyId: org.companyId, role: 'member' }
  return { companyId: org.companyId, role: isMemberRowRole(m.role) ? m.role : 'guest' }
}

export async function loadRolePolicy(companyId: string, db: CompanyRoleDb): Promise<CompanyRolePolicy> {
  if (!db.findPolicy) return DEFAULT_ROLE_POLICY
  return normalizeRolePolicy(await db.findPolicy(companyId))
}

export interface CompanyRoleContext {
  companyId: string
  role: CompanyRole
}

export async function resolveCompanyRole(userId: string, db: CompanyRoleDb): Promise<CompanyRoleContext | null> {
  if (!userId) return null
  const own = await db.findOwnedCompany(userId)
  if (own) return { companyId: own.id, role: 'owner' }
  const m = await db.findActiveMembership(userId)
  if (!m) return null
  return { companyId: m.companyId, role: isMemberRowRole(m.role) ? m.role : 'guest' }
}

export type CompanyAuthorization =
  | { checked: false; allowed: true; mode: 'off' }
  | { checked: true; allowed: boolean; mode: 'shadow' | 'enforce'; context: CompanyRoleContext | null; decision: PermissionDecision | { ok: false; reason: 'NO_COMPANY' } }
  // context が null のときは、会社に属していない組織（止めない）

export interface ShadowDenial {
  userId: string
  permission: CompanyPermission
  companyId: string | null
  role: CompanyRole | null
  reason: string
}

/**
 * 操作を通すか。scope（ツールと組織）を渡したら、その組織が属する会社で判定する（ツールの中の操作は必ず渡す）。
 * scope ありで、組織が会社に属していないときは止めない（ツールの上限 applyCompanyCeiling と同じ扱い。監査の重大2）。
 * scope なしで、会社に入っていない人は止める（会社そのものの操作）。DB を読めないときは access.server.ts が止める側に倒す。
 * - off: 判定しない（allowed: true。今の各ツールの判定だけが効く）
 * - shadow: 判定して、拒否なら onShadowDenial に渡すが、allowed は true
 * - enforce: 判定どおり
 * ⚠️ 会社の役割は「上限」。ここで通っても、各ツールの今の判定（hasMinRole・organizationId の二重条件）は省かない。
 */
export async function authorizeCompanyAction(input: {
  userId: string
  permission: CompanyPermission
  target?: PermissionTarget
  mode: CompanyRolesMode
  db: CompanyRoleDb
  scope?: { tool: ToolId; organizationId: string }
  onShadowDenial?: (d: ShadowDenial) => void
}): Promise<CompanyAuthorization> {
  if (input.mode === 'off') return { checked: false, allowed: true, mode: 'off' }
  const context = input.scope
    ? await resolveCompanyRoleForOrg(input.userId, input.scope.tool, input.scope.organizationId, input.db)
    : await resolveCompanyRole(input.userId, input.db)
  if (!context) {
    // scope あり: 組織が会社に属していない（1人で使う人の組織）と確かめられたので、止めない（ツールの上限と同じ扱い）。
    // scope なし: 会社の画面などの会社そのものの操作。会社に入っていない人は止める（自動の点検の指摘 2026-10-26）。
    if (input.scope) return { checked: true, allowed: true, mode: input.mode, context: null, decision: { ok: true } }
    const decision = { ok: false, reason: 'NO_COMPANY' } as const
    if (input.mode === 'shadow') {
      input.onShadowDenial?.({ userId: input.userId, permission: input.permission, companyId: null, role: null, reason: decision.reason })
      return { checked: true, allowed: true, mode: 'shadow', context: null, decision }
    }
    return { checked: true, allowed: false, mode: 'enforce', context: null, decision }
  }
  const policy = await loadRolePolicy(context.companyId, input.db)
  const decision = decideCompanyPermission(context.role, input.permission, input.target, policy)
  if (input.mode === 'shadow') {
    if (!decision.ok) {
      input.onShadowDenial?.({
        userId: input.userId,
        permission: input.permission,
        companyId: context?.companyId ?? null,
        role: context?.role ?? null,
        reason: decision.reason,
      })
    }
    return { checked: true, allowed: true, mode: 'shadow', context, decision }
  }
  return { checked: true, allowed: decision.ok, mode: 'enforce', context, decision }
}

/**
 * ツールの入口（get{Svc}Context）で、ツールの役割に会社の上限を当てる。
 * - off: そのまま返す（DB を読まない）
 * - shadow: 下がるはずだったら記録し、そのまま返す
 * - enforce: 下げた役割を返す（null はこのツールを使えない）。会社に入っていない人（自分だけで使う人）は、そのまま
 * 会社の上限は、そのツールの組織が属する会社での役割で決める（resolveCompanyRoleForOrg）。
 */
export async function applyCompanyCeiling(input: {
  tool: ToolId
  userId: string
  organizationId: string
  toolRole: string
  mode: CompanyRolesMode
  db: CompanyRoleDb
  onShadowClamp?: (d: { userId: string; tool: ToolId; toolRole: string; companyRole: CompanyRole; effective: string | null }) => void
}): Promise<string | null> {
  if (input.mode === 'off') return input.toolRole
  const context = await resolveCompanyRoleForOrg(input.userId, input.tool, input.organizationId, input.db)
  if (!context) return input.toolRole
  const e = effectiveToolRole(input.tool, input.toolRole, context.role)
  if (!e.clamped) return e.role
  if (input.mode === 'shadow') {
    input.onShadowClamp?.({ userId: input.userId, tool: input.tool, toolRole: input.toolRole, companyRole: context.role, effective: e.role })
    return input.toolRole
  }
  return e.role
}

// ============================================
// 役割の変更の記録（誰が・いつ・誰を・何から何へ）
// ============================================
export type RoleEventKind = 'invited' | 'joined' | 'role_changed' | 'removed' | 'migrated' | 'policy_changed' | 'departments_changed' | 'tool_org_linked' | 'tool_org_unlinked'

export interface RoleEventRecord {
  companyId: string
  actorUserId: string
  targetMemberId: string | null
  targetEmail: string
  kind: RoleEventKind
  fromRole: CompanyRole | null
  toRole: CompanyRole | null
  note: string | null
}

/** 記録の行を作る（DB には access.server.ts で書く）。メールは小文字にそろえる */
export function buildRoleEvent(input: Omit<RoleEventRecord, 'targetEmail' | 'note'> & { targetEmail: string; note?: string | null }): RoleEventRecord {
  return {
    ...input,
    targetEmail: input.targetEmail.trim().toLowerCase(),
    note: input.note ? input.note.slice(0, 500) : null,
  }
}
