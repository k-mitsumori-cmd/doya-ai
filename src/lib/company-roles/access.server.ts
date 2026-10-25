// ============================================
// 会社の役割の判定（サーバーだけ。Prisma で読む）
// ============================================
// 使い方（API の中。各ツールの今の判定はそのまま残し、その前に足す）:
//   const auth = await authorizeCompanyActionForSession({ userId, email, permission: 'kintai.attendance.edit.all', target: { isSelf } })
//   if (!auth.allowed) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT が off なら、DB を一切読まない（新しい表が本番DBに無いうちに落ちないように）。
// ⚠️ account_company_members は新しい料金のブランチ（claude/doya-new-pricing-dd27ff）で足す表。
//    そのブランチが main に入るまで、この型は Prisma の生成物に無いので、読むところだけを狭い型で書いている。
//    main に入ったら、prisma.accountCompanyMember をそのまま使う形に直す（ROLES-2026-10-26.md §8）。
import { prisma } from '@/lib/prisma'
import { authorizeCompanyAction, type CompanyAuthorization, type CompanyRoleDb, type RoleEventRecord, type ShadowDenial } from './access'
import type { CompanyPermission, PermissionTarget } from './permissions'
import { companyRolesModeFor, companyRolesRollout } from './rollout'

interface MemberDelegate {
  findFirst(args: {
    where: { userId: string; status: string }
    orderBy: { joinedAt: 'asc' }
    select: { companyId: true; role: true }
  }): Promise<{ companyId: string; role: string } | null>
}

interface RoleEventDelegate {
  create(args: { data: RoleEventRecord }): Promise<unknown>
}

function memberDelegate(): MemberDelegate | null {
  const d = (prisma as unknown as { accountCompanyMember?: MemberDelegate }).accountCompanyMember
  return d ?? null
}

export const prismaCompanyRoleDb: CompanyRoleDb = {
  async findOwnedCompany(userId) {
    return prisma.accountCompany.findUnique({ where: { userId }, select: { id: true } })
  },
  async findActiveMembership(userId) {
    const d = memberDelegate()
    if (!d) return null
    return d.findFirst({ where: { userId, status: 'active' }, orderBy: { joinedAt: 'asc' }, select: { companyId: true, role: true } })
  },
}

function logShadowDenial(d: ShadowDenial) {
  // 止めるはずだった操作。on にする前に、ふだんの使い方で止まる人がいないかを見る（Vercel のログで [company-roles:shadow] を探す）
  console.warn('[company-roles:shadow]', JSON.stringify(d))
}

export async function authorizeCompanyActionForSession(input: {
  userId: string
  email: string | null | undefined
  permission: CompanyPermission
  target?: PermissionTarget
}): Promise<CompanyAuthorization> {
  const mode = companyRolesModeFor(input.email)
  if (mode === 'off') return { checked: false, allowed: true, mode: 'off' }
  try {
    return await authorizeCompanyAction({
      userId: input.userId,
      permission: input.permission,
      target: input.target,
      mode,
      db: prismaCompanyRoleDb,
      onShadowDenial: logShadowDenial,
    })
  } catch (e) {
    // 読めなかったとき: 止める旗なら拒否（fail-closed）。shadow なら今の判定のまま通す
    console.error('[company-roles] 判定に失敗しました', e)
    if (mode === 'enforce') return { checked: true, allowed: false, mode, context: null, decision: { ok: false, reason: 'NO_COMPANY' } }
    return { checked: false, allowed: true, mode: 'off' }
  }
}

/** 役割の変更の記録を書く。表が無い（旗が off・未反映）ときは書かない */
export async function writeRoleEvent(event: RoleEventRecord): Promise<boolean> {
  if (companyRolesRollout() === 'off') return false
  const d = (prisma as unknown as { accountCompanyRoleEvent?: RoleEventDelegate }).accountCompanyRoleEvent
  if (!d) return false
  await d.create({ data: event })
  return true
}
