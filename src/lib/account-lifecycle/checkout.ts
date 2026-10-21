import { LifecycleError, type LifecycleClaim } from './state'
import { startLifecycleOperation, markLifecycleUnknown, abortUnstartedLifecycleOperation, type LifecycleDb } from './store'
import { sealedCheckoutRequest, type CheckoutRequest } from './checkout-receipt'
import { type VerifiedCheckoutFact, type CheckoutProviderAdapter } from './checkout-provider'
import { type LegacySignatureParts } from './checkout-legacy'
import { admitCheckoutLifecycle, recoverCheckoutLifecycle, prepareCheckoutLifecycle, dispatchCheckoutLifecycle, recordCustomerAckAndPlanCheckout, recordCheckoutAckAndReady, ingestCorrelatedCheckoutLateFact, captureCheckoutReadyRead, authorizeCheckoutReadyRead, readCheckoutRecovery, recordLegacyCheckoutClassification, captureLegacyCheckoutReady, adoptLegacyCheckoutReady, authorizeLegacyCheckoutReady } from './checkout-store'

/** Unconnected internal coordinator. No module import performs I/O; the server supplies a provider adapter explicitly. */
export function checkoutCoordinator(db: LifecycleDb, provider: CheckoutProviderAdapter) {
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
    const reuse = plan.customerMode === 'reuse' ? await provider.reuseCustomer(plan) : undefined
    const sent = await dispatchCheckoutLifecycle(db, claim, 'checkout_create', request, reuse)
    let fact: VerifiedCheckoutFact | undefined
    try { fact = await provider.createCheckout(request, sent.plan, sent.dispatch); await recordCheckoutAckAndReady(db, claim, fact) }
    catch (error) { return failed(claim, sent, error, fact) }
    const ticket = await captureCheckoutReadyRead(db, request)
    return authorizeCheckoutReadyRead(db, request, ticket, fact)
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
        const sameOperation = { ...request, identity: admission.identity }
        const ticket = await captureCheckoutReadyRead(db, sameOperation), fact = await provider.readReady(ticket.plan, ticket.dispatch, ticket.capability)
        await ingestCorrelatedCheckoutLateFact(db, fact)
        return authorizeCheckoutReadyRead(db, sameOperation, ticket, fact)
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
    async abort(request: CheckoutRequest) { return abortUnstartedLifecycleOperation(db, request.identity, sealedCheckoutRequest(request).inputDigest) },
    classifyLegacy(request: CheckoutRequest) { return recordLegacyCheckoutClassification(db, request) },
    async legacyReady(request: CheckoutRequest, parts: LegacySignatureParts) {
      const ticket = await captureLegacyCheckoutReady(db, request, parts)
      const fact = await provider.readLegacyReady(request, ticket.sessionId, ticket.rawHash, ticket.signature)
      const result = ticket.kind === 'ready' ? await adoptLegacyCheckoutReady(db, request, ticket, fact, parts) : await authorizeLegacyCheckoutReady(db, request, ticket, fact)
      if (result.status !== 'open' || !result.url) throw new LifecycleError(result.status === 'complete' ? 'CHECKOUT_ALREADY_COMPLETED' : 'CHECKOUT_IN_PROGRESS')
      return { id: result.sessionId, url: result.url }
    },
  }
}
