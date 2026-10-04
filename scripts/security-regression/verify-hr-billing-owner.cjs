const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const HrMemberRole = { OWNER: 'OWNER', ADMIN: 'ADMIN' };
const { getOrgPlanLimits } = load('src/lib/hr/billing.ts', { '@/lib/prisma': { prisma: {} } });
assert.deepEqual({ ...getOrgPlanLimits('BUNDLE') }, { maxEmployees: 100, maxAiUsage: -1, maxMembers: -1 });
let role = 'ADMIN';
let ctxUserId = 'u1';
let customerCalls = 0;
let checkoutCalls = 0;
let portalCalls = 0;
let portalOptions = null;
let portalResolvedCustomerId = 'cus_verified';
let genericCheckoutCalls = 0;
let existingSubscription = false;
let checkoutOptions = null;
let customerEmail = 'test@example.invalid';
let customerOwnerId = 'u1';
const prisma = {
  user: { findUnique: async () => ({ id: 'u1', stripeCustomerId: 'cus_test', email: 'test@example.invalid', name: 'Test' }) },
  hrOrganizationMember: { findFirst: async () => ({ role }) },
};
const stripe = {
  customers: { retrieve: async () => { customerCalls++; return { id: 'cus_test', email: customerEmail, metadata: { userId: customerOwnerId } }; } },
  checkout: { sessions: { create: async (options) => { checkoutCalls++; checkoutOptions = options; return { id: 'cs_test', url: 'https://offline.invalid/checkout' }; } } },
  billingPortal: { sessions: { create: async (options) => { portalCalls++; portalOptions = options; return { url: 'https://offline.invalid/portal' }; } } },
};
const common = {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'u1', email: 'test@example.invalid' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  '@/lib/hr/access': { getHrContext: async () => ({ userId: ctxUserId, organizationId: 'org1', role }) },
  '@/lib/hr/types': { HrMemberRole },
  '@/lib/hr/audit': { logAudit: async () => {} },
  '@/lib/checkout-reservation': { CheckoutReservationError: class extends Error {}, createReservedCheckoutSession: ({ create }) => create('test-key', 1900000000) },
};
const checkout = load('src/app/api/hr/billing/checkout/route.ts', {
  ...common,
  '@/lib/stripe': { stripe, findActiveLikeSubscriptions: async () => existingSubscription ? [{ id: 'sub_existing' }] : [], STRIPE_PRICE_IDS: { hr: { starter: { monthly: 'price_test', yearly: 'price_yearly' }, pro: { monthly: 'price_test', yearly: 'price_yearly' }, enterprise: { monthly: 'price_test', yearly: 'price_yearly' } } } },
});
const portal = load('src/app/api/hr/billing/portal/route.ts', {
  ...common,
  '@/lib/stripe': {
    stripe,
    createCustomerPortalSession: async ({ customerId, returnUrl }) => {
      portalCalls++;
      portalOptions = { customer: customerId, return_url: returnUrl };
      return { url: 'https://offline.invalid/portal' };
    },
    resolveBillingCustomerId: async ({ userId, email, stripeCustomerId }) => {
      assert.equal(userId, 'u1');
      assert.equal(email, 'test@example.invalid');
      assert.equal(stripeCustomerId, 'cus_test');
      return portalResolvedCustomerId;
    },
  },
});
const generic = load('src/app/api/stripe/checkout/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': common['next-auth'],
  '@/lib/auth': common['@/lib/auth'],
  '@/lib/prisma': { prisma },
  '@/lib/checkout-reservation': common['@/lib/checkout-reservation'],
  '@/lib/stripe': {
    STRIPE_PRICE_IDS: {},
    findActiveLikeSubscriptions: async () => [],
    createCheckoutSession: async () => { genericCheckoutCalls++; return { url: 'https://offline.invalid/checkout' }; },
  },
  '@/lib/unified-plan': { UNIFIED_TRIAL_DAYS: 30 },
  '@/lib/trial': { isTrialEligible: async () => true },
});

(async () => {
  const req = { json: async () => ({ plan: 'pro' }) };
  let response = await checkout.POST(req);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'HR_BILLING_OWNER_REQUIRED');
  response = await portal.POST({});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'HR_BILLING_OWNER_REQUIRED');
  response = await generic.POST(new Request('https://offline.invalid/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ planId: 'banner-pro', serviceId: 'hr' }) }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'HR_BILLING_OWNER_REQUIRED');
  assert.equal(customerCalls + checkoutCalls + portalCalls + genericCheckoutCalls, 0, 'ADMIN must not reach Stripe');

  role = 'OWNER';
  ctxUserId = 'other-user';
  response = await checkout.POST(req);
  assert.equal(response.status, 403);
  response = await portal.POST({});
  assert.equal(response.status, 403);
  assert.equal(customerCalls + checkoutCalls + portalCalls, 0, 'mismatched identity must not reach Stripe');

  ctxUserId = 'u1';
  response = await checkout.POST({ json: async () => ({ plan: 'pro', interval: 'weekly' }) });
  assert.equal(response.status, 400);
  assert.equal(checkoutCalls, 0, 'invalid billing interval must not create a checkout');
  existingSubscription = true;
  response = await checkout.POST(req);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'ALREADY_SUBSCRIBED');
  assert.equal(checkoutCalls, 0, 'existing subscription must not create a second checkout');
  existingSubscription = false;
  customerEmail = 'other@example.invalid';
  response = await checkout.POST(req);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'CUSTOMER_OWNERSHIP_MISMATCH');
  assert.equal(checkoutCalls, 0, 'foreign customer email must not create a checkout');
  customerEmail = 'test@example.invalid';
  customerOwnerId = 'other-user';
  response = await checkout.POST(req);
  assert.equal(response.status, 409);
  assert.equal(checkoutCalls, 0, 'foreign customer owner must not create a checkout');
  customerOwnerId = 'u1';
  response = await checkout.POST(req);
  assert.equal(response.status, 200);
  response = await portal.POST({});
  assert.equal(response.status, 200);
  assert.equal(checkoutCalls, 1);
  assert.equal(portalCalls, 1);
  assert.equal(portalOptions.customer, 'cus_verified', 'portal must use the verified customer, not the stored pointer');
  portalResolvedCustomerId = null;
  response = await portal.POST({});
  assert.equal(response.status, 409);
  assert.equal(portalCalls, 1, 'unverified customer must not reach the billing portal');
  assert.match(checkoutOptions.success_url, /\/hr\/settings\/billing\?success=true&session_id=\{CHECKOUT_SESSION_ID\}$/);
  console.log('PASS HR billing: non-owner and mismatched identity rejected before Stripe; owner accepted');
})().catch((error) => { console.error(error); process.exitCode = 1; });
