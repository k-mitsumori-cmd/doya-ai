// ============================================
// 社員ごとの部署（サーバーだけ。Prisma で読む・書く）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §11
// 読む口: getMemberDepartments(userId) → { primary, all }（UI リニューアルの部署ごとの入口が使う）
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT が off、新しい料金の表が使えない、会社に入っていない、表が読めない、のどれでも
//    ALL_DEPARTMENTS（全部を出す。今のメニューと同じ）を返す。部署はメニューの並びに使うだけで、権限の判定には使わない。
import { prisma } from '@/lib/prisma'
import { buildRoleEvent } from './access'
import { companyRoleForSession, writeRoleEvent } from './access.server'
import { ALL_DEPARTMENTS, decideDepartmentsUpdate, memberDepartmentsFor, type DepartmentsUpdateDecision, type MemberDepartments } from './departments'
import type { CompanyRolesSession } from './members.server'
import { hasMinCompanyRole, isMemberRowRole } from './roles'
import { companyRolesRollout } from './rollout'

/** 今の人の部署（画面に渡す形）。email を渡さなければ、旗が off でないときだけセッションから読む */
export async function getMemberDepartments(userId: string, email?: string | null): Promise<MemberDepartments> {
  if (companyRolesRollout() === 'off' || !userId) return ALL_DEPARTMENTS
  try {
    const ctx = await companyRoleForSession({ userId, email })
    if (!ctx) return ALL_DEPARTMENTS
    const row = await prisma.accountCompanyMemberDepartment.findUnique({
      where: { companyId_userId: { companyId: ctx.companyId, userId } },
      select: { departments: true },
    })
    return memberDepartmentsFor({ role: ctx.role, departments: row?.departments ?? [] })
  } catch {
    console.error('[company-roles] 部署を読めませんでした')
    return ALL_DEPARTMENTS
  }
}

/** 会社のメンバー全員の部署（管理画面用。userId → 部署） */
export async function listCompanyDepartments(s: CompanyRolesSession): Promise<Record<string, string[]>> {
  const rows = await prisma.accountCompanyMemberDepartment.findMany({ where: { companyId: s.companyId }, select: { userId: true, departments: true } })
  return Object.fromEntries(rows.map((r) => [r.userId, r.departments]))
}

/**
 * メンバーの部署を決める（管理者以上）。memberId は account_company_members の id。持ち主は 'owner' を渡す。
 * 変えたら役割の変更と同じ記録に残す（kind=departments_changed。note に部署を書く）。
 * 操作する人の役割は、トランザクションの中で読み直す（再監査の軽微3）。
 */
export async function setMemberDepartments(s: CompanyRolesSession, memberId: string, raw: unknown): Promise<DepartmentsUpdateDecision | { ok: false; status: number; code: 'NOT_ALLOWED' | 'NOT_FOUND' }> {
  if (!hasMinCompanyRole(s.role, 'admin')) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  const d = decideDepartmentsUpdate(raw)
  if (!d.ok) return d
  const company = await prisma.accountCompany.findUnique({ where: { id: s.companyId }, select: { userId: true, user: { select: { email: true } } } })
  if (!company) return { ok: false, status: 404, code: 'NOT_FOUND' }
  let target: { userId: string; email: string; memberId: string | null }
  if (memberId === 'owner') {
    target = { userId: company.userId, email: company.user?.email ?? '', memberId: null }
  } else {
    const m = await prisma.accountCompanyMember.findFirst({ where: { id: memberId, companyId: s.companyId, status: 'active' }, select: { id: true, userId: true, email: true } })
    if (!m?.userId) return { ok: false, status: 404, code: 'NOT_FOUND' }
    target = { userId: m.userId, email: m.email, memberId: m.id }
  }
  const denied = await prisma.$transaction(async (tx) => {
    // 操作する人の役割を読み直す（持ち主なら管理者以上。メンバーなら行の役割が admin のときだけ）
    if (company.userId !== s.userId) {
      const me = await tx.accountCompanyMember.findFirst({ where: { companyId: s.companyId, userId: s.userId, status: 'active' }, select: { role: true } })
      if (!me || !hasMinCompanyRole(isMemberRowRole(me.role) ? me.role : 'guest', 'admin')) return true
    }
    await tx.accountCompanyMemberDepartment.upsert({
      where: { companyId_userId: { companyId: s.companyId, userId: target.userId } },
      create: { companyId: s.companyId, userId: target.userId, departments: d.departments, updatedBy: s.userId },
      update: { departments: d.departments, updatedBy: s.userId },
    })
    await writeRoleEvent(buildRoleEvent({
      companyId: s.companyId,
      actorUserId: s.userId,
      targetMemberId: target.memberId,
      targetEmail: target.email,
      kind: 'departments_changed',
      fromRole: null,
      toRole: null,
      note: d.departments.join(',') || '(なし)',
    }), tx)
    return false
  })
  if (denied) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  return d
}
