import { LifecycleError, type LifecycleClaim, type LifecycleIdentity } from './state'
import { startLifecycleOperation, markLifecycleUnknown, abortUnstartedLifecycleOperation, type LifecycleDb } from './store'
import { sealedCheckoutRequest, type CheckoutRequest } from './checkout-receipt'
import { checkoutUrls } from './checkout-urls'
import { type VerifiedCheckoutFact, type CheckoutProviderAdapter } from './checkout-provider'
import { type LegacySignatureParts } from './checkout-legacy'
import { abortCheckoutBoundOperation, readCheckoutBoundOperation, admitCheckoutLifecycle, recoverCheckoutLifecycle, prepareCheckoutLifecycle, dispatchCheckoutLifecycle, recordCustomerAckAndPlanCheckout, recordCheckoutAckAndReady, ingestCorrelatedCheckoutLateFact, captureCheckoutReadyRead, authorizeCheckoutReadyRead, readCheckoutRecovery, recordLegacyCheckoutClassification, captureLegacyCheckoutReady, adoptLegacyCheckoutReady, authorizeLegacyCheckoutReady, admitAfterExpiredLegacyCheckout, readCheckoutCurrentKind } from './checkout-store'

/** Unconnected internal coordinator. No module import performs I/O; the server supplies a provider adapter explicitly. */
export function checkoutCoordinator(db: LifecycleDb, provider: CheckoutProviderAdapter) {
  const fixed = <T extends object>(value: T): T => Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, child && typeof child === 'object' ? fixed(child) : child]),
  )) as T
  async function failed(claim: LifecycleClaim, dispatch: Awaited<ReturnType<typeof dispatchCheckoutLifecycle>>, error: unknown, fact?: VerifiedCheckoutFact): Promise<never> {
    // If the provider acknowledged before the DB transaction failed, retain its exact resource without granting URL/entitlements.
    if (fact) { try { await ingestCorrelatedCheckoutLateFact(db, fact) } catch { /* The dispatched row itself remains durable and blocks new work. */ } }
    const review = error instanceof LifecycleError && ['CHECKOUT_PROVIDER_FACT_MISMATCH', 'CHECKOUT_CUSTOMER_REFERENCE_CONFLICT'].includes(error.code)
    try { await markLifecycleUnknown(db, claim, dispatch.dispatch.actionKey, dispatch.dispatch.dispatchToken, review ? 'NEEDS_REVIEW' : 'EXTERNAL_UNKNOWN') } catch { /* Never infer non-execution from an unavailable DB. */ }
    throw new LifecycleError(review ? 'CHECKOUT_NEEDS_REVIEW' : 'CHECKOUT_RESULT_UNKNOWN')
  }
  async function execute(request: CheckoutRequest, claim: LifecycleClaim) {
    const recovery = await readCheckoutRecovery(db, request)
    if (recovery.phase === 'reserved') { await prepareCheckoutLifecycle(db, claim); await startLifecycleOperation(db, claim) }
    let plan = (await readCheckoutRecovery(db, request)).plan
    if (plan.customerMode === 'create' && plan.customerId === null) {
      const sent = await dispatchCheckoutLifecycle(db, claim, 'customer_create', request)
      let fact: VerifiedCheckoutFact | undefined
      try { fact = await provider.createCustomer(request, sent.plan, sent.dispatch); plan = (await recordCustomerAckAndPlanCheckout(db, claim, fact, sent)).plan }
      catch (error) { return failed(claim, sent, error, fact) }
    }
    const reuse = plan.customerMode === 'reuse' ? await provider.reuseCustomer(plan, request) : undefined
    const sent = await dispatchCheckoutLifecycle(db, claim, 'checkout_create', request, reuse)
    let fact: VerifiedCheckoutFact | undefined
    try { fact = await provider.createCheckout(request, sent.plan, sent.dispatch); await recordCheckoutAckAndReady(db, claim, fact) }
    catch (error) { return failed(claim, sent, error, fact) }
    const ticket = await captureCheckoutReadyRead(db, request)
    const ready = await authorizeCheckoutReadyRead(db, request, ticket, fact)
    return { ...ready, operationId: claim.operationId }
  }
  async function boundRequest(identity: LifecycleIdentity, allowHistoricalTerminal = false) {
    const r = await readCheckoutBoundOperation(db, identity, allowHistoricalTerminal)
    if (!r.plan || !r.plan.recovery || !r.email) throw new LifecycleError('CHECKOUT_NEEDS_REVIEW')
    const urls = checkoutUrls(r.plan.recovery, r.plan.planId, r.plan.serviceId)
    const request: CheckoutRequest = {
      cutoverEpoch: r.plan.cutoverEpoch, identity, mode: r.plan.mode, source: r.plan.source,
      organizationId: r.plan.organizationId, customerMode: r.plan.customerMode,
      customerId: r.plan.expectedCustomerId,
      terms: { priceId: r.plan.priceId, planId: r.plan.planId, serviceId: r.plan.serviceId,
        trialDays: r.plan.trialDays, successUrl: urls.successUrl, cancelUrl: urls.cancelUrl,
        email: r.email, name: r.name, expiresAt: r.plan.expiresAt }, recovery: r.plan.recovery,
    }
    if (sealedCheckoutRequest(request).inputDigest !== r.plan.inputDigest) throw new LifecycleError('CHECKOUT_NEEDS_REVIEW')
    return { request, phase: r.phase, reason: r.reason, dispatched: r.dispatched }
  }
  return {
    async admit(request: CheckoutRequest) {
      const admission = await admitCheckoutLifecycle(db, request)
      return { operationId: admission.identity.operationId, phase: admission.phase, newlyReserved: admission.claim !== null }
    },
    async create(request: CheckoutRequest) {
      const admission = await admitCheckoutLifecycle(db, request)
      if (admission.claim) return execute(request, admission.claim)
      if (admission.phase === 'completed') {
        const sameOperation = { ...request, identity: admission.identity, terms: { ...request.terms, expiresAt: admission.plan.expiresAt } }
        const ticket = await captureCheckoutReadyRead(db, sameOperation), fact = await provider.readReady(ticket.plan, ticket.dispatch, ticket.capability)
        await ingestCorrelatedCheckoutLateFact(db, fact)
        const ready = await authorizeCheckoutReadyRead(db, sameOperation, ticket, fact)
        return { ...ready, operationId: admission.identity.operationId }
      }
      return { operationId: admission.identity.operationId, phase: admission.phase, resultUnknown: true }
    },
    async recover(request: CheckoutRequest) { return execute(request, await recoverCheckoutLifecycle(db, request)) },
    async reconcile(request: CheckoutRequest, resourceId: string) {
      const r = await readCheckoutRecovery(db, request)
      if (!r.dispatch || r.ledgerRevision === null) throw new LifecycleError('CHECKOUT_RECONCILIATION_NOT_AVAILABLE')
      // Reconciliation is a provider read for this exact dispatch; it never retries a provider write or rotates an unknown claim.
      const fact = r.dispatch.type === 'customer_create' ? await provider.reconcileCustomer(r.dispatch.plan, r.dispatch, resourceId) : await provider.reconcileCheckout(r.dispatch.plan, r.dispatch, resourceId)
      await ingestCorrelatedCheckoutLateFact(db, fact)
      if (r.dispatch.type === 'customer_create') await recordCustomerAckAndPlanCheckout(db, r.claim, fact, { operationRevision: r.operationRevision, ledgerRevision: r.ledgerRevision })
      else await recordCheckoutAckAndReady(db, r.claim, fact)
      return { operationId: request.identity.operationId, reconciled: true, urlAuthorized: false }
    },
    async authorizeReadyRead(request: CheckoutRequest) {
      const ticket = await captureCheckoutReadyRead(db, request), fact = await provider.readReady(ticket.plan, ticket.dispatch, ticket.capability)
      await ingestCorrelatedCheckoutLateFact(db, fact)
      return authorizeCheckoutReadyRead(db, request, ticket, fact)
    },
    async status(request: CheckoutRequest) {
      const r = await readCheckoutRecovery(db, request)
      return { operationId: request.identity.operationId, phase: r.phase, reason: r.reason, dispatched: r.dispatch !== null }
    },
    async statusByHandle(identity: LifecycleIdentity) {
      const r = await readCheckoutBoundOperation(db, identity)
      return { operationId: identity.operationId, phase: r.phase, reason: r.reason, dispatched: r.dispatched }
    },
    async resumeByHandle(identity: LifecycleIdentity) {
      const bound = await boundRequest(identity)
      if (!['reserved', 'executing'].includes(bound.phase) || bound.reason !== null || bound.dispatched) throw new LifecycleError('CHECKOUT_NEEDS_REVIEW')
      return execute(bound.request, await recoverCheckoutLifecycle(db, bound.request))
    },
    async readyByHandle(identity: LifecycleIdentity) {
      const ticket = await captureCheckoutReadyRead(db, identity)
      const fact = await provider.readReady(ticket.plan, ticket.dispatch, ticket.capability)
      await ingestCorrelatedCheckoutLateFact(db, fact)
      const ready = await authorizeCheckoutReadyRead(db, identity, ticket, fact)
      return { ...ready, operationId: identity.operationId }
    },
    abortByHandle(identity: LifecycleIdentity) { return abortCheckoutBoundOperation(db, identity) },
    async advanceAfterTerminalByHandle(previousIdentity: LifecycleIdentity, nextRequest: CheckoutRequest) {
      const previous = await boundRequest(previousIdentity, true)
      if (previous.phase !== 'completed') throw new LifecycleError('CHECKOUT_IN_PROGRESS')
      return this.advanceAfterTerminal(previous.request, nextRequest)
    },
    async abort(request: CheckoutRequest) { return abortUnstartedLifecycleOperation(db, request.identity, sealedCheckoutRequest(request).inputDigest) },
    classifyLegacy(request: CheckoutRequest) { return recordLegacyCheckoutClassification(db, request) },
    async legacyReady(request: CheckoutRequest, parts: LegacySignatureParts) {
      const ticket = await captureLegacyCheckoutReady(db, request, parts)
      const fact = await provider.readLegacyReady(request, ticket.sessionId, ticket.rawHash, ticket.signature)
      const result = ticket.kind === 'ready' ? await adoptLegacyCheckoutReady(db, request, ticket, fact, parts) : await authorizeLegacyCheckoutReady(db, request, ticket, fact)
      if (result.status !== 'open' || !result.url) throw new LifecycleError(result.status === 'complete' ? 'CHECKOUT_ALREADY_COMPLETED' : 'CHECKOUT_IN_PROGRESS')
      return { id: result.sessionId, url: result.url }
    },
    /** B1 internal interop only. HTTP routes and real provider wiring remain separate units. */
    async advanceAfterTerminal(previousInput: CheckoutRequest, nextInput: CheckoutRequest, partsInput?: LegacySignatureParts) {
      const previous = fixed(previousInput), next = fixed(nextInput), parts = partsInput ? fixed(partsInput) : undefined
      const oldPlan = sealedCheckoutRequest(previous), nextPlan = sealedCheckoutRequest(next)
      if (oldPlan.targetHash !== nextPlan.targetHash || oldPlan.mode !== nextPlan.mode || oldPlan.source !== nextPlan.source || oldPlan.organizationId !== nextPlan.organizationId || oldPlan.cutoverEpoch !== nextPlan.cutoverEpoch ||
          oldPlan.identity.operator.kind !== nextPlan.identity.operator.kind || oldPlan.identity.operator.id !== nextPlan.identity.operator.id) throw new LifecycleError('CHECKOUT_IDENTITY_CHANGED')
      const unchanged = () => {
        if (JSON.stringify(sealedCheckoutRequest(previousInput)) !== JSON.stringify(oldPlan) || JSON.stringify(sealedCheckoutRequest(nextInput)) !== JSON.stringify(nextPlan) || partsInput && JSON.stringify(partsInput) !== JSON.stringify(parts)) throw new LifecycleError('LIFECYCLE_INPUT_CONFLICT')
      }
      const current = await readCheckoutCurrentKind(db, previous)
      unchanged()
      if (current.kind === 'empty') throw new LifecycleError('CHECKOUT_RECONCILIATION_NOT_AVAILABLE')
      if (current.kind === 'ordinary') {
        if (current.operationId !== previous.identity.operationId) {
          // A concurrent request already switched the pointer. Recover its exact sealed input.
          const live = current.version === 2 ? await readCheckoutBoundOperation(db, { ...next.identity, operationId: current.operationId }) : null
          const currentNext: CheckoutRequest = fixed({ ...next, identity: { ...next.identity, operationId: current.operationId },
            terms: { ...next.terms, expiresAt: live?.plan?.version === 2 ? live.plan.expiresAt : next.terms.expiresAt } })
          if (live?.plan?.version === 2 && sealedCheckoutRequest(currentNext).inputDigest !== live.plan.inputDigest) throw new LifecycleError('CHECKOUT_IN_PROGRESS')
          const result = await readCheckoutRecovery(db, currentNext)
          unchanged()
          if (result.phase !== 'completed') {
            // A second caller must not rotate the active claim while the first provider write is in flight.
            return { operationId: current.operationId, phase: result.phase, resultUnknown: true }
          }
          const ticket = await captureCheckoutReadyRead(db, currentNext), fact = await provider.readReady(ticket.plan, ticket.dispatch, ticket.capability)
          unchanged()
          await ingestCorrelatedCheckoutLateFact(db, fact)
          const ready = await authorizeCheckoutReadyRead(db, currentNext, ticket, fact)
          unchanged()
          return { ...ready, operationId: current.operationId }
        }
        if (current.operationId === next.identity.operationId) throw new LifecycleError('CHECKOUT_IN_PROGRESS')
        const ticket = await captureCheckoutReadyRead(db, previous)
        const fact = await provider.readReady(ticket.plan, ticket.dispatch, ticket.capability)
        unchanged()
        if (fact.status === 'open' && oldPlan.inputDigest !== nextPlan.inputDigest) throw new LifecycleError('CHECKOUT_IN_PROGRESS')
        await ingestCorrelatedCheckoutLateFact(db, fact)
        unchanged()
        if (fact.status === 'open') {
          if (oldPlan.inputDigest !== nextPlan.inputDigest) throw new LifecycleError('CHECKOUT_IN_PROGRESS')
          const ready = await authorizeCheckoutReadyRead(db, previous, ticket, fact)
          unchanged()
          return { ...ready, operationId: previous.identity.operationId }
        }
        if (fact.status === 'complete') throw new LifecycleError('CHECKOUT_ALREADY_COMPLETED')
        const admitted = await admitCheckoutLifecycle(db, next)
        unchanged()
        if (!admitted.claim) throw new LifecycleError('CHECKOUT_IN_PROGRESS')
        const ready = await execute(next, admitted.claim)
        unchanged()
        return ready
      }
      if (!parts) throw new LifecycleError('CHECKOUT_LEGACY_RECONCILIATION_REQUIRED')
      const first = await captureLegacyCheckoutReady(db, previous, parts)
      const fact = await provider.readLegacyReady(previous, first.sessionId, first.rawHash, first.signature)
      unchanged()
      if (fact.status === 'open' && oldPlan.inputDigest !== nextPlan.inputDigest) throw new LifecycleError('CHECKOUT_IN_PROGRESS')
      if (first.kind === 'ready') await adoptLegacyCheckoutReady(db, previous, first, fact, parts)
      else await authorizeLegacyCheckoutReady(db, previous, first, fact)
      unchanged()
      const mapped = await captureLegacyCheckoutReady(db, previous, parts)
      if (mapped.kind !== 'mapped') throw new LifecycleError('CHECKOUT_LEGACY_MAPPING_CONFLICT')
      const result = await authorizeLegacyCheckoutReady(db, previous, mapped, fact)
      unchanged()
      if (result.status === 'open') {
        if (oldPlan.inputDigest !== nextPlan.inputDigest || !result.url) throw new LifecycleError('CHECKOUT_IN_PROGRESS')
        unchanged()
        return { id: result.sessionId, url: result.url, operationId: previous.identity.operationId }
      }
      if (result.status === 'complete') throw new LifecycleError('CHECKOUT_ALREADY_COMPLETED')
      const finalTicket = await captureLegacyCheckoutReady(db, previous, parts)
      unchanged()
      const admitted = await admitAfterExpiredLegacyCheckout(db, previous, next, finalTicket, fact)
      unchanged()
      const ready = await execute(next, admitted.claim)
      unchanged()
      return ready
    },
  }
}
