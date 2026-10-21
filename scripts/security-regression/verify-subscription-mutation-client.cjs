const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const parser = load('src/lib/subscription-mutation-client.ts', {
  './billing-response-client': { BillingResponseError: class BillingResponseError extends Error {} },
})
const operationId = '123e4567-e89b-42d3-a456-426614174000', actorId = 'actor1'
const action = { subscriptionId: 'sub_one', phase: 'confirmed', status: 'scheduled_cancel' }
const valid = { actorId, operationId, kind: 'cancel', phase: 'completed', reason: null, canAbort: false, canContinue: false, actions: [action] }
let count = 0
for (const kind of ['cancel', 'resume']) {
  const good = { ...valid, kind, actions: [{ ...action, status: kind === 'cancel' ? 'scheduled_cancel' : 'resumed' }] }
  assert.equal(parser.parseSubscriptionOperation(good, actorId, operationId, kind).phase, 'completed'); count++
  for (const bad of [
    {}, { ...good, actorId: 'foreign' }, { ...good, operationId: 'bad' }, { ...good, kind: kind === 'cancel' ? 'resume' : 'cancel' },
    { ...good, error: 'private' }, { ...good, code: 'FAILED' }, { ...good, canAbort: true },
    { ...good, canContinue: true }, { ...good, actions: [{ ...action, subscriptionId: [] }] },
    { ...good, actions: [{ ...action, status: null }] },
  ]) { assert.throws(() => parser.parseSubscriptionOperation(bad, actorId, operationId, kind)); count++ }
}
for (const bad of [
  { ...valid, actions: [] },
  { ...valid, actions: [{ ...action, phase: 'dispatched', status: null }] },
  { ...valid, actions: [action, action] },
  { ...valid, actions: [{ ...action, private: true }] },
  { ...valid, actions: [{ ...action, subscriptionId: 'foreign' }] },
  { ...valid, actions: [{ ...action, phase: 'planned', status: null }] },
  { ...valid, phase: 'reserved', actions: [action] },
  { ...valid, phase: 'missing', actions: [action] },
  { ...valid, reason: 'arbitrary' },
  { ...valid, actions: [{ ...action, status: 123 }] },
  { ...valid, actions: [{ ...action, subscriptionId: 'sub_other' }, { ...action, subscriptionId: 'sub_other' }] },
]) { assert.throws(() => parser.parseSubscriptionOperation(bad, actorId, operationId, 'cancel')); count++ }
assert.equal(parser.parseSubscriptionOperation({ ...valid, actions: [action, { ...action, subscriptionId: 'sub_two' }] }, actorId, operationId, 'cancel').actions.length, 2); count++
console.log(JSON.stringify({ passed: count, scope: 'actual operation parser; actor/canonical identity, all-target completion, partial and private-error rejection' }))
