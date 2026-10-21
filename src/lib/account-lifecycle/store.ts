import { createHash, randomUUID } from 'node:crypto'
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
import { selfSettlementRequirementKey, selfSettlementCoverageKey, makeSelfSettlementRequirement,
  readSelfSettlementRequirement, readSelfSettlementCoverage, type SelfSettlementCoverage } from './self-subscription-settlement'
import { adminSubscriptionPlanKey, adminSubscriptionFactKey, adminSubscriptionSettlementKey, adminSubscriptionResource,
  adminSubscriptionActionKey, parseAdminSubscriptionPlan, readAdminSubscriptionSettlement, type AdminSubscriptionPlan,
  type AdminSubscriptionSettlement } from './admin-subscription-plan'
import { assertAdminSubscriptionFact, type AdminSubscriptionFact } from './admin-subscription-fact'
import { verifyAdminAuthorityTx } from '@/lib/admin-auth'
import { projectUnifiedBilling, type BillingSyncInput } from '@/lib/billing-sync'

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
  const keys = [rawReceiptKey('', operationId), `doya-account-action:v2:${operationId}`, `doya-checkout-plan:v2:${operationId}`, `doya-checkout-capability:v2:${operationId}`, `doya-subscription-plan:v1:${operationId}`, selfSettlementRequirementKey(operationId), selfSettlementCoverageKey(operationId), `doya-admin-subscription-plan:v1:${operationId}`, `doya-admin-subscription-fact:v1:${operationId}`, `doya-admin-subscription-settlement:v1:${operationId}`]
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

async function adminSubscriptionPlan(tx: Tx, identity: LifecycleIdentity): Promise<AdminSubscriptionPlan> {
  const row = await tx.systemSetting.findUnique({ where: { key: adminSubscriptionPlanKey(identity.operationId) }, select: { value: true } })
  if (!row) return unavailable()
  const plan = parseAdminSubscriptionPlan(row.value)
  if (JSON.stringify(plan.identity) !== JSON.stringify(identity)) return unavailable()
  return plan
}

async function adminSubscriptionUser(tx: Tx, plan: AdminSubscriptionPlan) {
  const user = await tx.user.findUnique({ where: { id: plan.identity.targetUserId }, select: {
    id: true, email: true, stripeCustomerId: true, stripeSubscriptionId: true, stripePriceId: true,
  } })
  if (!user || user.email?.trim().toLowerCase() !== plan.email ||
      user.stripeCustomerId !== plan.expectedCustomerId ||
      user.stripeSubscriptionId !== plan.expectedSubscriptionId ||
      user.stripePriceId !== plan.expectedPriceId) throw new LifecycleError('ADMIN_SUBSCRIPTION_REFERENCE_CHANGED')
  return user
}

async function adminAuthority(tx: Tx, identity: LifecycleIdentity, sessionToken: string) {
  if (identity.operator.kind !== 'admin' ||
      !await verifyAdminAuthorityTx(tx, sessionToken, identity.operator.id)) throw new LifecycleError('ADMIN_AUTHORITY_CHANGED', 403)
}

/** User -> current AdminUser/AdminSession -> UUID; all authority rows and the new operation commit together. */
export async function admitAdminSubscriptionLifecycle(db: LifecycleDb, plan: AdminSubscriptionPlan, sessionToken: string) {
  parseAdminSubscriptionPlan(JSON.stringify(plan))
  const identity = plan.identity
  const resource = adminSubscriptionResource(plan)
  const action = { ...resource, key: adminSubscriptionActionKey(plan), phase: 'planned' as const, dispatchToken: null, outcome: null }
  return db.$transaction(async tx => {
    if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    await adminAuthority(tx, identity, sessionToken)
    await adminSubscriptionUser(tx, plan)
    const old = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (old) {
      const saved = await adminSubscriptionPlan(tx, identity)
      if (old.value.inputDigest !== plan.inputDigest || JSON.stringify(saved) !== JSON.stringify(plan)) throw new LifecycleError('LIFECYCLE_INPUT_CONFLICT')
      const l = await ledger(tx, identity, old.value)
      if (!l || l.value.actions.length !== 1 || l.value.actions[0]?.key !== action.key) return unavailable()
      if (['reserved', 'executing'].includes(old.value.phase) && f?.value.operationId !== identity.operationId) return unavailable()
      return { ...view(old.value), created: false, claim: ['reserved', 'executing'].includes(old.value.phase)
        ? { ...identity, generation: old.value.generation, token: old.value.token } as LifecycleClaim : null }
    }
    if (f) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    await assertGlobalLifecycleOperationIdFree(tx, identity.operationId)
    const now = new Date().toISOString()
    const r: LifecycleReceipt = { version: 2, targetHash: plan.targetHash, operationId: identity.operationId,
      operator: identity.operator, kind: identity.kind, inputDigest: plan.inputDigest,
      generation: randomUUID(), token: randomUUID(), revision: 0, phase: 'reserved', reason: null,
      createdAt: now, updatedAt: now }
    const f2: LifecycleFence = { version: 2, operationId: identity.operationId, generation: r.generation, kind: identity.kind, state: 'active' }
    const l: LifecycleLedger = { version: 2, targetHash: r.targetHash, operationId: identity.operationId,
      generation: r.generation, revision: 0, actions: [action] }
    readLifecycleLedger(JSON.stringify(l), r)
    await tx.systemSetting.create({ data: { key: lifecycleReceiptKey(identity), value: JSON.stringify(r) } })
    await tx.systemSetting.create({ data: { key: lifecycleFenceKey(identity.targetUserId), value: JSON.stringify(f2) } })
    await tx.systemSetting.create({ data: { key: adminSubscriptionPlanKey(identity.operationId), value: JSON.stringify(plan) } })
    await tx.systemSetting.create({ data: { key: lifecycleLedgerKey(identity), value: JSON.stringify(l) } })
    return { ...view(r), created: true, claim: { ...identity, generation: r.generation, token: r.token } as LifecycleClaim }
  }, options)
}

/** Status is a private, authority-checked observation; it never dispatches or clears a fence. */
export async function readAdminSubscriptionServerState(db: LifecycleDb, identity: LifecycleIdentity, sessionToken: string) {
  assertLifecycleIdentity(identity)
  if (identity.operator.kind !== 'admin' || !['cancel', 'resume'].includes(identity.kind)) throw new LifecycleError('INVALID_LIFECYCLE_IDENTITY', 400)
  return db.$transaction(async tx => {
    if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    await adminAuthority(tx, identity, sessionToken)
    const r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    const pRow = await tx.systemSetting.findUnique({ where: { key: adminSubscriptionPlanKey(identity.operationId) }, select: { value: true } })
    const factRow = await tx.systemSetting.findUnique({ where: { key: adminSubscriptionFactKey(identity.operationId) }, select: { value: true } })
    const settledRow = await tx.systemSetting.findUnique({ where: { key: adminSubscriptionSettlementKey(identity.operationId) }, select: { value: true } })
    if (!r) {
      if (pRow || factRow || settledRow || await tx.systemSetting.findUnique({ where: { key: lifecycleLedgerKey(identity) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: subscriptionPlanKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } }) ||
          f?.value.operationId === identity.operationId) return unavailable()
      return { phase: 'missing' as const, reason: null, plan: null, claim: null, action: null,
        canAbort: !f, canContinue: false }
    }
    if (r.value.phase === 'aborted') {
      if (f?.value.operationId === identity.operationId || factRow || settledRow ||
          await tx.systemSetting.findUnique({ where: { key: subscriptionPlanKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } }) ||
          Boolean(pRow) !== Boolean(await tx.systemSetting.findUnique({ where: { key: lifecycleLedgerKey(identity) }, select: { key: true } }))) return unavailable()
      if (pRow) {
        const p = await adminSubscriptionPlan(tx, identity), l = await ledger(tx, identity, r.value)
        if (!l || p.inputDigest !== r.value.inputDigest || l.value.actions.length !== 1 || l.value.actions[0]?.phase !== 'planned') return unavailable()
      }
      return { phase: 'aborted' as const, reason: null, plan: null, claim: null, action: null,
        canAbort: false, canContinue: false }
    }
    if (!pRow) return unavailable()
    const p = await adminSubscriptionPlan(tx, identity), l = await ledger(tx, identity, r.value)
    if (!l || l.value.actions.length !== 1 || l.value.actions[0]?.key !== adminSubscriptionActionKey(p) ||
        p.inputDigest !== r.value.inputDigest ||
        ['reserved', 'executing'].includes(r.value.phase) && f?.value.operationId !== identity.operationId) return unavailable()
    const action = l.value.actions[0]!
    if (r.value.phase === 'completed') {
      if (!settledRow) return unavailable()
      readAdminSubscriptionSettlement(p, settledRow.value)
    } else if (settledRow) return unavailable()
    if (action.phase === 'confirmed') {
      if (!factRow) return unavailable()
      const fact = assertAdminSubscriptionFact(p, factRow.value)
      if (JSON.stringify(fact.outcome) !== JSON.stringify(action.outcome)) return unavailable()
    } else if (factRow) return unavailable()
    return { phase: r.value.phase, reason: r.value.reason, plan: p,
      claim: ['reserved', 'executing'].includes(r.value.phase)
        ? { ...identity, generation: r.value.generation, token: r.value.token } as LifecycleClaim : null,
      action: { ...action }, canAbort: r.value.phase === 'reserved',
      canContinue: r.value.phase === 'reserved' || r.value.phase === 'executing' && r.value.reason === null && action.phase === 'planned' }
  }, options)
}

export async function startAdminSubscriptionLifecycle(db: LifecycleDb, claim: LifecycleClaim, sessionToken: string) {
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['reserved'])
    await adminAuthority(tx, identity, sessionToken)
    const p = await adminSubscriptionPlan(tx, identity)
    await adminSubscriptionUser(tx, p)
    const l = await ledger(tx, identity, r.value)
    if (!l || r.value.inputDigest !== p.inputDigest || r.value.reason !== null || l.value.actions.length !== 1 ||
        l.value.actions[0]?.phase !== 'planned') return unavailable()
    await putReceipt(tx, identity, r.raw, { ...r.value, phase: 'executing', revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) })
  }, options)
}

/** Explicit same-handle continuation only before dispatch; no unknown action rotates its claim. */
export async function continueAdminSubscriptionLifecycle(db: LifecycleDb, identity: LifecycleIdentity, sessionToken: string) {
  assertLifecycleIdentity(identity)
  return db.$transaction(async tx => {
    if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    await adminAuthority(tx, identity, sessionToken)
    const r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (!r || !f || f.value.operationId !== identity.operationId || r.value.reason !== null ||
        !['reserved', 'executing'].includes(r.value.phase)) return changed()
    const p = await adminSubscriptionPlan(tx, identity)
    await adminSubscriptionUser(tx, p)
    const l = await ledger(tx, identity, r.value)
    if (!l || l.value.actions.length !== 1 || l.value.actions[0]?.phase !== 'planned') throw new LifecycleError('LIFECYCLE_RESULT_UNCONFIRMED')
    const updated: LifecycleReceipt = { ...r.value, generation: randomUUID(), token: randomUUID(), revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) }
    await putReceipt(tx, identity, r.raw, updated)
    await putLedger(tx, identity, l.raw, { ...l.value, generation: updated.generation, revision: nextRevision(l.value.revision) }, updated)
    if ((await tx.systemSetting.updateMany({ where: { key: lifecycleFenceKey(identity.targetUserId), value: f.raw },
      data: { value: JSON.stringify({ ...f.value, generation: updated.generation }) } })).count !== 1) return changed()
    return { ...identity, generation: updated.generation, token: updated.token } as LifecycleClaim
  }, options)
}

export async function dispatchAdminSubscriptionAction(db: LifecycleDb, claim: LifecycleClaim, sessionToken: string) {
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing'])
    await adminAuthority(tx, identity, sessionToken)
    const p = await adminSubscriptionPlan(tx, identity)
    await adminSubscriptionUser(tx, p)
    const l = await ledger(tx, identity, r.value), key = adminSubscriptionActionKey(p)
    if (!l || r.value.inputDigest !== p.inputDigest || r.value.reason !== null || l.value.actions.length !== 1 ||
        l.value.actions[0]?.key !== key || l.value.actions[0].phase !== 'planned') throw new LifecycleError('LIFECYCLE_RESULT_UNCONFIRMED')
    const action = l.value.actions[0]
    action.phase = 'dispatched'; action.dispatchToken = randomUUID(); l.value.revision = nextRevision(l.value.revision)
    await putLedger(tx, identity, l.raw, l.value, r.value)
    return { plan: p, actionKey: key, dispatchToken: action.dispatchToken }
  }, options)
}

/** Last short authority/read check before provider I/O; no transaction lock spans the SDK call. */
export async function assertAdminSubscriptionDispatchBound(db: LifecycleDb, claim: LifecycleClaim,
  sessionToken: string, dispatchToken: string) {
  if (!validLifecycleUuid(dispatchToken)) throw new LifecycleError('INVALID_LIFECYCLE_ACTION', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing'])
    await adminAuthority(tx, identity, sessionToken)
    const p = await adminSubscriptionPlan(tx, identity)
    await adminSubscriptionUser(tx, p)
    const l = await ledger(tx, identity, r.value)
    if (!l || r.value.reason !== null || l.value.actions.length !== 1 ||
        l.value.actions[0]?.key !== adminSubscriptionActionKey(p) || l.value.actions[0].phase !== 'dispatched' ||
        l.value.actions[0].dispatchToken !== dispatchToken) return changed()
    return p
  }, options)
}

/** Persist exact provider evidence even if the admin was revoked after the external request. */
export async function confirmAdminSubscriptionAction(db: LifecycleDb, claim: LifecycleClaim,
  dispatchToken: string, fact: AdminSubscriptionFact) {
  if (!validLifecycleUuid(dispatchToken)) throw new LifecycleError('INVALID_LIFECYCLE_ACTION', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing'])
    const p = await adminSubscriptionPlan(tx, identity)
    assertAdminSubscriptionFact(p, JSON.stringify(fact))
    const l = await ledger(tx, identity, r.value)
    if (!l || r.value.inputDigest !== p.inputDigest || l.value.actions.length !== 1) return unavailable()
    const action = l.value.actions[0]!
    const saved = await tx.systemSetting.findUnique({ where: { key: adminSubscriptionFactKey(identity.operationId) }, select: { value: true } })
    if (action.phase === 'confirmed') {
      if (!saved || saved.value !== JSON.stringify(fact) || JSON.stringify(action.outcome) !== JSON.stringify(fact.outcome)) return unavailable()
      return
    }
    if (action.phase !== 'dispatched' || action.dispatchToken !== dispatchToken || saved) return changed()
    await tx.systemSetting.create({ data: { key: adminSubscriptionFactKey(identity.operationId), value: JSON.stringify(fact) } })
    action.phase = 'confirmed'; action.outcome = fact.outcome; l.value.revision = nextRevision(l.value.revision)
    await putLedger(tx, identity, l.raw, l.value, r.value)
    if (r.value.reason !== null) await putReceipt(tx, identity, r.raw,
      { ...r.value, reason: null, revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) })
  }, options)
}

export async function markAdminSubscriptionUnknown(db: LifecycleDb, claim: LifecycleClaim, dispatchToken: string) {
  if (!validLifecycleUuid(dispatchToken)) throw new LifecycleError('INVALID_LIFECYCLE_ACTION', 400)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing'])
    const p = await adminSubscriptionPlan(tx, identity), l = await ledger(tx, identity, r.value)
    if (!l || l.value.actions.length !== 1 || l.value.actions[0]?.key !== adminSubscriptionActionKey(p) ||
        l.value.actions[0].phase !== 'dispatched' || l.value.actions[0].dispatchToken !== dispatchToken) return changed()
    if (r.value.reason !== 'NEEDS_REVIEW') await putReceipt(tx, identity, r.raw,
      { ...r.value, reason: 'EXTERNAL_UNKNOWN', revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) })
  }, options)
}

export async function abortAdminSubscriptionLifecycle(db: LifecycleDb, identity: LifecycleIdentity, sessionToken: string) {
  assertLifecycleIdentity(identity)
  if (identity.operator.kind !== 'admin' || !['cancel', 'resume'].includes(identity.kind)) throw new LifecycleError('INVALID_LIFECYCLE_IDENTITY', 400)
  return db.$transaction(async tx => {
    if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    await adminAuthority(tx, identity, sessionToken)
    const r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (r?.value.phase === 'aborted') {
      if (f?.value.operationId === identity.operationId || await tx.systemSetting.findUnique({ where: { key: adminSubscriptionFactKey(identity.operationId) }, select: { key: true } })) return unavailable()
      return view(r.value)
    }
    if (!r) {
      if (f) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
      await assertGlobalLifecycleOperationIdFree(tx, identity.operationId)
      const now = new Date().toISOString()
      const inputDigest = createHash('sha256').update(JSON.stringify(['admin', identity, 'aborted-without-dispatch'])).digest('hex')
      const aborted: LifecycleReceipt = { version: 2, targetHash: lifecycleSubject(identity.targetUserId), operationId: identity.operationId,
        operator: identity.operator, kind: identity.kind, inputDigest, generation: randomUUID(), token: randomUUID(),
        revision: 0, phase: 'aborted', reason: null, createdAt: now, updatedAt: now }
      await tx.systemSetting.create({ data: { key: lifecycleReceiptKey(identity), value: JSON.stringify(aborted) } })
      return view(aborted)
    }
    if (!f || f.value.operationId !== identity.operationId || r.value.phase !== 'reserved') throw new LifecycleError('LIFECYCLE_CANNOT_ABORT')
    const p = await adminSubscriptionPlan(tx, identity), l = await ledger(tx, identity, r.value)
    if (!l || p.inputDigest !== r.value.inputDigest || l.value.actions.length !== 1 || l.value.actions[0]?.phase !== 'planned' ||
        await tx.systemSetting.findUnique({ where: { key: adminSubscriptionFactKey(identity.operationId) }, select: { key: true } })) return unavailable()
    const aborted: LifecycleReceipt = { ...r.value, phase: 'aborted', generation: randomUUID(), token: randomUUID(), revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) }
    await putReceipt(tx, identity, r.raw, aborted)
    await putLedger(tx, identity, l.raw, { ...l.value, generation: aborted.generation, revision: nextRevision(l.value.revision) }, aborted)
    if ((await tx.systemSetting.deleteMany({ where: { key: lifecycleFenceKey(identity.targetUserId), value: f.raw } })).count !== 1) return changed()
    return view(aborted)
  }, options)
}

/** Provider fact, current entitlement projection, completed receipt and fence release commit as one TX. */
export async function completeAdminSubscriptionLifecycle(db: LifecycleDb, claim: LifecycleClaim,
  sessionToken: string, settlement: BillingSyncInput | null) {
  const identity = lifecycleIdentity(claim)
  return db.$transaction(async tx => {
    const { r } = await authorize(tx, claim, ['executing'])
    await adminAuthority(tx, identity, sessionToken)
    const p = await adminSubscriptionPlan(tx, identity)
    await adminSubscriptionUser(tx, p)
    const l = await ledger(tx, identity, r.value)
    const factRow = await tx.systemSetting.findUnique({ where: { key: adminSubscriptionFactKey(identity.operationId) }, select: { value: true } })
    if (!l || l.value.actions.length !== 1 || l.value.actions[0]?.phase !== 'confirmed' ||
        r.value.inputDigest !== p.inputDigest || !factRow ||
        await tx.systemSetting.findUnique({ where: { key: adminSubscriptionSettlementKey(identity.operationId) }, select: { key: true } })) return unavailable()
    const fact = assertAdminSubscriptionFact(p, factRow.value)
    if (JSON.stringify(l.value.actions[0].outcome) !== JSON.stringify(fact.outcome)) return unavailable()
    if (p.intent === 'immediate_cancel') {
      if (!settlement || settlement.userId !== identity.targetUserId ||
          !['FREE', 'LIGHT', 'PRO', 'BUNDLE', 'ENTERPRISE'].includes(settlement.plan) ||
          settlement.stripeSubscriptionId === undefined || settlement.stripePriceId === undefined ||
          settlement.stripeCurrentPeriodEnd === undefined || settlement.preserveManualGrant === false ||
          settlement.role !== undefined || settlement.notificationOnUpgrade !== undefined ||
          (settlement.plan === 'FREE' ? settlement.stripeSubscriptionId !== null || settlement.stripePriceId !== null ||
            settlement.stripeCurrentPeriodEnd !== null : typeof settlement.stripeSubscriptionId !== 'string' ||
            typeof settlement.stripePriceId !== 'string' || !(settlement.stripeCurrentPeriodEnd instanceof Date))) return unavailable()
    } else if (settlement !== null) return unavailable()
    return completeLifecycleOperation(tx, claim, async () => {
      const projected = settlement ? await projectUnifiedBilling(tx, settlement) : null
      const coverage: AdminSubscriptionSettlement = {
        version: 1, source: 'admin', settlementPolicyVersion: 1,
        operationId: identity.operationId, targetHash: p.targetHash, planDigest: p.inputDigest,
        projected: Boolean(projected), userPlan: projected?.userPlan ?? null, appliedAt: new Date().toISOString(),
      }
      readAdminSubscriptionSettlement(p, JSON.stringify(coverage))
      await tx.systemSetting.create({ data: { key: adminSubscriptionSettlementKey(identity.operationId), value: JSON.stringify(coverage) } })
      return { operationId: identity.operationId, phase: 'completed' as const, intent: p.intent,
        subscriptionId: p.target.id, projectedPlan: projected?.userPlan ?? null }
    })
  }, { ...options, isolationLevel: 'Serializable' })
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
      if (old.value.phase === 'aborted' && (await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } }))) return unavailable()
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
    if (identity.kind === 'cancel' && plan.cancelMode === 'immediate') await tx.systemSetting.create({
      data: { key: selfSettlementRequirementKey(identity.operationId), value: JSON.stringify(makeSelfSettlementRequirement(plan)) },
    })
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
  if (await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { key: true } }) ||
      await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } })) return unavailable()
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

/** Explicit same-ID recovery of a pre-policy in-flight immediate operation. Status GET never adds coverage. */
export async function attachSelfImmediateSettlementRequirement(db: LifecycleDb, claim: LifecycleClaim) {
  const identity = lifecycleIdentity(claim)
  return db.$transaction(async tx => {
    const { r } = await authorize(tx, claim, ['reserved', 'executing'])
    const p = await subscriptionPlan(tx, identity)
    if (p.identity.kind !== 'cancel' || p.cancelMode !== 'immediate' || p.inputDigest !== r.value.inputDigest) return unavailable()
    await subscriptionUser(tx, p)
    const l = await ledger(tx, identity, r.value)
    if (!l) return unavailable()
    await assertStoredSubscriptionFacts(tx, p, l.value.actions)
    const key = selfSettlementRequirementKey(identity.operationId)
    const old = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (old) { readSelfSettlementRequirement(p, old.value); return false }
    if (await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } })) return unavailable()
    await tx.systemSetting.create({ data: { key, value: JSON.stringify(makeSelfSettlementRequirement(p)) } })
    return true
  }, options)
}

/** Terminal settlement is fenced; projection and receipt/fence commit in one transaction. */
export async function completeSubscriptionLifecycle(db: LifecycleDb, claim: LifecycleClaim, settlement: BillingSyncInput | null = null) {
  const identity = lifecycleIdentity(claim)
  if (!['cancel', 'resume'].includes(claim.kind)) throw new LifecycleError('INVALID_LIFECYCLE_CLAIM', 400)
  return db.$transaction(async tx => completeLifecycleOperation(tx, claim, async () => {
    const p = await subscriptionPlan(tx, identity)
    await subscriptionUser(tx, p)
    const r = await receipt(tx, identity), l = r && await ledger(tx, identity, r.value)
    if (!r || !l || p.inputDigest !== r.value.inputDigest) return unavailable()
    await assertStoredSubscriptionFacts(tx, p, l.value.actions)
    const primary = p.targets[0]!
    const immediate = p.identity.kind === 'cancel' && p.cancelMode === 'immediate'
    const required = await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { value: true } })
    const covered = await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } })
    if (covered) return unavailable()
    if (immediate) {
      if (!required || !settlement || settlement.userId !== identity.targetUserId ||
          !['FREE', 'LIGHT', 'PRO', 'BUNDLE', 'ENTERPRISE'].includes(settlement.plan) ||
          settlement.stripeSubscriptionId === undefined || settlement.stripePriceId === undefined ||
          settlement.stripeCurrentPeriodEnd === undefined || settlement.preserveManualGrant === false ||
          settlement.role !== undefined || settlement.notificationOnUpgrade !== undefined ||
          (settlement.plan === 'FREE' ? settlement.stripeSubscriptionId !== null || settlement.stripePriceId !== null ||
            settlement.stripeCurrentPeriodEnd !== null : typeof settlement.stripeSubscriptionId !== 'string' ||
            typeof settlement.stripePriceId !== 'string' || !(settlement.stripeCurrentPeriodEnd instanceof Date))) return unavailable()
      readSelfSettlementRequirement(p, required.value)
      const projection = await projectUnifiedBilling(tx, settlement)
      const coverage: SelfSettlementCoverage = { version: 1, source: 'self_service', policyVersion: 1,
        operationId: identity.operationId, targetHash: p.targetHash, planDigest: p.inputDigest,
        userPlan: projection.userPlan as SelfSettlementCoverage['userPlan'], appliedAt: new Date().toISOString() }
      readSelfSettlementCoverage(p, JSON.stringify(coverage))
      await tx.systemSetting.create({ data: { key: selfSettlementCoverageKey(identity.operationId), value: JSON.stringify(coverage) } })
    } else {
      if (required || settlement) return unavailable()
      await tx.user.update({ where: { id: claim.targetUserId }, data: {
        stripeSubscriptionId: primary.id, stripeCustomerId: primary.customerId,
      } })
    }
    return { operationId: claim.operationId, phase: 'completed' as const, kind: claim.kind,
      results: l.value.actions.map(a => ({ subscriptionId: a.resourceId, status: a.outcome?.status })) }
  }), { ...options, isolationLevel: settlement ? 'Serializable' : options.isolationLevel })
}

export async function readSubscriptionLifecycle(db: LifecycleDb, identity: LifecycleIdentity) {
  assertLifecycleIdentity(identity)
  if (!['cancel', 'resume'].includes(identity.kind)) throw new LifecycleError('INVALID_LIFECYCLE_IDENTITY', 400)
  return db.$transaction(async tx => {
    if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    const r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (!r) {
      if (await tx.systemSetting.findUnique({ where: { key: subscriptionPlanKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionPlanKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionFactKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionSettlementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: lifecycleLedgerKey(identity) }, select: { key: true } }) ||
          await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } }) ||
          f?.value.operationId === identity.operationId) return unavailable()
      return { operationId: identity.operationId, kind: identity.kind, phase: 'missing' as const, reason: null, actions: [], canAbort: true, canContinue: false }
    }
    if (r.value.phase === 'aborted') {
      if (f?.value.operationId === identity.operationId ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionPlanKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionFactKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionSettlementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } })) return unavailable()
      await assertAbortedSubscriptionState(tx, identity, r.value)
      return { operationId: identity.operationId, kind: identity.kind, phase: 'aborted' as const, reason: null, actions: [], canAbort: false, canContinue: false }
    }
    const p = await subscriptionPlan(tx, identity), l = await ledger(tx, identity, r.value)
    if (!l || p.inputDigest !== r.value.inputDigest || ['reserved', 'executing'].includes(r.value.phase) && f?.value.operationId !== identity.operationId) return unavailable()
    await assertStoredSubscriptionFacts(tx, p, l.value.actions)
    const requirement = await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { value: true } })
    const coverage = await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { value: true } })
    if (requirement) readSelfSettlementRequirement(p, requirement.value)
    if (coverage) { if (!requirement || r.value.phase !== 'completed') return unavailable(); readSelfSettlementCoverage(p, coverage.value) }
    if (r.value.phase === 'completed' && requirement && !coverage) return unavailable()
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
          await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionPlanKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionFactKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionSettlementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: lifecycleLedgerKey(identity) }, select: { key: true } }) ||
          await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } }) ||
          f?.value.operationId === identity.operationId) return unavailable()
      return null
    }
    if (r.value.phase === 'aborted') {
      if (f?.value.operationId === identity.operationId ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionPlanKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionFactKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findUnique({ where: { key: adminSubscriptionSettlementKey(identity.operationId) }, select: { key: true } }) ||
          await tx.systemSetting.findFirst({ where: { key: { startsWith: `doya-subscription-fact:v1:${identity.operationId}:` } }, select: { key: true } })) return unavailable()
      await assertAbortedSubscriptionState(tx, identity, r.value)
      return { phase: 'aborted' as const, plan: null, claim: null, actions: [], reason: null }
    }
    const p = await subscriptionPlan(tx, identity), l = await ledger(tx, identity, r.value)
    if (!l || r.value.inputDigest !== p.inputDigest || ['reserved', 'executing'].includes(r.value.phase) && f?.value.operationId !== identity.operationId) return unavailable()
    await assertStoredSubscriptionFacts(tx, p, l.value.actions)
    const requirement = await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { value: true } })
    const coverage = await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { value: true } })
    if (requirement) readSelfSettlementRequirement(p, requirement.value)
    if (coverage) { if (!requirement || r.value.phase !== 'completed') return unavailable(); readSelfSettlementCoverage(p, coverage.value) }
    if (r.value.phase === 'completed' && requirement && !coverage) return unavailable()
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
    if (r?.value.phase === 'aborted') {
      if (f?.value.operationId === identity.operationId) return unavailable()
      if (identity.operator.kind === 'user' && ['cancel', 'resume'].includes(identity.kind)) await assertAbortedSubscriptionState(tx, identity, r.value)
      return view(r.value)
    }
    if (!r) {
      await assertGlobalLifecycleOperationIdFree(tx, identity.operationId)
      const now = new Date().toISOString(), aborted: LifecycleReceipt = { version: 2, targetHash: lifecycleSubject(identity.targetUserId), operationId: identity.operationId, operator: { kind: identity.operator.kind, id: identity.operator.id }, kind: identity.kind, inputDigest, generation: randomUUID(), token: randomUUID(), revision: 0, phase: 'aborted', reason: null, createdAt: now, updatedAt: now }
      await tx.systemSetting.create({ data: { key: lifecycleReceiptKey(identity), value: JSON.stringify(aborted) } })
      return view(aborted)
    }
    if (!exists || r.value.phase !== 'reserved' || f?.value.operationId !== identity.operationId) throw new LifecycleError('LIFECYCLE_CANNOT_ABORT')
    const l = await ledger(tx, identity, r.value)
    if (l?.value.actions.some(a => a.phase !== 'planned')) return unavailable()
    const required = await tx.systemSetting.findUnique({ where: { key: selfSettlementRequirementKey(identity.operationId) }, select: { value: true } })
    if (required) { const plan = await subscriptionPlan(tx, identity); readSelfSettlementRequirement(plan, required.value) }
    if (await tx.systemSetting.findUnique({ where: { key: selfSettlementCoverageKey(identity.operationId) }, select: { key: true } })) return unavailable()
    const aborted = { ...r.value, phase: 'aborted' as const, token: randomUUID(), generation: randomUUID(), revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) }
    await putReceipt(tx, identity, r.raw, aborted)
    if (l) await putLedger(tx, identity, l.raw, { ...l.value, generation: aborted.generation, revision: nextRevision(l.value.revision) }, aborted)
    if (required && (await tx.systemSetting.deleteMany({ where: { key: selfSettlementRequirementKey(identity.operationId), value: required.value } })).count !== 1) return changed()
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
