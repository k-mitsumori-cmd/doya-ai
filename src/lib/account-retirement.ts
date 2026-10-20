import { Prisma, type PrismaClient } from '@prisma/client'

// Closed identifiers and canonical roles from the current service access code.
const organizationServices = [
  ['hr', 'hr_organizations', 'hr_organization_members', 'OWNER', ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']],
  ['kintai', 'kintai_organizations', 'kintai_members', 'system_admin', ['system_admin', 'hr_admin', 'manager', 'employee']],
  ['sfa', 'sfa_organizations', 'sfa_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  ['shodan', 'shodan_organizations', 'shodan_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  ['aio', 'aio_organizations', 'aio_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  ['mensetsu', 'mensetsu_organizations', 'mensetsu_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  ['quote', 'quote_organizations', 'quote_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  ['aishodan', 'aishodan_organizations', 'aishodan_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  ['income', 'income_organizations', 'income_members', 'owner', ['owner', 'admin', 'manager', 'member']],
  ['expense', 'expense_organizations', 'expense_members', 'owner', ['owner', 'admin', 'manager', 'member']],
] as const

export class AccountRetirementBlocked extends Error {
  readonly code: string
  constructor(readonly reason: 'ownership' | 'membership' | 'promane_history' | 'user_missing') {
    super(reason === 'user_missing'
      ? 'アカウントの状態が変わりました。再読み込みしてご確認ください。この操作では契約を変更していません。'
      : reason === 'promane_history'
      ? 'プロジェクトのデータを保護するため、このアカウントはまだ削除できません。管理者にご相談ください。'
      : '組織の所属・招待・オーナー権限の確認が必要です。共同利用者の権限を引き継ぎ、招待や所属状態を整理してから再度お試しください。')
    this.code = reason === 'user_missing' ? 'ACCOUNT_STATE_CHANGED' : 'ACCOUNT_RETIREMENT_BLOCKED'
  }
}

/** Same User lock as authenticated application creation and AskLink cleanup. */
export async function lockRetirementUser(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
  return (await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`).some(row => row.id === userId)
}

/** Bounded prevention on the current schema; membership writers do not all share this lock yet. */
export async function assertAccountRetirementSafe(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  for (const [service, organizationTable, memberTable, ownerRole, knownRoles] of organizationServices) {
    const members = Prisma.raw(`"${memberTable}"`), organizations = Prisma.raw(`"${organizationTable}"`)
    const affected = await tx.$queryRaw<Array<{ organizationId: string }>>(Prisma.sql`
      SELECT DISTINCT "organizationId" FROM ${members} WHERE "userId" = ${userId} ORDER BY "organizationId"
    `)
    for (const { organizationId } of affected) {
      const organization = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM ${organizations} WHERE id = ${organizationId} FOR UPDATE`)
      if (!organization.length) throw new AccountRetirementBlocked('membership')
      const rows = await tx.$queryRaw<Array<{ userId: string | null; role: string; status: string; liveUser: boolean }>>(Prisma.sql`
        SELECT m."userId", m.role, m.status, EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId") AS "liveUser"
        FROM ${members} m WHERE m."organizationId" = ${organizationId} ORDER BY m.id FOR UPDATE OF m
      `)
      const mine = rows.filter(row => row.userId === userId)
      if (mine.length !== 1 || rows.some(row => row.status !== 'ACTIVE' || !row.liveUser || !(knownRoles as readonly string[]).includes(row.role)) || rows.filter(row => row.role === ownerRole).length !== 1) {
        throw new AccountRetirementBlocked('membership')
      }
      if (mine[0].role === ownerRole) {
        // Inactive and pending records also belong to other people. Never infer consent to remove them.
        if (rows.some(row => row.userId !== userId)) throw new AccountRetirementBlocked('ownership')
        if (service === 'hr' && await tx.hrInvitation.findFirst({ where: { organizationId, status: 'PENDING' }, select: { id: true } })) throw new AccountRetirementBlocked('ownership')
      }
    }
  }

  // Both references are non-null User Cascade in the current schema. Even after
  // handover, deleting a former member erases time/comments from a shared workspace.
  const workspaces = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM promane_workspaces WHERE "userId" = ${userId} ORDER BY id FOR UPDATE`
  for (const workspace of workspaces) {
    const members = await tx.$queryRaw<Array<{ userId: string; role: string; isActive: boolean }>>`SELECT "userId", role, "isActive" FROM promane_members WHERE "workspaceId" = ${workspace.id} ORDER BY id FOR UPDATE`
    if (members.some(member => member.userId !== userId || !member.isActive || member.role !== 'owner') || members.length > 1 || await tx.promaneInvitation.findFirst({ where: { workspaceId: workspace.id, acceptedAt: null }, select: { id: true } })) throw new AccountRetirementBlocked('ownership')
  }
  if (await tx.promaneMember.findFirst({ where: { userId }, select: { id: true } }) || await tx.promaneInvitation.findFirst({ where: { invitedById: userId }, select: { id: true } })) throw new AccountRetirementBlocked('promane_history')
}

/** Check before Stripe; repeat under the final deletion transaction's User lock. */
export async function checkAccountRetirementSafe(db: Pick<PrismaClient, '$transaction'>, userId: string): Promise<void> {
  await db.$transaction(async tx => {
    if (!await lockRetirementUser(tx, userId)) throw new AccountRetirementBlocked('user_missing')
    await assertAccountRetirementSafe(tx, userId)
  })
}

/** Caller owns the DB transaction, including AskLink outbox and the original User delete. */
export async function deleteAccountWithRetirement<T>(tx: Prisma.TransactionClient, userId: string, removeAccount: () => Promise<T>): Promise<T> {
  // Preserve the adapter's missing-row P2025/error behavior without creating metadata.
  if (!await lockRetirementUser(tx, userId)) return removeAccount()
  await assertAccountRetirementSafe(tx, userId)
  await tx.caseStudyApplication.updateMany({
    where: { userId },
    data: { userId: null, companyName: '退会済みの申込者', contactName: '', email: '', serviceUrl: null, usingService: null, preferredAt: null, note: null },
  })
  return removeAccount()
}
