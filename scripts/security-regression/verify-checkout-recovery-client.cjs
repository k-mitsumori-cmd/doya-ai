const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load } = require('./load-typescript.cjs')
const { CheckoutRecoveryClient, checkoutScopeKey, checkoutReturnPath, checkoutStoredIntent } = load('src/lib/checkout-recovery-client.ts', {
  './billing-response-client': { billingRedirectUrl: raw => typeof raw === 'string' && raw.startsWith('https://checkout.example.invalid/') ? raw : null },
}, { AbortController })

const actor = 'actor-one'
const intent = { planId: 'banner-pro', billingPeriod: 'monthly', serviceId: 'banner', returnTo: '/banner/pricing', organization: null }
const next = { ...intent, billingPeriod: 'yearly' }
const memory = new Map()
const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const handleKey = `doya-checkout-handle-v1:${actor}`
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, data })
let calls = [], post = async () => { throw Error('unexpected request') }
const client = () => new CheckoutRecoveryClient(actor, () => storage, (body, headers, signal) => {
  calls.push({ body, headers, signal, persisted: memory.get(handleKey) })
  return post(body, headers, signal)
}, () => crypto.randomUUID())
const run = async () => {
  const first = client()
  await first.observe(intent)
  assert.equal(first.snapshot().phase, 'idle')
  post = async body => body.action === 'start'
    ? response({ actorId: actor, operationId: body.operationId, sessionId: 'cs_created', url: 'https://checkout.example.invalid/new' })
    : response({ actorId: actor, operationId: body.operationId, sessionId: 'cs_created', url: 'https://checkout.example.invalid/new' })
  const [created, duplicate] = await Promise.all([first.start(intent), first.start(intent)])
  assert.equal(duplicate, null)
  assert.equal(created.kind, 'ready')
  assert.deepEqual(calls.map(x => x.body.action), ['start', 'ready'])
  assert.equal(JSON.parse(calls[0].persisted).operationId, calls[0].body.operationId, 'handle must be saved before start')
  assert.equal(first.snapshot().handle.scopeKey, checkoutScopeKey(intent))
  assert.equal(checkoutReturnPath(first.snapshot().handle), '/banner/pricing')
  assert.equal(checkoutReturnPath({ ...first.snapshot().handle, scopeKey: JSON.stringify(['banner-pro', 'monthly', 'banner', '//evil.example.invalid', null, null]) }), null)
  assert.equal(checkoutStoredIntent(first.snapshot().handle, actor, '/banner/pricing', null).billingPeriod, 'monthly')
  assert.equal(checkoutStoredIntent(first.snapshot().handle, 'other-actor', '/banner/pricing', null), null)
  const hrIntent = { planId: 'hr-pro', billingPeriod: 'yearly', serviceId: 'hr', returnTo: '/hr/settings/billing', organization: { actor, organizationId: 'org-a' } }
  const hrHandle = { ...first.snapshot().handle, scopeKey: checkoutScopeKey(hrIntent) }
  assert.equal(checkoutStoredIntent(hrHandle, actor, '/hr/settings/billing', 'org-a').organization.organizationId, 'org-a')
  assert.equal(checkoutStoredIntent(hrHandle, actor, '/hr/settings/billing', 'org-b'), null, 'other selected organization cannot supply stored HR headers')
  assert.equal(checkoutStoredIntent(hrHandle, actor, '/banner/pricing', 'org-a'), null, 'HR recovery requires the HR selection surface')
  assert.equal(checkoutStoredIntent({ ...hrHandle, scopeKey: JSON.stringify(['hr-pro', 'yearly', 'hr', '//other.invalid', actor, 'org-a']) }, actor, '/hr/settings/billing', 'org-a'), null)
  first.dispose()

  calls = []
  post = async body => response({ actorId: actor, operationId: body.operationId, phase: 'completed', dispatched: true })
  const restored = client()
  await restored.observe(intent)
  assert.deepEqual(calls.map(x => x.body.action), ['status'], 'reload is status-only')
  assert.equal(restored.snapshot().phase, 'completed')
  assert.equal(await restored.start(next), null, 'a different plan cannot create a second operation')
  assert.equal(await restored.resume(intent), null, 'dispatched operation cannot retry a write')
  calls = []
  post = async body => response({ actorId: 'other', operationId: body.operationId, sessionId: 'cs_other', url: 'https://checkout.example.invalid/other' })
  assert.equal(await restored.readyAgain(intent), null)
  assert.equal(restored.snapshot().phase, 'unknown')
  assert.equal(calls.length, 1)
  restored.dispose()

  calls = []
  const missing = client()
  post = async body => response({ actorId: actor, operationId: body.operationId, phase: 'missing', dispatched: false })
  await missing.observe(intent)
  assert.equal(missing.snapshot().phase, 'missing')
  assert.equal(await missing.start(intent), null, 'missing is not proof of nonexecution')
  assert.deepEqual(calls.map(x => x.body.action), ['status'])
  post = async body => response({ actorId: actor, operationId: body.operationId, phase: 'aborted' })
  await missing.abortMissing(intent)
  assert.equal(missing.snapshot().phase, 'aborted')
  assert.equal(calls.at(-1).body.action, 'abort')
  post = async body => body.action === 'start'
    ? response({ actorId: actor, operationId: body.operationId, sessionId: 'cs_second', url: 'https://checkout.example.invalid/second' })
    : response({ actorId: actor, operationId: body.operationId, sessionId: 'cs_second', url: 'https://checkout.example.invalid/second' })
  const second = await missing.newAfterTerminal(intent)
  assert.equal(second.kind, 'ready')
  assert.notEqual(missing.snapshot().handle.operationId, JSON.parse(calls[0].persisted).operationId)
  missing.dispose()

  calls = []
  const unavailableStorage = new CheckoutRecoveryClient(actor, () => ({ getItem: () => null, setItem: () => { throw Error('disabled') }, removeItem() {} }),
    async () => { calls.push('network'); return response({}) }, () => crypto.randomUUID())
  await unavailableStorage.observe(intent)
  assert.equal((await unavailableStorage.start(intent)).kind, 'none')
  assert.equal(unavailableStorage.snapshot().phase, 'blocked')
  assert.equal(calls.length, 0, 'no unfenced fallback after storage failure')
  unavailableStorage.dispose()

  memory.clear(); calls = []
  const canonical = crypto.randomUUID()
  const converged = client(); await converged.observe(intent)
  post = async body => response({ actorId: actor, operationId: body.action === 'start' ? canonical : body.operationId,
    sessionId: 'cs_canonical', url: 'https://checkout.example.invalid/canonical' })
  assert.equal((await converged.start(intent)).kind, 'ready')
  assert.equal(converged.snapshot().handle.operationId, canonical)
  assert.equal(calls[1].body.operationId, canonical, 'ready uses persisted canonical id')
  assert.equal(JSON.parse(memory.get(handleKey)).operationId, canonical)
  converged.dispose()

  calls = []
  post = async body => body.action === 'status'
    ? response({ actorId: actor, operationId: body.operationId, phase: 'completed', dispatched: true })
    : response({ code: 'CHECKOUT_ALREADY_COMPLETED' }, 409)
  const providerComplete = client(); await providerComplete.observe(intent)
  assert.equal((await providerComplete.readyAgain(intent)).kind, 'provider_complete')
  assert.equal(providerComplete.snapshot().phase, 'provider_complete')
  assert.equal(calls.filter(x => ['start', 'resume'].includes(x.body.action)).length, 0)
  providerComplete.dispose()

  calls = []
  post = async body => body.action === 'status'
    ? response({ actorId: actor, operationId: body.operationId, phase: 'completed', dispatched: true })
    : response({ code: 'CHECKOUT_EXPIRED' }, 409)
  const expired = client(); await expired.observe(intent)
  assert.equal(expired.snapshot().phase, 'completed')
  assert.equal((await expired.readyAgain(intent)).kind, 'none')
  assert.equal(expired.snapshot().phase, 'expired')
  post = async body => response({ actorId: actor, operationId: body.operationId, sessionId: 'cs_after_expiry', url: 'https://checkout.example.invalid/after-expiry' })
  assert.equal((await expired.newAfterTerminal(intent)).kind, 'ready')
  assert.equal(calls.at(-2).body.action, 'start_after_terminal')
  assert.equal(calls.at(-2).body.previousOperationId, canonical)
  expired.dispose()

  calls = []
  post = async body => body.action === 'status'
    ? response({ actorId: actor, operationId: body.operationId, phase: 'aborted', dispatched: false })
    : response({ actorId: actor, operationId: body.operationId, sessionId: 'cs_after_abort', url: 'https://checkout.example.invalid/after-abort' })
  const afterAbortedSuccessor = client(); await afterAbortedSuccessor.observe(intent)
  assert.equal(afterAbortedSuccessor.snapshot().handle.previousOperationId, canonical)
  assert.equal(afterAbortedSuccessor.snapshot().phase, 'aborted')
  assert.equal((await afterAbortedSuccessor.newAfterTerminal(intent)).kind, 'ready')
  assert.equal(calls.at(-2).body.action, 'start', 'aborted successor starts normally, never reuses older expired pointer')
  assert.equal(calls.at(-2).body.previousOperationId, undefined)
  afterAbortedSuccessor.dispose()

  memory.clear(); calls = []
  const oldScopeOperation = crypto.randomUUID()
  memory.set(handleKey, JSON.stringify({ version: 1, actorId: actor, operationId: oldScopeOperation, scopeKey: checkoutScopeKey(intent), previousOperationId: null }))
  post = async body => body.action === 'status'
    ? response({ actorId: actor, operationId: body.operationId, phase: 'aborted', dispatched: false })
    : response({ actorId: actor, operationId: body.operationId, sessionId: 'cs_new_period', url: 'https://checkout.example.invalid/new-period' })
  const changedPeriod = client(); await changedPeriod.observe(intent)
  assert.equal((await changedPeriod.newAfterTerminal(next)).kind, 'ready')
  assert.equal(calls.at(-2).body.action, 'start')
  assert.equal(calls.at(-2).body.billingPeriod, 'yearly')
  assert.equal(changedPeriod.snapshot().handle.scopeKey, checkoutScopeKey(next))
  changedPeriod.dispose()

  memory.clear(); calls = []
  memory.set(handleKey, JSON.stringify({ version: 1, actorId: actor, operationId: oldScopeOperation, scopeKey: checkoutScopeKey(intent), previousOperationId: null }))
  post = async body => body.action === 'status'
    ? response({ actorId: actor, operationId: body.operationId, phase: 'completed', dispatched: true })
    : response({ code: 'CHECKOUT_EXPIRED' }, 409)
  const changedExpired = client(); await changedExpired.observe(intent)
  await changedExpired.readyAgain(intent)
  assert.equal(changedExpired.snapshot().phase, 'expired')
  assert.equal(await changedExpired.newAfterTerminal(next), null, 'expired old scope cannot cross intent without verified successor policy')
  assert.equal(calls.filter(x => x.body.action.startsWith('start')).length, 0)
  changedExpired.dispose()

  memory.clear(); calls = []
  let resolveLate
  post = async () => new Promise(resolve => { resolveLate = resolve })
  const stale = client(); await stale.observe(intent)
  let lease = true
  const pending = stale.start(intent, () => lease)
  await Promise.resolve()
  lease = false
  resolveLate(response({ actorId: actor, operationId: calls[0].body.operationId, sessionId: 'cs_late', url: 'https://checkout.example.invalid/late' }))
  assert.equal((await pending).kind, 'none')
  assert.equal(calls.length, 1, 'stale start never proceeds to ready')
  assert.equal(JSON.parse(memory.get(handleKey)).operationId, calls[0].body.operationId, 'the durable handle remains for later status')
  stale.dispose()

  memory.clear(); calls = []
  const observedId = crypto.randomUUID()
  memory.set(handleKey, JSON.stringify({ version: 1, actorId: actor, operationId: observedId, scopeKey: checkoutScopeKey(intent), previousOperationId: null }))
  let releaseOldStatus, oldLease = true, statusCount = 0
  post = async body => {
    assert.equal(body.action, 'status')
    statusCount++
    if (statusCount === 1) return new Promise(resolve => { releaseOldStatus = resolve })
    return response({ actorId: actor, operationId: observedId, phase: 'reserved', dispatched: false })
  }
  const strictRemount = client()
  const oldObservation = strictRemount.observe(intent, () => oldLease)
  await Promise.resolve()
  oldLease = false
  const newObservation = strictRemount.observe(intent)
  releaseOldStatus(response({ actorId: actor, operationId: observedId, phase: 'reserved', dispatched: false }))
  await Promise.all([oldObservation, newObservation])
  assert.equal(statusCount, 2, 'new lease re-observes after stale in-flight status')
  assert.equal(strictRemount.snapshot().phase, 'reserved')
  strictRemount.dispose()
  console.log(JSON.stringify({ passed: true, scope: 'Actual shared client; synthetic transport/storage only. Persist-before-send, canonical convergence, status-only reload, terminal successor, stale response, missing abort and storage failure.' }))
}
run().catch(error => { console.error(error); process.exitCode = 1 })
