import type { Prisma } from '@prisma/client'
import { SfaMutationError } from './mutation-authority'
import { sfaOperationId, createSfaOnce, recoverSfaCreation, cancelSfaCreation } from './creation-receipt'
import { withSfaRecordRead, withSfaScopeManagement } from './record-authority'
import type { SfaContext } from './types'

const include = { members: { select: { memberId: true, member: { select: { id: true, name: true, role: true, status: true } } }, orderBy: { memberId: 'asc' as const } } }
const invalid = () => new SfaMutationError(400, 'チームの入力内容を確認してください。')
export function sfaTeamId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw invalid()
  return value
}
function version(value: unknown) {
  const date = typeof value === 'string' && value.length === 24 ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString() !== value) throw invalid()
  return date
}
function input(value: unknown, create: boolean) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  const body = value as Record<string, unknown>
  const allowed = ['name', 'memberIds', create ? 'operationId' : 'expectedUpdatedAt']
  if (Object.keys(body).some(key => !allowed.includes(key)) || !('name' in body || 'memberIds' in body)) throw invalid()
  let name: string | undefined
  if ('name' in body || create) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) throw invalid()
    name = body.name.trim()
  }
  let memberIds: string[] | undefined
  if ('memberIds' in body || create) {
    if (!Array.isArray(body.memberIds) || body.memberIds.length > 500) throw invalid()
    memberIds = body.memberIds.map(sfaTeamId).sort()
    if (new Set(memberIds).size !== memberIds.length) throw invalid()
  }
  const operationId = create ? sfaOperationId(body.operationId) : undefined
  if (create && !operationId) throw invalid()
  return { name, memberIds, operationId, expectedUpdatedAt: create ? undefined : version(body.expectedUpdatedAt) }
}
async function validateMembers(tx: Prisma.TransactionClient, organizationId: string, ids: string[]) {
  if (!ids.length) return
  const rows = await tx.sfaMember.findMany({ where: { organizationId, id: { in: ids }, status: 'ACTIVE', role: { in: ['member', 'manager', 'admin', 'owner'] } }, select: { id: true } })
  if (rows.length !== ids.length) throw new SfaMutationError(400, '現在参加中のメンバーを選び直してください。')
}
export function listSfaTeams(ctx: SfaContext) {
  return withSfaRecordRead(ctx, async (tx, scope) => ({
    teams: await tx.sfaTeam.findMany({ where: { organizationId: ctx.organizationId, ...(!scope.organizationWide ? { members: { some: { memberId: ctx.memberId } } } : {}) }, include, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    canManage: scope.organizationWide,
    members: scope.organizationWide ? await tx.sfaMember.findMany({ where: { organizationId: ctx.organizationId, status: 'ACTIVE', role: { in: ['owner', 'admin', 'manager', 'member'] } }, select: { id: true, name: true, role: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }) : [],
  }))
}
export function createSfaTeam(ctx: SfaContext, value: unknown) {
  const parsed = input(value, true)
  return withSfaScopeManagement(ctx, async tx => createSfaOnce(tx, ctx, 'team', parsed.operationId,
    { name: parsed.name, memberIds: parsed.memberIds },
    id => tx.sfaTeam.findFirst({ where: { id, organizationId: ctx.organizationId }, include }),
    async () => {
      await validateMembers(tx, ctx.organizationId, parsed.memberIds!)
      return tx.sfaTeam.create({ data: { organizationId: ctx.organizationId, name: parsed.name!, members: { create: parsed.memberIds!.map(memberId => ({ memberId })) } }, include })
    }))
}
export function recoverSfaTeam(ctx: SfaContext, operation: unknown, cancel: boolean) {
  const operationId = sfaOperationId(operation)
  if (!operationId) throw invalid()
  return withSfaRecordRead(ctx, async (tx, scope) => {
    if (!scope.organizationWide) throw new SfaMutationError(403, 'チームを管理する権限がありません。')
    const find = (id: string) => tx.sfaTeam.findFirst({ where: { id, organizationId: ctx.organizationId }, include })
    return cancel ? cancelSfaCreation(tx, ctx, 'team', operationId, find) : recoverSfaCreation(tx, ctx, 'team', operationId, find)
  })
}
export function updateSfaTeam(ctx: SfaContext, id: string, value: unknown) {
  sfaTeamId(id)
  const parsed = input(value, false)
  return withSfaScopeManagement(ctx, async tx => {
    const before = await tx.sfaTeam.findFirst({ where: { id, organizationId: ctx.organizationId } })
    if (!before) throw new SfaMutationError(404, 'チームが見つかりません。')
    if (before.updatedAt.getTime() !== parsed.expectedUpdatedAt!.getTime()) throw new SfaMutationError(409, 'チームが別の操作で変更されました。一覧を更新してください。')
    if (parsed.memberIds) {
      await validateMembers(tx, ctx.organizationId, parsed.memberIds)
      await tx.sfaTeamMember.deleteMany({ where: { organizationId: ctx.organizationId, teamId: id } })
      if (parsed.memberIds.length) await tx.sfaTeamMember.createMany({ data: parsed.memberIds.map(memberId => ({ organizationId: ctx.organizationId, teamId: id, memberId })) })
    }
    return tx.sfaTeam.update({ where: { id }, data: { ...(parsed.name !== undefined ? { name: parsed.name } : {}), updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) }, include })
  })
}
export function deleteSfaTeam(ctx: SfaContext, id: string, expected: unknown) {
  sfaTeamId(id)
  const expectedUpdatedAt = version(expected)
  return withSfaScopeManagement(ctx, async tx => {
    const before = await tx.sfaTeam.findFirst({ where: { id, organizationId: ctx.organizationId } })
    if (!before) throw new SfaMutationError(404, 'チームが見つかりません。')
    if (before.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new SfaMutationError(409, 'チームが別の操作で変更されました。一覧を更新してください。')
    await tx.sfaTeam.delete({ where: { id } })
    return { ok: true }
  })
}

export function readSfaTeam(ctx: SfaContext, id: string) {
  sfaTeamId(id)
  return withSfaRecordRead(ctx, async (tx, scope) => {
    const team = await tx.sfaTeam.findFirst({ where: { id, organizationId: ctx.organizationId, ...(!scope.organizationWide ? { members: { some: { memberId: ctx.memberId } } } : {}) }, include })
    return { state: team ? 'found' : 'missing', team }
  })
}
