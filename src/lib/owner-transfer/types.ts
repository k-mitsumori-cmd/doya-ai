import { createHash } from 'node:crypto'
import { validLifecycleUser, validLifecycleUuid } from '@/lib/account-lifecycle/state'

export const ownerTransferServices = ['shodan', 'aio', 'quote', 'mensetsu', 'aishodan'] as const
export type OwnerTransferService = (typeof ownerTransferServices)[number]
export type OwnerTransferIdentity = {
  service: OwnerTransferService
  organizationId: string
  actorUserId: string
  operationId: string
}
export type OwnerTransferInput = {
  expectedOwnerMemberId: string
  targetMemberId: string
  targetUserId: string
  targetRole: 'admin' | 'manager' | 'member'
  targetPlan: string
}

export class OwnerTransferError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super('オーナー変更の状態を確認できません。再送信せず、操作の結果をご確認ください。')
  }
}

const idPattern = /^[A-Za-z0-9_-]{1,128}$/
export const validOwnerTransferId = (value: unknown): value is string => typeof value === 'string' && idPattern.test(value)
export const exactObject = (value: unknown, keys: string): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === keys.split(',').sort().join(',')

export function assertOwnerTransferIdentity(value: unknown): asserts value is OwnerTransferIdentity {
  if (!exactObject(value, 'service,organizationId,actorUserId,operationId') ||
      !ownerTransferServices.includes(value.service as OwnerTransferService) ||
      !validOwnerTransferId(value.organizationId) || !validLifecycleUser(value.actorUserId) ||
      !validLifecycleUuid(value.operationId)) throw new OwnerTransferError('INVALID_OWNER_TRANSFER_IDENTITY', 400)
}

export function assertOwnerTransferInput(value: unknown): asserts value is OwnerTransferInput {
  if (!exactObject(value, 'expectedOwnerMemberId,targetMemberId,targetUserId,targetRole,targetPlan') ||
      !validOwnerTransferId(value.expectedOwnerMemberId) || !validOwnerTransferId(value.targetMemberId) ||
      !validLifecycleUser(value.targetUserId) || !['admin', 'manager', 'member'].includes(value.targetRole as string) ||
      typeof value.targetPlan !== 'string' || value.targetPlan.length < 1 || value.targetPlan.length > 128) {
    throw new OwnerTransferError('INVALID_OWNER_TRANSFER_INPUT', 400)
  }
}

export const ownerTransferScopeHash = (identity: OwnerTransferIdentity) => {
  assertOwnerTransferIdentity(identity)
  return createHash('sha256').update(JSON.stringify([
    identity.service, identity.organizationId, identity.actorUserId,
  ])).digest('hex')
}
export const ownerTransferKey = (identity: OwnerTransferIdentity) =>
  `doya-owner-transfer:v1:${ownerTransferScopeHash(identity)}:${identity.operationId}`
export const ownerTransferInputDigest = (identity: OwnerTransferIdentity, input: OwnerTransferInput) => {
  assertOwnerTransferIdentity(identity)
  assertOwnerTransferInput(input)
  return createHash('sha256').update(JSON.stringify([
    identity.service, identity.organizationId, identity.actorUserId, identity.operationId,
    input.expectedOwnerMemberId, input.targetMemberId, input.targetUserId, input.targetRole, input.targetPlan,
  ])).digest('hex')
}
