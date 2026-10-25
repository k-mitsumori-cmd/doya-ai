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

export interface ShadowDenial {
  userId: string
  permission: CompanyPermission
  companyId: string | null
  role: CompanyRole | null
  reason: string
}

/**
 * 操作を通すか。
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
  onShadowDenial?: (d: ShadowDenial) => void
}): Promise<CompanyAuthorization> {
  if (input.mode === 'off') return { checked: false, allowed: true, mode: 'off' }
  const context = await resolveCompanyRole(input.userId, input.db)
  const policy = context ? await loadRolePolicy(context.companyId, input.db) : DEFAULT_ROLE_POLICY
  const decision = context
    ? decideCompanyPermission(context.role, input.permission, input.target, policy)
    : ({ ok: false, reason: 'NO_COMPANY' } as const)
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
 * ⚠️ 会社の上限は、その人の会社の役割で決める。ツールの組織が会社のものかどうかは、まだ見ていない（ROLES §10）。
 */
export async function applyCompanyCeiling(input: {
  tool: ToolId
  userId: string
  toolRole: string
  mode: CompanyRolesMode
  db: CompanyRoleDb
  onShadowClamp?: (d: { userId: string; tool: ToolId; toolRole: string; companyRole: CompanyRole; effective: string | null }) => void
}): Promise<string | null> {
  if (input.mode === 'off') return input.toolRole
  const context = await resolveCompanyRole(input.userId, input.db)
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
export type RoleEventKind = 'invited' | 'joined' | 'role_changed' | 'removed' | 'migrated' | 'policy_changed'

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
