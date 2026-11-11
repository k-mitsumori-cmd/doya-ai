const { root: seatRepo, seatSourcePath, evidenceDir } = require('./seat-regression-support.cjs');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const repo = seatRepo;
const { load } = require(repo + '/scripts/security-regression/load-typescript.cjs');
const { PrismaClient, Prisma } = require(repo + '/node_modules/@prisma/client');
const privateEnv = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), privateState = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const url = privateEnv.DATABASE_URL, parsed = new URL(url);
assert(parsed.searchParams.get('host') === privateState.socket && privateState.socket.startsWith('/tmp/doya-') && ['localhost', '127.0.0.1'].includes(parsed.hostname));
const raw = new PrismaClient({ datasources: { db: { url } } });
assert(/^\/doya_seat_models_[0-9]+$/.test(parsed.pathname), 'OWNED_MODEL_DATABASE_REQUIRED');
const actualDate = Date, baselineNow = Date.now() + 60000, clock = { now: baselineNow };
class ClockDate extends actualDate { constructor(...args) { super(...(args.length ? args : [clock.now])); } static now() { return clock.now; } }
const globals = { Date: ClockDate, process: { env: { NEXTAUTH_URL: 'https://synthetic.invalid', STRIPE_PRICE_TEAM_BASE_MONTHLY: 'price_base_m', STRIPE_PRICE_TEAM_BASE_YEARLY: 'price_base_y', STRIPE_PRICE_TEAM_SEAT_MONTHLY: 'price_seat_m', STRIPE_PRICE_TEAM_SEAT_YEARLY: 'price_seat_y' } } };
const companyId = 'synthetic-company', owner = { id: 'synthetic-owner', email: 'owner@example.invalid', stripeCustomerId: 'cus_synthetic', stripePriceId: 'price_base_m', plan: 'PRO' };
const company = { id: companyId, name: 'Synthetic', userId: owner.id, user: owner };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let state;
const cacheSeats = async () => (await raw.accountCompanyBilling.findUnique({ where: { companyId } })).seats;
const rows = db => db.accountCompanyMember.findMany({ where: { companyId, status: { in: ['active', 'invited'] } } });
function wrap(client) {
  return new Proxy(client, { get(target, key) {
    if (key === '$transaction') return (fn, options) => target.$transaction(tx => fn(wrap(tx)), options);
    const value = target[key];
    if (['accountCompanyBilling', 'accountCompanyMember', 'doyaPowerAccount'].includes(key)) return new Proxy(value, { get(model, method) {
      const fn = model[method]; if (typeof fn !== 'function') return fn;
      return async (...args) => {
        if (key === 'accountCompanyBilling' && method === 'upsert' && state.failCacheOnce && state.effectiveStripeWrites > 0) { state.failCacheOnce = false; throw Error('SYNTHETIC_CACHE_FAILURE'); }
        if (key === 'accountCompanyMember' && method === 'updateMany' && args[0].data.status === 'active' && state.beforeAcceptUpdate) await state.beforeAcceptUpdate();
        const result = await fn.apply(model, args);
        if (key === 'doyaPowerAccount' && method === 'findUnique') {
          state.ledgerAccountReads = (state.ledgerAccountReads || 0) + 1;
          if (state.beforeLedgerAccountRead) { const callback = state.beforeLedgerAccountRead; state.beforeLedgerAccountRead = null; await callback(); }
        }
        return result;
      };
    } });
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}
const db = wrap(raw);
const plans = load('src/lib/pricing-v2/plans.ts', {}, globals);
const team = load('src/lib/pricing-v2/team.ts', { './plans': plans }, globals);
const prices = load('src/lib/pricing-v2/prices.ts', {}, globals);
const seatView = load('src/lib/pricing-v2/seat-operation-view.ts', { './plans': plans, './team': team }, globals);
const unified = load('src/lib/unified-plan.ts', {}, globals);
const view = load('src/lib/pricing-v2/view.ts', { '@/lib/unified-plan': unified }, globals);
const powerRules = load('src/lib/doya-power/rules.ts', {}, globals);
const core = load('src/lib/pricing-v2/seat-operation.ts', { 'node:crypto': crypto, '@/lib/prisma': { prisma: db }, './team': team }, globals);
const rollout = { isNewPricingEnabledFor: () => true, newPricingRollout: () => 'all' };
const subscription = () => ({ id: 'sub_synthetic', object: 'subscription', customer: 'cus_synthetic', livemode: false, status: state.currentStatus || 'active', collection_method: state.collectionMethod || 'charge_automatically', pending_update: null, latest_invoice: state.latestInvoice, items: { has_more: false, data: [{ id: 'si_synthetic', quantity: state.purchased, price: { id: state.currentInterval === 'year' ? 'price_seat_y' : 'price_seat_m', currency: 'jpy' } }] } });
const stripe = { subscriptions: {
  retrieve: async id => ({ ...subscription(), id }),
  update: async (_, params, options) => {
    state.stripeAttempts++; state.keys.push(options.idempotencyKey);
    if (state.beforeStripeUpdate) await state.beforeStripeUpdate();
    if (state.cardError) throw { type: 'StripeCardError' };
    if (state.responses.has(options.idempotencyKey)) return state.responses.get(options.idempotencyKey);
    if (state.mismatch) return subscription();
    const from = state.purchased;
    state.purchased = params.items[0].quantity; state.effectiveStripeWrites++;
    if (state.purchased > from) {
      state.latestInvoice = 'in_change' + state.effectiveStripeWrites;
      state.invoices.set(state.latestInvoice, { id: state.latestInvoice, object: 'invoice', subscription: 'sub_synthetic', customer: 'cus_synthetic', livemode: false, currency: 'jpy', billing_reason: 'subscription_update', status: 'paid', paid: true, amount_paid: 500, amount_remaining: 0, created: Math.floor(clock.now / 1000), lines: { has_more: false, data: [{ subscription_item: 'si_synthetic', subscription: 'sub_synthetic', price: { id: 'price_seat_m' }, proration: true, amount: 500, currency: 'jpy', livemode: false }] } });
    }
    const result = subscription(); state.responses.set(options.idempotencyKey, result);
    state.events.push({ id: 'evt_change' + state.effectiveStripeWrites, object: 'event', type: 'customer.subscription.updated', created: Math.floor(clock.now / 1000), livemode: false, request: { idempotency_key: options.idempotencyKey }, data: { object: structuredClone(result), previous_attributes: { items: { data: [{ id: 'si_synthetic', quantity: from }] } } } });
    if (state.lostOnce) { state.lostOnce = false; throw Error('SYNTHETIC_LOST_RESPONSE'); }
    return result;
  },
} };
stripe.events = { list: async query => { state.evidenceReads++; return { data: state.events.filter(event => event.created >= query.created.gte && event.created <= query.created.lte), has_more: false }; } };
stripe.invoices = { retrieve: async id => { state.evidenceReads++; if (state.beforeInvoiceEvidenceRead) { const callback = state.beforeInvoiceEvidenceRead; state.beforeInvoiceEvidenceRead = null; await callback(); } const invoice = state.invoices.get(id); if (!invoice) throw Error('NO_SYNTHETIC_INVOICE'); return structuredClone(invoice); } };
const reconciliationProof = load('src/lib/pricing-v2/seat-reconciliation-proof.ts', {}, globals);
const reconciliationReader = load('src/lib/pricing-v2/seat-reconciliation.server.ts', { '@/lib/stripe': { stripe }, '@/lib/doya-power/rules': powerRules, './prices': prices, './seat-reconciliation-proof': reconciliationProof }, globals);

// Keep the real company/tool identity collector and minimum in this SQL suite.
const seatUsage = load('src/lib/pricing-v2/company-seat-usage.ts', {}, globals);
const roleDefinitions = load('src/lib/company-roles/roles.ts', {}, globals);
const toolRoles = load('src/lib/company-roles/tool-roles.ts', { './roles': roleDefinitions }, globals);
const uiNext = load('src/lib/ui-next.ts', {}, globals);
const roleRollout = load('src/lib/company-roles/rollout.ts', { '@/lib/ui-next': uiNext }, globals);
const kintaiToken = load('src/lib/kintai/invite-token.ts', {}, globals);
const seatEntries = load('src/lib/pricing-v2/company-seat-entries.server.ts', { '@/lib/company-roles/rollout': roleRollout, '@/lib/company-roles/tool-roles': toolRoles, '@/lib/kintai/invite-token': kintaiToken, './company-seat-usage': seatUsage }, globals);
const seatUsers = load('src/lib/pricing-v2/company-seat-usage-users.server.ts', { '@prisma/client': { Prisma }, './company-seat-usage': seatUsage }, globals);
const minimum = load('src/lib/pricing-v2/company-seat-minimum.server.ts', { './company-seat-entries.server': seatEntries, './company-seat-usage-users.server': seatUsers }, globals);
const checkoutCapacity = load('src/lib/pricing-v2/checkout-seat-capacity.server.ts', {}, globals);
const inviteRole = load('src/lib/pricing-v2/company-invite-role.ts', {}, globals);

const server = load('src/lib/pricing-v2/team.server.ts', {
  '@/lib/prisma': { prisma: db }, '@/lib/stripe': { stripe, findActiveLikeSubscriptions: async () => { if (state.contractLookupFails) throw Error('SYNTHETIC_CONTRACT_LOOKUP_FAILURE'); return state.contractAvailable === false ? [] : [{ id: state.currentSubscriptionId || 'sub_synthetic', planId: 'team-pro' }]; } },
  '@/lib/unified-plan': unified, './rollout': rollout, './plans': plans, './prices': prices, './view': view, './team': team, './seat-operation': core, './company-seat-minimum.server': minimum,
}, globals);
const membership = load('src/lib/pricing-v2/company-membership-seat.server.ts', { '@prisma/client': { Prisma }, './team.server': server, './company-seat-minimum.server': minimum, './checkout-seat-capacity.server': checkoutCapacity }, globals);
const ledgerModule = load('src/lib/doya-power/ledger.ts', { '@/lib/unified-plan': unified, './rules': powerRules }, globals);
const gateModule = load('src/lib/doya-power/gate.ts', { './ledger': ledgerModule }, globals);
const serverForLedger = { ...server, newPricingMonthlyGrant: async id => {
  const amount = await server.newPricingMonthlyGrant(id);
  if (state.afterMonthlyPreflight) { const callback = state.afterMonthlyPreflight; state.afterMonthlyPreflight = null; await callback(amount); }
  return amount;
} };
const actualPower = load('src/lib/doya-power/index.ts', {
  '@/lib/prisma': { prisma: db }, '@/lib/unified-plan': unified,
  './flag': { doyaPowerLedgerAllowed: () => true }, './gate': gateModule,
  '@/lib/pricing-v2/team.server': serverForLedger, './rules': powerRules,
}, globals);
function route(name, actor = owner) {
  return load(name, {
    'node:crypto': crypto, 'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { id: actor.id, email: actor.email } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: db }, '@/lib/stripe': { stripe },
    '@/lib/pricing-v2/company-seat-minimum.server': minimum, '@/lib/pricing-v2/company-membership-seat.server': membership, '@/lib/pricing-v2/company-invite-role': inviteRole,
    '@/lib/pricing-v2/rollout': rollout, '@/lib/pricing-v2/prices': prices, '@/lib/pricing-v2/view': view, '@/lib/pricing-v2/team': team, '@/lib/pricing-v2/plans': plans, '@/lib/pricing-v2/team.server': server, '@/lib/pricing-v2/seat-operation': { ...core, withSeatRevocation: async (...args) => { if (state.beforeAdmission) { const hook = state.beforeAdmission; state.beforeAdmission = null; await hook(); } return core.withSeatRevocation(...args); }, withSeatAdmission: async (...args) => { if (state.beforeAdmission) { const hook = state.beforeAdmission; state.beforeAdmission = null; await hook(); } return core.withSeatAdmission(...args); } }, '@/lib/pricing-v2/seat-reconciliation.server': reconciliationReader,
    '@/lib/doya-power/flag': { doyaPowerLedgerAllowed: () => Boolean(state.ledger) },
    '@/lib/doya-power/rules': powerRules,
    '@/lib/doya-power': {
      grantMonthlyForPlan: actualPower.grantMonthlyForPlan,
      grant: async (...args) => {
        const opts = args[4] || {}, isMonthly = opts.sourceKey?.startsWith('monthly:');
        if (isMonthly) { state.monthly++; assert.equal(await cacheSeats(), 5); }
        else {
          state.grantCalls.push({ amount: args[2], sourceKey: opts.sourceKey, expiresAt: args[3]?.toISOString() ?? null });
          if (state.failGrantOnce) { state.failGrantOnce = false; return { ok: false, reason: 'synthetic_failure' }; }
        }
        const result = await actualPower.grant(...args);
        if (!isMonthly && result.ok) state.grants.add(opts.sourceKey);
        if (isMonthly && state.afterOwnMonthlyGrant) { const callback = state.afterOwnMonthlyGrant; state.afterOwnMonthlyGrant = null; await callback(); }
        return result;
      },
    },
    '@/lib/notifications': { sendEventNotification: async () => { state.notifications++; } },
  }, globals);
}
const member = route('src/app/api/pricing/members/route.ts');
const seats = route('src/app/api/pricing/seats/route.ts');
const accept = route('src/app/api/pricing/members/accept/route.ts', { id: 'synthetic-invitee', email: 'invitee@example.invalid' });
const change = (quantity = 3, operationKey = 'synthetic-operation-0001') => seats.POST({ json: async () => ({ seats: quantity, operationKey }) });
const invite = () => member.POST({ json: async () => ({ email: 'new@example.invalid', role: 'member' }) });
const used = async () => team.seatsUsed({ ownerUserId: owner.id, ownerEmail: owner.email, members: await rows(raw) });
async function reset() {
  state = { purchased: 5, stripeAttempts: 0, effectiveStripeWrites: 0, responses: new Map(), keys: [], notifications: 0, monthly: 0, grantCalls: [], grants: new Set(), ledgerAccountReads: 0, events: [], invoices: new Map(), latestInvoice: 'in_previous', evidenceReads: 0 };
  clock.now = baselineNow;
  await raw.systemSetting.deleteMany();
  await raw.user.deleteMany({ where: { id: { in: [owner.id, 'synthetic-invitee', 'former-email-owner'] } } });
  await raw.user.create({ data: owner });
  await raw.user.create({ data: { id: 'synthetic-invitee', email: 'invitee@example.invalid', plan: 'FREE' } });
  await raw.accountCompany.create({ data: { id: companyId, userId: owner.id, name: 'Synthetic' } });
  await raw.accountCompanyBilling.create({ data: { companyId, seats: 5, checkedAt: new actualDate(clock.now), stripeSubscriptionId: 'sub_synthetic', billingInterval: 'month' } });
  for (const n of [1, 2]) await raw.accountCompanyMember.create({ data: { id: 'member-' + n, companyId, email: `member${n}@example.invalid`, role: 'member', status: 'active', invitedAt: new actualDate(clock.now) } });
}
const cases = [];
async function check(name, fn) { await reset(); await fn(); assert(await used() <= state.purchased, name + ': member count exceeds purchased seats'); cases.push(name); console.log('PASS coordinated route SQL: ' + name); }
(async () => {
  try {


    await check('stale-session-email-cannot-claim-invite-after-database-email-change', async () => {
      await raw.accountCompanyMember.create({ data: { id: 'email-pending', companyId, email: 'invitee@example.invalid', role: 'member', status: 'invited', invitedAt: new actualDate(clock.now), inviteToken: 'email-token' } });
      await raw.user.update({ where: { id: 'synthetic-invitee' }, data: { email: 'changed@example.invalid' } });
      assert.equal((await accept.POST({ json: async () => ({ token: 'email-token' }) })).status, 404);
      const row = await raw.accountCompanyMember.findUnique({ where: { id: 'email-pending' } }); assert.equal(row.status, 'invited'); assert.equal(row.userId, null); assert.equal(row.inviteToken, 'email-token'); assert.equal(state.stripeAttempts, 0);
    });
    await check('database-current-email-can-join-with-stale-session-email', async () => {
      await raw.accountCompanyMember.create({ data: { id: 'email-pending', companyId, email: 'changed@example.invalid', role: 'member', status: 'invited', invitedAt: new actualDate(clock.now), inviteToken: 'email-token' } });
      await raw.user.update({ where: { id: 'synthetic-invitee' }, data: { email: 'changed@example.invalid' } });
      assert.equal((await accept.POST({ json: async () => ({ token: 'email-token' }) })).status, 200); assert.equal((await raw.accountCompanyMember.findUnique({ where: { id: 'email-pending' } })).userId, 'synthetic-invitee'); assert.equal(state.stripeAttempts, 0);
    });
    await check('database-account-without-email-cannot-claim-invite', async () => {
      await raw.accountCompanyMember.create({ data: { id: 'email-pending', companyId, email: 'invitee@example.invalid', role: 'member', status: 'invited', invitedAt: new actualDate(clock.now), inviteToken: 'email-token' } });
      await raw.user.update({ where: { id: 'synthetic-invitee' }, data: { email: null } });
      assert.equal((await accept.POST({ json: async () => ({ token: 'email-token' }) })).status, 404); assert.equal((await raw.accountCompanyMember.findUnique({ where: { id: 'email-pending' } })).status, 'invited');
    });
    await check('database-email-change-before-company-guard-is-rejected', async () => {
      await raw.accountCompanyMember.create({ data: { id: 'email-pending', companyId, email: 'invitee@example.invalid', role: 'member', status: 'invited', invitedAt: new actualDate(clock.now), inviteToken: 'email-token' } });
      state.beforeAdmission = () => raw.user.update({ where: { id: 'synthetic-invitee' }, data: { email: 'changed@example.invalid' } });
      assert.equal((await accept.POST({ json: async () => ({ token: 'email-token' }) })).status, 404); assert.equal((await raw.accountCompanyMember.findUnique({ where: { id: 'email-pending' } })).status, 'invited'); assert.equal(state.stripeAttempts, 0);
    });
    await check('concurrent-email-writer-waits-until-authorized-membership-commit', async () => {
      await raw.accountCompanyMember.create({ data: { id: 'email-pending', companyId, email: 'invitee@example.invalid', role: 'member', status: 'invited', invitedAt: new actualDate(clock.now), inviteToken: 'email-token' } });
      let changing, done = false, observedWait = false;
      state.beforeAcceptUpdate = async () => {
        changing = raw.user.update({ where: { id: 'synthetic-invitee' }, data: { email: 'changed@example.invalid' } }).then(value => { done = true; return value; });
        const until = actualDate.now() + 3000;
        while (actualDate.now() < until) {
          assert.equal(done, false, 'ACCOUNT_EMAIL_ROW_MUST_REMAIN_LOCKED_THROUGH_ACTIVATION');
          const rows = await raw.$queryRaw`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND wait_event IN ('transactionid','tuple')`;
          if (rows[0].n > 0) { observedWait = true; break; }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        assert(observedWait, 'Actual private PostgreSQL user-row wait required');
      };
      let response;
      try { response = await accept.POST({ json: async () => ({ token: 'email-token' }) }); } finally { if (changing) await changing; }
      assert.equal(response.status, 200); assert(observedWait); assert.equal((await raw.user.findUnique({ where: { id: 'synthetic-invitee' } })).email, 'changed@example.invalid'); assert.equal((await raw.accountCompanyMember.findUnique({ where: { id: 'email-pending' } })).status, 'active'); assert.equal(state.stripeAttempts, 0);
    });
    await check('parallel-same-valid-invite-activates-one-current-account', async () => {
      await raw.accountCompanyMember.create({ data: { id: 'email-pending', companyId, email: 'invitee@example.invalid', role: 'member', status: 'invited', invitedAt: new actualDate(clock.now), inviteToken: 'email-token' } });
      const responses = await Promise.all([1, 2].map(() => accept.POST({ json: async () => ({ token: 'email-token' }) })));
      const statuses = responses.map(response => response.status).sort();
      assert.equal(statuses[0], 200); assert([404, 409].includes(statuses[1]), 'Only one accept may succeed; consumed or concurrently coordinated request must be denied');
      assert.equal(await raw.accountCompanyMember.count({ where: { companyId, userId: 'synthetic-invitee', status: 'active' } }), 1); assert.equal(state.stripeAttempts, 0);
    });
    for (const purchased of [5, 6]) {
      await check('reassigned-stale-email-capacity-' + purchased + '-checks-activated-account-ids', async () => {
        await raw.user.create({ data: { id: 'former-email-owner', email: 'moved@example.invalid', plan: 'FREE' } });
        await raw.accountCompanyMember.create({ data: { id: 'former-case-email-row', companyId, email: 'INVITEE@EXAMPLE.INVALID', userId: 'former-email-owner', role: 'member', status: 'active', invitedAt: new actualDate(clock.now) } });
        await raw.accountCompanyMember.create({ data: { id: 'filler', companyId, email: 'filler@example.invalid', role: 'member', status: 'active', invitedAt: new actualDate(clock.now) } });
        await raw.accountCompanyMember.create({ data: { id: 'reassigned-pending', companyId, email: 'invitee@example.invalid', role: 'member', status: 'invited', invitedAt: new actualDate(clock.now), inviteToken: 'reassigned-email-token' } });
        state.purchased = purchased; await raw.accountCompanyBilling.update({ where: { companyId }, data: { seats: purchased } });
        const response = await accept.POST({ json: async () => ({ token: 'reassigned-email-token' }) });
        assert.equal(response.status, purchased === 5 ? 409 : 200);
        const body = await response.json(), pending = await raw.accountCompanyMember.findUnique({ where: { id: 'reassigned-pending' } });
        if (purchased === 5) {
          assert.equal(body.code, 'NO_SEAT'); assert.equal(pending.status, 'invited'); assert.equal(pending.userId, null); assert.equal(pending.inviteToken, 'reassigned-email-token');
        } else {
          assert.equal(pending.status, 'active'); assert.equal(pending.userId, 'synthetic-invitee'); assert.equal(pending.inviteToken, null); assert.equal(await used(), 6);
        }
        const previous = await raw.accountCompanyMember.findUnique({ where: { id: 'former-case-email-row' } });
        assert.equal(previous.userId, 'former-email-owner'); assert.equal(previous.email, 'INVITEE@EXAMPLE.INVALID'); assert.equal(previous.role, 'member');
        assert.equal(state.stripeAttempts, 0); assert.equal(state.notifications, 0);
      });
    }
    for (const email of ['invitee@example.invalid', 'INVITEE@EXAMPLE.INVALID']) {
      await check('active-account-current-email-reinvite-does-not-reserve-another-seat-' + email, async () => {
        await raw.accountCompanyMember.create({ data: { id: 'reinvite-existing-account', companyId, email: 'previous@example.invalid', userId: 'synthetic-invitee', role: 'member', status: 'active', invitedAt: new actualDate(clock.now) } });
        const before = await raw.accountCompanyMember.count({ where: { companyId } });
        const response = await member.POST({ json: async () => ({ email, role: 'admin' }) });
        assert.equal(response.status, 409); assert.equal((await response.json()).code, 'ALREADY_MEMBER');
        assert.equal(await raw.accountCompanyMember.count({ where: { companyId } }), before);
        const existing = await raw.accountCompanyMember.findUnique({ where: { id: 'reinvite-existing-account' } });
        assert.equal(existing.role, 'member'); assert.equal(existing.email, 'previous@example.invalid');
        assert.equal(state.stripeAttempts, 0); assert.equal(state.notifications, 0);
      });
    }
    await check('full-capacity-active-account-reinvite-never-suggests-another-seat', async () => {
      await raw.accountCompanyMember.create({ data: { id: 'full-existing-account', companyId, email: 'previous@example.invalid', userId: 'synthetic-invitee', role: 'member', status: 'active', invitedAt: new actualDate(clock.now) } });
      state.purchased = 4; await raw.accountCompanyBilling.update({ where: { companyId }, data: { seats: 4 } });
      const response = await member.POST({ json: async () => ({ email: 'invitee@example.invalid' }) });
      assert.equal(response.status, 409); assert.equal((await response.json()).code, 'ALREADY_MEMBER');
      assert.equal(await used(), 4); assert.equal(await raw.accountCompanyMember.count({ where: { companyId } }), 3);
      assert.equal(state.stripeAttempts, 0);
    });
    await check('registered-account-without-active-company-membership-can-be-invited', async () => {
      const response = await member.POST({ json: async () => ({ email: 'invitee@example.invalid' }) });
      assert.equal(response.status, 201);
      const row = await raw.accountCompanyMember.findUnique({ where: { companyId_email: { companyId, email: 'invitee@example.invalid' } } });
      assert.equal(row.status, 'invited'); assert.equal(row.userId, null);
      assert.equal(state.stripeAttempts, 0);
    });
    await check('same-account-old-email-membership-blocks-duplicate-acceptance', async () => {
      await raw.accountCompanyMember.create({ data: { id: 'same-account-old-email', companyId, email: 'previous@example.invalid', userId: 'synthetic-invitee', role: 'member', status: 'active', invitedAt: new actualDate(clock.now) } });
      await raw.accountCompanyMember.create({ data: { id: 'same-account-new-invite', companyId, email: 'invitee@example.invalid', role: 'admin', status: 'invited', invitedAt: new actualDate(clock.now), inviteToken: 'same-account-new-token' } });
      const response = await accept.POST({ json: async () => ({ token: 'same-account-new-token' }) });
      assert.equal(response.status, 409); assert.equal((await response.json()).code, 'ALREADY_MEMBER');
      assert.equal(await raw.accountCompanyMember.count({ where: { companyId, userId: 'synthetic-invitee', status: 'active' } }), 1);
      const existing = await raw.accountCompanyMember.findUnique({ where: { id: 'same-account-old-email' } });
      assert.equal(existing.role, 'member'); assert.equal(existing.email, 'previous@example.invalid');
      const pending = await raw.accountCompanyMember.findUnique({ where: { id: 'same-account-new-invite' } });
      assert.equal(pending.status, 'invited'); assert.equal(pending.inviteToken, 'same-account-new-token');
      assert.equal(state.stripeAttempts, 0); assert.equal(state.notifications, 0);
    });
    await check('parallel-stale-account-emails-cannot-activate-membership', async () => {
      for (const n of [1, 2]) await raw.accountCompanyMember.create({ data: { id: 'parallel-email-' + n, companyId, email: `parallel${n}@example.invalid`, role: 'member', status: 'invited', invitedAt: new actualDate(clock.now), inviteToken: 'parallel-email-token-' + n } });
      const accepting = [1, 2].map(n => route('src/app/api/pricing/members/accept/route.ts', { id: 'synthetic-invitee', email: `parallel${n}@example.invalid` }).POST({ json: async () => ({ token: 'parallel-email-token-' + n }) }));
      const responses = await Promise.all(accepting);
      assert.deepEqual(responses.map(r => r.status).sort(), [404, 404]);
      assert.equal(await raw.accountCompanyMember.count({ where: { companyId, userId: 'synthetic-invitee', status: 'active' } }), 0);
      assert.equal(await raw.accountCompanyMember.count({ where: { companyId, id: { startsWith: 'parallel-email-' }, status: 'invited' } }), 2);
      assert.equal(state.stripeAttempts, 0); assert.equal(state.notifications, 0);
    });
    await check('persisted-duplicate-account-rows-consume-one-seat-without-data-migration', async () => {
      for (const n of [1, 2]) await raw.accountCompanyMember.create({ data: { id: 'persisted-alias-' + n, companyId, email: `alias${n}@example.invalid`, userId: 'synthetic-invitee', role: 'member', status: 'active', invitedAt: new actualDate(clock.now) } });
      assert.equal(await used(), 4);
      assert.equal(await raw.accountCompanyMember.count({ where: { companyId, userId: 'synthetic-invitee', status: 'active' } }), 2);
      assert.equal(state.stripeAttempts, 0);
    });
    await check('early-resume-must-not-charge-a-contract-no-longer-owned', async () => {
      state.beforeStripeUpdate = async () => { throw Error('SYNTHETIC_NO_PROVIDER_RESULT'); };
      assert.equal((await change(6)).status, 502); assert.equal(state.effectiveStripeWrites, 0);
      clock.now += 6 * 60000; state.beforeStripeUpdate = null; state.contractAvailable = false;
      const response = await seats.POST({ json: async () => ({ seats: 6, operationKey: 'synthetic-operation-0001', mode: 'resume' }) });
      assert.equal(response.status, 409, 'retry after contract disappearance must remain pending without Stripe mutation');
      assert.equal(state.stripeAttempts, 1); assert.equal(state.effectiveStripeWrites, 0);
      assert.equal(await cacheSeats(), 5);
    });
    for (const [name, alter] of [
      ['early-resume-holds-changed-status', () => { state.currentStatus = 'past_due'; }],
      ['early-resume-holds-replaced-subscription', () => { state.currentSubscriptionId = 'sub_replacement'; }],
      ['early-resume-holds-changed-interval', () => { state.currentInterval = 'year'; }],
      ['early-resume-holds-unrelated-current-quantity', () => { state.purchased = 4; }],
    ]) await check(name, async () => {
      state.beforeStripeUpdate = async () => { throw Error('SYNTHETIC_NO_PROVIDER_RESULT'); };
      assert.equal((await change(6)).status, 502); assert.equal(state.effectiveStripeWrites, 0);
      clock.now += 6 * 60000; state.beforeStripeUpdate = null; alter();
      const response = await seats.POST({ json: async () => ({ seats: 6, operationKey: 'synthetic-operation-0001', mode: 'resume' }) });
      assert.equal(response.status, 409); assert.equal((await response.json()).code, 'SEAT_OPERATION_RECONCILE');
      assert.equal(state.stripeAttempts, 1); assert.equal(state.effectiveStripeWrites, 0); assert.equal(await cacheSeats(), 5);
    });
    await check('early-resume-provider-outage-cannot-authorize-old-request', async () => {
      state.beforeStripeUpdate = async () => { throw Error('SYNTHETIC_NO_PROVIDER_RESULT'); };
      assert.equal((await change(6)).status, 502);
      clock.now += 6 * 60000; state.beforeStripeUpdate = null; state.contractLookupFails = true;
      const response = await seats.POST({ json: async () => ({ seats: 6, operationKey: 'synthetic-operation-0001', mode: 'resume' }) });
      assert.equal(response.status, 503); assert.equal(state.stripeAttempts, 1); assert.equal(state.effectiveStripeWrites, 0);
      assert.equal(await cacheSeats(), 5); assert.equal((await invite()).status, 409);
    });
    await check('fresh-change-rechecks-contract-after-monthly-preparation', async () => {
      state.ledger = true;
      state.afterOwnMonthlyGrant = async () => { state.contractAvailable = false; };
      const response = await change(6);
      assert.equal(response.status, 409); assert.equal((await response.json()).code, 'SEAT_OPERATION_RECONCILE');
      assert.equal(state.stripeAttempts, 0); assert.equal(state.effectiveStripeWrites, 0); assert.equal(await cacheSeats(), 5);
      assert.equal((await invite()).status, 409);
    });
    await check('invoice-collection-upgrade-does-not-reserve-or-charge', async () => {
      state.collectionMethod = 'send_invoice';
      const response = await change(6);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, 'SEAT_COLLECTION_METHOD');
      assert.equal(state.stripeAttempts, 0);
      assert.equal(await cacheSeats(), 5);
      assert.equal((await invite()).status, 201);
    });
    await check('invoice-collection-downgrade-does-not-prorate', async () => {
      state.collectionMethod = 'send_invoice';
      assert.equal((await change(3)).status, 200);
      assert.equal(state.stripeAttempts, 1);
      assert.equal(await cacheSeats(), 3);
      assert.equal(state.notifications, 0);
    });
    await check('decrease-before-invite', async () => { assert.equal((await change()).status, 200); const response = await invite(); assert.equal(response.status, 409); assert.equal((await response.json()).code, 'NO_SEAT'); });
    await check('invite-before-decrease', async () => { assert.equal((await invite()).status, 201); const response = await change(); assert.equal(response.status, 409); assert.equal((await response.json()).code, 'BELOW_USED'); });
    await check('body-paused-invite-rechecks-current-capacity', async () => {
      const reached = deferred(), resume = deferred();
      const pending = member.POST({ json: async () => { reached.resolve(); await resume.promise; return { email: 'new@example.invalid' }; } });
      await reached.promise; assert.equal((await change()).status, 200); resume.resolve(); const response = await pending; assert.equal(response.status, 409); assert.equal((await response.json()).code, 'NO_SEAT');
    });
    await check('stripe-in-flight-reservation-blocks-invite', async () => {
      const reached = deferred(), resume = deferred(); state.beforeStripeUpdate = async () => { reached.resolve(); await resume.promise; };
      const pending = change(); await reached.promise; const response = await invite(); assert.equal(response.status, 409); assert.equal((await response.json()).code, 'SEAT_OPERATION_BUSY'); resume.resolve(); assert.equal((await pending).status, 200);
    });
    await check('accept-expiry-cannot-race-past-decrease', async () => {
      await raw.accountCompanyMember.create({ data: { id: 'synthetic-invitation', companyId, email: 'invitee@example.invalid', role: 'member', status: 'invited', invitedAt: new actualDate(clock.now - 7 * 86400000 + 100), inviteToken: 'synthetic-token' } });
      const reached = deferred(), resume = deferred(); state.beforeAcceptUpdate = async () => { reached.resolve(); await resume.promise; };
      const joining = accept.POST({ json: async () => ({ token: 'synthetic-token' }) }); await reached.promise;
      clock.now += 1000; const decreasing = change(); resume.resolve();
      const joinedResponse = await joining, decreaseResponse = await decreasing;
      // Admission already holds the company lock. It may finish first; then
      // the waiting decrease must count that active member and refuse 3 seats.
      assert.equal(joinedResponse.status, 200); assert.equal(decreaseResponse.status, 409); assert.equal(await used(), 4);
    });
    await check('card-rejection-replays-and-new-operation-can-retry', async () => {
      state.cardError = true; assert.equal((await change(6)).status, 402); assert.equal((await change(6)).status, 402); assert.equal(state.stripeAttempts, 1);
      state.cardError = false; assert.equal((await change(6, 'synthetic-operation-0002')).status, 200); assert.equal(state.effectiveStripeWrites, 1);
    });
    await check('lost-stripe-response-retries-same-key-without-second-mutation', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); assert.equal((await invite()).status, 409);
      clock.now += 300001; assert.equal((await change(6)).status, 200); assert.equal(state.effectiveStripeWrites, 1); assert.equal(state.keys[0], state.keys[1]);
      assert.equal((await change(6)).status, 200); assert.equal(state.stripeAttempts, 2); assert.equal(state.notifications, 1);
    });
    await check('cache-failure-keeps-reservation-until-same-key-retry', async () => {
      state.failCacheOnce = true; assert.equal((await change(6)).status, 502); assert.equal(await cacheSeats(), 5); assert.equal((await invite()).status, 409);
      clock.now += 300001; assert.equal((await change(6)).status, 200); assert.equal(await cacheSeats(), 6); assert.equal(state.effectiveStripeWrites, 1);
    });
    await check('quantity-mismatch-and-expired-retry-never-unlock-admission', async () => {
      state.mismatch = true; assert.equal((await change(6)).status, 409); assert.equal((await invite()).status, 409);
      clock.now += 21 * 3600000; const response = await change(6); assert.equal(response.status, 409); assert.equal((await response.json()).code, 'SEAT_OPERATION_RECONCILE'); assert.equal(state.stripeAttempts, 1);
    });
    await check('point-grant-failure-retries-original-source-key-within-month', async () => {
      state.ledger = true; state.failGrantOnce = true; assert.equal((await change(6)).status, 502); assert.equal((await invite()).status, 409);
      clock.now += 300001; assert.equal((await change(6)).status, 200); assert.equal(state.monthly, 1); assert.equal(state.grants.size, 1); assert.equal(state.grantCalls[0].sourceKey, state.grantCalls[1].sourceKey);
    });
    await check('cross-month-retry-retains-original-grant-month-and-expiry', async () => {
      clock.now = Date.UTC(2026, 10, 29, 23); // Nov 30 08:00 JST
      state.ledger = true; state.failGrantOnce = true;
      assert.equal((await change(6)).status, 502);
      clock.now += 17 * 3600000; // Dec 1 01:00 JST, inside the 20h retry window
      assert.equal((await change(6)).status, 200);
      assert.equal(state.monthly, 1); assert.equal(state.grants.size, 1);
      assert.equal(state.grantCalls[0].sourceKey, 'seat-add:sub_synthetic:2026-11:seat-6');
      assert.equal(state.grantCalls[1].sourceKey, state.grantCalls[0].sourceKey);
      assert.equal(state.grantCalls[1].expiresAt, '2026-12-31T15:00:00.000Z');
      assert.equal(state.grantCalls[1].amount, state.grantCalls[0].amount);
      assert.equal(state.effectiveStripeWrites, 1);
    });
    await check('pending-downsize-defers-monthly-grant-until-confirmed', async () => {
      state.lostOnce = true; assert.equal((await change(3)).status, 502);
      const blocked = await actualPower.grantMonthlyForPlan(companyId, 'PRO');
      assert.equal(blocked.ok, false); assert.equal(blocked.reason, 'precondition');
      assert.equal(await raw.doyaPowerGrant.count(), 0);
      clock.now += 300001; assert.equal((await change(3)).status, 200);
      const granted = await actualPower.grantMonthlyForPlan(companyId, 'PRO');
      assert.equal(granted.ok, true); assert.equal(granted.granted, 2400);
      assert.equal((await raw.doyaPowerGrant.findFirst()).amount, 2400);
    });
    await check('old-preflight-amount-is-recalculated-inside-ledger-transaction', async () => {
      const reached = deferred(), resume = deferred();
      state.afterMonthlyPreflight = async amount => { assert.equal(amount, 3000); reached.resolve(); await resume.promise; };
      const monthly = actualPower.grantMonthlyForPlan(companyId, 'PRO'); await reached.promise;
      assert.equal((await change(3)).status, 200); resume.resolve();
      const granted = await monthly; assert.equal(granted.ok, true); assert.equal(granted.granted, 2400);
      assert.equal(await raw.doyaPowerGrant.count(), 1);
    });
    for (const existingState of [true, false]) await check('serializable-old-snapshot-retries-' + (existingState ? 'existing-state-row' : 'absent-state-row'), async () => {
      await raw.doyaPowerAccount.create({ data: { companyId } });
      if (existingState) await core.withSeatAdmission(companyId, async () => {}, db);
      const reached = deferred(), resume = deferred();
      state.beforeLedgerAccountRead = async () => { reached.resolve(); await resume.promise; };
      const monthly = actualPower.grantMonthlyForPlan(companyId, 'PRO'); await reached.promise;
      assert.equal((await change(3)).status, 200); resume.resolve();
      const granted = await monthly; assert.equal(granted.ok, true); assert.equal(granted.granted, 2400);
      assert(state.ledgerAccountReads >= 2, 'native Serializable conflict did not trigger a fresh attempt');
      assert.equal(await raw.doyaPowerGrant.count(), 1);
    });
    await check('own-preparation-crosses-month-without-double-new-seat-points', async () => {
      clock.now = Date.UTC(2026, 10, 30, 14, 59, 59); state.ledger = true;
      const reached = deferred(), resume = deferred();
      state.afterOwnMonthlyGrant = async () => { reached.resolve(); await resume.promise; };
      const upgrading = change(6); await reached.promise; clock.now += 3000;
      const blocked = await actualPower.grantMonthlyForPlan(companyId, 'PRO'); assert.equal(blocked.ok, false); assert.equal(blocked.reason, 'precondition');
      resume.resolve(); assert.equal((await upgrading).status, 200);
      const december = await actualPower.grantMonthlyForPlan(companyId, 'PRO'); assert.equal(december.ok, true); assert.equal(december.granted, 3300);
      const grants = await raw.doyaPowerGrant.findMany({ orderBy: { sourceKey: 'asc' } });
      assert.equal(grants.length, 2); assert.equal(grants[0].sourceKey, 'monthly:2026-11'); assert.equal(grants[0].amount, 3000);
      assert.equal(grants[1].sourceKey, 'monthly:2026-12'); assert.equal(grants[1].amount, 3300);
      assert.equal(state.grantCalls.length, 0); assert.equal(state.effectiveStripeWrites, 1);
    });
    await check('reclaimed-preparation-prevents-late-original-monthly-grant', async () => {
      state.ledger = true; await raw.doyaPowerAccount.create({ data: { companyId } });
      const reached = deferred(), resume = deferred();
      state.beforeLedgerAccountRead = async () => { reached.resolve(); await resume.promise; };
      const upgrading = change(6); await reached.promise; clock.now += 300001;
      const newer = await core.beginSeatOperation(companyId, 'synthetic-operation-0002', 6, db); assert.equal(newer.kind, 'claimed');
      resume.resolve(); assert.equal((await upgrading).status, 409); assert.equal(state.stripeAttempts, 0); assert.equal(await raw.doyaPowerGrant.count(), 0);
      const row = await raw.systemSetting.findUnique({ where: { key: 'team-seat-operation:v1:' + companyId } });
      assert.equal(JSON.parse(row.value).active.token, newer.claim.token);
    });
    await check('parallel-monthly-grants-create-only-one-native-grant', async () => {
      const results = await Promise.all([actualPower.grantMonthlyForPlan(companyId, 'PRO'), actualPower.grantMonthlyForPlan(companyId, 'PRO')]);
      assert(results.every(r => r.ok)); assert.equal(await raw.doyaPowerGrant.count(), 1);
      assert.equal((await raw.doyaPowerGrant.findFirst()).amount, 3000);
    });
    await check('over20h-paid-upgrade-completes-without-another-stripe-post', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); clock.now += 21 * 3600000;
      assert.equal((await change(6)).status, 200); assert.equal(state.stripeAttempts, 1); assert.equal(await cacheSeats(), 6);
      const receipt = await raw.systemSetting.findUnique({ where: { key: 'team-seat-operation:v1:' + companyId + ':result:synthetic-operation-0001' } });
      const saved = JSON.parse(receipt.value); assert.equal(saved.reconciliation.eventId, 'evt_change1'); assert.equal(saved.reconciliation.invoiceId, 'in_change1');
      const reads = state.evidenceReads; assert.equal((await change(6)).status, 200); assert.equal(state.evidenceReads, reads); assert.equal(state.notifications, 1);
    });
    await check('over20h-downsize-completes-without-invoice-or-stripe-post', async () => {
      state.lostOnce = true; assert.equal((await change(3)).status, 502); clock.now += 21 * 3600000;
      assert.equal((await change(3)).status, 200); assert.equal(state.stripeAttempts, 1); assert.equal(await cacheSeats(), 3); assert.equal(state.evidenceReads, 1);
      const monthly = await actualPower.grantMonthlyForPlan(companyId, 'PRO'); assert.equal(monthly.ok, true); assert.equal(monthly.granted, 2400);
    });
    await check('over20h-paid-proof-finishes-original-point-entitlement-once', async () => {
      state.ledger = true; state.failGrantOnce = true; assert.equal((await change(6)).status, 502); clock.now += 21 * 3600000;
      assert.equal((await change(6)).status, 200); assert.equal(state.stripeAttempts, 1); assert.equal(state.monthly, 1);
      assert.equal(state.grants.size, 1); assert.equal(state.grantCalls[0].sourceKey, state.grantCalls[1].sourceKey);
      assert.equal(await raw.doyaPowerGrant.count(), 2);
    });
    await check('foreign-event-key-never-clears-the-pending-operation', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); state.events[0].request.idempotency_key = 'foreign-key'; clock.now += 21 * 3600000;
      const before = await raw.systemSetting.findUnique({ where: { key: 'team-seat-operation:v1:' + companyId } });
      assert.equal((await change(6)).status, 409); assert.equal(state.stripeAttempts, 1); assert.equal(await cacheSeats(), 5);
      const after = await raw.systemSetting.findUnique({ where: { key: 'team-seat-operation:v1:' + companyId } }); assert.equal(after.value, before.value);
    });
    await check('unpaid-proof-holds-and-later-paid-proof-recovers-without-charge', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); clock.now += 21 * 3600000;
      const invoice = state.invoices.get('in_change1'); invoice.paid = false; invoice.status = 'open';
      assert.equal((await change(6)).status, 409); assert.equal(await cacheSeats(), 5); assert.equal(state.stripeAttempts, 1);
      invoice.paid = true; invoice.status = 'paid'; assert.equal((await change(6)).status, 200); assert.equal(state.stripeAttempts, 1);
    });
    await check('stale-reconciliation-reader-cannot-publish-after-another-reader', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); clock.now += 21 * 3600000;
      const reached = deferred(), resume = deferred(); state.beforeInvoiceEvidenceRead = async () => { reached.resolve(); await resume.promise; };
      const first = change(6); await reached.promise; const second = await change(6); resume.resolve(); const late = await first;
      assert.equal(second.status, 200); assert.equal(late.status, 409); assert.equal(state.stripeAttempts, 1); assert.equal(await cacheSeats(), 6); assert.equal(state.notifications, 1);
    });
    await check('http-body-cannot-forge-server-payment-proof', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); state.events = []; clock.now += 21 * 3600000;
      const response = await seats.POST({ json: async () => ({ seats: 6, operationKey: 'synthetic-operation-0001', proof: { ok: true, eventId: 'evt_forged', invoiceId: 'in_forged' } }) });
      assert.equal(response.status, 409); assert.equal(await cacheSeats(), 5); assert.equal(state.stripeAttempts, 1);
    });
    await check('old-paid-event-cannot-revive-a-contract-no-longer-owned', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); clock.now += 21 * 3600000; state.contractAvailable = false;
      assert.equal((await change(6)).status, 409); assert.equal(state.stripeAttempts, 1); assert.equal(state.evidenceReads, 0); assert.equal(await cacheSeats(), 5);
    });
    await check('old-paid-event-cannot-replace-a-new-current-contract', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); clock.now += 21 * 3600000; state.currentSubscriptionId = 'sub_replacement';
      assert.equal((await change(6)).status, 409); assert.equal(state.stripeAttempts, 1); assert.equal(state.evidenceReads, 0); assert.equal(await cacheSeats(), 5);
    });
    await check('owner-status-get-exposes-pending-operation-without-private-stripe-data', async () => {
      const reached = deferred(), resume = deferred(); state.beforeStripeUpdate = async () => { reached.resolve(); await resume.promise; };
      const changing = change(6); await reached.promise; const response = await seats.GET(); const packet = await response.json(); resume.resolve(); await changing;
      assert.equal(response.status, 200); const view = seatView.parseTeamSeatsView(packet); assert.equal(view.kind, 'pending'); assert.equal(view.pending.action, 'wait'); assert.equal(view.pending.operationKey, 'synthetic-operation-0001');
      assert.equal(JSON.stringify(Object.keys(packet.pending).sort()), JSON.stringify(['action','operationKey','previousSeats','requested']));
      assert(!JSON.stringify(packet).includes('sub_synthetic')); assert(!JSON.stringify(packet).includes('si_synthetic')); assert(!JSON.stringify(packet).includes('token'));
    });
    await check('resume-uses-existing-operation-and-completed-replay', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); clock.now += 300001;
      const status = seatView.parseTeamSeatsView(await (await seats.GET()).json()); assert.equal(status.pending.action, 'resume');
      const post = () => seats.POST({ json: async () => ({ seats: 6, operationKey: status.pending.operationKey, mode: 'resume' }) });
      assert.equal((await post()).status, 200); assert.equal(state.effectiveStripeWrites, 1); const attempts = state.stripeAttempts;
      const replay = await post(); assert.equal(replay.status, 200); assert.equal((await replay.json()).replayed, true); assert.equal(state.stripeAttempts, attempts);
    });
    await check('check-mode-without-existing-operation-never-creates-a-charge', async () => {
      const response = await seats.POST({ json: async () => ({ seats: 6, operationKey: 'synthetic-operation-0001', mode: 'check' }) });
      assert.equal(response.status, 409); assert.equal(state.stripeAttempts, 0); assert.equal(await raw.systemSetting.count(), 0);
    });
    await check('early-check-mode-never-falls-back-to-stripe-retry', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); clock.now += 300001;
      const before = await raw.systemSetting.findUnique({ where: { key: 'team-seat-operation:v1:' + companyId } });
      const response = await seats.POST({ json: async () => ({ seats: 6, operationKey: 'synthetic-operation-0001', mode: 'check' }) });
      assert.equal(response.status, 409); assert.equal(state.stripeAttempts, 1); assert.equal(state.evidenceReads, 0);
      assert.equal((await raw.systemSetting.findUnique({ where: { key: 'team-seat-operation:v1:' + companyId } })).value, before.value);
    });
    await check('explicit-check-mode-recovers-and-replays-without-another-stripe-post', async () => {
      state.lostOnce = true; assert.equal((await change(6)).status, 502); clock.now += 21 * 3600000;
      const status = seatView.parseTeamSeatsView(await (await seats.GET()).json()); assert.equal(status.pending.action, 'check');
      const post = () => seats.POST({ json: async () => ({ seats: status.pending.requested, operationKey: status.pending.operationKey, mode: 'check' }) });
      assert.equal((await post()).status, 200); assert.equal((await post()).status, 200); assert.equal(state.stripeAttempts, 1);
    });
    await check('resume-mode-without-original-operation-cannot-create-one', async () => {
      const response = await seats.POST({ json: async () => ({ seats: 6, operationKey: 'synthetic-operation-0001', mode: 'resume' }) });
      assert.equal(response.status, 409); assert.equal(state.stripeAttempts, 0); assert.equal(await raw.systemSetting.count(), 0);
    });
    await check('resume-mode-cannot-replace-an-expired-preparation-of-another-key', async () => {
      const original = await core.beginSeatOperation(companyId, 'synthetic-operation-0001', 6, db); clock.now += 300001;
      const response = await seats.POST({ json: async () => ({ seats: 6, operationKey: 'synthetic-operation-0002', mode: 'resume' }) });
      assert.equal(response.status, 409); assert.equal(state.stripeAttempts, 0);
      assert.equal(JSON.parse((await raw.systemSetting.findUnique({ where: { key: 'team-seat-operation:v1:' + companyId } })).value).active.token, original.claim.token);
    });
    await check('unsupported-mode-is-rejected-before-any-operation', async () => {
      const response = await seats.POST({ json: async () => ({ seats: 6, operationKey: 'synthetic-operation-0001', mode: 'CHECK' }) });
      assert.equal(response.status, 400); assert.equal(state.stripeAttempts, 0); assert.equal(await raw.systemSetting.count(), 0);
    });
    await check('changed-quoted-quantity-stops-before-stripe-update', async () => {
      const response = await seats.POST({ json: async () => ({ seats: 6, expectedSeats: 4, operationKey: 'synthetic-operation-0001' }) });
      assert.equal(response.status, 409); assert.equal((await response.json()).code, 'SEATS_CHANGED'); assert.equal(state.stripeAttempts, 0); assert.equal(await core.pendingSeatChangeForOwner(companyId, db), null);
    });
    await check('malformed-quoted-quantity-is-not-coerced', async () => {
      const response = await seats.POST({ json: async () => ({ seats: 6, expectedSeats: '5', operationKey: 'synthetic-operation-0001' }) });
      assert.equal(response.status, 400); assert.equal(state.stripeAttempts, 0); assert.equal(await raw.systemSetting.count(), 0);
    });
    await check('stale-owner-header-blocks-seat-read-and-write-before-body', async () => {
      const headers = new Headers({ 'x-doya-owner': 'previous-owner' }); let bodyRead = false;
      assert.equal((await seats.GET({ headers })).status, 403);
      const response = await seats.POST({ headers, json: async () => { bodyRead = true; return { seats: 6, operationKey: 'synthetic-operation-0001' }; } });
      assert.equal(response.status, 403); assert.equal(bodyRead, false); assert.equal(state.stripeAttempts, 0); assert.equal(await raw.systemSetting.count(), 0);
    });
    await check('stale-owner-header-blocks-members-list-invite-and-removal', async () => {
      const headers = new Headers({ 'x-doya-owner': 'previous-owner' }); let bodyRead = false;
      assert.equal((await member.GET({ headers })).status, 403);
      assert.equal((await member.POST({ headers, json: async () => { bodyRead = true; return { email: 'other@example.invalid' }; } })).status, 403);
      assert.equal((await member.DELETE({ headers, url: 'https://synthetic.invalid/api/pricing/members?id=member-1' })).status, 403);
      assert.equal(bodyRead, false); assert.equal(await raw.accountCompanyMember.count(), 2);
    });
    await check('matching-owner-header-and-confirmed-quantity-allow-original-flow', async () => {
      const headers = new Headers({ 'x-doya-owner': owner.id }); assert.equal((await seats.GET({ headers })).status, 200);
      const response = await seats.POST({ headers, json: async () => ({ seats: 6, expectedSeats: 5, operationKey: 'synthetic-operation-0001' }) });
      assert.equal(response.status, 200); assert.equal(state.effectiveStripeWrites, 1);
    });
    await check('preparing-status-is-resumable-with-original-key-after-lease', async () => {
      await core.beginSeatOperation(companyId, 'synthetic-operation-0001', 6, db);
      let status = seatView.parseTeamSeatsView(await (await seats.GET()).json()); assert.equal(status.pending.previousSeats, null); assert.equal(status.pending.action, 'wait'); clock.now += 300001;
      status = seatView.parseTeamSeatsView(await (await seats.GET()).json()); assert.equal(status.pending.action, 'resume');
      const response = await seats.POST({ json: async () => ({ seats: status.pending.requested, operationKey: status.pending.operationKey, mode: 'resume' }) }); assert.equal(response.status, 200); assert.equal(state.effectiveStripeWrites, 1);
    });
    await check('check-mode-replays-definitive-payment-rejection-without-new-attempt', async () => {
      state.cardError = true; assert.equal((await change(6)).status, 402);
      const response = await seats.POST({ json: async () => ({ seats: 6, operationKey: 'synthetic-operation-0001', mode: 'check' }) }); assert.equal(response.status, 402); assert.equal(state.stripeAttempts, 1);
    });
    const files = ['src/lib/pricing-v2/seat-operation.ts', 'src/lib/pricing-v2/team.server.ts', 'src/app/api/pricing/seats/route.ts', 'src/app/api/pricing/members/route.ts', 'src/app/api/pricing/members/accept/route.ts', 'src/lib/doya-power/ledger.ts', 'src/lib/doya-power/index.ts', 'src/lib/pricing-v2/seat-reconciliation-proof.ts', 'src/lib/pricing-v2/seat-reconciliation.server.ts', 'src/lib/pricing-v2/seat-operation-view.ts'];
    fs.writeFileSync(evidenceDir + '/routes-model-result.json', JSON.stringify({ checkedAt: new actualDate().toISOString(), count: cases.length, cases, actualCandidateRoutesCoreTeamServerLedgerGateAndIndex: true, realOwnedPostgres: true, realPrismaModels: true, schemaSource: 'Current repository prisma/schema.prisma', databaseFaultInjectionDelegatesToNativeModels: true, stripeSessionAndNotificationsSynthetic: true, actualPointLedgerVerified: true, fullRegressionRun: false, productionRequests: 0, stripeNetworkRequests: 0, candidateHashes: Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(seatSourcePath(f))).digest('hex')])) }, null, 2) + '\n');
  } finally {
    await raw.$disconnect();
    fs.writeFileSync(evidenceDir + '/routes-model-cleanup.json', JSON.stringify({ checkedAt: new actualDate().toISOString(), clientDisconnected: true, originalDatabaseNotUsed: true, ownedDatabaseCleanupBySupervisor: true }, null, 2) + '\n');
  }
})().catch(e => { console.error(JSON.stringify({ completed: false, name: e.name, safeCode: typeof e.code === 'string' ? e.code : null, assertion: e.name === 'AssertionError' ? e.message : undefined })); process.exitCode = 1; });
