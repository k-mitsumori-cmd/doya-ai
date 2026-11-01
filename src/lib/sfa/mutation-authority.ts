import type { Prisma } from '@prisma/client'
import type { SfaContext } from './types'

export class SfaMutationError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** Member removal/role updates take FOR UPDATE on the same membership row. */
export async function lockSfaMutationActor(tx: Prisma.TransactionClient, ctx: SfaContext) {
  if (!ctx.userId || !ctx.memberId || !ctx.organizationId) throw new SfaMutationError(403, '操作権限を確認できません。画面を再読み込みしてください。')
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_members WHERE id = ${ctx.memberId}
    AND "organizationId" = ${ctx.organizationId} AND "userId" = ${ctx.userId} FOR SHARE`
  if (!locked.some(row => row.id === ctx.memberId)) throw new SfaMutationError(403, '操作権限を確認できません。画面を再読み込みしてください。')
  const actor = await tx.sfaMember.findFirst({
    where: { id: ctx.memberId, organizationId: ctx.organizationId, userId: ctx.userId, status: 'ACTIVE', role: { in: ['owner', 'admin', 'manager', 'member'] } },
    select: { id: true },
  })
  if (!actor) throw new SfaMutationError(403, '操作権限を確認できません。画面を再読み込みしてください。')
}

/** Deal activities also update lastActivityAt: take its exclusive lock up front to avoid share-lock upgrade deadlocks. */
export async function lockSfaRelation(tx: Prisma.TransactionClient, ctx: SfaContext, model: 'sfaAccount' | 'sfaDeal' | 'sfaContact', id: string) {
  const locked = model === 'sfaAccount' ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_accounts WHERE id = ${id} AND "organizationId" = ${ctx.organizationId} FOR SHARE`
    : model === 'sfaDeal' ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_deals WHERE id = ${id} AND "organizationId" = ${ctx.organizationId} FOR UPDATE`
    : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_contacts WHERE id = ${id} AND "organizationId" = ${ctx.organizationId} FOR SHARE`
  if (!locked.some(row => row.id === id)) throw new SfaMutationError(400, '関連先が見つかりません。画面を更新して選び直してください。')
  const row = model === 'sfaAccount'
    ? await tx.sfaAccount.findFirst({ where: { id, organizationId: ctx.organizationId, isActive: true }, select: { id: true } })
    : model === 'sfaDeal'
      ? await tx.sfaDeal.findFirst({ where: { id, organizationId: ctx.organizationId, isActive: true }, select: { id: true } })
      : await tx.sfaContact.findFirst({ where: { id, organizationId: ctx.organizationId, isActive: true }, select: { id: true } })
  if (!row) throw new SfaMutationError(400, '関連先が見つかりません。画面を更新して選び直してください。')
  return row.id
}
