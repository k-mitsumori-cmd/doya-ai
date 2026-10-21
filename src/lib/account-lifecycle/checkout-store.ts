import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { LifecycleError, assertLifecycleIdentity, lifecycleIdentity, lifecycleReceiptKey, lifecycleFenceKey, lifecycleLedgerKey, lifecycleActionKey, readLifecycleReceipt, readLifecycleFence, readLifecycleLedger, validLifecycleDigest, validLifecycleUuid, type LifecycleIdentity, type LifecycleClaim, type LifecycleReceipt, type LifecycleLedger, type LifecycleResource } from './state'
import { abortUnstartedLifecycleOperation, assertGlobalLifecycleOperationIdFree, completeLifecycleOperation, resumeLifecycleOperation, type LifecycleDb } from './store'
import { checkoutKeys, checkoutDigest, checkoutPayloadDigest, sealedCheckoutRequest, parseCheckoutPlan, parseCheckoutCapability, parseCheckoutDispatch, parseCheckoutIndex, checkoutUnavailable, exactCheckoutObject, assertCheckoutClaim, type CheckoutRequest, type CheckoutPlan, type CheckoutDispatch, type CheckoutCapability, type CheckoutIndex } from './checkout-receipt'
import { classifyLegacyV1, verifiedLegacySignature, type LegacySignatureParts } from './checkout-legacy'
import { assertVerifiedCheckoutFact, assertVerifiedCustomerReuse, assertVerifiedLegacyCheckout, checkoutDispatchIdempotencyKey, type VerifiedCheckoutFact, type VerifiedCustomerReuse, type VerifiedLegacyCheckout } from './checkout-provider'

type Tx = Prisma.TransactionClient
const options = { isolationLevel: 'ReadCommitted' as const, maxWait: 10000, timeout: 30000 }
const changed = (): never => { throw new LifecycleError('LIFECYCLE_CLAIM_CHANGED') }
const unavailable = (): never => { throw new LifecycleError('LIFECYCLE_STATE_UNAVAILABLE') }
const rawReceiptKey = (userId: string, operationId: string) => `doya-account-operation:v2:${operationId}`
const nextRevision = (n: number) => { if (n >= Number.MAX_SAFE_INTEGER - 1) return unavailable(); return n + 1 }
const updateTime = (r: LifecycleReceipt) => new Date(Math.max(Date.now(), Date.parse(r.updatedAt) + 1)).toISOString()

// Preserve the core's strict receipt/fence/ledger/User authorization; this private checkout binding exports no generic transaction callback.
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

// Checkout-only transitions. They do not replace normal membership semantics or relax normal authorize().
async function checkoutPlan(tx: Tx, identity: LifecycleIdentity) {
  const row = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.plan(identity.operationId) }, select: { value: true } })
  if (!row) return checkoutUnavailable()
  const value = parseCheckoutPlan(row.value)
  if (value.identity.operationId !== identity.operationId || value.identity.kind !== identity.kind || value.identity.targetUserId !== identity.targetUserId || value.identity.operator.kind !== identity.operator.kind || value.identity.operator.id !== identity.operator.id) return checkoutUnavailable()
  return { raw: row.value, value }
}
async function checkoutIndex(tx: Tx, targetHash: string) {
  const rows = await tx.$queryRaw<Array<{ value: string }>>`SELECT value FROM "SystemSetting" WHERE key = ${checkoutKeys.index(targetHash)} FOR UPDATE`
  if (rows.length !== 1) return checkoutUnavailable()
  return { raw: rows[0].value, value: parseCheckoutIndex(rows[0].value, targetHash) }
}
async function putCheckoutValue(tx: Tx, key: string, previous: string, value: unknown) {
  if ((await tx.systemSetting.updateMany({ where: { key, value: previous }, data: { value: JSON.stringify(value) } })).count !== 1) return changed()
}
async function assertCheckoutCutover(tx: Tx, p: CheckoutPlan, mappedLegacy = false) {
  const row = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.cutover(p.mode) }, select: { value: true } })
  const v: unknown = row ? JSON.parse(row.value) : null
  if (!exactCheckoutObject(v, 'version,mode,epoch,coverage,evidenceDigest') || v.version !== 1 || v.mode !== p.mode || v.epoch !== p.cutoverEpoch || v.coverage !== 'old_ingress_stopped_and_workers_reconciled' || !validLifecycleDigest(v.evidenceDigest)) throw new LifecycleError('CHECKOUT_CUTOVER_NOT_VERIFIED')
  const legacy = await tx.systemSetting.findUnique({ where: { key: `checkout-reservation:v1:${p.mode}:${p.identity.targetUserId}` }, select: { value: true } })
  // An adopted v1 row remains intact after the current pointer moves to a new ordinary operation.
  // Its tombstone alone is not authority: the mapping, capability and current index must agree.
  if (legacy && !mappedLegacy) {
    const mapped = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.legacyMapping(p.targetHash, p.mode) }, select: { value: true } })
    if (!mapped) throw new LifecycleError('CHECKOUT_LEGACY_RECONCILIATION_REQUIRED')
    const mapping = parseLegacyMapping(mapped.value)
    const index = await optionalIndex(tx, p.targetHash)
    const capRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(mapping.operationId) }, select: { value: true } })
    if (mapping.targetHash !== p.targetHash || mapping.mode !== p.mode || mapping.source !== p.source || legacy.value !== legacyTombstone(mapping) || !index || index.value.dirty || !index.value.currentOperationId || index.value.currentOperationId === mapping.operationId || !capRow) throw new LifecycleError('CHECKOUT_LEGACY_RECONCILIATION_REQUIRED')
    const cap = parseCheckoutCapability(capRow.value)
    if (cap.operationId !== mapping.operationId || cap.targetHash !== mapping.targetHash || cap.inputDigest !== mapping.inputDigest || cap.mode !== mapping.mode || cap.sessionId !== mapping.sessionId || cap.status !== 'expired' || cap.subscriptionId !== null) return checkoutUnavailable()
    for (const item of index.value.resources.filter(r => r.operationId === mapping.operationId)) {
      const row = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.resource(mapping.mode, item.type, item.id) }, select: { value: true } })
      if (row?.value !== JSON.stringify({ version: 1, targetHash: mapping.targetHash, operationId: mapping.operationId, mode: mapping.mode, type: item.type, id: item.id })) return checkoutUnavailable()
    }
    if (!index.value.resources.some(r => r.type === 'checkout' && r.id === mapping.sessionId && r.operationId === mapping.operationId) ||
        cap.customerId && !index.value.resources.some(r => r.type === 'customer' && r.id === cap.customerId && r.operationId === mapping.operationId)) return checkoutUnavailable()
  }
}
async function checkoutBoundUser(tx: Tx, plan: CheckoutPlan) {
  if (!await userExists(tx, plan.identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
  const user = await tx.user.findUnique({ where: { id: plan.identity.targetUserId }, select: { email: true, name: true, stripeCustomerId: true } })
  if (!user) throw new LifecycleError('CHECKOUT_IDENTITY_CHANGED')
  if (plan.customerMode === 'reuse' && user.stripeCustomerId !== plan.expectedCustomerId) throw new LifecycleError('CHECKOUT_CUSTOMER_REFERENCE_CONFLICT')
  if (plan.organizationId !== null || plan.source === 'hr') {
    if (plan.organizationId === null) throw new LifecycleError('HR_BILLING_OWNER_REQUIRED', 403)
    const org = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM hr_organizations WHERE id = ${plan.organizationId} FOR UPDATE`
    const members = await tx.$queryRaw<Array<{ userId: string; role: string; status: string }>>`SELECT "userId",role,status FROM hr_organization_members WHERE "organizationId" = ${plan.organizationId} ORDER BY id FOR UPDATE`
    const mine = members.filter(m => m.userId === plan.identity.targetUserId)
    if (org.length !== 1 || mine.length !== 1 || mine[0].status !== 'ACTIVE' || mine[0].role !== 'OWNER') throw new LifecycleError('HR_BILLING_OWNER_REQUIRED', 403)
  }
  return user
}
async function checkoutAdmissionUser(tx: Tx, request: CheckoutRequest) {
  const user = await checkoutBoundUser(tx, sealedCheckoutRequest(request))
  if (user.email?.trim().toLowerCase() !== request.terms.email || request.customerMode === 'reuse' && user.stripeCustomerId !== request.customerId) throw new LifecycleError('CHECKOUT_IDENTITY_CHANGED')
  return user
}
/** Classify the current pointer without treating a legacy UUID as an ordinary plan. */
export async function readCheckoutCurrentKind(db: LifecycleDb, request: CheckoutRequest) {
  const plan = sealedCheckoutRequest(request)
  return db.$transaction(async tx => {
    await checkoutAdmissionUser(tx, request)
    await assertCheckoutCutover(tx, plan, true)
    const active = await fence(tx, request.identity.targetUserId)
    const index = await optionalIndex(tx, plan.targetHash)
    if (index?.value.dirty) throw new LifecycleError('CHECKOUT_NEEDS_REVIEW')
    if (active && (!index?.value.currentOperationId || active.value.operationId !== index.value.currentOperationId)) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    const raw = await tx.systemSetting.findUnique({ where: { key: legacyRawKey(plan) }, select: { value: true } })
    const mapped = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.legacyMapping(plan.targetHash, plan.mode) }, select: { value: true } })
    if (mapped) {
      const mapping = parseLegacyMapping(mapped.value)
      const capRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(mapping.operationId) }, select: { value: true } })
      if (!raw || raw.value !== legacyTombstone(mapping) || !index || !capRow || mapping.targetHash !== plan.targetHash || mapping.mode !== plan.mode || mapping.source !== plan.source) return checkoutUnavailable()
      const cap = parseCheckoutCapability(capRow.value)
      if (cap.operationId !== mapping.operationId || cap.targetHash !== mapping.targetHash || cap.inputDigest !== mapping.inputDigest || cap.mode !== mapping.mode || cap.sessionId !== mapping.sessionId) return checkoutUnavailable()
      if (index.value.currentOperationId === mapping.operationId) {
        if (await tx.systemSetting.findUnique({ where: { key: checkoutKeys.plan(mapping.operationId) }, select: { key: true } })) return checkoutUnavailable()
        if (active) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
        return { kind: 'legacy' as const, operationId: mapping.operationId }
      }
      if (cap.status !== 'expired' || cap.subscriptionId !== null) return checkoutUnavailable()
      for (const item of index.value.resources.filter(r => r.operationId === mapping.operationId)) {
        const resource = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.resource(mapping.mode, item.type, item.id) }, select: { value: true } })
        if (resource?.value !== JSON.stringify({ version: 1, targetHash: mapping.targetHash, operationId: mapping.operationId, mode: mapping.mode, type: item.type, id: item.id })) return checkoutUnavailable()
      }
      if (!index.value.resources.some(r => r.type === 'checkout' && r.id === mapping.sessionId && r.operationId === mapping.operationId) ||
          cap.customerId && !index.value.resources.some(r => r.type === 'customer' && r.id === cap.customerId && r.operationId === mapping.operationId)) return checkoutUnavailable()
    } else if (raw) {
      const classified = classifyLegacyV1({ key: legacyRawKey(plan), raw: raw.value, userId: request.identity.targetUserId, targetHash: plan.targetHash, mode: plan.mode })
      if (classified.classification !== 'ready_needs_exact_provider' || index?.value.currentOperationId) throw new LifecycleError('CHECKOUT_LEGACY_RECONCILIATION_REQUIRED')
      return { kind: 'legacy' as const, operationId: null }
    }
    if (!index?.value.currentOperationId) return { kind: 'empty' as const, operationId: null }
    const ordinary = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.plan(index.value.currentOperationId) }, select: { value: true } })
    if (!ordinary) return checkoutUnavailable()
    const oldPlan = parseCheckoutPlan(ordinary.value)
    if (oldPlan.targetHash !== plan.targetHash || oldPlan.mode !== plan.mode || oldPlan.source !== plan.source || oldPlan.identity.operationId !== index.value.currentOperationId) return checkoutUnavailable()
    return { kind: 'ordinary' as const, operationId: index.value.currentOperationId, version: oldPlan.version }
  }, options)
}
/** A saved provider terminal fact is sufficient only when every old ordinary authority joins exactly. */
async function assertStoredExpiredOrdinary(tx: Tx, index: CheckoutIndex, proposed: CheckoutPlan) {
  if (!index.currentOperationId) return checkoutUnavailable()
  const planRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.plan(index.currentOperationId) }, select: { value: true } })
  if (!planRow) return checkoutUnavailable()
  const previous = parseCheckoutPlan(planRow.value)
  if (previous.identity.operationId !== index.currentOperationId || previous.targetHash !== proposed.targetHash || previous.mode !== proposed.mode || previous.source !== proposed.source || previous.cutoverEpoch !== proposed.cutoverEpoch || previous.organizationId !== proposed.organizationId ||
      previous.identity.targetUserId !== proposed.identity.targetUserId || previous.identity.operator.kind !== proposed.identity.operator.kind || previous.identity.operator.id !== proposed.identity.operator.id) return checkoutUnavailable()
  const r = await receipt(tx, previous.identity)
  if (!r || r.value.kind !== 'checkout' || r.value.phase !== 'completed' || r.value.inputDigest !== previous.inputDigest || r.value.targetHash !== previous.targetHash) return checkoutUnavailable()
  const capRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(previous.identity.operationId) }, select: { value: true } })
  if (!capRow) return checkoutUnavailable()
  const cap = parseCheckoutCapability(capRow.value)
  if (cap.operationId !== previous.identity.operationId || cap.targetHash !== previous.targetHash || cap.inputDigest !== previous.inputDigest || cap.mode !== previous.mode || cap.status !== 'expired' || cap.subscriptionId !== null || cap.expiresAt !== previous.expiresAt ||
      previous.customerId !== null && cap.customerId !== previous.customerId) return checkoutUnavailable()
  const l = await ledger(tx, previous.identity, r.value), action = l?.value.actions.find(a => a.type === 'checkout_create')
  if (!action || action.phase !== 'confirmed' || !action.dispatchToken || l?.value.actions.some(a => a.phase !== 'confirmed')) return checkoutUnavailable()
  const dispatchRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.dispatch(action.dispatchToken) }, select: { value: true } })
  if (!dispatchRow) return checkoutUnavailable()
  const dispatch = parseCheckoutDispatch(dispatchRow.value)
  if (JSON.stringify(dispatch.plan) !== planRow.value || dispatch.identity.operationId !== previous.identity.operationId || dispatch.generation !== r.value.generation || dispatch.inputDigest !== previous.inputDigest || dispatch.targetHash !== previous.targetHash || dispatch.mode !== previous.mode || dispatch.actionKey !== action.key || dispatch.dispatchToken !== action.dispatchToken || dispatch.type !== 'checkout_create') return checkoutUnavailable()
  const factRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.fact(action.dispatchToken) }, select: { value: true } })
  if (!factRow) return checkoutUnavailable()
  let fact: unknown
  try { fact = JSON.parse(factRow.value) } catch { return checkoutUnavailable() }
  if (!exactCheckoutObject(fact, 'version,operationId,generation,targetHash,dispatchToken,actionKey,inputDigest,payloadDigest,mode,kind,resourceId,customerId,subscriptionId,status,expiresAt') ||
      fact.version !== 1 || fact.operationId !== previous.identity.operationId || fact.generation !== r.value.generation || fact.targetHash !== previous.targetHash || fact.dispatchToken !== action.dispatchToken || fact.actionKey !== action.key || fact.inputDigest !== previous.inputDigest || fact.payloadDigest !== dispatch.payloadDigest || fact.mode !== previous.mode || fact.kind !== 'checkout' || fact.resourceId !== cap.sessionId || fact.customerId !== cap.customerId || fact.subscriptionId !== null || fact.status !== 'expired' || fact.expiresAt !== cap.expiresAt) return checkoutUnavailable()
  const checkout = index.resources.find(item => item.type === 'checkout' && item.id === cap.sessionId && item.operationId === previous.identity.operationId)
  if (!checkout) return checkoutUnavailable()
  const checkoutResource = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.resource(previous.mode, 'checkout', cap.sessionId) }, select: { value: true } })
  if (checkoutResource?.value !== JSON.stringify({ version: 1, targetHash: previous.targetHash, operationId: previous.identity.operationId, mode: previous.mode, type: 'checkout', id: cap.sessionId })) return checkoutUnavailable()
  if (cap.customerId) {
    const customer = index.resources.find(item => item.type === 'customer' && item.id === cap.customerId)
    if (!customer) return checkoutUnavailable()
    const resource = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.resource(previous.mode, 'customer', cap.customerId) }, select: { value: true } })
    if (resource?.value !== JSON.stringify({ version: 1, targetHash: previous.targetHash, operationId: customer.operationId, mode: previous.mode, type: 'customer', id: cap.customerId })) return checkoutUnavailable()
  }
  return { previous, cap }
}
/** Authentication is performed by the server caller. Only an exactly bound user principal may enter this internal checkout lane. */
export async function admitCheckoutLifecycle(db: LifecycleDb, request: CheckoutRequest) {
  const proposed = sealedCheckoutRequest(request)
  return db.$transaction(async tx => {
    const user = await checkoutAdmissionUser(tx, request)
    await assertCheckoutCutover(tx, proposed)
    await receipt(tx, request.identity) // A globally bound foreign UUID must fail even when another current pointer exists.
    const key = checkoutKeys.index(proposed.targetHash)
    let row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (!row) { const initial: CheckoutIndex = { version: 1, targetHash: proposed.targetHash, revision: 0, currentOperationId: null, dirty: false, notifiedRetirement: null, resources: [] }; row = await tx.systemSetting.create({ data: { key, value: JSON.stringify(initial) }, select: { value: true } }) }
    const index = await checkoutIndex(tx, proposed.targetHash)
    if (index.value.dirty) throw new LifecycleError('CHECKOUT_NEEDS_REVIEW')
    if (index.value.currentOperationId) {
      const old = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.plan(index.value.currentOperationId) }, select: { value: true } })
      if (!old) return checkoutUnavailable()
      const previous = parseCheckoutPlan(old.value)
      const cap = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(previous.identity.operationId) }, select: { value: true } })
      const capability = cap ? parseCheckoutCapability(cap.value) : null
      if (!capability || capability.status !== 'expired') {
        const sameSealedInput = previous.inputDigest === proposed.inputDigest || previous.version === 2 && proposed.version === 2 &&
          sealedCheckoutRequest({ ...request, identity: { ...request.identity, operationId: previous.identity.operationId }, terms: { ...request.terms, expiresAt: previous.expiresAt } }).inputDigest === previous.inputDigest
        if (!sameSealedInput || previous.identity.operator.kind !== proposed.identity.operator.kind || previous.identity.operator.id !== proposed.identity.operator.id) throw new LifecycleError('CHECKOUT_IN_PROGRESS')
        const r = await receipt(tx, previous.identity), f = await fence(tx, request.identity.targetUserId)
        if (!r || (capability ? r.value.phase !== 'completed' || f !== null : f?.value.operationId !== previous.identity.operationId)) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
        return { identity: previous.identity, plan: previous, phase: r.value.phase, claim: null }
      }
      await assertStoredExpiredOrdinary(tx, index.value, proposed)
    }
    if (await fence(tx, request.identity.targetUserId)) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    if (request.customerMode === 'create' && user.stripeCustomerId !== null) throw new LifecycleError('CHECKOUT_IDENTITY_CHANGED')
    if (index.value.resources.length > 125) return checkoutUnavailable()
    const old = await receipt(tx, request.identity)
    if (old) throw new LifecycleError('LIFECYCLE_INPUT_CONFLICT')
    await assertGlobalLifecycleOperationIdFree(tx, request.identity.operationId)
    const now = new Date().toISOString(), r: LifecycleReceipt = { version: 2, targetHash: proposed.targetHash, operationId: request.identity.operationId, operator: request.identity.operator, kind: 'checkout', inputDigest: proposed.inputDigest, generation: randomUUID(), token: randomUUID(), revision: 0, phase: 'reserved', reason: null, createdAt: now, updatedAt: now }
    await tx.systemSetting.create({ data: { key: lifecycleReceiptKey(request.identity), value: JSON.stringify(r) } })
    await tx.systemSetting.create({ data: { key: lifecycleFenceKey(request.identity.targetUserId), value: JSON.stringify({ version: 2, operationId: r.operationId, generation: r.generation, kind: 'checkout', state: 'active' }) } })
    const boundPlan: CheckoutPlan = proposed.version === 2 ? { ...proposed, previousOperationId: index.value.currentOperationId } : proposed
    await tx.systemSetting.create({ data: { key: checkoutKeys.plan(r.operationId), value: JSON.stringify(boundPlan) } })
    await putCheckoutValue(tx, key, index.raw, { ...index.value, currentOperationId: r.operationId, revision: nextRevision(index.value.revision) })
    return { identity: request.identity, plan: boundPlan, phase: r.phase, claim: { ...request.identity, generation: r.generation, token: r.token } as LifecycleClaim }
  }, options)
}
export async function recoverCheckoutLifecycle(db: LifecycleDb, request: CheckoutRequest) {
  const p = sealedCheckoutRequest(request)
  await db.$transaction(async tx => { await checkoutAdmissionUser(tx, request); await assertCheckoutCutover(tx, p); const old = await checkoutPlan(tx, request.identity); if (old.value.inputDigest !== p.inputDigest) throw new LifecycleError('LIFECYCLE_INPUT_CONFLICT') }, options)
  return resumeLifecycleOperation(db, request.identity)
}
export async function prepareCheckoutLifecycle(db: LifecycleDb, claim: LifecycleClaim) {
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['reserved']), p = await checkoutPlan(tx, identity)
    assertCheckoutClaim(claim, p.value)
    const type = p.value.customerMode === 'create' ? 'customer_create' as const : 'checkout_create' as const
    const resource: LifecycleResource = { type, mode: p.value.mode, resourceId: p.value.targetHash, inputDigest: type === 'customer_create' ? p.value.customerDigest : p.value.checkoutDigest! }
    const action = { ...resource, key: lifecycleActionKey(resource), phase: 'planned' as const, dispatchToken: null, outcome: null }
    const previous = await ledger(tx, identity, r.value)
    if (previous) { if (JSON.stringify(previous.value.actions) !== JSON.stringify([action])) throw new LifecycleError('LIFECYCLE_PLAN_CONFLICT'); return }
    await tx.systemSetting.create({ data: { key: lifecycleLedgerKey(identity), value: JSON.stringify({ version: 2, targetHash: p.value.targetHash, operationId: claim.operationId, generation: claim.generation, revision: 0, actions: [action] }) } })
  }, options)
}
export async function dispatchCheckoutLifecycle(db: LifecycleDb, claim: LifecycleClaim, type: 'customer_create' | 'checkout_create', request: CheckoutRequest, reuse?: VerifiedCustomerReuse) {
  const proposed = sealedCheckoutRequest(request)
  assertCheckoutClaim(claim, proposed)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing'])
    const p = await checkoutPlan(tx, identity)
    if (proposed.inputDigest !== p.value.inputDigest || proposed.targetHash !== p.value.targetHash || proposed.source !== p.value.source || proposed.organizationId !== p.value.organizationId) return changed()
    // The User row is already locked by authorize(). Keep User -> organization -> member order
    // while checking the current principal and HR owner in this same dispatch transaction.
    const user = await checkoutAdmissionUser(tx, request)
    const l = await ledger(tx, identity, r.value)
    if (p.value.customerMode === 'create' && user.stripeCustomerId !== p.value.customerId) throw new LifecycleError('CHECKOUT_CUSTOMER_REFERENCE_CONFLICT')
    await assertCheckoutCutover(tx, p.value)
    if ((await checkoutIndex(tx, p.value.targetHash)).value.dirty) throw new LifecycleError('CHECKOUT_NEEDS_REVIEW')
    if (!l || r.value.reason !== null) return changed()
    if (type === 'checkout_create' && p.value.customerMode === 'reuse') {
      assertVerifiedCustomerReuse(reuse)
      const user = await tx.user.findUnique({ where: { id: identity.targetUserId }, select: { stripeCustomerId: true } })
      if (reuse.operationId !== identity.operationId || reuse.targetHash !== p.value.targetHash || reuse.inputDigest !== p.value.inputDigest || reuse.customerId !== p.value.customerId || reuse.mode !== p.value.mode || user?.stripeCustomerId !== reuse.customerId) return changed()
    }
    const action = l.value.actions.find(a => a.type === type)
    if (!action || action.phase !== 'planned' || l.value.actions.some(a => a.phase === 'dispatched') || type === 'checkout_create' && l.value.actions.some(a => a.type === 'customer_create' && a.phase !== 'confirmed')) throw new LifecycleError('CHECKOUT_CUSTOMER_UNCONFIRMED')
    const dispatchToken = randomUUID(); action.phase = 'dispatched'; action.dispatchToken = dispatchToken; l.value.revision = nextRevision(l.value.revision)
    await putLedger(tx, identity, l.raw, l.value, r.value)
    const d: CheckoutDispatch = { version: 1, plan: p.value, identity, targetHash: p.value.targetHash, generation: claim.generation, actionKey: action.key, dispatchToken, inputDigest: p.value.inputDigest, payloadDigest: action.inputDigest, mode: p.value.mode, type, customerId: p.value.customerId, expiresAt: p.value.expiresAt, idempotencyKey: checkoutDispatchIdempotencyKey(claim, action.key, dispatchToken) }
    await tx.systemSetting.create({ data: { key: checkoutKeys.dispatch(d.dispatchToken), value: JSON.stringify(d) } })
    return { dispatch: d, plan: p.value, operationRevision: r.value.revision, ledgerRevision: l.value.revision }
  }, options)
}
async function correlatedDispatch(tx: Tx, fact: VerifiedCheckoutFact) {
  assertVerifiedCheckoutFact(fact)
  const row = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.dispatch(fact.dispatch.dispatchToken) }, select: { value: true } })
  if (!row || row.value !== JSON.stringify(fact.dispatch)) return changed()
  const p = await checkoutPlan(tx, fact.dispatch.identity)
  if (p.value.inputDigest !== fact.dispatch.inputDigest || p.value.targetHash !== fact.dispatch.targetHash) return changed()
  return p
}
async function recordCheckoutTechnicalFact(tx: Tx, fact: VerifiedCheckoutFact) {
  const p = await correlatedDispatch(tx, fact), index = await checkoutIndex(tx, p.value.targetHash)
  const f = await fence(tx, fact.dispatch.identity.targetUserId)
  const data = { version: 1, operationId: p.value.identity.operationId, generation: fact.dispatch.generation, targetHash: p.value.targetHash, dispatchToken: fact.dispatch.dispatchToken, actionKey: fact.dispatch.actionKey, inputDigest: p.value.inputDigest, payloadDigest: fact.dispatch.payloadDigest, mode: fact.dispatch.mode, kind: fact.kind, resourceId: fact.resourceId, customerId: fact.customerId, subscriptionId: fact.subscriptionId, status: fact.status, expiresAt: fact.expiresAt }
  const key = checkoutKeys.fact(fact.dispatch.dispatchToken), old = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  let conflict = false
  if (old) {
    const v = JSON.parse(old.value)
    if (!exactCheckoutObject(v, Object.keys(data).join(',')) || v.version !== 1 || v.operationId !== data.operationId || v.generation !== data.generation || v.targetHash !== data.targetHash || v.dispatchToken !== data.dispatchToken || v.actionKey !== data.actionKey || v.inputDigest !== data.inputDigest || v.payloadDigest !== data.payloadDigest || v.mode !== data.mode || v.kind !== data.kind || v.expiresAt !== data.expiresAt) return checkoutUnavailable()
    conflict = v.resourceId !== data.resourceId || v.customerId !== null && v.customerId !== data.customerId || v.subscriptionId !== null && v.subscriptionId !== data.subscriptionId || ['complete', 'expired'].includes(v.status as string) && data.status !== v.status
    if (old.value === JSON.stringify(data)) return { conflict: false, index: index.value }
    if (conflict) await tx.systemSetting.upsert({ where: { key: key + ':conflict:' + checkoutDigest(data) }, create: { key: key + ':conflict:' + checkoutDigest(data), value: JSON.stringify(data) }, update: {} })
    else await putCheckoutValue(tx, key, old.value, data)
  } else await tx.systemSetting.create({ data: { key, value: JSON.stringify(data) } })
  const resources: { type: 'customer' | 'checkout' | 'subscription'; id: string }[] = []
  if (fact.kind === 'checkout') resources.push({ type: 'checkout', id: fact.resourceId })
  if (fact.customerId) resources.push({ type: 'customer', id: fact.customerId })
  if (fact.subscriptionId) resources.push({ type: 'subscription', id: fact.subscriptionId })
  for (const resource of resources) {
    const resourceKey = checkoutKeys.resource(p.value.mode, resource.type, resource.id), existing = await tx.systemSetting.findUnique({ where: { key: resourceKey }, select: { value: true } })
    if (existing) { const v = JSON.parse(existing.value); if (!exactCheckoutObject(v, 'version,targetHash,operationId,mode,type,id') || v.version !== 1 || !validLifecycleUuid(v.operationId) || v.targetHash !== p.value.targetHash || v.mode !== p.value.mode || v.type !== resource.type || v.id !== resource.id) return checkoutUnavailable() }
    else await tx.systemSetting.create({ data: { key: resourceKey, value: JSON.stringify({ version: 1, targetHash: p.value.targetHash, operationId: p.value.identity.operationId, mode: p.value.mode, ...resource }) } })
    if (!index.value.resources.some(r => r.type === resource.type && r.id === resource.id)) index.value.resources.push({ ...resource, operationId: p.value.identity.operationId })
  }
  const next: CheckoutIndex = { ...index.value, revision: nextRevision(index.value.revision), dirty: index.value.dirty || conflict || f?.value.kind === 'retirement', notifiedRetirement: f?.value.kind === 'retirement' ? f.value.operationId : index.value.notifiedRetirement }
  parseCheckoutIndex(JSON.stringify(next), p.value.targetHash)
  await putCheckoutValue(tx, checkoutKeys.index(p.value.targetHash), index.raw, next)
  // Later terminal observations may close an already recorded capability, but never create a capability or restore a URL.
  if (!conflict && fact.kind === 'checkout' && ['complete', 'expired'].includes(fact.status)) {
    const capRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(p.value.identity.operationId) }, select: { value: true } })
    if (capRow) {
      const cap = parseCheckoutCapability(capRow.value)
      if (cap.sessionId !== fact.resourceId || cap.targetHash !== p.value.targetHash || cap.inputDigest !== p.value.inputDigest || cap.mode !== p.value.mode) return checkoutUnavailable()
      await putCheckoutValue(tx, checkoutKeys.capability(p.value.identity.operationId), capRow.value, { ...cap, status: fact.status, customerId: fact.customerId, subscriptionId: fact.subscriptionId, url: null, revision: nextRevision(cap.revision) })
    }
  }
  return { conflict, index: next }
}
/** Internal verified-provider-fact ingestion only. It never calls normal authorize(), changes User/entitlements, releases a lane or returns a URL. */
export async function ingestCorrelatedCheckoutLateFact(db: LifecycleDb, fact: VerifiedCheckoutFact) {
  assertVerifiedCheckoutFact(fact)
  return db.$transaction(async tx => {
    await userExists(tx, fact.dispatch.identity.targetUserId) // Existing User locks first; absence does not manufacture one.
    const result = await recordCheckoutTechnicalFact(tx, fact)
    return { recorded: true, needsReview: result.conflict, indexRevision: result.index.revision, urlAuthorized: false }
  }, options)
}
export async function recordCustomerAckAndPlanCheckout(db: LifecycleDb, claim: LifecycleClaim, fact: VerifiedCheckoutFact, expected: { operationRevision: number; ledgerRevision: number }) {
  assertVerifiedCheckoutFact(fact)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing']), p = await correlatedDispatch(tx, fact), l = await ledger(tx, identity, r.value)
    if (!l || fact.kind !== 'customer' || fact.dispatch.identity.operationId !== claim.operationId || fact.dispatch.generation !== claim.generation || p.value.customerMode !== 'create') return changed()
    const a = l.value.actions.find(x => x.key === fact.dispatch.actionKey)
    if (!a || a.dispatchToken !== fact.dispatch.dispatchToken) return changed()
    const digest = checkoutPayloadDigest(p.value, fact.resourceId)
    if (a.phase === 'confirmed') { if (a.outcome?.resourceId !== fact.resourceId || p.value.customerId !== fact.resourceId || p.value.checkoutDigest !== digest) return changed(); return { plan: p.value, ledgerRevision: l.value.revision } }
    if (r.value.revision !== expected.operationRevision || l.value.revision !== expected.ledgerRevision || a.phase !== 'dispatched' || r.value.reason !== null && r.value.reason !== 'EXTERNAL_UNKNOWN') return changed()
    const user = await tx.user.findUnique({ where: { id: identity.targetUserId }, select: { stripeCustomerId: true } })
    if (!user || user.stripeCustomerId !== p.value.expectedCustomerId && user.stripeCustomerId !== fact.resourceId) throw new LifecycleError('CHECKOUT_CUSTOMER_REFERENCE_CONFLICT')
    const tracked = await recordCheckoutTechnicalFact(tx, fact); if (tracked.conflict || tracked.index.dirty) return changed()
    if ((await tx.user.updateMany({ where: { id: identity.targetUserId, stripeCustomerId: p.value.expectedCustomerId }, data: { stripeCustomerId: fact.resourceId } })).count !== 1 && user.stripeCustomerId !== fact.resourceId) return changed()
    a.phase = 'confirmed'; a.outcome = { proof: 'ack', resourceId: fact.resourceId, status: 'created' }
    const resource: LifecycleResource = { type: 'checkout_create', mode: p.value.mode, resourceId: p.value.targetHash, inputDigest: digest }
    l.value.actions.push({ ...resource, key: lifecycleActionKey(resource), phase: 'planned', dispatchToken: null, outcome: null }); l.value.revision = nextRevision(l.value.revision)
    const next: CheckoutPlan = { ...p.value, customerId: fact.resourceId, checkoutDigest: digest }; parseCheckoutPlan(JSON.stringify(next))
    await putCheckoutValue(tx, checkoutKeys.plan(claim.operationId), p.raw, next)
    await putLedger(tx, identity, l.raw, l.value, r.value)
    if (r.value.reason !== null) await putReceipt(tx, identity, r.raw, { ...r.value, reason: null, revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) })
    return { plan: next, ledgerRevision: l.value.revision }
  }, options)
}
export async function recordCheckoutAckAndReady(db: LifecycleDb, claim: LifecycleClaim, fact: VerifiedCheckoutFact) {
  assertVerifiedCheckoutFact(fact)
  return db.$transaction(async tx => {
    const { identity, r } = await authorize(tx, claim, ['executing']), p = await correlatedDispatch(tx, fact), l = await ledger(tx, identity, r.value)
    if (!l || fact.kind !== 'checkout' || fact.dispatch.identity.operationId !== identity.operationId || fact.dispatch.generation !== claim.generation || fact.dispatch.payloadDigest !== p.value.checkoutDigest) return changed()
    const a = l.value.actions.find(x => x.key === fact.dispatch.actionKey)
    if (!a || a.phase !== 'dispatched' || a.dispatchToken !== fact.dispatch.dispatchToken || l.value.actions.some(x => x.key !== a.key && x.phase !== 'confirmed')) return changed()
    const tracked = await recordCheckoutTechnicalFact(tx, fact); if (tracked.conflict || tracked.index.dirty) return changed()
    a.phase = 'confirmed'; a.outcome = { proof: 'ack', resourceId: fact.resourceId, status: 'created' }; l.value.revision = nextRevision(l.value.revision)
    await putLedger(tx, identity, l.raw, l.value, r.value)
    if (r.value.reason !== null) await putReceipt(tx, identity, r.raw, { ...r.value, reason: null, revision: nextRevision(r.value.revision), updatedAt: updateTime(r.value) })
    const cap: CheckoutCapability = { version: 1, operationId: identity.operationId, targetHash: p.value.targetHash, inputDigest: p.value.inputDigest, mode: p.value.mode, sessionId: fact.resourceId, customerId: fact.customerId, subscriptionId: fact.subscriptionId, status: fact.status as 'open' | 'complete' | 'expired', url: fact.url, expiresAt: fact.expiresAt, revision: 0 }
    parseCheckoutCapability(JSON.stringify(cap))
    await tx.systemSetting.create({ data: { key: checkoutKeys.capability(identity.operationId), value: JSON.stringify(cap) } })
    await completeLifecycleOperation(tx, claim, async () => undefined)
    return { operationId: claim.operationId, phase: 'completed' as const, capabilityRecorded: true }
  }, options)
}
export async function captureCheckoutReadyRead(db: LifecycleDb, request: CheckoutRequest | LifecycleIdentity) {
  const full = 'terms' in request
  const proposed = 'terms' in request ? sealedCheckoutRequest(request) : null
  const identity = 'identity' in request ? request.identity : request
  assertLifecycleIdentity(identity)
  return db.$transaction(async tx => {
    const p = await checkoutPlan(tx, identity)
    if (!full && p.value.version !== 2) return checkoutUnavailable()
    const user = 'terms' in request ? await checkoutAdmissionUser(tx, request) : await checkoutBoundUser(tx, p.value)
    await assertCheckoutCutover(tx, p.value)
    if (await fence(tx, identity.targetUserId)) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    const r = await receipt(tx, identity), index = await checkoutIndex(tx, p.value.targetHash)
    if (p.value.customerMode === 'create' && user.stripeCustomerId !== p.value.customerId) throw new LifecycleError('CHECKOUT_CUSTOMER_REFERENCE_CONFLICT')
    if (!r || r.value.phase !== 'completed' || proposed && p.value.inputDigest !== proposed.inputDigest || index.value.dirty || index.value.currentOperationId !== identity.operationId) return changed()
    const row = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(identity.operationId) }, select: { value: true } })
    const l = await ledger(tx, identity, r.value), action = l?.value.actions.find(a => a.type === 'checkout_create')
    if (!row || !action?.dispatchToken || action.phase !== 'confirmed' || r.value.inputDigest !== p.value.inputDigest || r.value.targetHash !== p.value.targetHash) return checkoutUnavailable()
    const dispatchRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.dispatch(action.dispatchToken) }, select: { value: true } })
    if (!dispatchRow) return checkoutUnavailable()
    const capability = parseCheckoutCapability(row.value), dispatch = parseCheckoutDispatch(dispatchRow.value)
    if (capability.operationId !== identity.operationId || capability.targetHash !== p.value.targetHash || capability.inputDigest !== p.value.inputDigest || capability.mode !== p.value.mode ||
        dispatch.identity.operationId !== identity.operationId || dispatch.generation !== r.value.generation || dispatch.inputDigest !== p.value.inputDigest || dispatch.targetHash !== p.value.targetHash || dispatch.mode !== p.value.mode ||
        dispatch.dispatchToken !== action.dispatchToken || dispatch.actionKey !== action.key || dispatch.type !== 'checkout_create' || JSON.stringify(dispatch.plan) !== p.raw) return checkoutUnavailable()
    return { plan: p.value, capability, dispatch, indexRevision: index.value.revision, capabilityRaw: row.value }
  }, options)
}
export async function authorizeCheckoutReadyRead(db: LifecycleDb, request: CheckoutRequest | LifecycleIdentity, ticket: Awaited<ReturnType<typeof captureCheckoutReadyRead>>, fact: VerifiedCheckoutFact) {
  assertVerifiedCheckoutFact(fact)
  const full = 'terms' in request
  const identity = 'identity' in request ? request.identity : request
  assertLifecycleIdentity(identity)
  return db.$transaction(async tx => {
    const p = await correlatedDispatch(tx, fact)
    if (!full && p.value.version !== 2) return checkoutUnavailable()
    const user = 'terms' in request ? await checkoutAdmissionUser(tx, request) : await checkoutBoundUser(tx, p.value)
    await assertCheckoutCutover(tx, p.value)
    if (await fence(tx, identity.targetUserId)) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    const index = await checkoutIndex(tx, p.value.targetHash), row = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(identity.operationId) }, select: { value: true } }), r = await receipt(tx, identity)
    const l = r ? await ledger(tx, identity, r.value) : null
    if (p.value.customerMode === 'create' && user.stripeCustomerId !== p.value.customerId) throw new LifecycleError('CHECKOUT_CUSTOMER_REFERENCE_CONFLICT')
    if (identity.operationId !== p.value.identity.operationId || 'terms' in request && sealedCheckoutRequest(request).inputDigest !== p.value.inputDigest || !r || r.value.phase !== 'completed' || r.value.inputDigest !== p.value.inputDigest || r.value.generation !== fact.dispatch.generation ||
        !l?.value.actions.some(a => a.type === 'checkout_create' && a.phase === 'confirmed' && a.dispatchToken === fact.dispatch.dispatchToken) || !row || row.value !== ticket.capabilityRaw || index.value.revision !== ticket.indexRevision || index.value.dirty || index.value.currentOperationId !== identity.operationId || fact.resourceId !== ticket.capability.sessionId || fact.kind !== 'checkout') return changed()
    if (fact.status !== 'open' || fact.expiresAt * 1000 <= Date.now() || !fact.url) throw new LifecycleError(fact.status === 'complete' ? 'CHECKOUT_ALREADY_COMPLETED' : 'CHECKOUT_IN_PROGRESS')
    return { id: fact.resourceId, url: fact.url }
  }, options)
}

/** Server-only recovery context. The coordinator's public status view deliberately omits these authority/dispatch fields. */
export async function readCheckoutRecovery(db: LifecycleDb, request: CheckoutRequest) {
  const proposed = sealedCheckoutRequest(request)
  return db.$transaction(async tx => {
    await checkoutAdmissionUser(tx, request)
    const p = await checkoutPlan(tx, request.identity), r = await receipt(tx, request.identity)
    if (!r || p.value.inputDigest !== proposed.inputDigest) return changed()
    const l = await ledger(tx, request.identity, r.value)
    const action = l?.value.actions.find(a => a.phase === 'dispatched')
    const row = action?.dispatchToken ? await tx.systemSetting.findUnique({ where: { key: checkoutKeys.dispatch(action.dispatchToken) }, select: { value: true } }) : null
    const dispatch = row ? parseCheckoutDispatch(row.value) : null
    const index = await checkoutIndex(tx, p.value.targetHash)
    return { plan: p.value, phase: r.value.phase, reason: r.value.reason ?? (index.value.dirty ? 'NEEDS_REVIEW' as const : null), operationRevision: r.value.revision, ledgerRevision: l?.value.revision ?? null, claim: { ...request.identity, generation: r.value.generation, token: r.value.token } as LifecycleClaim, dispatch }
  }, options)
}
/** Read a newly bound operation without recreating its email/name input digest. */
export async function readCheckoutBoundOperation(db: LifecycleDb, identity: LifecycleIdentity, allowHistoricalTerminal = false) {
  assertLifecycleIdentity(identity)
  if (identity.kind !== 'checkout' || identity.operator.kind !== 'user' || identity.operator.id !== identity.targetUserId) throw new LifecycleError('INVALID_LIFECYCLE_IDENTITY', 400)
  return db.$transaction(async tx => {
    if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    const r = await receipt(tx, identity)
    if (!r) {
      await assertGlobalLifecycleOperationIdFree(tx, identity.operationId)
      return { phase: 'missing' as const, plan: null, reason: null, dispatched: false, email: null, name: null }
    }
    if (r.value.phase === 'aborted') {
      const row = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.plan(identity.operationId) }, select: { value: true } })
      const plan = row ? parseCheckoutPlan(row.value) : null
      if (plan && (plan.version !== 2 || plan.identity.targetUserId !== identity.targetUserId || plan.inputDigest !== r.value.inputDigest)) return checkoutUnavailable()
      return { phase: 'aborted' as const, plan, reason: null, dispatched: false, email: null, name: null }
    }
    const p = await checkoutPlan(tx, identity)
    if (p.value.version !== 2 || r.value.inputDigest !== p.value.inputDigest) return checkoutUnavailable()
    const user = await checkoutBoundUser(tx, p.value)
    await assertCheckoutCutover(tx, p.value)
    const index = await checkoutIndex(tx, p.value.targetHash), f = await fence(tx, identity.targetUserId)
    if (index.value.dirty || ['reserved', 'executing'].includes(r.value.phase) && (index.value.currentOperationId !== identity.operationId || f?.value.operationId !== identity.operationId)) return checkoutUnavailable()
    if (r.value.phase === 'completed' && index.value.currentOperationId !== identity.operationId) {
      if (!allowHistoricalTerminal || !index.value.currentOperationId) return checkoutUnavailable()
      const currentRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.plan(index.value.currentOperationId) }, select: { value: true } })
      if (!currentRow) return checkoutUnavailable()
      const current = parseCheckoutPlan(currentRow.value)
      if (current.version !== 2 || current.previousOperationId !== identity.operationId || current.targetHash !== p.value.targetHash || current.mode !== p.value.mode || current.source !== p.value.source || current.organizationId !== p.value.organizationId || f && f.value.operationId !== current.identity.operationId) return checkoutUnavailable()
      await assertStoredExpiredOrdinary(tx, { ...index.value, currentOperationId: identity.operationId }, current)
    } else if (r.value.phase === 'completed' && f !== null) return checkoutUnavailable()
    if (p.value.customerMode === 'create' && user.stripeCustomerId !== p.value.customerId) throw new LifecycleError('CHECKOUT_CUSTOMER_REFERENCE_CONFLICT')
    const l = await ledger(tx, identity, r.value)
    return { phase: r.value.phase, plan: p.value, reason: r.value.reason, dispatched: Boolean(l?.value.actions.some(a => a.phase === 'dispatched')), email: user.email?.trim().toLowerCase() ?? null, name: user.name ?? '' }
  }, options)
}
/** Abort keeps the tombstone and restores the exact prior terminal pointer. */
export async function abortCheckoutBoundOperation(db: LifecycleDb, identity: LifecycleIdentity) {
  const observed = await readCheckoutBoundOperation(db, identity)
  if (!['missing', 'reserved', 'aborted'].includes(observed.phase)) throw new LifecycleError('LIFECYCLE_CANNOT_ABORT')
  const digest = observed.plan?.inputDigest ?? checkoutDigest(['checkout-abort-before-admission', identity.targetUserId, identity.operationId])
  await abortUnstartedLifecycleOperation(db, identity, digest)
  if (!observed.plan) return { operationId: identity.operationId, phase: 'aborted' as const }
  await db.$transaction(async tx => {
    if (!await userExists(tx, identity.targetUserId)) throw new LifecycleError('LIFECYCLE_USER_UNAVAILABLE')
    const p = await checkoutPlan(tx, identity), r = await receipt(tx, identity), f = await fence(tx, identity.targetUserId)
    if (p.value.version !== 2 || !r || r.value.phase !== 'aborted' || r.value.inputDigest !== p.value.inputDigest || f !== null) return checkoutUnavailable()
    const index = await checkoutIndex(tx, p.value.targetHash)
    if (index.value.dirty || index.value.currentOperationId !== identity.operationId || index.value.resources.some(item => item.operationId === identity.operationId)) return checkoutUnavailable()
    const l = await ledger(tx, identity, r.value)
    if (l?.value.actions.some(action => action.phase !== 'planned')) return checkoutUnavailable()
    const prior = p.value.previousOperationId ?? null
    if (prior) {
      const ordinary = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.plan(prior) }, select: { value: true } })
      if (ordinary) {
        await assertStoredExpiredOrdinary(tx, { ...index.value, currentOperationId: prior }, p.value)
      } else {
        const mapped = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.legacyMapping(p.value.targetHash, p.value.mode) }, select: { value: true } })
        if (!mapped) return checkoutUnavailable()
        const mapping = parseLegacyMapping(mapped.value)
        const raw = await tx.systemSetting.findUnique({ where: { key: legacyRawKey(p.value) }, select: { value: true } })
        const capRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(prior) }, select: { value: true } })
        if (!capRow || !raw || mapping.operationId !== prior || mapping.targetHash !== p.value.targetHash || mapping.mode !== p.value.mode || mapping.source !== p.value.source || raw.value !== legacyTombstone(mapping)) return checkoutUnavailable()
        const cap = parseCheckoutCapability(capRow.value)
        if (cap.operationId !== prior || cap.targetHash !== p.value.targetHash || cap.inputDigest !== mapping.inputDigest || cap.mode !== p.value.mode || cap.status !== 'expired' || cap.subscriptionId !== null || cap.sessionId !== mapping.sessionId) return checkoutUnavailable()
        for (const item of index.value.resources.filter(item => item.operationId === prior)) {
          const resource = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.resource(p.value.mode, item.type, item.id) }, select: { value: true } })
          if (resource?.value !== JSON.stringify({ version: 1, targetHash: p.value.targetHash, operationId: prior, mode: p.value.mode, type: item.type, id: item.id })) return checkoutUnavailable()
        }
        if (!index.value.resources.some(item => item.type === 'checkout' && item.id === mapping.sessionId && item.operationId === prior)) return checkoutUnavailable()
      }
    } else if (index.value.resources.length !== 0) return checkoutUnavailable()
    await putCheckoutValue(tx, checkoutKeys.index(p.value.targetHash), index.raw, { ...index.value, currentOperationId: prior, revision: nextRevision(index.value.revision) })
  }, options)
  return { operationId: identity.operationId, phase: 'aborted' as const }
}
export async function recordLegacyCheckoutClassification(db: LifecycleDb, request: CheckoutRequest) {
  const p = sealedCheckoutRequest(request)
  return db.$transaction(async tx => {
    await checkoutAdmissionUser(tx, request)
    const key = `checkout-reservation:v1:${p.mode}:${request.identity.targetUserId}`, row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const value = { ...classifyLegacyV1({ key, raw: row?.value ?? null, userId: request.identity.targetUserId, targetHash: p.targetHash, mode: p.mode }), cutoverEpoch: p.cutoverEpoch, proposedOperationId: request.identity.operationId }
    const marker = checkoutKeys.legacy(checkoutDigest([p.targetHash, value.rawHash, p.cutoverEpoch])), old = await tx.systemSetting.findUnique({ where: { key: marker }, select: { value: true } })
    if (old) { if (old.value !== JSON.stringify(value)) throw new LifecycleError('CHECKOUT_LEGACY_MAPPING_CONFLICT'); return value }
    await tx.systemSetting.create({ data: { key: marker, value: JSON.stringify(value) } })
    return value
  }, options)
}

type LegacyMapping = { version: 1; operationId: string; targetHash: string; inputDigest: string; mode: 'test' | 'live'; source: 'generic' | 'hr'; signature: string; rawHash: string; sessionId: string }
function parseLegacyMapping(raw: string): LegacyMapping {
  const value: unknown = JSON.parse(raw)
  if (!exactCheckoutObject(value, 'version,operationId,targetHash,inputDigest,mode,source,signature,rawHash,sessionId') || value.version !== 1 || !validLifecycleUuid(value.operationId) || !validLifecycleDigest(value.targetHash) || !validLifecycleDigest(value.inputDigest) || !['test', 'live'].includes(value.mode as string) || !['generic', 'hr'].includes(value.source as string) || !validLifecycleDigest(value.signature) || !validLifecycleDigest(value.rawHash) || typeof value.sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{1,200}$/.test(value.sessionId)) return checkoutUnavailable()
  return value as LegacyMapping
}
const legacyRawKey = (p: CheckoutPlan) => `checkout-reservation:v1:${p.mode}:${p.identity.targetUserId}`
const legacyTombstone = (mapping: LegacyMapping) => JSON.stringify({ phase: 'migrated', version: 2, rawHash: mapping.rawHash, operationId: mapping.operationId })
async function optionalIndex(tx: Tx, targetHash: string) {
  const rows = await tx.$queryRaw<Array<{ value: string }>>`SELECT value FROM "SystemSetting" WHERE key = ${checkoutKeys.index(targetHash)} FOR UPDATE`
  if (rows.length > 1) return checkoutUnavailable()
  return rows.length ? { raw: rows[0].value, value: parseCheckoutIndex(rows[0].value, targetHash) } : null
}
async function putLegacyResources(tx: Tx, mapping: LegacyMapping, index: CheckoutIndex, fact: VerifiedLegacyCheckout) {
  const resources: { type: 'customer' | 'checkout' | 'subscription'; id: string }[] = [{ type: 'checkout', id: fact.sessionId }]
  if (fact.customerId) resources.push({ type: 'customer', id: fact.customerId })
  if (fact.subscriptionId) resources.push({ type: 'subscription', id: fact.subscriptionId })
  for (const resource of resources) {
    const key = checkoutKeys.resource(mapping.mode, resource.type, resource.id), old = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const value = { version: 1, targetHash: mapping.targetHash, operationId: mapping.operationId, mode: mapping.mode, ...resource }
    if (old) { if (old.value !== JSON.stringify(value)) return checkoutUnavailable() }
    else await tx.systemSetting.create({ data: { key, value: JSON.stringify(value) } })
    if (!index.resources.some(r => r.type === resource.type && r.id === resource.id)) index.resources.push({ ...resource, operationId: mapping.operationId })
  }
  parseCheckoutIndex(JSON.stringify(index), mapping.targetHash)
}
type LegacyTicket = { kind: 'ready' | 'mapped'; plan: CheckoutPlan; signature: string; rawHash: string; sessionId: string; raw: string; indexRaw: string | null; indexRevision: number | null; mappingRaw: string | null; capabilityRaw: string | null }
/** Capture under short locks, then leave the provider retrieve outside any DB transaction. */
export async function captureLegacyCheckoutReady(db: LifecycleDb, request: CheckoutRequest, parts: LegacySignatureParts): Promise<LegacyTicket> {
  const plan = sealedCheckoutRequest(request), signature = verifiedLegacySignature(request, parts)
  return db.$transaction(async tx => {
    await checkoutAdmissionUser(tx, request)
    await assertCheckoutCutover(tx, plan, true)
    if (await fence(tx, request.identity.targetUserId)) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    const rawRow = await tx.systemSetting.findUnique({ where: { key: legacyRawKey(plan) }, select: { value: true } })
    if (!rawRow) throw new LifecycleError('CHECKOUT_LEGACY_RECONCILIATION_REQUIRED')
    const index = await optionalIndex(tx, plan.targetHash), mapRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.legacyMapping(plan.targetHash, plan.mode) }, select: { value: true } })
    if (index?.value.dirty) throw new LifecycleError('CHECKOUT_NEEDS_REVIEW')
    if (mapRow) {
      const mapping = parseLegacyMapping(mapRow.value), capRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(mapping.operationId) }, select: { value: true } })
      if (await tx.systemSetting.findUnique({ where: { key: checkoutKeys.plan(mapping.operationId) }, select: { key: true } })) return checkoutUnavailable()
      if (mapping.targetHash !== plan.targetHash || mapping.mode !== plan.mode || mapping.source !== plan.source || mapping.inputDigest !== plan.inputDigest || mapping.signature !== signature || rawRow.value !== legacyTombstone(mapping) || !index || index.value.currentOperationId !== mapping.operationId || !capRow) throw new LifecycleError('CHECKOUT_LEGACY_MAPPING_CONFLICT')
      const cap = parseCheckoutCapability(capRow.value)
      if (cap.operationId !== mapping.operationId || cap.sessionId !== mapping.sessionId || cap.targetHash !== plan.targetHash || cap.inputDigest !== plan.inputDigest || cap.mode !== mapping.mode) return checkoutUnavailable()
      return { kind: 'mapped' as const, plan, signature, rawHash: mapping.rawHash, sessionId: mapping.sessionId, raw: rawRow.value, indexRaw: index.raw, indexRevision: index.value.revision, mappingRaw: mapRow.value, capabilityRaw: capRow.value }
    }
    const classified = classifyLegacyV1({ key: legacyRawKey(plan), raw: rawRow.value, userId: request.identity.targetUserId, targetHash: plan.targetHash, mode: plan.mode })
    if (classified.classification !== 'ready_needs_exact_provider' || !classified.sessionId) throw new LifecycleError('CHECKOUT_LEGACY_RECONCILIATION_REQUIRED')
    const ready = JSON.parse(rawRow.value) as { signature: string; expiresAt: number }
    if (ready.signature !== signature || ready.expiresAt !== plan.expiresAt || index?.value.currentOperationId) throw new LifecycleError('CHECKOUT_LEGACY_MAPPING_CONFLICT')
    return { kind: 'ready' as const, plan, signature, rawHash: classified.rawHash!, sessionId: classified.sessionId, raw: rawRow.value, indexRaw: index?.raw ?? null, indexRevision: index?.value.revision ?? null, mappingRaw: null, capabilityRaw: null }
  }, options)
}

/** Adopt a verified v1 session without claiming that the old ingress has operationally drained. */
export async function adoptLegacyCheckoutReady(db: LifecycleDb, request: CheckoutRequest, ticket: LegacyTicket, fact: VerifiedLegacyCheckout, parts: LegacySignatureParts) {
  assertVerifiedLegacyCheckout(fact)
  if (ticket.kind !== 'ready') return changed()
  const plan = sealedCheckoutRequest(request)
  if (verifiedLegacySignature(request, parts) !== ticket.signature || fact.targetHash !== plan.targetHash || fact.inputDigest !== plan.inputDigest || fact.mode !== plan.mode || fact.source !== plan.source || fact.sessionId !== ticket.sessionId || fact.rawHash !== ticket.rawHash || fact.signature !== ticket.signature || plan.inputDigest !== ticket.plan.inputDigest || plan.expiresAt !== fact.expiresAt) return changed()
  const ready = JSON.parse(ticket.raw) as { url: string }
  if (fact.status === 'open' && ready.url !== fact.url) throw new LifecycleError('CHECKOUT_LEGACY_MAPPING_CONFLICT')
  return db.$transaction(async tx => {
    await checkoutAdmissionUser(tx, request)
    await assertCheckoutCutover(tx, plan, true)
    if (await fence(tx, request.identity.targetUserId)) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    const rawRow = await tx.systemSetting.findUnique({ where: { key: legacyRawKey(plan) }, select: { value: true } }), index = await optionalIndex(tx, plan.targetHash)
    if (rawRow?.value !== ticket.raw || (index?.raw ?? null) !== ticket.indexRaw || (index?.value.revision ?? null) !== ticket.indexRevision || index?.value.dirty || index?.value.currentOperationId) return changed()
    const mapKey = checkoutKeys.legacyMapping(plan.targetHash, plan.mode)
    if (await tx.systemSetting.findUnique({ where: { key: mapKey }, select: { value: true } })) return changed()
    await assertGlobalLifecycleOperationIdFree(tx, request.identity.operationId)
    const mapping: LegacyMapping = { version: 1, operationId: request.identity.operationId, targetHash: plan.targetHash, inputDigest: plan.inputDigest, mode: plan.mode, source: plan.source, signature: ticket.signature, rawHash: ticket.rawHash, sessionId: ticket.sessionId }
    if ((await tx.systemSetting.updateMany({ where: { key: legacyRawKey(plan), value: ticket.raw }, data: { value: legacyTombstone(mapping) } })).count !== 1) return changed()
    const cap: CheckoutCapability = { version: 1, operationId: mapping.operationId, targetHash: mapping.targetHash, inputDigest: mapping.inputDigest, mode: mapping.mode, sessionId: fact.sessionId, customerId: fact.customerId, subscriptionId: fact.subscriptionId, status: fact.status, url: fact.url, expiresAt: fact.expiresAt, revision: 0 }
    parseCheckoutCapability(JSON.stringify(cap))
    const next: CheckoutIndex = index ? { ...index.value, revision: nextRevision(index.value.revision), currentOperationId: mapping.operationId, resources: [...index.value.resources] } : { version: 1, targetHash: plan.targetHash, revision: 1, currentOperationId: mapping.operationId, dirty: false, notifiedRetirement: null, resources: [] }
    await putLegacyResources(tx, mapping, next, fact)
    await tx.systemSetting.create({ data: { key: mapKey, value: JSON.stringify(mapping) } })
    await tx.systemSetting.create({ data: { key: checkoutKeys.capability(mapping.operationId), value: JSON.stringify(cap) } })
    if (index) await putCheckoutValue(tx, checkoutKeys.index(plan.targetHash), index.raw, next)
    else await tx.systemSetting.create({ data: { key: checkoutKeys.index(plan.targetHash), value: JSON.stringify(next) } })
    return { status: fact.status, sessionId: fact.sessionId, url: fact.url }
  }, options)
}

/** Final authorization after a mapped provider read; a changed fence, index or capability rejects the URL. */
export async function authorizeLegacyCheckoutReady(db: LifecycleDb, request: CheckoutRequest, ticket: LegacyTicket, fact: VerifiedLegacyCheckout) {
  assertVerifiedLegacyCheckout(fact)
  if (ticket.kind !== 'mapped' || !ticket.mappingRaw || !ticket.capabilityRaw || ticket.indexRaw === null) return changed()
  const plan = sealedCheckoutRequest(request), mapping = parseLegacyMapping(ticket.mappingRaw)
  if (plan.inputDigest !== mapping.inputDigest || plan.targetHash !== mapping.targetHash || plan.mode !== mapping.mode || plan.source !== mapping.source || fact.targetHash !== plan.targetHash || fact.mode !== plan.mode || fact.source !== plan.source || fact.inputDigest !== plan.inputDigest || fact.sessionId !== mapping.sessionId || fact.rawHash !== mapping.rawHash || fact.signature !== mapping.signature || fact.expiresAt !== plan.expiresAt) return changed()
  return db.$transaction(async tx => {
    await checkoutAdmissionUser(tx, request)
    await assertCheckoutCutover(tx, plan, true)
    if (await fence(tx, request.identity.targetUserId)) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    const rawRow = await tx.systemSetting.findUnique({ where: { key: legacyRawKey(plan) }, select: { value: true } }), mapRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.legacyMapping(plan.targetHash, plan.mode) }, select: { value: true } }), capRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(mapping.operationId) }, select: { value: true } }), index = await optionalIndex(tx, plan.targetHash)
    if (rawRow?.value !== ticket.raw || mapRow?.value !== ticket.mappingRaw || capRow?.value !== ticket.capabilityRaw || index?.raw !== ticket.indexRaw || index?.value.revision !== ticket.indexRevision || index.value.dirty || index.value.currentOperationId !== mapping.operationId) return changed()
    const cap = parseCheckoutCapability(capRow.value)
    if (cap.operationId !== mapping.operationId || cap.targetHash !== mapping.targetHash || cap.inputDigest !== mapping.inputDigest || cap.mode !== mapping.mode || cap.sessionId !== mapping.sessionId) return checkoutUnavailable()
    if (cap.customerId !== null && cap.customerId !== fact.customerId || cap.subscriptionId !== null && cap.subscriptionId !== fact.subscriptionId) throw new LifecycleError('CHECKOUT_LEGACY_MAPPING_CONFLICT')
    if (cap.status === 'open' && fact.status !== 'open') {
      if (fact.status === 'complete' && (!fact.customerId || !fact.subscriptionId)) return checkoutUnavailable()
      const nextCap: CheckoutCapability = { ...cap, status: fact.status, customerId: fact.customerId, subscriptionId: fact.subscriptionId, url: null, revision: nextRevision(cap.revision) }
      const nextIndex: CheckoutIndex = { ...index.value, revision: nextRevision(index.value.revision), resources: [...index.value.resources] }
      await putLegacyResources(tx, mapping, nextIndex, fact)
      await putCheckoutValue(tx, checkoutKeys.capability(mapping.operationId), capRow.value, nextCap)
      await putCheckoutValue(tx, checkoutKeys.index(plan.targetHash), index.raw, nextIndex)
      return { status: fact.status, sessionId: fact.sessionId, url: null }
    }
    if (cap.status !== fact.status || cap.sessionId !== fact.sessionId || cap.customerId !== fact.customerId && cap.customerId !== null || cap.subscriptionId !== fact.subscriptionId && cap.subscriptionId !== null || cap.status === 'open' && cap.url !== fact.url) throw new LifecycleError('CHECKOUT_LEGACY_MAPPING_CONFLICT')
    return { status: fact.status, sessionId: fact.sessionId, url: fact.url }
  }, options)
}

/** B1: move only an exact, expired legacy current operation to a newly reserved ordinary operation. */
export async function admitAfterExpiredLegacyCheckout(db: LifecycleDb, previous: CheckoutRequest, next: CheckoutRequest, ticket: LegacyTicket, fact: VerifiedLegacyCheckout) {
  assertVerifiedLegacyCheckout(fact)
  const oldPlan = sealedCheckoutRequest(previous), nextPlan = sealedCheckoutRequest(next)
  if (ticket.kind !== 'mapped' || !ticket.mappingRaw || !ticket.capabilityRaw || !ticket.indexRaw ||
      oldPlan.targetHash !== nextPlan.targetHash || oldPlan.mode !== nextPlan.mode || oldPlan.source !== nextPlan.source ||
      oldPlan.organizationId !== nextPlan.organizationId || oldPlan.cutoverEpoch !== nextPlan.cutoverEpoch ||
      oldPlan.identity.operator.kind !== nextPlan.identity.operator.kind || oldPlan.identity.operator.id !== nextPlan.identity.operator.id ||
      previous.identity.operationId === next.identity.operationId || fact.status !== 'expired' || fact.url !== null) return changed()
  const mapping = parseLegacyMapping(ticket.mappingRaw), cap = parseCheckoutCapability(ticket.capabilityRaw)
  if (mapping.targetHash !== oldPlan.targetHash || mapping.mode !== oldPlan.mode || mapping.source !== oldPlan.source || mapping.inputDigest !== oldPlan.inputDigest || mapping.signature !== ticket.signature || mapping.rawHash !== ticket.rawHash || mapping.sessionId !== ticket.sessionId ||
      cap.operationId !== mapping.operationId || cap.targetHash !== mapping.targetHash || cap.inputDigest !== mapping.inputDigest || cap.mode !== mapping.mode || cap.sessionId !== mapping.sessionId || cap.status !== 'expired' || cap.customerId !== fact.customerId || cap.subscriptionId !== null || fact.subscriptionId !== null || cap.expiresAt !== fact.expiresAt ||
      fact.targetHash !== mapping.targetHash || fact.inputDigest !== mapping.inputDigest || fact.mode !== mapping.mode || fact.source !== mapping.source || fact.sessionId !== mapping.sessionId || fact.rawHash !== mapping.rawHash || fact.signature !== mapping.signature || fact.expiresAt !== oldPlan.expiresAt) return changed()
  return db.$transaction(async tx => {
    const user = await checkoutAdmissionUser(tx, next)
    await checkoutAdmissionUser(tx, previous)
    await assertCheckoutCutover(tx, oldPlan, true)
    if (await fence(tx, next.identity.targetUserId)) throw new LifecycleError('ACCOUNT_OPERATION_IN_PROGRESS')
    const rawRow = await tx.systemSetting.findUnique({ where: { key: legacyRawKey(oldPlan) }, select: { value: true } })
    const mapRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.legacyMapping(oldPlan.targetHash, oldPlan.mode) }, select: { value: true } })
    const capRow = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.capability(mapping.operationId) }, select: { value: true } })
    if (await tx.systemSetting.findUnique({ where: { key: checkoutKeys.plan(mapping.operationId) }, select: { key: true } })) return checkoutUnavailable()
    const index = await optionalIndex(tx, oldPlan.targetHash)
    if (rawRow?.value !== ticket.raw || rawRow.value !== legacyTombstone(mapping) || mapRow?.value !== ticket.mappingRaw || capRow?.value !== ticket.capabilityRaw || index?.raw !== ticket.indexRaw || index.value.revision !== ticket.indexRevision || index.value.dirty || index.value.currentOperationId !== mapping.operationId) return changed()
    // Keep historical ownership, including a Customer reused by the new operation, on the old resource row.
    for (const item of index.value.resources.filter(r => r.operationId === mapping.operationId)) {
      const row = await tx.systemSetting.findUnique({ where: { key: checkoutKeys.resource(mapping.mode, item.type, item.id) }, select: { value: true } })
      if (row?.value !== JSON.stringify({ version: 1, targetHash: mapping.targetHash, operationId: mapping.operationId, mode: mapping.mode, type: item.type, id: item.id })) return checkoutUnavailable()
    }
    if (!index.value.resources.some(r => r.type === 'checkout' && r.id === mapping.sessionId && r.operationId === mapping.operationId) ||
        cap.customerId && !index.value.resources.some(r => r.type === 'customer' && r.id === cap.customerId && r.operationId === mapping.operationId) ||
        cap.subscriptionId && !index.value.resources.some(r => r.type === 'subscription' && r.id === cap.subscriptionId && r.operationId === mapping.operationId)) return checkoutUnavailable()
    if (index.value.resources.length > 125) return checkoutUnavailable()
    if (next.customerMode === 'create' && user.stripeCustomerId !== null) throw new LifecycleError('CHECKOUT_IDENTITY_CHANGED')
    if (await receipt(tx, next.identity)) throw new LifecycleError('LIFECYCLE_INPUT_CONFLICT')
    await assertGlobalLifecycleOperationIdFree(tx, next.identity.operationId)
    const now = new Date().toISOString(), r: LifecycleReceipt = { version: 2, targetHash: nextPlan.targetHash, operationId: next.identity.operationId, operator: next.identity.operator, kind: 'checkout', inputDigest: nextPlan.inputDigest, generation: randomUUID(), token: randomUUID(), revision: 0, phase: 'reserved', reason: null, createdAt: now, updatedAt: now }
    await tx.systemSetting.create({ data: { key: lifecycleReceiptKey(next.identity), value: JSON.stringify(r) } })
    await tx.systemSetting.create({ data: { key: lifecycleFenceKey(next.identity.targetUserId), value: JSON.stringify({ version: 2, operationId: r.operationId, generation: r.generation, kind: 'checkout', state: 'active' }) } })
    await tx.systemSetting.create({ data: { key: checkoutKeys.plan(r.operationId), value: JSON.stringify(nextPlan) } })
    await putCheckoutValue(tx, checkoutKeys.index(nextPlan.targetHash), index.raw, { ...index.value, currentOperationId: r.operationId, revision: nextRevision(index.value.revision) })
    return { identity: next.identity, plan: nextPlan, phase: r.phase, claim: { ...next.identity, generation: r.generation, token: r.token } as LifecycleClaim }
  }, options)
}

/** R3 must call this in its finalization transaction, together with all closure/owner checks. This is a revision guard, not permission to delete. */
export async function assertCheckoutRetirementFactRevision(tx: Tx, claim: LifecycleClaim, expectedIndexRevision: number) {
  if (claim.kind !== 'retirement' || !Number.isSafeInteger(expectedIndexRevision) || expectedIndexRevision < 0) return changed()
  const { r } = await authorize(tx, claim, ['executing']), index = await checkoutIndex(tx, r.value.targetHash)
  if (index.value.revision !== expectedIndexRevision || index.value.dirty) throw new LifecycleError('CHECKOUT_FACT_REVISION_CHANGED')
  return { revision: index.value.revision, closureProved: false }
}
