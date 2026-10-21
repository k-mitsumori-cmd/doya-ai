import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import {
  LifecycleError, assertLifecycleIdentity, lifecycleIdentity, lifecycleSubject, lifecycleReceiptKey, lifecycleFenceKey,
  lifecycleLedgerKey, lifecycleActionKey, readLifecycleReceipt, readLifecycleFence, readLifecycleLedger,
  validLifecycleUser, validLifecycleDigest, validLifecycleUuid, validLifecycleResourceForKind, validLifecycleOutcome,
  type LifecycleIdentity, type LifecycleClaim, type LifecycleReceipt, type LifecycleFence, type LifecycleLedger,
  type LifecycleResource, type LifecycleOutcome,
} from './state'
import { parseSubscriptionPlan, subscriptionPlanKey, subscriptionResources, type SubscriptionPlan } from './subscription-plan'
import { assertVerifiedSubscriptionFact, type VerifiedSubscriptionFact } from './subscription-provider'

type Tx = Prisma.TransactionClient
export type LifecycleDb = Pick<PrismaClient, '$transaction'>
const options = { isolationLevel: 'ReadCommitted' as const, maxWait: 10000, timeout: 30000 }
const changed = (): never => { throw new LifecycleError('LIFECYCLE_CLAIM_CHANGED') }
const unavailable = (): never => { throw new LifecycleError('LIFECYCLE_STATE_UNAVAILABLE') }
const rawReceiptKey = (userId: string, operationId: string) => `doya-account-operation:v2:${operationId}`
/** Serialize every new receipt or legacy capability for one global UUID before its first write. */
export async function assertGlobalLifecycleOperationIdFree(tx: Tx, operationId: string): Promise<void> {
  if (!validLifecycleUuid(operationId)) return unavailable()
  await tx.$queryRaw`SELECT 1::integer AS locked FROM pg_advisory_xact_lock(hashtext(${operationId})::bigint)`
  const keys = [rawReceiptKey('', operationId), `doya-account-action:v2:${operationId}`, `doya-checkout-plan:v2:${operationId}`, `doya-checkout-capability:v2:${operationId}`, `doya-subscription-plan:v1:${operationId}`]
  if (await tx.systemSetting.count({ where: { key: { in: keys } } })) throw new LifecycleError('LIFECYCLE_IDENTITY_CONFLICT')
  if (await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${operationId}:` } }, select: { key: true } })) throw new LifecycleError('LIFECYCLE_IDENTITY_CONFLICT')
}
const view = (r: LifecycleReceipt) => ({ operationId: r.operationId, kind: r.kind, phase: r.phase, reason: r.reason, createdAt: r.createdAt, updatedAt: r.updatedAt })
const nextRevision = (n: number) => { if (n >= Number.MAX_SAFE_INTEGER - 1) return unavailable(); return n + 1 }
const updateTime = (r: LifecycleReceipt) => new Date(Math.max(Date.now(), Date.parse(r.updatedAt) + 1)).toISOString()

async function subscriptionPlan(tx: Tx, identity: LifecycleIdentity) {
  const row = await tx.systemSetting.findUnique({ where: { key: subscriptionPlanKey(identity.operationId) }, select: { value: true } })
  if (!row) return unavailable()
  const plan = parseSubscriptionPlan(row.value)
  if (JSON.stringify(plan.identity) !== JSON.stringify(identity)) return unavailable()
  return plan
}

async function subscriptionUser(tx: Tx, plan: SubscriptionPlan) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${plan.identity.targetUserId} FOR UPDATE`
  if (rows.length !== 1 || rows[0].id !== plan.identity.targetUserId) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
  const user = await tx.user.findUnique({ where: { id: plan.identity.targetUserId }, select: { email: true, stripeCustomerId: true, stripeSubscriptionId: true } })
  if (!user || user.email?.trim().toLowerCase() !== plan.email || user.stripeCustomerId !== plan.expectedCustomerId || user.stripeSubscriptionId !== plan.expectedSubscriptionId) throw new LifecycleError('SUBSCRIPTION_REFERENCE_CHANGED')
  return user
}

/** One transaction creates the complete subscription authority or nothing. */
export async function admitSubscriptionLifecycle(db: LifecycleDb, plan: SubscriptionPlan) {
  parseSubscriptionPlan(JSON.stringify(plan))
  const identity = plan.identity
  const resources = subscriptionResources(plan)
  const actions = resources.map(resource => ({ ...resource, key: lifecycleActionKey(resource), phase: 'planned' as const, dispatchToken: null, outcome: null })).sort((a, b) => a.key.localeCompare(b.key))
  if (new Set(actions.map(action => action.key)).size !== actions.length) return unavailable()
  return db.$transaction(async tx => {
    await subscriptionUser(tx, plan)
    const old = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (old) {
      if (old.value.phase === 'aborted' && await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } })) return unavailable()
      const saved = await subscriptionPlan(tx, identity)
      if (old.value.inputDigest !== plan.inputDigest || JSON.stringify(saved) !== JSON.stringify(plan)) throw new LifecycleError('LIFECYCLE_INPUT_CONFLICT')
      const l = await ledger(tx, identity, old.value)
      if (!l || JSON.stringify(l.value.actions.map(({ type, mode, resourceId, inputDigest, key }) => ({ type, mode, resourceId, inputDigest, key }))) !== JSON.stringify(actions.map(({ type, mode, resourceId, inputDigest, key }) => ({ type, mode, resourceId, inputDigest, key })))) return unavailable()
      if (['reserved', 'executing'].includes(old.value.phase) && f?.value.operationId !== identity.operationId) return unavailable()
      return { ...view(old.value), created: false, claim: ['reserved', 'executing'].includes(old.value.phase) ? { ...identity, generation: old.value.generation, token: old.value.token } as LifecycleClaim : null }
    }
    if (f) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    await assertGlobalLifecycleOperationIdFree(tx, identity.operationId)
    if (await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } })) return unavailable()
    const now = new Date().toISOString()
    const r: LifecycleReceipt = { version: 2, targetHash: plan.targetHash, operationId: identity.operationId, operator: identity.operator, kind: identity.kind, inputDigest: plan.inputDigest, generation: randomUUID(), token: randomUUID(), revision: 0, phase: 'reserved', reason: null, createdAt: now, updatedAt: now }
    const f2: LifecycleFence = { version: 2, operationId: r.operationId, generation: r.generation, kind: r.kind, state: 'active' }
    const l: LifecycleLedger = { version: 2, targetHash: r.targetHash, operationId: r.operationId, generation: r.generation, revision: 0, actions }
    readLifecycleLedger(JSON.stringify(l), r)
    await tx.systemSetting.create({ data: { key: lifecycleReceiptKey(identity), value: JSON.stringify(r) } })
    await tx.systemSetting.create({ data: { key: lifecycleFenceKey(identity.targetUserId), value: JSON.stringify(f2) } })
    await tx.systemSetting.create({ data: { key: subscriptionPlanKey(identity.operationId), value: JSON.stringify(plan) } })
    await tx.systemSetting.create({ data: { key: lifecycleLedgerKey(identity), value: JSON.stringify(l) } })
    return { ...view(r), created: true, claim: { ...identity, generation: r.generation, token: r.token } as LifecycleClaim }
  }, options)
}

/** The reference check and dispatch evidence commit under the same User lock. */
export async function dispatchSubscriptionAction(db: LifecycleDb, claim: LifecycleClaim, key: string) {
  lifecycleIdentity(claim)
  if (!['cancel', 'resume'].includes(claim.kind) || !validLifecycleDigest(key)) throw new LifecycleError('INVALID_LIFECYCLE_ACTION', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing'])
    const p = await subscriptionPlan(tx, identity)
    await subscriptionUser(tx, p)
    const l = await ledger(tx, identity, r.value)
    if (!l || r.value.inputDigest !== p.inputDigest || r.value.reason !== null) return unavailable()
    const action = l.value.actions.find(a => a.key === key)
    if (!action || action.phase !== 'planned' || l.value.actions.some(a => a.phase === 'dispatched')) throw new LifecycleError('LIFECYCLE_RESULT_UNCONFIRMED')
    action.phase = 'dispatched'; action.dispatchToken = randomUUID(); l.value.revision = nextRevision(l.value.revision)
    await putLedger(tx, identity, l.raw, l.value, r.value)
    return { action: { ...action }, dispatchToken: action.dispatchToken }
  }, options)
}

/** Final DB authority/read before an external provider request; no lock is held across provider I/O. */
export async function assertSubscriptionDispatchBound(db: LifecycleDb, claim: LifecycleClaim, key: string, dispatchToken: string) {
  lifecycleIdentity(claim)
  if (!validLifecycleDigest(key) || !validLifecycleUuid(dispatchToken)) throw new LifecycleError('INVALID_LIFECYCLE_ACTION', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing'])
    const p = await subscriptionPlan(tx, identity)
    await subscriptionUser(tx, p)
    const l = await ledger(tx, identity, r.value)
    if (!l || r.value.reason !== null || !l.value.actions.some(a => a.key === key && a.phase === 'dispatched' && a.dispatchToken === dispatchToken)) return changed()
    return p
  }, options)
}

const subscriptionFactKey = (operationId: string, actionKey: string) => `doya-subscription-fact:v1:${operationId}:${actionKey}`
async function assertStoredSubscriptionFacts(tx: Tx, plan: SubscriptionPlan, actions: LifecycleLedger['actions']) {
  if (actions.length !== plan.targets.length) return unavailable()
  for (const action of actions) {
    const target = plan.targets.find(t => t.id === action.resourceId)
    if (!target) return unavailable()
    const row = await tx.systemSetting.findUnique({ where: { key: subscriptionFactKey(plan.identity.operationId, action.key) }, select: { value: true } })
    if (action.phase !== 'confirmed') { if (row) return unavailable(); continue }
    if (!row) return unavailable()
    let fact: VerifiedSubscriptionFact
    try { fact = JSON.parse(row.value) as VerifiedSubscriptionFact } catch { return unavailable() }
    if (!fact || typeof fact !== 'object') return unavailable()
    const immediate = plan.identity.kind === 'cancel' && plan.cancelMode === 'immediate'
    if (fact.operationId !== plan.identity.operationId || fact.actionKey !== action.key || fact.subscriptionId !== target.id ||
        fact.customerId !== target.customerId || fact.mode !== plan.mode || !validLifecycleOutcome(action, fact.outcome) ||
        (immediate ? fact.status !== 'canceled' : !['active', 'trialing', 'past_due'].includes(fact.status) ||
          fact.cancelAtPeriodEnd !== (plan.identity.kind === 'cancel')) ||
        !Number.isSafeInteger(fact.currentPeriodEnd) || fact.currentPeriodEnd <= 0 ||
        JSON.stringify(fact.outcome) !== JSON.stringify(action.outcome)) return unavailable()
  }
}

async function assertAbortedSubscriptionState(tx: Tx, identity: LifecycleIdentity, r: LifecycleReceipt) {
  const planRow = await tx.systemSetting.findUnique({ where: { key: subscriptionPlanKey(identity.operationId) }, select: { key: true } })
  const ledgerRow = await tx.systemSetting.findUnique({ where: { key: lifecycleLedgerKey(identity) }, select: { key: true } })
  if (Boolean(planRow) !== Boolean(ledgerRow)) return unavailable()
  if (!planRow) return
  const p = await subscriptionPlan(tx, identity), l = await ledger(tx, identity, r)
  if (!l || p.inputDigest !== r.inputDigest || l.value.actions.some(a => a.phase !== 'planned')) return unavailable()
  await assertStoredSubscriptionFacts(tx, p, l.value.actions)
}

/** Persist verified per-resource evidence and ledger confirmation together. */
export async function confirmSubscriptionAction(db: LifecycleDb, claim: LifecycleClaim, key: string, dispatchToken: string, fact: VerifiedSubscriptionFact) {
  lifecycleIdentity(claim)
  assertVerifiedSubscriptionFact(fact)
  if (!['cancel', 'resume'].includes(claim.kind) || !validLifecycleDigest(key) || !validLifecycleUuid(dispatchToken) || fact.operationId !== claim.operationId || fact.actionKey !== key) throw new LifecycleError('INVALID_LIFECYCLE_ACTION', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing'])
    const p = await subscriptionPlan(tx, identity)
    await subscriptionUser(tx, p)
    const l = await ledger(tx, identity, r.value)
    if (!l || r.value.inputDigest !== p.inputDigest) return unavailable()
    const action = l.value.actions.find(a => a.key === key)
    const target = p.targets.find(t => t.id === fact.subscriptionId)
    if (!action || !target || action.resourceId !== target.id || action.mode !== p.mode || action.dispatchToken !== dispatchToken ||
        fact.customerId !== target.customerId || fact.mode !== p.mode || !validLifecycleOutcome(action, fact.outcome)) return changed()
    const saved = await tx.systemSetting.findUnique({ where: { key: subscriptionFactKey(identity.operationId, key) }, select: { value: true } })
    if (action.phase === 'confirmed') {
      if (!saved || saved.value !== JSON.stringify(fact) || JSON.stringify(action.outcome) !== JSON.stringify(fact.outcome)) return unavailable()
      return
    }
    if (action.phase !== 'dispatched' || saved) return changed()
    await tx.systemSetting.create({ data: { key: subscriptionFactKey(identity.operationId, key), value: JSON.stringify(fact) } })
    action.phase = 'confirmed'; action.outcome = fact.outcome; l.value.revision = nextRevision(l.value.revision)
    await putLedger(tx, identity, l.raw, l.value, r.value)
    if (r.value.reason !== null && !l.value.actions.some(a => a.phase === 'dispatched')) await putReceipt(tx, identity, r.raw, { ...r.value, reason: null, revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) })
  }, options)
}

/** Unknown external outcome and the operational alert queue share one DB commit. No delivery occurs here. */
export async function markSubscriptionUnknown(db: LifecycleDb, claim: LifecycleClaim, key: string, dispatchToken: string) {
  lifecycleIdentity(claim)
  if (!['cancel', 'resume'].includes(claim.kind) || !validLifecycleDigest(key) || !validLifecycleUuid(dispatchToken)) throw new LifecycleError('INVALID_LIFECYCLE_ACTION', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing'])
    const p = await subscriptionPlan(tx, identity), l = await ledger(tx, identity, r.value)
    if (!l || !l.value.actions.some(a => a.key === key && a.phase === 'dispatched' && a.dispatchToken === dispatchToken)) return changed()
    if (r.value.reason !== 'NEEDS_REVIEW') await putReceipt(tx, identity, r.raw,
      { ...r.value, reason: 'EXTERNAL_UNKNOWN', revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) })
    if (claim.kind === 'cancel') await tx.stripeWebhookNotification.createMany({ data: [{
      eventId: `billing-cancel-failed:${identity.targetUserId}:${identity.operationId}:${key.slice(0, 12)}`,
      eventType: 'billing.cancel.failed', payload: {
        type: 'cancellation_incomplete', userId: identity.targetUserId, userEmail: p.email,
        details: `解約操作 ${identity.operationId} の対象 ${l.value.actions.length} 件中、契約 ${l.value.actions.find(a => a.key === key)?.resourceId} の結果を確認できません。`,
      },
    }], skipDuplicates: true })
  }, options)
}

/** Terminal settlement is short, fenced, and does not call Stripe or send a notification. */
export async function completeSubscriptionLifecycle(db: LifecycleDb, claim: LifecycleClaim) {
  const identity = lifecycleIdentity(claim)
  if (!['cancel', 'resume'].includes(claim.kind)) throw new LifecycleError('INVALID_LIFECYCLE_CLAIM', 400)
  return db.$transaction(async tx => completeLifecycleOperation(tx, claim, async () => {
    const p = await subscriptionPlan(tx, identity)
    await subscriptionUser(tx, p)
    const r = await receipt(tx, identity), l = r && await ledger(tx, identity, r.value)
    if (!r || !l || p.inputDigest !== r.value.inputDigest) return unavailable()
    await assertStoredSubscriptionFacts(tx, p, l.value.actions)
    const primary = p.targets[0]!
    await tx.user.update({ where: { id: claim.targetUserId }, data: {
      stripeSubscriptionId: p.identity.kind === 'cancel' && p.cancelMode === 'immediate' ? null : primary.id,
      stripeCustomerId: primary.customerId,
    } })
    return { operationId: claim.operationId, phase: 'completed' as const, kind: claim.kind,
      results: l.value.actions.map(a => ({ subscriptionId: a.resourceId, status: a.outcome?.status })) }
  }), options)
}

export async function readSubscriptionLifecycle(db: LifecycleDb, identity: LifecycleIdentity) {
  assertLifecycleIdentity(identity)
  if (!['cancel', 'resume'].includes(identity.kind)) throw new LifecycleError('INVALID_LIFECYCLE_IDENTITY', 400)
  return db.$transaction(async tx => {
    if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    const r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (!r) {
      if (await tx.systemSetting.findUnique({ where: { key: subscriptionPlanKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: lifecycleLedgerKey(identity) }, select: { key: true } }) ||
          await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } }) ||
          f?.value.operationId === identity.operationId) return unavailable()
      return { operationId: identity.operationId, kind: identity.kind, phase: 'missing' as const, reason: null, actions: [], canAbort: true, canContinue: false }
    }
    if (r.value.phase === 'aborted') {
      if (f?.value.operationId === identity.operationId ||
          await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } })) return unavailable()
      await assertAbortedSubscriptionState(tx, identity, r.value)
      return { operationId: identity.operationId, kind: identity.kind, phase: 'aborted' as const, reason: null, actions: [], canAbort: false, canContinue: false }
    }
    const p = await subscriptionPlan(tx, identity), l = await ledger(tx, identity, r.value)
    if (!l || p.inputDigest !== r.value.inputDigest || ['reserved', 'executing'].includes(r.value.phase) && f?.value.operationId !== identity.operationId) return unavailable()
    await assertStoredSubscriptionFacts(tx, p, l.value.actions)
    const actions = l.value.actions.map(a => ({ subscriptionId: a.resourceId, phase: a.phase, status: a.outcome?.status ?? null }))
    return { operationId: identity.operationId, kind: identity.kind, phase: r.value.phase, reason: r.value.reason,
      actions, canAbort: r.value.phase === 'reserved', canContinue: r.value.phase === 'reserved' || r.value.phase === 'executing' && r.value.reason === null && !l.value.actions.some(a => a.phase === 'dispatched') }
  }, options)
}

/** Internal-only: a handle can recover its authority, never mint a new operation. */
export async function readSubscriptionServerState(db: LifecycleDb, identity: LifecycleIdentity) {
  assertLifecycleIdentity(identity)
  if (!['cancel', 'resume'].includes(identity.kind)) throw new LifecycleError('INVALID_LIFECYCLE_IDENTITY', 400)
  return db.$transaction(async tx => {
    if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    const r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (!r) {
      if (await tx.systemSetting.findUnique({ where: { key: subscriptionPlanKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: lifecycleLedgerKey(identity) }, select: { key: true } }) ||
          await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } }) ||
          f?.value.operationId === identity.operationId) return unavailable()
      return null
    }
    if (r.value.phase === 'aborted') {
      if (f?.value.operationId === identity.operationId ||
          await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } })) return unavailable()
      await assertAbortedSubscriptionState(tx, identity, r.value)
      return { phase: 'aborted' as const, plan: null, claim: null, actions: [], reason: null }
    }
    const p = await subscriptionPlan(tx, identity), l = await ledger(tx, identity, r.value)
    if (!l || r.value.inputDigest !== p.inputDigest || ['reserved', 'executing'].includes(r.value.phase) && f?.value.operationId !== identity.operationId) return unavailable()
    await assertStoredSubscriptionFacts(tx, p, l.value.actions)
    return { phase: r.value.phase, plan: p, claim: ['reserved', 'executing'].includes(r.value.phase)
      ? { ...identity, generation: r.value.generation, token: r.value.token } as LifecycleClaim : null,
      actions: l.value.actions.map(a => ({ ...a })), reason: r.value.reason }
  }, options)
}

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
    await assertGlobalLifecycleOperationIdFree(tx, identity.operationId)
    // A new retirement reservation must invalidate Serializable writers that
    // acquired their snapshot before waiting for this User row lock.
    if (identity.kind === 'retirement') {
      const touched = await tx.$executeRaw`UPDATE "User" SET id = id WHERE id = ${identity.targetUserId}`
      if (touched !== 1) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    }
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
    if (claim.kind === 'checkout' && action.type === 'checkout_create' && l.value.actions.some(a => a.type === 'customer_create' && a.phase !== 'confirmed')) throw new LifecycleError('CHECKOUT_CUSTOMER_UNCONFIRMED')
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
      await assertGlobalLifecycleOperationIdFree(tx, identity.operationId)
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
