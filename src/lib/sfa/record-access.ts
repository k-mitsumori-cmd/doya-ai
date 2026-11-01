import type { Prisma } from '@prisma/client'
import type { SfaContext } from './types'
import { SfaMutationError } from './mutation-authority'
import { canAccessSfaRecord, sfaRecordWhere, type SfaRecordScope } from './record-policy'
import { lockSfaAssignee, withSfaRecordRead, withSfaRecordAccessChange } from './record-authority'

type Kind = 'account' | 'contact' | 'lead' | 'deal' | 'task'
const kinds = ['account', 'contact', 'lead', 'deal', 'task']
const invalid = () => new SfaMutationError(400, '担当・共有の設定内容を確認してください。')
export function sfaAccessTarget(kind: unknown, id: unknown): { kind: Kind; id: string } {
  if (typeof kind !== 'string' || !kinds.includes(kind) || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw invalid()
  return { kind: kind as Kind, id }
}
function version(value: unknown) {
  const stamp = typeof value === 'string' && value.length === 24 ? new Date(value) : null
  if (!stamp || !Number.isFinite(stamp.getTime()) || stamp.toISOString() !== value) throw invalid()
  return stamp
}
async function find(tx: Prisma.TransactionClient, scope: SfaRecordScope, kind: Kind, id: string, write = false) {
  switch (kind) {
    case 'account': return tx.sfaAccount.findFirst({ where: sfaRecordWhere(scope, kind, write, { id }) })
    case 'contact': return tx.sfaContact.findFirst({ where: sfaRecordWhere(scope, kind, write, { id }) })
    case 'lead': return tx.sfaLead.findFirst({ where: sfaRecordWhere(scope, kind, write, { id }) })
    case 'deal': return tx.sfaDeal.findFirst({ where: sfaRecordWhere(scope, kind, write, { id }) })
    case 'task': return tx.sfaTask.findFirst({ where: sfaRecordWhere(scope, kind, write, { id }) })
  }
}
export function readSfaRecordAccess(ctx: SfaContext, rawKind: unknown, rawId: unknown) {
  const { kind, id } = sfaAccessTarget(rawKind, rawId)
  return withSfaRecordRead(ctx, async (tx, scope) => {
    const row = await find(tx, scope, kind, id)
    if (!row) return { state: 'missing' as const, access: null, members: [], canEdit: false }
    const canEdit = canAccessSfaRecord(scope, kind, row, true)
    const members = canEdit ? await tx.sfaMember.findMany({ where: { organizationId: ctx.organizationId, status: 'ACTIVE', role: { in: ['owner', 'admin', 'manager', 'member'] }, ...(!scope.organizationWide ? { id: { in: [...scope.memberIds] } } : {}) }, select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }) : []
    return { state: 'found' as const, canEdit, canUnassign: canEdit && scope.actor.role !== 'member', members, access: { kind, id, updatedAt: row.updatedAt, assigneeMemberId: 'ownerMemberId' in row ? row.ownerMemberId : row.assigneeMemberId, ...(kind === 'account' && 'isShared' in row ? { isShared: row.isShared } : {}) } }
  })
}
export function updateSfaRecordAccess(ctx: SfaContext, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  const body = value as Record<string, unknown>
  if (Object.keys(body).some(key => !['kind', 'id', 'expectedUpdatedAt', 'assigneeMemberId', 'isShared'].includes(key))) throw invalid()
  const { kind, id } = sfaAccessTarget(body.kind, body.id)
  const expectedUpdatedAt = version(body.expectedUpdatedAt)
  if (!('assigneeMemberId' in body || 'isShared' in body)) throw invalid()
  if ('isShared' in body && (kind !== 'account' || typeof body.isShared !== 'boolean')) throw invalid()
  if ('assigneeMemberId' in body && body.assigneeMemberId !== null && (typeof body.assigneeMemberId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.assigneeMemberId))) throw invalid()
  return withSfaRecordAccessChange(ctx, async (tx, scope) => {
    const org = ctx.organizationId
    // Organization lock precedes business-row and assignee locks in every access change.
    const locked = kind === 'account' ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_accounts WHERE id = ${id} AND "organizationId" = ${org} FOR UPDATE`
      : kind === 'contact' ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_contacts WHERE id = ${id} AND "organizationId" = ${org} FOR UPDATE`
        : kind === 'lead' ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_leads WHERE id = ${id} AND "organizationId" = ${org} FOR UPDATE`
          : kind === 'deal' ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_deals WHERE id = ${id} AND "organizationId" = ${org} FOR UPDATE`
            : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_tasks WHERE id = ${id} AND "organizationId" = ${org} FOR UPDATE`
    const row = locked.some(item => item.id === id) ? await find(tx, scope, kind, id, true) : null
    if (!row) throw new SfaMutationError(404, 'データが見つかりません。一覧を更新してください。')
    if (row.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new SfaMutationError(409, '担当・共有の設定が別の操作で変更されました。最新の設定を確認してください。')
    const assigneeMemberId = 'assigneeMemberId' in body ? await lockSfaAssignee(tx, scope, body.assigneeMemberId as string | null) : undefined
    const updatedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1))
    const data = { updatedAt, ...(assigneeMemberId !== undefined ? (kind === 'account' || kind === 'contact' ? { ownerMemberId: assigneeMemberId } : { assigneeMemberId }) : {}) }
    const saved = kind === 'account' ? await tx.sfaAccount.update({ where: { id }, data: { ...data, ...('isShared' in body ? { isShared: body.isShared as boolean } : {}) } })
      : kind === 'contact' ? await tx.sfaContact.update({ where: { id }, data })
        : kind === 'lead' ? await tx.sfaLead.update({ where: { id }, data })
          : kind === 'deal' ? await tx.sfaDeal.update({ where: { id }, data })
            : await tx.sfaTask.update({ where: { id }, data })
    // Do not return business contents after a successful change that removes the actor's access.
    return { ok: true, id, updatedAt, isReadable: canAccessSfaRecord(scope, kind, saved) }
  })
}
