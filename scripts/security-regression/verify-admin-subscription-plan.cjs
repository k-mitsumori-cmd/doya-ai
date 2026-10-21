// Pure parser/namespace contract; no provider, DB, HTTP or production operation.
require('tsx/cjs')
const assert = require('node:assert/strict')
const { makeAdminSubscriptionPlan, parseAdminSubscriptionPlan, adminSubscriptionActionKey } = require('../../src/lib/account-lifecycle/admin-subscription-plan.ts')
const { verifyAdminSubscriptionFact, assertAdminSubscriptionFact } = require('../../src/lib/account-lifecycle/admin-subscription-fact.ts')
const { makeSubscriptionPlan } = require('../../src/lib/account-lifecycle/subscription-plan.ts')

const operationId = '12345678-1234-4123-8123-123456789abc'
const target = { id: 'sub_EXACT', customerId: 'cus_OWNER', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: 1792627200 }
const base = {
  identity: { operator: { kind: 'admin', id: 'admin-a' }, targetUserId: 'user-a', operationId, kind: 'cancel' },
  intent: 'period_end_cancel', mode: 'test', email: 'user@example.invalid',
  expectedCustomerId: 'cus_OWNER', expectedSubscriptionId: 'sub_EXACT', expectedPriceId: 'price_ONE', target,
}
const plan = makeAdminSubscriptionPlan(base)
assert.deepEqual(parseAdminSubscriptionPlan(JSON.stringify(plan)), plan)
assert.equal(plan.source, 'admin')
assert.equal(plan.settlementPolicyVersion, 1)
assert.match(adminSubscriptionActionKey(plan), /^[a-f0-9]{64}$/)
const immediate = makeAdminSubscriptionPlan({ ...base, intent: 'immediate_cancel' })
assert.notEqual(immediate.inputDigest, plan.inputDigest)
assert.notEqual(adminSubscriptionActionKey(immediate), adminSubscriptionActionKey(plan))
const resume = makeAdminSubscriptionPlan({ ...base, identity: { ...base.identity, kind: 'resume' }, intent: 'resume', target: { ...target, cancelAtPeriodEnd: true } })
assert.notEqual(resume.inputDigest, plan.inputDigest)
const reject = changed => assert.throws(() => parseAdminSubscriptionPlan(JSON.stringify(changed)), { code: 'ADMIN_SUBSCRIPTION_PLAN_UNAVAILABLE' })
for (const changed of [
  { ...plan, source: 'self_service' },
  { ...plan, version: 2 },
  { ...plan, identity: { ...plan.identity, operator: { kind: 'admin', id: 'admin-b' } } },
  { ...plan, identity: { ...plan.identity, targetUserId: 'user-b' } },
  { ...plan, mode: 'live' },
  { ...plan, expectedPriceId: 'price_OTHER' },
  { ...plan, target: { ...plan.target, id: 'sub_OTHER' } },
  { ...plan, extra: 'unchecked' },
]) reject(changed)
assert.throws(() => parseAdminSubscriptionPlan('{'), { code: 'ADMIN_SUBSCRIPTION_PLAN_UNAVAILABLE' })
assert.throws(() => parseAdminSubscriptionPlan(' '.repeat(8193)), { code: 'ADMIN_SUBSCRIPTION_PLAN_UNAVAILABLE' })
// The self-service source remains a distinct, strict v1 contract.
const self = makeSubscriptionPlan({
  identity: { operator: { kind: 'user', id: 'user-a' }, targetUserId: 'user-a', operationId, kind: 'cancel' },
  mode: 'test', email: 'user@example.invalid', expectedCustomerId: 'cus_OWNER', expectedSubscriptionId: 'sub_EXACT',
  serviceId: 'banner', cancelMode: 'period_end', targets: [target],
})
reject(self)
const scheduledFact = verifyAdminSubscriptionFact(plan, {
  proof: 'write_ack', status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: target.currentPeriodEnd,
})
assert.deepEqual(assertAdminSubscriptionFact(plan, JSON.stringify(scheduledFact)), scheduledFact)
const immediateFact = verifyAdminSubscriptionFact(immediate, {
  proof: 'irreversible_terminal', status: 'canceled', cancelAtPeriodEnd: false, currentPeriodEnd: target.currentPeriodEnd,
})
assert.deepEqual(assertAdminSubscriptionFact(immediate, JSON.stringify(immediateFact)), immediateFact)
const resumeFact = verifyAdminSubscriptionFact(resume, {
  proof: 'write_ack', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: target.currentPeriodEnd,
})
assert.deepEqual(assertAdminSubscriptionFact(resume, JSON.stringify(resumeFact)), resumeFact)
const alreadyResume = makeAdminSubscriptionPlan({ ...base, identity: { ...base.identity, kind: 'resume' },
  intent: 'resume', target: { ...target, cancelAtPeriodEnd: false } })
assert.equal(verifyAdminSubscriptionFact(alreadyResume, { proof: 'already_desired', status: 'active',
  cancelAtPeriodEnd: false, currentPeriodEnd: target.currentPeriodEnd }).proof, 'already_desired')
for (const changed of [
  { ...scheduledFact, operationId: '87654321-1234-4123-8123-123456789abc' },
  { ...scheduledFact, customerId: 'cus_FOREIGN' },
  { ...scheduledFact, mode: 'live' },
  { ...scheduledFact, proof: 'irreversible_terminal' },
  { ...scheduledFact, cancelAtPeriodEnd: false },
  { ...scheduledFact, outcome: { ...scheduledFact.outcome, status: 'canceled' } },
]) assert.throws(() => assertAdminSubscriptionFact(plan, JSON.stringify(changed)), { code: 'ADMIN_SUBSCRIPTION_FACT_UNAVAILABLE' })
console.log(JSON.stringify({ accepted: true, cases: 24, scope: 'admin plan/fact strict exact parser/source/version/digest/action namespace; no DB/provider/HTTP' }))
