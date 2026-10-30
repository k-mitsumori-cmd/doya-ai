import type { SfaContext } from './types'
import type { Prisma } from '@prisma/client'
import { SfaMutationError } from './mutation-authority'

export type SfaRecordKind = 'account' | 'contact' | 'lead' | 'deal' | 'task' | 'activity'
const owners = {
  account: 'ownerMemberId', contact: 'ownerMemberId', lead: 'assigneeMemberId',
  deal: 'assigneeMemberId', task: 'assigneeMemberId', activity: 'memberId',
} as const
const roles = ['member', 'manager', 'admin', 'owner']
const activeKinds = new Set<SfaRecordKind>(['account', 'contact', 'lead', 'deal'])

export type SfaRecordScope = Readonly<{
  actor: Readonly<SfaContext>
  memberIds: readonly string[]
  organizationWide: boolean
}>

/** Input must come from a freshly locked ACTIVE actor and same-organization ACTIVE team members. */
export function makeSfaRecordScope(actor: SfaContext, teamMemberIds: readonly string[] = []): SfaRecordScope {
  if (!actor || ![actor.userId, actor.memberId, actor.organizationId].every(id => typeof id === 'string' && id.length > 0 && id.length <= 128) || !roles.includes(actor.role)) {
    throw new SfaMutationError(403, '操作権限を確認できません。画面を再読み込みしてください。')
  }
  const memberIds = new Set([actor.memberId])
  if (actor.role === 'manager') {
    for (const id of teamMemberIds) if (typeof id === 'string' && id && id.length <= 128) memberIds.add(id)
  }
  return Object.freeze({
    actor: Object.freeze({ ...actor }),
    memberIds: Object.freeze([...memberIds]),
    organizationWide: actor.role === 'admin' || actor.role === 'owner',
  })
}

/** Explicit account sharing grants read access to that account, never to its other business records. */
export function canAccessSfaRecord(scope: SfaRecordScope, kind: SfaRecordKind, row: Record<string, unknown> | null, write = false): boolean {
  if (!Object.prototype.hasOwnProperty.call(owners, kind) || !row || row.organizationId !== scope.actor.organizationId) return false
  if (activeKinds.has(kind) && row.isActive !== true) return false
  if (scope.organizationWide) return true
  const owner = row[owners[kind]]
  return typeof owner === 'string' && scope.memberIds.includes(owner)
    || !write && kind === 'account' && row.isShared === true
}

type RecordFilters = {
  account: Prisma.SfaAccountWhereInput
  contact: Prisma.SfaContactWhereInput
  lead: Prisma.SfaLeadWhereInput
  deal: Prisma.SfaDealWhereInput
  task: Prisma.SfaTaskWhereInput
  activity: Prisma.SfaActivityWhereInput
}

/** Apply before pagination/counting. Caller filters cannot replace the authority predicate. */
export function sfaRecordWhere<K extends SfaRecordKind>(scope: SfaRecordScope, kind: K, write = false, filters: RecordFilters[K] = {}): RecordFilters[K] {
  if (!Object.prototype.hasOwnProperty.call(owners, kind)) throw new SfaMutationError(403, '操作権限を確認できません。')
  const base = { organizationId: scope.actor.organizationId, ...(activeKinds.has(kind) ? { isActive: true } : {}) }
  const own = { [owners[kind]]: { in: [...scope.memberIds] } }
  const authority = scope.organizationWide ? base : { ...base, OR: [own, ...(!write && kind === 'account' ? [{ isShared: true }] : [])] }
  return { AND: [authority, filters] } as RecordFilters[K]
}

/** The caller must also verify that this target is a current ACTIVE member in the same organization. */
export function scopeAllowsSfaAssignment(scope: SfaRecordScope, memberId: string): boolean {
  return typeof memberId === 'string' && Boolean(memberId) && memberId.length <= 128
    && (scope.organizationWide || scope.memberIds.includes(memberId))
}
