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
let genericCheckoutCalls = 0;
let existingSubscription = false;
const prisma = {
  user: { findUnique: async () => ({ id: 'u1', stripeCustomerId: 'cus_test', email: 'test@example.invalid', name: 'Test' }) },
  hrOrganizationMember: { findFirst: async () => ({ role }) },
};
const stripe = {
  customers: { retrieve: async () => { customerCalls++; return { id: 'cus_test' }; } },
  checkout: { sessions: { create: async () => { checkoutCalls++; return { id: 'cs_test', url: 'https://offline.invalid/checkout' }; } } },
  billingPortal: { sessions: { create: async () => { portalCalls++; return { url: 'https://offline.invalid/portal' }; } } },
};
const common = {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'u1', email: 'test@example.invalid' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  '@/lib/hr/access': { getHrContext: async () => ({ userId: ctxUserId, organizationId: 'org1', role }) },
  '@/lib/hr/types': { HrMemberRole },
  '@/lib/hr/audit': { logAudit: async () => {} },
};
const checkout = load('src/app/api/hr/billing/checkout/route.ts', {
  ...common,
  '@/lib/stripe': { stripe, findActiveLikeSubscriptions: async () => existingSubscription ? [{ id: 'sub_existing' }] : [], STRIPE_PRICE_IDS: { hr: { starter: { monthly: 'price_test', yearly: 'price_yearly' }, pro: { monthly: 'price_test', yearly: 'price_yearly' }, enterprise: { monthly: 'price_test', yearly: 'price_yearly' } } } },
});
const portal = load('src/app/api/hr/billing/portal/route.ts', { ...common, '@/lib/stripe': { stripe } });
const generic = load('src/app/api/stripe/checkout/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': common['next-auth'],
  '@/lib/auth': common['@/lib/auth'],
  '@/lib/prisma': { prisma },
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
  existingSubscription = true;
  response = await checkout.POST(req);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'ALREADY_SUBSCRIBED');
  assert.equal(checkoutCalls, 0, 'existing subscription must not create a second checkout');
  existingSubscription = false;
  response = await checkout.POST(req);
  assert.equal(response.status, 200);
  response = await portal.POST({});
  assert.equal(response.status, 200);
  assert.equal(checkoutCalls, 1);
  assert.equal(portalCalls, 1);
  console.log('PASS HR billing: non-owner and mismatched identity rejected before Stripe; owner accepted');
})().catch((error) => { console.error(error); process.exitCode = 1; });
