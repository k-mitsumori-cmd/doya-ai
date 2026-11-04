const { root: seatRepo, seatSourcePath, evidenceDir } = require('./seat-regression-support.cjs');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const repo = seatRepo;
const { load } = require(repo + '/scripts/security-regression/load-typescript.cjs');
const proofModule = load('src/lib/pricing-v2/seat-reconciliation-proof.ts');
const rules = load('src/lib/doya-power/rules.ts');
const priceEnv = { STRIPE_PRICE_TEAM_BASE_MONTHLY: 'price_base_m', STRIPE_PRICE_TEAM_BASE_YEARLY: 'price_base_y', STRIPE_PRICE_TEAM_SEAT_MONTHLY: 'price_seat_m', STRIPE_PRICE_TEAM_SEAT_YEARLY: 'price_seat_y' };
function readerFor(env = priceEnv) {
  return load('src/lib/pricing-v2/seat-reconciliation.server.ts', {
    '@/lib/stripe': { stripe: {} }, '@/lib/doya-power/rules': rules,
    './prices': load('src/lib/pricing-v2/prices.ts', {}, { process: { env } }),
    './seat-reconciliation-proof': proofModule,
  });
}
function fixture(direction = 'up', start = Date.UTC(2026, 10, 15)) {
  const to = direction === 'up' ? 6 : 3;
  const claim = { companyId: 'synthetic-company', token: 'synthetic-token', active: {
    phase: 'stripe', operationKey: 'synthetic-operation-0001', requested: to,
    token: 'synthetic-token', leaseUntil: start + 300000, firstSentAt: start,
    idempotencyKey: 'synthetic-stripe-key', request: {
      subscriptionId: 'sub_synthetic', seatItemId: 'si_synthetic', from: 5, to,
      direction, interval: 'month', used: 3, status: 'active', grantPoints: direction === 'up', pointsAt: start,
    },
  } };
  const subscription = { id: 'sub_synthetic', object: 'subscription', customer: 'cus_synthetic', livemode: true,
    status: 'active', pending_update: null, latest_invoice: 'in_synthetic',
    items: { has_more: false, data: [{ id: 'si_synthetic', quantity: to, price: { id: 'price_seat_m', currency: 'jpy' } }] },
  };
  const event = { id: 'evt_synthetic', object: 'event', type: 'customer.subscription.updated', livemode: true,
    created: Math.floor(start / 1000) + 5, request: { id: 'req_synthetic', idempotency_key: claim.active.idempotencyKey },
    data: { object: structuredClone(subscription), previous_attributes: { items: { data: [{ id: 'si_synthetic', quantity: 5 }] } } },
  };
  const invoice = { id: 'in_synthetic', object: 'invoice', subscription: 'sub_synthetic', customer: 'cus_synthetic',
    livemode: true, currency: 'jpy', billing_reason: 'subscription_update', status: 'paid', paid: true,
    amount_paid: 500, amount_remaining: 0, created: Math.floor(start / 1000) + 4,
    lines: { has_more: false, data: [{ subscription_item: 'si_synthetic', subscription: 'sub_synthetic',
      price: { id: 'price_seat_m' }, proration: true, quantity: 1, amount: 500, currency: 'jpy', livemode: true }] },
  };
  return { claim, event, subscription, invoice, seatPriceId: 'price_seat_m', now: start + 21 * 3600000 };
}
const results = [];
function pure(name, mutate, expected) {
  const f = fixture(); if (mutate) mutate(f);
  const actual = proofModule.classifySeatReconciliation(f); assert.equal(actual.ok, expected, name);
  results.push({ name, layer: 'pure-proof', ready: actual.ok });
}
pure('exact-paid-upgrade-event-and-current-quantity', null, true);
pure('paid-zero-invoice-covered-by-existing-credit', f => { f.invoice.amount_paid = 0; f.invoice.lines.data[0].amount = 0; }, true);
for (const [name, mutate] of [
  ['wrong-event-type', f => { f.event.type = 'invoice.paid'; }],
  ['wrong-event-id', f => { f.event.id = 'not-an-event'; }],
  ['different-operation-key', f => { f.event.request.idempotency_key = 'another-key'; }],
  ['missing-operation-key', f => { f.event.request = null; }],
  ['connected-account-event-not-this-account', f => { f.event.account = 'acct_other'; }],
  ['event-before-operation', f => { f.event.created -= 10; }],
  ['key-reused-after-original-20h-window', f => { f.event.created += 25 * 3600; f.now += 25 * 3600000; }],
  ['event-in-the-future', f => { f.event.created = Math.floor(f.now / 1000) + 10; }],
  ['missing-previous-quantity', f => { delete f.event.data.previous_attributes; }],
  ['wrong-previous-quantity', f => { f.event.data.previous_attributes.items.data[0].quantity = 10; }],
  ['wrong-previous-item', f => { f.event.data.previous_attributes.items.data[0].id = 'si_other'; }],
  ['different-subscription', f => { f.subscription.id = 'sub_other'; }],
  ['different-event-subscription', f => { f.event.data.object.id = 'sub_other'; }],
  ['different-customer', f => { f.subscription.customer = 'cus_other'; }],
  ['test-live-mode-mismatch', f => { f.event.livemode = false; }],
  ['canceled-current-subscription', f => { f.subscription.status = 'canceled'; }],
  ['another-pending-subscription-update', f => { f.subscription.pending_update = { expires_at: 1 }; }],
  ['current-quantity-changed-again', f => { f.subscription.items.data[0].quantity = 7; }],
  ['event-quantity-not-requested', f => { f.event.data.object.items.data[0].quantity = 5; }],
  ['wrong-current-price', f => { f.subscription.items.data[0].price.id = 'price_other'; }],
  ['unknown-currency', f => { f.subscription.items.data[0].price.currency = 'usd'; }],
  ['truncated-current-items', f => { f.subscription.items.has_more = true; }],
  ['truncated-event-items', f => { f.event.data.object.items.has_more = true; }],
  ['duplicate-seat-item', f => { f.subscription.items.data.push(structuredClone(f.subscription.items.data[0])); }],
  ['missing-invoice', f => { delete f.invoice; }],
  ['unpaid-invoice', f => { f.invoice.status = 'open'; f.invoice.paid = false; }],
  ['remaining-invoice-balance', f => { f.invoice.amount_remaining = 1; }],
  ['different-invoice', f => { f.invoice.id = 'in_other'; }],
  ['invoice-of-other-subscription', f => { f.invoice.subscription = 'sub_other'; }],
  ['invoice-of-other-customer', f => { f.invoice.customer = 'cus_other'; }],
  ['invoice-mode-mismatch', f => { f.invoice.livemode = false; }],
  ['unrelated-renewal-invoice', f => { f.invoice.billing_reason = 'subscription_cycle'; }],
  ['invoice-from-before-attempt', f => { f.invoice.created -= 100; }],
  ['invoice-newer-than-event', f => { f.invoice.created += 100; }],
  ['truncated-invoice-lines', f => { f.invoice.lines.has_more = true; }],
  ['invoice-line-of-another-seat-item', f => { f.invoice.lines.data[0].subscription_item = 'si_other'; }],
  ['invoice-line-of-another-subscription', f => { f.invoice.lines.data[0].subscription = 'sub_other'; }],
  ['invoice-line-of-another-price', f => { f.invoice.lines.data[0].price.id = 'price_other'; }],
  ['invoice-line-is-not-proration', f => { f.invoice.lines.data[0].proration = false; }],
  ['negative-credit-line-alone-is-not-upgrade-payment-proof', f => { f.invoice.lines.data[0].amount = -500; }],
  ['invalid-clock', f => { f.now = NaN; }],
]) pure(name, mutate, false);
{
  const f = fixture('down'); delete f.invoice;
  assert.equal(proofModule.classifySeatReconciliation(f).ok, true);
  results.push({ name: 'exact-downsize-needs-no-new-invoice', layer: 'pure-proof', ready: true });
}
function sourceFor(f, options = {}) {
  const calls = [], pages = options.pages || [{ data: [f.event], has_more: false }]; let page = 0;
  const source = {
    subscriptions: { retrieve: async id => { calls.push('subscription'); assert.equal(id, f.claim.active.request.subscriptionId); if (options.providerFailure) throw Error('SYNTHETIC_UNAVAILABLE'); return structuredClone(f.subscription); } },
    events: { list: async query => { calls.push('events'); assert.equal(query.limit, 100); assert.equal(query.type, 'customer.subscription.updated'); assert.equal(query.created.lte - query.created.gte, 20 * 3600 + 1); return structuredClone(pages[Math.min(page++, pages.length - 1)]); } },
    invoices: { retrieve: async id => { calls.push('invoice'); const value = structuredClone(f.invoice); value.id = id; return value; } },
  };
  return { source, calls };
}
async function reader(name, f, options, ready, reason, config) {
  const test = sourceFor(f, options);
  const result = await readerFor(config).readSeatReconciliationEvidence(f.claim, test.source, f.now);
  assert.equal(result.ready, ready, name); if (reason) assert.equal(result.reason, reason, name);
  assert.equal(result.getRequests, test.calls.length); assert(test.calls.length <= 8);
  results.push({ name, layer: 'bounded-read-only-retrieval', ready: result.ready, syntheticGets: test.calls.length });
}
(async () => {
  await reader('read-only-upgrade-evidence', fixture(), {}, true);
  await reader('read-only-downsize-evidence', fixture('down'), {}, true);
  await reader('empty-events-do-not-prove-failure', fixture(), { pages: [{ data: [], has_more: false }] }, false, 'NO_MATCHING_EVENT');
  await reader('scan-limit-does-not-prove-failure', fixture(), { pages: [{ data: [{ ...fixture().event, request: null }], has_more: true }] }, false, 'EVENT_SCAN_LIMIT');
  await reader('empty-page-with-more-is-uncertain', fixture(), { pages: [{ data: [], has_more: true }] }, false, 'INVALID_EVENT_PAGE');
  await reader('provider-unavailable-is-uncertain', fixture(), { providerFailure: true }, false, 'PROVIDER_UNAVAILABLE');
  { const f = fixture(); f.invoice.paid = false; await reader('unpaid-invoice-remains-pending', f, {}, false, 'PAYMENT_NOT_PROVEN'); }
  { const f = fixture(); f.now = f.claim.active.firstSentAt + 19 * 3600000; await reader('no-reads-before-recovery-window', f, {}, false, 'OPERATION_NOT_SETTLED'); }
  { const f = fixture(); f.claim.active.leaseUntil = f.now + 1; await reader('active-worker-is-not-stolen', f, {}, false, 'OPERATION_NOT_SETTLED'); }
  { const f = fixture(); f.now = f.claim.active.firstSentAt + 29 * 86400000; await reader('event-retention-bound-needs-human-review', f, {}, false, 'EVENT_RETENTION_REVIEW_REQUIRED'); }
  {
    const f = fixture('up', Date.UTC(2027, 0, 31, 14, 59, 59)); f.now = Date.UTC(2027, 1, 28, 15, 0, 1);
    await reader('expired-point-entitlement-needs-human-review', f, {}, false, 'POINT_ENTITLEMENT_REVIEW_REQUIRED');
  }
  await reader('missing-price-config-makes-no-reads', fixture(), {}, false, 'PRICE_CONFIG_UNAVAILABLE', {});
  {
    const f = fixture(); f.invoice.paid = false;
    const events = ['alpha','beta','gamma'].map(name => { const event = structuredClone(f.event); event.id = 'evt_' + name; event.data.object.latest_invoice = 'in_' + name; return event; });
    await reader('invoice-read-cap-keeps-uncertain-operation', f, { pages: [{ data: events, has_more: false }] }, false, 'INVOICE_SCAN_LIMIT');
  }
  const names = ['src/lib/pricing-v2/seat-reconciliation-proof.ts', 'src/lib/pricing-v2/seat-reconciliation.server.ts'];
  fs.writeFileSync(evidenceDir + '/reconciliation-evidence-result.json', JSON.stringify({ checkedAt: new Date().toISOString(), count: results.length, results, actualCandidatePureClassifierAndReader: true, stripeResponsesSynthetic: true, realStripeApiRequests: 0, databaseWrites: 0, recoveryTransitionsIntegrated: false, sourceHashes: Object.fromEntries(names.map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(seatSourcePath(name))).digest('hex')])) }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: results.length, realStripeApiRequests: 0, databaseWrites: 0 }));
})().catch(e => { console.error(e); process.exitCode = 1; });
