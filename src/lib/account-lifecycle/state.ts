import { createHash } from 'node:crypto'

export type LifecycleKind = 'retirement' | 'checkout' | 'cancel' | 'resume' | 'change' | 'portal'
export type LifecycleOperator = { kind: 'admin' | 'user' | 'adapter'; id: string }
export type LifecycleIdentity = { operator: LifecycleOperator; targetUserId: string; operationId: string; kind: LifecycleKind }
export type LifecycleClaim = LifecycleIdentity & { generation: string; token: string }
export type LifecycleReceipt = {
  version: 2; targetHash: string; operationId: string; operator: LifecycleOperator; kind: LifecycleKind
  inputDigest: string; generation: string; token: string; revision: number
  phase: 'reserved' | 'executing' | 'aborted' | 'completed'
  reason: null | 'EXTERNAL_UNKNOWN' | 'NEEDS_REVIEW'; createdAt: string; updatedAt: string
}
export type LifecycleFence = { version: 2; operationId: string; generation: string; kind: LifecycleKind; state: 'active' | 'retired' }
export type LifecycleActionType = 'customer_create' | 'checkout_create' | 'checkout_expire' | 'subscription_cancel' | 'subscription_schedule_cancel' | 'subscription_resume' | 'subscription_change' | 'portal_create'
export type LifecycleResource = { type: LifecycleActionType; mode: 'test' | 'live'; resourceId: string; inputDigest: string }
export type LifecycleOutcome = { proof: 'ack' | 'irreversible_terminal'; resourceId: string; status: 'created' | 'expired' | 'canceled' | 'incomplete_expired' | 'scheduled_cancel' | 'resumed' | 'changed' }
export type LifecycleAction = LifecycleResource & { key: string; phase: 'planned' | 'dispatched' | 'confirmed'; dispatchToken: string | null; outcome: LifecycleOutcome | null }
export type LifecycleLedger = { version: 2; targetHash: string; operationId: string; generation: string; revision: number; actions: LifecycleAction[] }

export class LifecycleError extends Error {
  constructor(readonly code: string, readonly status = 409) { super('アカウント操作の状態を確認できません。操作を繰り返さず、保存状況をご確認ください。') }
}
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const kinds: readonly string[] = ['retirement', 'checkout', 'cancel', 'resume', 'change', 'portal']
const actionTypes: readonly string[] = ['customer_create', 'checkout_create', 'checkout_expire', 'subscription_cancel', 'subscription_schedule_cancel', 'subscription_resume', 'subscription_change', 'portal_create']
export const validLifecycleUser = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
export const validLifecycleUuid = (v: unknown): v is string => typeof v === 'string' && uuidPattern.test(v)
export const validLifecycleDigest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const object = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const exact = (v: unknown, keys: string): v is Record<string, unknown> => object(v) && Object.keys(v).sort().join(',') === keys.split(',').sort().join(',')
const iso = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v
const revision = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < Number.MAX_SAFE_INTEGER
const fail = (): never => { throw new LifecycleError('LIFECYCLE_STATE_UNAVAILABLE') }
export function assertLifecycleIdentity(value: unknown): asserts value is LifecycleIdentity {
  if (!exact(value, 'operator,targetUserId,operationId,kind') || !exact(value.operator, 'kind,id') || !validLifecycleUser(value.targetUserId) || !validLifecycleUuid(value.operationId) || typeof value.kind !== 'string' || !kinds.includes(value.kind) || !['admin', 'user', 'adapter'].includes(value.operator.kind as string) || !validLifecycleUser(value.operator.id)) throw new LifecycleError('INVALID_LIFECYCLE_IDENTITY', 400)
  if (value.operator.kind === 'user' && value.operator.id !== value.targetUserId || value.operator.kind === 'adapter' && (value.operator.id !== 'next-auth' || value.kind !== 'retirement')) throw new LifecycleError('INVALID_LIFECYCLE_IDENTITY', 400)
}
export function lifecycleIdentity(claim: LifecycleClaim): LifecycleIdentity {
  if (!exact(claim, 'operator,targetUserId,operationId,kind,generation,token')) throw new LifecycleError('INVALID_LIFECYCLE_CLAIM', 400)
  const identity = { operator: claim?.operator, targetUserId: claim?.targetUserId, operationId: claim?.operationId, kind: claim?.kind }
  assertLifecycleIdentity(identity)
  if (!validLifecycleUuid(claim.generation) || !validLifecycleUuid(claim.token)) throw new LifecycleError('INVALID_LIFECYCLE_CLAIM', 400)
  return identity
}
export function lifecycleSubject(userId: string): string {
  if (!validLifecycleUser(userId)) throw new LifecycleError('INVALID_LIFECYCLE_IDENTITY', 400)
  return createHash('sha256').update(JSON.stringify(userId)).digest('hex')
}
export const lifecycleFenceKey = (userId: string) => 'doya-account-fence:v2:' + lifecycleSubject(userId)
export function lifecycleReceiptKey(identity: LifecycleIdentity): string {
  assertLifecycleIdentity(identity)
  return `doya-account-operation:v2:${identity.operationId}`
}
export const lifecycleLedgerKey = (identity: LifecycleIdentity) => lifecycleReceiptKey(identity).replace('operation:', 'action:')
export const lifecycleActionKey = (resource: LifecycleResource) => createHash('sha256').update(JSON.stringify([resource.type, resource.mode, resource.resourceId, resource.inputDigest])).digest('hex')
export function validLifecycleResource(v: unknown): v is LifecycleResource {
  if (!exact(v, 'type,mode,resourceId,inputDigest') || !actionTypes.includes(v.type as string) || !['test', 'live'].includes(v.mode as string) || !validLifecycleDigest(v.inputDigest) || typeof v.resourceId !== 'string') return false
  return String(v.type).startsWith('subscription_') ? /^sub_[A-Za-z0-9_]{1,150}$/.test(v.resourceId)
    : v.type === 'checkout_expire' ? /^cs_[A-Za-z0-9_]{1,200}$/.test(v.resourceId) : validLifecycleDigest(v.resourceId)
}
const allowedActions: Record<LifecycleKind, readonly LifecycleActionType[]> = {
  retirement: ['checkout_expire', 'subscription_cancel'], checkout: ['customer_create', 'checkout_create'], cancel: ['subscription_cancel', 'subscription_schedule_cancel'],
  resume: ['subscription_resume'], change: ['subscription_change'], portal: ['portal_create'],
}
export function validLifecycleResourceForKind(resource: unknown, kind: LifecycleKind, targetHash: string): resource is LifecycleResource {
  return validLifecycleResource(resource) && allowedActions[kind]?.includes(resource.type) === true && (!['customer_create', 'checkout_create', 'portal_create'].includes(resource.type) || resource.resourceId === targetHash)
}
export function validLifecycleOutcome(action: LifecycleResource, value: unknown): value is LifecycleOutcome {
  if (!exact(value, 'proof,resourceId,status') || !['ack', 'irreversible_terminal'].includes(value.proof as string) || typeof value.resourceId !== 'string') return false
  const terminal = ['canceled', 'incomplete_expired'].includes(value.status as string)
  if (action.type.startsWith('subscription_')) return value.resourceId === action.resourceId && (value.proof === 'irreversible_terminal' ? terminal : action.type === 'subscription_cancel' ? terminal : value.status === (action.type === 'subscription_resume' ? 'resumed' : action.type === 'subscription_schedule_cancel' ? 'scheduled_cancel' : 'changed'))
  if (action.type === 'checkout_expire') return value.resourceId === action.resourceId && value.status === 'expired'
  return value.proof === 'ack' && value.status === 'created' && (action.type === 'customer_create' ? /^cus_[A-Za-z0-9_]{1,200}$/.test(value.resourceId) : action.type === 'checkout_create' ? /^cs_[A-Za-z0-9_]{1,200}$/.test(value.resourceId) : /^bps_[A-Za-z0-9_]{1,200}$/.test(value.resourceId))
}
function json(value: string, bytes: number): unknown {
  if (typeof value !== 'string' || Buffer.byteLength(value) > bytes) return fail()
  try { return JSON.parse(value) } catch { return fail() }
}
export function readLifecycleReceipt(raw: string, targetUserId: string, operationId: string): LifecycleReceipt {
  const r = json(raw, 4096)
  if (!exact(r, 'version,targetHash,operationId,operator,kind,inputDigest,generation,token,revision,phase,reason,createdAt,updatedAt') || r.version !== 2 || r.targetHash !== lifecycleSubject(targetUserId) || r.operationId !== operationId || !validLifecycleUuid(operationId) || !validLifecycleDigest(r.inputDigest) || !validLifecycleUuid(r.generation) || !validLifecycleUuid(r.token) || !revision(r.revision) || !['reserved', 'executing', 'aborted', 'completed'].includes(r.phase as string) || !(r.reason === null || ['EXTERNAL_UNKNOWN', 'NEEDS_REVIEW'].includes(r.reason as string)) || !iso(r.createdAt) || !iso(r.updatedAt) || r.updatedAt < r.createdAt || r.phase !== 'executing' && r.reason !== null) return fail()
  try { assertLifecycleIdentity({ operator: r.operator, targetUserId, operationId, kind: r.kind }) } catch { return fail() }
  return r as LifecycleReceipt
}
export function readLifecycleFence(raw: string): LifecycleFence {
  const r = json(raw, 1024)
  if (!exact(r, 'version,operationId,generation,kind,state') || r.version !== 2 || !validLifecycleUuid(r.operationId) || !validLifecycleUuid(r.generation) || !kinds.includes(r.kind as string) || !['active', 'retired'].includes(r.state as string) || r.state === 'retired' && r.kind !== 'retirement') return fail()
  return r as LifecycleFence
}
export function readLifecycleLedger(raw: string, receipt: LifecycleReceipt): LifecycleLedger {
  const r = json(raw, 131072)
  if (!exact(r, 'version,targetHash,operationId,generation,revision,actions') || r.version !== 2 || r.targetHash !== receipt.targetHash || r.operationId !== receipt.operationId || r.generation !== receipt.generation || !revision(r.revision) || !Array.isArray(r.actions) || r.actions.length > 128) return fail()
  for (const a of r.actions) {
    if (!exact(a, 'type,mode,resourceId,inputDigest,key,phase,dispatchToken,outcome') || !validLifecycleResourceForKind({ type: a.type, mode: a.mode, resourceId: a.resourceId, inputDigest: a.inputDigest }, receipt.kind, receipt.targetHash) || a.key !== lifecycleActionKey(a as LifecycleAction) || !['planned', 'dispatched', 'confirmed'].includes(a.phase as string) || (a.phase === 'planned' ? a.dispatchToken !== null || a.outcome !== null : !validLifecycleUuid(a.dispatchToken) || (a.phase === 'dispatched' ? a.outcome !== null : !validLifecycleOutcome(a as LifecycleAction, a.outcome)))) return fail()
  }
  if (new Set(r.actions.map(a => (a as LifecycleAction).key)).size !== r.actions.length) return fail()
  return r as LifecycleLedger
}
