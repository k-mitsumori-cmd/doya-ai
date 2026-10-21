import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import {
  LifecycleError, assertLifecycleIdentity, lifecycleIdentity, lifecycleSubject, lifecycleReceiptKey, lifecycleFenceKey,
  lifecycleLedgerKey, lifecycleActionKey, readLifecycleReceipt, readLifecycleFence, readLifecycleLedger,
  validLifecycleUser, validLifecycleDigest, validLifecycleUuid, validLifecycleResourceForKind, validLifecycleOutcome,
  type LifecycleIdentity, type LifecycleClaim, type LifecycleReceipt, type LifecycleFence, type LifecycleLedger,
  type LifecycleResource, type LifecycleOutcome,
} from './state'

type Tx = Prisma.TransactionClient
export type LifecycleDb = Pick<PrismaClient, '$transaction'>
const options = { isolationLevel: 'ReadCommitted' as const, maxWait: 10000, timeout: 30000 }
const changed = (): never => { throw new LifecycleError('LIFECYCLE_CLAIM_CHANGED') }
const unavailable = (): never => { throw new LifecycleError('LIFECYCLE_STATE_UNAVAILABLE') }
const rawReceiptKey = (userId: string, operationId: string) => `doya-account-operation:v2:${operationId}`
const view = (r: LifecycleReceipt) => ({ operationId: r.operationId, kind: r.kind, phase: r.phase, reason: r.reason, createdAt: r.createdAt, updatedAt: r.updatedAt })
const nextRevision = (n: number) => { if (n >= Number.MAX_SAFE_INTEGER - 1) return unavailable(); return n + 1 }
const updateTime = (r: LifecycleReceipt) => new Date(Math.max(Date.now(), Date.parse(r.updatedAt) + 1)).toISOString()

/** Caller authenticates operator; this module binds that verified principal, target and operation exactly. */
export async function lockLifecycleUsers(tx: Tx, ids: string[]): Promise<void> {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 64 || ids.some(id => !validLifecycleUser(id))) throw new LifecycleError('INVALID_LIFECYCLE_PARTICIPANTS', 400)
  const unique = [...new Set(ids)].sort()
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM "User" WHERE id IN (${Prisma.join(unique)}) ORDER BY id FOR UPDATE`)
  if (rows.length !== unique.length || rows.some(row => !unique.includes(row.id))) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
}
async function userExists(tx: Tx, userId: string): Promise<boolean> {
  return (await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`).some(row => row.id === userId)
}
async function receipt(tx: Tx, identity: LifecycleIdentity) {
  const row = await tx.systemSetting.findUnique({ where: { key: lifecycleReceiptKey(identity) }, select: { value: true } })
  if (!row) return null
  const value = readLifecycleReceipt(row.value, identity.targetUserId, identity.operationId)
  if (value.kind !== identity.kind || value.operator.kind !== identity.operator.kind || value.operator.id !== identity.operator.id) throw new LifecycleError('LIFECYCLE_IDENTITY_CONFLICT')
  return { raw: row.value, value }
}
async function fence(tx: Tx, userId: string) {
  const row = await tx.systemSetting.findUnique({ where: { key: lifecycleFenceKey(userId) }, select: { value: true } })
  if (!row) return null
  const value = readLifecycleFence(row.value)
  const operation = await tx.systemSetting.findUnique({ where: { key: rawReceiptKey(userId, value.operationId) }, select: { value: true } })
  if (!operation) return unavailable()
  const r = readLifecycleReceipt(operation.value, userId, value.operationId)
  if (r.generation !== value.generation || r.kind !== value.kind || (value.state === 'active' ? !['reserved', 'executing'].includes(r.phase) : r.kind !== 'retirement' || r.phase !== 'completed')) return unavailable()
  const savedLedger = await ledger(tx, { operator: r.operator, targetUserId: userId, operationId: r.operationId, kind: r.kind }, r)
  if (['executing', 'completed'].includes(r.phase) && !savedLedger) return unavailable()
  return { raw: row.value, value }
}
/** Call only after sorted User locks, then org/member locks where applicable. A malformed pointer never means no fence. */
export async function assertLifecycleWritable(tx: Tx, ids: string[]): Promise<void> {
  if (!Array.isArray(ids) || !ids.length || ids.length > 64 || ids.some(id => !validLifecycleUser(id))) throw new LifecycleError('INVALID_LIFECYCLE_PARTICIPANTS', 400)
  for (const id of [...new Set(ids)].sort()) if (await fence(tx, id)) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
}
/** Ordinary membership edits conflict with retirement, not unrelated billing unknown states. Malformed metadata still fails closed. */
export async function assertRetirementMembershipWritable(tx: Tx, ids: string[]): Promise<void> {
  if (!Array.isArray(ids) || !ids.length || ids.length > 64 || ids.some(id => !validLifecycleUser(id))) throw new LifecycleError('INVALID_LIFECYCLE_PARTICIPANTS', 400)
  for (const id of [...new Set(ids)].sort()) {
    const current = await fence(tx, id)
    if (current?.value.kind === 'retirement') throw new LifecycleError('ACCOUNT_RETIREMENT_IN_PROGRESS')
  }
}

/** Shodan fixed historical role edits/removals only; caller locks actor/owner and the INACTIVE member. */
export async function assertHistoricalShodanMemberWritable(tx: Tx, userId: string): Promise<void> {
  if (!validLifecycleUser(userId)) throw new LifecycleError('INVALID_LIFECYCLE_PARTICIPANTS', 400)
  // Do not add a User lock after org/member locks. Rediscovery must acquire it first if the User returned.
  if (await tx.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new LifecycleError('LIFECYCLE_PARTICIPANTS_CHANGED')
  const current = await fence(tx, userId)
  // fence() validates receipt/ledger/target/generation; only a verified completed retirement is terminal here.
  if (current?.value.state === 'active') throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
}

/** Only the invitation recipient may be deferred. Call after its User lock; never use this for actor/authority or a general target grant. */
export async function lifecycleInvitationRecipientDisposition(tx: Tx, userId: string): Promise<'ACTIVE' | 'PENDING'> {
  if (!validLifecycleUser(userId)) throw new LifecycleError('INVALID_LIFECYCLE_PARTICIPANTS', 400)
  const current = await fence(tx, userId)
  if (current?.value.state === 'retired') return unavailable()
  return current?.value.kind === 'retirement' ? 'PENDING' : 'ACTIVE'
}

async function ledger(tx: Tx, identity: LifecycleIdentity, r: LifecycleReceipt) {
  const row = await tx.systemSetting.findUnique({ where: { key: lifecycleLedgerKey(identity) }, select: { value: true } })
  if (!row) return null
  const value = readLifecycleLedger(row.value, r)
  if (r.phase === 'reserved' && value.actions.some(a => a.phase !== 'planned') || r.phase === 'aborted' && value.actions.some(a => a.phase !== 'planned') || r.phase === 'completed' && value.actions.some(a => a.phase !== 'confirmed') || r.reason !== null && !value.actions.some(a => a.phase === 'dispatched')) return unavailable()
  return { raw: row.value, value }
}
async function putReceipt(tx: Tx, identity: LifecycleIdentity, previous: string, r: LifecycleReceipt) {
  const value = JSON.stringify(r)
  readLifecycleReceipt(value, identity.targetUserId, identity.operationId)
  if ((await tx.systemSetting.updateMany({ where: { key: lifecycleReceiptKey(identity), value: previous }, data: { value } })).count !== 1) return changed()
}
async function putLedger(tx: Tx, identity: LifecycleIdentity, previous: string, l: LifecycleLedger, r: LifecycleReceipt) {
  const value = JSON.stringify(l)
  readLifecycleLedger(value, r)
  if ((await tx.systemSetting.updateMany({ where: { key: lifecycleLedgerKey(identity), value: previous }, data: { value } })).count !== 1) return changed()
}
async function authorize(tx: Tx, claim: LifecycleClaim, phases: LifecycleReceipt['phase'][]) {
  const identity = lifecycleIdentity(claim)
  if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
  const r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
  if (!r || !f || f.value.operationId !== identity.operationId || f.value.state !== 'active' || r.value.generation !== claim.generation || r.value.token !== claim.token || !phases.includes(r.value.phase)) return changed()
  return { identity, r, f }
}

export async function reserveLifecycleOperation(db: LifecycleDb, identity: LifecycleIdentity, inputDigest: string) {
  assertLifecycleIdentity(identity)
  if (!validLifecycleDigest(inputDigest)) throw new LifecycleError('INVALID_LIFECYCLE_INPUT', 400)
  return db.$transaction(async tx => {
    const exists = await userExists(tx, identity.targetUserId), old = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (f?.value.state === 'active' && !exists) return unavailable()
    if (old) {
      if (old.value.inputDigest !== inputDigest) throw new LifecycleError('LIFECYCLE_INPUT_CONFLICT')
      if (['reserved', 'executing'].includes(old.value.phase) && (!exists || f?.value.operationId !== identity.operationId) || old.value.phase === 'completed' && identity.kind === 'retirement' && (exists || f?.value.state !== 'retired' || f.value.operationId !== identity.operationId) || old.value.phase === 'aborted' && f?.value.operationId === identity.operationId) return unavailable()
      const savedLedger = await ledger(tx, identity, old.value)
      if (['executing', 'completed'].includes(old.value.phase) && !savedLedger) return unavailable()
      return { ...view(old.value), claim: null }
    }
    if (!exists) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    if (f) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    const now = new Date().toISOString()
    const r: LifecycleReceipt = { version: 2, targetHash: lifecycleSubject(identity.targetUserId), operationId: identity.operationId, operator: { kind: identity.operator.kind, id: identity.operator.id }, kind: identity.kind, inputDigest, generation: randomUUID(), token: randomUUID(), revision: 0, phase: 'reserved', reason: null, createdAt: now, updatedAt: now }
    const f2: LifecycleFence = { version: 2, operationId: r.operationId, generation: r.generation, kind: r.kind, state: 'active' }
    await tx.systemSetting.create({ data: { key: lifecycleReceiptKey(identity), value: JSON.stringify(r) } })
    await tx.systemSetting.create({ data: { key: lifecycleFenceKey(identity.targetUserId), value: JSON.stringify(f2) } })
    return { ...view(r), claim: { ...identity, generation: r.generation, token: r.token } as LifecycleClaim }
  }, options)
}

export async function prepareLifecycleActions(db: LifecycleDb, claim: LifecycleClaim, resources: LifecycleResource[]) {
  lifecycleIdentity(claim)
  if (!Array.isArray(resources) || resources.length > 128 || resources.some(r => !validLifecycleResourceForKind(r, claim.kind, lifecycleSubject(claim.targetUserId)))) throw new LifecycleError('INVALID_LIFECYCLE_RESOURCES', 400)
  const actions = resources.map(r => ({ type: r.type, mode: r.mode, resourceId: r.resourceId, inputDigest: r.inputDigest, key: lifecycleActionKey(r), phase: 'planned' as const, dispatchToken: null, outcome: null })).sort((a, b) => a.key.localeCompare(b.key))
  if (new Set(actions.map(a => a.key)).size !== actions.length) throw new LifecycleError('INVALID_LIFECYCLE_RESOURCES', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['reserved']), previous = await ledger(tx, identity, r.value)
    if (previous) { if (JSON.stringify(previous.value.actions) !== JSON.stringify(actions)) throw new LifecycleError('LIFECYCLE_PLAN_CONFLICT'); return }
    const l: LifecycleLedger = { version: 2, targetHash: r.value.targetHash, operationId: r.value.operationId, generation: r.value.generation, revision: 0, actions }
    readLifecycleLedger(JSON.stringify(l), r.value)
    await tx.systemSetting.create({ data: { key: lifecycleLedgerKey(identity), value: JSON.stringify(l) } })
  }, options)
}
export async function startLifecycleOperation(db: LifecycleDb, claim: LifecycleClaim) {
  lifecycleIdentity(claim)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['reserved'])
    if (!await ledger(tx, identity, r.value)) return unavailable()
    const updated = { ...r.value, phase: 'executing' as const, revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) }
    await putReceipt(tx, identity, r.raw, updated)
    return view(updated)
  }, options)
}
export async function dispatchLifecycleAction(db: LifecycleDb, claim: LifecycleClaim, key: string) {
  lifecycleIdentity(claim)
  if (!validLifecycleDigest(key)) throw new LifecycleError('INVALID_LIFECYCLE_ACTION', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing']), l = await ledger(tx, identity, r.value)
    if (!l) return unavailable()
    const action = l.value.actions.find(a => a.key === key)
    if (!action || action.phase !== 'planned' || r.value.reason !== null || l.value.actions.some(a => a.phase === 'dispatched')) throw new LifecycleError('LIFECYCLE_RESULT_UNCONFIRMED')
    if (action.type === 'subscription_cancel' && claim.kind === 'retirement' && l.value.actions.some(a => a.type === 'checkout_expire' && a.phase !== 'confirmed')) throw new LifecycleError('CHECKOUT_NOT_CLOSED')
    action.phase = 'dispatched'; action.dispatchToken = randomUUID(); l.value.revision = nextRevision(l.value.revision)
    await putLedger(tx, identity, l.raw, l.value, r.value)
    return { action: { ...action }, dispatchToken: action.dispatchToken }
  }, options)
}
export async function markLifecycleUnknown(db: LifecycleDb, claim: LifecycleClaim, key: string, dispatchToken: string, reason: 'EXTERNAL_UNKNOWN' | 'NEEDS_REVIEW' = 'EXTERNAL_UNKNOWN') {
  lifecycleIdentity(claim)
  if (!validLifecycleDigest(key) || !validLifecycleUuid(dispatchToken) || !['EXTERNAL_UNKNOWN', 'NEEDS_REVIEW'].includes(reason)) throw new LifecycleError('INVALID_LIFECYCLE_ACTION', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing']), l = await ledger(tx, identity, r.value)
    if (!l || !l.value.actions.some(a => a.key === key && a.phase === 'dispatched' && a.dispatchToken === dispatchToken)) return changed()
    const updated = { ...r.value, reason: r.value.reason === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' as const : reason, revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) }
    await putReceipt(tx, identity, r.raw, updated)
  }, options)
}
/** Server provider adapter must verify the exact ack or irreversible terminal proof before calling. No provider request is sent here. */
export async function confirmLifecycleAction(db: LifecycleDb, claim: LifecycleClaim, key: string, dispatchToken: string, outcome: LifecycleOutcome) {
  lifecycleIdentity(claim)
  if (!validLifecycleDigest(key) || !validLifecycleUuid(dispatchToken)) throw new LifecycleError('INVALID_LIFECYCLE_ACTION', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing']), l = await ledger(tx, identity, r.value)
    if (!l) return unavailable()
    const action = l.value.actions.find(a => a.key === key)
    if (!action || action.phase === 'planned' || action.dispatchToken !== dispatchToken || !validLifecycleOutcome(action, outcome)) return changed()
    if (action.phase === 'confirmed') { if (!action.outcome || action.outcome.proof !== outcome.proof || action.outcome.resourceId !== outcome.resourceId || action.outcome.status !== outcome.status) return changed(); return }
    action.phase = 'confirmed'; action.outcome = { proof: outcome.proof, resourceId: outcome.resourceId, status: outcome.status }; l.value.revision = nextRevision(l.value.revision)
    await putLedger(tx, identity, l.raw, l.value, r.value)
    if (r.value.reason !== null && !l.value.actions.some(a => a.phase === 'dispatched')) await putReceipt(tx, identity, r.raw, { ...r.value, reason: null, revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) })
  }, options)
}
/** Explicit authority rotation is allowed only with no dispatched/unknown action. Old claims lose all future DB dispatch authority. */
export async function resumeLifecycleOperation(db: LifecycleDb, identity: LifecycleIdentity) {
  assertLifecycleIdentity(identity)
  return db.$transaction(async tx => {
    if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    const r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (!r || !f || f.value.operationId !== identity.operationId || !['reserved', 'executing'].includes(r.value.phase) || r.value.reason !== null) return changed()
    const l = await ledger(tx, identity, r.value)
    if (r.value.phase === 'executing' && !l || l?.value.actions.some(a => a.phase === 'dispatched')) throw new LifecycleError('LIFECYCLE_RESULT_UNCONFIRMED')
    const updated = { ...r.value, generation: randomUUID(), token: randomUUID(), revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) }
    await putReceipt(tx, identity, r.raw, updated)
    if (l) await putLedger(tx, identity, l.raw, { ...l.value, generation: updated.generation, revision: nextRevision(l.value.revision) }, updated)
    if ((await tx.systemSetting.updateMany({ where: { key: lifecycleFenceKey(identity.targetUserId), value: f.raw }, data: { value: JSON.stringify({ ...f.value, generation: updated.generation }) } })).count !== 1) return changed()
    return { ...identity, generation: updated.generation, token: updated.token } as LifecycleClaim
  }, options)
}
export async function abortUnstartedLifecycleOperation(db: LifecycleDb, identity: LifecycleIdentity, inputDigest: string) {
  assertLifecycleIdentity(identity)
  if (!validLifecycleDigest(inputDigest)) throw new LifecycleError('INVALID_LIFECYCLE_INPUT', 400)
  return db.$transaction(async tx => {
    const exists = await userExists(tx, identity.targetUserId), r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (f?.value.state === 'active' && !exists) return unavailable()
    if (r && r.value.inputDigest !== inputDigest) throw new LifecycleError('LIFECYCLE_INPUT_CONFLICT')
    if (r?.value.phase === 'aborted') { if (f?.value.operationId === identity.operationId) return unavailable(); return view(r.value) }
    if (!r) {
      const now = new Date().toISOString(), aborted: LifecycleReceipt = { version: 2, targetHash: lifecycleSubject(identity.targetUserId), operationId: identity.operationId, operator: { kind: identity.operator.kind, id: identity.operator.id }, kind: identity.kind, inputDigest, generation: randomUUID(), token: randomUUID(), revision: 0, phase: 'aborted', reason: null, createdAt: now, updatedAt: now }
      await tx.systemSetting.create({ data: { key: lifecycleReceiptKey(identity), value: JSON.stringify(aborted) } })
      return view(aborted)
    }
    if (!exists || r.value.phase !== 'reserved' || f?.value.operationId !== identity.operationId) throw new LifecycleError('LIFECYCLE_CANNOT_ABORT')
    const l = await ledger(tx, identity, r.value)
    if (l?.value.actions.some(a => a.phase !== 'planned')) return unavailable()
    const aborted = { ...r.value, phase: 'aborted' as const, token: randomUUID(), generation: randomUUID(), revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) }
    await putReceipt(tx, identity, r.raw, aborted)
    if (l) await putLedger(tx, identity, l.raw, { ...l.value, generation: aborted.generation, revision: nextRevision(l.value.revision) }, aborted)
    if ((await tx.systemSetting.deleteMany({ where: { key: lifecycleFenceKey(identity.targetUserId), value: f.raw } })).count !== 1) return changed()
    return view(aborted)
  }, options)
}
/** DB-only callback. Cleanup/User delete, completion receipt and terminal pointer must commit together. */
export async function completeLifecycleOperation<T>(tx: Tx, claim: LifecycleClaim, work: () => Promise<T>): Promise<T> {
  const { identity, r, f } = await authorize(tx, claim, ['executing']), l = await ledger(tx, identity, r.value)
  if (!l || r.value.reason !== null || l.value.actions.some(a => a.phase !== 'confirmed')) throw new LifecycleError('LIFECYCLE_RESULT_UNCONFIRMED')
  const result = await work(), exists = Boolean(await tx.user.findUnique({ where: { id: identity.targetUserId }, select: { id: true } }))
  if (identity.kind === 'retirement' ? exists : !exists) throw new LifecycleError('LIFECYCLE_COMPLETION_INCONSISTENT')
  const completed = { ...r.value, phase: 'completed' as const, revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) }
  await putReceipt(tx, identity, r.raw, completed)
  if (identity.kind === 'retirement') {
    if ((await tx.systemSetting.updateMany({ where: { key: lifecycleFenceKey(identity.targetUserId), value: f.raw }, data: { value: JSON.stringify({ ...f.value, state: 'retired' }) } })).count !== 1) return changed()
  } else if ((await tx.systemSetting.deleteMany({ where: { key: lifecycleFenceKey(identity.targetUserId), value: f.raw } })).count !== 1) return changed()
  return result
}
/** DB-only observation: never generates a claim, changes a row, calls a provider or extends a deadline. */
export async function inspectLifecycleOperation(db: LifecycleDb, identity: LifecycleIdentity) {
  assertLifecycleIdentity(identity)
  return db.$transaction(async tx => {
    const exists = await userExists(tx, identity.targetUserId), r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (f?.value.state === 'active' && !exists) return unavailable()
    if (!r) { if (f?.value.operationId === identity.operationId) return unavailable(); return { operationId: identity.operationId, phase: 'missing' as const, actions: [], canAbort: true, canResume: false } }
    if (['reserved', 'executing'].includes(r.value.phase) && (!exists || f?.value.operationId !== identity.operationId) || r.value.phase === 'completed' && identity.kind === 'retirement' && (exists || f?.value.state !== 'retired' || f.value.operationId !== identity.operationId) || r.value.phase === 'aborted' && f?.value.operationId === identity.operationId) return unavailable()
    const l = await ledger(tx, identity, r.value)
    if (['executing', 'completed'].includes(r.value.phase) && !l) return unavailable()
    return { ...view(r.value), actions: l?.value.actions.map(a => ({ key: a.key, type: a.type, phase: a.phase, status: a.outcome?.status ?? null })) ?? [], canAbort: r.value.phase === 'reserved', canResume: ['reserved', 'executing'].includes(r.value.phase) && r.value.reason === null && !l?.value.actions.some(a => a.phase === 'dispatched') }
  }, options)
}
