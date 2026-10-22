import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { validLifecycleUser, LifecycleError } from '@/lib/account-lifecycle/state'
import { parseHrOrganizationSelection } from '@/lib/hr/organization-selection'
import { privateApiJson } from '@/lib/private-api-response'
import { cancelOwnerTransfer, ownerTransferCandidates, ownerTransferStatus, transferOwner } from '@/lib/hr/owner-transfer/store'
import { exactObject, validOwnerTransferId, OwnerTransferError, type OwnerTransferIdentity, type OwnerTransferInput } from '@/lib/hr/owner-transfer/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Context = { actorId: string; service: 'hr'; organizationId: string; operationId: string }
function respondError(error: unknown, context?: Context) {
  if (error instanceof OwnerTransferError || error instanceof LifecycleError) {
    return privateApiJson({ code: error.code, error: error.message, ...context }, { status: error.status })
  }
  console.error('[hr/owner-transfer] operation unavailable')
  return privateApiJson({ code: 'OWNER_TRANSFER_UNAVAILABLE', error: '引継ぎ状況を確認できません。' }, { status: 503 })
}
async function principal(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const actor = (session?.user as { id?: unknown } | undefined)?.id
  if (!validLifecycleUser(actor)) throw new OwnerTransferError('OWNER_TRANSFER_AUTH_REQUIRED', 401)
  const selection = parseHrOrganizationSelection(request.headers, actor)
  if (selection.kind !== 'selected' || !validOwnerTransferId(selection.organizationId)) {
    throw new OwnerTransferError('OWNER_TRANSFER_ORG_SELECTION_REQUIRED', 403)
  }
  return { actor, organizationId: selection.organizationId }
}
function field(value: unknown, name: string) {
  if (!validOwnerTransferId(value)) throw new OwnerTransferError(`INVALID_${name.toUpperCase()}`, 400)
  return value
}
function identity(actor: string, organizationId: string, operationId: string): OwnerTransferIdentity {
  return { service: 'hr', actorUserId: actor, organizationId, operationId }
}

export async function GET(request: NextRequest) {
  try {
    const { actor, organizationId } = await principal(request)
    const query = new URL(request.url).searchParams
    if (query.get('expectedActor') !== actor) throw new OwnerTransferError('OWNER_TRANSFER_ACTOR_CHANGED')
    if (query.get('orgId') !== organizationId) throw new OwnerTransferError('OWNER_TRANSFER_ORG_SELECTION_CHANGED')
    if (query.get('action') === 'candidates') {
      if (!['action,expectedActor,orgId', 'action,cursor,expectedActor,orgId'].includes([...query.keys()].sort().join(','))) throw new OwnerTransferError('INVALID_OWNER_TRANSFER_QUERY', 400)
      const cursor = query.has('cursor') ? field(query.get('cursor'), 'cursor') : undefined
      return privateApiJson(await ownerTransferCandidates('hr', organizationId, actor, cursor))
    }
    if (query.get('action') === 'status') {
      if ([...query.keys()].sort().join(',') !== 'action,expectedActor,operationId,orgId') throw new OwnerTransferError('INVALID_OWNER_TRANSFER_QUERY', 400)
      return privateApiJson(await ownerTransferStatus(identity(actor, organizationId, field(query.get('operationId'), 'operationId'))))
    }
    throw new OwnerTransferError('INVALID_OWNER_TRANSFER_ACTION', 400)
  } catch (error) { return respondError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const { actor, organizationId } = await principal(request)
    const raw = await request.text()
    if (Buffer.byteLength(raw) > 4096) throw new OwnerTransferError('INVALID_OWNER_TRANSFER_BODY', 400)
    let body: unknown
    try { body = JSON.parse(raw) } catch { throw new OwnerTransferError('INVALID_OWNER_TRANSFER_BODY', 400) }
    if (exactObject(body, 'action,expectedActor,orgId,operationId') && body.action === 'cancel') {
      if (body.expectedActor !== actor) throw new OwnerTransferError('OWNER_TRANSFER_ACTOR_CHANGED')
      if (body.orgId !== organizationId) throw new OwnerTransferError('OWNER_TRANSFER_ORG_SELECTION_CHANGED')
      const operation = identity(actor, organizationId, field(body.operationId, 'operationId'))
      return privateApiJson(await cancelOwnerTransfer(operation))
    }
    if (exactObject(body, 'action,expectedActor,orgId,operationId,input') && body.action === 'transfer') {
      if (body.expectedActor !== actor) throw new OwnerTransferError('OWNER_TRANSFER_ACTOR_CHANGED')
      if (body.orgId !== organizationId) throw new OwnerTransferError('OWNER_TRANSFER_ORG_SELECTION_CHANGED')
      const operation = identity(actor, organizationId, field(body.operationId, 'operationId'))
      try { return privateApiJson(await transferOwner(operation, body.input as OwnerTransferInput)) }
      catch (error) { return respondError(error, { actorId: actor, service: 'hr', organizationId, operationId: operation.operationId }) }
    }
    throw new OwnerTransferError('INVALID_OWNER_TRANSFER_BODY', 400)
  } catch (error) { return respondError(error) }
}
