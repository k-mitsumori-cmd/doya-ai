import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { privateApiJson } from '@/lib/private-api-response'
import { LifecycleError, validLifecycleUser } from '@/lib/account-lifecycle/state'
import { cancelOwnerTransfer, ownerTransferCandidates, ownerTransferStatus, transferOwner } from './store'
import {
  exactObject, validOwnerTransferId, OwnerTransferError,
  type OwnerTransferIdentity, type OwnerTransferInput, type OwnerTransferService,
} from './types'

async function actorId() {
  const session = await getServerSession(authOptions)
  const id = (session?.user as { id?: unknown } | undefined)?.id
  if (!validLifecycleUser(id)) throw new OwnerTransferError('OWNER_TRANSFER_AUTH_REQUIRED', 401)
  return id
}
type ErrorContext = { actorId: string; service: OwnerTransferService; organizationId: string; operationId: string }
const errorResponse = (error: unknown, context?: ErrorContext) => {
  if (error instanceof OwnerTransferError) return privateApiJson({ code: error.code, error: error.message, ...context }, { status: error.status })
  if (error instanceof LifecycleError) return privateApiJson({ code: error.code, error: error.message, ...context }, { status: error.status })
  console.error('[owner-transfer] operation failed')
  return privateApiJson({ code: 'OWNER_TRANSFER_UNAVAILABLE', error: '操作の状態を確認できません。' }, { status: 503 })
}
const field = (value: unknown, name: string) => {
  if (!validOwnerTransferId(value)) throw new OwnerTransferError(`INVALID_${name.toUpperCase()}`, 400)
  return value
}
const identityFor = (service: OwnerTransferService, organizationId: string, actorUserId: string, operationId: string): OwnerTransferIdentity =>
  ({ service, organizationId, actorUserId, operationId })

export async function ownerTransferGet(service: OwnerTransferService, request: NextRequest) {
  try {
    const actor = await actorId()
    const query = new URL(request.url).searchParams
    const action = query.get('action')
    if (action === 'candidates') {
      if (!['action,expectedActor,orgSlug', 'action,expectedActor,orgId,orgSlug'].includes([...query.keys()].sort().join(','))) throw new OwnerTransferError('INVALID_OWNER_TRANSFER_QUERY', 400)
      if (query.get('expectedActor') !== actor) throw new OwnerTransferError('OWNER_TRANSFER_ACTOR_CHANGED')
      const slug = query.get('orgSlug')
      if (!slug || slug.length > 160) throw new OwnerTransferError('INVALID_OWNER_TRANSFER_QUERY', 400)
      const orgId = query.has('orgId') ? field(query.get('orgId'), 'orgId') : undefined
      return privateApiJson(await ownerTransferCandidates(service, slug, actor, orgId))
    }
    if (action === 'status') {
      if ([...query.keys()].sort().join(',') !== 'action,expectedActor,operationId,orgId') throw new OwnerTransferError('INVALID_OWNER_TRANSFER_QUERY', 400)
      if (query.get('expectedActor') !== actor) throw new OwnerTransferError('OWNER_TRANSFER_ACTOR_CHANGED')
      const identity = identityFor(service, field(query.get('orgId'), 'orgId'), actor, field(query.get('operationId'), 'operationId'))
      return privateApiJson(await ownerTransferStatus(identity))
    }
    throw new OwnerTransferError('INVALID_OWNER_TRANSFER_ACTION', 400)
  } catch (error) { return errorResponse(error) }
}

export async function ownerTransferPost(service: OwnerTransferService, request: NextRequest) {
  try {
    const actor = await actorId()
    const raw = await request.text()
    if (Buffer.byteLength(raw) > 4096) throw new OwnerTransferError('INVALID_OWNER_TRANSFER_BODY', 400)
    let body: unknown
    try { body = JSON.parse(raw) } catch { throw new OwnerTransferError('INVALID_OWNER_TRANSFER_BODY', 400) }
    if (exactObject(body, 'action,expectedActor,orgId,operationId') && body.action === 'cancel') {
      if (body.expectedActor !== actor) throw new OwnerTransferError('OWNER_TRANSFER_ACTOR_CHANGED')
      const identity = identityFor(service, field(body.orgId, 'orgId'), actor, field(body.operationId, 'operationId'))
      return privateApiJson(await cancelOwnerTransfer(identity))
    }
    if (exactObject(body, 'action,expectedActor,orgId,orgSlug,operationId,input') && body.action === 'transfer') {
      if (body.expectedActor !== actor) throw new OwnerTransferError('OWNER_TRANSFER_ACTOR_CHANGED')
      const identity = identityFor(service, field(body.orgId, 'orgId'), actor, field(body.operationId, 'operationId'))
      const slug = typeof body.orgSlug === 'string' ? body.orgSlug : ''
      try { return privateApiJson(await transferOwner(identity, body.input as OwnerTransferInput, slug)) }
      catch (error) { return errorResponse(error, { actorId: actor, service, organizationId: identity.organizationId, operationId: identity.operationId }) }
    }
    throw new OwnerTransferError('INVALID_OWNER_TRANSFER_BODY', 400)
  } catch (error) { return errorResponse(error) }
}
