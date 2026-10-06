const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const helper = load('src/lib/billing-response-client.ts');
const { parseSubscriptionStatus } = load('src/lib/subscription-status-client.ts', { './billing-response-client': helper });
const valid = { ok: true, hasSubscription: true, subscriptionId: 'sub_synthetic', status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: 2000000000 };
const results = [];
for (const status of ['active', 'trialing', 'past_due', 'unpaid']) {
  assert.equal(parseSubscriptionStatus({ ...valid, status }).currentPeriodEnd, 2000000000); results.push('Known status ' + status);
}
assert.equal(parseSubscriptionStatus({ ok: true, hasSubscription: false }).hasSubscription, false); results.push('Confirmed no contract');
for (const change of [{ ok: 'true' }, { ok: false }, { hasSubscription: 'true' }, { hasSubscription: undefined },
  { subscriptionId: '' }, { subscriptionId: ['sub_synthetic'] }, { subscriptionId: 'sub private' }, { status: 'canceled' },
  { status: 'UNKNOWN' }, { cancelAtPeriodEnd: 'false' }, { cancelAtPeriodEnd: undefined }, { currentPeriodEnd: '2000000000' },
  { currentPeriodEnd: 0 }, { currentPeriodEnd: -1 }, { currentPeriodEnd: 2000000000.5 }, { currentPeriodEnd: Infinity },
  { currentPeriodEnd: Number.MAX_SAFE_INTEGER }, { error: 'private diagnostic' }, { code: 'ERROR' }]) {
  assert.throws(() => parseSubscriptionStatus({ ...valid, ...change }), error => !error.message.includes('private'));
  results.push('Reject inconsistent contract ' + JSON.stringify(change));
}
for (const change of [{ subscriptionId: 'sub_synthetic' }, { status: 'active' }, { cancelAtPeriodEnd: false }, { currentPeriodEnd: 2000000000 }]) {
  assert.throws(() => parseSubscriptionStatus({ ok: true, hasSubscription: false, ...change })); results.push('Reject contradictory no-contract snapshot');
}
console.log(JSON.stringify({ passed: results.length, results, scope: 'Actual strict client status parser with synthetic payloads only; malformed responses never become no contract or a confirmed cancellation date. No Stripe/network/DB.' }));
