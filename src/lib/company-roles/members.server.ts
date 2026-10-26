// ============================================
// 会社のメンバーと役割（一覧・変更・記録・切り替え）。サーバーだけ
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §6
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT が off なら、どの関数も呼ばれない（API が 404 を返す）。
// ⚠️ 会社はセッションの本人から決める（companyRoleForSession）。body・query の会社 ID は受け取らない。
// ⚠️ 招待と外すのは新しい料金の /api/pricing/members（持ち主だけ）。ここは役割の変更と、見ることだけ。
import { prisma } from '@/lib/prisma'
import { buildRoleEvent } from './access'
import { companyRoleForSession, writeRoleEvent } from './access.server'
import { canCompany } from './permissions'
import { decidePolicyUpdate, POLICY_LABEL, type CompanyRolePolicy } from './policy'
import { canManageCompanyMember, decideRoleChange, grantableCompanyRoles, isMemberRowRole, type CompanyRole, type RoleChangeDecision } from './roles'

export type CompanyRolesSession = NonNullable<Awaited<ReturnType<typeof companyRoleForSession>>> & { userId: string }

/** API の入口。旗が off・会社に入っていないなら null（API は 404） */
export async function companyRolesSession(userId: string, email: string | null): Promise<CompanyRolesSession | null> {
  const ctx = await companyRoleForSession({ userId, email })
  return ctx ? { ...ctx, userId } : null
}

export interface MemberView {
  id: string | null // オーナーは行が無いので null
  email: string
  name: string | null
  role: CompanyRole
  status: 'owner' | 'active' | 'invited'
  isSelf: boolean
  canChange: boolean
  grantable: CompanyRole[]
}

/** メンバーと役割の一覧（オーナーを先頭に） */
export async function listMembersWithRoles(s: CompanyRolesSession): Promise<MemberView[]> {
  const company = await prisma.accountCompany.findUnique({
    where: { id: s.companyId },
    select: { userId: true, user: { select: { email: true, name: true } } },
  })
  if (!company) return []
  const rows = await prisma.accountCompanyMember.findMany({
    where: { companyId: s.companyId, status: { in: ['invited', 'active'] } },
    orderBy: { invitedAt: 'asc' },
    select: { id: true, email: true, userId: true, role: true, status: true },
  })
  const names = new Map(
    (await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId).filter((v): v is string => !!v) } }, select: { id: true, name: true } }))
      .map((u) => [u.id, u.name]),
  )
  const grantable = grantableCompanyRoles(s.role)
  const owner: MemberView = {
    id: null,
    email: company.user?.email ?? '',
    name: company.user?.name ?? null,
    role: 'owner',
    status: 'owner',
    isSelf: company.userId === s.userId,
    canChange: false,
    grantable: [],
  }
  return [
    owner,
    ...rows.map((r): MemberView => {
      const role: CompanyRole = isMemberRowRole(r.role) ? r.role : 'guest'
      const isSelf = r.userId === s.userId
      const canChange = canCompany(s.role, 'members.role.change', {}, s.policy) && canManageCompanyMember({ actor: s.role, target: role, isSelf })
      return {
        id: r.id,
        email: r.email,
        name: r.userId ? names.get(r.userId) ?? null : null,
        role,
        status: r.status === 'active' ? 'active' : 'invited',
        isSelf,
        canChange,
        grantable: canChange ? grantable : [],
      }
    }),
  ]
}

/** 役割を変える。変更と記録を同じトランザクションで書く */
export async function changeMemberRole(s: CompanyRolesSession, memberId: string, requested: unknown): Promise<RoleChangeDecision> {
  if (!canCompany(s.role, 'members.role.change', {}, s.policy)) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  return prisma.$transaction(async (tx) => {
    // 操作する人の役割を、トランザクションの中で読み直す（同時に自分の役割が下げられていたら、下がった役割で判定する。監査の中3）
    const company = await tx.accountCompany.findUnique({ where: { id: s.companyId }, select: { userId: true } })
    if (!company) return { ok: false as const, status: 403, code: 'NOT_ALLOWED' as const }
    let actor: CompanyRole
    if (company.userId === s.userId) {
      actor = 'owner'
    } else {
      await tx.$queryRaw`SELECT id FROM account_company_members WHERE "companyId" = ${s.companyId} AND "userId" = ${s.userId} AND status = 'active' FOR UPDATE`
      const me = await tx.accountCompanyMember.findFirst({ where: { companyId: s.companyId, userId: s.userId, status: 'active' }, select: { role: true } })
      if (!me) return { ok: false as const, status: 403, code: 'NOT_ALLOWED' as const }
      actor = isMemberRowRole(me.role) ? me.role : 'guest'
    }
    if (!canCompany(actor, 'members.role.change', {}, s.policy)) return { ok: false as const, status: 403, code: 'NOT_ALLOWED' as const }
    // 会社と ID の二重の条件（他の会社の行は変えられない）。同時の変更を直列にするため行を押さえる
    await tx.$queryRaw`SELECT id FROM account_company_members WHERE id = ${memberId} AND "companyId" = ${s.companyId} FOR UPDATE`
    const target = await tx.accountCompanyMember.findFirst({
      where: { id: memberId, companyId: s.companyId },
      select: { id: true, email: true, userId: true, role: true, status: true },
    })
    if (!target) return { ok: false as const, status: 404, code: 'NOT_ACTIVE' as const }
    const d = decideRoleChange({ actor, isSelf: target.userId === s.userId, targetRole: target.role, targetStatus: target.status, requested })
    if (!d.ok) return d
    await tx.accountCompanyMember.update({ where: { id: target.id }, data: { role: d.to } })
    await writeRoleEvent(buildRoleEvent({ companyId: s.companyId, actorUserId: s.userId, targetMemberId: target.id, targetEmail: target.email, kind: 'role_changed', fromRole: d.from, toRole: d.to }), tx)
    return d
  }, { isolationLevel: 'Serializable' })
}

export interface RoleEventView {
  id: string
  kind: string
  actorName: string | null
  targetEmail: string
  fromRole: string | null
  toRole: string | null
  note: string | null
  createdAt: string
}

/** 役割の変更の記録（新しい順。管理者以上） */
export async function listRoleEvents(s: CompanyRolesSession, opts: { before?: string; take?: number } = {}): Promise<{ events: RoleEventView[]; next: string | null } | null> {
  if (!canCompany(s.role, 'members.role_events.view', {}, s.policy)) return null
  const take = Math.min(Math.max(opts.take ?? 30, 1), 100)
  const before = opts.before ? new Date(opts.before) : null
  const rows = await prisma.accountCompanyRoleEvent.findMany({
    where: { companyId: s.companyId, ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
  })
  const page = rows.slice(0, take)
  const actors = new Map(
    (await prisma.user.findMany({ where: { id: { in: [...new Set(page.map((r) => r.actorUserId))] } }, select: { id: true, name: true, email: true } }))
      .map((u) => [u.id, u.name ?? u.email]),
  )
  return {
    events: page.map((r) => ({ id: r.id, kind: r.kind, actorName: actors.get(r.actorUserId) ?? null, targetEmail: r.targetEmail, fromRole: r.fromRole, toRole: r.toRole, note: r.note, createdAt: r.createdAt.toISOString() })),
    next: rows.length > take ? page[page.length - 1].createdAt.toISOString() : null,
  }
}

/** 会社の決まりを変える（オーナーだけ）。変えた項目を記録に残す */
export async function updateRolePolicy(s: CompanyRolesSession, patch: unknown): Promise<ReturnType<typeof decidePolicyUpdate>> {
  const d = decidePolicyUpdate({ actor: s.role, current: s.policy, patch })
  if (!d.ok) return d
  await prisma.$transaction(async (tx) => {
    await tx.accountCompanyRoleSetting.upsert({
      where: { companyId: s.companyId },
      create: { companyId: s.companyId, policy: d.policy as unknown as object, updatedBy: s.userId },
      update: { policy: d.policy as unknown as object, updatedBy: s.userId },
    })
    const owner = await tx.user.findUnique({ where: { id: s.userId }, select: { email: true } })
    await writeRoleEvent(buildRoleEvent({
      companyId: s.companyId,
      actorUserId: s.userId,
      targetMemberId: null,
      targetEmail: owner?.email ?? '',
      kind: 'policy_changed',
      fromRole: null,
      toRole: null,
      note: d.changed.map((k) => {
        const l = POLICY_LABEL[k] as { title: string; options: Record<string, string> }
        return `${l.title}: ${l.options[s.policy[k]]} → ${l.options[d.policy[k]]}`
      }).join(' / '),
    }), tx)
  })
  return d
}

export type { CompanyRolePolicy }
