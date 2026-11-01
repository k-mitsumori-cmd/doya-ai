// ============================================
// 会社の役割の判定（サーバーだけ。Prisma で読む）
// ============================================
// 使い方（API の中。各ツールの今の判定はそのまま残し、その前に足す）:
//   const auth = await authorizeCompanyActionForSession({ userId, email, permission: 'kintai.attendance.edit.all', target: { isSelf } })
//   if (!auth.allowed) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT が off なら、DB を一切読まない（新しい表が本番DBに無いうちに落ちないように）。
// ⚠️ account_company_members は新しい料金の表。新しい料金の表を使えないとき（teamTablesAllowed が false）は、読まない。
//    COMPANY_ROLES_ROLLOUT を off 以外にするのは、新しい料金の表と ROLES §8.2 の表を本番DBに流したあと。
import { prisma } from '@/lib/prisma'
import { newPricingRollout } from '@/lib/pricing-v2/rollout'
import { teamPriceConfig } from '@/lib/pricing-v2/prices'
import { applyCompanyCeiling, authorizeCompanyAction, loadRolePolicy, resolveCompanyRole, type CompanyAuthorization, type CompanyRoleContext, type CompanyRoleDb, type RoleEventRecord, type ShadowDenial } from './access'
import type { CompanyPermission, PermissionTarget } from './permissions'
import type { CompanyRolePolicy } from './policy'
import { companyRolesModeFor, companyRolesRollout } from './rollout'
import type { ToolId } from './tool-roles'
import { companyOfToolOrg } from './tool-orgs.server'

// team.server.ts の teamTablesAllowed と同じ判定（Stripe を読み込まないよう、ここで同じことを書く）
function teamTablesAllowed(): boolean {
  return newPricingRollout() !== 'off' && teamPriceConfig().ok
}

// ⚠️ 会社のメンバーの表（新しい料金）を使えないときは、会社の役割を何も決めない（どの判定も止めない）。監査の軽微7
export const prismaCompanyRoleDb: CompanyRoleDb = {
  async findOwnedCompany(userId) {
    if (!teamTablesAllowed()) return null
    return prisma.accountCompany.findUnique({ where: { userId }, select: { id: true } })
  },
  async findCompanyOfToolOrg(tool, organizationId) {
    if (!teamTablesAllowed()) return null
    return companyOfToolOrg(tool, organizationId)
  },
  async findMembershipIn(userId, companyId) {
    if (!teamTablesAllowed()) return null
    return prisma.accountCompanyMember.findFirst({ where: { userId, companyId, status: 'active' }, select: { role: true } })
  },
  async findActiveMembership(userId) {
    if (!teamTablesAllowed()) return null
    return prisma.accountCompanyMember.findFirst({
      where: { userId, status: 'active' },
      orderBy: { joinedAt: 'asc' },
      select: { companyId: true, role: true },
    })
  },
  async findPolicy(companyId) {
    const row = await prisma.accountCompanyRoleSetting.findUnique({ where: { companyId }, select: { policy: true } })
    return row?.policy ?? null
  },
}

function logShadowDenial(d: ShadowDenial) {
  // 止めるはずだった操作。on にする前に、ふだんの使い方で止まる人がいないかを見る（Vercel のログで [company-roles:shadow] を探す）
  console.warn('[company-roles:shadow]', JSON.stringify(d))
}

export async function authorizeCompanyActionForSession(input: {
  userId: string
  /** 渡さなければ、旗が off でないときだけセッションから読む */
  email?: string | null
  permission: CompanyPermission
  target?: PermissionTarget
  /** ツールの中の操作は必ず渡す（その組織が属する会社で判定する） */
  scope?: { tool: ToolId; organizationId: string }
}): Promise<CompanyAuthorization> {
  if (companyRolesRollout() === 'off') return { checked: false, allowed: true, mode: 'off' }
  const mode = companyRolesModeFor(input.email !== undefined ? input.email : await sessionEmail())
  if (mode === 'off') return { checked: false, allowed: true, mode: 'off' }
  try {
    return await authorizeCompanyAction({
      userId: input.userId,
      permission: input.permission,
      target: input.target,
      scope: input.scope,
      mode,
      db: prismaCompanyRoleDb,
      onShadowDenial: logShadowDenial,
    })
  } catch (e) {
    // 読めなかったとき: 止める旗なら拒否（fail-closed）。shadow なら今の判定のまま通す
    console.error('[company-roles] 判定に失敗しました')
    if (mode === 'enforce') return { checked: true, allowed: false, mode, context: null, decision: { ok: false, reason: 'NO_COMPANY' } }
    return { checked: false, allowed: true, mode: 'off' }
  }
}

/** 役割の変更の記録を書く。旗が off なら書かない。tx を渡せば、変更と同じトランザクションで書く */
export async function writeRoleEvent(event: RoleEventRecord, tx: Pick<typeof prisma, 'accountCompanyRoleEvent'> = prisma): Promise<boolean> {
  if (companyRolesRollout() === 'off') return false
  await tx.accountCompanyRoleEvent.create({ data: event })
  return true
}

/** 今の人の会社の役割と、会社の決まり（画面の出し分けをサーバーで決めるため）。旗が off なら null */
export async function companyRoleForSession(input: { userId: string; email?: string | null }): Promise<(CompanyRoleContext & { policy: CompanyRolePolicy; mode: 'shadow' | 'enforce' }) | null> {
  if (companyRolesRollout() === 'off') return null
  const mode = companyRolesModeFor(input.email !== undefined ? input.email : await sessionEmail())
  if (mode === 'off') return null
  const ctx = await resolveCompanyRole(input.userId, prismaCompanyRoleDb)
  if (!ctx) return null
  return { ...ctx, policy: await loadRolePolicy(ctx.companyId, prismaCompanyRoleDb), mode }
}

function logShadowClamp(d: unknown) {
  console.warn('[company-roles:shadow-clamp]', JSON.stringify(d))
}

async function sessionEmail(): Promise<string | null> {
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([import('next-auth'), import('@/lib/auth')])
    const session = await getServerSession(authOptions)
    return session?.user?.email ?? null
  } catch {
    return null
  }
}

/**
 * 各ツールの get{Svc}Context の最後で呼ぶ。ツールの役割に会社の上限を当てる。
 * 旗が off なら、セッションも DB も読まずにそのまま返す。読めなかったときは、止める旗なら null（使えない）、shadow ならそのまま。
 * email を渡さなければ、旗が off でないときだけセッションから読む（preview の判定のため）。
 */
export async function ceilToolRole(input: { tool: ToolId; userId: string; organizationId: string; email?: string | null; toolRole: string }): Promise<string | null> {
  if (companyRolesRollout() === 'off') return input.toolRole
  const email = input.email !== undefined ? input.email : await sessionEmail()
  const mode = companyRolesModeFor(email)
  if (mode === 'off') return input.toolRole
  try {
    return await applyCompanyCeiling({ tool: input.tool, userId: input.userId, organizationId: input.organizationId, toolRole: input.toolRole, mode, db: prismaCompanyRoleDb, onShadowClamp: logShadowClamp })
  } catch (e) {
    console.error('[company-roles] 上限の判定に失敗しました')
    return mode === 'enforce' ? null : input.toolRole
  }
}

/** 記録を作った人を残す（旗が off なら残さない）。同じ記録には1回だけ */
export async function recordAuthor(input: { tool: ToolId; recordId: string; userId: string }): Promise<void> {
  if (companyRolesRollout() === 'off') return
  try {
    await prisma.accountCompanyRecordAuthor.upsert({
      where: { tool_recordId: { tool: input.tool, recordId: input.recordId } },
      create: input,
      update: {},
    })
  } catch (e) {
    console.error('[company-roles] 作った人を残せませんでした')
  }
}

/** 記録を作った人（分からなければ null） */
export async function findRecordAuthor(tool: ToolId, recordId: string): Promise<string | null> {
  if (companyRolesRollout() === 'off') return null
  try {
    const row = await prisma.accountCompanyRecordAuthor.findUnique({ where: { tool_recordId: { tool, recordId } }, select: { userId: true } })
    return row?.userId ?? null
  } catch {
    // 表が無い・読めないときは「作った人が分からない」として扱う（見積の確定は止める側に倒れる。500 にしない。再監査の軽微4）
    console.error('[company-roles] 作った人を読めませんでした')
    return null
  }
}
