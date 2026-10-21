const assert = require('node:assert/strict')
require('tsx/cjs')
const { makeSubscriptionPlan, parseSubscriptionPlan, subscriptionResources, subscriptionActionKeys } = require('../../src/lib/account-lifecycle/subscription-plan.ts')
const { parseSubscriptionOperation } = require('../../src/lib/subscription-mutation-client.ts')

const operationId = '123e4567-e89b-42d3-a456-426614174000'
const identity = { operator: { kind: 'user', id: 'actor1' }, targetUserId: 'actor1', operationId, kind: 'cancel' }
const target = { id: 'sub_one', customerId: 'cus_one', status: 'trialing', cancelAtPeriodEnd: false, currentPeriodEnd: 1900000000 }
const source = { identity, mode: 'test', email: 'actor@example.invalid', expectedCustomerId: null,
  expectedSubscriptionId: null, serviceId: 'banner', cancelMode: 'period_end', targets: [target] }
const plan = makeSubscriptionPlan(source)
assert.deepEqual(parseSubscriptionPlan(JSON.stringify(plan)), plan)
assert.equal(subscriptionResources(plan)[0].type, 'subscription_schedule_cancel')
assert.equal(subscriptionActionKeys(plan).length, 1)
const mixed = [{ ...target, id: 'sub_a' }, { ...target, id: 'sub_Z' }]
const mixedForward = makeSubscriptionPlan({ ...source, targets: mixed })
const mixedReverse = makeSubscriptionPlan({ ...source, targets: [...mixed].reverse() })
assert.deepEqual(mixedForward.targets.map(item => item.id), ['sub_Z', 'sub_a'])
assert.equal(mixedForward.inputDigest, mixedReverse.inputDigest)
assert.deepEqual(parseSubscriptionPlan(JSON.stringify(mixedReverse)), mixedForward)
assert.equal(new Set(subscriptionActionKeys(mixedForward)).size, 2)
for (const change of [
  { email: 'foreign@example.invalid' }, { mode: 'live' }, { expectedCustomerId: 'cus_other' },
  { targets: [target, target] }, { cancelMode: 'other' }, { identity: { ...identity, kind: 'checkout' } },
]) assert.throws(() => parseSubscriptionPlan(JSON.stringify({ ...plan, ...change })))

const completed = { actorId: 'actor1', operationId, kind: 'cancel', phase: 'completed', reason: null,
  canAbort: false, canContinue: false, actions: [{ subscriptionId: target.id, phase: 'confirmed', status: 'scheduled_cancel' }] }
assert.equal(parseSubscriptionOperation(completed, 'actor1', operationId, 'cancel').phase, 'completed')
for (const change of [
  { actorId: 'foreign' }, { operationId: '123e4567-e89b-42d3-a456-426614174001' },
  { phase: 'completed', actions: [{ subscriptionId: target.id, phase: 'dispatched', status: null }] },
  { kind: 'resume' },
]) assert.throws(() => parseSubscriptionOperation({ ...completed, ...change }, 'actor1', operationId, 'cancel'))
console.log('subscription plan/parser: 18 bounded assertions passed')
